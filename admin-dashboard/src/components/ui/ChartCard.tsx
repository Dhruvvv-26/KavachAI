import type { ReactNode } from 'react'
import GlassCard from './GlassCard'

interface ChartCardProps {
  title: string
  subtitle?: string
  action?: ReactNode
  children: ReactNode
  className?: string
}

export default function ChartCard({ title, subtitle, action, children, className = '' }: ChartCardProps) {
  return (
    <GlassCard className={`chart-card ${className}`.trim()}>
      <div className="chart-card-head">
        <div>
          <h3>{title}</h3>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
        {action ? <div>{action}</div> : null}
      </div>
      <div className="chart-card-body">{children}</div>
    </GlassCard>
  )
}
