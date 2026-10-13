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
  it('builds on the first request and when asked for another plan or framework', () => {
    expect(routeAssistantRequest(input({ isFirstRequest: true }))).toMatchObject({ status: 'route', command: 'build', replace: false })
    expect(routeAssistantRequest(input({ message: 'Create a new marketing plan' }))).toMatchObject({ status: 'route', command: 'build' })
    expect(routeAssistantRequest(input({ message: 'We need a new marketing campaign plan' }))).toMatchObject({ status: 'route', command: 'build' })
    expect(routeAssistantRequest(input({ message: 'Add another framework to this board' }))).toMatchObject({ status: 'route', command: 'build' })
  })

  it('expands only a matching semantic section on an assistant-created frame', () => {
    expect(routeAssistantRequest(input({ message: 'Add more detail to the Target Audience section' }))).toMatchObject({
      status: 'route', command: 'expand', targetFrameRef: frame, targetSectionId: 'targeting', replace: false,
    })
  })

  it('clarifies when an explicit expansion has no safe semantic target', () => {
    expect(routeAssistantRequest(input({ message: 'Expand the campaign budget section' })).status).toBe('clarify')
    expect(routeAssistantRequest(input({
      message: 'Expand the Strengths section',
      priorCreatedFrames: [frame],
    })).status).toBe('clarify')
  })

  it('revises only an unlocked assistant-created note explicitly named by title', () => {
    expect(routeAssistantRequest(input({ message: 'Update the Audience research note' }))).toMatchObject({
      status: 'route', command: 'revise', targetCardRef: note, replace: false,
    })
    expect(routeAssistantRequest(input({
      message: 'Rewrite Audience research',
      priorCreatedCards: [{ ...note, locked: true }],
    }))).toMatchObject({ status: 'clarify' })
  })

  it('routes a move between two explicitly named ordinary notes with a relative direction', () => {
    expect(routeAssistantRequest({
      ...input({ priorCreatedCards: [] }),
      message: 'Move Launch goals to the right of Budget notes',
      availableCards: [boardNote, destinationNote],
    })).toMatchObject({
      status: 'action', action: 'move', targetCardRef: boardNote,
      destinationCardRef: destinationNote, direction: 'right',
    })
    expect(routeAssistantRequest({
      ...input({ priorCreatedCards: [] }),
      message: 'Put Budget notes below Launch goals',
      availableCards: [boardNote, destinationNote],
    })).toMatchObject({
      status: 'action', action: 'move', targetCardRef: destinationNote,
      destinationCardRef: boardNote, direction: 'below',
    })
  })

  it('clarifies when a move lacks a named target, destination, direction, or unique unlocked cards', () => {
    const availableCards = [boardNote, destinationNote]
    const route = (message: string, cards = availableCards) => routeAssistantRequest({
      ...input({ priorCreatedCards: [] }), message, availableCards: cards,
    })

    expect(route('Move Launch goals to the right')).toMatchObject({ status: 'clarify' })
    expect(route('Move the note to the right of Budget notes')).toMatchObject({ status: 'clarify' })
    expect(route('Move Launch goals beside Budget notes')).toMatchObject({ status: 'clarify' })
    expect(route('Move Launch goals to the right of Missing note')).toMatchObject({ status: 'clarify' })
    expect(route('Move Launch goals to the right of Budget notes', [
      boardNote, destinationNote, { ...destinationNote, id: 'board-note-3' },
    ])).toMatchObject({ status: 'clarify' })
    expect(route('Move Launch goals to the right of Budget notes', [
      { ...boardNote, locked: true }, destinationNote,
    ])).toMatchObject({ status: 'clarify' })
    expect(route('Move Launch goals to the right of Budget notes', [
      boardNote, { ...destinationNote, locked: true },
    ])).toMatchObject({ status: 'clarify' })
  })

  it('routes delete for one or more explicitly named unlocked board notes', () => {
    expect(routeAssistantRequest({
      ...input({ priorCreatedCards: [] }),
      message: 'Delete the Launch goals note',
      availableCards: [boardNote, destinationNote],
    })).toMatchObject({ status: 'action', action: 'delete', targetCardRefs: [boardNote] })
    expect(routeAssistantRequest({
      ...input({ priorCreatedCards: [] }),
      message: 'Remove Launch goals and Budget notes',
      availableCards: [boardNote, destinationNote],
    })).toMatchObject({ status: 'action', action: 'delete', targetCardRefs: [boardNote, destinationNote] })
  })

  it('clarifies for unnamed, ambiguous, locked, or negated delete targets', () => {
    const route = (message: string, availableCards = [boardNote]) => routeAssistantRequest({
      ...input({ priorCreatedCards: [] }), message, availableCards,
    })

    expect(route('Delete that note')).toMatchObject({ status: 'clarify' })
    expect(route('Delete Launch goals', [boardNote, { ...boardNote, id: 'board-note-3' }])).toMatchObject({ status: 'clarify' })
    expect(route('Delete Launch goals', [{ ...boardNote, locked: true }])).toMatchObject({ status: 'clarify' })
    expect(route('Do not delete Launch goals')).toMatchObject({ status: 'clarify' })
  })

  it('clarifies for unnamed, arbitrary, duplicate, or locked note targets', () => {
    expect(routeAssistantRequest(input({ message: 'Update that note' })).status).toBe('clarify')
    expect(routeAssistantRequest(input({ message: 'Update User research' })).status).toBe('clarify')
    expect(routeAssistantRequest(input({
      message: 'Edit Audience research',
      priorCreatedCards: [note, { ...note, id: 'note-2' }],
    })).status).toBe('clarify')
    expect(routeAssistantRequest(input({
      message: 'Revise Audience research',
      priorCreatedCards: [{ ...note, locked: true }],
    })).status).toBe('clarify')
  })

  it('fills the latest assistant-created framework as a reviewable replacement on ordinary follow-up', () => {
    expect(routeAssistantRequest(input({ priorCreatedFrames: [frame, otherFrame] }))).toMatchObject({
      status: 'route', command: 'fill', targetFrameRef: otherFrame, replace: true,
    })
  })

  it('revises the latest unlocked assistant-created note when no eligible frame exists', () => {
    expect(routeAssistantRequest(input({
      priorCreatedFrames: [],
      priorCreatedCards: [{ id: 'locked', title: 'Locked note', locked: true }, note],
    }))).toMatchObject({ status: 'route', command: 'revise', targetCardRef: note, replace: false })
  })

  it('clarifies rather than guessing when there is no safe prior result', () => {
    expect(routeAssistantRequest(input({ priorCreatedFrames: [], priorCreatedCards: [] })).status).toBe('clarify')
    expect(routeAssistantRequest(input({
      message: 'Expand Target Audience in Coke Activation',
      priorCreatedFrames: [frame, { ...frame, id: 'frame-3' }],
    })).status).toBe('clarify')
    expect(routeAssistantRequest(input({ message: 'Do not build another plan' })).status).toBe('clarify')
    expect(routeAssistantRequest(input({ message: "Don't build another plan" })).status).toBe('clarify')
    expect(routeAssistantRequest(input({
      message: "I don't want to build a new plan, update Audience research",
    }))).toMatchObject({ status: 'route', command: 'revise', targetCardRef: note })
  })

  it('rejects oversized or malformed routing input with a clarification', () => {
    expect(routeAssistantRequest(input({ message: 'a'.repeat(6001) })).status).toBe('clarify')
    expect(routeAssistantRequest(input({ priorCreatedFrames: [frame, frame] })).status).toBe('clarify')
  })
})
