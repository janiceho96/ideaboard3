import type { Card, CardInsert } from '../types'
import type { AssistantCardWriteFields, AssistantEffects } from './assistantPlan'
import type {
  AssistantBoardCommandContext,
  AssistantBoardCommandPlan,
  AssistantCardColor,
} from './assistantCommandPlan'
import { addNoteHighlight, removeNoteHighlight } from './noteHighlight'
import { getFrameworkDefinition, getFrameworkSectionNotes, setFrameworkSectionNotes } from '../hooks/useFrames'

const CARD_COLORS: Record<AssistantCardColor, string> = {
  yellow: '#FFF3A3',
  coral: '#FFB4A2',
  mint: '#B7E4C7',
  cyan: '#A8DADC',
  lavender: '#EEE9FF',
  paper: '#FFFDF5',
  ink: '#152336',
}

function estimatedHeight(card: Card) {
  if (card.collapsed) return 52
  if (card.card_height) return card.card_height
  const charsPerLine = Math.max(18, Math.floor(card.card_width / 7))
  const lineCount = (text: string) =>
    text
      .split('\n')
      .reduce((total, line) => total + Math.max(1, Math.ceil(line.length / charsPerLine)), 0)
  return Math.max(150, 86 + (lineCount(card.title) + lineCount(card.body)) * 21)
}

