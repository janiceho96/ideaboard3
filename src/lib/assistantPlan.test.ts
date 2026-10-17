import { describe, expect, it } from 'vitest'
import type { Card, FrameInstance } from '../types'
import {
  assertAssistantContextCurrent,
  assistantRequest,
  buildAssistantEffects,
  validateAssistantPlan,
  type AssistantContext,
  type AssistantFramework,
} from './assistantPlan'
import { createCustomFrameworkTemplate, frameworkTypeFor } from './customFrameworks'

const registry: AssistantFramework[] = [
  {
    type: 'swot',
    label: 'SWOT',
    guidance: 'Internal and external factors',
    width: 640,
    height: 540,
    sections: [
      {
        id: 'strengths',
        storageKey: 'top-left',
        label: 'Strengths',
        guidance: 'Internal advantages',
      },
      {
        id: 'weaknesses',
        storageKey: 'top-right',
        label: 'Weaknesses',
        guidance: 'Internal disadvantages',
      },
    ],
  },
]
const card: Card = {
  id: 'source',
  board_id: 'board',
  title: 'Cafe',
  body: 'Jess can make a reel. No main drink discount.',
  date_label: '',
  due_date: null,
  tag: 'idea',
  bg: 'white',
  x: 0,
  y: 0,
  card_width: 185,
  card_height: null,
  locked: false,
  collapsed: false,
  rotation: 0,
  created_at: '1',
  updated_at: '1',
}
const frame: FrameInstance = {
  id: 'frame',
  type: 'swot',
  x: 0,
  y: 0,
  width: 640,
  height: 540,
  noteAreas: { 'top-left': 'Existing writing' },
}
const context: AssistantContext = {
  boardId: 'board',
  command: 'build',
  goal: 'Plan a cafe campaign',
  sources: [card],
  replace: false,
}
const draft = () => ({
  response: 'Opening idea: start with the change in perspective.',
  explanation: 'SWOT compares relevant factors.',
  assumptions: ['Audience is not specified.'],
  frameworkRecommendation: {
    type: 'swot',
    rationale:
      'The source describes strengths and a constraint, so this framework separates internal factors.',
  },
  frames: [
    {
      type: 'swot',
      name: 'Cafe campaign',
      sections: [
        { id: 'strengths', text: 'No discount on main drink.', sourceIds: ['source'] },
        { id: 'weaknesses', text: 'Open question: stock levels?', sourceIds: [] },
      ],
    },
  ],
  sections: [],
  cards: [
    {
      title: 'Check stock',
      body: 'Proposed: check strawberry drink stock.',
      kind: 'action',
      sourceIds: ['source'],
    },
  ],
  revisions: [],
})

