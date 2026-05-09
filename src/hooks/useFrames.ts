import { useState, useCallback } from 'react'
import type { FrameworkType, FrameInstance } from '../types'

export const VALID_TYPES: FrameworkType[] = [
  'blank', 'eisenhower', 'ooda',
  'ikigai', 'wheel-of-life', 'grow', 'smart-goals',
  'start-stop-continue', 'personal-kanban', 'five-whys',
  'daily-reflection', 'okr', 'energy-audit',
  'eat-that-frog', 'gtd',
]

export const DEFAULTS: Record<FrameworkType, { width: number; height: number }> = {
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

export const FRAMEWORK_LABELS: Record<FrameworkType, string> = {
  blank:                 'Blank',
  eisenhower:            'Eisenhower Matrix',
  ooda:                  'OODA Loop',
  ikigai:                'Ikigai',
  'wheel-of-life':       'Wheel of Life',
  grow:                  'GROW Model',
  'smart-goals':         'SMART Goals',
  'start-stop-continue': 'Start / Stop / Continue',
  'personal-kanban':     'Personal Kanban',
  'five-whys':           '5 Whys',
  'daily-reflection':    'Daily Reflection',
  okr:                   'OKR',
  'energy-audit':        'Energy Audit',
  'eat-that-frog':       'Eat That Frog',
  gtd:                   'GTD',
}

export type FrameworkGroupEntry = { sep: string } | { key: FrameworkType }

export const FRAMEWORK_GROUPS: FrameworkGroupEntry[] = [
  { key: 'eisenhower' }, { key: 'ooda' },
  { sep: 'PERSONAL GROWTH' },
  { key: 'ikigai' }, { key: 'wheel-of-life' }, { key: 'grow' }, { key: 'smart-goals' },
  { key: 'start-stop-continue' }, { key: 'personal-kanban' }, { key: 'five-whys' },
  { key: 'daily-reflection' }, { key: 'okr' }, { key: 'energy-audit' },
  { key: 'eat-that-frog' }, { key: 'gtd' },
]

function framesKey(boardId: string) { return `ideaboard_frames_${boardId}` }
function oldKey(boardId: string)    { return `ideaboard_framework_${boardId}` }

function save(boardId: string, frames: FrameInstance[]) {
  localStorage.setItem(framesKey(boardId), JSON.stringify(frames))
}

export function parseFrameInstances(
  newRaw: string | null,
  oldRaw: string | null,
): FrameInstance[] {
  if (newRaw) {
    try {
      const parsed = JSON.parse(newRaw)
      if (Array.isArray(parsed) && parsed.every(f =>
        f !== null && typeof f === 'object' &&
        typeof f.id === 'string' &&
        typeof f.type === 'string' &&
        typeof f.x === 'number' &&
        typeof f.y === 'number' &&
        typeof f.width === 'number' &&
        typeof f.height === 'number'
      )) return parsed as FrameInstance[]
    } catch { /* fall through */ }
  }
  if (oldRaw) {
    try {
      const old = JSON.parse(oldRaw) as Record<string, unknown>
      const type: FrameworkType = VALID_TYPES.includes(old['type'] as FrameworkType)
        ? (old['type'] as FrameworkType)
        : 'eisenhower'
      if (type === 'blank') return []
      const def = DEFAULTS[type]
      return [{
        id: crypto.randomUUID(),
        type,
        x: 60,
        y: 40,
        width:  typeof old['width']  === 'number' ? old['width']  : def.width,
        height: typeof old['height'] === 'number' ? old['height'] : def.height,
      }]
    } catch { /* fall through */ }
  }
  return []
}

export function useFrames(boardId: string) {
  const [frames, setFrames] = useState<FrameInstance[]>(() =>
    parseFrameInstances(
      localStorage.getItem(framesKey(boardId)),
      localStorage.getItem(oldKey(boardId)),
    )
  )

  const addFrame = useCallback((
    type: FrameworkType,
    viewportCx: number,
    viewportCy: number,
    zoom: number,
    panX: number,
    panY: number,
  ): FrameInstance => {
    const t = type === 'blank' ? 'eisenhower' : type
    const { width, height } = DEFAULTS[t]
    const x = (viewportCx - panX) / zoom - width / 2
    const y = (viewportCy - panY) / zoom - height / 2
    const frame: FrameInstance = { id: crypto.randomUUID(), type: t, x, y, width, height }
    setFrames(prev => { const next = [...prev, frame]; save(boardId, next); return next })
    return frame
  }, [boardId])

  const moveFrame = useCallback((id: string, x: number, y: number) => {
    setFrames(prev => prev.map(f => f.id === id ? { ...f, x, y } : f))
  }, [])

  const commitFrameMove = useCallback((id: string, x: number, y: number) => {
    setFrames(prev => {
      const next = prev.map(f => f.id === id ? { ...f, x, y } : f)
      save(boardId, next)
      return next
    })
  }, [boardId])

  const setFrameSize = useCallback((id: string, width: number, height: number) => {
    setFrames(prev => prev.map(f => f.id === id ? { ...f, width, height } : f))
  }, [])

  const commitFrameResize = useCallback((id: string, width: number, height: number) => {
    setFrames(prev => {
      const next = prev.map(f => f.id === id ? { ...f, width, height } : f)
      save(boardId, next)
      return next
    })
  }, [boardId])

  const changeFrameType = useCallback((id: string, type: FrameworkType) => {
    const t = type === 'blank' ? 'eisenhower' : type
    setFrames(prev => {
      const { width, height } = DEFAULTS[t]
      const next = prev.map(f => f.id === id ? { ...f, type: t, width, height } : f)
      save(boardId, next)
      return next
    })
  }, [boardId])

  const renameFrame = useCallback((id: string, name: string) => {
    const trimmed = name.trim()
    setFrames(prev => {
      const next = prev.map(f =>
        f.id === id ? { ...f, name: trimmed || undefined } : f
      )
      save(boardId, next)
      return next
    })
  }, [boardId])

  const deleteFrame = useCallback((id: string) => {
    setFrames(prev => {
      const next = prev.filter(f => f.id !== id)
      save(boardId, next)
      return next
    })
  }, [boardId])

  return { frames, addFrame, moveFrame, commitFrameMove, setFrameSize, commitFrameResize, changeFrameType, renameFrame, deleteFrame }
}
