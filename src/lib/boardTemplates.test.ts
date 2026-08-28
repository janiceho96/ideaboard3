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

  it('keeps each starter board visually and behaviorally distinct', () => {
    const frameTypes = BOARD_TEMPLATES.map(template =>
      buildBoardTemplatePayload({ templateId: template.id, boardId: 'board-1', createId: () => 'id' }).frames[0].type
    )

    expect(new Set(frameTypes).size).toBe(4)
    expect(buildBoardTemplatePayload({ templateId: 'project-brainstorm', boardId: 'board-1', createId: () => 'id' }).cards.map(card => card.title))
      .toEqual(expect.arrayContaining(['AI Prompt', 'Next Experiment']))
    expect(buildBoardTemplatePayload({ templateId: 'content-calendar', boardId: 'board-1', createId: () => 'id' }).cards.map(card => card.title))
      .toEqual(expect.arrayContaining(['Review Queue', 'Published Assets']))
  })
})
