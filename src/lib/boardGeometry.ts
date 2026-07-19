export interface BoardRect {
  x: number
  y: number
  width: number
  height: number
}

export interface ViewportInput {
  width: number
  height: number
  panX: number
  panY: number
  zoom: number
  overscanPx?: number
}

export function padRect(rect: BoardRect, padding: number): BoardRect {
  return {
    x: rect.x - padding,
    y: rect.y - padding,
    width: rect.width + padding * 2,
    height: rect.height + padding * 2,
  }
}

export function getViewportWorldRect({
  width,
  height,
  panX,
  panY,
  zoom,
  overscanPx = 0,
}: ViewportInput): BoardRect {
  const safeZoom = zoom || 1
  return {
    x: (-panX - overscanPx) / safeZoom,
    y: (-panY - overscanPx) / safeZoom,
    width: (width + overscanPx * 2) / safeZoom,
    height: (height + overscanPx * 2) / safeZoom,
  }
}

export function isRectVisible(rect: BoardRect, viewport: BoardRect): boolean {
  return rect.x <= viewport.x + viewport.width &&
    rect.x + rect.width >= viewport.x &&
    rect.y <= viewport.y + viewport.height &&
    rect.y + rect.height >= viewport.y
}

export function buildExportBounds(rects: BoardRect[], padding: number): BoardRect | null {
  if (!rects.length) return null

  const minX = Math.min(...rects.map(r => r.x))
  const minY = Math.min(...rects.map(r => r.y))
  const maxX = Math.max(...rects.map(r => r.x + r.width))
  const maxY = Math.max(...rects.map(r => r.y + r.height))

  return padRect({ x: minX, y: minY, width: maxX - minX, height: maxY - minY }, padding)
}
