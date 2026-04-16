import type { ReactNode } from 'react'

type BadgeVariant = 'success' | 'warn' | 'danger' | 'info' | 'neutral'

interface BadgeProps {
  children: ReactNode
  variant?: BadgeVariant
  className?: string
}

export default function Badge({ children, variant = 'neutral', className = '' }: BadgeProps) {
  return <span className={`ui-badge ${variant} ${className}`.trim()}>{children}</span>
}
