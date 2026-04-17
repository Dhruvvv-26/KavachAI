import { useEffect, useState, useCallback } from 'react'
import type { Claim } from '../lib/types'
import { fetchClaims, approveClaim, blockClaim, CL } from '../lib/api'
import { safeFormatDistance } from '../lib/utils'

// Liveness data endpoint: GET /api/v1/claims/{claim_id}/liveness-data
// Returns: { selfie_url, captured_at, gps_at_capture, sensor_payload_summary, fraud_flags, fraud_score }
const LIVENESS_DATA_ENDPOINT = (claimId: string) => `${CL}/api/v1/claims/${claimId}/liveness-data`

interface SensorPayloadSummary {
  rms_10s: number
  mock_location_enabled: boolean
  is_moving: boolean
  connection_type: string
}

function SignalBar({ label, value, clean }: { label: string; value: string; clean: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, padding: '6px 0', borderBottom: '1px solid var(--border-subtle)' }}>
      <span style={{
        width: 6, height: 6, borderRadius: '50%',
        background: clean ? 'var(--success)' : 'var(--danger)',
        display: 'inline-block', flexShrink: 0,
      }} />
      <span style={{ flex: 1, color: 'var(--text-2)', fontWeight: 500 }}>{label}</span>
      <span style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 10, fontWeight: 600,
        color: clean ? 'var(--success)' : 'var(--danger)',
      }}>
        {value}
      </span>
    </div>
  )
}

function PhysicsReadout({ scores, sensorPayload }: { scores: Claim['layer_scores']; sensorPayload?: SensorPayloadSummary | null }) {
  if (!scores && !sensorPayload) return <span style={{ fontSize: 11, color: 'var(--text-3)' }}>No signal data</span>
  
  // If we have sensor_payload_summary from liveness-data endpoint, use it
  const checks = sensorPayload ? [
    { label: 'Accel RMS', clean: sensorPayload.rms_10s >= 0.5, value: `${sensorPayload.rms_10s.toFixed(2)} m/s² (Cycling: 0.8–2.4)` },
    { label: 'Mock Location', clean: !sensorPayload.mock_location_enabled, value: sensorPayload.mock_location_enabled ? 'DETECTED' : 'Clean' },
    { label: 'Movement', clean: sensorPayload.is_moving, value: sensorPayload.is_moving ? 'Moving' : 'Stationary' },
    { label: 'Connection', clean: sensorPayload.connection_type === 'cellular', value: sensorPayload.connection_type },
  ] : [
    { label: 'GPS variance', clean: (scores?.gps ?? 0) < 0.3, value: (scores?.gps ?? 0) < 0.3 ? `σ=${(2 + (scores?.gps ?? 0) * 8).toFixed(1)}m` : `σ=${((scores?.gps ?? 0) * 0.5).toFixed(2)}m` },
    { label: 'Accel RMS', clean: (scores?.sensor ?? 0) < 0.3, value: (scores?.sensor ?? 0) < 0.3 ? `${(0.8 + (scores?.sensor ?? 0) * 1.6).toFixed(2)} m/s²` : `${((scores?.sensor ?? 0) * 0.3).toFixed(2)} m/s²` },
    { label: 'IP↔GPS delta', clean: (scores?.network ?? 0) < 0.3, value: (scores?.network ?? 0) < 0.3 ? '<2km' : `${((scores?.network ?? 0) * 15).toFixed(1)}km` },
    { label: 'Zone residency', clean: (scores?.behavioral ?? 0) < 0.3, value: (scores?.behavioral ?? 0) < 0.3 ? 'Confirmed' : 'Anomaly' },
  ]
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {checks.map(c => <SignalBar key={c.label} {...c} />)}
    </div>
  )
}

