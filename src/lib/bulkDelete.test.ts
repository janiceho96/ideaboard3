import { describe, expect, it } from 'vitest'
import { buildBulkDeleteItems } from './bulkDelete'
import type { Card, FrameInstance, GoalTag, SlideTile, TextBlock } from '../types'

describe('buildBulkDeleteItems', () => {
  it('creates readable entries for cards, slides, text blocks, frames, and tags', () => {
    const items = buildBulkDeleteItems({
      cards: [{ id: 'c1', title: 'Launch plan' } as Card],
      slides: [{
        id: 's1',
        filename: 'deck.pdf',
        page_number: 3,
        total_pages: 8,
      } as SlideTile],
      textBlocks: [{ id: 't1', html: '<b>Notes</b> for sprint' } as TextBlock],
      frames: [{ id: 'f1', type: 'eisenhower', name: 'Priorities' } as FrameInstance],
      tags: [{ id: 'g1', label: 'Done' } as GoalTag],
      frameLabel: type => `Frame: ${type}`,
    })

    expect(items.map(item => item.label)).toEqual([
      'Launch plan',
      'deck.pdf - slide 3 of 8',
      'Notes for sprint',
      'Priorities',
      'Done',
    ])
  })

  it('falls back to useful labels for empty content', () => {
    const items = buildBulkDeleteItems({
      cards: [{ id: 'c1', title: '' } as Card],
      slides: [],
      textBlocks: [{ id: 't1', html: '' } as TextBlock],
      frames: [{ id: 'f1', type: 'blank' } as FrameInstance],
      tags: [],
      frameLabel: type => `Frame: ${type}`,
    })

    expect(items.map(item => item.label)).toEqual(['Untitled card', 'Empty text block', 'Frame: blank'])
  })
})
