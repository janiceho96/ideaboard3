// src/App.tsx
import { useState, useEffect } from 'react'
import { useAuth } from './hooks/useAuth'
import { useTheme } from './lib/theme'
import AuthScreen from './components/AuthScreen'
import HomeScreen from './components/HomeScreen'
import Board from './components/Board'
import type { Board as BoardType } from './types'
import * as db from './lib/db'

export default function App() {
  const { user, loading, signIn, signUp, signOut } = useAuth()
  const { dark, toggle: toggleDark } = useTheme()
  const [activeBoard, setActiveBoard] = useState<BoardType | null>(null)
  const [initDone, setInitDone] = useState(false)

  // On first login: ensure the user has at least one board
  useEffect(() => {
    if (!user || initDone) return
    db.getOrCreateDefaultBoard(user.id).then(() => setInitDone(true))
  }, [user, initDone])

  if (loading) return (
    <div style={{
      height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'DM Sans',sans-serif", color: dark ? '#666' : '#888',
      background: dark ? '#0D1B2E' : '#ECEAE3',
      backgroundImage: 'radial-gradient(circle,rgba(0,0,0,.1) 1px,transparent 1px)',
      backgroundSize: '24px 24px',
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width:40,height:40,background:'linear-gradient(135deg,#6C63FF,#E040FB)',borderRadius:12,margin:'0 auto 16px',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:18,color:'white' }}>I</div>
        <div style={{ fontSize: 14 }}>Loading…</div>
      </div>
    </div>
  )

  if (!user) return <AuthScreen onSignIn={signIn} onSignUp={signUp} />

  if (activeBoard) return (
    <Board
      user={user}
      board={activeBoard}
      onBack={() => setActiveBoard(null)}
      dark={dark}
      onToggleDark={toggleDark}
    />
  )

  return (
    <HomeScreen
      user={user}
      onOpenBoard={setActiveBoard}
      onSignOut={signOut}
      dark={dark}
      onToggleDark={toggleDark}
    />
  )
}
