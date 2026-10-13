export const CANVAS_ZOOM_STEP = 1.05
export const MIN_CANVAS_ZOOM = 0.15
export const MAX_CANVAS_ZOOM = 3

export interface CanvasCamera { panX: number; panY: number; zoom: number }

export function wheelPixels(delta: number, mode: number, pageSize: number): number {
  if (!Number.isFinite(delta)) return 0
  return delta * (mode === 1 ? 16 : mode === 2 ? pageSize : 1)
}

// Small trackpad deltas stay small; a large mouse-wheel tick changes at most 5%.
export function wheelZoomFactor(pixelDelta: number): number {
  const limit = Math.log(CANVAS_ZOOM_STEP)
  return Math.exp(Math.max(-limit, Math.min(limit, -pixelDelta * 0.002)))
}

export function zoomCanvasAt(camera: CanvasCamera, factor: number, x: number, y: number): CanvasCamera {
  const zoom = Math.max(MIN_CANVAS_ZOOM, Math.min(MAX_CANVAS_ZOOM, camera.zoom * factor))
  const ratio = zoom / camera.zoom
  return { zoom, panX: x - (x - camera.panX) * ratio, panY: y - (y - camera.panY) * ratio }
}
