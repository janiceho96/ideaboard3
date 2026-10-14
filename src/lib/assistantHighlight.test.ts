import { describe, expect, it } from 'vitest'
import { assistantCommandRequest, assertAssistantCommandContextCurrent, validateAssistantBoardCommandPlan, type AssistantBoardCommandContext } from './assistantCommandPlan'
import { buildAssistantCommandEffects } from './assistantCommandEffects'
import { getFrameworkSectionNotes } from '../hooks/useFrames'
import type { FrameInstance } from '../types'

const frame: FrameInstance = { id: 'selected-frame', type: 'ooda', x: 0, y: 0, width: 800, height: 560, notes: '', noteAreas: { observe: 'The agent imports articles into an Obsidian vault. Setup stays separate.' } }
const context: AssistantBoardCommandContext = { boardId: 'board-a', intent: 'emphasis', goal: 'help me to highlight some key point', today: '2026-10-14', history: [], cards: [], sources: [], frames: [frame] }
const highlight = { type: 'highlight_section', frameId: frame.id, sectionId: 'observe', exactQuote: 'imports articles into an Obsidian vault', color: 'yellow', mode: 'add' }

describe('visible framework highlight commands', () => {
  it('sends the native command discriminator, board identity and selected writing', () => {
    const input = JSON.parse(assistantCommandRequest(context).input)
    expect(input.command).toBe('board-command')
    expect(input.boardId).toBe(context.boardId)
    expect(input.frameworks[0].sections.some((section: { text: string }) => section.text.includes('imports articles'))).toBe(true)
  })
  it('preserves writing, merges marks in one section and records one reversible change', () => {
    const plan = validateAssistantBoardCommandPlan({ response: 'Highlight the key workflow.', operations: [highlight, { ...highlight, exactQuote: 'Setup stays separate', color: 'mint' }] }, context)
    const effects = buildAssistantCommandEffects(plan, context, 'task-a', { x: 0, y: 0 })
    expect(effects.sections).toHaveLength(1)
    expect(effects.sections[0].before).toBe(getFrameworkSectionNotes(frame, 'observe'))
    expect(effects.sections[0].after).toContain('{{ib-highlight:yellow}}imports articles into an Obsidian vault{{/ib-highlight}}')
    expect(effects.sections[0].after.replace(/\{\{(?:ib-highlight:[a-z]+|\/ib-highlight)\}\}/g, '')).toBe(effects.sections[0].before)
  })
  it('rejects another frame, invented sections and invented quotes before applying', () => {
    for (const patch of [{ frameId: 'other-frame' }, { sectionId: 'invented' }, { exactQuote: 'Invented evidence' }]) {
      expect(() => validateAssistantBoardCommandPlan({ response: '', operations: [{ ...highlight, ...patch }] }, context)).toThrow()
    }
  })
  it('refuses newly written key-point notes when only highlighting is requested', () => {
    expect(() => validateAssistantBoardCommandPlan({ response: 'Rewrote the key points.', operations: [{ type: 'create_note', title: 'Key point', body: 'Rewritten writing', kind: 'note', tag: 'idea', color: 'yellow', dueDate: null, sourceIds: [] }] }, context)).toThrow(/different action/)
  })
  it('rejects a stale selected framework before apply', () => {
    expect(() => assertAssistantCommandContextCurrent(context, { boardId: context.boardId, cards: [], sources: [], frames: [{ ...frame, name: 'Changed' }] })).toThrow(/changed/)
  })
  it('removes the exact mark without changing its text', () => {
    const marked = { ...frame, noteAreas: { observe: 'The agent {{ib-highlight:yellow}}imports articles into an Obsidian vault{{/ib-highlight}}. Setup stays separate.' } }
    const selected = { ...context, frames: [marked] }
    const plan = validateAssistantBoardCommandPlan({ response: '', operations: [{ ...highlight, mode: 'remove' }] }, selected)
    const effects = buildAssistantCommandEffects(plan, selected, 'task-b', { x: 0, y: 0 })
    expect(effects.sections[0].after).toBe(getFrameworkSectionNotes(frame, 'observe'))
  })
})
