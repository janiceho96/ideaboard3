import { describe, it, expect } from 'vitest'
import { parseTextBlocks } from './useTextBlocks'
import type { TextBlock } from '../types'

const block: TextBlock = {
  id: 'a', board_id: 'b', html: '<strong>hi</strong>',
  x: 10, y: 20, width: 260, created_at: '',
}

describe('parseTextBlocks', () => {
  it('returns empty array for null', () => {
    expect(parseTextBlocks(null)).toEqual([])
  })

  it('returns empty array for invalid JSON', () => {
    expect(parseTextBlocks('not-json')).toEqual([])
  })

  it('returns empty array for non-array JSON', () => {
    expect(parseTextBlocks(JSON.stringify({ id: 'x' }))).toEqual([])
  })

  it('parses a valid array of blocks', () => {
    expect(parseTextBlocks(JSON.stringify([block]))).toEqual([block])
  })

  it('returns empty array for an empty array', () => {
    expect(parseTextBlocks('[]')).toEqual([])
  })
})
