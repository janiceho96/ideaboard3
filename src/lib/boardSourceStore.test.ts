import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { deleteBoardSources, exportAllBoardSources, listBoardSources, saveBoardSources, type BoardSource } from './boardSourceStore'

const first: BoardSource = { id: 'source-1', board_id: 'board-1', kind: 'pdf-page', title: 'brief.pdf', text: 'Page one text', mime_type: 'application/pdf', slide_id: 'slide-1', page_number: 1, total_pages: 3, created_at: 'now' }
const second: BoardSource = { id: 'source-2', board_id: 'board-2', kind: 'markdown', title: 'notes.md', text: '# Ideas', mime_type: 'text/markdown', created_at: 'now' }

describe('persistent board sources', () => {
  it('stores sources by ID, filters by board, and removes selected records', async () => {
    await saveBoardSources([first, second])
    expect(await listBoardSources('board-1')).toEqual([first])
    expect(await exportAllBoardSources()).toEqual(expect.arrayContaining([first, second]))
    await deleteBoardSources([first.id])
    expect(await listBoardSources('board-1')).toEqual([])
    expect(await listBoardSources('board-2')).toEqual([second])
  })
})
