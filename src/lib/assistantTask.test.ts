import { describe, expect, it } from 'vitest'
import type { Card, FrameInstance } from '../types'
import { applyAssistantTask, readAssistantTask, savedAssistantSnapshot, undoAssistantTask, type AssistantOperations, type AssistantTask, type TaskStorage } from './assistantTask'

const originalCard: Card = { id: 'original', board_id: 'board', title: 'Original', body: 'Original body', date_label: '', due_date: null, tag: 'idea', bg: 'white', x: 0, y: 0, rotation: 0, card_width: 185, card_height: null, collapsed: false, locked: false, created_at: '1', updated_at: '1' }
const originalFrame: FrameInstance = { id: 'existing-frame', type: 'swot', x: 0, y: 0, width: 640, height: 540, noteAreas: { 'top-left': 'Original section' } }
function task(): AssistantTask {
  return { version: 1, id: 'task', boardId: 'board', status: 'applying', createdAt: '1', effects: {
    frames: [{ id: 'generated-frame', type: 'swot', x: 800, y: 0, width: 640, height: 540, noteAreas: { 'top-left': 'Draft' } }],
    cards: [{ board_id: 'board', title: 'Generated', body: 'Draft', tag: 'idea', date_label: 'AI draft', due_date: null, bg: 'white', x: 800, y: 700, rotation: 0, card_width: 310, card_height: null, collapsed: false, locked: false, ai_task_id: 'task', ai_source_ids: ['original'], ai_assisted: true }],
    sections: [{ frameId: originalFrame.id, storageKey: 'top-left', before: 'Original section', after: 'Revised section' }],
    revisions: [{ cardId: originalCard.id, beforeTitle: 'Original', beforeBody: 'Original body', afterTitle: 'Revised', afterBody: 'Revised body' }],
  } }
}

function fixture(failAt?: number) {
  const values = new Map<string, string>([
    ['ideaboard_cards', JSON.stringify([originalCard, { ...originalCard, id: 'other-card', board_id: 'other' }])],
    ['ideaboard_frames_board', JSON.stringify([originalFrame])],
  ])
  let writes = 0
  const storage: TaskStorage = {
    getItem: k => values.get(k) ?? null,
    setItem: (k, v) => { if (++writes === failAt) throw new Error('Simulated interrupted storage write'); values.set(k, v) },
    removeItem: k => { values.delete(k) },
  }
  const cards = () => JSON.parse(values.get('ideaboard_cards')!) as Card[]
  const frames = () => JSON.parse(values.get('ideaboard_frames_board')!) as FrameInstance[]
  const ops: AssistantOperations = {
    getSnapshot: () => savedAssistantSnapshot('board', storage),
    importFrames: drafts => storage.setItem('ideaboard_frames_board', JSON.stringify([...frames(), ...drafts])),
    writeSection: (id, key, text) => storage.setItem('ideaboard_frames_board', JSON.stringify(frames().map(f => f.id === id ? { ...f, noteAreas: { ...f.noteAreas, [key]: text } } : f))),
    deleteFrame: id => storage.setItem('ideaboard_frames_board', JSON.stringify(frames().filter(f => f.id !== id))),
    addCards: async drafts => { for (const [i, draft] of drafts.entries()) storage.setItem('ideaboard_cards', JSON.stringify([...cards(), { ...draft, id: draft.ai_task_id === 'task' ? `generated-${i}` : `generated-${draft.ai_task_id}-${i}`, created_at: '2', updated_at: '2' }])) },
    updateCard: async (id, change) => storage.setItem('ideaboard_cards', JSON.stringify(cards().map(c => c.id === id ? { ...c, ...change, updated_at: '3' } : c))),
    deleteCard: async id => storage.setItem('ideaboard_cards', JSON.stringify(cards().filter(c => c.id !== id))),
  }
  return { storage, ops, values }
}

