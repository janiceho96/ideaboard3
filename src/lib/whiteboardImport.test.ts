import { describe, expect, it } from 'vitest'
import { buildWhiteboardImport } from './whiteboardImport'
import type { Card, FrameInstance, GoalTag, SlideTile, TextBlock } from '../types'
import { createCustomFrameworkTemplate, frameworkTypeFor } from './customFrameworks'

describe('buildWhiteboardImport', () => {
  it('maps a full whiteboard backup into the target board with fresh ids', () => {
    let nextId = 0
    const createId = () => `new-${++nextId}`
    const imported = buildWhiteboardImport({
      data: {
        schema: 'ideaboard.whiteboard',
        version: 1,
        exportedAt: '2026-05-10T00:00:00.000Z',
        board: { id: 'old-board', name: 'Old', owner_id: 'u1', created_at: 'old' },
        cards: [{ id: 'old-card', board_id: 'old-board', title: 'Card' } as Card],
        goalTags: [{ id: 'old-tag', board_id: 'old-board', label: 'Tag' } as GoalTag],
        frames: [{ id: 'old-frame', type: 'eisenhower', x: 1, y: 2, width: 3, height: 4 } as FrameInstance],
        textBlocks: [{ id: 'old-text', board_id: 'old-board', html: '<b>Note</b>' } as TextBlock],
        slides: [{ id: 'old-slide', board_id: 'old-board', filename: 'deck.pdf' } as SlideTile],
        slideImages: { 'old-slide': 'data:image/png;base64,abc' },
        sources: [{ id: 'old-source', board_id: 'old-board', kind: 'pdf-page', title: 'deck.pdf', text: 'Page text', mime_type: 'application/pdf', slide_id: 'old-slide', page_number: 2, total_pages: 4, created_at: 'now' }],
      },
      targetBoardId: 'target-board',
      createId,
    })

    expect(imported.kind).toBe('whiteboard')
    expect(imported.cards).toMatchObject([{ board_id: 'target-board', title: 'Card' }])
    expect(imported.goalTags).toMatchObject([{ id: 'new-1', board_id: 'target-board', label: 'Tag' }])
    expect(imported.frames).toMatchObject([{ id: 'new-2', type: 'eisenhower' }])
    expect(imported.textBlocks).toMatchObject([{ id: 'new-3', board_id: 'target-board', html: '<b>Note</b>' }])
    expect(imported.slides).toMatchObject([{ id: 'new-4', board_id: 'target-board', filename: 'deck.pdf' }])
    expect(imported.slideImages).toEqual({ 'new-4': 'data:image/png;base64,abc' })
    expect(imported.sources).toMatchObject([{ id: 'new-5', board_id: 'target-board', kind: 'pdf-page', text: 'Page text', slide_id: 'new-4', page_number: 2 }])
  })

  it('keeps legacy card exports working', () => {
    const imported = buildWhiteboardImport({
      data: {
        cards: [{ id: 'old-card', board_id: 'old-board', title: 'Legacy card', tag: 'planned' } as Card],
      },
      targetBoardId: 'target-board',
      createId: () => 'unused',
    })

    expect(imported.kind).toBe('cards')
    expect(imported.cards).toMatchObject([
      { board_id: 'target-board', title: 'Legacy card', tag: 'planned' },
    ])
    expect(imported.frames).toEqual([])
    expect(imported.slides).toEqual([])
  })

  it('preserves custom framework definitions and existing writing during whiteboard import', () => {
    const customFramework = createCustomFrameworkTemplate({
      label: 'Research plan', purpose: 'Turn questions into a small research loop.', layout: 'flow',
      sections: [
        { label: 'Question', guidance: 'State what is unknown.' },
        { label: 'Evidence', guidance: 'Choose how to learn.' },
      ],
    }, () => 'research-id')
    const frame: FrameInstance = {
      id: 'source-frame', type: frameworkTypeFor(customFramework), customFramework,
      x: 24, y: 60, width: customFramework.defaultSize.width, height: customFramework.defaultSize.height,
      notes: 'Keep this context.', noteAreas: { question: 'Will people use it?' },
    }
    const imported = buildWhiteboardImport({
      data: {
        schema: 'ideaboard.whiteboard', version: 3, cards: [], frames: [frame],
        goalTags: [], textBlocks: [], slides: [], slideImages: {}, sources: [],
      },
      targetBoardId: 'new-board', createId: () => 'new-frame-id',
    })
    expect(imported.frames).toEqual([{ ...frame, id: 'new-frame-id' }])
  })
})
