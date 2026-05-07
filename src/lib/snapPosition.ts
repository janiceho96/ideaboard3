import type { Card } from '../types'

const SNAP_RADIUS = 300          // world-px: distance to activate magnetic snap
const SNAP_GAP = 6               // world-px: gap between docked cards
const SNAP_GRID = 40             // world-px: grid size for fallback snap
const CARD_HEIGHT_ESTIMATE = 160 // world-px: fallback when card_height is null

export function snapPosition(
  wx: number,
  wy: number,
  draggingCard: Card,
  allCards: Card[],
): { x: number; y: number; snappedToId: string | null } {
  const dw = draggingCard.card_width ?? 185
  const dh = draggingCard.card_height ?? CARD_HEIGHT_ESTIMATE
  const dragCx = wx + dw / 2
  const dragCy = wy + dh / 2

  // Find nearest neighbour within snap radius (exclude dragging card itself)
  let nearest: Card | null = null
  let nearestDist = SNAP_RADIUS

  for (const card of allCards) {
    if (card.id === draggingCard.id) continue
    const nw = card.card_width ?? 185
    const nh = card.card_height ?? CARD_HEIGHT_ESTIMATE
    const ncx = card.x + nw / 2
    const ncy = card.y + nh / 2
    const dist = Math.sqrt((dragCx - ncx) ** 2 + (dragCy - ncy) ** 2)
    if (dist < nearestDist) {
      nearestDist = dist
      nearest = card
    }
  }

  if (nearest) {
    const nw = nearest.card_width ?? 185
    const nh = nearest.card_height ?? CARD_HEIGHT_ESTIMATE

    // 4 candidate positions around the neighbour
    const candidates = [
      { x: nearest.x + nw + SNAP_GAP, y: nearest.y },  // right
      { x: nearest.x - dw - SNAP_GAP, y: nearest.y },  // left
      { x: nearest.x, y: nearest.y + nh + SNAP_GAP },  // below
      { x: nearest.x, y: nearest.y - dh - SNAP_GAP },  // above
    ]

    // Pick candidate closest to the dragged card's current centre
    let best = candidates[0]
    let bestDist = Infinity
    for (const c of candidates) {
      const cx = c.x + dw / 2
      const cy = c.y + dh / 2
      const d = Math.sqrt((cx - dragCx) ** 2 + (cy - dragCy) ** 2)
      if (d < bestDist) {
        bestDist = d
        best = c
      }
    }
    return { ...best, snappedToId: nearest.id }
  }

  // Fallback: nearest grid point
  return {
    x: Math.round(wx / SNAP_GRID) * SNAP_GRID,
    y: Math.round(wy / SNAP_GRID) * SNAP_GRID,
    snappedToId: null,
  }
}
