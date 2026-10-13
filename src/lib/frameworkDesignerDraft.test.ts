import { describe, expect, it } from 'vitest'
import { clearFrameworkDesignerDraft, frameworkDesignerDraftKey, readFrameworkDesignerDraft, writeFrameworkDesignerDraft, type FrameworkDesignerDraft } from './frameworkDesignerDraft'

const draft: FrameworkDesignerDraft = { goal: 'Compare opportunities', label: '', purpose: '', layout: 'matrix', sections: [{ label: '', guidance: '' }], templateRevision: 1, savedStructure: '', selectedSourceIds: ['note-1'] }
function store() {
  const values = new Map<string, string>()
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value) }, removeItem: (key: string) => { values.delete(key) } }
}
describe('framework designer recovery', () => {
  it('keeps incomplete local designs and isolates boards and saved templates', () => {
    const storage = store(), key = frameworkDesignerDraftKey('board-a')
    expect(writeFrameworkDesignerDraft(key, draft, storage)).toBe(true)
    expect(readFrameworkDesignerDraft(key, storage)).toEqual(draft)
    expect(readFrameworkDesignerDraft(frameworkDesignerDraftKey('board-b'), storage)).toBeNull()
    expect(readFrameworkDesignerDraft(frameworkDesignerDraftKey('board-a', 'saved-template'), storage)).toBeNull()
    expect(frameworkDesignerDraftKey('board-a_foo', 'bar')).not.toBe(frameworkDesignerDraftKey('board-a', 'foo_bar'))
    expect(frameworkDesignerDraftKey('board-a')).not.toBe(frameworkDesignerDraftKey('board-a', 'new'))
    expect(clearFrameworkDesignerDraft(key, storage)).toBe(true)
    expect(readFrameworkDesignerDraft(key, storage)).toBeNull()
  })
  it('does not recover sharing consent or source bodies', () => {
    const storage = store()
    storage.setItem('key', JSON.stringify({ ...draft, sendSources: true, sources: [{ body: 'private reference' }] }))
    expect(readFrameworkDesignerDraft('key', storage)).toEqual(draft)
  })
  it.each([{ ...draft, layout: 'unknown' }, { ...draft, goal: 'a'.repeat(3001) }, { ...draft, sections: Array(9).fill({ label: '', guidance: '' }) }, { ...draft, templateRevision: 0 }, { ...draft, selectedSourceIds: ['a', 1] }])('ignores invalid or oversized drafts', invalid => {
    const storage = store(); storage.setItem('key', JSON.stringify(invalid))
    expect(readFrameworkDesignerDraft('key', storage)).toBeNull()
  })
  it('handles unavailable storage without losing the in-memory draft', () => {
    expect(writeFrameworkDesignerDraft('key', draft, { setItem: () => { throw new Error('quota') } })).toBe(false)
    expect(readFrameworkDesignerDraft('key', { getItem: () => '{' })).toBeNull()
    expect(clearFrameworkDesignerDraft('key', { removeItem: () => { throw new Error('blocked') } })).toBe(false)
    expect(draft.goal).toBe('Compare opportunities')
  })
})
