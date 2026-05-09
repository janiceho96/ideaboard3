import { describe, it, expect, vi } from 'vitest'

let store: Record<string, string> = {}
vi.stubGlobal('localStorage', {
  getItem:    (k: string) => store[k] ?? null,
  setItem:    (k: string, v: string) => { store[k] = v },
  removeItem: (k: string) => { delete store[k] },
  clear:      () => { store = {} },
})

import { parseFrameInstances } from './useFrames'

describe('parseFrameInstances', () => {
  it('returns [] when both args are null', () => {
    expect(parseFrameInstances(null, null)).toEqual([])
  })

  it('parses a stored frames array', () => {
    const stored = JSON.stringify([
      { id: 'f1', type: 'eisenhower', x: 60, y: 40, width: 640, height: 540 },
    ])
    const result = parseFrameInstances(stored, null)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('f1')
    expect(result[0].type).toBe('eisenhower')
    expect(result[0].x).toBe(60)
  })

  it('migrates old non-blank single framework to one-item array at (60, 40)', () => {
    const old = JSON.stringify({ type: 'okr', width: 640, height: 440 })
    const result = parseFrameInstances(null, old)
    expect(result).toHaveLength(1)
    expect(result[0].type).toBe('okr')
    expect(result[0].x).toBe(60)
    expect(result[0].y).toBe(40)
    expect(result[0].width).toBe(640)
    expect(result[0].height).toBe(440)
    expect(typeof result[0].id).toBe('string')
  })

  it('migrates old blank single framework to empty array', () => {
    const old = JSON.stringify({ type: 'blank', width: 640, height: 540 })
    expect(parseFrameInstances(null, old)).toEqual([])
  })

  it('ignores old framework when new frames already exist', () => {
    const newRaw = JSON.stringify([{ id: 'f1', type: 'ikigai', x: 0, y: 0, width: 520, height: 520 }])
    const old    = JSON.stringify({ type: 'okr', width: 640, height: 440 })
    const result = parseFrameInstances(newRaw, old)
    expect(result).toHaveLength(1)
    expect(result[0].type).toBe('ikigai')
  })

  it('returns [] for malformed JSON', () => {
    expect(parseFrameInstances('not-json', null)).toEqual([])
  })
})
