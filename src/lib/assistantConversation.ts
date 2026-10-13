export const ASSISTANT_CONVERSATION_VERSION = 1 as const
export const MAX_ASSISTANT_CONVERSATION_TURNS = 40
export const MAX_ASSISTANT_CONVERSATION_CONTENT_LENGTH = 8_000

export type AssistantConversationRole = 'user' | 'assistant'

export interface AssistantConversationMessage {
  role: AssistantConversationRole
  content: string
}

export interface AssistantConversationTurn {
  id: string
  createdAt: string
  messages: AssistantConversationMessage[]
}

export interface AssistantConversationResult {
  taskId: string
  frameIds: string[]
  cardIds: string[]
  createdAt: string
}

export function mergeAssistantConversationResult(
  previous: AssistantConversationResult | null,
  next: Pick<AssistantConversationResult, 'taskId' | 'frameIds' | 'cardIds' | 'createdAt'>,
): AssistantConversationResult {
  const frameIds = [...new Set([
    ...(previous?.frameIds ?? []).filter(id => !next.frameIds.includes(id)),
    ...next.frameIds,
  ])].slice(-MAX_RESULT_REFERENCES)
  const cardIds = [...new Set([
    ...(previous?.cardIds ?? []).filter(id => !next.cardIds.includes(id)),
    ...next.cardIds,
  ])].slice(-MAX_RESULT_REFERENCES)
  return { taskId: next.taskId, frameIds, cardIds, createdAt: next.createdAt }
}

export function removeAssistantConversationResultReferences(
  previous: AssistantConversationResult,
  removed: { frameIds: string[]; cardIds: string[] },
  taskId: string,
  createdAt: string,
): AssistantConversationResult {
  const removedFrames = new Set(removed.frameIds)
  const removedCards = new Set(removed.cardIds)
  return {
    taskId,
    frameIds: previous.frameIds.filter(id => !removedFrames.has(id)),
    cardIds: previous.cardIds.filter(id => !removedCards.has(id)),
    createdAt,
  }
}

export interface AssistantConversation {
  version: typeof ASSISTANT_CONVERSATION_VERSION
  boardId: string
  turns: AssistantConversationTurn[]
  lastResult: AssistantConversationResult | null
}

export interface AssistantConversationStorage {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
  removeItem: (key: string) => void
}

const STORAGE_PREFIX = 'ideaboard_assistant_conversation_'
const MAX_ID_LENGTH = 256
const MAX_RESULT_REFERENCES = 100

function storageKey(boardId: string) {
  if (!boardId || boardId.length > MAX_ID_LENGTH) throw new Error('A valid board ID is required.')
  return `${STORAGE_PREFIX}${encodeURIComponent(boardId)}`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function normalizeMessage(value: unknown): AssistantConversationMessage | null {
  if (
    !isRecord(value) ||
    (value.role !== 'user' && value.role !== 'assistant') ||
    typeof value.content !== 'string'
  )
    return null
  return {
    role: value.role,
    content: value.content.slice(0, MAX_ASSISTANT_CONVERSATION_CONTENT_LENGTH),
  }
}

function normalizeTurn(value: unknown): AssistantConversationTurn | null {
  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    !value.id ||
    value.id.length > MAX_ID_LENGTH
  )
    return null
  if (
    typeof value.createdAt !== 'string' ||
    value.createdAt.length > 100 ||
    !Array.isArray(value.messages)
  )
    return null

  const messages = value.messages.map(normalizeMessage)
  if (messages.some((message) => message === null)) return null
  const safeMessages = messages as AssistantConversationMessage[]
  if (safeMessages.length < 1 || safeMessages.length > 2 || safeMessages[0].role !== 'user')
    return null
  if (safeMessages.length === 2 && safeMessages[1].role !== 'assistant') return null

  return { id: value.id, createdAt: value.createdAt, messages: safeMessages }
}

function normalizeReferences(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length > MAX_RESULT_REFERENCES) return null
  if (!value.every((id) => typeof id === 'string' && id.length > 0 && id.length <= MAX_ID_LENGTH))
    return null
  return [...new Set(value)] as string[]
}

function normalizeResult(value: unknown): AssistantConversationResult | null {
  if (value === null) return null
  if (
    !isRecord(value) ||
    typeof value.taskId !== 'string' ||
    !value.taskId ||
    value.taskId.length > MAX_ID_LENGTH ||
    typeof value.createdAt !== 'string' ||
    value.createdAt.length > 100
  )
    return null

  const frameIds = normalizeReferences(value.frameIds)
  const cardIds = normalizeReferences(value.cardIds)
  if (!frameIds || !cardIds) return null
  return { taskId: value.taskId, frameIds, cardIds, createdAt: value.createdAt }
}

function emptyConversation(boardId: string): AssistantConversation {
  return { version: ASSISTANT_CONVERSATION_VERSION, boardId, turns: [], lastResult: null }
}

function normalizeTurns(values: unknown): AssistantConversationTurn[] {
  if (!Array.isArray(values)) return []
  return values
    .flatMap((value) => {
      const turn = normalizeTurn(value)
      return turn ? [turn] : []
    })
    .slice(-MAX_ASSISTANT_CONVERSATION_TURNS)
}

function saveConversation(
  conversation: AssistantConversation,
  storage: AssistantConversationStorage,
) {
  storage.setItem(storageKey(conversation.boardId), JSON.stringify(conversation))
}

export function readAssistantConversation(
  boardId: string,
  storage: AssistantConversationStorage,
): AssistantConversation {
  const raw = storage.getItem(storageKey(boardId))
  if (raw === null) return emptyConversation(boardId)

  try {
    const value: unknown = JSON.parse(raw)
    if (
      !isRecord(value) ||
      value.version !== ASSISTANT_CONVERSATION_VERSION ||
      value.boardId !== boardId
    ) {
      return emptyConversation(boardId)
    }

    return {
      version: ASSISTANT_CONVERSATION_VERSION,
      boardId,
      turns: normalizeTurns(value.turns),
      lastResult: normalizeResult(value.lastResult),
    }
  } catch {
    return emptyConversation(boardId)
  }
}

export function appendAssistantConversationTurn(
  boardId: string,
  turn: AssistantConversationTurn,
  storage: AssistantConversationStorage,
): AssistantConversation {
  const safeTurn = normalizeTurn(turn)
  if (!safeTurn) throw new Error('The assistant conversation turn is invalid.')
  const current = readAssistantConversation(boardId, storage)
  const next = {
    ...current,
    turns: [...current.turns, safeTurn].slice(-MAX_ASSISTANT_CONVERSATION_TURNS),
  }
  saveConversation(next, storage)
  return next
}

export function replaceAssistantConversationTurns(
  boardId: string,
  turns: AssistantConversationTurn[],
  storage: AssistantConversationStorage,
): AssistantConversation {
  const current = readAssistantConversation(boardId, storage)
  const next = { ...current, turns: normalizeTurns(turns) }
  saveConversation(next, storage)
  return next
}

export function updateAssistantConversationLastResult(
  boardId: string,
  result: AssistantConversationResult | null,
  storage: AssistantConversationStorage,
): AssistantConversation {
  const safeResult = normalizeResult(result)
  if (result !== null && !safeResult)
    throw new Error('The assistant conversation result is invalid.')
  const next = { ...readAssistantConversation(boardId, storage), lastResult: safeResult }
  saveConversation(next, storage)
  return next
}

export function clearAssistantConversation(
  boardId: string,
  storage: AssistantConversationStorage,
): void {
  storage.removeItem(storageKey(boardId))
}
