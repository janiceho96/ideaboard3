import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { BuiltinFrameworkType, FrameInstance } from '../types'
import FrameworkOverlay from '../components/FrameworkOverlay'
import { createCustomFrameworkTemplate, frameworkTypeFor } from '../lib/customFrameworks'
import {
  FRAMEWORK_REGISTRY, FRAMEWORK_GROUPS, VALID_TYPES, DEFAULTS,
  getFrameworkDefinition, resolveFrameworkSection,
  getFrameworkSectionNotes, setFrameworkSectionNotes, parseFrameInstances,
} from './useFrames'

// Historical persistence contract, independent of current registry definitions.
const savedKeys: Record<BuiltinFrameworkType, string[]> = {
  blank: [],
  eisenhower: ['top-left', 'top-right', 'bottom-left', 'bottom-right'],
  ooda: ['observe', 'orient', 'decide', 'act'],
  ikigai: ['top', 'right', 'bottom', 'left', 'center'],
  'wheel-of-life': ['top', 'right', 'bottom', 'left', 'center'],
  grow: ['goal', 'reality', 'options', 'will'],
  'smart-goals': ['specific', 'measurable', 'achievable', 'relevant', 'time-bound'],
  'start-stop-continue': ['left', 'middle', 'right'],
  'personal-kanban': ['left', 'middle', 'right'],
  'five-whys': ['problem', 'why1', 'why2', 'why3', 'why4', 'why5', 'root'],
  'daily-reflection': ['grateful', 'focus', 'wins', 'lessons', 'tomorrow'],
  okr: ['objective', 'kr1', 'kr2', 'kr3'],
  'energy-audit': ['top-left', 'top-right', 'bottom-left', 'bottom-right'],
  'eat-that-frog': ['frog1', 'task2', 'task3', 'task4', 'task5'],
  gtd: ['inbox', 'next', 'projects', 'waiting', 'someday'],
  stp: ['segment', 'target', 'position'],
  'marketing-mix': ['product', 'price', 'place', 'promotion'],
  aida: ['attention', 'interest', 'desire', 'action'],
  swot: ['strengths', 'weaknesses', 'opportunities', 'threats'],
  'customer-journey': ['awareness', 'consideration', 'purchase', 'onboarding', 'retention'],
  'first-principles': ['assumptions', 'truths', 'rebuild'],
  'six-thinking-hats': ['white', 'red', 'black', 'yellow', 'green', 'blue'],
  scamper: ['substitute', 'combine', 'adapt', 'modify', 'put', 'eliminate', 'reverse'],
  'pros-cons': ['pros', 'cons'],
  'impact-effort': ['quick-wins', 'major-projects', 'fill-ins', 'time-sinks'],
}
const frameFor = (type: BuiltinFrameworkType): FrameInstance => ({
  id: 'saved-frame', type, x: 0, y: 0, ...DEFAULTS[type],
  notes: 'General notes',
  noteAreas: Object.fromEntries([...savedKeys[type].map(key => [key, `Saved ${key}`]), ['unknown-old-key', 'Keep me']]),
})
const renderFrame = (frame: FrameInstance) => renderToStaticMarkup(createElement(FrameworkOverlay, {
  frame, dark: false, selected: true,
  onMoveStart() {}, onResizeStart() {}, onDelete() {}, onSelect() {},
  onTypeChange() {}, onRename() {}, onUpdateNotes() {}, onUpdateNoteArea() {},
}))

