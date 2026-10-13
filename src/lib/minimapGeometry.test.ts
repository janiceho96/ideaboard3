import { describe, expect, it } from 'vitest'
import { getViewportWorldRect, type BoardRect } from './boardGeometry'
import { getMinimapBounds, MINIMAP_HEIGHT, MINIMAP_WIDTH } from './minimapGeometry'

function expectVisibleWithMargin(bounds: BoardRect, rect: BoardRect) {
  const scale = MINIMAP_WIDTH / bounds.width
  expect((rect.x - bounds.x) * scale).toBeGreaterThanOrEqual(6 - 1e-9)
  expect((rect.y - bounds.y) * scale).toBeGreaterThanOrEqual(6 - 1e-9)
  expect((bounds.x + bounds.width - rect.x - rect.width) * scale).toBeGreaterThanOrEqual(6 - 1e-9)
  expect((bounds.y + bounds.height - rect.y - rect.height) * scale).toBeGreaterThanOrEqual(6 - 1e-9)
}

describe('getMinimapBounds', () => {
  it('includes content at negative positions and the visible viewport', () => {
    const card = { x: -400, y: -250, width: 180, height: 120 }
    const viewport = getViewportWorldRect({ width: 800, height: 600, panX: 100, panY: 100, zoom: 1 })
    const bounds = getMinimapBounds([card], viewport)

    expectVisibleWithMargin(bounds, card)
    expectVisibleWithMargin(bounds, viewport)
    expect(bounds.x + bounds.width / 2).toBeCloseTo(150)
    expect(bounds.y + bounds.height / 2).toBeCloseTo(125)
  })

  it('keeps a viewport far beyond the board inside the minimap', () => {
    const frame = { x: 0, y: 0, width: 200, height: 150 }
    const viewport = { x: 3000, y: -2500, width: 640, height: 480 }
    const bounds = getMinimapBounds([frame], viewport)

    expectVisibleWithMargin(bounds, frame)
    expectVisibleWithMargin(bounds, viewport)
  })

  it('uses the viewport when the board is empty', () => {
    const viewport = { x: -10000, y: 5000, width: 1024, height: 768 }
    const bounds = getMinimapBounds([], viewport)

    expectVisibleWithMargin(bounds, viewport)
    expect(bounds.x + bounds.width / 2).toBeCloseTo(-9488)
    expect(bounds.y + bounds.height / 2).toBeCloseTo(5384)
  })

  it.each([
    { x: 0, y: 0, width: 1000, height: 10 },
    { x: -10, y: -20, width: 10, height: 1000 },
    { x: 20, y: 40, width: 0, height: 0 },
  ])('preserves the minimap aspect and six-pixel margin for %o', viewport => {
    const bounds = getMinimapBounds([], viewport)

    expect(bounds.width / bounds.height).toBeCloseTo(MINIMAP_WIDTH / MINIMAP_HEIGHT)
    expect(bounds.width).toBeGreaterThanOrEqual(1)
    expect(bounds.height).toBeGreaterThanOrEqual(1)
    expectVisibleWithMargin(bounds, viewport)
  })

  it('ignores invalid content rectangles without hiding valid content', () => {
    const viewport = { x: 0, y: 0, width: 800, height: 600 }
    const valid = { x: -250, y: -150, width: 100, height: 100 }
    const invalid = [
      { x: Infinity, y: 0, width: 100, height: 100 },
      { x: 0, y: NaN, width: 100, height: 100 },
      { x: 0, y: 0, width: -100, height: 100 },
      { x: 0, y: 0, width: 100, height: -100 },
      { x: 0, y: 0, width: 100, height: 100 / 0 },
    ]

    expect(getMinimapBounds([valid, ...invalid], viewport)).toEqual(getMinimapBounds([valid], viewport))
  })

  it('returns finite dimensions when no valid viewport or content is available', () => {
    const bounds = getMinimapBounds([], { x: NaN, y: 0, width: 0, height: 0 })

    expect(Object.values(bounds).every(Number.isFinite)).toBe(true)
    expect(bounds.width).toBeGreaterThanOrEqual(1)
    expect(bounds.height).toBeGreaterThanOrEqual(1)
    expect(bounds.width / bounds.height).toBeCloseTo(MINIMAP_WIDTH / MINIMAP_HEIGHT)
  })
})
