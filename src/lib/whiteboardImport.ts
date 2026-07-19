import type {
  Card,
  CardInsert,
  FrameInstance,
  GoalTag,
  SlideTile,
  TextBlock,
} from '../types'
import { sanitizeHtml } from './sanitizeHtml'

type ImportKind = 'cards' | 'whiteboard'

export interface WhiteboardImportResult {
  kind: ImportKind
  cards: CardInsert[]
  goalTags: GoalTag[]
  frames: FrameInstance[]
  textBlocks: TextBlock[]
  slides: SlideTile[]
  slideImages: Record<string, string>
}

interface BuildWhiteboardImportInput {
  data: unknown
  targetBoardId: string
  createId?: () => string
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' ? value as Record<string, unknown> : {}
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

function asNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function asNullableString(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function mapCard(value: unknown, targetBoardId: string): CardInsert {
  const c = asRecord(value)
  return {
    board_id: targetBoardId,
    title: asString(c.title),
    body: asString(c.body),
    date_label: asString(c.date_label),
    due_date: asNullableString(c.due_date),
    tag: asString(c.tag, 'idea') as Card['tag'],
    bg: asString(c.bg, 'white'),
    x: asNumber(c.x, 100),
    y: asNumber(c.y, 100),
    rotation: asNumber(c.rotation, 0),
    card_width: asNumber(c.card_width, 185),
    card_height: typeof c.card_height === 'number' ? c.card_height : null,
    collapsed: asBoolean(c.collapsed, false),
    locked: asBoolean(c.locked, false),
  }
}

export function buildWhiteboardImport({
  data,
  targetBoardId,
  createId = () => crypto.randomUUID(),
}: BuildWhiteboardImportInput): WhiteboardImportResult {
  const root = asRecord(data)
  const cardsRaw = asArray(root.cards)
  if (!cardsRaw.length && !Array.isArray(root.cards)) {
    throw new Error('missing cards array')
  }

  const cards = cardsRaw.map(card => mapCard(card, targetBoardId))
  const isWhiteboard = root.schema === 'ideaboard.whiteboard' && root.version === 1

  if (!isWhiteboard) {
    return {
      kind: 'cards',
      cards,
      goalTags: [],
      frames: [],
      textBlocks: [],
      slides: [],
      slideImages: {},
    }
  }

  const goalTags = asArray(root.goalTags).map(value => {
    const tag = asRecord(value)
    return {
      id: createId(),
      board_id: targetBoardId,
      label: asString(tag.label, 'Goal'),
      bg: asString(tag.bg, '#E8E0F5'),
      color: asString(tag.color, '#333'),
      x: asNumber(tag.x, 100),
      y: asNumber(tag.y, 100),
      created_at: asString(tag.created_at, new Date().toISOString()),
    } satisfies GoalTag
  })

  const frames = asArray(root.frames).map(value => {
    const frame = asRecord(value)
    return {
      id: createId(),
      type: asString(frame.type, 'eisenhower') as FrameInstance['type'],
      name: asString(frame.name) || undefined,
      x: asNumber(frame.x, 60),
      y: asNumber(frame.y, 40),
      width: asNumber(frame.width, 640),
      height: asNumber(frame.height, 540),
    } satisfies FrameInstance
  })

  const textBlocks = asArray(root.textBlocks).map(value => {
    const block = asRecord(value)
    return {
      id: createId(),
      board_id: targetBoardId,
      html: sanitizeHtml(asString(block.html)),
      x: asNumber(block.x, 120),
      y: asNumber(block.y, 120),
      width: asNumber(block.width, 260),
      created_at: asString(block.created_at, new Date().toISOString()),
    } satisfies TextBlock
  })

  const slideImagesRaw = asRecord(root.slideImages)
  const slideImages: Record<string, string> = {}
  const slides = asArray(root.slides).map(value => {
    const slide = asRecord(value)
    const oldId = asString(slide.id)
    const id = createId()
    const image = oldId ? slideImagesRaw[oldId] : null
    if (typeof image === 'string') slideImages[id] = image
    return {
      id,
      board_id: targetBoardId,
      filename: asString(slide.filename, 'Imported deck'),
      page_number: asNumber(slide.page_number, 1),
      total_pages: asNumber(slide.total_pages, 1),
      x: asNumber(slide.x, 160),
      y: asNumber(slide.y, 160),
      width: asNumber(slide.width, 260),
      aspect_ratio: asNumber(slide.aspect_ratio, 16 / 9),
      created_at: asString(slide.created_at, new Date().toISOString()),
    } satisfies SlideTile
  })

  return {
    kind: 'whiteboard',
    cards,
    goalTags,
    frames,
    textBlocks,
    slides,
    slideImages,
  }
}
