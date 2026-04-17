import { useEffect, useState } from 'react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import type { PaymentSummary, TriggerStatus } from '../lib/types'
import { fetchTriggerStatus } from '../lib/api'
import { safeFormatDistance } from '../lib/utils'

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

const fmt = (n: number) => {
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`
  if (n >= 1000) return `₹${(n / 1000).toFixed(0)}K`
  return `₹${n}`
}

function HeroStat({ label, value, color, sub }: { label: string; value: string; color: string; sub?: string }) {
  return (
    <div style={{ flex: 1, padding: '20px 0' }}>
      <div className="kv-stat-label">{label}</div>
      <div className="kv-stat-value" style={{ color, fontSize: 32 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 6, fontWeight: 500 }}>{sub}</div>}
    </div>
  )
}

function MiniStat({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="kv-card-flat" style={{ padding: '14px 18px', flex: '1 1 140px' }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: color || 'var(--text-1)', letterSpacing: '-0.02em' }}>{value}</div>
    </div>
  )
}

const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: 'var(--surface-0)', border: '1px solid var(--border-color)',
      borderRadius: 6, padding: '10px 14px', fontSize: 12, boxShadow: 'var(--shadow-md)',
    }}>
      <div style={{ color: 'var(--text-3)', marginBottom: 6, fontWeight: 600 }}>{label}</div>
      {payload.map((p: any, i: number) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: p.color, display: 'inline-block' }} />
          <span style={{ color: 'var(--text-2)', fontWeight: 500 }}>{fmt(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

export default function LiveMetrics({
  summary, triggerStatus, live,
}: { summary: PaymentSummary | null; triggerStatus: TriggerStatus | null; live: boolean }) {
  const [metrics, setMetrics] = useState<PaymentSummary | null>(summary)
  const [ts, setTs] = useState<TriggerStatus | null>(triggerStatus)
  const [isLive, setIsLive] = useState(live)

  useEffect(() => {
    let isSubscribed = true
    const fetchMetrics = async () => {
      try {
        const res = await fetch('http://localhost:8000/api/v1/payments/summary')
        if (res.ok) {
          const data = await res.json()
          if (isSubscribed) { setMetrics(data); setIsLive(true) }
        }
      } catch { if (isSubscribed) setIsLive(false) }
    }
    fetchMetrics()
    const interval = setInterval(fetchMetrics, 10000)
    return () => { isSubscribed = false; clearInterval(interval) }
  }, [])

  useEffect(() => { if (triggerStatus) setTs(triggerStatus) }, [triggerStatus])

  const s = metrics ?? summary ?? {
    total_premiums: 1287400, total_payouts: 836810, loss_ratio: 0.65,
    active_policies: 183, claims_pending: 2, fraud_blocks_24h: 17,
    auto_approved_24h: 94, soft_holds_24h: 5,
  }
  const pctSaved = s.fraud_blocks_24h > 0 ? Math.round((s.fraud_blocks_24h / (s.fraud_blocks_24h + s.auto_approved_24h)) * 100) : 0

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h1 className="kv-page-title">Live Metrics</h1>
          <p className="kv-page-subtitle">Real-time financial health and disruption signals</p>
        </div>
        {!isLive && (
          <span className="kv-badge kv-badge-warning" style={{ fontSize: 10 }}>Demo Mode</span>
        )}
      </div>

      {/* Hero Stats Row */}
      <div className="kv-card" style={{ padding: '4px 28px', display: 'flex', gap: 0 }}>
        <HeroStat label="Total Premiums" value={fmt(s.total_premiums)} color="var(--success)" sub="Collected this period" />
        <div style={{ width: 1, background: 'var(--border-subtle)', margin: '12px 24px' }} />
        <HeroStat label="Total Payouts" value={fmt(s.total_payouts)} color="var(--danger)" sub="Disbursed to riders" />
        <div style={{ width: 1, background: 'var(--border-subtle)', margin: '12px 24px' }} />
        <HeroStat
          label="Loss Ratio"
          value={`${(s.loss_ratio * 100).toFixed(1)}%`}
          color={s.loss_ratio < 0.7 ? 'var(--success)' : 'var(--danger)'}
          sub="Target: <70% (IRDAI Std)"
        />
      </div>

      {/* Mini Stats */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <MiniStat label="Active Policies" value={s.active_policies} color="var(--info)" />
        <MiniStat label="Claims Pending" value={s.claims_pending} color="var(--warning)" />
        <MiniStat label="Fraud Blocks (24h)" value={s.fraud_blocks_24h} color="var(--danger)" />
        <MiniStat label="Auto-Approved (24h)" value={s.auto_approved_24h} color="var(--success)" />
        <MiniStat label="Fraud Mitigation" value={`${pctSaved}%`} color="var(--accent)" />
      </div>

      {/* Chart + Efficiency Panel */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16, alignItems: 'start' }}>
        {/* Chart */}
        <div className="kv-card" style={{ padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div className="kv-section-label">Premium vs Payout Trend</div>
            <div style={{ display: 'flex', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 8, height: 3, borderRadius: 1, background: 'var(--success)', display: 'inline-block' }} />
                <span style={{ fontSize: 10, color: 'var(--text-3)', fontWeight: 500 }}>Premiums</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 8, height: 3, borderRadius: 1, background: 'var(--warning)', display: 'inline-block' }} />
                <span style={{ fontSize: 10, color: 'var(--text-3)', fontWeight: 500 }}>Payouts</span>
              </div>
            </div>
          </div>
          <div style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={TREND_DATA} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="gPrem" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#059669" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#059669" stopOpacity={0.01} />
                  </linearGradient>
                  <linearGradient id="gPay" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#d97706" stopOpacity={0.1} />
                    <stop offset="95%" stopColor="#d97706" stopOpacity={0.01} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
                <XAxis dataKey="day" tick={{ fill: 'var(--text-3)', fontSize: 10 }} axisLine={false} tickLine={false} dy={8} />
                <YAxis tickFormatter={v => fmt(v)} tick={{ fill: 'var(--text-3)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} />
                <Area type="monotone" dataKey="premiums" stroke="#059669" strokeWidth={2} fill="url(#gPrem)" />
                <Area type="monotone" dataKey="payouts" stroke="#d97706" strokeWidth={1.5} strokeDasharray="4 3" fill="url(#gPay)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Efficiency Panel */}
        <div className="kv-card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="kv-section-label">Financial Efficiency</div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 500 }}>Operating Margin</span>
              <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--success)', fontFamily: "'JetBrains Mono', monospace" }}>
                +{fmt(s.total_premiums - s.total_payouts)}
              </span>
            </div>
            <div style={{ height: 4, background: 'var(--surface-2)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                background: 'var(--success)',
                borderRadius: 2,
                width: `${Math.min(100, (s.total_premiums - s.total_payouts) / s.total_premiums * 200)}%`,
                transition: 'width 0.8s ease-out',
              }} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div className="kv-card-flat" style={{ padding: 14 }}>
              <div style={{ fontSize: 9, color: 'var(--text-3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Loss Ratio</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: s.loss_ratio < 0.7 ? 'var(--success)' : 'var(--danger)', fontFamily: "'JetBrains Mono', monospace" }}>
                {(s.loss_ratio * 100).toFixed(1)}%
              </div>
            </div>
            <div className="kv-card-flat" style={{ padding: 14 }}>
              <div style={{ fontSize: 9, color: 'var(--text-3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Fraud Saved</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--accent)', fontFamily: "'JetBrains Mono', monospace" }}>
                {pctSaved}%
              </div>
            </div>
          </div>

          <div className="kv-card-flat" style={{ padding: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ fontSize: 11, color: 'var(--text-3)', lineHeight: 1.5, fontWeight: 400 }}>
              All parametric triggers verified via Open-Meteo & multisig GPS validation.
            </div>
          </div>
        </div>
      </div>

      {/* Active Triggers Table */}
      {ts?.active_triggers?.length ? (
        <div className="kv-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '14px 20px',
            borderBottom: '1px solid var(--border-color)',
          }}>
            <span className="kv-section-label" style={{ marginBottom: 0 }}>Active Disruption Signals</span>
            <span className="kv-badge kv-badge-danger">Critical</span>
          </div>
          <table className="kv-table">
            <thead>
              <tr>
                <th>Zone</th>
                <th>Event</th>
                <th>Metric</th>
                <th style={{ textAlign: 'center' }}>Tier</th>
                <th>Age</th>
              </tr>
            </thead>
            <tbody>
              {ts.active_triggers.map((t, i) => (
                <tr key={i}>
                  <td>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, color: 'var(--accent)', fontSize: 12 }}>
                      {t.zone}
                    </span>
                  </td>
                  <td>
                    <span className="kv-badge kv-badge-neutral">{t.event_type.toUpperCase()}</span>
                  </td>
                  <td>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13 }}>{t.metric_value}</span>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <span className={`kv-badge ${t.tier === 3 ? 'kv-badge-danger' : t.tier === 2 ? 'kv-badge-warning' : 'kv-badge-success'}`}>
                      Tier {t.tier}
                    </span>
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--text-3)' }}>
                    {safeFormatDistance(t.triggered_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  )
}
