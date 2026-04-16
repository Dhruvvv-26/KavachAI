import { Routes, Route, useLocation } from 'react-router-dom'
import React, { useEffect, useState } from 'react'
import {
  Activity,
  Camera,
  ChevronRight,
  Clock3,
  Flame,
  Gauge,
  GitBranch,
  Menu,
  ShieldAlert,
  Sparkles,
  User,
  X,
} from 'lucide-react'
import { fetchPaymentSummary, fetchTriggerStatus } from './lib/api'
import type { PaymentSummary, TriggerStatus } from './lib/types'
import SidebarItem from './components/ui/SidebarItem'
import Badge from './components/ui/Badge'

import FraudQueue from './components/FraudQueue'
import SHAPWaterfall from './components/SHAPWaterfall'
import ZoneHeatmap from './components/ZoneHeatmap'
import DualSelfieCheck from './components/DualSelfieCheck'
import LiveMetrics from './components/LiveMetrics'
import ActuarialDashboard from './components/ActuarialDashboard'

function Topbar({
  live,
  triggerStatus,
  sidebarOpen,
  onToggleSidebar,
}: {
  live: boolean
  triggerStatus: TriggerStatus | null
  sidebarOpen: boolean
  onToggleSidebar: () => void
}) {
  const [now, setNow] = useState(new Date())
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t) }, [])

  return (
    <div className="topbar">
      <button className="menu-button" onClick={onToggleSidebar} aria-label="Toggle navigation">
        {sidebarOpen ? <X size={16} /> : <Menu size={16} />}
      </button>

      <div className="topbar-brand">
        <span className="brand-mark"><Sparkles size={15} /></span>
        <div>
          <strong>KavachAI</strong>
          <span>Admin Command Center</span>
        </div>
      </div>

      {triggerStatus?.active_triggers?.length ? (
        <div className="topbar-trigger">
          <span className="live-dot amber" />
          {triggerStatus.active_triggers.length} active trigger{triggerStatus.active_triggers.length > 1 ? 's' : ''} live
        </div>
      ) : null}

      <div className="topbar-right">
        <span className="topbar-time"><Clock3 size={13} />{now.toLocaleTimeString('en-IN', { hour12: false })}</span>
        <span className={`status-pill ${live ? 'live' : 'demo'}`}>
          <span className="live-dot" />
          {live ? 'Live mode' : 'Demo mode'}
        </span>
        <Badge variant="info">v3.0</Badge>
        <div className="topbar-avatar"><User size={14} /></div>
      </div>
    </div>
  )
}

function Sidebar({
  softHolds,
  pendingClaims,
  open,
  onNavigate,
}: {
  softHolds: number
  pendingClaims: number
  open: boolean
  onNavigate: () => void
}) {
  return (
    <nav className={`sidebar ${open ? 'open' : ''}`}>
      <div className="sidebar-inner">
        <div className="sidebar-section">Overview</div>
        <SidebarItem to="/" end icon={<Activity size={15} />} label="Live Metrics" onNavigate={onNavigate} />

        <div className="sidebar-section">Fraud Management</div>
        <SidebarItem
          to="/fraud-queue"
          icon={<ShieldAlert size={15} />}
          label="Fraud Queue"
          badge={pendingClaims > 0 ? pendingClaims : undefined}
          badgeVariant="danger"
          onNavigate={onNavigate}
        />
        <SidebarItem
          to="/dual-selfie"
          icon={<Camera size={15} />}
          label="Dual Selfie Check"
          badge={softHolds > 0 ? softHolds : undefined}
          badgeVariant="warn"
          onNavigate={onNavigate}
        />

        <div className="sidebar-section">Analytics</div>
        <SidebarItem to="/shap" icon={<GitBranch size={15} />} label="SHAP Explainer" onNavigate={onNavigate} />
        <SidebarItem to="/zones" icon={<Flame size={15} />} label="Zone Heatmap" onNavigate={onNavigate} />
        <SidebarItem to="/actuarial" icon={<Gauge size={15} />} label="Actuarial / BCR" onNavigate={onNavigate} />

        <div className="sidebar-footer">
          <div className="sidebar-footer-label">Demo anchor</div>
          <div className="sidebar-footer-worker">Arjun Kumar <ChevronRight size={13} /></div>
          <div className="sidebar-footer-zone">delhi_rohini</div>
        </div>
      </div>
    </nav>
  )
}


class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false, error: '' }
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          height: '60vh', color: 'var(--text-3)', textAlign: 'center',
        }}>
          <div>
            <div style={{ fontSize: 48, marginBottom: 16 }}>⚡</div>
            <h2 style={{ fontSize: 18, color: 'var(--text-1)', marginBottom: 8 }}>Something went wrong</h2>
            <p style={{ fontSize: 13, maxWidth: 400, margin: '0 auto' }}>{this.state.error}</p>
            <button
              onClick={() => { this.setState({ hasError: false, error: '' }); window.location.reload() }}
              style={{
                marginTop: 16, padding: '8px 24px', borderRadius: 8,
                background: 'var(--teal)', color: '#000', border: 'none',
                cursor: 'pointer', fontWeight: 600,
              }}
            >
              Reload
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

export default function App() {
  const location = useLocation()
  const [summary, setSummary] = useState<PaymentSummary | null>(null)
  const [triggerStatus, setTriggerStatus] = useState<TriggerStatus | null>(null)
  const [live, setLive] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    async function load() {
      const [s, t] = await Promise.all([fetchPaymentSummary(), fetchTriggerStatus()])
      setSummary(s.data)
      setTriggerStatus(t.data)
      setLive(s.live || t.live)
    }
    load()
    const interval = setInterval(load, 15000)
    return () => clearInterval(interval)
  }, [])

  const softHolds = (summary as any)?.soft_holds_24h ?? 0
  const pendingClaims = summary?.claims_pending ?? 0

  useEffect(() => {
    setSidebarOpen(false)
  }, [location.pathname])

  return (
    <div className="shell">
      <Topbar
        live={live}
        triggerStatus={triggerStatus}
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen(prev => !prev)}
      />
      <Sidebar
        softHolds={softHolds}
        pendingClaims={pendingClaims}
        open={sidebarOpen}
        onNavigate={() => setSidebarOpen(false)}
      />
      {sidebarOpen ? <button className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} aria-label="Close navigation" /> : null}
      <main className="main">
        <div className="content-frame">
          <Routes>
            <Route path="/" element={<LiveMetrics summary={summary} triggerStatus={triggerStatus} live={live} />} />
            <Route path="/fraud-queue" element={<FraudQueue live={live} />} />
            <Route path="/dual-selfie" element={<DualSelfieCheck live={live} />} />
            <Route path="/shap" element={<SHAPWaterfall live={live} />} />
            <Route path="/zones" element={<ZoneHeatmap live={live} />} />
            <Route path="/actuarial" element={<ActuarialDashboard live={live} />} />
          </Routes>
        </div>
      </main>
    </div>
  )
}
