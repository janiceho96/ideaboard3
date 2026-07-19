import type { Card, FrameInstance, GoalTag, SlideTile, TextBlock } from '../types'

export type BoardNavKind = 'card' | 'text' | 'slide' | 'frame' | 'tag'

export interface BoardNavigationItem {
  key: string
  id: string
  kind: BoardNavKind
  label: string
  detail: string
  x: number
  y: number
  searchText: string
}

export interface CardFilterOptions {
  query: string
  hideDoneRemove: boolean
  overdueOnly: boolean
  today?: Date
}

function cleanHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function isOverdue(dueDate: string | null, today = new Date()): boolean {
  if (!dueDate) return false
  const start = new Date(today)
  start.setHours(0, 0, 0, 0)
  const due = new Date(`${dueDate}T00:00:00`)
  return due.getTime() < start.getTime()
}

function cardSearchText(card: Card): string {
  return [
    card.title,
    card.body,
    card.tag,
    card.date_label,
    card.due_date ?? '',
  ].join(' ').toLowerCase()
}

export function filterCardsForBoard(cards: Card[], options: CardFilterOptions): Card[] {
  const query = options.query.trim().toLowerCase()
  return cards.filter(card => {
    if (options.hideDoneRemove && (card.tag === 'done' || card.tag === 'remove')) return false
    if (options.overdueOnly && !isOverdue(card.due_date, options.today)) return false
    if (query && !cardSearchText(card).includes(query)) return false
    return true
  })
}

interface BuildBoardNavigationItemsInput {
  cards: Card[]
  textBlocks: TextBlock[]
  slides: SlideTile[]
  frames: FrameInstance[]
  tags: GoalTag[]
  frameLabel: (type: FrameInstance['type']) => string
}

export function buildBoardNavigationItems({
  cards,
  textBlocks,
  slides,
  frames,
  tags,
  frameLabel,
}: BuildBoardNavigationItemsInput): BoardNavigationItem[] {
  return [
    ...cards.map(card => ({
      key: `card:${card.id}`,
      id: card.id,
      kind: 'card' as const,
      label: card.title.trim() || 'Untitled card',
      detail: `${card.tag}${card.due_date ? ` - due ${card.due_date}` : ''}`,
      x: card.x,
      y: card.y,
      searchText: cardSearchText(card),
    })),
    ...textBlocks.map(block => {
      const text = cleanHtml(block.html)
      return {
        key: `text:${block.id}`,
        id: block.id,
        kind: 'text' as const,
        label: text || 'Empty text block',
        detail: 'Text block',
        x: block.x,
        y: block.y,
        searchText: text.toLowerCase(),
      }
    }),
    ...slides.map(slide => ({
      key: `slide:${slide.id}`,
      id: slide.id,
      kind: 'slide' as const,
      label: slide.filename || 'Imported slide',
      detail: `Slide ${slide.page_number} of ${slide.total_pages}`,
      x: slide.x,
      y: slide.y,
      searchText: `${slide.filename} ${slide.page_number} ${slide.total_pages}`.toLowerCase(),
    })),
    ...frames.map(frame => {
      const label = frame.name?.trim() || frameLabel(frame.type)
      return {
        key: `frame:${frame.id}`,
        id: frame.id,
        kind: 'frame' as const,
        label,
        detail: frameLabel(frame.type),
        x: frame.x,
        y: frame.y,
        searchText: `${label} ${frame.type}`.toLowerCase(),
      }
    }),
    ...tags.map(tag => ({
      key: `tag:${tag.id}`,
      id: tag.id,
      kind: 'tag' as const,
      label: tag.label || 'Goal tag',
      detail: 'Goal tag',
      x: tag.x,
      y: tag.y,
      searchText: tag.label.toLowerCase(),
    })),
  ]
}