describe('assistant durable task recovery', () => {
  it('keeps source references on revised notes and restores prior metadata on Undo', async () => {
    const { storage, ops } = fixture()
    const revisionTask = task()
    revisionTask.effects.revisions[0] = { ...revisionTask.effects.revisions[0], afterSourceIds: ['source-brief'], afterAiAssisted: true }
    const complete = await applyAssistantTask(revisionTask, ops, storage, () => {})
    expect(ops.getSnapshot().cards.find(card => card.id === originalCard.id)).toMatchObject({ ai_source_ids: ['source-brief'], ai_assisted: true })
    await undoAssistantTask(complete, ops, storage)
    const restored = ops.getSnapshot().cards.find(card => card.id === originalCard.id)
    expect(restored?.title).toBe('Original')
    expect(restored?.ai_source_ids).toBeUndefined()
  })
  it('applies and undoes assistant note styling and canvas writes', async () => {
    const { storage, ops } = fixture()
    const writeTask = task()
    writeTask.effects.frames = []
    writeTask.effects.cards = []
    writeTask.effects.sections = []
    writeTask.effects.revisions = []
    writeTask.effects.cardWrites = [{ cardId: originalCard.id, before: { tag: 'idea', x: 0 }, after: { tag: 'critical', x: 240 } }]
    const complete = await applyAssistantTask(writeTask, ops, storage, () => {})
    expect(ops.getSnapshot().cards.find(card => card.id === originalCard.id)).toMatchObject({ tag: 'critical', x: 240 })
    await undoAssistantTask(complete, ops, storage)
    expect(ops.getSnapshot().cards.find(card => card.id === originalCard.id)).toMatchObject({ tag: 'idea', x: 0 })
  })
  it('does not undo an assistant note write over a later edit or lock', async () => {
    const { storage, ops, values } = fixture()
    const writeTask = task()
    writeTask.effects.frames = []
    writeTask.effects.cards = []
    writeTask.effects.sections = []
    writeTask.effects.revisions = []
    writeTask.effects.cardWrites = [{ cardId: originalCard.id, before: { tag: 'idea' }, after: { tag: 'critical' } }]
    const complete = await applyAssistantTask(writeTask, ops, storage, () => {})
    const cards = JSON.parse(values.get('ideaboard_cards')!) as Card[]
    values.set('ideaboard_cards', JSON.stringify(cards.map(card => card.id === originalCard.id ? { ...card, locked: true } : card)))
    const beforeUndo = values.get('ideaboard_cards')
    await expect(undoAssistantTask(complete, ops, storage)).rejects.toThrow('changed after the assistant updated it')
    expect(values.get('ideaboard_cards')).toBe(beforeUndo)
  })
  it('saves and undoes a multi-store task as one action without touching another board', async () => {
    const { storage, ops, values } = fixture()
    const result = await applyAssistantTask(task(), ops, storage, () => {})
    expect(result.status).toBe('complete')
    expect(readAssistantTask('board', storage)?.status).toBe('complete')
    expect(ops.getSnapshot().cards).toHaveLength(2)
    await undoAssistantTask(result, ops, storage)
    expect(ops.getSnapshot().cards.map(c => ({ id: c.id, title: c.title, body: c.body }))).toEqual([{ id: 'original', title: 'Original', body: 'Original body' }])
    expect(ops.getSnapshot().frames).toEqual([originalFrame])
    expect(readAssistantTask('board', storage)).toBeNull()
    expect(JSON.parse(values.get('ideaboard_cards')!).find((c: Card) => c.id === 'other-card').board_id).toBe('other')
  })
  it.each([1, 2, 3, 4, 5, 6, 7])('recovers interruption at store write boundary %i', async boundary => {
    const { storage, ops } = fixture(boundary)
    await expect(applyAssistantTask(task(), ops, storage, () => {})).rejects.toThrow('interrupted')
    const saved = readAssistantTask('board', storage)
    if (saved) await undoAssistantTask(saved, ops, storage)
    expect(ops.getSnapshot().frames).toEqual([originalFrame])
    expect(ops.getSnapshot().cards).toHaveLength(1)
    expect(ops.getSnapshot().cards[0].body).toBe('Original body')
    expect(readAssistantTask('board', storage)).toBeNull()
  })
  it('refuses duplicate apply and prevents a cancelled task from writing content', async () => {
    const { storage, ops } = fixture()
    const controller = new AbortController(); controller.abort()
    await expect(applyAssistantTask(task(), ops, storage, () => {}, controller.signal)).rejects.toThrow('stopped')
    expect(ops.getSnapshot().frames).toEqual([originalFrame])
    await undoAssistantTask(readAssistantTask('board', storage)!, ops, storage)
    await applyAssistantTask(task(), ops, storage, () => {})
    await expect(applyAssistantTask(task(), ops, storage, () => {})).rejects.toThrow('already applied')
  })
  it('allows a follow-up task and keeps its own conflict-aware undo', async () => {
    const { storage, ops } = fixture()
    await applyAssistantTask(task(), ops, storage, () => {})
    const firstFrames = ops.getSnapshot().frames
    const next = task()
    next.id = 'task-next'
    next.effects.frames[0].id = 'generated-frame-next'
    next.effects.cards[0].ai_task_id = 'task-next'
    next.effects.cards[0].title = 'Generated follow-up'
    next.effects.sections[0] = { frameId: originalFrame.id, storageKey: 'top-left', before: 'Revised section', after: 'Follow-up section' }
    next.effects.revisions[0] = { cardId: originalCard.id, beforeTitle: 'Revised', beforeBody: 'Revised body', afterTitle: 'Follow-up', afterBody: 'Follow-up body' }

    const latest = await applyAssistantTask(next, ops, storage, () => {})
    expect(readAssistantTask('board', storage)?.id).toBe('task-next')
    expect(ops.getSnapshot().frames).toHaveLength(3)
    expect(ops.getSnapshot().cards.map(card => card.title)).toContain('Generated follow-up')

    await undoAssistantTask(latest, ops, storage)
    expect(ops.getSnapshot().frames).toEqual(firstFrames)
    expect(ops.getSnapshot().cards.find(card => card.id === originalCard.id)).toMatchObject({ title: 'Revised', body: 'Revised body' })
    expect(ops.getSnapshot().cards.map(card => card.title)).not.toContain('Generated follow-up')
  })
  it('preserves the previous Undo record if the next task journal cannot be written', async () => {
    const { storage, ops } = fixture(8)
    const first = await applyAssistantTask(task(), ops, storage, () => {})
    const next = task()
    next.id = 'task-next'
    await expect(applyAssistantTask(next, ops, storage, () => {})).rejects.toThrow('interrupted')
    expect(readAssistantTask('board', storage)).toMatchObject({ id: first.id, status: 'complete' })
  })
  it.each(['note', 'lock', 'frame', 'section', 'revision'])('refuses to discard later %s edits before any rollback write', async changed => {
    const { storage, ops, values } = fixture()
    const complete = await applyAssistantTask(task(), ops, storage, () => {})
    if (changed === 'note' || changed === 'lock' || changed === 'revision') {
      const cards = JSON.parse(values.get('ideaboard_cards')!) as Card[]
      values.set('ideaboard_cards', JSON.stringify(cards.map(c => c.id === (changed === 'revision' ? 'original' : 'generated-0') ? { ...c, ...(changed === 'lock' ? { locked: true } : { body: 'User edit' }) } : c)))
    } else {
      const frames = ops.getSnapshot().frames
      values.set('ideaboard_frames_board', JSON.stringify(frames.map(f => f.id === (changed === 'section' ? originalFrame.id : 'generated-frame') ? { ...f, noteAreas: { 'top-left': 'User edit' } } : f)))
    }
    const before = Object.fromEntries(values)
    await expect(undoAssistantTask(complete, ops, storage)).rejects.toThrow()
    expect(Object.fromEntries(values)).toEqual(before)
  })
  it('retries an interrupted rollback idempotently', async () => {
    const { storage, ops } = fixture(9) // apply has seven writes; rollback fails at its first card removal
    const complete = await applyAssistantTask(task(), ops, storage, () => {})
    await expect(undoAssistantTask(complete, ops, storage)).rejects.toThrow('interrupted')
    await undoAssistantTask(readAssistantTask('board', storage)!, ops, storage)
    expect(ops.getSnapshot().frames).toEqual([originalFrame])
    expect(ops.getSnapshot().cards).toHaveLength(1)
    expect(ops.getSnapshot().cards[0].body).toBe('Original body')
  })
  it('rejects corrupt recovery records and board ownership changes', async () => {
    const { storage, ops, values } = fixture()
    values.set('ideaboard_assistant_task_board', '{broken')
    expect(() => readAssistantTask('board', storage)).toThrow('cannot be read')
    values.delete('ideaboard_assistant_task_board')
    await expect(applyAssistantTask({ ...task(), boardId: 'other' }, ops, storage, () => {})).rejects.toThrow('different board')
  })
})
