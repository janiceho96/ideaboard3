// src/lib/db.ts  — local storage database (no Supabase needed)
import type { Board, Card, CardInsert, GoalTag, GoalTagInsert } from '../types'

const BOARDS_KEY = 'ideaboard_boards'
const CARDS_KEY  = 'ideaboard_cards'
const TAGS_KEY   = 'ideaboard_goal_tags'

function load<T>(key: string): T[] {
  try { return JSON.parse(localStorage.getItem(key) ?? '[]') } catch { return [] }
}
function save<T>(key: string, data: T[]): void {
  localStorage.setItem(key, JSON.stringify(data))
}
function uid(): string { return crypto.randomUUID() }
function now(): string { return new Date().toISOString() }

// ── BOARDS ────────────────────────────────────────────────────

export async function fetchBoards(): Promise<Board[]> {
  return load<Board>(BOARDS_KEY).sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  )
}

export async function createBoard(name: string, userId: string): Promise<Board> {
  const board: Board = { id: uid(), name, owner_id: userId, created_at: now() }
  save(BOARDS_KEY, [...load<Board>(BOARDS_KEY), board])
  return board
}

export async function updateBoard(id: string, name: string): Promise<void> {
  save(BOARDS_KEY, load<Board>(BOARDS_KEY).map(b => b.id === id ? { ...b, name } : b))
}

export async function deleteBoard(id: string): Promise<void> {
  save(BOARDS_KEY, load<Board>(BOARDS_KEY).filter(b => b.id !== id))
  save(CARDS_KEY,  load<Card>(CARDS_KEY).filter(c => c.board_id !== id))
  save(TAGS_KEY,   load<GoalTag>(TAGS_KEY).filter(t => t.board_id !== id))
}

export async function getOrCreateDefaultBoard(userId: string): Promise<Board> {
  const boards = load<Board>(BOARDS_KEY)
  if (boards.length > 0) return boards[0]
  return createBoard('My First Board', userId)
}

// ── CARDS ─────────────────────────────────────────────────────

export async function fetchCards(boardId: string): Promise<Card[]> {
  return load<Card>(CARDS_KEY)
    .filter(c => c.board_id === boardId)
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    .map(c => normaliseCard(c as unknown as Record<string, unknown>))
}

export async function createCard(payload: CardInsert): Promise<Card> {
  const ts = now()
  const card: Card = { ...payload, id: uid(), created_at: ts, updated_at: ts }
  save(CARDS_KEY, [...load<Card>(CARDS_KEY), card])
  return normaliseCard(card as unknown as Record<string, unknown>)
}

export async function updateCard(id: string, changes: Partial<Card>): Promise<void> {
  save(CARDS_KEY, load<Card>(CARDS_KEY).map(c =>
    c.id === id ? { ...c, ...changes, updated_at: now() } : c
  ))
}

export async function deleteCard(id: string): Promise<void> {
  save(CARDS_KEY, load<Card>(CARDS_KEY).filter(c => c.id !== id))
}

// ── GOAL TAGS ─────────────────────────────────────────────────

export async function fetchGoalTags(boardId: string): Promise<GoalTag[]> {
  return load<GoalTag>(TAGS_KEY)
    .filter(t => t.board_id === boardId)
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
}

export async function createGoalTag(payload: GoalTagInsert): Promise<GoalTag> {
  const tag: GoalTag = { ...payload, id: uid(), created_at: now() }
  save(TAGS_KEY, [...load<GoalTag>(TAGS_KEY), tag])
  return tag
}

export async function moveGoalTag(id: string, x: number, y: number): Promise<void> {
  save(TAGS_KEY, load<GoalTag>(TAGS_KEY).map(t => t.id === id ? { ...t, x, y } : t))
}

export async function deleteGoalTag(id: string): Promise<void> {
  save(TAGS_KEY, load<GoalTag>(TAGS_KEY).filter(t => t.id !== id))
}

// ── HELPERS ───────────────────────────────────────────────────

export function normaliseCard(c: Record<string, unknown>): Card {
  return {
    ...c,
    card_width:  (c.card_width  as number)        ?? 185,
    card_height: (c.card_height as number | null) ?? null,
    due_date:    (c.due_date    as string | null)  ?? null,
    collapsed:   (c.collapsed   as boolean)        ?? false,
    locked:      (c.locked      as boolean)        ?? false,
  } as Card
}
