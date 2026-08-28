// src/components/AuthScreen.tsx
import { useState } from 'react'
import { Check } from 'lucide-react'

interface AuthScreenProps {
  onSignIn: (email: string, password: string) => Promise<string | null>
  onSignUp: (email: string, password: string) => Promise<string | null>
}

export default function AuthScreen({ onSignIn, onSignUp }: AuthScreenProps) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [success, setSuccess] = useState(false)

  const handle = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const fn = mode === 'signin' ? onSignIn : onSignUp
    const err = await fn(email, password)
    setBusy(false)
    if (err) {
      setError(err)
    } else if (mode === 'signup') {
      setSuccess(true)
    }
  }

  return (
    <div className="ib-page ib-auth-page">
      <div className="ib-auth-card">
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
          <div className="ib-logo" style={{ width: 40, height: 40, fontSize: 19 }}>I</div>
          <div>
            <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 17, color: '#172038' }}>Ideaboard</div>
            <div style={{ fontSize: 12, color: '#5F687B' }}>A place for your next good idea</div>
          </div>
        </div>

        <h2>
          {mode === 'signin' ? 'Welcome back' : 'Create account'}
        </h2>
        <p className="ib-subtle" style={{ marginBottom: 24 }}>
          {mode === 'signin' ? 'Pick up where you left off.' : 'Your boards stay on this device.'}
        </p>

        {success ? (
          <div className="ib-auth-success" role="status">
            <Check size={15} style={{ verticalAlign: 'text-bottom', marginRight: 6 }} />
            Your local workspace is ready. Switch to sign in and continue.
          </div>
        ) : (
          <form onSubmit={handle}>
            <div className="ib-auth-field">
              <label>Email or name</label>
              <input
                type="text" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="Your name or email" required className="ib-input"
              />
            </div>
            <div className="ib-auth-field" style={{ marginBottom: 20 }}>
              <label>Password</label>
              <input
                type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="Min. 6 characters" required minLength={6}
                className="ib-input"
              />
            </div>

            {error && (
              <div className="ib-auth-error" role="alert">
                {error}
              </div>
            )}

            <button
              type="submit" disabled={busy}
              className="ib-action ib-action-primary"
              style={{ width: '100%', minHeight: 42 }}
            >
              {busy ? 'Please wait...' : mode === 'signin' ? 'Sign in' : 'Create account'}
            </button>
          </form>
        )}

        <div style={{ marginTop: 20, textAlign: 'center', fontSize: 13, color: '#5F687B' }}>
          {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
          <button
            onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(null); setSuccess(false); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6957FF', fontWeight: 700, fontSize: 13 }}
          >
            {mode === 'signin' ? 'Sign up' : 'Sign in'}
          </button>
        </div>
      </div>
    </div>
  )
}
