import type {
  Card,
  CardInsert,
  FrameInstance,
  GoalTag,
  SlideTile,
  TextBlock,
} from '../types'
import { sanitizeHtml } from './sanitizeHtml'
import type { BoardSource } from './boardSourceStore'
import { VALID_TYPES } from '../hooks/useFrames'
import { frameworkTypeFor, validateCustomFrameworkTemplate } from './customFrameworks'

type ImportKind = 'cards' | 'whiteboard'

export interface WhiteboardImportResult {
  kind: ImportKind
  cards: CardInsert[]
  goalTags: GoalTag[]
  frames: FrameInstance[]
  textBlocks: TextBlock[]
  slides: SlideTile[]
  slideImages: Record<string, string>
  sources: BoardSource[]
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
  const isWhiteboard = root.schema === 'ideaboard.whiteboard' && (root.version === 1 || root.version === 2 || root.version === 3)

  if (!isWhiteboard) {
    return {
      kind: 'cards',
      cards,
      goalTags: [],
      frames: [],
      textBlocks: [],
      slides: [],
      slideImages: {},
      sources: [],
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
    const savedType = asString(frame.type, 'eisenhower')
    const customFramework = validateCustomFrameworkTemplate(frame.customFramework)
    const hasValidCustom = customFramework && frameworkTypeFor(customFramework) === savedType
    const type = hasValidCustom
      ? savedType as FrameInstance['type']
      : VALID_TYPES.some(valid => valid === savedType)
        ? savedType as FrameInstance['type']
        : 'eisenhower'
    const rawNoteAreas = asRecord(frame.noteAreas)
    const noteAreas = Object.fromEntries(Object.entries(rawNoteAreas)
      .filter(([key, text]) => key.length <= 100 && typeof text === 'string' && text.length <= 20000)
      .slice(0, 32)) as Record<string, string>
    return {
      id: createId(),
      type,
      ...(hasValidCustom ? { customFramework } : {}),
      name: asString(frame.name) || undefined,
      notes: asString(frame.notes) || undefined,
      ...(Object.keys(noteAreas).length ? { noteAreas } : {}),
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
  const slideIds = new Map<string, string>()
  const slides = asArray(root.slides).map(value => {
    const slide = asRecord(value)
    const oldId = asString(slide.id)
    const id = createId()
    if (oldId) slideIds.set(oldId, id)
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

  const sources = asArray(root.sources).slice(0, 2000).flatMap(value => {
    const source = asRecord(value)
    const kind = source.kind
    if (!['markdown', 'text', 'pdf-page', 'image'].includes(String(kind)) || typeof source.text !== 'string' || source.text.length > 200_000) return []
    const oldSlideId = asString(source.slide_id)
    const slideId = oldSlideId ? slideIds.get(oldSlideId) : undefined
    if ((kind === 'pdf-page' || kind === 'image') && !slideId) return []
    return [{
      id: createId(), board_id: targetBoardId, kind: kind as BoardSource['kind'],
      title: asString(source.title, 'Imported source').slice(0, 512),
      text: source.text, mime_type: asString(source.mime_type, 'text/plain').slice(0, 128),
      ...(slideId ? { slide_id: slideId } : {}),
      ...(typeof source.page_number === 'number' ? { page_number: source.page_number } : {}),
      ...(typeof source.total_pages === 'number' ? { total_pages: source.total_pages } : {}),
      created_at: asString(source.created_at, new Date().toISOString()),
    } satisfies BoardSource]
  })

  return {
    kind: 'whiteboard',
    cards,
    goalTags,
    frames,
    textBlocks,
    slides,
    slideImages,
    sources,
  }
}
