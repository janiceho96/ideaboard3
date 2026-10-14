import type { Card, FrameInstance } from '../types'
import type { AssistantEffects } from './assistantPlan'

export interface AssistantSnapshot { boardId: string; cards: Card[]; frames: FrameInstance[] }
export interface AssistantTask {
  version: 1
  id: string
  boardId: string
  status: 'applying' | 'complete' | 'recovering'
  effects: AssistantEffects
  createdAt: string
}
export interface AssistantOperations {
  getSnapshot: () => AssistantSnapshot
  importFrames: (frames: FrameInstance[]) => void
  writeSection: (frameId: string, key: string, text: string) => void
  deleteFrame: (id: string) => void
  addCards: (cards: AssistantEffects['cards']) => Promise<void>
  updateCard: (id: string, changes: Partial<Card>) => Promise<void>
  deleteCard: (id: string) => Promise<void>
}
export interface TaskStorage { getItem: (key: string) => string | null; setItem: (key: string, value: string) => void; removeItem: (key: string) => void }

const key = (boardId: string) => `ideaboard_assistant_task_${boardId}`
const preflightKey = (boardId: string) => `ideaboard_assistant_capacity_${boardId}`

export function readAssistantTask(boardId: string, storage: TaskStorage): AssistantTask | null {
  // A process interrupted between the capacity probe and its removal may leave
  // reserved space. It contains only padding and is safe to release on recovery.
  if (storage.getItem(preflightKey(boardId)) !== null) storage.removeItem(preflightKey(boardId))
  const raw = storage.getItem(key(boardId))
  if (!raw) return null
  try {
    const t = JSON.parse(raw) as AssistantTask
    if (t.version !== 1 || t.boardId !== boardId || typeof t.id !== 'string' || !['applying', 'complete', 'recovering'].includes(t.status) || !Array.isArray(t.effects.frames) || !Array.isArray(t.effects.cards) || !Array.isArray(t.effects.sections) || !Array.isArray(t.effects.revisions) || (t.effects.cardWrites !== undefined && !Array.isArray(t.effects.cardWrites))) throw new Error()
    return t
  } catch { throw new Error('The assistant recovery record cannot be read. Export a workspace backup before clearing browser storage.') }
}
export function keepAssistantTask(boardId: string, storage: TaskStorage) { storage.removeItem(key(boardId)) }

// Read persisted state, rather than optimistic hook state, to verify write completion
// and find any cards saved before an interrupted bulk import returned.
export function savedAssistantSnapshot(boardId: string, storage: TaskStorage): AssistantSnapshot {
  const cards = JSON.parse(storage.getItem('ideaboard_cards') ?? '[]') as Card[]
  const frames = JSON.parse(storage.getItem(`ideaboard_frames_${boardId}`) ?? '[]') as FrameInstance[]
  if (!Array.isArray(cards) || !Array.isArray(frames)) throw new Error('Saved board data cannot be read.')
  return { boardId, cards: cards.filter(c => c.board_id === boardId), frames }
}

function assertBoard(task: AssistantTask, snapshot: AssistantSnapshot) {
  if (task.boardId !== snapshot.boardId) throw new Error('The task belongs to a different board.')
}
function generatedCards(task: AssistantTask, snapshot: AssistantSnapshot) {
  return snapshot.cards.filter(c => (c as Card & { ai_task_id?: string }).ai_task_id === task.id)
}
function sameCardContent(card: Card, draft: AssistantEffects['cards'][number]) {
  return Object.entries(draft).every(([k, v]) => JSON.stringify((card as unknown as Record<string, unknown>)[k]) === JSON.stringify(v))
}
function matchesCardFields(card: Card | undefined, fields: Partial<Card>) {
  return !!card && Object.entries(fields).every(([key, value]) => JSON.stringify((card as unknown as Record<string, unknown>)[key]) === JSON.stringify(value))
}