export function buildAssistantCommandEffects(
  plan: AssistantBoardCommandPlan,
  context: AssistantBoardCommandContext,
  taskId: string,
  origin: { x: number; y: number },
) {
  const projectedFrames = new Map((context.frames ?? []).map(frame => [frame.id, frame]))
  const sectionWrites = new Map<string, AssistantEffects['sections'][number]>()
  const projected = new Map(context.cards.map((card) => [card.id, { ...card }]))
  const writeMap = new Map<
    string,
    { before: AssistantCardWriteFields; after: AssistantCardWriteFields }
  >()
  const revisions: AssistantEffects['revisions'] = []
  const cards: AssistantEffects['cards'] = []
  const revisionTargets = new Set<string>()
  let createdIndex = 0

  const writeCard = (cardId: string, changes: AssistantCardWriteFields) => {
    if (revisionTargets.has(cardId))
      throw new Error('Ask for a note revision separately from other changes to that note.')
    const card = projected.get(cardId)
    if (!card) throw new Error('A note is no longer available on this board.')
    const existing = writeMap.get(cardId)
    const before: Record<string, unknown> = { ...existing?.before }
    const after: Record<string, unknown> = { ...existing?.after }
    for (const [key, value] of Object.entries(changes)) {
      if (!(key in before)) before[key] = card[key as keyof Card]
      after[key] = value
    }
    writeMap.set(cardId, {
      before: before as AssistantCardWriteFields,
      after: after as AssistantCardWriteFields,
    })
    projected.set(cardId, { ...card, ...changes })
  }

  for (const operation of plan.operations) {
    switch (operation.type) {
      case 'answer':
        break
      case 'highlight_text': {
        const card = projected.get(operation.cardId)
        if (!card) throw new Error('A note is no longer available on this board.')
        const result = operation.mode === 'remove' ? removeNoteHighlight(card.body, operation.exactQuote) : addNoteHighlight(card.body, operation.exactQuote, operation.color)
        if (result.status === 'already-highlighted') break
        if (result.status !== 'updated')
          throw new Error(
            `I couldn't highlight that phrase in “${card.title}”. ${result.status === 'ambiguous' ? 'It appears more than once.' : 'It is no longer an exact match.'}`,
          )
        writeCard(card.id, { body: result.markdown })
        break
      }
      case 'highlight_section': {
        const frame = projectedFrames.get(operation.frameId)
        const section = frame && getFrameworkDefinition(frame.type, frame.customFramework)?.sections.find(item => item.id === operation.sectionId)
        if (!frame || !section) throw new Error('The selected framework section is no longer available.')
        const before = getFrameworkSectionNotes(frame, operation.sectionId) ?? ''
        const result = operation.mode === 'remove' ? removeNoteHighlight(before, operation.exactQuote) : addNoteHighlight(before, operation.exactQuote, operation.color)
        if (result.status === 'already-highlighted') break
        if (result.status !== 'updated') throw new Error('The exact framework phrase changed or appears more than once. Nothing changed.')
        const key = `${frame.id}:${section.id}`
        sectionWrites.set(key, { frameId: frame.id, storageKey: section.storageKey, semanticId: section.id, before: sectionWrites.get(key)?.before ?? before, after: result.markdown })
        projectedFrames.set(frame.id, setFrameworkSectionNotes(frame, section.id, result.markdown))
        break
      }
      case 'create_note': {
        const index = createdIndex++
        const card: CardInsert & {
          ai_task_id: string
          ai_source_ids: string[]
          ai_assisted: true
        } = {
          board_id: context.boardId,
          title: operation.title,
          body: operation.body,
          date_label:
            operation.kind === 'action' ? 'Proposed action · AI draft' : 'AI-assisted draft',
          due_date: operation.dueDate,
          tag: operation.tag,
          bg: CARD_COLORS[operation.color],
          x: origin.x + (index % 3) * 350,
          y: origin.y + Math.floor(index / 3) * 300,
          rotation: 0,
          card_width: 310,
          card_height: null,
          collapsed: false,
          locked: false,
          ai_task_id: taskId,
          ai_source_ids: operation.sourceIds,
          ai_assisted: true,
        }
        cards.push(card)
        break
      }
      case 'revise_note': {
        if (writeMap.has(operation.cardId) || revisionTargets.has(operation.cardId))
          throw new Error('Ask for one revision per note at a time.')
        const card = projected.get(operation.cardId)
        if (!card) throw new Error('A note is no longer available on this board.')
        revisionTargets.add(card.id)
        revisions.push({
          cardId: card.id,
          beforeTitle: card.title,
          beforeBody: card.body,
          afterTitle: operation.title,
          afterBody: operation.body,
          beforeSourceIds: card.ai_source_ids,
          afterSourceIds: operation.sourceIds,
          beforeAiAssisted: card.ai_assisted,
          afterAiAssisted: true,
        })
        break
      }
      case 'update_note': {
        const changes: AssistantCardWriteFields = {}
        if (operation.changes.title !== undefined) changes.title = operation.changes.title
        if (operation.changes.body !== undefined) changes.body = operation.changes.body
        if (operation.changes.tag !== undefined) changes.tag = operation.changes.tag
        if (operation.changes.color !== undefined) changes.bg = CARD_COLORS[operation.changes.color]
        if ('dueDate' in operation.changes) changes.due_date = operation.changes.dueDate ?? null
        if (operation.changes.dateLabel !== undefined)
          changes.date_label = operation.changes.dateLabel
        if (operation.changes.collapsed !== undefined)
          changes.collapsed = operation.changes.collapsed
        writeCard(operation.cardId, changes)
        break
      }
      case 'move_note': {
        const card = projected.get(operation.cardId)
        const relative = projected.get(operation.relativeToCardId)
        if (!card || !relative) throw new Error('A note is no longer available on this board.')
        const gap = 48
        const width = card.card_width || 185
        const relativeWidth = relative.card_width || 185
        const height = estimatedHeight(card)
        const relativeHeight = estimatedHeight(relative)
        const position =
          operation.direction === 'left'
            ? { x: relative.x - width - gap, y: relative.y }
            : operation.direction === 'right'
              ? { x: relative.x + relativeWidth + gap, y: relative.y }
              : operation.direction === 'above'
                ? { x: relative.x, y: relative.y - height - gap }
                : { x: relative.x, y: relative.y + relativeHeight + gap }
        writeCard(card.id, position)
        break
      }
      case 'arrange_notes': {
        const selected = operation.cardIds.map((id) => projected.get(id)!)
        const left = Math.min(...selected.map((card) => card.x))
        const top = Math.min(...selected.map((card) => card.y))
        const columns =
          operation.layout === 'row'
            ? selected.length
            : operation.layout === 'column'
              ? 1
              : Math.ceil(Math.sqrt(selected.length))
        const positions = selected.map((card, index) => {
          const column = index % columns
          const row = Math.floor(index / columns)
          return {
            card,
            x: left + column * ((card.card_width || 185) + 48),
            y: top + row * (estimatedHeight(card) + 48),
          }
        })
        for (const item of positions) writeCard(item.card.id, { x: item.x, y: item.y })
        break
      }
      case 'group_notes': {
        const selected = operation.groups.flatMap((group) =>
          group.cardIds.map((id) => projected.get(id)!),
        )
        const left = Math.min(...selected.map((card) => card.x))
        let top = Math.min(...selected.map((card) => card.y))
        for (const group of operation.groups) {
          const members = group.cardIds.map((id) => projected.get(id)!)
          const columnWidth = Math.max(310, ...members.map((card) => card.card_width || 185)) + 48
          const columns = Math.min(3, members.length)
          const groupTop = top
          cards.push({
            board_id: context.boardId,
            title: group.label,
            body: '',
            date_label: 'AI group heading',
            due_date: null,
            tag: 'idea',
            bg: CARD_COLORS.lavender,
            x: left,
            y: groupTop,
            rotation: 0,
            card_width: 310,
            card_height: 56,
            collapsed: true,
            locked: false,
            ai_task_id: taskId,
            ai_source_ids: [],
            ai_assisted: true,
          })
          let groupHeight = 56
          members.forEach((card, index) => {
            const row = Math.floor(index / columns)
            const y = groupTop + 88 + row * (estimatedHeight(card) + 48)
            writeCard(card.id, { x: left + (index % columns) * columnWidth, y })
            groupHeight = Math.max(groupHeight, y - groupTop + estimatedHeight(card))
          })
          top += groupHeight + 100
        }
        break
      }
      case 'lock_notes':
        for (const cardId of operation.cardIds) writeCard(cardId, { locked: operation.locked })
        break
      case 'delete_notes':
        throw new Error('Review and confirm note deletion before applying other changes.')
    }
  }

  const cardWrites: NonNullable<AssistantEffects['cardWrites']> = [...writeMap].map(
    ([cardId, write]) => ({ cardId, ...write }),
  )
  return { cards, cardWrites, revisions, sections: [...sectionWrites.values()] }
}
