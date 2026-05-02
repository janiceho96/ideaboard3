// src/hooks/useBoard.ts
import { useState, useEffect, useCallback, useRef } from 'react'
import type { Card, CardInsert, GoalTag, TagType } from '../types'
import * as db from '../lib/db'

interface UseBoardReturn {
  cards: Card[]
  goalTags: GoalTag[]
  boardId: string | null
  boardName: string
  loading: boolean
  error: string | null
  addCard: (title: string, body: string, dateLabel: string, dueDate: string | null, tag: TagType, bg: string, worldX: number, worldY: number) => Promise<void>
  updateCard: (id: string, changes: Partial<Card>) => Promise<void>
  moveCard: (id: string, x: number, y: number) => void
  commitCardMove: (id: string, x: number, y: number) => Promise<void>
  resizeCard: (id: string, w: number, h: number | null) => void
  commitCardResize: (id: string, w: number, h: number | null) => Promise<void>
  removeCard: (id: string) => Promise<void>
  duplicateCard: (id: string) => Promise<void>
  bulkImportCards: (inserts: CardInsert[]) => Promise<void>
  moveGoalTag: (id: string, x: number, y: number) => void
  commitGoalTagMove: (id: string, x: number, y: number) => Promise<void>
  removeGoalTag: (id: string) => Promise<void>
  undo: () => void
  canUndo: boolean
}

export function useBoard(boardId: string | null): UseBoardReturn {
  const [cards, setCards] = useState<Card[]>([])
  const [goalTags, setGoalTags] = useState<GoalTag[]>([])
  const [activeBoardId, setActiveBoardId] = useState<string | null>(boardId)
  const [boardName, setBoardName] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const historyRef = useRef<Array<{ cards: Card[]; goalTags: GoalTag[] }>>([])
  const [canUndo, setCanUndo] = useState(false)

  useEffect(() => {
    if (!boardId) return
    setActiveBoardId(boardId)
    setLoading(true)
    async function load() {
      try {
        const [fetchedCards, fetchedTags] = await Promise.all([
          db.fetchCards(boardId!),
          db.fetchGoalTags(boardId!),
        ])
        setCards(fetchedCards)
        setGoalTags(fetchedTags)
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [boardId])

  const pushHistory = useCallback((c: Card[], t: GoalTag[]) => {
    historyRef.current = [...historyRef.current.slice(-29), { cards: JSON.parse(JSON.stringify(c)), goalTags: JSON.parse(JSON.stringify(t)) }]
    setCanUndo(true)
  }, [])

  const undo = useCallback(() => {
    if (!historyRef.current.length) return
    const prev = historyRef.current[historyRef.current.length - 1]
    historyRef.current = historyRef.current.slice(0, -1)
    setCanUndo(historyRef.current.length > 0)
    setCards(prev.cards)
    setGoalTags(prev.goalTags)
  }, [])

  const addCard = useCallback(async (
    title: string, body: string, dateLabel: string, dueDate: string | null,
    tag: TagType, bg: string, worldX: number, worldY: number
  ) => {
    if (!activeBoardId) return
    setCards(prev => { pushHistory(prev, goalTags); return prev })
    const newCard = await db.createCard({
      board_id: activeBoardId, title, body,
      date_label: dateLabel, due_date: dueDate, tag, bg,
      x: worldX, y: worldY,
      rotation: (Math.random() - 0.5) * 3,
      card_width: 185, card_height: null,
      collapsed: false, locked: false,
    })
    setCards(prev => [...prev, newCard])
  }, [activeBoardId, goalTags, pushHistory])

  const updateCard = useCallback(async (id: string, changes: Partial<Card>) => {
    setCards(prev => { pushHistory(prev, goalTags); return prev.map(c => c.id === id ? { ...c, ...changes } : c) })
    await db.updateCard(id, changes)
  }, [goalTags, pushHistory])

  const moveCard = useCallback((id: string, x: number, y: number) => {
    setCards(prev => prev.map(c => c.id === id ? { ...c, x, y } : c))
  }, [])

  const commitCardMove = useCallback(async (id: string, x: number, y: number) => {
    await db.updateCard(id, { x, y })
  }, [])

  const resizeCard = useCallback((id: string, w: number, h: number | null) => {
    setCards(prev => prev.map(c => c.id === id ? { ...c, card_width: w, card_height: h } : c))
  }, [])

  const commitCardResize = useCallback(async (id: string, w: number, h: number | null) => {
    await db.updateCard(id, { card_width: w, card_height: h })
  }, [])

  const removeCard = useCallback(async (id: string) => {
    setCards(prev => { pushHistory(prev, goalTags); return prev.filter(c => c.id !== id) })
    await db.deleteCard(id)
  }, [goalTags, pushHistory])

  const duplicateCard = useCallback(async (id: string) => {
    const original = cards.find(c => c.id === id)
    if (!original || !activeBoardId) return
    setCards(prev => { pushHistory(prev, goalTags); return prev })
    const newCard = await db.createCard({
      board_id: activeBoardId,
      title: original.title,
      body: original.body,
      date_label: original.date_label,
      due_date: original.due_date,
      tag: original.tag,
      bg: original.bg,
      x: original.x + 20,
      y: original.y + 20,
      rotation: (Math.random() - 0.5) * 3,
      card_width: original.card_width,
      card_height: original.card_height,
      collapsed: false,
      locked: false,
    })
    setCards(prev => [...prev, newCard])
  }, [activeBoardId, cards, goalTags, pushHistory])

  const bulkImportCards = useCallback(async (inserts: CardInsert[]) => {
    if (!activeBoardId) return
    setCards(prev => { pushHistory(prev, goalTags); return prev })
    const newCards = await Promise.all(inserts.map(insert => db.createCard(insert)))
    setCards(prev => [...prev, ...newCards])
  }, [activeBoardId, goalTags, pushHistory])

  const moveGoalTag = useCallback((id: string, x: number, y: number) => {
    setGoalTags(prev => prev.map(t => t.id === id ? { ...t, x, y } : t))
  }, [])

  const commitGoalTagMove = useCallback(async (id: string, x: number, y: number) => {
    await db.moveGoalTag(id, x, y)
  }, [])

  const removeGoalTag = useCallback(async (id: string) => {
    setGoalTags(prev => { pushHistory(cards, prev); return prev.filter(t => t.id !== id) })
    await db.deleteGoalTag(id)
  }, [cards, pushHistory])

  return {
    cards, goalTags,
    boardId: activeBoardId, boardName, loading, error,
    addCard, updateCard, moveCard, commitCardMove,
    resizeCard, commitCardResize, removeCard, duplicateCard,
    bulkImportCards,
    moveGoalTag, commitGoalTagMove, removeGoalTag,
    undo, canUndo,
  }
}
