import { describe, expect, it } from 'vitest'
import { buildWhiteboardExport } from './whiteboardExport'
import type { Board, Card, FrameInstance, GoalTag, SlideTile, TextBlock } from '../types'
import type { BoardSource } from './boardSourceStore'

describe('buildWhiteboardExport', () => {
  it('includes every whiteboard layer and uploaded slide images', () => {
    const board = { id: 'b1', name: 'Strategy', owner_id: 'u1', created_at: 'now' } as Board
    const cards = [{ id: 'c1', title: 'Card' } as Card]
    const goalTags = [{ id: 'g1', label: 'Goal' } as GoalTag]
    const frames = [{ id: 'f1', type: 'eisenhower' } as FrameInstance]
    const textBlocks = [{ id: 't1', html: '<b>Note</b>' } as TextBlock]
    const slides = [{ id: 's1', filename: 'deck.pdf' } as SlideTile]
    const sources = [{ id: 'src1', board_id: 'b1', kind: 'markdown', title: 'Brief.md', text: 'A brief', mime_type: 'text/markdown', created_at: 'now' }] satisfies BoardSource[]

    const exported = buildWhiteboardExport({
      board,
      cards,
      goalTags,
      frames,
      textBlocks,
      slides,
      slideImages: { s1: 'data:image/png;base64,abc' },
      sources,
      exportedAt: '2026-05-10T00:00:00.000Z',
    })

    expect(exported.schema).toBe('ideaboard.whiteboard')
    expect(exported.version).toBe(3)
    expect(exported.board).toBe(board)
    expect(exported.cards).toBe(cards)
    expect(exported.goalTags).toBe(goalTags)
    expect(exported.frames).toBe(frames)
    expect(exported.textBlocks).toBe(textBlocks)
    expect(exported.slides).toBe(slides)
    expect(exported.slideImages).toEqual({ s1: 'data:image/png;base64,abc' })
    expect(exported.sources).toBe(sources)
  })
})
