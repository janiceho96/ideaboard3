import { describe, expect, it } from 'vitest'
import type { Board } from '../types'
import { sortBoardsByRecentActivity } from './boardRecency'

const boards: Board[] = [
  { id: 'older', name: 'Older', owner_id: 'local', created_at: '2026-01-01T00:00:00.000Z' },
  { id: 'newer', name: 'Newer', owner_id: 'local', created_at: '2026-02-01T00:00:00.000Z' },
  { id: 'quiet', name: 'Quiet', owner_id: 'local', created_at: '2026-03-01T00:00:00.000Z' },
]

describe('sortBoardsByRecentActivity', () => {
  it('orders boards by their most recently edited card', () => {
    const sorted = sortBoardsByRecentActivity(boards, [
      { board_id: 'older', updated_at: '2026-04-01T00:00:00.000Z' },
      { board_id: 'older', updated_at: '2026-04-05T00:00:00.000Z' },
      { board_id: 'newer', updated_at: '2026-04-03T00:00:00.000Z' },
    ])

    expect(sorted.map(board => board.id)).toEqual(['older', 'newer', 'quiet'])
  })

  it('falls back to board creation time and preserves input order for ties', () => {
    const tiedBoards = [boards[1], boards[0]]
    const sorted = sortBoardsByRecentActivity(tiedBoards, [
      { board_id: 'older', updated_at: 'not-a-date' },
    ])

    expect(sorted.map(board => board.id)).toEqual(['newer', 'older'])
    expect(tiedBoards.map(board => board.id)).toEqual(['newer', 'older'])
  })
})
