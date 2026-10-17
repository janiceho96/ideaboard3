// src/App.tsx
import { useState } from 'react'
import { useTheme } from './lib/theme'
import HomeScreen from './components/HomeScreen'
import Board from './components/Board'
import type { Board as BoardType, LocalUser } from './types'

const localUser: LocalUser = { id: 'local-user', email: 'You' }

export default function App() {
  const user = localUser
  const { dark, toggle: toggleDark } = useTheme()
  const [activeBoard, setActiveBoard] = useState<BoardType | null>(null)

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
