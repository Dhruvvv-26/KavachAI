import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts'
import { fetchPaymentSummary } from '../lib/api'
import type { PaymentSummary } from '../lib/types'

// Generate 7-day trailing premium/payout data for BCR trend visualization
function generateBCRTrend(summary: PaymentSummary) {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const today = new Date().getDay()
  const dailyPremium = summary.trailing_30d_premiums / 30
  const dailyPayout = summary.trailing_30d_payouts / 30

  return days.map((day, i) => {
    const variance = 0.7 + Math.random() * 0.6
    const payoutVariance = 0.5 + Math.random() * 1.0
    return {
      day,
      premiums: Math.round(dailyPremium * variance),
      payouts: Math.round(dailyPayout * payoutVariance),
      bcr: Math.round((dailyPayout * payoutVariance) / (dailyPremium * variance) * 100),
    }
  })
}

const BCRTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: 'var(--surface-0)', border: '1px solid var(--border-color)',
      borderRadius: 6, padding: '8px 12px', fontSize: 12, boxShadow: 'var(--shadow-md)',
    }}>
      <div style={{ color: 'var(--text-3)', marginBottom: 4, fontWeight: 500 }}>{label}</div>
      {payload.map((p: any) => (
        <div key={p.name} style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: p.color, fontWeight: 600 }}>
          {p.name}: ₹{p.value.toLocaleString('en-IN')}
        </div>
      ))}
    </div>
  )
}

const BCR_COLORS = {
  SOLVENT:  { bg: 'var(--success-muted)', border: 'var(--success)', text: 'var(--success)', label: 'SOLVENT' },
  WATCH:    { bg: 'var(--warning-muted)', border: 'var(--warning)', text: 'var(--warning)', label: 'WATCH' },
  CRITICAL: { bg: 'var(--danger-muted)',  border: 'var(--danger)',  text: 'var(--danger)',  label: 'CRITICAL' },
} as const

function StatBlock({ title, value, subtitle, color, icon }: {
  title: string; value: string; subtitle: string; color: string; icon: string
}) {
  return (
    <div className="kv-card" style={{ padding: 20, flex: '1 1 200px', minWidth: 200, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 10, right: 14, fontSize: 24, opacity: 0.08 }}>{icon}</div>
      <div className="kv-stat-label">{title}</div>
      <div className="kv-stat-value" style={{ color, fontSize: 24 }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 6, fontWeight: 400 }}>{subtitle}</div>
    </div>
  )
}

function BCRGauge({ bcr, status }: { bcr: number; status: string }) {
  const colors = BCR_COLORS[status as keyof typeof BCR_COLORS] || BCR_COLORS.SOLVENT
  const angle = Math.min(bcr / 100 * 180, 180)

  return (
    <div className="kv-card" style={{
      padding: 28,
      flex: '1 1 300px', minWidth: 300,
      textAlign: 'center',
      borderColor: colors.border,
    }}>
      <div className="kv-stat-label" style={{ textAlign: 'center', marginBottom: 12 }}>
        Burning Cost Rate (30-Day)
      </div>

      <svg viewBox="0 0 200 115" width="180" height="103" style={{ margin: '0 auto', display: 'block' }}>
        {/* Background arc */}
        <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="var(--surface-3)" strokeWidth="12" strokeLinecap="round" />
        {/* Value arc */}
        <path
          d={`M 20 100 A 80 80 0 0 1 ${100 + 80 * Math.cos(Math.PI - (angle * Math.PI / 180))} ${100 - 80 * Math.sin((angle * Math.PI / 180))}`}
          fill="none" stroke={colors.border} strokeWidth="12" strokeLinecap="round"
          style={{ transition: 'all 0.8s ease-out' }}
        />
        <text x="100" y="92" textAnchor="middle" fill={colors.text} fontSize="26" fontWeight="700" fontFamily="'JetBrains Mono', monospace">
          {bcr.toFixed(1)}%
        </text>
        <text x="25" y="112" fontSize="10" fill="var(--text-3)" fontWeight="500">0%</text>
        <text x="175" y="112" fontSize="10" fill="var(--text-3)" fontWeight="500">100%</text>
      </svg>

      <div style={{ marginTop: 12 }}>
        <span className={`kv-badge ${status === 'CRITICAL' ? 'kv-badge-danger' : status === 'WATCH' ? 'kv-badge-warning' : 'kv-badge-success'}`}>
          {colors.label}
        </span>
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 10, fontWeight: 400, lineHeight: 1.5 }}>
        {bcr < 70 ? 'Portfolio is actuarially solvent' : bcr <= 85 ? 'Monitor — approaching breakeven' : 'Unsustainable — adjust premiums'}
      </div>
    </div>
  )
}

