import type { FrameworkType } from '../types'
import type { AssistantCommand } from './assistantPlan'

export interface AssistantCreatedFrameRef {
  id: string
  name: string
  type: FrameworkType
}

export interface AssistantBoardCardRef {
  id: string
  title: string
  locked: boolean
}

export type AssistantCreatedCardRef = AssistantBoardCardRef

export interface AssistantFrameworkSectionRef {
  frameworkType: FrameworkType
  id: string
  label: string
}

/** Result references must describe successfully applied assistant output, ordered oldest to newest. */
export interface AssistantRouteInput {
  message: string
  isFirstRequest: boolean
  priorCreatedFrames: AssistantCreatedFrameRef[]
  priorCreatedCards: AssistantCreatedCardRef[]
  availableFrameworkSections: AssistantFrameworkSectionRef[]
  availableCards?: AssistantBoardCardRef[]
}

interface AssistantCommandRoute {
  status: 'route'
  command: AssistantCommand
  targetFrameRef?: AssistantCreatedFrameRef
  targetSectionId?: string
  targetCardRef?: AssistantCreatedCardRef
  replace: boolean
}

export type AssistantRouteResult =
  | AssistantCommandRoute
  | {
      status: 'action'
      action: 'move'
      targetCardRef: AssistantBoardCardRef
      destinationCardRef: AssistantBoardCardRef
      direction: AssistantMoveDirection
    }
  | { status: 'action'; action: 'delete'; targetCardRefs: AssistantBoardCardRef[] }
  | { status: 'clarify'; message: string }

type AssistantGenerationRouteResult = Exclude<AssistantRouteResult, { status: 'action' }>

export type AssistantMoveDirection = 'left' | 'right' | 'above' | 'below'

const LIMITS = {
  message: 6000,
  references: 128,
  sections: 256,
  availableCards: 512,
  referenceText: 160,
} as const

const clarify = (message: string): AssistantRouteResult => ({ status: 'clarify', message })

function normalize(value: string): string {
  return value.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
}

function containsPhrase(haystack: string, phrase: string): boolean {
  const normalizedPhrase = normalize(phrase)
  if (!normalizedPhrase) return false
  return ` ${haystack} `.includes(` ${normalizedPhrase} `)
}

function validInput(input: AssistantRouteInput): boolean {
  if (typeof input.message !== 'string' || input.message.length > LIMITS.message || !input.message.trim()) return false
  if (typeof input.isFirstRequest !== 'boolean') return false
  if (!Array.isArray(input.priorCreatedFrames) || !Array.isArray(input.priorCreatedCards) || !Array.isArray(input.availableFrameworkSections)) return false
  if (input.priorCreatedFrames.length > LIMITS.references || input.priorCreatedCards.length > LIMITS.references) return false
  if (input.availableFrameworkSections.length > LIMITS.sections) return false
  if (input.availableCards !== undefined && (!Array.isArray(input.availableCards) || input.availableCards.length > LIMITS.availableCards)) return false

  const frameIds = new Set<string>()
  for (const frame of input.priorCreatedFrames) {
    if (!frame || typeof frame.id !== 'string' || !frame.id || frame.id.length > LIMITS.referenceText
      || typeof frame.name !== 'string' || !frame.name || frame.name.length > LIMITS.referenceText) return false
    if (frameIds.has(frame.id)) return false
    frameIds.add(frame.id)
  }

  const cardIds = new Set<string>()
  for (const card of input.priorCreatedCards) {
    if (!card || typeof card.id !== 'string' || !card.id || card.id.length > LIMITS.referenceText
      || typeof card.title !== 'string' || !card.title || card.title.length > LIMITS.referenceText
      || !normalize(card.title)) return false
    if (typeof card.locked !== 'boolean') return false
    if (cardIds.has(card.id)) return false
    cardIds.add(card.id)
  }

  const availableCardIds = new Set<string>()
  for (const card of input.availableCards ?? []) {
    if (!card || typeof card.id !== 'string' || !card.id || card.id.length > LIMITS.referenceText
      || typeof card.title !== 'string' || !card.title || card.title.length > LIMITS.referenceText
      || !normalize(card.title) || typeof card.locked !== 'boolean') return false
    if (availableCardIds.has(card.id)) return false
    availableCardIds.add(card.id)
  }

  return input.availableFrameworkSections.every(section => Boolean(
    section && typeof section.id === 'string' && section.id && section.id.length <= LIMITS.referenceText
      && typeof section.label === 'string' && section.label && section.label.length <= LIMITS.referenceText,
  ))
}

function isNewBoardIntent(message: string): boolean {
  const newTarget = String.raw`(?:another|new|(?:a|an)\s+)?(?:framework|board|plan)`
  return new RegExp(String.raw`\b(?:new\s+)?(?:framework|board|plan)\b`).test(message)
    && new RegExp(String.raw`\b(?:create|make|build|draft|start|generate|add)\b.{0,80}\b${newTarget}\b`).test(message)
    || /\bnew(?:\s+\w+){0,3}\s+(?:framework|board|plan)\b/.test(message)
    || new RegExp(String.raw`\badd\s+another\s+(?:framework|board|plan)\b`).test(message)
}

