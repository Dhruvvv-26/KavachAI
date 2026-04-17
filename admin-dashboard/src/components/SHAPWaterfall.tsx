import { useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, Cell, ResponsiveContainer, ReferenceLine } from 'recharts'
import type { SHAPInput } from '../lib/types'
import { calculatePremium } from '../lib/api'

const FEATURE_LABELS: Record<string, string> = {
  base_rate: 'Base rate',
  zone_aqi_risk: 'Zone AQI risk',
  seasonality_month: 'Month seasonality',
  vehicle_type_bicycle: 'Vehicle type (bicycle)',
  disruption_history_90d: 'Disruption history 90d',
  declared_daily_trips: 'Daily trip volume',
  avg_daily_earnings: 'Daily earnings baseline',
  historical_rain_events: 'Rain event history',
  platform_blinkit_multiplier: 'Platform (Blinkit)',
  coverage_tier_standard: 'Coverage tier (Standard)',
  monthly_work_days: 'Monthly work days',
  new_rider_discount: 'New rider discount',
  zone_clustering_adjustment: 'Zone cluster adjustment',
}

interface WaterfallPoint {
  name: string; contribution: number; cumulative: number; positive: boolean; isTotal: boolean
}

function buildWaterfall(shap: Record<string, number>): WaterfallPoint[] {
  const sorted = Object.entries(shap).sort(([, a], [, b]) => Math.abs(b) - Math.abs(a))
  let running = 0
  const points: WaterfallPoint[] = []
  for (const [key, val] of sorted) {
    const prev = running; running += val
    points.push({ name: FEATURE_LABELS[key] ?? key, contribution: val, cumulative: val >= 0 ? prev : running, positive: val >= 0, isTotal: false })
  }
  points.push({ name: 'Total Premium', contribution: running, cumulative: 0, positive: true, isTotal: true })
  return points
}

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload as WaterfallPoint
  if (!d) return null
  return (
    <div style={{
      background: 'var(--surface-0)', border: '1px solid var(--border-color)',
      borderRadius: 6, padding: '8px 12px', fontSize: 12, boxShadow: 'var(--shadow-md)',
    }}>
      <div style={{ color: 'var(--text-3)', marginBottom: 4, fontWeight: 500 }}>{d.name}</div>
      <div style={{
        fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, fontSize: 14,
        color: d.positive ? 'var(--success)' : 'var(--danger)',
      }}>
        {d.isTotal ? '=' : (d.positive ? '+' : '')}₹{d.contribution.toFixed(2)}
      </div>
    </div>
  )
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</label>
      {children}
    </div>
  )
}

