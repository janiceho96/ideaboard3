export type TagType = 'idea' | 'critical' | 'planned' | 'delegate' | 'remove' | 'done'

export interface LocalUser {
  id: string
  email: string
}

export interface Board {
  id: string
  name: string
  owner_id: string
  created_at: string
}

export interface Card {
  id: string
  board_id: string
  title: string
  body: string
  date_label: string
  due_date: string | null      // ISO date string e.g. "2024-08-15"
  tag: TagType
  bg: string
  x: number
  y: number
  rotation: number
  card_width: number           // resizable width in world px
  card_height: number | null   // null = auto height
  collapsed: boolean           // true = shrunk to title bar only
  locked: boolean              // true = cannot be dragged or resized
  created_at: string
  updated_at: string
}

export interface GoalTag {
  id: string
  board_id: string
  label: string
  bg: string
  color: string
  x: number
  y: number
  created_at: string
}

export type CardInsert = Omit<Card, 'id' | 'created_at' | 'updated_at'>
export type GoalTagInsert = Omit<GoalTag, 'id' | 'created_at'>

export interface SlideTile {
  id: string
  board_id: string
  filename: string     // original PDF filename, shown in tile label
  page_number: number  // 1-based
  total_pages: number
  x: number            // world-space position
  y: number
  width: number        // world-units; default 260
  aspect_ratio: number // width/height ratio; tile height = width / aspect_ratio
  created_at: string
}

export interface TextBlock {
  id: string
  board_id: string
  html: string       // innerHTML — preserves bold/italic/highlight across reloads
  x: number          // world-space position
  y: number
  width: number      // world-units; default 260
  created_at: string
}

export interface Group {
  id: string
  name: string
  order: number
  created_at: string
}

export interface BoardGroup {
  board_id: string
  group_id: string
}

export type FrameworkType =
  | 'blank' | 'eisenhower' | 'ooda'
  | 'ikigai' | 'wheel-of-life' | 'grow' | 'smart-goals'
  | 'start-stop-continue' | 'personal-kanban' | 'five-whys'
  | 'daily-reflection' | 'okr' | 'energy-audit'
  | 'eat-that-frog' | 'gtd'

export interface FrameInstance {
  id: string
  type: FrameworkType
  name?: string     // user-defined label; absent = show type name only
  x: number        // world-space position (inside the transformed worldRef div)
  y: number
  width: number    // world-space size
  height: number
}