describe('assistant authorization and output validation', () => {
  it('explains an omitted native framework recommendation without a generic object error', () => {
    expect(() =>
      validateAssistantPlan({ ...draft(), frameworkRecommendation: undefined }, context, registry),
    ).toThrow('missing its framework recommendation')
  })
  it('accepts a complete framework with selected-source references', () => {
    const plan = validateAssistantPlan(draft(), context, registry)
    expect(plan.frames[0].type).toBe('swot')
    expect(plan.frameworkRecommendation?.rationale).toContain('separates internal factors')
    expect(plan.response).toBe('Opening idea: start with the change in perspective.')
  })
  it('accepts older drafts with no separate response and bounds new response text', () => {
    const legacy: Record<string, unknown> = draft()
    delete legacy.response
    expect(validateAssistantPlan(legacy, context, registry).response).toBe('')
    expect(() =>
      validateAssistantPlan({ ...draft(), response: 'x'.repeat(1201) }, context, registry),
    ).toThrow('oversized')
  })
  it('requires the recommendation to identify a framework actually included in the build', () => {
    const wrongType = draft()
    wrongType.frameworkRecommendation.type = 'not-real'
    expect(() => validateAssistantPlan(wrongType, context, registry)).toThrow(
      'framework from the draft',
    )
    const missingFrame = draft()
    missingFrame.frameworkRecommendation.type = 'other'
    expect(() => validateAssistantPlan(missingFrame, context, registry)).toThrow(
      'framework from the draft',
    )
  })
  it('recommends and creates a specific saved custom framework without losing its definition', () => {
    const customDefinition = createCustomFrameworkTemplate(
      {
        label: 'Launch learning loop',
        purpose: 'Turn a launch into the next experiment.',
        layout: 'flow',
        sections: [
          { label: 'Signal', guidance: 'What happened?' },
          { label: 'Next experiment', guidance: 'What should we test?' },
        ],
      },
      () => 'custom-framework',
    )
    const type = frameworkTypeFor(customDefinition)
    const customRegistry: AssistantFramework[] = [
      {
        type,
        label: customDefinition.label,
        guidance: customDefinition.purpose,
        width: customDefinition.defaultSize.width,
        height: customDefinition.defaultSize.height,
        customDefinition,
        sections: customDefinition.sections.map((section) => ({
          id: section.id,
          storageKey: section.storageKey,
          label: section.label,
          guidance: section.writingGuidance,
        })),
      },
    ]
    const customContext = { ...context, goal: 'Turn our pilot outcome into one better test.' }
    const request = assistantRequest(customContext, customRegistry)
    const sentFramework = JSON.parse(request.input).frameworks[0]
    expect(sentFramework).toMatchObject({
      type,
      label: customDefinition.label,
      guidance: customDefinition.purpose,
    })
    expect(sentFramework).not.toHaveProperty('customDefinition')
    const output = {
      ...draft(),
      frameworkRecommendation: {
        type,
        rationale: 'The sequence moves from observed signal to a testable next step.',
      },
      frames: [
        {
          type,
          name: 'Pilot review',
          sections: customDefinition.sections.map((section) => ({
            id: section.id,
            text: `Open question: ${section.label}.`,
            sourceIds: [],
          })),
        },
      ],
    }
    const plan = validateAssistantPlan(output, customContext, customRegistry)
    const effects = buildAssistantEffects(
      plan,
      customContext,
      customRegistry,
      'task',
      { x: 0, y: 0 },
      () => 'frame-id',
    )
    expect(plan.frameworkRecommendation?.type).toBe(type)
    expect(effects.frames[0].customFramework).toEqual(customDefinition)
    expect(effects.frames[0].noteAreas).toMatchObject(
      Object.fromEntries(
        customDefinition.sections.map((section) => [
          section.storageKey,
          `Open question: ${section.label}.`,
        ]),
      ),
    )
  })
  it('rejects invented frameworks, section IDs and incomplete coverage', () => {
    const unknown = draft()
    unknown.frames[0].type = 'not-real'
    expect(() => validateAssistantPlan(unknown, context, registry)).toThrow('unsupported')
    const wrongSection = draft()
    wrongSection.frames[0].sections[0].id = 'left'
    expect(() => validateAssistantPlan(wrongSection, context, registry)).toThrow('does not exist')
    const incomplete = draft()
    incomplete.frames[0].sections.pop()
    expect(() => validateAssistantPlan(incomplete, context, registry)).toThrow('every section')
  })
  it('rejects references and input notes belonging to other boards', () => {
    const wrong = draft()
    wrong.cards[0].sourceIds = ['another-note']
    expect(() => validateAssistantPlan(wrong, context, registry)).toThrow('selected context')
    expect(() =>
      validateAssistantPlan(
        draft(),
        { ...context, sources: [{ ...card, board_id: 'other' }] },
        registry,
      ),
    ).toThrow('another board')
  })
  it('rejects oversized writing and repeated section writes', () => {
    const huge = draft()
    huge.frames[0].sections[0].text = 'a'.repeat(6001)
    expect(() => validateAssistantPlan(huge, context, registry)).toThrow('oversized')
    const fill = {
      ...draft(),
      frameworkRecommendation: null,
      frames: [],
      sections: [
        { frameId: 'frame', sectionId: 'weaknesses', text: 'Draft', sourceIds: [] },
        { frameId: 'frame', sectionId: 'weaknesses', text: 'Repeated', sourceIds: [] },
      ],
    }
    expect(() =>
      validateAssistantPlan(fill, { ...context, command: 'fill', targetFrame: frame }, registry),
    ).toThrow('duplicate')
  })
  it('preserves occupied sections unless replacement was requested', () => {
    const fill = {
      ...draft(),
      frameworkRecommendation: null,
      frames: [],
      sections: [{ frameId: 'frame', sectionId: 'strengths', text: 'Replacement', sourceIds: [] }],
    }
    const target: AssistantContext = { ...context, command: 'fill', targetFrame: frame }
    expect(() => validateAssistantPlan(fill, target, registry)).toThrow('occupied')
    expect(
      validateAssistantPlan(fill, { ...target, replace: true }, registry).sections,
    ).toHaveLength(1)
    expect(() =>
      validateAssistantPlan(
        fill,
        { ...target, command: 'expand', targetSection: 'weaknesses' },
        registry,
      ),
    ).toThrow('different section')
  })
  it('also preserves a populated semantic alias when its historical key is absent', () => {
    const target = {
      ...context,
      command: 'fill' as const,
      targetFrame: { ...frame, noteAreas: { strengths: 'Imported semantic writing' } },
    }
    const fill = {
      ...draft(),
      frameworkRecommendation: null,
      frames: [],
      sections: [{ frameId: 'frame', sectionId: 'strengths', text: 'New', sourceIds: [] }],
    }
    expect(() => validateAssistantPlan(fill, target, registry)).toThrow('occupied')
    const plan = validateAssistantPlan(fill, { ...target, replace: true }, registry)
    expect(
      buildAssistantEffects(plan, { ...target, replace: true }, registry, 'task', { x: 0, y: 0 })
        .sections[0].before,
    ).toBe('Imported semantic writing')
  })
  it('rejects locked note revisions and unauthorized frame targets', () => {
    const revision = {
      ...draft(),
      frameworkRecommendation: null,
      frames: [],
      revisions: [{ cardId: card.id, title: 'Clearer', body: 'New body', sourceIds: [] }],
    }
    expect(() =>
      validateAssistantPlan(
        revision,
        { ...context, command: 'revise', targetCard: { ...card, locked: true } },
        registry,
      ),
    ).toThrow('locked')
    const fill = {
      ...draft(),
      frameworkRecommendation: null,
      frames: [],
      sections: [{ frameId: 'elsewhere', sectionId: 'weaknesses', text: 'New', sourceIds: [] }],
    }
    expect(() =>
      validateAssistantPlan(fill, { ...context, command: 'fill', targetFrame: frame }, registry),
    ).toThrow('unauthorized')
  })
  it('detects edits, deleted sources, moved frames and board switches during generation', () => {
    const current = { boardId: 'board', cards: [card], frames: [frame] }
    expect(() => assertAssistantContextCurrent(context, current)).not.toThrow()
    expect(() => assertAssistantContextCurrent(context, { ...current, boardId: 'other' })).toThrow(
      'different board',
    )
    expect(() =>
      assertAssistantContextCurrent(context, { ...current, cards: [{ ...card, updated_at: '2' }] }),
    ).toThrow('changed')
    expect(() => assertAssistantContextCurrent(context, { ...current, cards: [] })).toThrow(
      'changed',
    )
    expect(() =>
      assertAssistantContextCurrent(
        { ...context, targetFrame: frame },
        { ...current, frames: [{ ...frame, x: 50 }] },
      ),
    ).toThrow('framework changed')
  })
  it('bounds selected context and serializes only explicitly chosen note content', () => {
    const payload = assistantRequest(context, registry)
    expect(payload.instruction).toContain('single best-fit framework')
    expect(payload.instruction).toContain('response:string')
    expect(JSON.parse(payload.input).sources).toEqual([
      {
        id: card.id,
        title: card.title,
        type: 'note',
        reference: card.title,
        page: null,
        body: card.body,
        dueDate: null,
        dateLabel: '',
      },
    ])
    expect(payload.images).toEqual([])
    expect(payload.input).not.toContain('updated_at')
    expect(() => assistantRequest({ ...context, goal: 'g'.repeat(6001) }, registry)).toThrow(
      '6,000',
    )
    expect(() =>
      assistantRequest({ ...context, sources: [{ ...card, body: 'g'.repeat(48000) }] }, registry),
    ).toThrow('too long')
  })
  it('sends a bounded recent conversation so follow-up requests can resolve their references', () => {
    const history = Array.from({ length: 12 }, (_, index) => ({
      role: index % 2 === 0 ? ('user' as const) : ('assistant' as const),
      text: `Turn ${index}`,
    }))
    const payload = assistantRequest({ ...context, history }, registry)
    expect(JSON.parse(payload.input).conversation).toHaveLength(8)
    expect(JSON.parse(payload.input).conversation[0]).toEqual({ role: 'user', text: 'Turn 4' })
    expect(JSON.parse(payload.input).conversation.at(-1)).toEqual({
      role: 'assistant',
      text: 'Turn 11',
    })
  })
  it('passes only selected file sources as text and selected image bytes as separate attachments', () => {
    const documentSource = {
      id: 'brief',
      board_id: 'board',
      title: 'Campaign brief',
      body: 'Audience: commuters.',
      kind: 'markdown' as const,
      source_label: 'Campaign brief.md',
    }
    const imageSource = {
      id: 'photo',
      board_id: 'board',
      title: 'Store photo',
      body: 'Red sign',
      kind: 'image' as const,
      slide_id: 'slide',
    }
    const result = assistantRequest(
      {
        ...context,
        sources: [documentSource, imageSource],
        images: [
          { sourceId: 'photo', title: 'Store photo', dataUrl: 'data:image/jpeg;base64,AAAA' },
        ],
      },
      registry,
    )
    expect(JSON.parse(result.input).sources).toMatchObject([
      {
        id: 'brief',
        type: 'markdown',
        reference: 'Campaign brief.md',
        body: 'Audience: commuters.',
      },
      { id: 'photo', type: 'image', title: 'Store photo' },
    ])
    expect(result.images).toEqual([
      { sourceId: 'photo', title: 'Store photo', dataUrl: 'data:image/jpeg;base64,AAAA' },
    ])
    expect(() =>
      assistantRequest(
        {
          ...context,
          sources: [documentSource],
          images: [
            {
              sourceId: 'photo',
              title: 'Unselected image',
              dataUrl: 'data:image/jpeg;base64,AAAA',
            },
          ],
        },
        registry,
      ),
    ).toThrow('selected as Assistant sources')
  })
  it('detects changes to attached file sources while generation is running', () => {
    const source = {
      id: 'brief',
      board_id: 'board',
      title: 'Brief',
      body: 'Before',
      kind: 'text' as const,
    }
    const attached = { ...context, sources: [source] }
    expect(() =>
      assertAssistantContextCurrent(attached, {
        boardId: 'board',
        cards: [],
        frames: [],
        sources: [source],
      }),
    ).not.toThrow()
    expect(() =>
      assertAssistantContextCurrent(attached, {
        boardId: 'board',
        cards: [],
        frames: [],
        sources: [{ ...source, body: 'After' }],
      }),
    ).toThrow('board source changed')
  })
})

