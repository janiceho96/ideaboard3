// src/hooks/useSlides.ts
import { useState, useCallback } from 'react'
import type { SlideTile } from '../types'

function storageKey(boardId: string): string {
  return `ideaboard_slides_${boardId}`
}

export function parseSlideTiles(raw: string | null): SlideTile[] {
  try {
    const parsed: unknown = JSON.parse(raw ?? '[]')
    return Array.isArray(parsed) ? (parsed as SlideTile[]) : []
  } catch {
    return []
  }
}

function saveTiles(boardId: string, tiles: SlideTile[]): void {
  localStorage.setItem(storageKey(boardId), JSON.stringify(tiles))
}

export interface UseSlidesReturn {
  tiles: SlideTile[]
  addTiles: (newTiles: SlideTile[]) => void
  moveTile: (id: string, x: number, y: number) => void
  commitTileMove: (id: string, x: number, y: number) => void
  removeTile: (id: string) => void
}

export function useSlides(boardId: string): UseSlidesReturn {
  const [tiles, setTiles] = useState<SlideTile[]>(
    () => parseSlideTiles(localStorage.getItem(storageKey(boardId)))
  )

  const addTiles = useCallback((newTiles: SlideTile[]) => {
    setTiles(prev => {
      const next = [...prev, ...newTiles]
      saveTiles(boardId, next)
      return next
    })
  }, [boardId])

  // Visual update during drag — does NOT save to localStorage
  const moveTile = useCallback((id: string, x: number, y: number) => {
    setTiles(prev => prev.map(t => t.id === id ? { ...t, x, y } : t))
  }, [])

  // Saves final position to localStorage — call on mouse-up
  const commitTileMove = useCallback((id: string, x: number, y: number) => {
    setTiles(prev => {
      const next = prev.map(t => t.id === id ? { ...t, x, y } : t)
      saveTiles(boardId, next)
      return next
    })
  }, [boardId])

  const removeTile = useCallback((id: string) => {
    setTiles(prev => {
      const next = prev.filter(t => t.id !== id)
      saveTiles(boardId, next)
      return next
    })
  }, [boardId])

  return { tiles, addTiles, moveTile, commitTileMove, removeTile }
}
