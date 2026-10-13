import { describe, expect, it } from 'vitest'
import { createWorkspaceBackup, parseWorkspaceBackup, restoreWorkspaceBackup } from './workspaceBackup'

function memoryStorage(initial: Record<string, string> = {}): Storage {
  const values = new Map(Object.entries(initial))
  return {
    get length() { return values.size },
    clear: () => values.clear(),
    getItem: key => values.get(key) ?? null,
    key: index => [...values.keys()][index] ?? null,
    removeItem: key => { values.delete(key) },
    setItem: (key, value) => { values.set(key, String(value)) },
  }
}

describe('workspace backup', () => {
  it('exports Ideaboard storage and slide images while excluding unrelated browser data', async () => {
    const backup = await createWorkspaceBackup(memoryStorage({
      ideaboard_boards: '[{"id":"board-a"}]',
      ideaboard_dark: 'true',
      unrelated: 'leave out',
    }), async () => ({ 'slide-a': 'data:image/png;base64,abc' }))

    expect(backup.storage).toEqual({
      ideaboard_boards: '[{"id":"board-a"}]',
      ideaboard_dark: 'true',
    })
    expect(backup.slideImages).toEqual({ 'slide-a': 'data:image/png;base64,abc' })
    expect(backup.sources).toEqual([])
  })

  it('rejects unsupported and malformed backups', () => {
    expect(() => parseWorkspaceBackup('{"schema":"other","version":1}')).toThrow(/supported/)
    expect(() => parseWorkspaceBackup(JSON.stringify({
      schema: 'ideaboard.workspace', version: 1, storage: { unrelated: 'x' }, slideImages: {},
    }))).toThrow(/invalid saved data/)
  })

  it('restores images and merges board records without dropping existing boards', async () => {
    const storage = memoryStorage({
      ideaboard_boards: JSON.stringify([{ id: 'existing', name: 'Keep me' }, { id: 'shared', name: 'Old' }]),
    })
    const writtenImages: Record<string, string>[] = []
    const writtenSources: unknown[][] = []
    const raw = JSON.stringify({
      schema: 'ideaboard.workspace',
      version: 1,
      exportedAt: '2026-09-28T00:00:00.000Z',
      storage: { ideaboard_boards: JSON.stringify([{ id: 'shared', name: 'Updated' }, { id: 'imported', name: 'New board' }]) },
      slideImages: { 'slide-a': 'data:image/png;base64,abc' },
      sources: [{ id: 'source-a', board_id: 'imported', kind: 'markdown', title: 'Brief', text: 'Plan', mime_type: 'text/markdown', created_at: 'now' }],
    })

    const result = await restoreWorkspaceBackup(raw, storage, async images => { writtenImages.push(images) }, async sources => { writtenSources.push(sources) })

    expect(JSON.parse(storage.getItem('ideaboard_boards') ?? '[]')).toEqual([
      { id: 'existing', name: 'Keep me' },
      { id: 'shared', name: 'Updated' },
      { id: 'imported', name: 'New board' },
    ])
    expect(writtenImages).toEqual([{ 'slide-a': 'data:image/png;base64,abc' }])
    expect(writtenSources).toHaveLength(1)
    expect((writtenSources[0][0] as { text: string }).text).toBe('Plan')
    expect(result).toEqual({ boards: 2, slideImages: 1, sources: 1 })
  })
})
