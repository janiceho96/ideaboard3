import type { Card, FrameInstance, FrameworkType, GoalTag, SlideTile, TextBlock } from '../types'

export type BulkDeleteKind = 'card' | 'slide' | 'text' | 'frame' | 'tag'

export interface BulkDeleteItem {
  key: string
  id: string
  kind: BulkDeleteKind
  label: string
  detail: string
}

interface BuildBulkDeleteItemsInput {
  cards: Card[]
  slides: SlideTile[]
  textBlocks: TextBlock[]
  frames: FrameInstance[]
  tags: GoalTag[]
  frameLabel: (type: FrameworkType) => string
}

function textFromHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function clip(text: string, fallback: string): string {
  const trimmed = text.trim()
  if (!trimmed) return fallback
  return trimmed.length > 72 ? `${trimmed.slice(0, 69)}...` : trimmed
}

function item(kind: BulkDeleteKind, id: string, label: string, detail: string): BulkDeleteItem {
  return { key: `${kind}:${id}`, id, kind, label, detail }
}

export function buildBulkDeleteItems({
  cards,
  slides,
  textBlocks,
  frames,
  tags,
  frameLabel,
}: BuildBulkDeleteItemsInput): BulkDeleteItem[] {
  return [
    ...cards.map(card => item('card', card.id, clip(card.title, 'Untitled card'), card.tag)),
    ...slides.map(slide => item(
      'slide',
      slide.id,
      `${slide.filename} - slide ${slide.page_number} of ${slide.total_pages}`,
      'Imported slide',
    )),
    ...textBlocks.map(block => item(
      'text',
      block.id,
      clip(textFromHtml(block.html), 'Empty text block'),
      'Text block',
    )),
    ...frames.map(frame => item(
      'frame',
      frame.id,
      clip(frame.name ?? '', frameLabel(frame.type)),
      frameLabel(frame.type),
    )),
    ...tags.map(tag => item('tag', tag.id, clip(tag.label, 'Untitled tag'), 'Goal tag')),
  ]
}
