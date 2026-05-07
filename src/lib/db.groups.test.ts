import { describe, it, expect, beforeEach, vi } from 'vitest'

// localStorage shim for node test environment
let store: Record<string, string> = {}
vi.stubGlobal('localStorage', {
  getItem:    (k: string) => store[k] ?? null,
  setItem:    (k: string, v: string) => { store[k] = v },
  removeItem: (k: string) => { delete store[k] },
  clear:      () => { store = {} },
})

import {
  fetchGroups, createGroup, updateGroup, deleteGroup, reorderGroups,
  fetchBoardGroups, addBoardToGroup, removeBoardFromGroup,
} from './db'

beforeEach(() => { store = {} })

describe('fetchGroups', () => {
  it('returns [] when key missing', async () => {
    expect(await fetchGroups()).toEqual([])
  })
  it('returns groups sorted by order asc', async () => {
    store['ideaboard_groups'] = JSON.stringify([
      { id: 'b', name: 'B', order: 1, created_at: '2024-01-02' },
      { id: 'a', name: 'A', order: 0, created_at: '2024-01-01' },
    ])
    const groups = await fetchGroups()
    expect(groups[0].id).toBe('a')
    expect(groups[1].id).toBe('b')
  })
})

describe('createGroup', () => {
  it('inserts with order 0 and shifts existing groups up', async () => {
    store['ideaboard_groups'] = JSON.stringify([
      { id: 'x', name: 'X', order: 0, created_at: '2024-01-01' },
    ])
    const g = await createGroup('New')
    expect(g.order).toBe(0)
    const all = await fetchGroups()
    expect(all[0].id).toBe(g.id)
    expect(all[1].id).toBe('x')
    expect(all[1].order).toBe(1)
  })
})

describe('deleteGroup', () => {
  it('removes the group and its BoardGroup rows, leaves others intact', async () => {
    store['ideaboard_groups'] = JSON.stringify([
      { id: 'g1', name: 'G1', order: 0, created_at: '2024-01-01' },
      { id: 'g2', name: 'G2', order: 1, created_at: '2024-01-01' },
    ])
    store['ideaboard_board_groups'] = JSON.stringify([
      { board_id: 'b1', group_id: 'g1' },
      { board_id: 'b2', group_id: 'g2' },
    ])
    await deleteGroup('g1')
    const groups = await fetchGroups()
    expect(groups).toHaveLength(1)
    expect(groups[0].id).toBe('g2')
    const bgs = await fetchBoardGroups()
    expect(bgs).toHaveLength(1)
    expect(bgs[0].group_id).toBe('g2')
  })
})

describe('reorderGroups', () => {
  it('assigns order = index position of each id', async () => {
    store['ideaboard_groups'] = JSON.stringify([
      { id: 'a', name: 'A', order: 0, created_at: '2024-01-01' },
      { id: 'b', name: 'B', order: 1, created_at: '2024-01-01' },
    ])
    await reorderGroups(['b', 'a'])
    const groups = await fetchGroups()
    expect(groups[0].id).toBe('b')
    expect(groups[1].id).toBe('a')
  })
})

describe('addBoardToGroup', () => {
  it('creates a membership row', async () => {
    await addBoardToGroup('b1', 'g1')
    expect(await fetchBoardGroups()).toEqual([{ board_id: 'b1', group_id: 'g1' }])
  })
  it('is idempotent — does not create duplicates', async () => {
    await addBoardToGroup('b1', 'g1')
    await addBoardToGroup('b1', 'g1')
    expect(await fetchBoardGroups()).toHaveLength(1)
  })
})

describe('removeBoardFromGroup', () => {
  it('removes the matching row and leaves others intact', async () => {
    store['ideaboard_board_groups'] = JSON.stringify([
      { board_id: 'b1', group_id: 'g1' },
      { board_id: 'b2', group_id: 'g1' },
    ])
    await removeBoardFromGroup('b1', 'g1')
    const bgs = await fetchBoardGroups()
    expect(bgs).toHaveLength(1)
    expect(bgs[0].board_id).toBe('b2')
  })
})
