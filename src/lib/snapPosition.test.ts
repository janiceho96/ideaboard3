import { describe, it, expect } from 'vitest'
import { snapPosition, snapPositionGeneric } from './snapPosition'
import type { Card } from '../types'

function makeCard(overrides: Partial<Card> & { id: string; x: number; y: number }): Card {
  return {
    board_id: 'b1',
    title: 'Test',
    body: '',
    date_label: '',
    due_date: null,
    tag: 'idea',
    bg: 'white',
    rotation: 0,
    card_width: 185,
    card_height: null,
    collapsed: false,
    locked: false,
    created_at: '',
    updated_at: '',
    ...overrides,
  }
}

const dragging = makeCard({ id: 'drag', x: 0, y: 0 })

describe('snapPosition — magnetic snap', () => {
  it('snaps to the right of a neighbour when dropped to its right', () => {
    const neighbour = makeCard({ id: 'nb', x: 100, y: 100 })
    // Drop at the right slot itself — dragging centre (383.5,180), neighbour centre (192.5,180), dist=191 < 200
    const result = snapPosition(291, 100, dragging, [neighbour])
    // right slot = neighbour.x + neighbour.card_width + 6 = 100 + 185 + 6 = 291
    expect(result).toEqual({ x: 291, y: 100, snappedToId: 'nb' })
  })

  it('snaps to the left of a neighbour when dropped to its left', () => {
    const neighbour = makeCard({ id: 'nb', x: 300, y: 100 })
    // Drop at the left slot — dragging centre (201.5,180), neighbour centre (392.5,180), dist=191 < 200
    const result = snapPosition(109, 100, dragging, [neighbour])
    // left slot = neighbour.x - dragging.card_width - 6 = 300 - 185 - 6 = 109
    expect(result).toEqual({ x: 109, y: 100, snappedToId: 'nb' })
  })

  it('snaps below a neighbour when dropped below it', () => {
    const neighbour = makeCard({ id: 'nb', x: 100, y: 100 })
    // Drop dragging card below neighbour — uses card_height estimate 160
    const result = snapPosition(100, 280, dragging, [neighbour])
    // below slot = neighbour.y + 160 + 6 = 266
    expect(result).toEqual({ x: 100, y: 266, snappedToId: 'nb' })
  })

  it('snaps above a neighbour when dropped above it', () => {
    const neighbour = makeCard({ id: 'nb', x: 100, y: 300 })
    // Drop dragging card above neighbour
    const result = snapPosition(100, 120, dragging, [neighbour])
    // above slot = neighbour.y - dragging height estimate - 6 = 300 - 160 - 6 = 134
    expect(result).toEqual({ x: 100, y: 134, snappedToId: 'nb' })
  })

  it('skips the dragging card itself when scanning neighbours', () => {
    // Only card in list is the dragging card — should fall back to grid
    const result = snapPosition(55, 55, dragging, [dragging])
    expect(result).toEqual({ x: 40, y: 40, snappedToId: null })
  })

  it('falls back to grid snap when no neighbour is within 300px', () => {
    const farCard = makeCard({ id: 'far', x: 2000, y: 2000 })
    const result = snapPosition(55, 75, dragging, [farCard])
    expect(result).toEqual({ x: 40, y: 80, snappedToId: null })
  })

  it('falls back to grid snap when card list is empty', () => {
    const result = snapPosition(50, 90, dragging, [])
    expect(result).toEqual({ x: 40, y: 80, snappedToId: null })
  })
})

describe('snapPositionGeneric options', () => {
  const draggingText = { id: 'text-drag', x: 0, y: 0, w: 220, h: 80 }
  const nearbyText = { id: 'text-near', x: 100, y: 100, w: 220, h: 80 }

  it('keeps the exact position when grid fallback is disabled and no target is close', () => {
    const result = snapPositionGeneric(
      53,
      77,
      draggingText,
      [{ id: 'far', x: 2000, y: 2000, w: 220, h: 80 }],
      { radius: 110, gridSize: null },
    )

    expect(result).toEqual({ x: 53, y: 77, snappedToId: null })
  })

  it('still magnetically docks when a target is inside the custom radius', () => {
    const result = snapPositionGeneric(
      100,
      190,
      draggingText,
      [nearbyText],
      { radius: 110, gridSize: null },
    )

    expect(result).toEqual({ x: 100, y: 186, snappedToId: 'text-near' })
  })
})