describe('shared framework registry', () => {
  it('covers every persisted type and offers exactly the supported named frameworks', () => {
    expect([...VALID_TYPES].sort()).toEqual(Object.keys(savedKeys).sort())
    const offered = FRAMEWORK_GROUPS.flatMap(entry => 'key' in entry ? [entry.key] : [])
    expect(offered).toEqual(VALID_TYPES.filter(type => type !== 'blank'))
    expect(getFrameworkDefinition('blank')?.selectable).toBe(false)
    expect(getFrameworkDefinition('blank')?.sections).toEqual([])
    expect(getFrameworkDefinition('invalid')).toBeUndefined()
    expect(getFrameworkDefinition('__proto__')).toBeUndefined()
  })

  for (const type of Object.keys(savedKeys) as BuiltinFrameworkType[]) {
    it(`${type}: preserves saved keys and renders each writable section`, () => {
      const definition = FRAMEWORK_REGISTRY[type]
      const frame = frameFor(type)
      expect(definition.selectionGuidance.length).toBeGreaterThan(10)
      expect(definition.sourceRequirements.length).toBeGreaterThan(10)
      if (type !== 'blank') expect(definition.sections.length).toBeGreaterThan(0)
      const allSections = [...definition.sections, ...definition.legacySections]
      expect(new Set(allSections.map(section => section.id)).size).toBe(allSections.length)
      const markup = renderFrame(frame)
      for (const section of definition.sections) {
        expect(markup).toContain(`aria-label="${section.label}"`)
        expect(section.writingGuidance.length).toBeGreaterThan(10)
        expect(section.left).toBeGreaterThanOrEqual(0)
        expect(section.top).toBeGreaterThanOrEqual(0)
        expect(section.left + section.width).toBeLessThanOrEqual(100)
        expect(section.top + section.height).toBeLessThanOrEqual(100)
      }
      for (const key of savedKeys[type]) {
        const section = resolveFrameworkSection(type, key)
        expect(section, key).toBeDefined()
        expect(getFrameworkSectionNotes(frame, section!.id)).toBe(`Saved ${key}`)
        const next = setFrameworkSectionNotes(frame, section!.id, 'Updated')
        expect(next.noteAreas?.[key]).toBe('Updated')
        expect(next.noteAreas?.['unknown-old-key']).toBe('Keep me')
        expect(next.notes).toBe('General notes')
        expect(frame.noteAreas?.[key]).toBe(`Saved ${key}`)
      }
      expect(parseFrameInstances(JSON.stringify([frame]), null)).toEqual([frame])
    })
  }

  it('scopes generic keys by meaning instead of copying positional labels', () => {
    expect(resolveFrameworkSection('eisenhower', 'top-left')?.id).toBe('do-first')
    expect(resolveFrameworkSection('energy-audit', 'top-left')?.id).toBe('flow')
    expect(resolveFrameworkSection('start-stop-continue', 'left')?.id).toBe('start')
    expect(resolveFrameworkSection('personal-kanban', 'left')?.id).toBe('todo')
    expect(resolveFrameworkSection('ikigai', 'left')?.id).toBe('paid-for')
    expect(resolveFrameworkSection('stp', 'target')?.id).toBe('targeting')
    expect(resolveFrameworkSection('personal-kanban', 'start')).toBeUndefined()
  })

  it('adds eight Wheel of Life editors while preserving five ambiguous older notes', () => {
    const frame = frameFor('wheel-of-life')
    expect(FRAMEWORK_REGISTRY['wheel-of-life'].sections.map(section => section.id)).toEqual([
      'career', 'finance', 'health', 'family', 'romance', 'growth', 'fun', 'home',
    ])
    const next = setFrameworkSectionNotes(frame, 'career', 'New career reflection')
    expect(next.noteAreas?.career).toBe('New career reflection')
    expect(next.noteAreas?.top).toBe('Saved top')
    expect(getFrameworkSectionNotes(next, 'career')).toBe('New career reflection')
    expect(resolveFrameworkSection('wheel-of-life', 'top')?.id).toBe('legacy-top')
    const markup = renderFrame(next)
    expect(markup).toContain('Earlier notes (5)')
    expect(markup).toContain('Saved top')
    expect(markup).toContain('New career reflection')
  })

  it('supports semantic incoming keys, respects cleared storage text and rejects unknown sections', () => {
    const frame = { ...frameFor('eisenhower'), noteAreas: { 'do-first': 'Semantic draft' } }
    expect(getFrameworkSectionNotes(frame, 'do-first')).toBe('Semantic draft')
    const cleared = setFrameworkSectionNotes(frame, 'do-first', '')
    expect(getFrameworkSectionNotes(cleared, 'do-first')).toBe('')
    expect(cleared.noteAreas?.['do-first']).toBe('Semantic draft')
    expect(setFrameworkSectionNotes(frame, 'unknown', 'Wrong')).toBe(frame)
    expect(getFrameworkSectionNotes(frame, 'unknown')).toBeUndefined()
  })

  it('preserves notes when migrating an older single-framework record', () => {
    const old = JSON.stringify({ type: 'ikigai', notes: 'Original general note', noteAreas: { left: 'Original paid work', extra: 'Extra note' } })
    const [migrated] = parseFrameInstances(null, old)
    expect(migrated.notes).toBe('Original general note')
    expect(migrated.noteAreas).toEqual({ left: 'Original paid work', extra: 'Extra note' })
    expect(getFrameworkSectionNotes(migrated, 'paid-for')).toBe('Original paid work')
  })

  it('renders, edits and persists an embedded custom framework without relying on the library', () => {
    const customFramework = createCustomFrameworkTemplate({
      label: 'Campaign learning loop',
      purpose: 'Turn launch evidence into a clear next experiment.',
      layout: 'flow',
      sections: [
        { label: 'Signal', guidance: 'What did people do?' },
        { label: 'Meaning', guidance: 'What can the evidence support?' },
      ],
    }, () => 'custom-id')
    const frame: FrameInstance = {
      id: 'custom-frame', type: frameworkTypeFor(customFramework), customFramework,
      x: 10, y: 20, width: customFramework.defaultSize.width, height: customFramework.defaultSize.height,
      noteAreas: { [customFramework.sections[0].storageKey]: 'Four people returned.' },
    }
    expect(getFrameworkDefinition(frame.type, customFramework)?.label).toBe('Campaign learning loop')
    expect(resolveFrameworkSection(frame.type, customFramework.sections[0].id, customFramework)?.label).toBe('Signal')
    expect(getFrameworkSectionNotes(frame, customFramework.sections[0].id)).toBe('Four people returned.')
    expect(setFrameworkSectionNotes(frame, customFramework.sections[1].id, 'Repeat with more people.').noteAreas?.[customFramework.sections[1].storageKey]).toBe('Repeat with more people.')
    const markup = renderFrame(frame)
    expect(markup).toContain('aria-label="Signal"')
    expect(markup).toContain('Campaign learning loop')
    expect(parseFrameInstances(JSON.stringify([frame]), null)).toEqual([frame])
    expect(parseFrameInstances(JSON.stringify([{ ...frame, customFramework: undefined }]), null)).toEqual([])
  })
})
