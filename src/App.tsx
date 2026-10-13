// src/App.tsx
import { useState, useEffect } from 'react'
import { useTheme } from './lib/theme'
import HomeScreen from './components/HomeScreen'
import Board from './components/Board'
import type { Board as BoardType, LocalUser } from './types'
import * as db from './lib/db'

const localUser: LocalUser = { id: 'local-user', email: 'You' }

export default function App() {
  const user = localUser
  const { dark, toggle: toggleDark } = useTheme()
  const [activeBoard, setActiveBoard] = useState<BoardType | null>(null)
  const [initDone, setInitDone] = useState(false)

  // On first launch: ensure the local workspace has at least one board.
  useEffect(() => {
    if (initDone) return
    db.getOrCreateDefaultBoard(user.id).then(() => setInitDone(true))
  }, [user, initDone])

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
      dark={dark}
      onToggleDark={toggleDark}
    />
  )
}
