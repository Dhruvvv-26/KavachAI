import React, { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchClaims, approveClaim, blockClaim } from '../lib/api'
import type { Claim } from '../lib/types'

function FraudScoreBadge({ score }: { score: number }) {
  const color = score > 0.85 ? 'var(--danger)' :
    score > 0.65 ? '#ea580c' :
    score > 0.30 ? 'var(--warning)' :
    'var(--success)'
  const bg = score > 0.85 ? 'var(--danger-muted)' :
    score > 0.65 ? 'rgba(234, 88, 12, 0.1)' :
    score > 0.30 ? 'var(--warning-muted)' :
    'var(--success-muted)'
  return (
    <span style={{
      fontFamily: "'JetBrains Mono', monospace",
      fontSize: 11, fontWeight: 700,
      color, background: bg,
      padding: '2px 8px', borderRadius: 4,
    }}>
      {score.toFixed(2)}
    </span>
  )
}

function StatusDot({ status }: { status: string }) {
  const upperStatus = status.toUpperCase()
  const color = upperStatus === 'SOFT_HOLD' ? 'var(--warning)' :
    upperStatus.includes('BLOCK') || upperStatus.includes('REJECT') ? 'var(--danger)' :
    upperStatus.includes('REVIEW') || upperStatus.includes('PENDING') ? '#ea580c' :
    'var(--success)'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, display: 'inline-block' }} />
      <span style={{ fontSize: 11, fontWeight: 600, color, textTransform: 'uppercase' as const, letterSpacing: '0.04em' }}>
        {status.replace(/_/g, ' ')}
      </span>
    </div>
  )
}

export default function FraudQueue({ live }: { live?: boolean }) {
  const [claims, setClaims] = useState<Claim[]>([])
  const [isLive, setIsLive] = useState(live || false)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  // Fetch claims from admin/queue endpoint or fallback to claims list filtered by status
  const loadQueue = useCallback(async () => {
    try {
      const { data, live: fromLive } = await fetchClaims()
      // Filter for soft_hold / review / pending_review claims (most suspicious first)
      const queueClaims = data
        .filter(c => ['SOFT_HOLD', 'REVIEW', 'PENDING_REVIEW', 'PENDING', 'BLOCKED'].includes(c.status))
        .sort((a, b) => (b.fraud_score || 0) - (a.fraud_score || 0))

      // If no queue items, show all claims sorted by fraud score
      setClaims(queueClaims.length > 0 ? queueClaims : data.sort((a, b) => (b.fraud_score || 0) - (a.fraud_score || 0)))
      setIsLive(fromLive)
    } catch (e) {
      console.error('Queue fetch error:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadQueue()
    // Auto-refresh every 15 seconds
    const interval = setInterval(loadQueue, 15000)
    return () => clearInterval(interval)
  }, [loadQueue])

  const handleApprove = async (claimId: string) => {
    await approveClaim(claimId)
    setClaims(prev => prev.map(c => c.claim_id === claimId ? { ...c, status: 'AUTO_APPROVED' as any } : c))
  }

  const handleReject = async (claimId: string) => {
    await blockClaim(claimId)
    setClaims(prev => prev.map(c => c.claim_id === claimId ? { ...c, status: 'BLOCKED' as any } : c))
  }

  const pendingCount = claims.filter(c =>
    ['SOFT_HOLD', 'REVIEW', 'PENDING_REVIEW', 'PENDING'].includes(c.status)
  ).length

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
        <div className="shimmer" style={{ width: 200, height: 20, borderRadius: 4 }} />
      </div>
    )
  }

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="kv-page-title">Fraud Queue</h1>
          <p className="kv-page-subtitle">
            {pendingCount} claims pending review — sorted by fraud_score DESC
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className={`kv-badge ${pendingCount > 0 ? 'kv-badge-warning' : 'kv-badge-success'}`}>
            {pendingCount} pending
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 4, border: '1px solid var(--border-color)', background: 'var(--surface-0)' }}>
            <span className="pulse-dot" style={{
              width: 5, height: 5, borderRadius: '50%',
              background: isLive ? 'var(--success)' : 'var(--warning)', display: 'inline-block',
            }} />
            <span style={{ fontSize: 11, fontWeight: 600, color: isLive ? 'var(--success)' : 'var(--warning)' }}>
              {isLive ? 'ML Engine Online' : 'Demo Mode'}
            </span>
          </div>
        </div>
      </div>

      {/* Claims Table */}
      <div className="kv-card" style={{ overflow: 'hidden' }}>
        <table className="kv-table">
          <thead>
            <tr>
              <th>Worker ID</th>
              <th>Rider</th>
              <th>Zone</th>
              <th>Event</th>
              <th>Fraud Score</th>
              <th>Flags</th>
              <th>Payout</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {claims.map(claim => (
              <tr key={claim.claim_id}>
                <td>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: 'var(--text-2)', fontWeight: 500 }}>
                    {claim.worker_id?.substring(0, 8)}...
                  </span>
                </td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: 6,
                      background: (claim.fraud_score || 0) > 0.65 ? 'var(--danger-muted)' : 'var(--surface-2)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 11, fontWeight: 700,
                      color: (claim.fraud_score || 0) > 0.65 ? 'var(--danger)' : 'var(--text-2)',
                      flexShrink: 0,
                    }}>
                      {(claim.rider_name || 'U').charAt(0)}
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>
                      {claim.rider_name || 'Unknown'}
                    </span>
                  </div>
                </td>
                <td>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: 'var(--accent)', fontWeight: 600 }}>
                    {claim.zone}
                  </span>
                </td>
                <td>
                  <span style={{ fontSize: 12, color: 'var(--text-2)', fontWeight: 500 }}>
                    {claim.event_type?.toUpperCase() || '—'}
                  </span>
                </td>
                <td>
                  <FraudScoreBadge score={claim.fraud_score || 0} />
                </td>
                <td>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, maxWidth: 200 }}>
                    {(claim.fraud_flags || []).slice(0, 3).map((flag, i) => (
                      <span key={i} className="kv-badge kv-badge-neutral" style={{ fontSize: 8, padding: '1px 5px' }}>
                        {flag}
                      </span>
                    ))}
                    {(claim.fraud_flags || []).length > 3 && (
                      <span style={{ fontSize: 9, color: 'var(--text-3)' }}>+{claim.fraud_flags.length - 3}</span>
                    )}
                  </div>
                </td>
                <td>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 600, color: 'var(--text-1)' }}>
                    ₹{claim.payout_amount}
                  </span>
                </td>
                <td>
                  <StatusDot status={claim.status} />
                </td>
                <td style={{ textAlign: 'right' }}>
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                    <button
                      className="kv-btn kv-btn-ghost"
                      style={{ fontSize: 11, padding: '5px 10px' }}
                      onClick={() => navigate('/dual-selfie')}
                    >
                      View Selfie
                    </button>
                    <button
                      className="kv-btn kv-btn-success"
                      style={{ fontSize: 11, padding: '5px 10px' }}
                      onClick={() => handleApprove(claim.claim_id)}
                    >
                      Approve
                    </button>
                    <button
                      className="kv-btn kv-btn-danger"
                      style={{ fontSize: 11, padding: '5px 10px' }}
                      onClick={() => handleReject(claim.claim_id)}
                    >
                      Reject
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
