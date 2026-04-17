import { Routes, Route, NavLink, useLocation } from 'react-router-dom'
import React, { useEffect, useState, useCallback } from 'react'
import { fetchPaymentSummary, fetchTriggerStatus } from './lib/api'
import type { PaymentSummary, TriggerStatus } from './lib/types'

import FraudQueue from './components/FraudQueue'
import SHAPWaterfall from './components/SHAPWaterfall'
import ZoneHeatmap from './components/ZoneHeatmap'
import DualSelfieCheck from './components/DualSelfieCheck'
import LiveMetrics from './components/LiveMetrics'
import ActuarialDashboard from './components/ActuarialDashboard'
import AdminLogin from './components/AdminLogin'

/* ──────────────────────────────────────────────
   Theme Toggle Hook
   ────────────────────────────────────────────── */
function useTheme() {
  const [dark, setDark] = useState(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem('kv-theme') === 'dark'
  })

  useEffect(() => {
    const root = document.documentElement
    if (dark) {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
    localStorage.setItem('kv-theme', dark ? 'dark' : 'light')
  }, [dark])

  return { dark, toggle: () => setDark(d => !d) }
}

/* ──────────────────────────────────────────────
   SVG Icons (inline, no dependencies)
   ────────────────────────────────────────────── */
const icons = {
  metrics: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="5" width="3" height="10" rx="0.5" />
      <rect x="6.5" y="1" width="3" height="14" rx="0.5" />
      <rect x="12" y="8" width="3" height="7" rx="0.5" />
    </svg>
  ),
  shield: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 1.5L2.5 4v4c0 3.5 2.5 5.5 5.5 7 3-1.5 5.5-3.5 5.5-7V4L8 1.5z" />
    </svg>
  ),
  camera: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 5.5a1 1 0 011-1h2l1-1.5h4l1 1.5h2a1 1 0 011 1v7a1 1 0 01-1 1H3a1 1 0 01-1-1v-7z" />
      <circle cx="8" cy="9" r="2.25" />
    </svg>
  ),
  chart: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 14l4-5 3 3 5-7" />
    </svg>
  ),
  brain: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 2C5 2 3 4.5 3 7c0 1.5.5 2.5 1.5 3.5L5 14h6l.5-3.5C12.5 9.5 13 8.5 13 7c0-2.5-2-5-5-5z" />
      <path d="M8 2v12" />
      <path d="M5.5 6h5M5 9h6" />
    </svg>
  ),
  map: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 3.5l4.5-2 5 2L15 1.5v11l-4.5 2-5-2L1 14.5v-11z" />
      <path d="M5.5 1.5v11M10.5 3.5v11" />
    </svg>
  ),
  sun: (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <circle cx="8" cy="8" r="3" />
      <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41" />
    </svg>
  ),
  moon: (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13.5 8.5a5.5 5.5 0 01-8-5A5.5 5.5 0 108 14a5.5 5.5 0 005.5-5.5z" />
    </svg>
  ),
}

/* ──────────────────────────────────────────────
   Topbar
   ────────────────────────────────────────────── */
function Topbar({
  live,
  triggerStatus,
  dark,
  onToggleTheme,
}: {
  live: boolean
  triggerStatus: TriggerStatus | null
  dark: boolean
  onToggleTheme: () => void
}) {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  return (
    <div className="topbar">
      {/* Brand */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{
          fontSize: 15,
          fontWeight: 700,
          color: 'var(--accent)',
          letterSpacing: '-0.02em',
          fontFamily: "'JetBrains Mono', monospace",
        }}>
          KavachAI
        </span>
        <span style={{
          fontSize: 9,
          fontWeight: 600,
          padding: '2px 6px',
          borderRadius: 3,
          background: 'var(--surface-2)',
          color: 'var(--text-3)',
          letterSpacing: '0.08em',
          textTransform: 'uppercase' as const,
        }}>
          v3
        </span>
      </div>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Active triggers */}
      {triggerStatus?.active_triggers?.length ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className="pulse-dot" style={{
            width: 6, height: 6, borderRadius: '50%',
            background: 'var(--danger)', display: 'inline-block',
          }} />
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--danger)', letterSpacing: '0.02em' }}>
            {triggerStatus.active_triggers.length} Active Triggers
          </span>
        </div>
      ) : null}

      {/* Time */}
      <span style={{
        fontSize: 11,
        fontFamily: "'JetBrains Mono', monospace",
        color: 'var(--text-3)',
        fontWeight: 500,
      }}>
        {now.toLocaleTimeString('en-IN', { hour12: false })}
      </span>

      {/* Status dot */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 5,
        padding: '3px 10px', borderRadius: 4,
        background: live ? 'var(--success-muted)' : 'var(--warning-muted)',
        border: `1px solid ${live ? 'var(--success)' : 'var(--warning)'}20`,
      }}>
        <span className="pulse-dot" style={{
          width: 5, height: 5, borderRadius: '50%',
          background: live ? 'var(--success)' : 'var(--warning)',
          display: 'inline-block',
        }} />
        <span style={{
          fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
          color: live ? 'var(--success)' : 'var(--warning)',
          textTransform: 'uppercase' as const,
        }}>
          {live ? 'Live' : 'Demo'}
        </span>
      </div>

      {/* Theme toggle */}
      <button
        onClick={onToggleTheme}
        aria-label="Toggle theme"
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 32, height: 32, borderRadius: 6,
          background: 'var(--surface-2)',
          border: '1px solid var(--border-color)',
          cursor: 'pointer',
          color: 'var(--text-2)',
          transition: 'all 0.15s ease',
        }}
      >
        {dark ? icons.sun : icons.moon}
      </button>
    </div>
  )
}

