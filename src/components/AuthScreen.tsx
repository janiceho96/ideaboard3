// src/components/AuthScreen.tsx
import { useState } from 'react'

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
    <div style={{
      minHeight: '100vh', background: '#ECEAE3',
      backgroundImage: 'radial-gradient(circle,rgba(0,0,0,.12) 1px,transparent 1px)',
      backgroundSize: '24px 24px',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'DM Sans', sans-serif",
    }}>
      <div style={{
        background: 'white', borderRadius: 20, border: '2px solid #152336',
        padding: 36, width: 380,
        boxShadow: '0 24px 64px rgba(0,0,0,.18)',
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
          <div style={{
            width: 40, height: 40,
            background: 'linear-gradient(135deg,#6C63FF,#E040FB)',
            borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 18, color: 'white',
          }}>I</div>
          <div>
            <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 17, color: '#152336' }}>Ideaboard</div>
            <div style={{ fontSize: 12, color: '#999' }}>Collaborative whiteboard</div>
          </div>
        </div>

        <h2 style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 22, color: '#152336', marginBottom: 6 }}>
          {mode === 'signin' ? 'Welcome back' : 'Create account'}
        </h2>
        <p style={{ fontSize: 13, color: '#888', marginBottom: 24 }}>
          {mode === 'signin' ? 'Sign in to your board' : 'Start organising your ideas'}
        </p>

        {success ? (
          <div style={{ background: '#D4EDD8', border: '1px solid #A8D4AD', borderRadius: 10, padding: '14px 16px', fontSize: 13, color: '#1B4D21' }}>
            ✅ Check your email to confirm your account, then sign in.
          </div>
        ) : (
          <form onSubmit={handle}>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, letterSpacing: '.05em', textTransform: 'uppercase', color: '#888', marginBottom: 5 }}>Email</label>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com" required
                style={{ width: '100%', border: '1.5px solid #E0E0E0', borderRadius: 9, padding: '9px 12px', fontSize: 13, fontFamily: "'DM Sans',sans-serif", outline: 'none', boxSizing: 'border-box' }}
                onFocus={e => e.target.style.borderColor = '#6C63FF'}
                onBlur={e => e.target.style.borderColor = '#E0E0E0'}
              />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, letterSpacing: '.05em', textTransform: 'uppercase', color: '#888', marginBottom: 5 }}>Password</label>
              <input
                type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="Min. 6 characters" required minLength={6}
                style={{ width: '100%', border: '1.5px solid #E0E0E0', borderRadius: 9, padding: '9px 12px', fontSize: 13, fontFamily: "'DM Sans',sans-serif", outline: 'none', boxSizing: 'border-box' }}
                onFocus={e => e.target.style.borderColor = '#6C63FF'}
                onBlur={e => e.target.style.borderColor = '#E0E0E0'}
              />
            </div>

            {error && (
              <div style={{ background: '#FEECEC', border: '1px solid #FBBABA', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#C53030', marginBottom: 16 }}>
                {error}
              </div>
            )}

            <button
              type="submit" disabled={busy}
              style={{
                width: '100%', height: 42, borderRadius: 10,
                background: busy ? '#9D97E8' : '#6C63FF', color: 'white',
                border: 'none', cursor: busy ? 'not-allowed' : 'pointer',
                fontFamily: "'DM Sans',sans-serif", fontSize: 14, fontWeight: 500,
                transition: 'background .15s',
              }}
            >
              {busy ? 'Please wait…' : mode === 'signin' ? 'Sign In' : 'Create Account'}
            </button>
          </form>
        )}

        <div style={{ marginTop: 20, textAlign: 'center', fontSize: 13, color: '#888' }}>
          {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
          <button
            onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(null); setSuccess(false); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6C63FF', fontWeight: 600, fontSize: 13 }}
          >
            {mode === 'signin' ? 'Sign up' : 'Sign in'}
          </button>
        </div>
      </div>
    </div>
  )
}
