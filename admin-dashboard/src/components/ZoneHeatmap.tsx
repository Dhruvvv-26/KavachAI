import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, CircleMarker, Popup, Tooltip as LTooltip } from 'react-leaflet'
import type { Zone } from '../lib/types'
import { fetchZones, fetchTriggerStatus, ML } from '../lib/api'
import type { ActiveTrigger } from '../lib/types'

// ML Service risk overlay endpoint
// GET /api/v1/predict/disruption?zone_code={zone_code}
const risk_overlay_ml = async (zone_code: string) => {
  try {
    const r = await fetch(`${ML}/api/v1/predict/disruption?zone_code=${zone_code}`, { signal: AbortSignal.timeout(3000) })
    if (!r.ok) return null
    return await r.json()
  } catch { return null }
}

function riskColor(score: number): string {
  if (score < 0.35) return '#059669'
  if (score < 0.55) return '#10b981'
  if (score < 0.70) return '#d97706'
  if (score < 0.85) return '#ea580c'
  return '#dc2626'
}

function riskLabel(score: number): string {
  if (score < 0.35) return 'Low'
  if (score < 0.55) return 'Moderate'
  if (score < 0.70) return 'Elevated'
  if (score < 0.85) return 'High'
  return 'Critical'
}

function CityLegend() {
  const entries = [
    { label: 'Low', color: '#059669' },
    { label: 'Moderate', color: '#10b981' },
    { label: 'Elevated', color: '#d97706' },
    { label: 'High', color: '#ea580c' },
    { label: 'Critical', color: '#dc2626' },
  ]
  return (
    <div style={{
      position: 'absolute', bottom: 16, left: 16, zIndex: 1000,
      background: 'var(--surface-0)', border: '1px solid var(--border-color)',
      borderRadius: 6, padding: '10px 14px',
      boxShadow: 'var(--shadow-md)', display: 'flex', flexDirection: 'column', gap: 4,
    }}>
      <div style={{ fontSize: 9, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2, fontWeight: 700 }}>Risk Level</div>
      {entries.map(e => (
        <div key={e.label} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--text-2)' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: e.color, display: 'inline-block', opacity: 0.85 }} />
          {e.label}
        </div>
      ))}
    </div>
  )
}

