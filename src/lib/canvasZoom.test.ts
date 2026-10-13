import { describe, expect, it } from 'vitest'
import { CANVAS_ZOOM_STEP, wheelPixels, wheelZoomFactor, zoomCanvasAt } from './canvasZoom'

describe('canvas zoom', () => {
  it('normalizes pixels, lines, and pages', () => {
    expect(wheelPixels(2, 0, 800)).toBe(2)
    expect(wheelPixels(2, 1, 800)).toBe(32)
    expect(wheelPixels(2, 2, 800)).toBe(1600)
    expect(wheelPixels(NaN, 0, 800)).toBe(0)
  })

  it('preserves small trackpad deltas and bounds large ticks', () => {
    expect(wheelZoomFactor(-1)).toBeGreaterThan(1)
    expect(wheelZoomFactor(-1)).toBeLessThan(1.003)
    expect(wheelZoomFactor(-1000)).toBeCloseTo(CANVAS_ZOOM_STEP)
    expect(wheelZoomFactor(1000)).toBeCloseTo(1 / CANVAS_ZOOM_STEP)
    expect(wheelZoomFactor(0)).toBe(1)
    expect(wheelZoomFactor(2) * wheelZoomFactor(-2)).toBeCloseTo(1)
  })

  it('keeps the world point under the pointer fixed, including at zoom limits', () => {
    for (const zoom of [0.15, 1, 3]) {
      const camera = { panX: -240, panY: 125, zoom }
      for (const factor of [0.5, 1.05, 2]) {
        const next = zoomCanvasAt(camera, factor, 375, 420)
        expect((375 - next.panX) / next.zoom).toBeCloseTo((375 - camera.panX) / zoom)
        expect((420 - next.panY) / next.zoom).toBeCloseTo((420 - camera.panY) / zoom)
        expect(next.zoom).toBeGreaterThanOrEqual(0.15)
        expect(next.zoom).toBeLessThanOrEqual(3)
      }
    }
  })

  it('makes zoom-in and zoom-out exact reciprocal steps', () => {
    const camera = { panX: 40, panY: -20, zoom: 1 }
    const next = zoomCanvasAt(zoomCanvasAt(camera, CANVAS_ZOOM_STEP, 600, 400), 1 / CANVAS_ZOOM_STEP, 600, 400)
    expect(next.zoom).toBeCloseTo(camera.zoom)
    expect(next.panX).toBeCloseTo(camera.panX)
    expect(next.panY).toBeCloseTo(camera.panY)
  })
})
