import type { Card, SlideTile } from '../types'

export interface SelectionRect {
  x: number
  y: number
  width: number
  height: number
}

function normalize(rect: SelectionRect): SelectionRect {
  const x1 = Math.min(rect.x, rect.x + rect.width)
  const y1 = Math.min(rect.y, rect.y + rect.height)
  const x2 = Math.max(rect.x, rect.x + rect.width)
  const y2 = Math.max(rect.y, rect.y + rect.height)
  return { x: x1, y: y1, width: x2 - x1, height: y2 - y1 }
}

function intersects(a: SelectionRect, b: SelectionRect): boolean {
  return a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
}

export function selectCardIdsInRect(cards: Card[], rect: SelectionRect): string[] {
  const area = normalize(rect)
  return cards
    .filter(card => intersects(area, {
      x: card.x,
      y: card.y,
      width: card.card_width ?? 185,
      height: card.card_height ?? (card.collapsed ? 54 : 160),
    }))
    .map(card => card.id)
}

export function selectSlideIdsInRect(slides: SlideTile[], rect: SelectionRect): string[] {
  const area = normalize(rect)
  return slides
    .filter(slide => intersects(area, {
      x: slide.x,
      y: slide.y,
      width: slide.width,
      height: slide.aspect_ratio > 0 ? slide.width / slide.aspect_ratio : slide.width,
    }))
    .map(slide => slide.id)
}

export function normalizeSelectionRect(rect: SelectionRect): SelectionRect {
  return normalize(rect)
}
