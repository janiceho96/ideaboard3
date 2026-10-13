import type { Board, Card, FrameInstance, GoalTag, SlideTile, TextBlock } from '../types'
import type { BoardSource } from './boardSourceStore'

export interface WhiteboardExport {
  schema: 'ideaboard.whiteboard'
  version: 3
  exportedAt: string
  board: Board
  cards: Card[]
  goalTags: GoalTag[]
  frames: FrameInstance[]
  textBlocks: TextBlock[]
  slides: SlideTile[]
  slideImages: Record<string, string | null>
  sources: BoardSource[]
}

interface BuildWhiteboardExportInput {
  board: Board
  cards: Card[]
  goalTags: GoalTag[]
  frames: FrameInstance[]
  textBlocks: TextBlock[]
  slides: SlideTile[]
  slideImages: Record<string, string | null>
  sources?: BoardSource[]
  exportedAt?: string
}

export function buildWhiteboardExport({
  board,
  cards,
  goalTags,
  frames,
  textBlocks,
  slides,
  slideImages,
  sources = [],
  exportedAt = new Date().toISOString(),
}: BuildWhiteboardExportInput): WhiteboardExport {
  return {
    schema: 'ideaboard.whiteboard',
    version: 3,
    exportedAt,
    board,
    cards,
    goalTags,
    frames,
    textBlocks,
    slides,
    slideImages,
    sources,
  }
}
