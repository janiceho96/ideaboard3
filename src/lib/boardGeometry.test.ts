import { describe, expect, it } from 'vitest'
import {
  buildExportBounds,
  getViewportWorldRect,
  isRectVisible,
  padRect,
  type BoardRect,
} from './boardGeometry'

describe('boardGeometry', () => {
  it('converts the screen viewport into world coordinates with overscan', () => {
    expect(getViewportWorldRect({
      width: 800,
      height: 600,
      panX: -200,
      panY: -100,
      zoom: 2,
      overscanPx: 100,
    })).toEqual({ x: 50, y: 0, width: 500, height: 400 })
  })

  it('detects whether rectangles intersect', () => {
    const viewport: BoardRect = { x: 0, y: 0, width: 100, height: 100 }

    expect(isRectVisible({ x: 90, y: 90, width: 20, height: 20 }, viewport)).toBe(true)
    expect(isRectVisible({ x: 101, y: 0, width: 20, height: 20 }, viewport)).toBe(false)
  })

  it('builds padded export bounds for all board content', () => {
    const bounds = buildExportBounds([
      { x: 20, y: 30, width: 100, height: 50 },
      { x: -40, y: 90, width: 10, height: 20 },
    ], 25)

    expect(bounds).toEqual({ x: -65, y: 5, width: 210, height: 130 })
  })

  it('returns null export bounds when a board has no content', () => {
    expect(buildExportBounds([], 25)).toBeNull()
  })

  it('pads a rectangle on every side', () => {
    expect(padRect({ x: 10, y: 20, width: 30, height: 40 }, 5))
      .toEqual({ x: 5, y: 15, width: 40, height: 50 })
  })
})
