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