function isNegatedNewBoardIntent(message: string): boolean {
  return /\b(?:do not|don t|dont|never|avoid|not)\b.{0,24}\b(?:create|make|build|draft|start|generate|add)\b.{0,80}\b(?:framework|board|plan)\b/.test(message)
}

function isExpandIntent(message: string): boolean {
  return /\b(?:expand|elaborate|detail|flesh out|go deeper|add detail|add more detail)\b/.test(message)
}

function isReviseIntent(message: string): boolean {
  return /\b(?:revise|rewrite|update|edit|improve|rework)\b/.test(message)
}

function isMoveIntent(message: string): boolean {
  return /\b(?:move|put|place|position|reposition)\b/.test(message)
}

function isDeleteIntent(message: string): boolean {
  return /\b(?:delete|remove|trash|erase)\b/.test(message)
}

function isNegatedActionIntent(message: string): boolean {
  return /\b(?:do not|don t|dont|never|avoid|not)\b.{0,40}\b(?:move|put|place|position|reposition|delete|remove|trash|erase)\b/.test(message)
}

interface CardMention {
  card: AssistantBoardCardRef
  start: number
  end: number
}

function findNamedBoardCardMentions(message: string, cards: AssistantBoardCardRef[]): CardMention[] {
  const paddedMessage = ` ${message} `
  const candidates: CardMention[] = []

  for (const card of cards) {
    const title = normalize(card.title)
    const phrase = ` ${title} `
    let fromIndex = 0
    while (fromIndex < paddedMessage.length) {
      const index = paddedMessage.indexOf(phrase, fromIndex)
      if (index < 0) break
      candidates.push({ card, start: index + 1, end: index + phrase.length - 1 })
      fromIndex = index + 1
    }
  }

  candidates.sort((left, right) => left.start - right.start || right.end - left.end)
  const mentions: CardMention[] = []
  for (const candidate of candidates) {
    const overlapping = mentions.some(mention => candidate.start < mention.end && mention.start < candidate.end)
    const exactDuplicateTitle = mentions.some(mention => candidate.start === mention.start && candidate.end === mention.end)
    if (!overlapping || exactDuplicateTitle) mentions.push(candidate)
  }
  return mentions
}

function routeBoardAction(message: string, input: AssistantRouteInput): AssistantRouteResult | null {
  const wantsMove = isMoveIntent(message)
  const wantsDelete = isDeleteIntent(message)
  if (!wantsMove && !wantsDelete) return null
  if (isNegatedActionIntent(message)) {
    return clarify('I will not move or delete a note from a negated request. Tell me directly what action you want.')
  }
  if (wantsMove && wantsDelete || isNewBoardIntent(message) || isExpandIntent(message) || isReviseIntent(message)) {
    return clarify('I found more than one kind of action in that request. Ask for one move or delete action at a time.')
  }

  const cards = input.availableCards ?? []
  const mentions = findNamedBoardCardMentions(message, cards)
  if (wantsDelete) {
    if (!mentions.length) return clarify('Name each board note by its title so I can identify what to delete.')
    if (mentions.some(mention => mention.card.locked)) {
      return clarify('At least one named note is locked. Unlock it or name only unlocked notes to delete.')
    }

    const targets = new Map<string, AssistantBoardCardRef>()
    const mentionedSpans = new Set<string>()
    for (const mention of mentions) {
      if (targets.has(mention.card.id)) return clarify('A note title matches more than one board note. Please identify the exact note before deleting.')
      const span = `${mention.start}:${mention.end}`
      if (mentionedSpans.has(span)) return clarify('A note title matches more than one board note. Please identify the exact note before deleting.')
      mentionedSpans.add(span)
      targets.set(mention.card.id, mention.card)
    }
    return { status: 'action', action: 'delete', targetCardRefs: [...targets.values()] }
  }

  const directions = [...message.matchAll(/\b(?:to\s+the\s+)?(left|right|above|below)(?:\s+of\b)?/g)]
    .filter(match => {
      const directionStart = (match.index ?? 0) + match[0].indexOf(match[1])
      const directionEnd = directionStart + match[1].length
      return !mentions.some(mention => directionStart < mention.end - 1 && mention.start - 1 < directionEnd)
    })
  if (directions.length !== 1) {
    return clarify('For a move, name one note, a direction (left, right, above, or below), and one destination note.')
  }

  const directionMatch = directions[0]
  const directionStart = (directionMatch.index ?? 0) + directionMatch[0].indexOf(directionMatch[1])
  const directionEnd = (directionMatch.index ?? 0) + directionMatch[0].length
  const before = mentions.filter(mention => mention.end - 1 <= directionStart)
  const after = mentions.filter(mention => mention.start - 1 >= directionEnd)
  if (before.length !== 1 || after.length !== 1) {
    return clarify('Name exactly one note before the direction and one destination note after it, for example “move Research to the left of Audience”.')
  }

  const targetCardRef = before[0].card
  const destinationCardRef = after[0].card
  if (targetCardRef.id === destinationCardRef.id) return clarify('Choose two different notes for a move: one to move and one destination.')
  if (targetCardRef.locked || destinationCardRef.locked) {
    return clarify('The note to move and its destination must both be unlocked. Unlock the locked note or choose another.')
  }

  return {
    status: 'action',
    action: 'move',
    targetCardRef,
    destinationCardRef,
    direction: directionMatch[1] as AssistantMoveDirection,
  }
}