export async function applyAssistantTask(task: AssistantTask, ops: AssistantOperations, storage: TaskStorage, onProgress: (message: string) => void, signal?: AbortSignal): Promise<AssistantTask> {
  assertBoard(task, ops.getSnapshot())
  const previousTask = readAssistantTask(task.boardId, storage)
  if (previousTask && previousTask.status !== 'complete') throw new Error('Recover the interrupted assistant task before starting another.')
  if (previousTask?.id === task.id) throw new Error('This assistant task was already applied.')
  // Replacing a completed journal is atomic, so its Undo remains available if
  // writing the new task record fails.
  storage.setItem(key(task.boardId), JSON.stringify(task))
  // Existing frame hooks save during React state updates. Check quota before
  // entering those callbacks so a normal storage-capacity failure is caught here.
  const oldCards = storage.getItem('ideaboard_cards') ?? '[]'
  const oldFrames = storage.getItem(`ideaboard_frames_${task.boardId}`) ?? '[]'
  const afterFrames = [...ops.getSnapshot().frames, ...task.effects.frames].map(f => {
    const writes = task.effects.sections.filter(w => w.frameId === f.id)
    return writes.length ? { ...f, noteAreas: { ...f.noteAreas, ...Object.fromEntries(writes.map(w => [w.storageKey, w.after])) } } : f
  })
  const afterCards = (JSON.parse(oldCards) as Card[]).map(c => {
    const write = task.effects.revisions.find(w => w.cardId === c.id)
    const revision = write ? { ...c, title: write.afterTitle, body: write.afterBody } : c
    const cardWrite = task.effects.cardWrites?.find(w => w.cardId === c.id)
    return cardWrite ? { ...revision, ...cardWrite.after } : revision
  })
  const growth = Math.max(0, JSON.stringify(afterFrames).length - oldFrames.length)
    + Math.max(0, JSON.stringify([...afterCards, ...task.effects.cards]).length + task.effects.cards.length * 256 - oldCards.length) + 1024
  try { storage.setItem(preflightKey(task.boardId), ' '.repeat(growth)) }
  finally { storage.removeItem(preflightKey(task.boardId)) }
  const check = () => { assertBoard(task, ops.getSnapshot()); if (signal?.aborted) throw new Error('Task stopped. Use Undo task to recover any saved drafts.') }
  check()
  onProgress('Creating draft frameworks…')
  if (task.effects.frames.length) ops.importFrames(task.effects.frames)
  for (const write of task.effects.sections) { check(); ops.writeSection(write.frameId, write.storageKey, write.after) }
  check()
  onProgress('Saving related notes…')
  if (task.effects.cards.length) await ops.addCards(task.effects.cards)
  for (const revision of task.effects.revisions) {
    check()
    const changes: Pick<Card, 'title' | 'body'> & Partial<Pick<Card, 'ai_source_ids' | 'ai_assisted'>> = { title: revision.afterTitle, body: revision.afterBody }
    if (revision.afterSourceIds !== undefined) { changes.ai_source_ids = revision.afterSourceIds; changes.ai_assisted = revision.afterAiAssisted }
    await ops.updateCard(revision.cardId, changes)
  }
  for (const write of task.effects.cardWrites ?? []) {
    check()
    await ops.updateCard(write.cardId, write.after)
  }
  check()
  const saved = savedAssistantSnapshot(task.boardId, storage)
  if (task.effects.frames.some(f => !saved.frames.some(now => JSON.stringify(now) === JSON.stringify(f))) || generatedCards(task, saved).length !== task.effects.cards.length || task.effects.sections.some(w => saved.frames.find(f => f.id === w.frameId)?.noteAreas?.[w.storageKey] !== w.after) || task.effects.revisions.some(w => { const c = saved.cards.find(c => c.id === w.cardId); return c?.title !== w.afterTitle || c.body !== w.afterBody || (w.afterSourceIds !== undefined && JSON.stringify(c.ai_source_ids ?? []) !== JSON.stringify(w.afterSourceIds)) }) || (task.effects.cardWrites ?? []).some(w => !matchesCardFields(saved.cards.find(c => c.id === w.cardId), w.after))) throw new Error('Some drafts could not be saved. The task recovery record is retained; use Undo task before trying again.')
  const complete: AssistantTask = { ...task, status: 'complete' }
  storage.setItem(key(task.boardId), JSON.stringify(complete))
  onProgress('Drafts saved. Ready to edit.')
  return complete
}

/** Idempotent rollback: remove only this task's drafts and restore only values that
 * still match its writes. Later user edits/locks cause a conflict before any write. */