/* ──────────────────────────────────────────────
   Sidebar
   ────────────────────────────────────────────── */
function Sidebar({ softHolds, pendingClaims }: { softHolds: number; pendingClaims: number }) {
  const location = useLocation()

  const navItems = [
    { section: 'Operations', items: [
      { to: '/', label: 'Live Metrics', icon: icons.metrics, badge: 0 },
      { to: '/fraud-queue', label: 'Fraud Queue', icon: icons.shield, badge: pendingClaims },
      { to: '/dual-selfie', label: 'Dual Selfie', icon: icons.camera, badge: softHolds },
    ]},
    { section: 'Intelligence', items: [
      { to: '/actuarial', label: 'BCR Dashboard', icon: icons.chart, badge: 0 },
      { to: '/shap', label: 'SHAP Explain', icon: icons.brain, badge: 0 },
      { to: '/zones', label: 'Risk Heatmap', icon: icons.map, badge: 0 },
    ]},
  ]

  return (
    <nav className="sidebar">
      {navItems.map(group => (
        <div key={group.section} style={{ marginBottom: 20 }}>
          <div style={{
            padding: '8px 16px 4px',
            fontSize: 9,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.12em',
            color: 'var(--text-3)',
          }}>
            {group.section}
          </div>
          {group.items.map(item => {
            const active = item.to === '/' ? location.pathname === '/' : location.pathname.startsWith(item.to)
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '9px 16px',
                  fontSize: 13,
                  fontWeight: active ? 600 : 400,
                  color: active ? 'var(--accent)' : 'var(--text-2)',
                  textDecoration: 'none',
                  borderLeft: active ? '2px solid var(--accent)' : '2px solid transparent',
                  background: active ? 'var(--accent-muted)' : 'transparent',
                  transition: 'all 0.15s ease',
                  marginLeft: 0,
                }}
                onMouseEnter={e => {
                  if (!active) {
                    (e.currentTarget as HTMLElement).style.background = 'var(--surface-1)'
                  }
                }}
                onMouseLeave={e => {
                  if (!active) {
                    (e.currentTarget as HTMLElement).style.background = 'transparent'
                  }
                }}
              >
                <span style={{ color: active ? 'var(--accent)' : 'var(--text-3)', display: 'flex', transition: 'color 0.15s' }}>
                  {item.icon}
                </span>
                <span>{item.label}</span>
                {item.badge > 0 && (
                  <span style={{
                    marginLeft: 'auto',
                    fontSize: 10,
                    fontWeight: 700,
                    fontFamily: "'JetBrains Mono', monospace",
                    minWidth: 18,
                    height: 18,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 4,
                    background: 'var(--danger)',
                    color: '#fff',
                  }}>
                    {item.badge}
                  </span>
                )}
              </NavLink>
            )
          })}
        </div>
      ))}

      {/* Profile footer */}
      <div style={{ marginTop: 'auto', padding: '12px 16px', borderTop: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 6,
            background: 'var(--accent-muted)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 700, color: 'var(--accent)',
            fontFamily: "'JetBrains Mono', monospace",
          }}>
            AK
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-1)' }}>Arjun Kumar</div>
            <div style={{ fontSize: 10, color: 'var(--text-3)', fontFamily: "'JetBrains Mono', monospace" }}>
              delhi_rohini
            </div>
          </div>
        </div>
      </div>
    </nav>
  )
}

/* ──────────────────────────────────────────────
   App Root
   ────────────────────────────────────────────── */
export default function App() {
  const [summary, setSummary] = useState<PaymentSummary | null>(null)
  const [triggerStatus, setTriggerStatus] = useState<TriggerStatus | null>(null)
  const [live, setLive] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => !!localStorage.getItem('admin_jwt'))
  const { dark, toggle } = useTheme()

  useEffect(() => {
    async function load() {
      try {
        const [s, t] = await Promise.all([fetchPaymentSummary(), fetchTriggerStatus()])
        setSummary(s.data)
        setTriggerStatus(t.data)
        setLive(s.live || t.live)
      } catch (err) { console.error('Load failed', err) }
    }
    if (isAuthenticated) {
      load()
      const interval = setInterval(load, 15000)
      return () => clearInterval(interval)
    }
  }, [isAuthenticated])

  const softHolds = (summary as any)?.soft_holds_24h ?? 0
  const pendingClaims = summary?.claims_pending ?? 0

  if (!isAuthenticated) {
    return <AdminLogin onLogin={() => setIsAuthenticated(true)} dark={dark} onToggleTheme={toggle} />
  }

  return (
    <div className="shell">
      <Topbar live={live} triggerStatus={triggerStatus} dark={dark} onToggleTheme={toggle} />
      <Sidebar softHolds={softHolds} pendingClaims={pendingClaims} />
      <main className="main">
        <Routes>
          <Route path="/" element={<LiveMetrics summary={summary} triggerStatus={triggerStatus} live={live} />} />
          <Route path="/fraud-queue" element={<FraudQueue live={live} />} />
          <Route path="/dual-selfie" element={<DualSelfieCheck live={live} />} />
          <Route path="/shap" element={<SHAPWaterfall live={live} />} />
          <Route path="/zones" element={<ZoneHeatmap live={live} />} />
          <Route path="/actuarial" element={<ActuarialDashboard live={live} />} />
        </Routes>
      </main>
    </div>
  )
}
