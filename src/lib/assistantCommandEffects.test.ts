import { describe, expect, it } from 'vitest'
import type { Card } from '../types'
import type {
  AssistantBoardCommandContext,
  AssistantBoardCommandPlan,
} from './assistantCommandPlan'
import { buildAssistantCommandEffects } from './assistantCommandEffects'

const first: Card = {
  id: 'one',
  board_id: 'board',
  title: 'First',
  body: 'Keep the customer promise clear.',
  date_label: '',
  due_date: null,
  tag: 'idea',
  bg: 'white',
  x: 100,
  y: 200,
  rotation: 0,
  card_width: 200,
  card_height: null,
  collapsed: false,
  locked: false,
  created_at: '1',
  updated_at: '1',
}
const second: Card = {
  ...first,
  id: 'two',
  title: 'Second',
  body: 'Support the same promise.',
  x: 500,
  y: 400,
}
const context: AssistantBoardCommandContext = {
  boardId: 'board',
  intent: 'emphasis',
  goal: 'Update these notes',
  today: '2026-10-13',
  history: [],
  sources: [],
  cards: [first, second],
}

describe('assistant board command effects', () => {
  it('combines exact highlights and note updates into a single reversible write per card', () => {
    const plan: AssistantBoardCommandPlan = {
      response: 'Marked the important point.',
      operations: [
        {
          type: 'highlight_text',
          cardId: first.id,
          exactQuote: 'customer promise',
          color: 'yellow',
        },
        { type: 'update_note', cardId: first.id, changes: { tag: 'critical' } },
      ],
    }
    const effects = buildAssistantCommandEffects(plan, context, 'task', { x: 0, y: 0 })
    expect(effects.cardWrites).toHaveLength(1)
    expect(effects.cardWrites[0].before).toEqual({ body: first.body, tag: 'idea' })
    expect(effects.cardWrites[0].after).toEqual({
      body: 'Keep the {{ib-highlight:yellow}}customer promise{{/ib-highlight}} clear.',
      tag: 'critical',
    })
  })

  it('creates app-positioned, source-linked draft notes', () => {
    const plan: AssistantBoardCommandPlan = {
      response: '',
      operations: [
        {
          type: 'create_note',
          title: 'Next step',
          body: 'Test the message.',
          kind: 'action',
          tag: 'planned',
          color: 'coral',
          dueDate: null,
          sourceIds: ['source-1'],
        },
      ],
    }
    const [created] = buildAssistantCommandEffects(plan, context, 'task', { x: 900, y: 1200 }).cards
    expect(created).toMatchObject({
      title: 'Next step',
      body: 'Test the message.',
      tag: 'planned',
      bg: '#FFB4A2',
      x: 900,
      y: 1200,
      ai_task_id: 'task',
      ai_source_ids: ['source-1'],
      ai_assisted: true,
    })
    expect(created).not.toHaveProperty('id')
  })

  it('computes a stable reading-order layout locally rather than accepting model coordinates', () => {
    const plan: AssistantBoardCommandPlan = {
      response: '',
      operations: [{ type: 'arrange_notes', cardIds: ['two', 'one'], layout: 'reading_order' }],
    }
    const effects = buildAssistantCommandEffects(plan, context, 'task', { x: 0, y: 0 })
    expect(effects.cardWrites).toEqual([
      { cardId: 'two', before: { x: 500, y: 400 }, after: { x: 100, y: 200 } },
      { cardId: 'one', before: { x: 100, y: 200 }, after: { x: 348, y: 200 } },
    ])
  })

  it('creates visible group headings and moves selected notes into app-calculated clusters', () => {
    const plan: AssistantBoardCommandPlan = {
      response: 'Grouped the notes by theme.',
      operations: [
        {
          type: 'group_notes',
          groups: [
            { label: 'Customer insight', cardIds: ['one'] },
            { label: 'Launch activity', cardIds: ['two'] },
          ],
        },
      ],
    }
    const effects = buildAssistantCommandEffects(plan, context, 'task', { x: 0, y: 0 })
    expect(
      effects.cards.map((card) => ({
        title: card.title,
        collapsed: card.collapsed,
        date_label: card.date_label,
      })),
    ).toEqual([
      { title: 'Customer insight', collapsed: true, date_label: 'AI group heading' },
      { title: 'Launch activity', collapsed: true, date_label: 'AI group heading' },
    ])
    expect(effects.cardWrites).toEqual([
      { cardId: 'one', before: { x: 100, y: 200 }, after: { x: 100, y: 288 } },
      { cardId: 'two', before: { x: 500, y: 400 }, after: { x: 100, y: 626 } },
    ])
  })
})