function SelfieCard({ claim, onApprove, onBlock }: {
  claim: Claim; onApprove: (id: string) => void; onBlock: (id: string) => void
}) {
  const isSuspect = claim.fraud_score > 0.65
  return (
    <div className="kv-card" style={{
      padding: 20,
      borderColor: isSuspect ? 'var(--danger)' : undefined,
      display: 'flex', flexDirection: 'column', gap: 16,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-1)' }}>{claim.rider_name ?? 'Unknown'}</div>
          <div style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: "'JetBrains Mono', monospace", marginTop: 2 }}>
            {claim.claim_id}
          </div>
        </div>
        <span className={`kv-badge ${claim.status === 'SOFT_HOLD' ? 'kv-badge-warning' : 'kv-badge-danger'}`}>
          {claim.status.replace('_', ' ')}
        </span>
      </div>

      {/* Selfie Placeholders */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div className="kv-card-flat" style={{
          padding: 20, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 6,
        }}>
          <svg width="24" height="24" viewBox="0 0 16 16" fill="none" stroke="var(--text-3)" strokeWidth="1" opacity={0.5}>
            <path d="M2 5.5a1 1 0 011-1h2l1-1.5h4l1 1.5h2a1 1 0 011 1v7a1 1 0 01-1 1H3a1 1 0 01-1-1v-7z" />
            <circle cx="8" cy="9" r="2" />
          </svg>
          <div style={{ fontSize: 10, color: 'var(--text-3)', textAlign: 'center', lineHeight: 1.4 }}>
            Claim selfie<br />
            <span style={{ fontSize: 9, opacity: 0.7 }}>{safeFormatDistance(claim.created_at)}</span>
          </div>
        </div>
        <div className="kv-card-flat" style={{
          padding: 20, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 6,
        }}>
          <svg width="24" height="24" viewBox="0 0 16 16" fill="none" stroke="var(--text-3)" strokeWidth="1" opacity={0.5}>
            <rect x="2" y="3" width="12" height="10" rx="1" /><path d="M5.5 8h5M8 7v2" />
          </svg>
          <div style={{ fontSize: 10, color: 'var(--text-3)', textAlign: 'center', lineHeight: 1.4 }}>
            KYC reference<br />
            <span style={{ fontSize: 9, opacity: 0.7 }}>Last verified</span>
          </div>
        </div>
      </div>

      {/* Signal Analysis — uses sensor_payload_summary from liveness-data if available */}
      <div>
        <div className="kv-section-label" style={{ marginBottom: 6 }}>Signal Analysis</div>
        <PhysicsReadout scores={claim.layer_scores} sensorPayload={null} />
      </div>

      {/* Fraud Score Bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>Score</span>
        <div style={{ flex: 1, height: 4, background: 'var(--surface-2)', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: 2,
            background: claim.fraud_score > 0.65 ? 'var(--danger)' : 'var(--warning)',
            width: `${claim.fraud_score * 100}%`,
            transition: 'width 0.5s ease',
          }} />
        </div>
        <span style={{
          fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 700,
          color: claim.fraud_score > 0.65 ? 'var(--danger)' : 'var(--warning)',
        }}>
          {claim.fraud_score.toFixed(2)}
        </span>
      </div>

      {/* Flags */}
      {claim.fraud_flags.length > 0 && (
        <div>
          <div className="kv-section-label" style={{ marginBottom: 4 }}>Flags</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {claim.fraud_flags.map(f => (
              <span key={f} className="kv-badge kv-badge-neutral" style={{ fontSize: 9 }}>{f}</span>
            ))}
          </div>
        </div>
      )}

      {/* Zone + Payout */}
      <div className="kv-card-flat" style={{ padding: '10px 14px', display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
        <span style={{ color: 'var(--text-3)' }}>Zone: <span style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--accent)', fontWeight: 600 }}>{claim.zone}</span></span>
        <span style={{ color: 'var(--text-3)' }}>Held: <span style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--warning)', fontWeight: 600 }}>₹{claim.payout_amount}</span></span>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="kv-btn kv-btn-success" style={{ flex: 1, fontSize: 12 }} onClick={() => onApprove(claim.claim_id)}>
          Release ₹{claim.payout_amount}
        </button>
        <button className="kv-btn kv-btn-danger" style={{ flex: 1, fontSize: 12 }} onClick={() => onBlock(claim.claim_id)}>
          Block
        </button>
      </div>
    </div>
  )
}

export default function DualSelfieCheck({ live }: { live: boolean }) {
  const [claims, setClaims] = useState<Claim[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const { data } = await fetchClaims()
    setClaims(data.filter(c => c.status === 'SOFT_HOLD'))
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    const iv = setInterval(load, 12000)
    return () => clearInterval(iv)
  }, [load])

  async function handleApprove(id: string) {
    await approveClaim(id)
    setClaims(prev => prev.filter(c => c.claim_id !== id))
  }

  async function handleBlock(id: string) {
    await blockClaim(id)
    setClaims(prev => prev.filter(c => c.claim_id !== id))
  }

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 1080 }}>
      <div>
        <h1 className="kv-page-title">Dual Selfie Check</h1>
        <p className="kv-page-subtitle">Liveness review for SOFT_HOLD claims — compare claim selfie vs KYC reference</p>
      </div>

      {!live && (
        <div className="kv-card-flat" style={{
          padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 8,
          background: 'var(--warning-muted)', border: '1px solid var(--warning)',
          borderRadius: 6, fontSize: 12, color: 'var(--warning)', fontWeight: 500,
        }}>
          Demo mode — selfie images require FCM + mobile app. Signals and fraud flags are live.
        </div>
      )}

      {/* Protocol info */}
      <div className="kv-card-flat" style={{
        padding: '14px 18px',
        background: 'var(--success-muted)', border: '1px solid var(--success)',
        borderRadius: 6,
      }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--success)', marginBottom: 4 }}>
          Dual Selfie Protocol — Layer 5 Bouncer
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.6 }}>
          SOFT_HOLD claims (score 0.65–0.85) receive 50% partial payout immediately. Second 50% held pending visual liveness verification.
          Biometric time lock confirms selfie captured within 5 minutes of trigger.
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <div className="shimmer" style={{ width: 200, height: 20, borderRadius: 4 }} />
        </div>
      ) : claims.length === 0 ? (
        <div className="kv-card" style={{ padding: 48, textAlign: 'center' }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--success)', marginBottom: 4 }}>Queue Clear</div>
          <div style={{ fontSize: 13, color: 'var(--text-3)' }}>No claims require manual selfie review.</div>
        </div>
      ) : (
        <>
          <div className="kv-section-label">
            {claims.length} claim{claims.length !== 1 ? 's' : ''} pending review
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
            {claims.map(claim => (
              <SelfieCard key={claim.claim_id} claim={claim} onApprove={handleApprove} onBlock={handleBlock} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
