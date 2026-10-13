import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Card, GoalTag } from '../types'
import { restoreBoardSnapshot } from './db'

const values: Record<string, string> = {}
vi.stubGlobal('localStorage', {
  getItem: (key: string) => values[key] ?? null,
  setItem: (key: string, value: string) => { values[key] = value },
  removeItem: (key: string) => { delete values[key] },
})

function card(id: string, board_id: string, title: string): Card {
  return {
    id, board_id, title, body: '', date_label: '', due_date: null, tag: 'idea', bg: '#fff',
    x: 0, y: 0, rotation: 0, card_width: 185, card_height: null, collapsed: false, locked: false,
    created_at: '2026-01-01', updated_at: '2026-01-01',
  }
}

function tag(id: string, board_id: string, label: string): GoalTag {
  return { id, board_id, label, bg: '#fff', color: '#000', x: 0, y: 0, created_at: '2026-01-01' }
}

beforeEach(() => {
  for (const key of Object.keys(values)) delete values[key]
})

describe('restoreBoardSnapshot', () => {
  it('persists the undone board state while leaving other boards unchanged', () => {
    const previousCard = card('restored', 'board-1', 'Restored note')
    const otherCard = card('other', 'board-2', 'Other board note')
    const previousTag = tag('restored-tag', 'board-1', 'Original tag')
    const otherTag = tag('other-tag', 'board-2', 'Other board tag')
    values.ideaboard_cards = JSON.stringify([card('deleted', 'board-1', 'Deleted note'), otherCard])
    values.ideaboard_goal_tags = JSON.stringify([tag('changed-tag', 'board-1', 'Changed tag'), otherTag])

    restoreBoardSnapshot('board-1', [previousCard], [previousTag])

    expect(JSON.parse(values.ideaboard_cards)).toEqual([otherCard, previousCard])
    expect(JSON.parse(values.ideaboard_goal_tags)).toEqual([otherTag, previousTag])
  })

  it('does not import snapshot rows belonging to a different board', () => {
    const unrelatedCard = card('unrelated', 'board-2', 'Unrelated')
    values.ideaboard_cards = JSON.stringify([unrelatedCard])

    restoreBoardSnapshot('board-1', [card('foreign', 'board-2', 'Foreign')], [])

    expect(JSON.parse(values.ideaboard_cards)).toEqual([unrelatedCard])
  })
})