export default function ActuarialDashboard({ live }: { live: boolean }) {
  const [summary, setSummary] = useState<PaymentSummary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const s = await fetchPaymentSummary()
      setSummary(s.data)
      setLoading(false)
    }
    load()
    const interval = setInterval(load, 30000)
    return () => clearInterval(interval)
  }, [])

  if (loading || !summary) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <div className="shimmer" style={{ width: 200, height: 20, borderRadius: 4 }} />
      </div>
    )
  }

  const netPosition = summary.trailing_30d_premiums - summary.trailing_30d_payouts
  const netColor = netPosition >= 0 ? 'var(--success)' : 'var(--danger)'

  return (
    <div className="fade-in" style={{ maxWidth: 1050, display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <h1 className="kv-page-title">Actuarial Dashboard</h1>
        <span className={`kv-badge ${live ? 'kv-badge-success' : 'kv-badge-warning'}`}>
          {live ? 'Live' : 'Demo'}
        </span>
      </div>

      {/* BCR + Stats */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <BCRGauge bcr={summary.burning_cost_rate} status={summary.bcr_status} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: '1 1 420px' }}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <StatBlock
              title="Loss Ratio (7d)"
              value={`${(summary.loss_ratio * 100).toFixed(1)}%`}
              subtitle="Target: ≤65%"
              color={summary.loss_ratio <= 0.65 ? 'var(--success)' : 'var(--danger)'}
              icon="📊"
            />
            <StatBlock
              title="Reserve Ratio"
              value={`${summary.reserve_ratio.toFixed(1)}%`}
              subtitle="Premium surplus"
              color={summary.reserve_ratio > 30 ? 'var(--success)' : 'var(--warning)'}
              icon="🛡"
            />
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <StatBlock
              title="30-Day Net"
              value={`₹${Math.abs(netPosition).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
              subtitle={netPosition >= 0 ? 'Surplus' : 'Deficit'}
              color={netColor}
              icon={netPosition >= 0 ? '↑' : '↓'}
            />
            <StatBlock
              title="Active Policies"
              value={summary.active_policies.toString()}
              subtitle="Currently covered riders"
              color="var(--text-1)"
              icon="≡"
            />
          </div>
        </div>
      </div>

      {/* Financial Summary Table */}
      <div className="kv-card" style={{ overflow: 'hidden' }}>
        <div style={{
          padding: '14px 20px',
          borderBottom: '1px solid var(--border-color)',
        }}>
          <span className="kv-section-label" style={{ marginBottom: 0 }}>Trailing 30-Day Financials</span>
        </div>
        <table className="kv-table">
          <tbody>
            {[
              ['Premiums Collected (30d)', `₹${summary.trailing_30d_premiums.toLocaleString('en-IN')}`, 'var(--success)'],
              ['Payouts Disbursed (30d)', `₹${summary.trailing_30d_payouts.toLocaleString('en-IN')}`, 'var(--danger)'],
              ['Net Position', `₹${Math.abs(netPosition).toLocaleString('en-IN')}`, netColor],
              ['Burning Cost Rate', `${summary.burning_cost_rate.toFixed(1)}%`, BCR_COLORS[summary.bcr_status as keyof typeof BCR_COLORS]?.text || 'var(--success)'],
              ['Claims This Week', summary.claims_pending.toString(), 'var(--text-1)'],
              ['Avg Payout', `₹${(summary.total_payouts / Math.max(summary.claims_pending, 1)).toFixed(0)}`, 'var(--text-1)'],
            ].map(([label, value, color], i) => (
              <tr key={i}>
                <td style={{ fontSize: 13, color: 'var(--text-2)', fontWeight: 500 }}>{label}</td>
                <td style={{
                  textAlign: 'right', fontSize: 14, fontWeight: 700,
                  fontFamily: "'JetBrains Mono', monospace",
                  color: color as string,
                }}>
                  {value}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 7-Day Premium Trends — premium_trends BarChart */}
      <div className="kv-card" style={{ padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div className="kv-section-label" style={{ marginBottom: 0 }}>7-Day Premium vs Payouts</div>
          <span className={`kv-badge ${live ? 'kv-badge-success' : 'kv-badge-warning'}`}>
            {live ? 'Live' : 'Demo'}
          </span>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={generateBCRTrend(summary)} margin={{ top: 4, right: 10, left: 10, bottom: 4 }} barGap={2}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
            <XAxis dataKey="day" tick={{ fill: 'var(--text-3)', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: 'var(--text-3)', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
            <Tooltip content={<BCRTooltip />} />
            <Legend wrapperStyle={{ fontSize: 11, color: 'var(--text-3)' }} />
            <Bar dataKey="premiums" name="Premiums" fill="#059669" radius={[3, 3, 0, 0]} />
            <Bar dataKey="payouts" name="Payouts" fill="#dc2626" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* BCR Critical Banner */}
      {summary.bcr_status === 'CRITICAL' && (
        <div className="kv-card-flat" style={{
          padding: '12px 18px',
          background: 'var(--danger-muted)',
          border: '1px solid var(--danger)',
          borderRadius: 6,
          color: 'var(--danger)',
          fontSize: 13,
          display: 'flex', alignItems: 'center', gap: 10,
          fontWeight: 500,
        }}>
          <span style={{ fontWeight: 700 }}>⚠</span>
          BCR is above 85% — the portfolio is operating at an <strong>actuarial deficit</strong>.
          Consider raising premiums or tightening fraud filters.
        </div>
      )}
    </div>
  )
}
