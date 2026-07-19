import type { CardInsert, FrameInstance, GoalTag, TextBlock } from '../types'

export type BoardTemplateId = 'weekly-plan' | 'project-brainstorm' | 'content-calendar' | 'decision-matrix'

export interface BoardTemplate {
  id: BoardTemplateId
  name: string
  description: string
}

export interface BoardTemplatePayload {
  cards: CardInsert[]
  goalTags: GoalTag[]
  frames: FrameInstance[]
  textBlocks: TextBlock[]
}

export const BOARD_TEMPLATES: BoardTemplate[] = [
  { id: 'weekly-plan', name: 'Weekly Plan', description: 'Priorities, schedule, blockers, and wins.' },
  { id: 'project-brainstorm', name: 'Project Brainstorm', description: 'Collect ideas, group themes, and pick next moves.' },
  { id: 'content-calendar', name: 'Content Calendar', description: 'Plan posts, drafts, reviews, and publish dates.' },
  { id: 'decision-matrix', name: 'Decision Matrix', description: 'Compare options by impact, effort, risk, and confidence.' },
]

interface BuildBoardTemplatePayloadInput {
  templateId: BoardTemplateId
  boardId: string
  now?: string
  createId?: () => string
}

const tagBase = [
  ['idea', '#E8E0F5', '#3A2270'],
  ['planned', '#FFF3B0', '#5C4009'],
  ['critical', '#FFD6C2', '#6B2D0D'],
  ['done', '#D4EDD8', '#1B4D21'],
] as const

function card(boardId: string, title: string, body: string, tag: CardInsert['tag'], x: number, y: number): CardInsert {
  return {
    board_id: boardId,
    title,
    body,
    date_label: '',
    due_date: null,
    tag,
    bg: tag === 'critical' ? '#FFD6C2' : tag === 'planned' ? '#FFF9C4' : tag === 'done' ? '#D4EDD8' : 'white',
    x,
    y,
    rotation: 0,
    card_width: 210,
    card_height: null,
    collapsed: false,
    locked: false,
  }
}

export function buildBoardTemplatePayload({
  templateId,
  boardId,
  now = new Date().toISOString(),
  createId = () => crypto.randomUUID(),
}: BuildBoardTemplatePayloadInput): BoardTemplatePayload {
  const names: Record<BoardTemplateId, string[]> = {
    'weekly-plan': ['Top Priority', 'Must Do', 'Waiting On', 'Friday Review'],
    'project-brainstorm': ['Problem', 'Audience', 'Wild Ideas', 'Next Experiment'],
    'content-calendar': ['Post Idea', 'Draft', 'Review', 'Publish'],
    'decision-matrix': ['Option A', 'Option B', 'Risks', 'Decision'],
  }
  const frameType: Record<BoardTemplateId, FrameInstance['type']> = {
    'weekly-plan': 'personal-kanban',
    'project-brainstorm': 'start-stop-continue',
    'content-calendar': 'personal-kanban',
    'decision-matrix': 'eisenhower',
  }
  const labels = names[templateId]
  const cards = labels.map((title, i) => card(
    boardId,
    title,
    i === 0 ? 'Add the key notes here.' : '',
    i === 0 ? 'critical' : i === 3 ? 'done' : 'planned',
    120 + (i % 2) * 260,
    150 + Math.floor(i / 2) * 190,
  ))
  const frames: FrameInstance[] = [{
    id: createId(),
    type: frameType[templateId],
    name: BOARD_TEMPLATES.find(t => t.id === templateId)?.name,
    x: 70,
    y: 90,
    width: 700,
    height: 430,
  }]
  const textBlocks: TextBlock[] = [{
    id: createId(),
    board_id: boardId,
    html: '<b>Start here</b><br>Shape this board into your own workflow.',
    x: 820,
    y: 120,
    width: 280,
    created_at: now,
  }]
  const goalTags: GoalTag[] = tagBase.map(([label, bg, color], i) => ({
    id: createId(),
    board_id: boardId,
    label,
    bg,
    color,
    x: 820,
    y: 250 + i * 48,
    created_at: now,
  }))
  return { cards, goalTags, frames, textBlocks }
}
