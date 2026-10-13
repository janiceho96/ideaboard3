import { buildExportBounds, type BoardRect } from './boardGeometry'

export const MINIMAP_WIDTH = 110
export const MINIMAP_HEIGHT = 74

export function getMinimapBounds(rects: BoardRect[], viewport: BoardRect): BoardRect {
  const bounds = buildExportBounds([...rects, viewport].filter(rect =>
    [rect.x, rect.y, rect.width, rect.height].every(Number.isFinite) && rect.width >= 0 && rect.height >= 0,
  ), 0) ?? { x: 0, y: 0, width: 1, height: 1 }
  const scale = Math.max(Math.max(1, bounds.width) / (MINIMAP_WIDTH - 12), Math.max(1, bounds.height) / (MINIMAP_HEIGHT - 12))
  const width = MINIMAP_WIDTH * scale
  const height = MINIMAP_HEIGHT * scale

  return {
    x: bounds.x + (bounds.width - width) / 2,
    y: bounds.y + (bounds.height - height) / 2,
    width,
    height,
  }
}
