import type { ReactNode } from 'react'
import GlassCard from './GlassCard'

interface SectionContainerProps {
  title: string
  subtitle?: string
  action?: ReactNode
  children: ReactNode
  className?: string
}

export default function SectionContainer({ title, subtitle, action, children, className = '' }: SectionContainerProps) {
  return (
    <GlassCard className={`section-container ${className}`.trim()}>
      <div className="section-head">
        <div>
          <h3>{title}</h3>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
        {action ? <div className="section-action">{action}</div> : null}
      </div>
      {children}
    </GlassCard>
  )
}
