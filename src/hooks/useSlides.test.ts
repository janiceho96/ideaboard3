import { describe, it, expect } from 'vitest'
import { parseSlideTiles } from './useSlides'

describe('parseSlideTiles', () => {
  it('returns empty array for null input', () => {
    expect(parseSlideTiles(null)).toEqual([])
  })

  it('returns empty array for empty JSON array', () => {
    expect(parseSlideTiles('[]')).toEqual([])
  })

  it('parses a stored tile array', () => {
    const tile = {
      id: 'abc', board_id: 'b1', filename: 'deck.pdf',
      page_number: 1, total_pages: 3,
      x: 100, y: 200, width: 260, aspect_ratio: 1.333,
      created_at: '2026-04-30T00:00:00.000Z',
    }
    const result = parseSlideTiles(JSON.stringify([tile]))
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('abc')
    expect(result[0].aspect_ratio).toBe(1.333)
  })

  it('returns empty array for malformed JSON', () => {
    expect(parseSlideTiles('not-json')).toEqual([])
  })

  it('returns empty array when stored value is not an array', () => {
    expect(parseSlideTiles(JSON.stringify({ id: 'x' }))).toEqual([])
  })
})
