import { useState, ReactNode } from 'react'

export default function LoginGate({ children }: { children: ReactNode }) {
  const [password, setPassword] = useState('')
  // Initialize from localStorage so we never call setState during render
  const [isAuthorized, setIsAuthorized] = useState(
    () => localStorage.getItem('admin_session') === 'active'
  )
  const [error, setError] = useState('')

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    if (password === 'kavach2026') {
      setIsAuthorized(true)
      localStorage.setItem('admin_session', 'active')
    } else {
      setError('Invalid admin passcode')
    }
  }

  if (isAuthorized) {
    return <>{children}</>
  }

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="logo-section">
          <span style={{ fontSize: 32 }}>⚡</span>
          <h1>KavachAI Admin</h1>
          <p>Parametric Command Center</p>
        </div>
        
        <form onSubmit={handleLogin} className="login-form">
          <div className="form-group">
            <label>Admin Passcode</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoFocus
            />
          </div>
          
          {error && <div className="login-error">{error}</div>}
          
          <button type="submit" className="btn btn-teal" style={{ width: '100%', marginTop: 12 }}>
            Authenticate
          </button>
        </form>
        
        <div style={{ marginTop: 24, fontSize: 12, color: 'var(--text-3)', textAlign: 'center' }}>
          Restricted access for authorized regional managers only.
        </div>
      </div>

      <style>{`
        .login-container {
          height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--bg-deep);
        }
        .login-card {
          width: 100%;
          max-width: 400px;
          padding: 40px;
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: 12px;
          box-shadow: 0 8px 32px rgba(0,0,0,0.4);
        }
        .logo-section {
          text-align: center;
          margin-bottom: 32px;
        }
        .logo-section h1 {
          margin: 8px 0 0;
          font-size: 24px;
          color: var(--teal);
        }
        .logo-section p {
          margin: 4px 0 0;
          color: var(--text-2);
          font-size: 14px;
        }
        .form-group label {
          display: block;
          margin-bottom: 8px;
          font-size: 13px;
          color: var(--text-2);
        }
        .form-group input {
          width: 100%;
          padding: 12px;
          background: var(--bg-base);
          border: 1px solid var(--border);
          border-radius: 6px;
          color: white;
          font-size: 16px;
          font-family: inherit;
        }
        .form-group input:focus {
          outline: none;
          border-color: var(--teal);
          box-shadow: 0 0 0 2px rgba(0,201,177,0.2);
        }
        .login-error {
          color: var(--red);
          font-size: 12px;
          margin-top: 8px;
        }
      `}</style>
    </div>
  )
}
