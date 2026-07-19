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

function card(
  boardId: string,
  title: string,
  body: string,
  tag: CardInsert['tag'],
  x: number,
  y: number,
  width = 210,
): CardInsert {
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
    card_width: width,
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
  const frameType: Record<BoardTemplateId, FrameInstance['type']> = {
    'weekly-plan': 'personal-kanban',
    'project-brainstorm': 'start-stop-continue',
    'content-calendar': 'personal-kanban',
    'decision-matrix': 'impact-effort',
  }

  const cardsByTemplate: Record<BoardTemplateId, CardInsert[]> = {
    'weekly-plan': [
      card(boardId, 'Top Priority', 'What must be true by Friday?', 'critical', 120, 150, 230),
      card(boardId, 'Must Do', 'Client reply, prototype polish, invoice follow-up.', 'planned', 390, 150, 240),
      card(boardId, 'Waiting On', 'Feedback, source file, meeting confirmation.', 'planned', 390, 345, 240),
      card(boardId, 'Friday Review', 'Wins, loose ends, next week focus.', 'done', 660, 345, 230),
    ],
    'project-brainstorm': [
      card(boardId, 'Campaign Goal', 'Sell 100 weekend drinks without discounting the hero product.', 'critical', 115, 145, 250),
      card(boardId, 'Audience Clues', 'Office lunch crowd, students, regulars who order pastries.', 'idea', 420, 135, 240),
      card(boardId, 'Wild Hooks', 'Limited flavour drop, receipt raffle, barista pick of the day.', 'planned', 190, 335, 260),
      card(boardId, 'AI Prompt', 'Ask AI for 10 Instagram hooks, then keep only the strongest 3.', 'idea', 515, 330, 270),
      card(boardId, 'Next Experiment', 'Launch one reel, one counter sign, and one WhatsApp message.', 'done', 325, 505, 310),
    ],
    'content-calendar': [
      card(boardId, 'Mon: Short Reel', 'Hook: 3 mistakes people make when planning a launch.', 'critical', 115, 145, 240),
      card(boardId, 'Wed: Carousel Draft', 'Turn AI outline into 6 slides and add examples.', 'planned', 390, 145, 250),
      card(boardId, 'Fri: Newsletter', 'Use board notes as the first draft, then tighten CTA.', 'planned', 665, 145, 250),
      card(boardId, 'Review Queue', 'Check claims, screenshots, and tone before publishing.', 'idea', 390, 350, 250),
      card(boardId, 'Published Assets', 'Move completed posts here with date and link.', 'done', 665, 455, 250),
    ],
    'decision-matrix': [
      card(boardId, 'AI Research Summary', 'Fast to ship, high leverage. Needs source checking.', 'critical', 150, 160, 255),
      card(boardId, 'PDF Import Polish', 'Useful for real workflows, but touches storage and rendering.', 'planned', 500, 170, 265),
      card(boardId, 'Team Sharing', 'High value later; needs auth, sync, and conflict handling.', 'idea', 500, 405, 265),
      card(boardId, 'Theme Tweaks', 'Low effort, nice quality-of-life improvement.', 'done', 150, 430, 255),
      card(boardId, 'Decision', 'Ship AI research workflow first; schedule PDF polish next.', 'planned', 835, 260, 280),
    ],
  }

  const cards = cardsByTemplate[templateId]
  const frames: FrameInstance[] = [{
    id: createId(),
    type: frameType[templateId],
    name: BOARD_TEMPLATES.find(t => t.id === templateId)?.name,
    x: templateId === 'decision-matrix' ? 90 : 70,
    y: 90,
    width: templateId === 'decision-matrix' ? 760 : templateId === 'content-calendar' ? 900 : 700,
    height: templateId === 'project-brainstorm' ? 560 : 470,
  }]
  const textBlocks: TextBlock[] = [{
    id: createId(),
    board_id: boardId,
    html: templateId === 'project-brainstorm'
      ? '<b>AI work example</b><br>Paste AI suggestions here, then drag the useful ones into Start / Stop / Continue.'
      : templateId === 'content-calendar'
        ? '<b>Publishing rhythm</b><br>Use AI for first drafts, then keep review and publish decisions visible.'
        : templateId === 'decision-matrix'
          ? '<b>Decision rule</b><br>Score each option by impact, effort, confidence, and risk before choosing.'
          : '<b>Start here</b><br>Shape this board into your own workflow.',
    x: templateId === 'decision-matrix' ? 920 : 820,
    y: 120,
    width: templateId === 'decision-matrix' ? 300 : 280,
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
