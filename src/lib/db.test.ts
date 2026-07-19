import { describe, it, expect } from 'vitest'
import { normaliseCard } from './db'

// A card record as it would have been stored before the new fields were added
const oldCard = {
  id: 'x', board_id: 'b', title: 'T', body: '', date_label: '',
  due_date: null, tag: 'idea', bg: 'white',
  x: 0, y: 0, rotation: 0, card_width: 185, card_height: null,
  created_at: '', updated_at: '',
}

describe('normaliseCard — backwards compatibility', () => {
  it('defaults collapsed to false for old cards missing the field', () => {
    expect(normaliseCard(oldCard as unknown as Record<string, unknown>).collapsed).toBe(false)
  })

  it('defaults locked to false for old cards missing the field', () => {
    expect(normaliseCard(oldCard as unknown as Record<string, unknown>).locked).toBe(false)
  })

  it('preserves collapsed: true when already set', () => {
    const c = { ...oldCard, collapsed: true, locked: false }
    expect(normaliseCard(c as unknown as Record<string, unknown>).collapsed).toBe(true)
  })

  it('preserves locked: true when already set', () => {
    const c = { ...oldCard, collapsed: false, locked: true }
    expect(normaliseCard(c as unknown as Record<string, unknown>).locked).toBe(true)
  })
})
