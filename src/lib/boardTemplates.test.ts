import { describe, expect, it } from 'vitest'
import { BOARD_TEMPLATES, buildBoardTemplatePayload } from './boardTemplates'

describe('board templates', () => {
  it('offers the requested starter boards', () => {
    expect(BOARD_TEMPLATES.map(t => t.name)).toEqual([
      'Weekly Plan',
      'Project Brainstorm',
      'Content Calendar',
      'Decision Matrix',
    ])
  })

  it('builds board-scoped starter content with ids', () => {
    let n = 0
    const payload = buildBoardTemplatePayload({
      templateId: 'weekly-plan',
      boardId: 'board-1',
      now: '2026-05-10T00:00:00.000Z',
      createId: () => `id-${++n}`,
    })

    expect(payload.cards.length).toBeGreaterThan(0)
    expect(payload.frames.length).toBeGreaterThan(0)
    expect(payload.textBlocks.length).toBeGreaterThan(0)
    expect(payload.cards.every(card => card.board_id === 'board-1')).toBe(true)
    expect(payload.goalTags.every(tag => tag.board_id === 'board-1')).toBe(true)
    expect(payload.textBlocks.every(block => block.board_id === 'board-1')).toBe(true)
  })
})
