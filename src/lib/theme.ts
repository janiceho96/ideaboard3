// src/lib/theme.ts
// Dark mode: we toggle a class on <body> and use CSS variables.
// The preference is remembered in localStorage.

import { useState, useEffect } from 'react'

export function useTheme() {
  const [dark, setDark] = useState<boolean>(() => {
    try { return localStorage.getItem('ideaboard_dark') === 'true' } catch { return false }
  })

  useEffect(() => {
    document.body.setAttribute('data-theme', dark ? 'dark' : 'light')
    try { localStorage.setItem('ideaboard_dark', String(dark)) } catch {}
  }, [dark])

  const toggle = () => setDark(d => !d)
  return { dark, toggle }
}
