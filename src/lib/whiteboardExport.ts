import type { Board, Card, FrameInstance, GoalTag, SlideTile, TextBlock } from '../types'

export interface WhiteboardExport {
  schema: 'ideaboard.whiteboard'
  version: 1
  exportedAt: string
  board: Board
  cards: Card[]
  goalTags: GoalTag[]
  frames: FrameInstance[]
  textBlocks: TextBlock[]
  slides: SlideTile[]
  slideImages: Record<string, string | null>
}

interface BuildWhiteboardExportInput {
  board: Board
  cards: Card[]
  goalTags: GoalTag[]
  frames: FrameInstance[]
  textBlocks: TextBlock[]
  slides: SlideTile[]
  slideImages: Record<string, string | null>
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
  exportedAt = new Date().toISOString(),
}: BuildWhiteboardExportInput): WhiteboardExport {
  return {
    schema: 'ideaboard.whiteboard',
    version: 1,
    exportedAt,
    board,
    cards,
    goalTags,
    frames,
    textBlocks,
    slides,
    slideImages,
  }
}
