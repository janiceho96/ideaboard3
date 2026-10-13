import { describe, expect, it } from 'vitest'
import {
  appendAssistantConversationTurn,
  clearAssistantConversation,
  MAX_ASSISTANT_CONVERSATION_CONTENT_LENGTH,
  MAX_ASSISTANT_CONVERSATION_TURNS,
  mergeAssistantConversationResult,
  readAssistantConversation,
  removeAssistantConversationResultReferences,
  replaceAssistantConversationTurns,
  updateAssistantConversationLastResult,
  type AssistantConversationStorage,
  type AssistantConversationTurn,
} from './assistantConversation'

function memoryStorage(initial: Record<string, string> = {}): AssistantConversationStorage {
  const values = new Map(Object.entries(initial))
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value)
    },
    removeItem: (key) => {
      values.delete(key)
    },
  }
}

function turn(
  id: string,
  user = `Question ${id}`,
  assistant = `Answer ${id}`,
): AssistantConversationTurn {
  return {
    id,
    createdAt: '2026-10-12T00:00:00.000Z',
    messages: [
      { role: 'user', content: user },
      { role: 'assistant', content: assistant },
    ],
  }
}

describe('assistant conversation storage', () => {
  it('persists and reloads board-scoped turns', () => {
    const storage = memoryStorage()
    const saved = appendAssistantConversationTurn('board-a', turn('turn-a'), storage)

    expect(readAssistantConversation('board-a', storage)).toEqual(saved)
    expect(saved.version).toBe(1)
  })

  it('keeps only the newest 40 turns and bounds each message', () => {
    const storage = memoryStorage()
    const manyTurns = Array.from({ length: MAX_ASSISTANT_CONVERSATION_TURNS + 5 }, (_, index) =>
      turn(`turn-${index}`),
    )
    manyTurns[5] = turn(
      'turn-5',
      'u'.repeat(MAX_ASSISTANT_CONVERSATION_CONTENT_LENGTH + 10),
      'a'.repeat(MAX_ASSISTANT_CONVERSATION_CONTENT_LENGTH + 10),
    )

    const saved = replaceAssistantConversationTurns('board-a', manyTurns, storage)
    const oldest = saved.turns[0]

    expect(saved.turns).toHaveLength(MAX_ASSISTANT_CONVERSATION_TURNS)
    expect(saved.turns[0].id).toBe('turn-5')
    expect(oldest.messages[0].content).toHaveLength(MAX_ASSISTANT_CONVERSATION_CONTENT_LENGTH)
    expect(oldest.messages[1].content).toHaveLength(MAX_ASSISTANT_CONVERSATION_CONTENT_LENGTH)
    expect(readAssistantConversation('board-a', storage).turns).toEqual(saved.turns)
  })

  it('isolates turns and latest result references by board', () => {
    const storage = memoryStorage()
    appendAssistantConversationTurn('board-a', turn('a'), storage)
    updateAssistantConversationLastResult(
      'board-a',
      {
        taskId: 'task-a',
        frameIds: ['frame-a'],
        cardIds: ['card-a'],
        createdAt: '2026-10-12T00:01:00.000Z',
      },
      storage,
    )

    expect(readAssistantConversation('board-b', storage)).toMatchObject({
      turns: [],
      lastResult: null,
    })
    expect(readAssistantConversation('board-a', storage).lastResult).toEqual({
      taskId: 'task-a',
      frameIds: ['frame-a'],
      cardIds: ['card-a'],
      createdAt: '2026-10-12T00:01:00.000Z',
    })
  })

  it('returns an empty conversation for corrupt or unsupported records', () => {
    const storage = memoryStorage({
      'ideaboard_assistant_conversation_board-a': '{not json',
      'ideaboard_assistant_conversation_board-b': JSON.stringify({
        version: 99,
        boardId: 'board-b',
        turns: [],
      }),
      'ideaboard_assistant_conversation_board-c': JSON.stringify({
        version: 1,
        boardId: 'other-board',
        turns: [turn('foreign')],
      }),
    })

    expect(readAssistantConversation('board-a', storage)).toMatchObject({
      boardId: 'board-a',
      turns: [],
      lastResult: null,
    })
    expect(readAssistantConversation('board-b', storage)).toMatchObject({
      boardId: 'board-b',
      turns: [],
      lastResult: null,
    })
    expect(readAssistantConversation('board-c', storage)).toMatchObject({
      boardId: 'board-c',
      turns: [],
      lastResult: null,
    })
  })

  it('drops invalid turns and roles without exposing tool or system messages', () => {
    const storage = memoryStorage({
      'ideaboard_assistant_conversation_board-a': JSON.stringify({
        version: 1,
        boardId: 'board-a',
        turns: [
          turn('safe'),
          { id: 'tool', createdAt: 'now', messages: [{ role: 'tool', content: 'internal' }] },
          { id: 'system', createdAt: 'now', messages: [{ role: 'system', content: 'private' }] },
        ],
        lastResult: null,
      }),
    })

    const conversation = readAssistantConversation('board-a', storage)
    expect(conversation.turns).toHaveLength(1)
    expect(conversation.turns[0].messages.map((message) => message.role)).toEqual([
      'user',
      'assistant',
    ])
    expect(JSON.stringify(conversation)).not.toMatch(
      /internal|private|"role":"tool"|"role":"system"/,
    )
  })

  it('updates a pending turn by replacement while preserving the latest result', () => {
    const storage = memoryStorage()
    appendAssistantConversationTurn(
      'board-a',
      {
        id: 'pending',
        createdAt: '2026-10-12T00:00:00.000Z',
        messages: [{ role: 'user', content: 'Build a plan' }],
      },
      storage,
    )
    updateAssistantConversationLastResult(
      'board-a',
      {
        taskId: 'task-1',
        frameIds: ['frame-1'],
        cardIds: [],
        createdAt: '2026-10-12T00:01:00.000Z',
      },
      storage,
    )

    const updated = replaceAssistantConversationTurns(
      'board-a',
      [turn('pending', 'Build a plan', 'Created a draft.')],
      storage,
    )
    expect(updated.turns[0].messages[1]).toEqual({ role: 'assistant', content: 'Created a draft.' })
    expect(updated.lastResult?.taskId).toBe('task-1')
  })

  it('updates or clears the latest result and removes all board data on clear', () => {
    const storage = memoryStorage()
    appendAssistantConversationTurn('board-a', turn('one'), storage)
    updateAssistantConversationLastResult(
      'board-a',
      {
        taskId: 'task-1',
        frameIds: [],
        cardIds: ['card-1'],
        createdAt: '2026-10-12T00:01:00.000Z',
      },
      storage,
    )
    updateAssistantConversationLastResult(
      'board-a',
      {
        taskId: 'task-2',
        frameIds: ['frame-2'],
        cardIds: [],
        createdAt: '2026-10-12T00:02:00.000Z',
      },
      storage,
    )

    expect(readAssistantConversation('board-a', storage).lastResult?.taskId).toBe('task-2')
    expect(updateAssistantConversationLastResult('board-a', null, storage).lastResult).toBeNull()
    clearAssistantConversation('board-a', storage)
    expect(readAssistantConversation('board-a', storage)).toMatchObject({
      turns: [],
      lastResult: null,
    })
    expect(readAssistantConversation('board-b', storage)).toMatchObject({
      turns: [],
      lastResult: null,
    })
  })

  it('moves the latest edited assistant target last for routing and preserves older targets on undo', () => {
    const first = {
      taskId: 'task-1',
      frameIds: ['frame-older', 'frame-newer'],
      cardIds: ['card-older'],
      createdAt: '2026-10-12T00:01:00.000Z',
    }
    const edited = mergeAssistantConversationResult(first, {
      taskId: 'task-2',
      frameIds: ['frame-older'],
      cardIds: ['card-newer'],
      createdAt: '2026-10-12T00:02:00.000Z',
    })

    expect(edited.frameIds).toEqual(['frame-newer', 'frame-older'])
    expect(edited.cardIds).toEqual(['card-older', 'card-newer'])
    expect(removeAssistantConversationResultReferences(
      edited,
      { frameIds: [], cardIds: ['card-newer'] },
      'undo:task-2',
      '2026-10-12T00:03:00.000Z',
    )).toMatchObject({ frameIds: ['frame-newer', 'frame-older'], cardIds: ['card-older'] })
  })
})