export default function ZoneHeatmap({ live }: { live: boolean }) {
  const [zones, setZones] = useState<Zone[]>([])
  const [activeTriggers, setActiveTriggers] = useState<ActiveTrigger[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [z, t] = await Promise.all([fetchZones(), fetchTriggerStatus()])
      setZones(z.data)
      setActiveTriggers(t.data.active_triggers ?? [])
      setLoading(false)
    }
    load()
    const iv = setInterval(load, 60000) // 60-second refresh for zone risk overlay
    return () => clearInterval(iv)
  }, [])

  const activeZones = new Set(activeTriggers.map(t => t.zone))

  // Detect dark mode for map tile selection
  const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark')

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
        <div className="shimmer" style={{ width: 200, height: 20, borderRadius: 4 }} />
      </div>
    )
  }

  return (
    <div className="fade-in" style={{ maxWidth: 1100, display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 className="kv-page-title">Zone Risk Heatmap</h1>
        <p className="kv-page-subtitle">PostGIS zone risk overlay — Delhi NCR, Mumbai, Bengaluru · Real-time trigger indicators</p>
      </div>

      {!live && (
        <div className="kv-card-flat" style={{
          padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8,
          background: 'var(--warning-muted)', border: '1px solid var(--warning)',
          borderRadius: 6, fontSize: 12, color: 'var(--warning)', fontWeight: 500,
        }}>
          Demo mode — zone centroids from seed data. Connect to backend for live AQI-weighted risk.
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 260px', gap: 16, alignItems: 'start' }}>
        {/* Map */}
        <div className="kv-card" style={{ overflow: 'hidden', position: 'relative', borderRadius: 8 }}>
          <MapContainer center={[24.0, 77.5]} zoom={5} style={{ height: 480 }} zoomControl={true}>
            <TileLayer
              url={isDark
                ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                : "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
              }
              attribution='&copy; <a href="https://carto.com/">CARTO</a>'
            />
            {zones.map(zone => {
              const isActive = activeZones.has(zone.zone_id)
              const color = riskColor(zone.risk_score)
              return (
                <CircleMarker
                  key={zone.zone_id}
                  center={[zone.centroid_lat, zone.centroid_lon]}
                  radius={Math.max(12, zone.active_riders / 3)}
                  pathOptions={{
                    fillColor: color,
                    fillOpacity: isActive ? 0.85 : 0.5,
                    color: isActive ? '#fff' : color,
                    weight: isActive ? 2 : 1,
                  }}
                >
                  <LTooltip>
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, lineHeight: 1.6, color: '#111' }}>
                      <strong>{zone.zone_id}</strong><br />
                      Risk: {riskLabel(zone.risk_score)} ({(zone.risk_score * 100).toFixed(0)}%)<br />
                      Riders: {zone.active_riders}<br />
                      Triggers (30d): {zone.trigger_count_30d}<br />
                      {zone.last_trigger && <>Last: {zone.last_trigger}</>}
                      {isActive && <><br /><span style={{ color: '#dc2626', fontWeight: 700 }}>ACTIVE TRIGGER</span></>}
                    </div>
                  </LTooltip>
                  <Popup>
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, minWidth: 170, color: '#111' }}>
                      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>{zone.zone_id}</div>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <tbody>
                          <tr><td style={{ color: '#666', paddingRight: 8 }}>City</td><td>{zone.city}</td></tr>
                          <tr><td style={{ color: '#666' }}>Risk</td><td style={{ color: riskColor(zone.risk_score), fontWeight: 700 }}>{(zone.risk_score * 100).toFixed(0)}%</td></tr>
                          <tr><td style={{ color: '#666' }}>Riders</td><td>{zone.active_riders}</td></tr>
                          <tr><td style={{ color: '#666' }}>T(30d)</td><td>{zone.trigger_count_30d}</td></tr>
                          {zone.last_trigger && <tr><td style={{ color: '#666' }}>Last</td><td>{zone.last_trigger}</td></tr>}
                          <tr><td style={{ color: '#666' }}>Coord</td><td>{zone.centroid_lat.toFixed(4)}, {zone.centroid_lon.toFixed(4)}</td></tr>
                        </tbody>
                      </table>
                      {isActive && (
                        <div style={{ marginTop: 6, padding: '3px 6px', background: '#fef2f2', borderRadius: 3, color: '#dc2626', fontWeight: 700, fontSize: 10 }}>
                          Active parametric trigger
                        </div>
                      )}
                    </div>
                  </Popup>
                </CircleMarker>
              )
            })}
            <CityLegend />
          </MapContainer>
        </div>

        {/* Side panels */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Zone Summary */}
          <div className="kv-card" style={{ padding: 16 }}>
            <div className="kv-section-label" style={{ marginBottom: 10 }}>Zone Summary</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {zones.slice().sort((a, b) => b.risk_score - a.risk_score).map(zone => (
                <div key={zone.zone_id} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '8px 0', borderBottom: '1px solid var(--border-subtle)',
                }}>
                  <span style={{
                    width: 6, height: 6, borderRadius: '50%',
                    background: riskColor(zone.risk_score), flexShrink: 0,
                    boxShadow: activeZones.has(zone.zone_id) ? `0 0 0 3px ${riskColor(zone.risk_score)}30` : 'none',
                  }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-1)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {zone.zone_id}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 1 }}>
                      {zone.active_riders} riders · T30d: {zone.trigger_count_30d}
                    </div>
                  </div>
                  <span style={{
                    fontSize: 11, fontFamily: "'JetBrains Mono', monospace",
                    color: riskColor(zone.risk_score), fontWeight: 700,
                  }}>
                    {(zone.risk_score * 100).toFixed(0)}%
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Active Triggers */}
          {activeTriggers.length > 0 && (
            <div className="kv-card" style={{ padding: 16, borderColor: 'var(--danger)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div className="kv-section-label" style={{ marginBottom: 0 }}>Active Triggers</div>
                <span className="kv-badge kv-badge-danger">Live</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {activeTriggers.map((t, i) => (
                  <div key={i} className="kv-card-flat" style={{
                    padding: '8px 10px',
                    background: 'var(--danger-muted)',
                    border: '1px solid var(--danger)',
                    borderRadius: 4,
                  }}>
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--danger)', fontWeight: 700, fontSize: 11 }}>{t.zone}</div>
                    <div style={{ color: 'var(--text-2)', marginTop: 2, fontWeight: 500, fontSize: 11 }}>
                      {t.event_type.toUpperCase()} · {t.metric_value} · <span style={{ fontWeight: 700 }}>Tier {t.tier}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
