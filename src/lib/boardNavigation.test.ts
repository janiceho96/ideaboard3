import { describe, expect, it } from 'vitest'
import { buildBoardNavigationItems, filterCardsForBoard } from './boardNavigation'
import type { Card, FrameInstance, GoalTag, SlideTile, TextBlock } from '../types'

describe('filterCardsForBoard', () => {
  const cards = [
    { id: 'c1', title: 'Launch plan', body: 'Draft the offer', tag: 'planned', due_date: '2026-05-12' },
    { id: 'c2', title: 'Cleanup', body: 'Archive old notes', tag: 'done', due_date: '2026-05-01' },
    { id: 'c3', title: 'Delete this', body: 'No longer useful', tag: 'remove', due_date: null },
  ] as Card[]

  it('searches title, body, tag, and due date', () => {
    expect(filterCardsForBoard(cards, { query: 'offer', hideDoneRemove: false, overdueOnly: false }).map(c => c.id)).toEqual(['c1'])
    expect(filterCardsForBoard(cards, { query: 'planned', hideDoneRemove: false, overdueOnly: false }).map(c => c.id)).toEqual(['c1'])
    expect(filterCardsForBoard(cards, { query: '2026-05-12', hideDoneRemove: false, overdueOnly: false }).map(c => c.id)).toEqual(['c1'])
  })

  it('hides done and remove cards', () => {
    expect(filterCardsForBoard(cards, { query: '', hideDoneRemove: true, overdueOnly: false }).map(c => c.id)).toEqual(['c1'])
  })

  it('shows overdue cards only', () => {
    expect(filterCardsForBoard(cards, {
      query: '',
      hideDoneRemove: false,
      overdueOnly: true,
      today: new Date('2026-05-10T00:00:00'),
    }).map(c => c.id)).toEqual(['c2'])
  })
})

describe('buildBoardNavigationItems', () => {
  it('builds searchable outline entries for every board layer', () => {
    const items = buildBoardNavigationItems({
      cards: [{ id: 'c1', title: 'Card A', body: 'Body', tag: 'idea', x: 10, y: 20 } as Card],
      textBlocks: [{ id: 't1', html: '<b>Note</b> text', x: 30, y: 40 } as TextBlock],
      slides: [{ id: 's1', filename: 'deck.pdf', page_number: 2, total_pages: 4, x: 50, y: 60 } as SlideTile],
      frames: [{ id: 'f1', type: 'eisenhower', name: 'Priorities', x: 70, y: 80 } as FrameInstance],
      tags: [{ id: 'g1', label: 'Goal', x: 90, y: 100 } as GoalTag],
      frameLabel: type => `Frame ${type}`,
    })

    expect(items.map(item => item.label)).toEqual(['Card A', 'Note text', 'deck.pdf', 'Priorities', 'Goal'])
    expect(items.map(item => item.kind)).toEqual(['card', 'text', 'slide', 'frame', 'tag'])
    expect(items[0].x).toBe(10)
  })
})
