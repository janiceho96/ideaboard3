#!/usr/bin/env node
/** Offline fixture evaluation. Live replies are read only from the separate native runner. */
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { resolve, dirname } from 'node:path'
import { parseArgs } from 'node:util'
import { createHash } from 'node:crypto'
import { createServer } from 'vite'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const { values } = parseArgs({ options: { output: { type: 'string', default: 'output/assistant-generation' }, 'fail-on-routing': { type: 'boolean', default: false }, catalog: { type: 'string', default: 'ui' }, report: { type: 'string', default: 'docs/testing/assistant-generation/report.md' } } })
const output = resolve(root, values.output)
if (!['ui', 'reduced'].includes(values.catalog)) throw new Error('--catalog must be ui or reduced')
await mkdir(output, { recursive: true })
const names = ['design-cases.json', 'conversation-cases.json', 'boundary-cases.json']
const groups = await Promise.all(names.map(name => readFile(resolve(root, 'docs/testing/assistant-generation', name), 'utf8').then(JSON.parse)))
const cases = Array.from({ length: Math.max(...groups.map(group => group.length)) }, (_, index) => groups.map(group => group[index]).filter(Boolean)).flat()
const allowedRoutes = new Set(['design', 'build', 'answer', 'create-note', 'revise-note', 'fill', 'expand', 'highlight', 'organize', 'actions', 'canvas', 'move', 'delete', 'clarify'])
const contexts = new Set(['empty', 'prior-board', 'selected-frame', 'selected-note', 'sources', 'locked-note'])
const ids = new Set(), uniqueCases = new Set()
for (const item of cases) {
  const unique = `${item.context}:${item.prompt.trim().normalize('NFKC').toLowerCase()}`
  if (ids.has(item.id) || uniqueCases.has(unique)) throw new Error(`Duplicate case: ${item.id}`)
  if (!contexts.has(item.context) || !item.prompt?.trim() || item.prompt.length > 3000 || !item.referenceAnswer || !item.rationale || !item.formatRule || !item.mustInclude?.length || !item.mustAvoid?.length || !item.expectedRoutes?.length || item.expectedRoutes.some(route => !allowedRoutes.has(route))) throw new Error(`Incomplete rubric: ${item.id}`)
  for (const check of item.outputChecks ?? []) {
    if (!['section-count', 'section-labels', 'preserve-literals', 'answer-only'].includes(check.type)) throw new Error(`Unknown automated check: ${item.id}/${check.type}`)
    if (check.type === 'section-count' && (!Number.isInteger(check.value) || check.value < 1)) throw new Error(`Invalid section count: ${item.id}`)
    if (['section-labels', 'preserve-literals'].includes(check.type) && (!Array.isArray(check.value) || !check.value.length || check.value.some(value => typeof value !== 'string' || !value.trim()))) throw new Error(`Invalid text assertions: ${item.id}`)
  }
  ids.add(item.id); uniqueCases.add(unique)
}
if (cases.length !== 300) throw new Error(`Expected 300 cases; got ${cases.length}`)
const boundedControl = values.output.endsWith('assistant-generation-ui-control')
const server = await createServer({ root, configFile: false, server: { middlewareMode: true, watch: null }, appType: 'custom', logLevel: 'error' })
let modules
try {
  modules = await Promise.all(['/src/lib/assistantRoute.ts', '/src/lib/assistantCommandPlan.ts', '/src/lib/assistantPlan.ts', '/src/lib/customFrameworks.ts', '/src/hooks/useFrames.ts'].map(path => server.ssrLoadModule(path)))
} catch (error) { await server.close(); throw error }
const [routing, commands, plans, custom, frameworks] = modules
const registry = Object.values(frameworks.FRAMEWORK_REGISTRY).filter(def => def.selectable).map(def => ({ type: def.type, label: def.label, guidance: values.catalog === 'reduced' ? def.selectionGuidance : `${def.selectionGuidance} ${def.sourceRequirements}`, width: def.defaultSize.width, height: def.defaultSize.height, sections: def.sections.map(s => ({ id: s.id, storageKey: s.storageKey, label: s.label, guidance: s.writingGuidance })) }))
const when = '2026-10-16T00:00:00.000Z'
const boardId = 'assistant-evaluation-fictional'
const card = (id, title, body) => ({ id, board_id: boardId, title, body, date_label: '', due_date: null, tag: 'idea', bg: 'white', x: 50, y: 80, card_width: 280, card_height: null, locked: false, collapsed: false, rotation: 0, created_at: when, updated_at: when })
function fixture(item) {
  const empty = item.context === 'empty'
  const cards = empty ? [] : [card('n-opening', 'Opening draft', 'Marketing taught me to investigate customer needs. I am exploring AI engineering through Python practice.'), card('n-portfolio', 'Portfolio evidence', 'Proposed project: a small note-organising assistant. No measured results or completed portfolio projects have been supplied.'), card('n-research', 'Research notes', 'Fictional learning exercise. No salary, employer, qualification, or project outcome is established.')]
  if (item.context === 'locked-note') cards[0].locked = true
  const frames = empty ? [] : [{ id: 'f-essay', type: 'ooda', name: 'Career Essay', x: 50, y: 400, width: 800, height: 560, noteAreas: { observe: 'Career change is being explored.', orient: 'Marketing research and Python practice are relevant.', decide: 'No final career decision is supplied.', act: 'Proposed: collect project evidence.' } }]
  let sources = []
  if (item.context === 'selected-note' || item.context === 'locked-note') sources = [{ ...cards[0], kind: 'note', source_label: 'Note · Opening draft' }]
  if (item.context === 'sources') sources = [{ id: 's-brief', board_id: boardId, kind: 'markdown', title: 'Career brief', body: item.sourceText ?? 'Fictional learner exploring marketer to AI engineer. Skills and portfolio evidence are not supplied.', source_label: 'Markdown · Career brief', mime_type: 'text/markdown' }]
  const priorFrames = frames.map(({ id, type, name }) => ({ id, type, name }))
  return { cards, frames, sources, routeInput: { message: item.prompt, isFirstRequest: empty, priorCreatedFrames: priorFrames, priorCreatedCards: cards.slice(0, 1).map(({ id, title, locked }) => ({ id, title, locked })), availableFrameworkSections: registry.filter(def => frames.some(f => f.type === def.type)).flatMap(def => def.sections.map(s => ({ frameworkType: def.type, id: s.id, label: s.label }))), availableCards: cards.map(({ id, title, locked }) => ({ id, title, locked })) }, history: empty ? [] : [{ role: 'user', text: 'Previously create a fictional Career Essay OODA framework and Opening draft note.' }, { role: 'assistant', text: 'Created Career Essay and Opening draft. All details are drafts, with no verified portfolio results.' }] }
}
const intentRoute = { conversation: 'answer', find: 'answer', analyze: 'answer', sources: 'answer', create: 'create-note', revise: 'revise-note', emphasis: 'highlight', organize: 'organize', actions: 'actions', canvas: 'canvas' }
function prepare(item) {
  const f = fixture(item)
  const route = routing.routeAssistantRequest(f.routeInput)
  const intent = route.status === 'answer' ? 'conversation' : route.status === 'route' && route.command === 'build' ? null : commands.classifyAssistantCommand(item.prompt)
  let actual, request = null, validationContext = null, preparationError = null
  try {
    // Same priority as BoardAssistantPanel.generate: custom design, local actions,
    // classified board command, clarification, then legacy drafting route.
    if (route.status === 'design') {
      actual = 'design'
      request = custom.buildFrameworkDesignerRequest(boardId, item.prompt, f.sources.map(s => ({ id: s.id, title: s.title, body: s.body })), route.layout)
      validationContext = { layout: route.layout }
    } else if (route.status === 'action') actual = route.action
    else if (intent && intent !== 'framework') {
      actual = intentRoute[intent]
      validationContext = { boardId, intent, goal: item.prompt, today: '2026-10-16', history: f.history, sources: f.sources, cards: f.cards.filter(c => f.sources.some(s => s.id === c.id && s.kind === 'note')), frames: f.frames }
      request = commands.assistantCommandRequest(validationContext)
    } else if (route.status === 'clarify') actual = 'clarify'
    else {
      actual = route.command === 'revise' ? 'revise-note' : route.command
      validationContext = { boardId, command: route.command, goal: item.prompt, history: f.history, sources: f.sources, targetFrame: route.targetFrameRef ? f.frames.find(frame => frame.id === route.targetFrameRef.id) : undefined, targetSection: route.targetSectionId, targetCard: route.targetCardRef ? f.cards.find(c => c.id === route.targetCardRef.id) : undefined, replace: route.replace }
      request = plans.assistantRequest(validationContext, registry)
    }
  } catch (error) { preparationError = error.message }
  return { id: item.id, hypothesis: item.hypothesis, category: item.category, context: item.context, prompt: item.prompt, expectedRoutes: item.expectedRoutes, actual, routingPass: item.expectedRoutes.includes(actual), route, intent, request, validationContext, preparationError }
}
const probePrompts = [
  'Draft a framework for my 500-word career essay with Belief, Skills, and Portfolio.',
  'Draft a custom framework for my 500-word career essay with Belief, Skills, and Portfolio.',
  'Design a custom essay framework with three empty sections.',
  'Design a custom framework for an essay with three empty sections.',
  'Suggest three opening sentences for my essay.',
  'Can you make it clearer?',
  'Do not change the board. Suggest an opening sentence.',
  'Create a new SWOT framework for weighing study options.',
]
const probes = probePrompts.map((prompt, index) => ({ prompt, empty: prepare({ id: `P${index + 1}A`, context: 'empty', prompt, expectedRoutes: [] }).actual, priorBoard: prepare({ id: `P${index + 1}B`, context: 'prior-board', prompt, expectedRoutes: [] }).actual }))
await writeFile(resolve(output, 'controlled-probes.json'), JSON.stringify(probes, null, 2))
const probeTable = probes.map(p => `| ${p.prompt} | ${p.empty} | ${p.priorBoard} |`).join('\n')
const prepared = cases.map(prepare)
let replies = []
try { replies = (await readFile(resolve(output, 'live-results.jsonl'), 'utf8')).trim().split('\n').filter(Boolean).map(JSON.parse) } catch (error) { if (error.code !== 'ENOENT') throw error }
function canonicalJSON(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJSON).join(',')}]`
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalJSON(value[key])}`).join(',')}}`
  return JSON.stringify(value)
}
const sha256 = value => createHash('sha256').update(value).digest('hex')
let manifest = null
try { manifest = JSON.parse(await readFile(resolve(output, 'live-results.jsonl.manifest.json'), 'utf8')) } catch (error) { if (error.code !== 'ENOENT') throw error }
if (manifest) {
  if (manifest.schemaVersion !== 1 || manifest.hashAlgorithm !== 'sha256' || manifest.canonicalization !== 'sorted-keys-compact-json-utf8-v1') throw new Error('Unsupported live-run manifest')
  const nativeSources = Object.fromEntries(await Promise.all(['macOS/IdeaboardMac/Sources/AppDelegate.swift', 'macOS/IdeaboardMac/Sources/LocalWebServer.swift'].map(async path => [path, sha256(await readFile(resolve(root, path)))])))
  const nativeSourceHash = sha256(canonicalJSON(nativeSources))
  const requestHashes = Object.fromEntries(prepared.filter(p => p.request && !p.preparationError).map(p => [p.id, sha256(canonicalJSON(p.request))]))
  const snapshotHash = sha256(canonicalJSON({ schemaVersion: 1, model: manifest.model, nativeSourceHash, requestHashes }))
  if (snapshotHash !== manifest.snapshotHash || nativeSourceHash !== manifest.nativeSourceHash || canonicalJSON(requestHashes) !== canonicalJSON(manifest.requestHashes)) throw new Error('Saved replies belong to a different request/native snapshot. Use a separate output directory.')
  const adopted = new Set(manifest.legacyAdoption?.ids ?? [])
  for (const row of replies) {
    if (row.model !== manifest.model) throw new Error(`Model provenance mismatch: ${row.id}`)
    if (!row.requestHash && adopted.has(row.id)) continue
    if (row.requestHash !== requestHashes[row.id] || row.snapshotHash !== snapshotHash) throw new Error(`Reply provenance mismatch: ${row.id}`)
  }
}
const provenance = !replies.length ? 'No live replies yet.' : !manifest ? 'Legacy run: no pre-run fingerprint manifest. The current corpus/native snapshot has been held unchanged during this run; cryptographic pre-run provenance is unavailable.' : manifest.legacyAdoption ? 'Legacy results were explicitly adopted after completion. Snapshot guards protect future reuse; they cannot establish pre-adoption provenance.' : 'Live replies match the guarded request/model/native snapshot.'
await writeFile(resolve(output, 'requests.json'), JSON.stringify(prepared, null, 2))
await writeFile(resolve(output, 'local-results.json'), JSON.stringify(prepared.map(({ request, validationContext, ...result }) => result), null, 2))
const latestReplies = new Map()
for (const reply of replies) { if (!ids.has(reply.id) || latestReplies.has(reply.id)) throw new Error(`Unexpected or repeated provider reply: ${reply.id}`); latestReplies.set(reply.id, reply) }
function checkOutput(item, preparedCase, reply) {
  if (!reply) return { status: 'not-run', frontendValid: null, checks: [] }
  if (reply.status !== 'native-valid') return { status: reply.status, frontendValid: false, error: reply.error ?? reply.reply?.error?.message, checks: [] }
  try {
    const result = reply.reply.result
    const operation = JSON.parse(preparedCase.request.input).command
    let plan
    if (operation === 'design-framework') plan = custom.validateFrameworkDesign(result, () => `eval-${item.id}`, preparedCase.validationContext.layout)
    else if (operation === 'board-command') plan = commands.validateAssistantBoardCommandPlan(result, preparedCase.validationContext)
    else plan = plans.validateAssistantPlan(result, preparedCase.validationContext, registry)
    const checks = []
    for (const check of item.outputChecks ?? []) {
      if (check.type === 'section-count') checks.push({ ...check, passed: operation === 'design-framework' && plan.sections.length === check.value })
      if (check.type === 'section-labels') checks.push({ ...check, passed: operation === 'design-framework' && check.value.every(label => plan.sections.some(s => s.label.toLowerCase().includes(label.toLowerCase()))) })
      if (check.type === 'answer-only') checks.push({ ...check, passed: operation === 'board-command' && plan.operations.every(op => op.type === 'answer') })
      if (check.type === 'preserve-literals') checks.push({ ...check, passed: check.value.every(value => JSON.stringify(plan).includes(value)) })
    }
    // Questions and explicit no-board-change cases must not receive a write plan.
    if (item.expectedRoutes.length === 1 && item.expectedRoutes[0] === 'answer') checks.push({ type: 'answer-only', passed: operation === 'board-command' && plan.operations.every(op => op.type === 'answer') })
    return { status: 'validated', frontendValid: true, checks, machineChecksPass: checks.every(c => c.passed), semanticRubric: 'Requires content review; schema validation does not establish task completion.' }
  } catch (error) { return { status: 'frontend-rejected', frontendValid: false, error: error.message, checks: [] } }
}
const evaluated = prepared.map((p, index) => ({ ...(({ request, validationContext, ...rest }) => rest)(p), contractGaps: p.request && cases[index].requiredOutputs?.includes('chat-answer') && !p.request.instruction?.includes('response:string') ? ['Request schema has no separate conversational-answer artifact.'] : [], live: checkOutput(cases[index], p, latestReplies.get(p.id)) }))
await writeFile(resolve(output, 'evaluated-results.json'), JSON.stringify(evaluated, null, 2))
const byHypothesis = Object.groupBy(evaluated, item => item.hypothesis)
const total = { cases: cases.length, routingPass: evaluated.filter(c => c.routingPass).length, routingFail: evaluated.filter(c => !c.routingPass).length, localOnly: prepared.filter(c => !c.request).length, preparedRequests: prepared.filter(c => c.request && !c.preparationError).length, liveRequests: replies.filter(r => r.status !== 'native-request-rejected').length, nativeValid: replies.filter(r => r.status === 'native-valid').length, frontendValid: evaluated.filter(r => r.live.frontendValid === true).length, machineFailures: evaluated.filter(r => r.live.machineChecksPass === false).length, compoundSchemaGaps: evaluated.filter(r => r.contractGaps.length).length }
const table = Object.entries(byHypothesis).sort().map(([name, items]) => `| ${name} | ${items.length} | ${items.filter(i => i.routingPass).length} | ${items.filter(i => !i.routingPass).length} |`).join('\n')
const confusion = Object.entries(Object.groupBy(evaluated.filter(c => !c.routingPass), c => `${c.expectedRoutes.join(' / ')} → ${c.actual}`)).sort((a,b) => b[1].length-a[1].length).map(([key,items]) => `| ${key} | ${items.length} |`).join('\n')
const models = [...new Set(replies.map(reply => reply.model).filter(Boolean))]
const transportsFailed = replies.filter(reply => reply.status === 'transport-error').length
const nativeRejected = replies.filter(reply => reply.status === 'native-response-rejected').length
const recordedOutcomes = replies.length
const unrecordedEligible = prepared.filter(p => p.request && !p.preparationError && !latestReplies.has(p.id)).length
const contentChecked = evaluated.filter(c => c.live.frontendValid && c.live.checks.length > 0).length
const reproduction = `node scripts/evaluate-assistant.mjs --catalog ${values.catalog}${values.output === 'output/assistant-generation' ? '' : ` --output ${values.output} --report ${values.report}`}`
let controlComparison = ''
if (values.catalog === 'reduced') {
  try {
    const controlRows = (await readFile(resolve(root, 'output/assistant-generation-ui-control/live-results.jsonl'), 'utf8')).trim().split('\n').filter(Boolean).map(JSON.parse)
    const controlEvaluation = JSON.parse(await readFile(resolve(root, 'output/assistant-generation-ui-control/evaluated-results.json'), 'utf8'))
    const controlIds = new Set(controlRows.map(row => row.id))
    const matchedRows = replies.filter(row => controlIds.has(row.id))
    controlComparison = `## Matched full-guidance control\n\n| Same case IDs | Recorded attempts | Native-valid | Frontend-valid |\n| --- | ---: | ---: | ---: |\n| Initial reduced guidance | ${matchedRows.length} | ${matchedRows.filter(row => row.status === 'native-valid').length} | ${evaluated.filter(row => controlIds.has(row.id) && row.live.frontendValid).length} |\n| Full UI guidance | ${controlRows.length} | ${controlRows.filter(row => row.status === 'native-valid').length} | ${controlEvaluation.filter(row => controlIds.has(row.id) && row.live.frontendValid).length} |\n\nThe [control review](control-review.md) compares content and action failures. This small single-sample control includes model sampling variation; the difference is not an effect estimate or a stable success rate.\n\n`
  } catch (error) { if (error.code !== 'ENOENT') throw error }
}
const tokens = replies.reduce((sum, r) => sum + (r.reply?.result?._native?.usage?.totalTokens ?? 0), 0)
const text = `# Hypothesis-based Board Assistant evaluation\n\nGenerated: ${new Date().toLocaleString('en-GB', { timeZone: 'Asia/Kuala_Lumpur', hour12: false })} Asia/Kuala_Lumpur\n\n300 synthetic requests, with explicit fictional fixtures and independent desired-outcome rubrics. These cases are diagnostic coverage, not an estimate of real-world success rates. No app boards were saved.\n\nCatalog variant: **${values.catalog}**. ${values.catalog === 'reduced' ? 'The initial diagnostic batch omitted each built-in framework’s sourceRequirements sentence from catalog guidance. Native provider instructions and all validators were unchanged. Wording/grounding conclusions need the separate UI-guidance control.' : 'Catalog guidance includes selectionGuidance and sourceRequirements, matching BoardAssistantPanel.'}\n\n## Hypotheses\n\n- H1: Natural phrasing, domain-specific structures, and typos are missed by keyword routing.\n- H2: Compound requests need both a framework artifact and a conversational answer.\n- H3: Earlier board context can divert a fresh task or follow-up.\n- H4: Questions can be routed into board mutation.\n- H5: Explicit selection, ambiguous targets, and locked targets need distinct handling.\n- H6: Exact constraints and grounding must survive generation and validation.\n\n## Local routing results\n\n${total.routingPass}/${total.cases} agree with the desired route; ${total.routingFail} disagree. This is route agreement, not AI-content quality. With the --fail-on-routing flag, route disagreements intentionally produce exit code 1. Catalog guidance is assembled after routing, so the omitted source-requirement sentence cannot cause this routing-gate failure. The matched probes illustrate narrow wording rules and Build/Fill fallbacks.\n\n| Hypothesis | Cases | Agreement | Disagreement |\n| --- | ---: | ---: | ---: |\n${table}\n\n| Desired → actual | Cases |\n| --- | ---: |\n${confusion}\n\n## Controlled routing probes (offline only)\n\nThe same eight prompts are routed with and without prior artifacts. These 16 probes are separate from the 300-case corpus and are not sent to the provider.\n\n| Prompt | Empty board | Prior board |\n| --- | --- | --- |\n${probeTable}\n\n## Live execution\n\n${provenance}\n\n${boundedControl ? 'Scope: this is a completed, deliberately bounded 12-case matched control. The other prepared cases were outside the selected control and are not pending work.' : 'Scope: all 274 API-eligible baseline cases have recorded outcomes when the remaining-outcome count is zero; the other 26 cases use local routes.'}\n\n- Native requests prepared: ${total.preparedRequests}. Local actions/clarifications: ${total.localOnly}.\n- Model: ${models.join(', ') || 'Not run'}.\n- Provider attempts recorded: ${total.liveRequests}. Recorded outcomes: ${recordedOutcomes}; eligible cases without a recorded outcome: ${unrecordedEligible}.\n- Transport failures: ${transportsFailed}. Replies rejected by native decoding: ${nativeRejected}.\n- Replies passing the native decoder: ${total.nativeValid}.\n- Replies also passing frontend validation: ${total.frontendValid}.\n- Frontend-valid replies with executable content assertions: ${contentChecked}; ${total.machineFailures} failed one or more. Other content requirements remain ungraded.\n- Correctly routed designs lacking a separate chat-answer artifact: ${total.compoundSchemaGaps}.\n- Tokens reported on decoded replies: ${tokens}. Failed responses may lack usage; this is not a billing total.\n- Must Include / Must Avoid / Format Rule / Reference Answer remain content-review rubrics. Unreviewed outputs are never counted as semantic passes.\n\n${controlComparison}## Interpretation and refinement priorities\n\nThe [qualitative pilot review](semantic-review.md) distinguishes useful content from completed requests. D001/C001 offer usable opening ideas but substitute existing framework structures; D004/B004 closely follow requested stages but invent unsupported types; C003 turns advice into a note; C004 proposes replacing four sections for an ambiguous follow-up. These are observations from a deliberately small pilot, not semantic grades for the remaining replies. The additional [six-case advisory review](advisory-review.md) includes safe answer-only replies despite a wrong route label, and a source-instruction case that preserves the boundary but misses the requested template. The pilot and advisory reviews inspect 18 baseline cases. The [two protected-target checks](protected-target-review.md) show frontend rejection of proposed edits to a locked note. The baseline therefore has 20 qualitatively inspected cases in total, while the control revisits 12 IDs. Other content remains unreviewed.\n\n1. Recognise custom structures from meaning and requested section names, without requiring adjacent magic words.\n2. Resolve an action before generation and use an action-specific schema. New drafts must not contain existing-frame writes; built-in frame and section IDs should be constrained to supplied values.\n3. Give advice a chat-only action and resolve genuine target ambiguity instead of silently selecting the previous framework for replacement.\n4. Support a framework-template artifact plus a separate answer for compound requests, keeping guidance distinct from answer fields.\n5. Preserve generated material on validation failure and explain the mismatch in everyday language. A bounded repair must keep the original action and target scope.\n\nNo assistant implementation or installed app was changed by this evaluation. UI rendering, apply, save/reload, and Undo are outside the evidence here.\n\n## Reproduce\n\nRun \`${reproduction}\` for local checks and to evaluate saved replies. Raw fictional requests, replies, and results stay under ignored \`${values.output}/\`. Use \`--fail-on-routing\` to make desired-route mismatches fail CI. The separate live runner must be invoked explicitly and resumes completed IDs. It never applies drafts to the workspace.\n\n## Example failures\n\n${evaluated.filter(c => !c.routingPass || c.live.frontendValid === false || c.live.machineChecksPass === false).slice(0,24).map(c => `- **${c.id}** (${c.context}): ${c.prompt}\n  - Expected: ${c.expectedRoutes.join(' / ')}. Actual: ${c.actual}. Live: ${c.live.status}${c.live.error ? ` — ${c.live.error}` : ''}`).join('\n')}\n`
await writeFile(resolve(root, values.report), text)
await writeFile(resolve(root, 'docs/testing/assistant-generation/prompts.md'), `# 300 Board Assistant requests\n\nSynthetic test requests; expected outcomes express desired behavior, not existing capabilities. Source JSON includes output rubrics and reference answers.\n\n${cases.map(c => `## ${c.id} · ${c.category}\n\nContext: ${c.context}. Hypothesis: ${c.hypothesis}. Expected route: ${c.expectedRoutes.join(' / ')}.\n\n> ${c.prompt}\n\nExpected: ${c.referenceAnswer}\n`).join('\n')}`)
console.log(JSON.stringify(total, null, 2))
await server.close()
if (values['fail-on-routing'] && total.routingFail) process.exitCode = 1
