// src/App.tsx
import { useState, useEffect } from 'react'
import { useAuth } from './hooks/useAuth'
import { useTheme } from './lib/theme'
import AuthScreen from './components/AuthScreen'
import HomeScreen from './components/HomeScreen'
import Board from './components/Board'
import type { Board as BoardType } from './types'
import * as db from './lib/db'
import { colors, fonts, radii, shadows } from './lib/designTokens'

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
      fontFamily: fonts.ui, color: dark ? '#AAB5C9' : '#5F687B',
      background: dark ? colors.canvasDark : colors.canvasLight,
      backgroundImage: dark ? 'radial-gradient(#30405E 0.7px, transparent 0.7px)' : 'radial-gradient(#C8CBD4 0.7px, transparent 0.7px)',
      backgroundSize: '18px 18px',
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width:40,height:40,background:colors.markerYellow,borderRadius:radii.card,border:`2px solid ${colors.ink}`,boxShadow:shadows.control,margin:'0 auto 16px',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:fonts.display,fontWeight:800,fontSize:19,color:colors.ink }}>I</div>
        <div style={{ fontSize: 14 }}>Loading your workspace...</div>
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
