import { useEffect, useState } from 'react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid } from 'recharts'
import {
  Ban,
  CircleDollarSign,
  FileSearch,
  HandCoins,
  ShieldCheck,
  Wallet,
} from 'lucide-react'
import type { PaymentSummary, TriggerStatus } from '../lib/types'
import { formatDistanceToNow } from 'date-fns'
import ChartCard from './ui/ChartCard'
import Badge from './ui/Badge'
import GlassCard from './ui/GlassCard'

const TREND_DATA = [
  { day: 'Mar 28', premiums: 184000, payouts: 118000 },
  { day: 'Mar 29', premiums: 197000, payouts: 134000 },
  { day: 'Mar 30', premiums: 212000, payouts: 142000 },
  { day: 'Mar 31', premiums: 223000, payouts: 148000 },
  { day: 'Apr 01', premiums: 238000, payouts: 155000 },
  { day: 'Apr 02', premiums: 255000, payouts: 164000 },
  { day: 'Apr 03', premiums: 278000, payouts: 178000 },
  { day: 'Apr 04', premiums: 289000, payouts: 191000 },
  { day: 'Apr 05', premiums: 305000, payouts: 202000 },
  { day: 'Apr 06', premiums: 319000, payouts: 207000 },
]

function fmt(n: number) {
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`
  if (n >= 1000) return `₹${(n / 1000).toFixed(0)}K`
  return `₹${n}`
}

function pctChange(current: number, previous: number) {
  if (previous === 0) return 0
  return ((current - previous) / previous) * 100
}

function HealthBar({ value, label }: { value: number; label: string }) {
  const clamped = Math.max(0, Math.min(1, value))
  const color = clamped >= 0.75 ? 'var(--accent)' : '#52525B'
  const pct = Math.round(clamped * 100)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
        <span style={{ color: 'var(--text-2)' }}>{label}</span>
        <span className="mono" style={{ color, fontWeight: 600 }}>{pct}%</span>
      </div>
      <div style={{ height: 7, background: 'rgba(255,255,255,0.06)', borderRadius: 999, overflow: 'hidden' }}>
        <div
          style={{
            height: '100%',
            width: `${pct}%`,
            background: color,
            borderRadius: 999,
            transition: 'width 260ms ease',
          }}
        />
      </div>
    </div>
  )
}

function HeroStat({ label, value, delta }: { label: string; value: string; delta?: string }) {
  return (
    <div className="hero-stat">
      <div className="hero-stat-label">{label}</div>
      <div className="hero-stat-value">{value}</div>
      {delta ? <div className="hero-stat-delta">{delta}</div> : null}
    </div>
  )
}

function InlineMetric({ label, value, delta }: { label: string; value: string; delta?: string }) {
  return (
    <div className="inline-metric">
      <div className="inline-metric-label">{label}</div>
      <div className="inline-metric-value">{value}</div>
      {delta ? <div className="inline-metric-delta">{delta}</div> : null}
    </div>
  )
}

function InsightRow({ label, value, tone = 'neutral' }: { label: string; value: string; tone?: 'neutral' | 'positive' | 'warning' | 'critical' }) {
  return (
    <div className={`insight-row ${tone}`.trim()}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

export default function LiveMetrics({
  summary, triggerStatus, live,
}: { summary: PaymentSummary | null; triggerStatus: TriggerStatus | null; live: boolean }) {
  const [ts, setTs] = useState<TriggerStatus | null>(triggerStatus)
  useEffect(() => { if (triggerStatus) setTs(triggerStatus) }, [triggerStatus])

  const s = summary ?? {
    total_premiums: 1287400, total_payouts: 836810, loss_ratio: 0.65,
    active_policies: 183, claims_pending: 2, fraud_blocks_24h: 17,
    auto_approved_24h: 94, soft_holds_24h: 5,
  }

  const pctSaved = s.fraud_blocks_24h > 0 ? Math.round((s.fraud_blocks_24h / (s.fraud_blocks_24h + s.auto_approved_24h)) * 100) : 0
  const firstTrend = TREND_DATA[0]
  const lastTrend = TREND_DATA[TREND_DATA.length - 1]
  const premiumTrend = pctChange(lastTrend.premiums, firstTrend.premiums)
  const payoutTrend = pctChange(lastTrend.payouts, firstTrend.payouts)
  const lossDelta = ((s.loss_ratio - 0.7) * 100).toFixed(1)

  return (
    <>
      {!live && (
        <div className="demo-banner">
          ⚡ Demo mode — showing realistic mock data. Start the Docker stack to stream live metrics.
        </div>
      )}

      <GlassCard className="hero-shell">
        <div className="hero-copy">
          <div className="hero-kicker">Live Metrics</div>
          <h1 className="hero-title">Live Metrics</h1>
          <p className="hero-subtitle">
            Real-time portfolio health, claim velocity, and fraud prevention performance across the active parametric stack.
          </p>
        </div>
        <div className="hero-stats">
          <HeroStat label="Premiums" value={fmt(s.total_premiums)} delta={`${premiumTrend >= 0 ? '+' : ''}${premiumTrend.toFixed(1)}%`} />
          <HeroStat label="Payouts" value={fmt(s.total_payouts)} delta={`${payoutTrend >= 0 ? '+' : ''}${payoutTrend.toFixed(1)}%`} />
          <HeroStat label="Loss Ratio" value={`${(s.loss_ratio * 100).toFixed(1)}%`} delta={s.loss_ratio < 0.7 ? 'Below target' : 'Above target'} />
        </div>
      </GlassCard>

      <div className="metric-strip">
        <InlineMetric label="Total Premiums" value={fmt(s.total_premiums)} delta={`${premiumTrend >= 0 ? '+' : ''}${premiumTrend.toFixed(1)}%`} />
        <InlineMetric label="Total Payouts" value={fmt(s.total_payouts)} delta={`${payoutTrend >= 0 ? '+' : ''}${payoutTrend.toFixed(1)}%`} />
        <InlineMetric label="Loss Ratio" value={`${(s.loss_ratio * 100).toFixed(1)}%`} delta={`${lossDelta}% from target`} />
        <InlineMetric label="Active Policies" value={s.active_policies.toString()} delta="+3.8% this month" />
        <InlineMetric label="Fraud Blocks" value={s.fraud_blocks_24h.toString()} delta={`${pctSaved}% blocked`} />
      </div>

      <div className="live-metrics-layout">
        <div className="live-metrics-main">
          <ChartCard title="Premium vs Payout Trend" subtitle="Financial throughput and claims disbursement velocity">
            <ResponsiveContainer width="100%" height={360}>
            <AreaChart data={TREND_DATA} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
              <CartesianGrid stroke="rgba(255,255,255,0.08)" strokeDasharray="3 5" vertical={false} />
              <XAxis dataKey="day" tick={{ fill: '#9CA3AF', fontSize: 11 }} axisLine={false} tickLine={false} dy={10} />
              <YAxis tickFormatter={v => fmt(v)} tick={{ fill: '#9CA3AF', fontSize: 11 }} axisLine={false} tickLine={false} width={56} />
              <Tooltip
                contentStyle={{
                  background: 'rgba(15,23,42,0.9)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  backdropFilter: 'blur(18px)',
                  borderRadius: 16,
                  fontSize: 12,
                }}
                labelStyle={{ color: '#9CA3AF' }}
                formatter={(v: number) => [fmt(v), '']}
              />
              <Area type="monotone" dataKey="premiums" stroke="#7C7CFF" strokeWidth={2.5} fill="rgba(124,124,255,0.12)" name="Premiums" />
              <Area type="monotone" dataKey="payouts" stroke="#52525B" strokeWidth={2.5} fill="rgba(82,82,91,0.12)" name="Payouts" />
              <Legend wrapperStyle={{ fontSize: 12, color: '#9CA3AF', paddingTop: 12 }} iconType="circle" />
            </AreaChart>
          </ResponsiveContainer>
          </ChartCard>
        </div>

        <div className="live-metrics-side">
          <GlassCard className="side-panel">
            <div className="panel-title">Portfolio Health</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <HealthBar value={s.loss_ratio} label="Loss ratio" />
              <HealthBar value={s.fraud_blocks_24h / (s.fraud_blocks_24h + s.auto_approved_24h + 0.01)} label="Fraud rate" />
            </div>
            <div className="panel-foot">Operating margin {fmt(s.total_premiums - s.total_payouts)}</div>
          </GlassCard>

          <GlassCard className="side-panel">
            <div className="panel-title">Small Insights</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <InsightRow label="Claims pending" value={s.claims_pending.toString()} tone="warning" />
              <InsightRow label="Approved (24h)" value={s.auto_approved_24h.toString()} tone="positive" />
              <InsightRow label="Soft holds" value={s.soft_holds_24h.toString()} tone="neutral" />
              <InsightRow label="Fraud blocks" value={s.fraud_blocks_24h.toString()} tone="critical" />
            </div>
          </GlassCard>
        </div>
      </div>

      {ts?.active_triggers?.length ? (
        <GlassCard className="table-shell">
          <div className="table-header">
            <div>
              <div className="panel-title">Active Triggers Now</div>
              <div className="panel-subtitle">Live event feed with parametric thresholds and escalation timing</div>
            </div>
            <Badge variant="warn">LIVE</Badge>
          </div>
          <table className="data-table">
            <thead><tr><th>Zone</th><th>Event</th><th>Metric</th><th>Tier</th><th>Age</th></tr></thead>
            <tbody>
              {ts.active_triggers.map((t, i) => (
                <tr key={i}>
                  <td><span className="mono" style={{ color: 'var(--accent)' }}>{t.zone}</span></td>
                  <td><Badge variant="info">{t.event_type.toUpperCase()}</Badge></td>
                  <td><span className="mono">{t.metric_value}</span></td>
                  <td>
                    <Badge variant="info">T{t.tier}</Badge>
                  </td>
                  <td style={{ color: 'var(--text-2)', fontSize: 12 }}>
                    {formatDistanceToNow(new Date(t.triggered_at), { addSuffix: true })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </GlassCard>
      ) : null}
    </>
  )
}
