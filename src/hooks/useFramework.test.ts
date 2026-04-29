import { describe, it, expect } from 'vitest'
import { parseFrameworkSettings } from './useFramework'

describe('parseFrameworkSettings', () => {
  it('defaults to eisenhower with 640×540 when no stored value', () => {
    const result = parseFrameworkSettings(null)
    expect(result).toEqual({ type: 'eisenhower', width: 640, height: 540 })
  })

  it('restores stored eisenhower settings including custom size', () => {
    const stored = JSON.stringify({ type: 'eisenhower', width: 800, height: 700 })
    expect(parseFrameworkSettings(stored)).toEqual({ type: 'eisenhower', width: 800, height: 700 })
  })

  it('restores blank type with eisenhower default size', () => {
    const stored = JSON.stringify({ type: 'blank', width: 640, height: 540 })
    expect(parseFrameworkSettings(stored)).toEqual({ type: 'blank', width: 640, height: 540 })
  })

  it('defaults ooda size to 720×220 when size is missing', () => {
    const stored = JSON.stringify({ type: 'ooda' })
    const result = parseFrameworkSettings(stored)
    expect(result.type).toBe('ooda')
    expect(result.width).toBe(720)
    expect(result.height).toBe(220)
  })

  it('falls back to eisenhower for an unrecognised type string', () => {
    const stored = JSON.stringify({ type: 'kanban' })
    expect(parseFrameworkSettings(stored).type).toBe('eisenhower')
  })

  it('falls back to eisenhower for malformed JSON', () => {
    expect(parseFrameworkSettings('not-json').type).toBe('eisenhower')
  })
})
