import { describe, expect, it } from 'vitest'
import type { FrameworkType } from '../types'
import { routeAssistantRequest, type AssistantRouteInput } from './assistantRoute'

const sections = [
  { frameworkType: 'stp' as FrameworkType, id: 'targeting', label: 'Target Audience' },
  { frameworkType: 'stp' as FrameworkType, id: 'positioning', label: 'Positioning' },
  { frameworkType: 'swot' as FrameworkType, id: 'strengths', label: 'Strengths' },
]

const frame = { id: 'frame-1', name: 'Coke Activation', type: 'stp' as const }
const otherFrame = { id: 'frame-2', name: 'Campus SWOT', type: 'swot' as const }
const note = { id: 'note-1', title: 'Audience research', locked: false }
const boardNote = { id: 'board-note-1', title: 'Launch goals', locked: false }
const destinationNote = { id: 'board-note-2', title: 'Budget notes', locked: false }

function input(overrides: Partial<AssistantRouteInput> = {}): AssistantRouteInput {
  return {
    message: 'Make the audience more specific',
    isFirstRequest: false,
    priorCreatedFrames: [frame],
    priorCreatedCards: [note],
    availableFrameworkSections: sections,
    ...overrides,
  }
}

describe('routeAssistantRequest', () => {
  it('routes explicit custom framework design separately from writing a board', () => {
    expect(
      routeAssistantRequest(
        input({
          message:
            'Use the selected Markdown document to design a reusable custom framework. Create 4–6 sections with clear names and practical writing questions. Keep the sections empty for me to complete.',
          isFirstRequest: true,
        }),
      ),
    ).toMatchObject({ status: 'design', layout: 'grid' })
    expect(
      routeAssistantRequest(
        input({ message: 'Create a new framework from this Markdown as a learning cycle' }),
      ),
    ).toMatchObject({ status: 'design', layout: 'cycle' })
    expect(
      routeAssistantRequest(input({ message: 'Design my own framework as a matrix' })),
    ).toMatchObject({ status: 'design', layout: 'matrix' })
    expect(
      routeAssistantRequest(
        input({ message: 'Design a custom framework to decide which notes to delete' }),
      ),
    ).toMatchObject({ status: 'design' })
    expect(routeAssistantRequest(input({ message: 'Create a new SWOT framework' }))).toMatchObject({
      status: 'route',
      command: 'build',
    })
    expect(
      routeAssistantRequest(
        input({ message: 'Do not design a custom framework', isFirstRequest: true }),
      ),
    ).toMatchObject({ status: 'clarify' })
    expect(
      routeAssistantRequest(
        input({ message: 'Design a custom essay framework with three sections' }),
      ),
    ).toMatchObject({ status: 'design' })
    expect(
      routeAssistantRequest(
        input({ message: 'I want to map out my own reusable workshop template as a cycle' }),
      ),
    ).toMatchObject({ status: 'design', layout: 'cycle' })
    expect(
      routeAssistantRequest(
        input({
          message:
            'Help me draft a fremwork for my essay with a first paragraph, second paragraph, and third paragraph',
        }),
      ),
    ).toMatchObject({ status: 'design' })
  })
  it('builds on the first request and when asked for another plan or framework', () => {
    expect(
      routeAssistantRequest(input({ isFirstRequest: true, message: 'Help me make a new plan' })),
    ).toMatchObject({ status: 'route', command: 'build', replace: false })
    expect(routeAssistantRequest(input({ message: 'Create a new marketing plan' }))).toMatchObject({
      status: 'route',
      command: 'build',
    })
    expect(
      routeAssistantRequest(input({ message: 'We need a new marketing campaign plan' })),
    ).toMatchObject({ status: 'route', command: 'build' })
    expect(
      routeAssistantRequest(input({ message: 'Add another framework to this board' })),
    ).toMatchObject({ status: 'route', command: 'build' })
    expect(
      routeAssistantRequest(input({ message: 'Give me a framework for planning a workshop.' })),
    ).toMatchObject({ status: 'route', command: 'build' })
    expect(
      routeAssistantRequest(input({ message: 'Do a SWOT framework for the launch.' })),
    ).toMatchObject({ status: 'route', command: 'build' })
  })

  it('distinguishes a populated framework from a blank template when using a PDF', () => {
    expect(
      routeAssistantRequest(
        input({
          message: 'According to this PDF, make a framework for me to understand better.',
          isFirstRequest: true,
        }),
      ),
    ).toMatchObject({ status: 'route', command: 'build', replace: false })
    expect(
      routeAssistantRequest(
        input({
          message:
            'Using the selected PDF, design a blank reusable framework with practical writing questions. Leave every section empty.',
          isFirstRequest: true,
        }),
      ),
    ).toMatchObject({ status: 'design' })
  })

  it('expands only a matching semantic section on an assistant-created frame', () => {
    expect(
      routeAssistantRequest(input({ message: 'Add more detail to the Target Audience section' })),
    ).toMatchObject({
      status: 'route',
      command: 'expand',
      targetFrameRef: frame,
      targetSectionId: 'targeting',
      replace: false,
    })
  })

  it('clarifies when an explicit expansion has no safe semantic target', () => {
    expect(
      routeAssistantRequest(input({ message: 'Expand the campaign budget section' })).status,
    ).toBe('clarify')
    expect(
      routeAssistantRequest(
        input({
          message: 'Expand the Strengths section',
          priorCreatedFrames: [frame],
        }),
      ).status,
    ).toBe('clarify')
  })

  it('revises only an unlocked assistant-created note explicitly named by title', () => {
    expect(
      routeAssistantRequest(input({ message: 'Update the Audience research note' })),
    ).toMatchObject({
      status: 'route',
      command: 'revise',
      targetCardRef: note,
      replace: false,
    })
    expect(
      routeAssistantRequest(
        input({
          message: 'Rewrite Audience research',
          priorCreatedCards: [{ ...note, locked: true }],
        }),
      ),
    ).toMatchObject({ status: 'clarify' })
  })

  it('routes a move between two explicitly named ordinary notes with a relative direction', () => {
    expect(
      routeAssistantRequest({
        ...input({ priorCreatedCards: [] }),
        message: 'Move Launch goals to the right of Budget notes',
        availableCards: [boardNote, destinationNote],
      }),
    ).toMatchObject({
      status: 'action',
      action: 'move',
      targetCardRef: boardNote,
      destinationCardRef: destinationNote,
      direction: 'right',
    })
    expect(
      routeAssistantRequest({
        ...input({ priorCreatedCards: [] }),
        message: 'Put Budget notes below Launch goals',
        availableCards: [boardNote, destinationNote],
      }),
    ).toMatchObject({
      status: 'action',
      action: 'move',
      targetCardRef: destinationNote,
      destinationCardRef: boardNote,
      direction: 'below',
    })
  })

  it('clarifies when a move lacks a named target, destination, direction, or unique unlocked cards', () => {
    const availableCards = [boardNote, destinationNote]
    const route = (message: string, cards = availableCards) =>
      routeAssistantRequest({
        ...input({ priorCreatedCards: [] }),
        message,
        availableCards: cards,
      })

    expect(route('Move Launch goals to the right')).toMatchObject({ status: 'clarify' })
    expect(route('Move the note to the right of Budget notes')).toMatchObject({ status: 'clarify' })
    expect(route('Move Launch goals beside Budget notes')).toMatchObject({ status: 'clarify' })
    expect(route('Move Launch goals to the right of Missing note')).toMatchObject({
      status: 'clarify',
    })
    expect(
      route('Move Launch goals to the right of Budget notes', [
        boardNote,
        destinationNote,
        { ...destinationNote, id: 'board-note-3' },
      ]),
    ).toMatchObject({ status: 'clarify' })
    expect(
      route('Move Launch goals to the right of Budget notes', [
        { ...boardNote, locked: true },
        destinationNote,
      ]),
    ).toMatchObject({ status: 'clarify' })
    expect(
      route('Move Launch goals to the right of Budget notes', [
        boardNote,
        { ...destinationNote, locked: true },
      ]),
    ).toMatchObject({ status: 'clarify' })
  })

  it('routes delete for one or more explicitly named unlocked board notes', () => {
    expect(
      routeAssistantRequest({
        ...input({ priorCreatedCards: [] }),
        message: 'Delete the Launch goals note',
        availableCards: [boardNote, destinationNote],
      }),
    ).toMatchObject({ status: 'action', action: 'delete', targetCardRefs: [boardNote] })
    expect(
      routeAssistantRequest({
        ...input({ priorCreatedCards: [] }),
        message: 'Remove Launch goals and Budget notes',
        availableCards: [boardNote, destinationNote],
      }),
    ).toMatchObject({
      status: 'action',
      action: 'delete',
      targetCardRefs: [boardNote, destinationNote],
    })
  })

  it('clarifies for unnamed, ambiguous, locked, or negated delete targets', () => {
    const route = (message: string, availableCards = [boardNote]) =>
      routeAssistantRequest({
        ...input({ priorCreatedCards: [] }),
        message,
        availableCards,
      })

    expect(route('Delete that note')).toMatchObject({ status: 'clarify' })
    expect(
      route('Delete Launch goals', [boardNote, { ...boardNote, id: 'board-note-3' }]),
    ).toMatchObject({ status: 'clarify' })
    expect(route('Delete Launch goals', [{ ...boardNote, locked: true }])).toMatchObject({
      status: 'clarify',
    })
    expect(route('Do not delete Launch goals')).toMatchObject({ status: 'clarify' })
  })

  it('clarifies for unnamed, arbitrary, duplicate, or locked note targets', () => {
    expect(routeAssistantRequest(input({ message: 'Update that note' })).status).toBe('clarify')
    expect(routeAssistantRequest(input({ message: 'Update User research' })).status).toBe('clarify')
    expect(
      routeAssistantRequest(
        input({
          message: 'Edit Audience research',
          priorCreatedCards: [note, { ...note, id: 'note-2' }],
        }),
      ).status,
    ).toBe('clarify')
    expect(
      routeAssistantRequest(
        input({
          message: 'Revise Audience research',
          priorCreatedCards: [{ ...note, locked: true }],
        }),
      ).status,
    ).toBe('clarify')
  })

  it('answers advice questions without routing them to a board write', () => {
    expect(
      routeAssistantRequest(input({ message: 'Which framework would fit this essay best?' })),
    ).toMatchObject({ status: 'answer' })
    expect(
      routeAssistantRequest(input({ message: 'Can you suggest some opening ideas?' })),
    ).toMatchObject({ status: 'answer' })
    expect(
      routeAssistantRequest(input({ message: 'Can I generate a new framework from my notes?' })),
    ).toMatchObject({ status: 'answer' })
    expect(
      routeAssistantRequest(input({ message: 'How can I design my own essay framework?' })),
    ).toMatchObject({ status: 'answer' })
    expect(
      routeAssistantRequest(
        input({ message: 'Can you make a custom essay framework with three sections?' }),
      ),
    ).toMatchObject({ status: 'design' })
    expect(
      routeAssistantRequest(input({ message: 'Give me opening suggestions for my essay.' })),
    ).toMatchObject({ status: 'answer' })
  })

  it('clarifies ambiguous follow-ups instead of replacing a prior framework or note', () => {
    expect(
      routeAssistantRequest(
        input({ message: 'Can you make it clearer?', priorCreatedFrames: [frame, otherFrame] }),
      ),
    ).toMatchObject({ status: 'clarify' })
    expect(
      routeAssistantRequest(
        input({
          message: 'Can you change this note?',
          priorCreatedFrames: [],
          priorCreatedCards: [note],
        }),
      ),
    ).toMatchObject({ status: 'clarify' })
    expect(
      routeAssistantRequest(
        input({ message: 'Do you have ideas?', priorCreatedFrames: [frame, otherFrame] }),
      ),
    ).toMatchObject({ status: 'answer' })
  })

  it('recognizes common build wording while preserving named built-in frameworks', () => {
    expect(
      routeAssistantRequest(input({ message: 'Help me map out a project roadmap' })),
    ).toMatchObject({ status: 'route', command: 'build' })
    expect(
      routeAssistantRequest(input({ message: 'Create a fresh SWOT for the launch' })),
    ).toMatchObject({ status: 'route', command: 'build' })
    expect(
      routeAssistantRequest(
        input({ message: 'Draft an essay framework with Belief, Skills, and Portfolio sections' }),
      ),
    ).toMatchObject({ status: 'design' })
    for (const message of [
      'Design a five-part decision framework for choosing a university programme: goals, fit, costs, evidence, and reversibility.',
      'I want a framework for learning SQL: concepts, deliberate practice, project, feedback. Can you also suggest three beginner project ideas, but leave the framework empty?',
      'Help me create a grant-review canvas: need, people affected, proposed approach, evidence, sustainability.',
      'Design a team alignment framework around purpose, boundaries, decisions, responsibilities, and review.',
      'Can you create my own exam revision grid: topic, recall, mistakes, next practice?',
      'I need a reusable experiment log with Setup, Prediction, Observation, Interpretation, Next test.',
      'Create an opinion-column framework with Position, Reasons, Objection, Response, and Invitation.',
      'Could I have a reusable campaign postmortem with Signal, Possible cause, Evidence, and Change to try?',
      'Use my selected project note to design a reusable case-study layout with Context, Decision, Build, and Evidence. Also list the evidence I still need.',
      'Make another framework using the same OODA structure, but this one is for planning my first technical interview.',
      'Use this selected note as context for a fieldwork planner: research question, site, observation, reflection, follow-up.',
      'Design a career-change evidence map: old skill, new application, small proof, next gap. Add three opening phrases too.',
      'Leave the earlier analysis as it is. I now want a reusable reading framework with four parts: question, method, result, limitation. Empty writing spaces please.',
      'Can we switch to designing a language-learning framework? I want Input, Notice, Try, Feedback in a cycle.',
      'I am done with that board. Design a new reusable brief for volunteer recruitment: purpose, audience, contribution, support, invitation.',
      'Help design a weekly creator review board with 6 reusable buckets: audience question, content idea, evidence, production, feedback, next iteration.',
      'Need a parent-teacher meeting guide with the sections strengths, examples, concerns, support, and follow-up. Make it a blank pattern I can reuse for any student.',
      'A framework to help me decide when to stop an experiment: original bet, evidence so far, cost of another round, stop rule. I want it blank for repeated use.',
      'Gimme a 4 part retro thing I can save: proud of, got in the way, learned, try next. Do not write my answers.',
      '我想设计一个空白的职业转型框架，四部分：动机、已有能力、能力差距、下一个实验。每部分给两条写作问题。',
      'Boleh buat rangka belajar machine learning sendiri? Empat bahagian: tujuan, konsep, latihan, bukti kemajuan. Soalan ringkas sahaja, jangan isi jawapan.',
    ]) {
      expect(routeAssistantRequest(input({ message }))).toMatchObject({ status: 'design' })
    }
  })

  it('clarifies rather than guessing when there is no safe prior result', () => {
    expect(
      routeAssistantRequest(
        input({
          isFirstRequest: true,
          message: 'Can you make it clearer?',
          priorCreatedFrames: [],
        }),
      ),
    ).toMatchObject({ status: 'clarify' })
    expect(
      routeAssistantRequest(input({ priorCreatedFrames: [], priorCreatedCards: [] })).status,
    ).toBe('clarify')
    expect(
      routeAssistantRequest(
        input({
          message: 'Expand Target Audience in Coke Activation',
          priorCreatedFrames: [frame, { ...frame, id: 'frame-3' }],
        }),
      ).status,
    ).toBe('clarify')
    expect(routeAssistantRequest(input({ message: 'Do not build another plan' })).status).toBe(
      'clarify',
    )
    expect(routeAssistantRequest(input({ message: 'Do not give me a framework.' })).status).toBe(
      'clarify',
    )
    expect(routeAssistantRequest(input({ message: 'Do not build a SWOT framework.' })).status).toBe(
      'clarify',
    )
    expect(routeAssistantRequest(input({ message: "Don't build another plan" })).status).toBe(
      'clarify',
    )
    expect(
      routeAssistantRequest(
        input({
          message: "I don't want to build a new plan, update Audience research",
        }),
      ),
    ).toMatchObject({ status: 'route', command: 'revise', targetCardRef: note })
  })

  it('rejects oversized or malformed routing input with a clarification', () => {
    expect(routeAssistantRequest(input({ message: 'a'.repeat(6001) })).status).toBe('clarify')
    expect(routeAssistantRequest(input({ priorCreatedFrames: [frame, frame] })).status).toBe(
      'clarify',
    )
  })
})
