import type { ReactNode } from 'react'

interface StatCardProps {
  icon: ReactNode
  label: string
  value: string | number
  hint?: string
  trend?: string
  trendTone?: 'positive' | 'negative' | 'neutral'
  tone?: 'teal' | 'amber' | 'red' | 'blue' | 'purple' | 'neutral'
}

export default function StatCard({ icon, label, value, hint, trend, trendTone = 'neutral', tone = 'neutral' }: StatCardProps) {
  return (
    <article className={`stat-card ${tone}`.trim()}>
      <div className="stat-icon">{icon}</div>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {trend ? <div className={`stat-trend ${trendTone}`.trim()}>{trend}</div> : null}
      {hint ? <div className="stat-hint">{hint}</div> : null}
    </article>
  )
}
