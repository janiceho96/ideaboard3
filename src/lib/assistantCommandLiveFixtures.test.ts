import { readFileSync, writeFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import type { Card, FrameInstance } from '../types'
import { assistantCommandRequest, validateAssistantBoardCommandPlan, type AssistantBoardCommandContext } from './assistantCommandPlan'
import { buildFrameworkDesignerRequest } from './customFrameworks'
import type { AssistantSource } from './assistantPlan'
import { buildAssistantCommandEffects } from './assistantCommandEffects'
import { validateFrameworkDesign } from './customFrameworks'

const time = '2026-10-14T00:00:00.000Z'
const cards: Card[] = [
  { id: 'qa-note-a', board_id: 'command-qa', title: 'Activation plan', body: 'The team chose a low-friction product trial. The survey follow-up is complete.', tag: 'idea', date_label: '', due_date: null, bg: 'white', x: 60, y: 80, rotation: 0, card_width: 280, card_height: null, collapsed: false, locked: false, created_at: time, updated_at: time },
  { id: 'qa-note-b', board_id: 'command-qa', title: 'Budget and deadline', body: 'The research budget is $500. The launch date is 2026-10-20. The budget review is complete.', tag: 'idea', date_label: '', due_date: null, bg: 'white', x: 400, y: 80, rotation: 0, card_width: 280, card_height: null, collapsed: false, locked: false, created_at: time, updated_at: time },
]
const frame: FrameInstance = { id: 'qa-frame', type: 'ooda', x: 80, y: 400, width: 800, height: 560, notes: '', noteAreas: { observe: 'MediumAstroAgent imports Medium articles into an Obsidian vault.', orient: 'Setup requires Google 2-Step Verification and a Google App Password.', decide: 'Gmail digest emails and a direct URL are alternative inputs.', act: 'An optional macOS LaunchAgent checks every 30 minutes.' } }
const sources: AssistantSource[] = cards.map(card => ({ id: card.id, board_id: card.board_id, title: card.title, body: card.body, kind: 'note', source_label: `Note · ${card.title}` }))
const importantNote = { ...cards[0], body: 'Do not launch until approval. The budget limit is $500. The deadline is 20 October. The meeting had many interesting conversations.' }
const importantSource = { ...sources[0], body: importantNote.body }
const base: AssistantBoardCommandContext = { boardId: 'command-qa', intent: 'emphasis', goal: '', today: '2026-10-14', history: [], sources, cards, frames: [] }
export const commandLiveFixtures = [
  { id: 'screenshot-highlight', context: { ...base, goal: 'help me to highlight some key point', cards: [], sources: [], frames: [frame] } },
  { id: 'important-words', context: { ...base, goal: 'Highlight only the truly important words in this note in yellow. Keep the wording unchanged.', cards: [importantNote], sources: [importantSource] } },
  { id: 'whole-sentence', context: { ...base, goal: 'Highlight the entire exact sentence "The survey follow-up is complete." in yellow in Activation plan.' } },
  { id: 'sentence-spacing', context: { ...base, intent: 'create' as const, goal: 'Create one note with a short paragraph of three complete sentences about this setup. Keep the URL, filename and version exactly as supplied. Put the command in inline code.', cards: [], sources: [{ id: 'qa-setup', board_id: 'command-qa', title: 'Setup facts', body: 'Config file medium_agent/.env. Documentation https://example.com/guide. Version 2.5. Run medium_agent.py --setup. Configure first, then run.', kind: 'note' as const }] } },
  { id: 'note-highlight', context: { ...base, goal: 'Highlight the exact phrase "low-friction product trial" in mint in Activation plan.' } },
  { id: 'find', context: { ...base, intent: 'find' as const, goal: 'Find notes mentioning activation and cite the selected source.' } },
  { id: 'create', context: { ...base, intent: 'create' as const, goal: 'Create one concise note summarizing the team decision from Activation plan.' } },
  { id: 'revise', context: { ...base, intent: 'revise' as const, goal: 'Shorten Activation plan without losing its two facts.' } },
  { id: 'analyze', context: { ...base, intent: 'analyze' as const, goal: 'Summarize what is known from these selected notes; cite their source IDs.' } },
  { id: 'actions', context: { ...base, intent: 'actions' as const, goal: 'Mark the two selected completed tasks Done without changing their writing.' } },
  { id: 'organize', context: { ...base, intent: 'organize' as const, goal: 'Arrange the selected notes in a row.' } },
  { id: 'sources', context: { ...base, intent: 'sources' as const, goal: 'Cite the selected source supporting the launch date. Do not create or revise notes.' } },
  { id: 'canvas', context: { ...base, intent: 'canvas' as const, goal: 'Lock both selected notes in place.' } },
  { id: 'ambiguous-highlight', context: { ...base, goal: 'Highlight the key point.', cards: [], sources: [], frames: [] } },
  { id: 'remove-highlight', context: { ...base, goal: 'Remove the highlight from the exact phrase "low-friction product trial" in Activation plan.', cards: [{ ...cards[0], body: 'The team chose a {{ib-highlight:mint}}low-friction product trial{{/ib-highlight}}. The survey follow-up is complete.' }], sources: [{ ...sources[0], body: 'The team chose a {{ib-highlight:mint}}low-friction product trial{{/ib-highlight}}. The survey follow-up is complete.' }] } },
].map(item => ({ ...item, request: assistantCommandRequest(item.context) }))

it('builds bounded real frontend requests for each live command fixture', () => {
  for (const item of commandLiveFixtures) {
    const input = JSON.parse(item.request.input)
    expect(input.command).toBe('board-command')
    expect(input.boardId).toBe('command-qa')
    expect(item.request.instruction.length).toBeLessThan(8192)
    expect(item.request.input.length).toBeLessThan(48000)
    expect(input.frameworks.every((frame: { sections: { text: string }[] }) => frame.sections.every(section => typeof section.text === 'string'))).toBe(true)
  }
  if (process.env.IDEABOARD_LIVE_COMMAND_FIXTURES) {
    const framework = { id: 'framework', context: null, request: buildFrameworkDesignerRequest('command-qa', 'Design a reusable workshop review framework with four empty sections and practical writing questions.', [{ id: 'qa-source', title: 'Workshop purpose', body: 'Review evidence, audience fit, decisions and next steps.' }], 'grid') }
    writeFileSync(process.env.IDEABOARD_LIVE_COMMAND_FIXTURES, JSON.stringify([...commandLiveFixtures, framework], null, 2))
  }
})

const liveReport = process.env.IDEABOARD_LIVE_COMMAND_REPORT
it.runIf(!!liveReport)('verifies the actual provider replies against requested effects, not only valid JSON', () => {
  const replies = JSON.parse(readFileSync(liveReport!, 'utf8')) as { id: string; status: string; reply: { ok: boolean; result: unknown } }[]
  for (const fixture of commandLiveFixtures) {
    const reply = replies.find(row => row.id === fixture.id)!
    expect(reply?.status, fixture.id).toBe('native-valid-live-response')
    const plan = validateAssistantBoardCommandPlan(reply.reply.result, fixture.context)
    const effects = buildAssistantCommandEffects(plan, fixture.context, 'live-task', { x: 0, y: 0 })
    switch (fixture.id) {
      case 'screenshot-highlight':
        expect(effects.sections.length).toBeGreaterThan(0)
        expect(plan.operations.filter(operation => operation.type === 'highlight_section').every(operation => operation.exactQuote.split(/\s+/).length <= 6 && !/[.!?]$/.test(operation.exactQuote))).toBe(true)
        for (const write of effects.sections) expect(write.after.replace(/\{\{(?:ib-highlight:[a-z]+|\/ib-highlight)\}\}/g, '')).toBe(write.before)
        break
      case 'important-words': {
        const quotes = plan.operations.filter(operation => operation.type === 'highlight_text').map(operation => operation.exactQuote)
        expect(quotes.length).toBeGreaterThan(1)
        expect(quotes.every(quote => quote.split(/\s+/).length <= 6 && !/[.!?]$/.test(quote)), 'Short phrases, not whole sentences').toBe(true)
        expect(quotes.some(quote => /approval|Do not launch/.test(quote)), 'Launch condition').toBe(true)
        expect(quotes.some(quote => quote.includes('$500')), 'Budget constraint').toBe(true)
        expect(quotes.some(quote => quote.includes('20 October')), 'Deadline with its unit').toBe(true)
        expect(quotes.filter(quote => /launch/i.test(quote)).every(quote => /not/i.test(quote)), 'Retain negation').toBe(true)
        expect(quotes.every(quote => !/interesting conversations/.test(quote)), 'Skip filler').toBe(true)
        expect(effects.cardWrites[0].after.body?.replace(/\{\{(?:ib-highlight:[a-z]+|\/ib-highlight)\}\}/g, '')).toBe(importantNote.body)
        break
      }
      case 'whole-sentence':
        expect(effects.cardWrites[0].after.body).toContain('{{ib-highlight:yellow}}The survey follow-up is complete.{{/ib-highlight}}')
        break
      case 'sentence-spacing': {
        expect(effects.cards).toHaveLength(1)
        const body = effects.cards[0].body
        expect(body).toContain('medium_agent/.env')
        expect(body).toContain('https://example.com/guide')
        expect(body).toContain('2.5')
        expect(body).toContain('`medium_agent.py --setup`')
        expect(body).toMatch(/[.!?][ \n]+[A-Z]/)
        expect(body).not.toMatch(/[a-z]{2}[.!?](?:\*{1,2})?[A-Z][a-z]/)
        break
      }
      case 'note-highlight':
        expect(effects.cardWrites[0].after.body).toContain('{{ib-highlight:mint}}low-friction product trial{{/ib-highlight}}')
        break
      case 'remove-highlight':
        expect(effects.cardWrites[0].after.body).toBe(cards[0].body)
        break
      case 'find': case 'analyze': case 'sources':
        expect(plan.operations.every(operation => operation.type === 'answer')).toBe(true)
        expect(plan.operations.some(operation => operation.type === 'answer' && operation.sourceIds.length > 0)).toBe(true)
        expect(effects.cards.length + effects.cardWrites.length + effects.sections.length).toBe(0)
        break
      case 'create':
        expect(effects.cards).toHaveLength(1)
        expect(effects.cards[0].body.toLowerCase()).toContain('low-friction product trial')
        break
      case 'revise':
        expect(effects.cardWrites).toHaveLength(1)
        expect(effects.cardWrites[0].cardId).toBe(cards[0].id)
        expect(effects.cardWrites[0].after.body).toMatch(/low-friction product trial/)
        expect(effects.cardWrites[0].after.body).toMatch(/survey follow-up.*complete/i)
        break
      case 'actions':
        expect(effects.cardWrites).toHaveLength(2)
        expect(effects.cards).toHaveLength(0)
        expect(effects.cardWrites.every(write => write.after.tag === 'done' && !('body' in write.after))).toBe(true)
        break
      case 'organize':
        expect(effects.cardWrites).toHaveLength(2)
        expect(effects.cardWrites[0].after.y).toBe(effects.cardWrites[1].after.y)
        expect(effects.cardWrites.every(write => !('body' in write.after))).toBe(true)
        break
      case 'canvas':
        expect(effects.cardWrites).toHaveLength(2)
        expect(effects.cardWrites.every(write => write.after.locked === true && !('body' in write.after))).toBe(true)
        break
      case 'ambiguous-highlight':
        expect(plan.operations).toHaveLength(0)
        expect(plan.response).toMatch(/select|which|choose|provide/i)
        break
    }
  }
  const framework = replies.find(row => row.id === 'framework')!
  expect(framework.status).toBe('native-valid-live-response')
  expect(validateFrameworkDesign(framework.reply.result, undefined, 'grid').sections).toHaveLength(4)
})