describe('app-computed effects', () => {
  it('generates local IDs, maps semantic IDs to historic keys, and leaves actions undated and incomplete', () => {
    const effects = buildAssistantEffects(
      validateAssistantPlan(draft(), context, registry),
      context,
      registry,
      'task',
      { x: 1000, y: 20 },
      () => 'local-id',
    )
    expect(effects.frames[0].id).toBe('local-id')
    expect(effects.frames[0].noteAreas?.['top-left']).toBe('No discount on main drink.')
    expect(effects.cards[0]).toMatchObject({
      ai_task_id: 'task',
      board_id: 'board',
      tag: 'idea',
      due_date: null,
      ai_source_ids: ['source'],
    })
    expect(effects.cards[0].y).toBeGreaterThan(effects.frames[0].y + effects.frames[0].height)
  })
  it('appends expansion while preserving originals and records before/after recovery values', () => {
    const expandContext: AssistantContext = {
      ...context,
      command: 'expand',
      targetFrame: frame,
      targetSection: 'strengths',
    }
    const output = {
      ...draft(),
      frameworkRecommendation: null,
      frames: [],
      sections: [
        {
          frameId: 'frame',
          sectionId: 'strengths',
          text: 'Additional detail',
          sourceIds: ['source'],
        },
      ],
    }
    const plan = validateAssistantPlan(output, expandContext, registry)
    const effects = buildAssistantEffects(plan, expandContext, registry, 'task', { x: 0, y: 0 })
    expect(effects.sections[0]).toMatchObject({
      storageKey: 'top-left',
      before: 'Existing writing',
    })
    expect(effects.sections[0].after).toContain(
      'Existing writing\n\nAI-assisted expansion (draft):\nAdditional detail',
    )
  })
})
