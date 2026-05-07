import { useState, useCallback } from 'react'

export type FrameworkType =
  | 'blank' | 'eisenhower' | 'ooda'
  | 'ikigai' | 'wheel-of-life' | 'grow' | 'smart-goals'
  | 'start-stop-continue' | 'personal-kanban' | 'five-whys'
  | 'daily-reflection' | 'okr' | 'energy-audit'
  | 'eat-that-frog' | 'gtd'

export interface FrameworkSettings {
  type: FrameworkType
  width: number
  height: number
}

const VALID_TYPES: FrameworkType[] = [
  'blank', 'eisenhower', 'ooda',
  'ikigai', 'wheel-of-life', 'grow', 'smart-goals',
  'start-stop-continue', 'personal-kanban', 'five-whys',
  'daily-reflection', 'okr', 'energy-audit',
  'eat-that-frog', 'gtd',
]

const DEFAULTS: Record<FrameworkType, { width: number; height: number }> = {
  blank:                 { width: 640, height: 540 },
  eisenhower:            { width: 640, height: 540 },
  ooda:                  { width: 720, height: 220 },
  ikigai:                { width: 520, height: 520 },
  'wheel-of-life':       { width: 500, height: 520 },
  grow:                  { width: 640, height: 540 },
  'smart-goals':         { width: 800, height: 220 },
  'start-stop-continue': { width: 720, height: 400 },
  'personal-kanban':     { width: 720, height: 400 },
  'five-whys':           { width: 640, height: 380 },
  'daily-reflection':    { width: 640, height: 540 },
  okr:                   { width: 640, height: 440 },
  'energy-audit':        { width: 640, height: 540 },
  'eat-that-frog':       { width: 580, height: 440 },
  gtd:                   { width: 840, height: 260 },
}

export function parseFrameworkSettings(raw: string | null): FrameworkSettings {
  if (!raw) return { type: 'eisenhower', ...DEFAULTS.eisenhower }
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const type: FrameworkType = VALID_TYPES.includes(parsed['type'] as FrameworkType)
      ? (parsed['type'] as FrameworkType)
      : 'eisenhower'
    return {
      type,
      width:  typeof parsed['width']  === 'number' ? parsed['width']  : DEFAULTS[type].width,
      height: typeof parsed['height'] === 'number' ? parsed['height'] : DEFAULTS[type].height,
    }
  } catch {
    return { type: 'eisenhower', ...DEFAULTS.eisenhower }
  }
}

function storageKey(boardId: string) {
  return `ideaboard_framework_${boardId}`
}

function save(boardId: string, s: FrameworkSettings) {
  localStorage.setItem(storageKey(boardId), JSON.stringify(s))
}

export function useFramework(boardId: string) {
  const [framework, setFramework] = useState<FrameworkSettings>(
    () => parseFrameworkSettings(localStorage.getItem(storageKey(boardId)))
  )

  const setType = useCallback((type: FrameworkType) => {
    setFramework(prev => {
      const size = prev.type === type
        ? { width: prev.width, height: prev.height }
        : DEFAULTS[type]
      const next = { type, ...size }
      save(boardId, next)
      return next
    })
  }, [boardId])

  const setSize = useCallback((width: number, height: number) => {
    setFramework(prev => ({ ...prev, width, height }))
  }, [])

  const commitSize = useCallback((width: number, height: number) => {
    setFramework(prev => {
      const next = { ...prev, width, height }
      if (width > 0 && height > 0) save(boardId, next)
      return next
    })
  }, [boardId])

  return { framework, setType, setSize, commitSize }
}