export default function SHAPWaterfall({ live }: { live: boolean }) {
  const [inputs, setInputs] = useState<SHAPInput>({
    city: 'delhi_ncr', vehicle_type: 'bicycle', coverage_tier: 'standard', month: 7,
    historical_aqi_events_12m: 45, historical_rain_events_12m: 28,
    disruption_history_90d: 15, declared_daily_trips: 30,
    avg_daily_earnings: 1100.0, monthly_work_days: 22,
  })
  const [result, setResult] = useState<{ premium: number; shap: Record<string, number> } | null>(null)
  const [loading, setLoading] = useState(false)
  const [fromLive, setFromLive] = useState(false)

  async function handleCalculate() {
    setLoading(true)
    try {
      const { data, live: isLive } = await calculatePremium(inputs)
      setResult({ premium: data.recommended_premium, shap: data.shap_breakdown })
      setFromLive(isLive)
    } catch (e) {
      console.error(e)
      alert("Error reaching ML service")
    } finally { setLoading(false) }
  }

  const waterfallData = result ? buildWaterfall(result.shap) : null

  function set<K extends keyof SHAPInput>(k: K, v: SHAPInput[K]) {
    setInputs(prev => ({ ...prev, [k]: v }))
  }

  return (
    <div className="fade-in" style={{ maxWidth: 900, display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 className="kv-page-title">SHAP Premium Explainer</h1>
        <p className="kv-page-subtitle">XGBoost + LightGBM ensemble — per-feature premium contribution (IRDAI-compliant)</p>
      </div>

      {!live && (
        <div className="kv-card-flat" style={{
          padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8,
          background: 'var(--warning-muted)', border: '1px solid var(--warning)',
          borderRadius: 6, fontSize: 12, color: 'var(--warning)', fontWeight: 500,
        }}>
          Demo mode — showing illustrative SHAP data. Start docker-compose for live inference.
        </div>
      )}

      {/* Input Form */}
      <div className="kv-card" style={{ padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingBottom: 14, borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-1)' }}>Rider Profile</div>
          {result && (
            <span className={`kv-badge ${fromLive ? 'kv-badge-success' : 'kv-badge-warning'}`}>
              {fromLive ? 'Live Model' : 'Demo SHAP'}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end', marginBottom: 20 }}>
          <FormField label="City">
            <select className="kv-select" value={inputs.city} onChange={e => set('city', e.target.value)}>
              <option value="delhi_ncr">Delhi NCR</option>
              <option value="mumbai">Mumbai</option>
              <option value="bengaluru">Bengaluru</option>
              <option value="hyderabad">Hyderabad</option>
              <option value="pune">Pune</option>
            </select>
          </FormField>
          <FormField label="Vehicle">
            <select className="kv-select" value={inputs.vehicle_type} onChange={e => set('vehicle_type', e.target.value)}>
              <option value="bicycle">Bicycle</option>
              <option value="ebike">E-Bike</option>
              <option value="motorcycle">Motorcycle</option>
            </select>
          </FormField>
          <FormField label="Tier">
            <select className="kv-select" value={inputs.coverage_tier} onChange={e => set('coverage_tier', e.target.value)}>
              <option value="basic">Basic</option>
              <option value="standard">Standard</option>
              <option value="premium">Premium</option>
            </select>
          </FormField>
          <FormField label="Month">
            <select className="kv-select" value={inputs.month} onChange={e => set('month', Number(e.target.value))}>
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  {new Date(2026, i, 1).toLocaleString('default', { month: 'short' })}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="AQI (12m)">
            <input className="kv-input" type="number" min={0} max={365} value={inputs.historical_aqi_events_12m}
              onChange={e => set('historical_aqi_events_12m', Number(e.target.value))} style={{ width: 80, fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }} />
          </FormField>
          <FormField label="Rain (12m)">
            <input className="kv-input" type="number" min={0} max={365} value={inputs.historical_rain_events_12m}
              onChange={e => set('historical_rain_events_12m', Number(e.target.value))} style={{ width: 80, fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }} />
          </FormField>
          <FormField label="Daily Trips">
            <input className="kv-input" type="number" min={1} max={60} value={inputs.declared_daily_trips}
              onChange={e => set('declared_daily_trips', Number(e.target.value))} style={{ width: 70, fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }} />
          </FormField>
          <FormField label="Daily ₹">
            <input className="kv-input" type="number" min={100} max={5000} value={inputs.avg_daily_earnings}
              onChange={e => set('avg_daily_earnings', Number(e.target.value))} style={{ width: 90, fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }} />
          </FormField>
          <button className="kv-btn kv-btn-primary" onClick={handleCalculate} disabled={loading} style={{ height: 34 }}>
            {loading ? 'Calculating...' : 'Calculate'}
          </button>
        </div>

        {result && waterfallData && (
          <>
            {/* Premium result */}
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, margin: '12px 0 8px', paddingTop: 16, borderTop: '1px solid var(--border-subtle)' }}>
              <span style={{ fontSize: 13, color: 'var(--text-3)', fontWeight: 600 }}>Recommended premium</span>
              <span style={{ fontSize: 36, fontWeight: 700, color: 'var(--accent)', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '-0.04em' }}>
                ₹{result.premium.toFixed(2)}
              </span>
              <span style={{ fontSize: 12, color: 'var(--text-3)' }}>/ week · {inputs.coverage_tier}</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 20, fontStyle: 'italic' }}>
              Positive values increase premium risk. Negative = discount.
            </div>

            {/* Chart */}
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={waterfallData} layout="vertical" margin={{ top: 4, right: 50, left: 10, bottom: 4 }} barSize={18}>
                <XAxis type="number" domain={['auto', 'auto']} tick={{ fill: 'var(--text-3)', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `₹${v}`} />
                <YAxis type="category" dataKey="name" width={180} tick={{ fill: 'var(--text-2)', fontSize: 11, fontWeight: 500 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine x={0} stroke="var(--border-color)" strokeWidth={1} />
                <Bar dataKey="contribution" radius={[0, 3, 3, 0]}>
                  {waterfallData.map((entry, index) => (
                    <Cell
                      key={index}
                      fill={entry.isTotal ? '#d97706' : entry.positive ? '#059669' : '#dc2626'}
                      fillOpacity={entry.isTotal ? 1.0 : 0.85}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>

            {/* Legend */}
            <div style={{ display: 'flex', gap: 20, fontSize: 11, color: 'var(--text-3)', borderTop: '1px solid var(--border-subtle)', paddingTop: 14, marginTop: 8, fontWeight: 500 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: '#059669', display: 'inline-block' }} />Risk-increasing
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: '#dc2626', display: 'inline-block' }} />Discount
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: '#d97706', display: 'inline-block' }} />Total
              </span>
            </div>
          </>
        )}

        {!result && (
          <div className="kv-card-flat" style={{ padding: 40, textAlign: 'center', marginTop: 8 }}>
            <div style={{ fontSize: 13, color: 'var(--text-3)' }}>
              Configure rider profile and click Calculate to see the SHAP breakdown
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