export async function undoAssistantTask(task: AssistantTask, ops: AssistantOperations, storage: TaskStorage) {
  const snapshot = savedAssistantSnapshot(task.boardId, storage)
  const live = ops.getSnapshot()
  assertBoard(task, live)
  if (!storage.getItem(`ideaboard_frames_${task.boardId}`)) snapshot.frames = live.frames
  const created = generatedCards(task, snapshot)
  for (const card of created) {
    if (card.locked || !task.effects.cards.some(draft => sameCardContent(card, draft))) throw new Error('A generated note was edited or locked. Keep this task to preserve your edits; automatic Undo is unavailable.')
  }
  for (const expected of task.effects.frames) {
    const current = snapshot.frames.find(f => f.id === expected.id)
    if (current && JSON.stringify(current) !== JSON.stringify(expected)) throw new Error('A generated framework was edited. Keep this task to preserve your changes.')
  }
  for (const write of task.effects.sections) {
    const frame = snapshot.frames.find(f => f.id === write.frameId)
    const value = frame?.noteAreas?.[write.storageKey] ?? (write.semanticId ? frame?.noteAreas?.[write.semanticId] : undefined) ?? ''
    if (!frame || (value !== write.before && value !== write.after)) throw new Error('A section changed after the assistant wrote it. Keep this task to preserve the newer writing.')
  }
  for (const write of task.effects.revisions) {
    const card = snapshot.cards.find(c => c.id === write.cardId)
    const matchesAfter = card?.title === write.afterTitle && card.body === write.afterBody && (write.afterSourceIds === undefined || JSON.stringify(card.ai_source_ids ?? []) === JSON.stringify(write.afterSourceIds))
    const matchesBefore = card?.title === write.beforeTitle && card.body === write.beforeBody && (write.afterSourceIds === undefined || (write.beforeSourceIds === undefined ? card.ai_source_ids === undefined : JSON.stringify(card.ai_source_ids ?? []) === JSON.stringify(write.beforeSourceIds)))
    if (!card || card.locked || !(matchesAfter || matchesBefore)) throw new Error('The revised note changed or was locked. Keep this task to preserve the newer writing.')
  }
  for (const write of task.effects.cardWrites ?? []) {
    const card = snapshot.cards.find(c => c.id === write.cardId)
    if (!card || (card.locked && write.after.locked !== true) || !(matchesCardFields(card, write.after) || matchesCardFields(card, write.before))) throw new Error('A note changed after the assistant updated it. Keep this task to preserve the newer writing.')
  }
  storage.setItem(key(task.boardId), JSON.stringify({ ...task, status: 'recovering' }))
  for (const card of created) await ops.deleteCard(card.id)
  for (const frame of task.effects.frames) ops.deleteFrame(frame.id)
  for (const write of task.effects.sections) ops.writeSection(write.frameId, write.storageKey, write.before)
  for (const write of task.effects.revisions) {
    const changes: Pick<Card, 'title' | 'body'> & Partial<Pick<Card, 'ai_source_ids' | 'ai_assisted'>> = { title: write.beforeTitle, body: write.beforeBody }
    if (write.afterSourceIds !== undefined) { changes.ai_source_ids = write.beforeSourceIds; changes.ai_assisted = write.beforeAiAssisted }
    await ops.updateCard(write.cardId, changes)
  }
  for (const write of [...(task.effects.cardWrites ?? [])].reverse()) await ops.updateCard(write.cardId, write.before)
  const after = savedAssistantSnapshot(task.boardId, storage)
  if (generatedCards(task, after).length || task.effects.frames.some(f => after.frames.some(now => now.id === f.id)) || task.effects.sections.some(w => (after.frames.find(f => f.id === w.frameId)?.noteAreas?.[w.storageKey] ?? '') !== w.before) || task.effects.revisions.some(w => { const c = after.cards.find(c => c.id === w.cardId); return c?.title !== w.beforeTitle || c.body !== w.beforeBody || (w.afterSourceIds !== undefined && (w.beforeSourceIds === undefined ? c.ai_source_ids !== undefined : JSON.stringify(c.ai_source_ids ?? []) !== JSON.stringify(w.beforeSourceIds))) }) || (task.effects.cardWrites ?? []).some(w => !matchesCardFields(after.cards.find(c => c.id === w.cardId), w.before))) throw new Error('Recovery is incomplete. The task record was kept; retry Undo task.')
  keepAssistantTask(task.boardId, storage)
}
