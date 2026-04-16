import { useEffect, useState } from 'react'
import { Activity, ChartNoAxesCombined, NotebookText, Shield, WalletCards } from 'lucide-react'
import { fetchPaymentSummary } from '../lib/api'
import type { PaymentSummary } from '../lib/types'
import StatCard from './ui/StatCard'
import Badge from './ui/Badge'
import ChartCard from './ui/ChartCard'

const BCR_COLORS = {
  SOLVENT: { bg: 'rgba(124, 124, 255, 0.08)', border: '#7C7CFF', text: '#7C7CFF', label: 'SOLVENT' },
  WATCH:   { bg: 'rgba(82, 82, 91, 0.14)', border: '#52525B', text: '#A1A1AA', label: 'WATCH' },
  CRITICAL:{ bg: 'rgba(82, 82, 91, 0.14)', border: '#52525B', text: '#A1A1AA', label: 'CRITICAL' },
} as const

function BCRGauge({ bcr, status }: { bcr: number; status: string }) {
  const colors = BCR_COLORS[status as keyof typeof BCR_COLORS] || BCR_COLORS.SOLVENT
  const pct = Math.max(0, Math.min(bcr, 100))

  return (
    <div className="card" style={{ padding: 22, minWidth: 300, borderColor: colors.border, background: colors.bg }}>
      <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 12 }}>
        Burning Cost Rate (30-Day)
      </div>

      <div style={{ fontSize: 35, fontWeight: 700, color: colors.text, fontFamily: 'var(--font-mono)' }}>
        {bcr.toFixed(1)}%
      </div>

      <div style={{ marginTop: 12, height: 8, borderRadius: 999, overflow: 'hidden', background: 'rgba(15,23,42,0.85)' }}>
        <div
          style={{
            width: `${pct}%`,
            height: '100%',
            borderRadius: 999,
            background: colors.text,
            transition: 'width 300ms ease',
          }}
        />
      </div>

      <div style={{
        display: 'inline-block',
        marginTop: 14,
        padding: '4px 14px',
        borderRadius: 20,
        background: colors.bg,
        border: `1px solid ${colors.border}`,
        color: colors.text,
        fontSize: 12,
        fontWeight: 600,
        letterSpacing: 0.5,
      }}>
        {colors.label}
      </div>

      <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 8 }}>
        {bcr < 70 ? 'Portfolio is actuarially solvent' : bcr <= 85 ? 'Monitor — approaching breakeven' : 'Unsustainable — adjust premiums or tighten fraud filters'}
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
      <div className="loading-wrap" style={{ minHeight: '60vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 8, animation: 'pulse-dot 1s ease-in-out infinite' }}>◈</div>
          Loading actuarial data...
        </div>
      </div>
    )
  }

  const netPosition = summary.trailing_30d_premiums - summary.trailing_30d_payouts
  const netColor = netPosition >= 0 ? 'blue' : 'neutral'

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <h1 className="page-title" style={{ fontSize: 30 }}>Actuarial Dashboard</h1>
        <Badge variant="info">{live ? 'LIVE' : 'DEMO'}</Badge>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '320px minmax(0, 1fr)', gap: 16, alignItems: 'start', marginBottom: 20 }}>
        <BCRGauge bcr={summary.burning_cost_rate} status={summary.bcr_status} />
        <div className="metrics-grid" style={{ gridTemplateColumns: 'repeat(2,minmax(0,1fr))' }}>
          <StatCard icon={<ChartNoAxesCombined size={16} />} label="Loss Ratio (7d)" value={`${(summary.loss_ratio * 100).toFixed(1)}%`} hint="Target: ≤65%" tone="blue" />
          <StatCard icon={<Shield size={16} />} label="Reserve Ratio" value={`${summary.reserve_ratio.toFixed(1)}%`} hint="Premium surplus buffer" tone="neutral" />
          <StatCard icon={<WalletCards size={16} />} label="30-Day Net" value={`₹${Math.abs(netPosition).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`} hint={netPosition >= 0 ? 'Surplus' : 'Deficit'} tone={netColor} />
          <StatCard icon={<NotebookText size={16} />} label="Active Policies" value={summary.active_policies.toString()} hint="Currently covered riders" tone="neutral" />
        </div>
      </div>

      <ChartCard title="Trailing 30-Day Financials" subtitle="Operational solvency and burn profile">
        <table className="data-table">
          <tbody>
            {[
              ['Premiums Collected (30d)', `₹${summary.trailing_30d_premiums.toLocaleString('en-IN')}`, 'var(--accent)'],
              ['Payouts Disbursed (30d)', `₹${summary.trailing_30d_payouts.toLocaleString('en-IN')}`, '#52525B'],
              ['Net Position', `₹${Math.abs(netPosition).toLocaleString('en-IN')}`, netColor],
              ['Burning Cost Rate', `${summary.burning_cost_rate.toFixed(1)}%`, BCR_COLORS[summary.bcr_status as keyof typeof BCR_COLORS]?.text || 'var(--accent)'],
              ['Claims This Week', summary.claims_pending.toString(), 'var(--text-1)'],
              ['Avg Payout', `₹${(summary.total_payouts / Math.max(summary.claims_pending, 1)).toFixed(0)}`, 'var(--text-1)'],
            ].map(([label, value, color], i) => (
              <tr key={i}>
                <td style={{ color: 'var(--text-2)' }}>{label}</td>
                <td style={{ fontSize: 14, fontWeight: 600, textAlign: 'right', fontFamily: 'var(--font-mono)', color: color as string }}>
                  {value}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ChartCard>

      {summary.bcr_status === 'CRITICAL' && (
        <div style={{
          marginTop: 16,
          padding: '12px 20px',
          background: 'rgba(82, 82, 91, 0.14)',
          border: '1px solid #52525B',
          borderRadius: 10,
          color: '#A1A1AA',
          fontSize: 13,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}>
          <Activity size={18} />
          <span>
            BCR is above 85% — the portfolio is operating at an <strong>actuarial deficit</strong>.
            Consider raising premiums, tightening fraud filters, or adjusting zone risk multipliers.
          </span>
        </div>
      )}
    </div>
  )
}
