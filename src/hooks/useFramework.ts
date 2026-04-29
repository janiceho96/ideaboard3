import { useState, useCallback } from 'react'

export type FrameworkType = 'blank' | 'eisenhower' | 'ooda'

export interface FrameworkSettings {
  type: FrameworkType
  width: number
  height: number
}

const VALID_TYPES: FrameworkType[] = ['blank', 'eisenhower', 'ooda']

const DEFAULTS: Record<FrameworkType, { width: number; height: number }> = {
  blank:      { width: 640, height: 540 },
  eisenhower: { width: 640, height: 540 },
  ooda:       { width: 720, height: 220 },
}

export function parseFrameworkSettings(raw: string | null): FrameworkSettings {
  if (!raw) return { type: 'eisenhower', ...DEFAULTS.eisenhower }
  try {
    const parsed = JSON.parse(raw) as Partial<FrameworkSettings>
    const type: FrameworkType = VALID_TYPES.includes(parsed.type as FrameworkType)
      ? (parsed.type as FrameworkType)
      : 'eisenhower'
    return {
      type,
      width:  typeof parsed.width  === 'number' ? parsed.width  : DEFAULTS[type].width,
      height: typeof parsed.height === 'number' ? parsed.height : DEFAULTS[type].height,
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
      save(boardId, next)
      return next
    })
  }, [boardId])

  return { framework, setType, setSize, commitSize }
}
