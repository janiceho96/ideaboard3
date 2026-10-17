import type { Board, Card } from '../types'

type ActivityCard = Pick<Card, 'board_id' | 'updated_at'>

export function sortBoardsByRecentActivity(boards: Board[], cards: ActivityCard[]): Board[] {
  const latestActivity = new Map<string, number>()

  for (const card of cards) {
    const timestamp = Date.parse(card.updated_at)
    if (!Number.isFinite(timestamp)) continue

    const previous = latestActivity.get(card.board_id) ?? Number.NEGATIVE_INFINITY
    if (timestamp > previous) latestActivity.set(card.board_id, timestamp)
  }

  return boards
    .map((board, index) => {
      const createdAt = Date.parse(board.created_at)
      return {
        board,
        index,
        activity: latestActivity.get(board.id) ?? (Number.isFinite(createdAt) ? createdAt : 0),
      }
    })
    .sort((a, b) => b.activity - a.activity || a.index - b.index)
    .map(({ board }) => board)
}
