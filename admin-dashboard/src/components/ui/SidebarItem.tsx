import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'

interface SidebarItemProps {
  to: string
  end?: boolean
  icon: ReactNode
  label: string
  badge?: string | number
  badgeVariant?: 'neutral' | 'danger' | 'warn'
  onNavigate?: () => void
}

export default function SidebarItem({
  to,
  end,
  icon,
  label,
  badge,
  badgeVariant = 'neutral',
  onNavigate,
}: SidebarItemProps) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`.trim()}
      onClick={onNavigate}
    >
      <span className="sidebar-item-icon">{icon}</span>
      <span className="sidebar-item-label">{label}</span>
      {badge !== undefined ? <span className={`sidebar-item-badge ${badgeVariant}`.trim()}>{badge}</span> : null}
    </NavLink>
  )
}
