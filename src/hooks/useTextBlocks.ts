import { useState, useCallback } from 'react'
import type { TextBlock } from '../types'

function storageKey(boardId: string): string {
  return `ideaboard_textblocks_${boardId}`
}

export function parseTextBlocks(raw: string | null): TextBlock[] {
  try {
    const parsed: unknown = JSON.parse(raw ?? '[]')
    return Array.isArray(parsed) ? (parsed as TextBlock[]) : []
  } catch {
    return []
  }
}

function saveBlocks(boardId: string, blocks: TextBlock[]): void {
  localStorage.setItem(storageKey(boardId), JSON.stringify(blocks))
}

export interface UseTextBlocksReturn {
  blocks: TextBlock[]
  addBlock: (block: TextBlock) => void
  addBlocks: (blocks: TextBlock[]) => void
  moveBlock: (id: string, x: number, y: number) => void
  commitBlockMove: (id: string, x: number, y: number) => void
  updateBlockHtml: (id: string, html: string) => void
  resizeBlock: (id: string, width: number) => void
  commitBlockResize: (id: string, width: number) => void
  removeBlock: (id: string) => void
}

export function useTextBlocks(boardId: string): UseTextBlocksReturn {
  const [blocks, setBlocks] = useState<TextBlock[]>(
    () => parseTextBlocks(localStorage.getItem(storageKey(boardId)))
  )

  const addBlock = useCallback((block: TextBlock) => {
    setBlocks(prev => {
      const next = [...prev, block]
      saveBlocks(boardId, next)
      return next
    })
  }, [boardId])
  const addBlocks = useCallback((newBlocks: TextBlock[]) => {
    if (!newBlocks.length) return
    setBlocks(prev => {
      const next = [...prev, ...newBlocks]
      saveBlocks(boardId, next)
      return next
    })
  }, [boardId])

  // Visual-only — no localStorage write
  const moveBlock = useCallback((id: string, x: number, y: number) => {
    setBlocks(prev => prev.map(b => b.id === id ? { ...b, x, y } : b))
  }, [])

  // Saves final position — call on mouseup
  const commitBlockMove = useCallback((id: string, x: number, y: number) => {
    setBlocks(prev => {
      const next = prev.map(b => b.id === id ? { ...b, x, y } : b)
      saveBlocks(boardId, next)
      return next
    })
  }, [boardId])

  // Saves immediately — called on contentEditable blur
  const updateBlockHtml = useCallback((id: string, html: string) => {
    setBlocks(prev => {
      const next = prev.map(b => b.id === id ? { ...b, html } : b)
      saveBlocks(boardId, next)
      return next
    })
  }, [boardId])

  // Visual-only width change during drag
  const resizeBlock = useCallback((id: string, width: number) => {
    setBlocks(prev => prev.map(b => b.id === id ? { ...b, width } : b))
  }, [])

  // Saves final width — call on mouseup
  const commitBlockResize = useCallback((id: string, width: number) => {
    setBlocks(prev => {
      const next = prev.map(b => b.id === id ? { ...b, width } : b)
      saveBlocks(boardId, next)
      return next
    })
  }, [boardId])

  const removeBlock = useCallback((id: string) => {
    setBlocks(prev => {
      const next = prev.filter(b => b.id !== id)
      saveBlocks(boardId, next)
      return next
    })
  }, [boardId])

  return { blocks, addBlock, addBlocks, moveBlock, commitBlockMove, updateBlockHtml, resizeBlock, commitBlockResize, removeBlock }
}