function findNamedSections(message: string, input: AssistantRouteInput) {
  const available = new Map<string, AssistantFrameworkSectionRef[]>()
  for (const section of input.availableFrameworkSections) {
    if (!containsPhrase(message, section.label)) continue
    const key = `${section.frameworkType}\u0000${section.id}`
    const matches = available.get(key) ?? []
    matches.push(section)
    available.set(key, matches)
  }

  const matches = [...available.values()].map(items => items[0])
  if (!matches.length) return []
  const longestLabel = Math.max(...matches.map(section => normalize(section.label).length))
  return matches.filter(section => normalize(section.label).length === longestLabel)
}

function findNamedCards(message: string, cards: AssistantCreatedCardRef[]): AssistantCreatedCardRef[] {
  return cards.filter(card => containsPhrase(message, card.title))
}

type AssistantRouteDetails = Omit<Extract<AssistantRouteResult, { status: 'route' }>, 'status' | 'command' | 'replace'> & { replace?: boolean }

function route(command: AssistantCommand, details: AssistantRouteDetails = {}): AssistantRouteResult {
  return { status: 'route', command, ...details, replace: details.replace ?? false }
}

/**
 * Deterministically maps a short user request to the existing assistant commands.
 * priorCreated* references must come from applied assistant tasks; availableCards
 * may include any current board note and is used only for explicit board actions.
 */
export function routeAssistantRequest(input: AssistantRouteInput & { availableCards: AssistantBoardCardRef[] }): AssistantRouteResult
export function routeAssistantRequest(input: AssistantRouteInput & { availableCards?: undefined }): AssistantGenerationRouteResult
export function routeAssistantRequest(input: AssistantRouteInput): AssistantRouteResult
export function routeAssistantRequest(input: AssistantRouteInput): AssistantRouteResult {
  if (!validInput(input)) return clarify('I could not safely match that request. Please shorten it or start with a clear instruction.')

  const message = normalize(input.message)
  const boardAction = routeBoardAction(message, input)
  if (boardAction) return boardAction

  const negatedNewBoardIntent = isNegatedNewBoardIntent(message)
  if (input.isFirstRequest && !negatedNewBoardIntent) return route('build')
  if (!negatedNewBoardIntent && isNewBoardIntent(message)) return route('build')

  if (isExpandIntent(message)) {
    const namedSections = findNamedSections(message, input)
    if (!namedSections.length) {
      return clarify('Name a section exactly as it appears in an assistant-created framework so I can expand the right place.')
    }

    const candidates = input.priorCreatedFrames.flatMap(frame => {
      if (frame.type === 'blank') return []
      return namedSections
        .filter(section => section.frameworkType === frame.type)
        .map(section => ({ frame, section }))
    })
    if (!candidates.length) {
      return clarify('I found that section label, but not in an assistant-created framework on this board. Which generated framework should I use?')
    }

    const frameMentions = candidates.filter(({ frame }) =>
      containsPhrase(message, frame.name) || containsPhrase(message, frame.type),
    )
    const selected = frameMentions.length ? frameMentions : candidates
    if (selected.length !== 1) {
      return clarify('That section appears in more than one assistant-created framework. Name the framework as well as the section.')
    }

    const { frame, section } = selected[0]
    return route('expand', { targetFrameRef: frame, targetSectionId: section.id })
  }

  if (isReviseIntent(message)) {
    const matches = findNamedCards(message, input.priorCreatedCards)
    if (!matches.length) {
      return clarify('Name an assistant-created note by its title so I can revise the right one.')
    }
    if (matches.length !== 1) {
      return clarify('More than one assistant-created note matches that title. Please name the note more specifically.')
    }
    if (matches[0].locked) {
      return clarify('That assistant-created note is locked. Unlock it or name another unlocked note to revise.')
    }
    return route('revise', { targetCardRef: matches[0] })
  }

  if (negatedNewBoardIntent) {
    return clarify('I will not create a new framework from that wording. Tell me which existing note or section you want to change.')
  }

  const latestFrame = [...input.priorCreatedFrames].reverse().find(frame => frame.type !== 'blank')
  if (latestFrame) return route('fill', { targetFrameRef: latestFrame, replace: true })

  const latestUnlockedCard = [...input.priorCreatedCards].reverse().find(card => !card.locked)
  if (latestUnlockedCard) return route('revise', { targetCardRef: latestUnlockedCard })

  return clarify('I do not have an assistant-created framework or unlocked note to update yet. Ask me to create a plan first, or name an existing assistant-created note.')
}
