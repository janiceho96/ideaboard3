import { describe, expect, it } from 'vitest'
import { selectCardIdsInRect, selectSlideIdsInRect } from './multiSelect'
import type { Card, SlideTile } from '../types'

describe('selectCardIdsInRect', () => {
  const cards = [
    { id: 'a', x: 10, y: 10, card_width: 100, card_height: 80, collapsed: false } as Card,
    { id: 'b', x: 180, y: 40, card_width: 100, card_height: null, collapsed: false } as Card,
    { id: 'c', x: 400, y: 400, card_width: 100, card_height: 80, collapsed: false } as Card,
  ]

  it('selects cards that intersect the selection rectangle', () => {
    expect(selectCardIdsInRect(cards, { x: 0, y: 0, width: 260, height: 130 })).toEqual(['a', 'b'])
  })

  it('normalizes rectangles dragged from bottom-right to top-left', () => {
    expect(selectCardIdsInRect(cards, { x: 260, y: 130, width: -260, height: -130 })).toEqual(['a', 'b'])
  })
})

describe('selectSlideIdsInRect', () => {
  const slides = [
    { id: 's1', x: 20, y: 20, width: 240, aspect_ratio: 1.5 } as SlideTile,
    { id: 's2', x: 280, y: 30, width: 240, aspect_ratio: 1.5 } as SlideTile,
    { id: 's3', x: 700, y: 700, width: 240, aspect_ratio: 1.5 } as SlideTile,
  ]

  it('selects uploaded slide tiles that intersect the selection rectangle', () => {
    expect(selectSlideIdsInRect(slides, { x: 0, y: 0, width: 560, height: 220 })).toEqual(['s1', 's2'])
  })
})
