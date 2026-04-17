import React, { useState } from 'react'

export default function AdminLogin({
  onLogin,
  dark,
  onToggleTheme,
}: {
  onLogin: () => void
  dark: boolean
  onToggleTheme: () => void
}) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      // Mock API call to backend
      const res = await fetch('http://localhost:8000/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      })

      if (res.ok) {
        const data = await res.json()
        localStorage.setItem('admin_jwt', data.access_token)
        onLogin()
      } else {
        setError('Authorization failed. Hint: admin@kavach.ai / admin123')
      }
    } catch (err) {
      // Offline fallback for demo speed
      if (email === 'admin@kavach.ai' && password === 'admin123') {
        localStorage.setItem('admin_jwt', 'mock_jwt_admin@kavach.ai_offline')
        onLogin()
      } else {
        setError('Invalid credentials. Try admin@kavach.ai / admin123')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--main-bg)',
      padding: 24,
      position: 'relative',
    }}>
      {/* Theme toggle — top right */}
      <button
        onClick={onToggleTheme}
        aria-label="Toggle theme"
        style={{
          position: 'absolute', top: 20, right: 20,
          width: 36, height: 36, borderRadius: 6,
          background: 'var(--surface-1)',
          border: '1px solid var(--border-color)',
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--text-2)',
          transition: 'all 0.15s ease',
        }}
      >
        {dark ? (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <circle cx="8" cy="8" r="3" /><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41" />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M13.5 8.5a5.5 5.5 0 01-8-5A5.5 5.5 0 108 14a5.5 5.5 0 005.5-5.5z" />
          </svg>
        )}
      </button>

      {/* Ambient glow */}
      <div style={{
        position: 'absolute',
        width: 400, height: 400,
        borderRadius: '50%',
        background: 'var(--accent)',
        opacity: 0.03,
        filter: 'blur(100px)',
        pointerEvents: 'none',
      }} />

      {/* Login card */}
      <div className="kv-card fade-in" style={{
        width: '100%',
        maxWidth: 400,
        padding: 40,
        position: 'relative',
        zIndex: 1,
      }}>
        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <div style={{
            fontSize: 20,
            fontWeight: 700,
            color: 'var(--text-1)',
            letterSpacing: '-0.02em',
            marginBottom: 4,
          }}>
            KavachAI
          </div>
          <div style={{
            fontSize: 12,
            color: 'var(--text-3)',
            fontFamily: "'JetBrains Mono', monospace",
          }}>
            Admin Command Center
          </div>
        </div>

        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: 16 }}>
            <label style={{
              display: 'block',
              fontSize: 11,
              fontWeight: 600,
              color: 'var(--text-3)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              marginBottom: 6,
            }}>
              Email
            </label>
            <input
              type="text"
              className="kv-input"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="admin@kavach.ai"
              autoFocus
              style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, padding: '10px 14px' }}
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{
              display: 'block',
              fontSize: 11,
              fontWeight: 600,
              color: 'var(--text-3)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              marginBottom: 6,
            }}>
              Password
            </label>
            <input
              type="password"
              className="kv-input"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              style={{ padding: '10px 14px' }}
            />
          </div>

          {error && (
            <div style={{
              padding: '8px 12px',
              marginBottom: 16,
              borderRadius: 6,
              background: 'var(--danger-muted)',
              border: '1px solid var(--danger)',
              color: 'var(--danger)',
              fontSize: 12,
              fontWeight: 500,
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="kv-btn kv-btn-primary"
            style={{
              width: '100%',
              padding: '11px 0',
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: '0.02em',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>

        <div style={{
          marginTop: 24,
          textAlign: 'center',
          fontSize: 10,
          color: 'var(--text-3)',
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          fontWeight: 600,
        }}>
          Restricted Access · IRDAI Compliant
        </div>
      </div>
    </div>
  )
}
