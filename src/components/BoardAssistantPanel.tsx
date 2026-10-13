import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, ChevronDown, FileUp, Paperclip, Search, Send, Settings2, Sparkles, Square, Trash2, Undo2, X } from 'lucide-react'
import type { Card, CustomFrameworkTemplate, FrameInstance } from '../types'
import { FRAMEWORK_REGISTRY, getFrameworkLabel } from '../hooks/useFrames'
import { frameworkTypeFor } from '../lib/customFrameworks'
import { colors, fonts } from '../lib/designTokens'
import { AssistantExplanationStream } from '../lib/assistantStream'
import { ASSISTANT_LIMITS, assertAssistantContextCurrent, assistantRequest, assistantSectionText, buildAssistantEffects, validateAssistantPlan, type AssistantCommand, type AssistantContext, type AssistantFramework, type AssistantImageAttachment, type AssistantPlan, type AssistantSource } from '../lib/assistantPlan'
import { applyAssistantTask, keepAssistantTask, readAssistantTask, undoAssistantTask, type AssistantOperations, type AssistantTask } from '../lib/assistantTask'
import { appendAssistantConversationTurn, mergeAssistantConversationResult, readAssistantConversation, removeAssistantConversationResultReferences, replaceAssistantConversationTurns, updateAssistantConversationLastResult, type AssistantConversation, type AssistantConversationTurn } from '../lib/assistantConversation'
import { routeAssistantRequest, type AssistantBoardCardRef, type AssistantMoveDirection, type AssistantRouteResult } from '../lib/assistantRoute'
import { generateNativeAssistant, nativeAIRequest, nativeAIStatus, type NativeAIStatus } from '../lib/nativeAssistant'
import { prepareImageAttachment } from '../lib/imageAttachment'

const builtinAssistantFrameworks: AssistantFramework[] = Object.values(FRAMEWORK_REGISTRY).filter(d => d.selectable).map(d => ({
  type: d.type, label: d.label, guidance: `${d.selectionGuidance} ${d.sourceRequirements}`,
  width: d.defaultSize.width, height: d.defaultSize.height,
  sections: d.sections.map(s => ({ id: s.id, storageKey: s.storageKey, label: s.label, guidance: s.writingGuidance })),
}))

interface Props {
  open: boolean
  boardId: string
  boardName: string
  cards: Card[]
  frames: FrameInstance[]
  customFrameworks: CustomFrameworkTemplate[]
  availableSources: AssistantSource[]
  selectedNoteIds: string[]
  selectedSourceIds: string[]
  selectedFrameId: string | null
  operations: AssistantOperations
  getOrigin: () => { x: number; y: number }
  locate: (task: AssistantTask) => void
  onTaskBoundary: () => void
  onLocateNote: (id: string) => void
  onMoveNote: (id: string, x: number, y: number) => Promise<void>
  onDeleteNote: (id: string) => Promise<void>
  onLocateSource: (source: AssistantSource) => void
  onRemoveSource: (source: AssistantSource) => Promise<void>
  onImportFiles: (files: File[]) => Promise<AssistantSource[]>
  loadSourceImage: (source: AssistantSource) => Promise<string | null>
  onExtractSourceText: (source: AssistantSource) => Promise<void>
  onSearch: () => void
  onClose: () => void
  dark: boolean
}

const commands: { id: AssistantCommand | 'auto'; label: string; help: string }[] = [
  { id: 'auto', label: 'Automatic', help: 'Describe what you want. The assistant chooses a safe action from this chat and its recent results.' },
  { id: 'build', label: 'Build board', help: 'Create frameworks and related draft notes on this board.' },
  { id: 'fill', label: 'Fill framework', help: 'Write empty sections and add related draft notes.' },
  { id: 'expand', label: 'Expand section', help: 'Add detail to one section. Existing writing stays.' },
  { id: 'revise', label: 'Revise note', help: 'Compare a revised draft before replacing your writing.' },
]

export function PanelStyle({ dark }: { dark: boolean }) {
  return <style>{`
    .ib-writing-panel { width: 386px; max-width: calc(100vw - 68px); min-width:0; flex-shrink: 0; display:flex; flex-direction:column; z-index:110; border-left:2px solid #172038; font-family:${fonts.ui}; height:100%; overflow:hidden; position:relative; }
    .ib-writing-panel button,.ib-writing-panel input,.ib-writing-panel select,.ib-writing-panel textarea { font:inherit; color:inherit; }
    .ib-writing-panel button { cursor:pointer; }
    .ib-writing-panel button:disabled { opacity:.5; cursor:not-allowed; }
    .ib-writing-panel :focus-visible { outline:3px solid #8FD7FF; outline-offset:2px; }
    .ib-writing-panel .ib-panel-control { width:100%; box-sizing:border-box; border:1.5px solid #8891A4; border-radius:7px; padding:9px 10px; background:transparent; font-size:13px; }
    .ib-writing-panel .ib-panel-button { border:2px solid #172038; border-radius:7px; padding:9px 12px; display:inline-flex; align-items:center; justify-content:center; gap:6px; background:#6957FF; color:white; font-weight:700; box-shadow:2px 2px 0 #172038; }
    .ib-writing-panel .ib-panel-small { border:1px solid #8891A4; border-radius:6px; padding:6px 9px; background:transparent; display:inline-flex; align-items:center; gap:5px; font-size:12px; }
    .ib-writing-panel label { display:grid; gap:6px; font-size:12px; font-weight:700; }
    .ib-writing-panel pre { font-family:${fonts.ui}; font-size:13px; line-height:1.65; white-space:pre-wrap; overflow-wrap:anywhere; }
    .ib-chat-header { flex:none; padding:13px 14px 10px; border-bottom:2px solid ${dark ? colors.borderDark : colors.ink}; }
    .ib-chat-heading,.ib-chat-tools,.ib-chat-composer-tools,.ib-chat-composer-bottom { display:flex; align-items:center; gap:8px; }
    .ib-chat-heading { min-width:0; }
    .ib-chat-board-name { margin-top:2px; color:${dark ? '#C4CAD8' : '#5A6274'}; font-size:11px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .ib-chat-tools { margin-top:9px; }
    .ib-chat-tools .ib-icon-button { width:40px; height:40px; padding:0; justify-content:center; flex:none; }
    .ib-chat-connection { display:flex; align-items:center; gap:6px; min-width:0; flex:1; font-size:11px; color:${dark ? '#C4CAD8' : '#5A6274'}; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; }
    .ib-connection-dot { width:7px; height:7px; flex:none; border-radius:50%; background:${colors.markerCoral}; }
    .ib-connection-dot.is-ready { background:${colors.markerMint}; border:1px solid #172038; }
    .ib-chat-thread { flex:1; min-height:0; overflow-y:auto; overscroll-behavior:contain; padding:16px 13px; display:flex; flex-direction:column; gap:13px; }
    .ib-chat-welcome { margin:auto 0; align-self:center; max-width:260px; display:grid; justify-items:center; gap:9px; text-align:center; }
    .ib-chat-welcome-mark { display:grid; place-items:center; width:36px; height:36px; border:2px solid #172038; border-radius:50%; color:${dark ? colors.markerYellow : colors.markerPurple}; background:${dark ? '#263654' : '#EEE9FF'}; }
    .ib-chat-welcome strong { font-family:${fonts.display}; font-size:16px; }
    .ib-chat-welcome p { margin:0; color:${dark ? '#C4CAD8' : '#5A6274'}; font-size:12px; line-height:1.5; }
    .ib-chat-notice { margin-top:5px; padding:8px 10px; border:1px solid ${dark ? '#8290A8' : '#C9A932'}; border-radius:6px; background:${dark ? '#202B43' : '#FFF8D8'}; font-size:11px; line-height:1.5; text-align:left; }
    .ib-chat-row { display:flex; align-items:flex-end; gap:7px; max-width:100%; }
    .ib-chat-row.is-user { justify-content:flex-end; }
    .ib-chat-avatar { flex:none; display:grid; place-items:center; width:22px; height:22px; border:1.5px solid #172038; border-radius:50%; color:${dark ? colors.markerYellow : colors.markerPurple}; background:${dark ? '#263654' : '#EEE9FF'}; }
    .ib-chat-bubble { max-width:calc(100% - 30px); min-width:0; padding:9px 11px; border:1.5px solid #172038; border-radius:8px; font-size:13px; line-height:1.55; overflow-wrap:anywhere; white-space:pre-wrap; }
    .ib-chat-user-bubble { background:${dark ? '#3B326F' : '#E8E3FF'}; box-shadow:2px 2px 0 #172038; }
    .ib-chat-assistant-bubble { background:${dark ? '#202B43' : '#FFFDF5'}; }
    .ib-chat-live { display:grid; gap:6px; }
    .ib-chat-live-title { display:flex; align-items:center; gap:7px; font-size:12px; font-weight:700; }
    .ib-assistant-activity-dot { width:8px; height:8px; flex:none; border:2px solid ${dark ? colors.markerYellow : colors.markerPurple}; border-radius:50%; }
    .ib-chat-stream { font-size:12px; color:${dark ? '#D7D9E2' : '#454D60'}; }
    .ib-chat-error { align-self:stretch; padding:8px 10px; border:1px solid ${colors.markerCoral}; border-radius:6px; background:${dark ? '#352531' : '#FFF0EE'}; font-size:12px; line-height:1.5; overflow-wrap:anywhere; }
    .ib-chat-status { align-self:center; color:${dark ? '#C4CAD8' : '#5A6274'}; font-size:11px; text-align:center; }
    .ib-chat-result { display:grid; gap:10px; padding:12px; border:1.5px solid ${dark ? '#8290A8' : '#A5ABBA'}; border-radius:8px; background:${dark ? '#202B43' : '#FFFDF5'}; }
    .ib-chat-result ul { margin:0; padding-left:20px; font-size:12px; line-height:1.5; }
    .ib-chat-composer { position:relative; flex:none; display:grid; gap:8px; padding:9px 11px 11px; border-top:2px solid ${dark ? colors.borderDark : colors.ink}; background:${dark ? colors.surfaceDark : colors.surfaceLight}; }
    .ib-chat-composer-tools { min-height:27px; justify-content:space-between; }
    .ib-context-toggle { flex:1; min-width:0; max-width:100%; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; color:${dark ? '#F7F7F2' : colors.ink}; }
    .ib-composer-hint { min-width:0; color:${dark ? '#AEB7C8' : '#6B7280'}; font-size:10px; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; }
    .ib-chat-input { width:100%; box-sizing:border-box; min-height:54px; max-height:120px; resize:vertical; border:1.5px solid #8891A4; border-radius:7px; padding:10px; background:${dark ? '#202B43' : '#FFFFFF'}; font-size:13px!important; line-height:1.5; }
    .ib-chat-input:disabled { opacity:.65; }
    .ib-chat-composer-bottom { justify-content:space-between; min-height:30px; }
    .ib-send-button { flex:none; display:grid; place-items:center; width:32px; height:30px; border:2px solid #172038; border-radius:7px; background:${colors.markerPurple}; color:white!important; box-shadow:2px 2px 0 #172038; }
    .ib-send-button:disabled { box-shadow:none; opacity:.42!important; }
    .ib-stop-button { border-color:${colors.markerCoral}!important; }
    .ib-chat-context { position:relative; max-height:min(38vh,300px); overflow-y:auto; display:grid; gap:11px; padding:13px; border:2px solid #172038; border-radius:8px; background:${dark ? colors.surfaceDark : colors.surfaceLight}; box-shadow:2px 2px 0 #172038; }
    .ib-chat-context-head { display:grid; gap:3px; }
    .ib-chat-context-head strong { font-family:${fonts.display}; font-size:14px; }
    .ib-chat-context-head span,.ib-context-help { font-size:10px; line-height:1.45; color:${dark ? '#AEB7C8' : '#6B7280'}; font-weight:400; }
    .ib-context-sources { display:grid; gap:5px; font-size:11px; line-height:1.45; }
    .ib-source-list { max-height:92px; overflow-y:auto; display:grid; gap:5px; }
    .ib-source-list button { text-align:left; }
    .ib-context-check { display:flex!important; grid-template-columns:auto 1fr; align-items:flex-start; gap:8px!important; font-size:11px!important; line-height:1.45; font-weight:500!important; }
    .ib-context-check input { margin:2px 0 0; accent-color:${colors.markerPurple}; }
    @media(prefers-reduced-motion:no-preference) { .ib-assistant-activity-dot { animation:ib-assistant-pulse 1.2s ease-in-out infinite alternate; } }
    @keyframes ib-assistant-pulse { to { transform:scale(.72); opacity:.55; } }
    @media(max-width:800px) { .ib-writing-panel { position:absolute; right:0; top:0; bottom:0; width:min(440px,calc(100vw - 54px)); max-width:calc(100vw - 54px); box-shadow:-6px 0 0 rgba(23,32,56,.15); } .ib-chat-input { font-size:16px!important; } .ib-chat-tools .ib-icon-button,.ib-send-button { width:44px; height:44px; } .ib-writing-panel .ib-panel-small { min-height:40px; } }
  `}</style>
}

export default function BoardAssistantPanel(props: Props) {
  const { open, boardId, cards, frames, selectedNoteIds, selectedFrameId, dark } = props
  const assistantFrameworks = useMemo(() => {
    const templates = new Map<string, CustomFrameworkTemplate>()
    for (const frame of frames) if (frame.customFramework) templates.set(frameworkTypeFor(frame.customFramework), frame.customFramework)
    for (const template of props.customFrameworks) {
      const type = frameworkTypeFor(template)
      if (!templates.has(type)) templates.set(type, template)
    }
    const custom: AssistantFramework[] = [...templates].map(([type, template]) => ({
      type: type as AssistantFramework['type'],
      label: template.label,
      guidance: `${template.purpose} Use supplied board material; mark unknowns as questions or assumptions.`,
      width: template.defaultSize.width,
      height: template.defaultSize.height,
      customDefinition: template,
      sections: template.sections.map(section => ({ id: section.id, storageKey: section.storageKey, label: section.label, guidance: section.writingGuidance })),
    }))
    return [...builtinAssistantFrameworks, ...custom]
  }, [frames, props.customFrameworks])
  const [command, setCommand] = useState<AssistantCommand | 'auto'>('auto')
  const [goal, setGoal] = useState('')
  const [contextOpen, setContextOpen] = useState(false)
  const [conversation, setConversation] = useState<AssistantConversation>(() => readAssistantConversation(boardId, localStorage))
  const conversationRef = useRef(conversation)
  conversationRef.current = conversation
  const messages = useMemo(() => conversation.turns.flatMap(turn => turn.messages.map((entry, index) => ({ id: `${turn.id}:${index}`, role: entry.role, text: entry.content }))), [conversation])
  const [scope, setScope] = useState<'selected' | 'board' | 'goal'>('selected')
  const [sourceSelection, setSourceSelection] = useState<string[]>(props.selectedSourceIds)
  const [previewSourceId, setPreviewSourceId] = useState<string | null>(null)
  const [includePageImages, setIncludePageImages] = useState(false)
  const [frameId, setFrameId] = useState(selectedFrameId ?? '')
  const [sectionId, setSectionId] = useState('')
  const [noteId, setNoteId] = useState(selectedNoteIds[0] ?? '')
  const [replace, setReplace] = useState(false)
  const [consent, setConsent] = useState(false)
  const [status, setStatus] = useState<NativeAIStatus>({ available: false, configured: false })
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState('')
  const [streamSummary, setStreamSummary] = useState('')
  const [error, setError] = useState('')
  const chatThreadRef = useRef<HTMLDivElement>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const sourceFileInputRef = useRef<HTMLInputElement>(null)
  const shouldFollowChatRef = useRef(true)
  const [review, setReview] = useState<{ plan: AssistantPlan; context: AssistantContext; turnId: string } | null>(null)
  const [pendingDelete, setPendingDelete] = useState<{ refs: AssistantBoardCardRef[]; turnId: string } | null>(null)
  const reviewRef = useRef(review)
  reviewRef.current = review
  const [summary, setSummary] = useState<AssistantPlan | null>(null)
  const [task, setTask] = useState<AssistantTask | null>(null)
  const abort = useRef<AbortController | null>(null)
  const busyRef = useRef(false)
  const propsRef = useRef(props)
  propsRef.current = props
  const sourceBoardIdRef = useRef(boardId)
  const blockedByTask = !!task && task.status !== 'complete'

  const saveTurns = (turns: AssistantConversationTurn[]) => {
    const next = replaceAssistantConversationTurns(boardId, turns, localStorage)
    conversationRef.current = next
    setConversation(next)
    return next
  }
  const updateLastResult = (result: Parameters<typeof updateAssistantConversationLastResult>[1]) => {
    const next = updateAssistantConversationLastResult(boardId, result, localStorage)
    conversationRef.current = next
    setConversation(next)
    return next
  }
  const finishTurn = (turnId: string, response: string) => {
    const turns = conversationRef.current.turns.map(turn => turn.id === turnId
      ? { ...turn, messages: [turn.messages[0], { role: 'assistant' as const, content: response }] }
      : turn)
    return saveTurns(turns)
  }
  const beginTurn = (prompt: string) => {
    const turn: AssistantConversationTurn = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      messages: [{ role: 'user', content: prompt }],
    }
    const next = appendAssistantConversationTurn(boardId, turn, localStorage)
    conversationRef.current = next
    setConversation(next)
    return turn.id
  }

  const routeMessage = (prompt: string, sourceConversation: AssistantConversation): AssistantRouteResult => {
    const priorFrameRefs = (sourceConversation.lastResult?.frameIds ?? []).flatMap(id => {
      const item = frames.find(candidate => candidate.id === id)
      return item ? [{ id: item.id, name: item.name || getFrameworkLabel(item.type, item.customFramework), type: item.type }] : []
    })
    const priorCardRefs = (sourceConversation.lastResult?.cardIds ?? []).flatMap(id => {
      const item = cards.find(candidate => candidate.id === id)
      return item ? [{ id: item.id, title: item.title, locked: item.locked }] : []
    })
    const availableFrameworkSections = [...new Map(priorFrameRefs.flatMap(item =>
      (assistantFrameworks.find(def => def.type === item.type)?.sections ?? []).map(section => [
        `${item.type}:${section.id}`, { frameworkType: item.type, id: section.id, label: section.label },
      ]),
    )).values()]
    return routeAssistantRequest({
      message: prompt,
      isFirstRequest: sourceConversation.lastResult === null,
      priorCreatedFrames: priorFrameRefs,
      priorCreatedCards: priorCardRefs,
      availableFrameworkSections,
      availableCards: cards.map(({ id, title, locked }) => ({ id, title, locked })),
    })
  }

  const promptRoute = command === 'auto' && goal.trim()
    ? routeMessage(goal.trim(), conversationRef.current)
    : null

  const refreshStatus = async () => {
    try { setStatus(await nativeAIStatus()) } catch (e) { setError(message(e)) }
  }
  useEffect(() => {
    const refresh = () => { try { setTask(readAssistantTask(boardId, localStorage)) } catch (e) { setError(message(e)) } }
    const changed = (event: Event) => {
      if ((event as CustomEvent).detail === boardId) { refresh(); setSummary(null); setProgress('Task undone and saved.') }
    }
    try {
      const restored = readAssistantConversation(boardId, localStorage)
      conversationRef.current = restored
      setConversation(restored)
    } catch (e) { setError(message(e)) }
    setGoal('')
    setError('')
    refresh()
    window.addEventListener('ideaboard:assistant-task-changed', changed)
    return () => { abort.current?.abort(); window.removeEventListener('ideaboard:assistant-task-changed', changed) }
  }, [boardId])
  useEffect(() => {
    if (sourceBoardIdRef.current === boardId) return
    sourceBoardIdRef.current = boardId
    setSourceSelection(props.selectedSourceIds)
  }, [boardId, props.selectedSourceIds])
  useEffect(() => { if (open) void refreshStatus() }, [open])
  useEffect(() => {
    if (shouldFollowChatRef.current) chatEndRef.current?.scrollIntoView({ behavior: 'auto', block: 'end' })
  }, [open, messages, busy, progress, streamSummary, review, pendingDelete, summary, task, error])
  useEffect(() => { if (selectedFrameId && !busyRef.current && !review) setFrameId(selectedFrameId) }, [selectedFrameId, review])
  useEffect(() => {
    if (selectedNoteIds.length === 1 && !busyRef.current && !reviewRef.current) setNoteId(selectedNoteIds[0])
  }, [selectedNoteIds])

  const frame = frames.find(f => f.id === frameId)
  const definition = assistantFrameworks.find(d => d.type === frame?.type)
  const currentSectionId = definition?.sections.some(s => s.id === sectionId) ? sectionId : definition?.sections[0]?.id ?? ''
  const sources = useMemo(() => scope === 'board'
    ? props.availableSources.filter(source => source.kind !== 'image' && !(source.kind === 'pdf-page' && !source.body.trim()))
    : scope === 'selected' ? props.availableSources.filter(source => sourceSelection.includes(source.id)) : [], [scope, props.availableSources, sourceSelection])
  const targetNote = cards.find(c => c.id === noteId)
  const needsFrame = command === 'fill' || command === 'expand'
  const canGenerate = status.configured && consent && goal.trim() && !blockedByTask && !review && !pendingDelete && (command === 'auto' || !needsFrame || !!definition) && (command === 'auto' || command !== 'revise' || (targetNote && !targetNote.locked))
  const canRunLocalAction = promptRoute?.status === 'action' || promptRoute?.status === 'clarify'
  const canSubmit = !!goal.trim() && !blockedByTask && !review && !pendingDelete && !busy && (canRunLocalAction || canGenerate)

  const apply = async (plan: AssistantPlan, context: AssistantContext, signal: AbortSignal) => {
    const current = propsRef.current
    assertAssistantContextCurrent(context, { ...current.operations.getSnapshot(), sources: current.availableSources })
    if (signal.aborted) throw new Error('Generation stopped. Your request is kept.')
    const id = crypto.randomUUID()
    const free = current.getOrigin()
    const origin = { x: free.x, y: context.targetFrame?.y ?? free.y }
    const next: AssistantTask = { version: 1, id, boardId, status: 'applying', createdAt: new Date().toISOString(), effects: buildAssistantEffects(plan, context, assistantFrameworks, id, origin) }
    setSummary(plan)
    try {
      const complete = await applyAssistantTask(next, current.operations, localStorage, setProgress, signal)
      const saved = current.operations.getSnapshot()
      const previous = conversationRef.current.lastResult
      const changedFrameIds = [...new Set([
        ...complete.effects.frames.map(item => item.id),
        ...complete.effects.sections.map(item => item.frameId),
      ])]
      const changedCardIds = [...new Set([
        ...complete.effects.revisions.map(item => item.cardId),
        ...saved.cards.filter(card => (card as Card & { ai_task_id?: string }).ai_task_id === complete.id).map(card => card.id),
      ])]
      const nextResult = mergeAssistantConversationResult(previous, {
        taskId: complete.id,
        frameIds: changedFrameIds,
        cardIds: changedCardIds,
        createdAt: complete.createdAt,
      })
      updateLastResult(nextResult)
      setTask(complete)
      setReview(null)
      current.locate(complete)
    } finally {
      const savedTask = readAssistantTask(boardId, localStorage)
      setTask(savedTask)
      if (savedTask) current.onTaskBoundary()
    }
  }

  const generate = async () => {
    if (busyRef.current || !canSubmit) return
    shouldFollowChatRef.current = true
    const prompt = goal.trim()
    setGoal('')
    setContextOpen(false)
    setError('')
    const priorConversation = conversationRef.current
    let turnId: string | null = null
    try {
      turnId = beginTurn(prompt)
      let routedCommand: AssistantCommand = command === 'auto' ? 'build' : command
      let routedFrame = command !== 'auto' && (command === 'fill' || command === 'expand') ? frame : undefined
      let routedCard = command === 'revise' ? targetNote : undefined
      let routedSection = command === 'expand' ? currentSectionId : undefined
      let routedReplace = replace

      if (command === 'auto') {
        const route = routeMessage(prompt, priorConversation)
        if (route.status === 'clarify') {
          finishTurn(turnId, route.message)
          setProgress('')
          return
        }
        if (route.status === 'action') {
          if (route.action === 'delete') {
            setPendingDelete({ refs: route.targetCardRefs, turnId })
            finishTurn(turnId, `Confirm deleting ${route.targetCardRefs.length === 1 ? `“${route.targetCardRefs[0].title}”` : `${route.targetCardRefs.length} notes`}.`)
            setProgress('Review the selected note(s) before deleting.')
            return
          }

          const target = cards.find(item => item.id === route.targetCardRef.id)
          const destination = cards.find(item => item.id === route.destinationCardRef.id)
          if (!target || !destination || target.title !== route.targetCardRef.title || destination.title !== route.destinationCardRef.title || target.locked || destination.locked) {
            finishTurn(turnId, 'I stopped because one of those notes changed or became locked. Please send the move again using the current note titles.')
            setProgress('')
            return
          }
          busyRef.current = true
          setBusy(true)
          setProgress('Moving the note on this board…')
          const savedTask = readAssistantTask(boardId, localStorage)
          if (savedTask && savedTask.status !== 'complete') throw new Error('Recover the interrupted assistant task before moving notes.')
          if (savedTask) keepAssistantTask(boardId, localStorage)
          setTask(null)
          setSummary(null)
          const position = relativeNotePosition(target, destination, route.direction)
          await props.onMoveNote(target.id, position.x, position.y)
          props.onLocateNote(target.id)
          finishTurn(turnId, `Moved “${target.title}” ${route.direction} of “${destination.title}”. Use Undo on the board to move it back.`)
          setProgress('Note moved. Undo is available on the board.')
          return
        }
        routedCommand = route.command
        routedReplace = route.replace
        routedSection = route.targetSectionId
        routedFrame = route.targetFrameRef ? frames.find(item => item.id === route.targetFrameRef!.id) : undefined
        routedCard = route.targetCardRef ? cards.find(item => item.id === route.targetCardRef!.id) : undefined
        if ((route.command === 'fill' || route.command === 'expand') && !routedFrame) {
          finishTurn(turnId, 'That assistant-created framework is no longer on this board. Ask me to create a fresh plan, or choose a current framework in Task & context.')
          setProgress('')
          return
        }
        if (route.command === 'revise' && (!routedCard || routedCard.locked)) {
          finishTurn(turnId, 'That assistant-created note is no longer available or is locked. Name another unlocked note from this chat.')
          setProgress('')
          return
        }
      }

      const targetDefinition = assistantFrameworks.find(def => def.type === routedFrame?.type)
      const requestSources = scope === 'board'
        ? props.availableSources.filter(source => source.kind !== 'image' && !(source.kind === 'pdf-page' && !source.body.trim()))
        : scope === 'selected' ? props.availableSources.filter(source => sourceSelection.includes(source.id)) : []
      const history = priorConversation.turns.flatMap(turn => turn.messages.map(entry => ({ role: entry.role, text: entry.content })))
      const context: AssistantContext = JSON.parse(JSON.stringify({
        boardId,
        command: routedCommand,
        goal: prompt,
        history,
        sources: requestSources,
        targetFrame: routedCommand === 'fill' || routedCommand === 'expand' ? routedFrame : undefined,
        targetSection: routedCommand === 'expand' ? routedSection : undefined,
        targetCard: routedCommand === 'revise' ? routedCard : undefined,
        replace: routedReplace,
      }))

      busyRef.current = true
      setBusy(true)
      setSummary(null)
      const controller = new AbortController()
      abort.current = controller
      assertAssistantContextCurrent(context, { ...propsRef.current.operations.getSnapshot(), sources: propsRef.current.availableSources })
      const images: AssistantImageAttachment[] = []
      for (const source of requestSources) {
        if (source.kind !== 'image' && !(source.kind === 'pdf-page' && (!source.body.trim() || includePageImages))) continue
        const raw = await propsRef.current.loadSourceImage(source)
        if (!raw) throw new Error(`Could not load the selected image: ${source.source_label ?? source.title}`)
        images.push({ sourceId: source.id, title: source.source_label ?? source.title, dataUrl: await prepareImageAttachment(raw) })
      }
      context.images = images
      setProgress('Drafting from the selected sources…')
      setStreamSummary('')
      const stream = new AssistantExplanationStream()
      const output = await generateNativeAssistant(assistantRequest(context, assistantFrameworks), controller.signal, chunk => {
        const next = stream.push(chunk)
        if (next) setStreamSummary(next)
      })
      if (controller.signal.aborted) {
        finishTurn(turnId, 'Generation stopped. Your request is kept.')
        return
      }
      setProgress('Checking sections, source links and current writing…')
      const plan = validateAssistantPlan(output, context, assistantFrameworks)
      assertAssistantContextCurrent(context, { ...propsRef.current.operations.getSnapshot(), sources: propsRef.current.availableSources })
      const needsReview = context.command === 'revise' || (context.replace && plan.sections.some(w => assistantSectionText(context.targetFrame!, targetDefinition!.sections.find(s => s.id === w.sectionId)!).trim()))
      if (needsReview) {
        finishTurn(turnId, 'I drafted a replacement. Compare it below before anything changes.')
        setReview({ plan, context, turnId }); setProgress('Compare the writing before replacing it.')
      } else {
        await apply(plan, context, controller.signal)
        const recommended = plan.frameworkRecommendation
        const recommendedLabel = recommended ? assistantFrameworks.find(item => item.type === recommended.type)?.label : undefined
        const response = recommended && recommendedLabel
          ? `Best fit: ${recommendedLabel}\n${recommended.rationale}\n\n${plan.explanation}`
          : plan.explanation
        finishTurn(turnId, response)
      }
    } catch (e) {
      const detail = message(e)
      setProgress('')
      if (turnId) finishTurn(turnId, `I couldn't finish that request. ${detail}`)
      else { setGoal(prompt); setError(detail) }
    }
    finally { busyRef.current = false; setBusy(false); abort.current = null }
  }

  const applyReview = async () => {
    if (!review || busyRef.current) return
    busyRef.current = true; setBusy(true); setError('')
    setProgress('Saving the reviewed draft…')
    setStreamSummary('')
    const controller = new AbortController(); abort.current = controller
    try {
      await apply(review.plan, review.context, controller.signal)
      finishTurn(review.turnId, review.plan.explanation)
    }
    catch (e) { setError(message(e)) }
    finally { busyRef.current = false; setBusy(false); abort.current = null }
  }

  const undoTask = async () => {
    if (!task || busyRef.current) return
    busyRef.current = true; setBusy(true); setError('')
    setProgress('Restoring the writing from before this task…')
    setStreamSummary('')
    try {
      const before = propsRef.current.operations.getSnapshot()
      await undoAssistantTask(task, propsRef.current.operations, localStorage)
      const previous = conversationRef.current.lastResult
      if (previous) {
        const generatedCards = new Set(before.cards.filter(card => (card as Card & { ai_task_id?: string }).ai_task_id === task.id).map(card => card.id))
        const createdFrames = new Set(task.effects.frames.map(frame => frame.id))
        const afterUndo = removeAssistantConversationResultReferences(
          previous,
          { frameIds: [...createdFrames], cardIds: [...generatedCards] },
          `undo:${task.id}`,
          new Date().toISOString(),
        )
        updateLastResult(afterUndo)
      }
      propsRef.current.onTaskBoundary(); setTask(null); setProgress('Task undone and saved.'); setSummary(null)
    }
    catch (e) { setError(message(e)) }
    finally { busyRef.current = false; setBusy(false) }
  }

  const confirmDelete = async () => {
    if (!pendingDelete || busyRef.current) return
    busyRef.current = true
    setBusy(true)
    setError('')
    setProgress('Deleting the confirmed note(s)…')
    try {
      const currentCards = pendingDelete.refs.map(ref => ({ ref, card: propsRef.current.cards.find(item => item.id === ref.id) }))
      if (currentCards.some(({ ref, card }) => !card || card.title !== ref.title || card.locked)) {
        throw new Error('A selected note changed or became locked. Nothing was deleted; send the request again.')
      }
      const savedTask = readAssistantTask(boardId, localStorage)
      if (savedTask && savedTask.status !== 'complete') throw new Error('Recover the interrupted assistant task before deleting notes.')
      if (savedTask) keepAssistantTask(boardId, localStorage)
      setTask(null)
      setSummary(null)

      const deleted: Card[] = []
      let failure: unknown
      for (const item of currentCards) {
        if (!item.card) continue
        try {
          await propsRef.current.onDeleteNote(item.card.id)
          deleted.push(item.card)
        } catch (cause) {
          failure = cause
          break
        }
      }
      const previous = conversationRef.current.lastResult
      if (previous && deleted.length) {
        try {
          updateLastResult(removeAssistantConversationResultReferences(
            previous,
            { frameIds: [], cardIds: deleted.map(card => card.id) },
            `delete:${pendingDelete.turnId}`,
            new Date().toISOString(),
          ))
        } catch { /* A stale reference is ignored when routing against current board cards. */ }
      }
      if (failure) {
        finishTurn(pendingDelete.turnId, deleted.length
          ? `Deleted ${deleted.map(card => `“${card.title}”`).join(', ')}. ${message(failure)} Use Undo on the board to restore the deleted note(s).`
          : `Nothing was deleted. ${message(failure)}`)
        setProgress(deleted.length ? 'Some notes were deleted. Undo is available on the board.' : '')
      } else {
        finishTurn(pendingDelete.turnId, `Deleted ${deleted.map(card => `“${card.title}”`).join(', ')}. Use Undo on the board to restore them.`)
        setProgress('Note deletion saved. Undo is available on the board.')
      }
      setPendingDelete(null)
    } catch (cause) {
      setError(message(cause))
      finishTurn(pendingDelete.turnId, `I did not delete the note(s). ${message(cause)}`)
      setPendingDelete(null)
      setProgress('')
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }

  const cancelDelete = () => {
    if (!pendingDelete || busyRef.current) return
    finishTurn(pendingDelete.turnId, 'Deletion cancelled. Your notes are unchanged.')
    setPendingDelete(null)
    setProgress('')
  }

  return <aside className={`ib-writing-panel ${dark ? 'is-dark' : ''}`} aria-label="Board Assistant" hidden={!open} style={{ display: open ? 'flex' : 'none', background: dark ? colors.surfaceDark : colors.surfaceLight, color: dark ? '#F7F7F2' : colors.ink }}>
    <PanelStyle dark={dark} />
    <header className="ib-chat-header">
      <div className="ib-chat-heading">
        <Sparkles size={19} color={dark ? colors.markerYellow : colors.markerPurple} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <h2 style={{ fontFamily: fonts.display, fontSize: 17, margin: 0 }}>Board Assistant</h2>
          <div className="ib-chat-board-name" title={props.boardName}>{props.boardName}</div>
        </div>
        <button className="ib-panel-small ib-icon-button" onClick={props.onClose} aria-label="Close assistant" title="Close assistant"><X size={16} /></button>
      </div>
      <div className="ib-chat-tools">
        <span className="ib-chat-connection" title={status.configured ? `${status.provider ?? 'AI'}${status.model ? ` · ${status.model}` : ''}` : 'AI provider status'}>
          <span className={`ib-connection-dot ${status.configured ? 'is-ready' : ''}`} />
          {!status.available ? 'Open Mac app for AI' : status.configured ? `${status.provider ?? 'AI'} ready` : 'AI not connected'}
        </span>
        <button className="ib-panel-small ib-icon-button" onClick={props.onSearch} aria-label="Find source notes" title="Find source notes"><Search size={15} /></button>
        <button className="ib-panel-small ib-icon-button" disabled={!status.available} onClick={async () => { try { await nativeAIRequest('settings'); await refreshStatus() } catch (e) { setError(message(e)) } }} aria-label="AI settings" title={status.available ? 'AI settings' : 'Open the Mac app for AI settings'}><Settings2 size={15} /></button>
      </div>
    </header>

    <div ref={chatThreadRef} className="ib-chat-thread" role="log" aria-label="Assistant conversation" aria-live="polite" onScroll={e => {
      const thread = e.currentTarget
      shouldFollowChatRef.current = thread.scrollHeight - thread.scrollTop - thread.clientHeight < 40
    }}>
      {!messages.length && <div className="ib-chat-welcome">
        <span className="ib-chat-welcome-mark"><Sparkles size={18} /></span>
        <strong>What are we figuring out?</strong>
        <p>Tell me what you are working on. I can draft the framework, then refine it from your follow-up notes.</p>
        {!status.available && <div className="ib-chat-notice">Open the installed Mac app to connect an AI provider. Your notes and frameworks still work here.</div>}
      </div>}
      {messages.map(item => item.text ? <div key={item.id} className={`ib-chat-row ${item.role === 'user' ? 'is-user' : 'is-assistant'}`}>
        {item.role === 'assistant' && <span className="ib-chat-avatar"><Sparkles size={12} /></span>}
        <div className={`ib-chat-bubble ${item.role === 'user' ? 'ib-chat-user-bubble' : 'ib-chat-assistant-bubble'}`}>{item.text}</div>
      </div> : null)}
      {busy && <div className="ib-chat-row is-assistant">
        <span className="ib-chat-avatar"><Sparkles size={12} /></span>
        <div className="ib-chat-bubble ib-chat-assistant-bubble ib-chat-live" role="status">
          <span className="ib-chat-live-title"><span className="ib-assistant-activity-dot" aria-hidden="true" />{progress || 'Working…'}</span>
          {streamSummary && <span className="ib-chat-stream"><strong>Drafting:</strong> {streamSummary}</span>}
        </div>
      </div>}
      {error && !busy && !messages.some(item => item.role === 'assistant' && item.text.includes(error)) && <div role="alert" className="ib-chat-error">{error}</div>}
      {!busy && progress && <div className="ib-chat-status" role="status">{progress}</div>}

      {review && <section className="ib-chat-result">
        <h3 style={{ fontFamily: fonts.display, margin: 0, fontSize: 15 }}>Review before replacing</h3>
        <p style={{ fontSize: 13, margin: 0, lineHeight: 1.55 }}>{review.plan.explanation}</p>
        {review.plan.sections.map(w => {
          const def = assistantFrameworks.find(d => d.type === review.context.targetFrame!.type)!
          const area = def.sections.find(s => s.id === w.sectionId)!
          return <Comparison key={w.sectionId} label={area.label} before={assistantSectionText(review.context.targetFrame!, area)} after={w.text} />
        })}
        {review.plan.revisions.map(w => <Comparison key={w.cardId} label={w.title} before={`${review.context.targetCard!.title}\n\n${review.context.targetCard!.body}`} after={`${w.title}\n\n${w.body}`} />)}
        <div style={{ fontSize: 12 }}>Applying also creates {review.plan.cards.length} related draft notes.</div>
        <button className="ib-panel-button" disabled={busy} onClick={applyReview}><Check size={15} /> Apply reviewed task</button>
        <button className="ib-panel-small" disabled={busy} onClick={() => { finishTurn(review.turnId, 'Draft discarded. Your writing is unchanged.'); setReview(null); setProgress('Draft discarded. Your writing is unchanged.') }}>Discard draft</button>
      </section>}
      {pendingDelete && <section className="ib-chat-result" aria-labelledby="ib-delete-confirm-title">
        <h3 id="ib-delete-confirm-title" style={{ fontFamily: fonts.display, margin: 0, fontSize: 15 }}>Delete these notes?</h3>
        <ul>{pendingDelete.refs.map(ref => <li key={ref.id}>{ref.title}</li>)}</ul>
        <p style={{ fontSize: 12, lineHeight: 1.5, margin: 0 }}>This removes the selected notes from the board. You can restore them with Undo on the board.</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <button type="button" className="ib-panel-small" disabled={busy} onClick={cancelDelete}><X size={14} /> Keep notes</button>
          <button type="button" className="ib-panel-button" style={{ background: colors.markerCoral }} disabled={busy} onClick={() => void confirmDelete()}><Trash2 size={14} /> Delete {pendingDelete.refs.length === 1 ? 'note' : `${pendingDelete.refs.length} notes`}</button>
        </div>
      </section>}
      {summary && summary.assumptions.length > 0 && <section className="ib-chat-result">
        <strong>Assumptions / open questions</strong>
        <ul>{summary.assumptions.map((a, i) => <li key={i}>{a}</li>)}</ul>
      </section>}
      {task && <section className="ib-chat-result">
        <strong style={{ fontSize: 14 }}>{task.status === 'complete' ? 'Latest board change' : 'Interrupted task'}</strong>
        <span style={{ fontSize: 12, lineHeight: 1.5 }}>{task.status === 'complete' ? 'Your chat can continue. Undo reverses this change if its writing has not been edited since.' : 'Some drafts may have been saved. Undo restores the previous writing, or keep the partial result.'}</span>
        <button className="ib-panel-small" onClick={() => props.locate(task)}>Show on board</button>
        <button className="ib-panel-small" disabled={busy} onClick={undoTask}><Undo2 size={14} /> Undo latest change</button>
        {task.status !== 'complete' && <button className="ib-panel-button" disabled={busy} onClick={() => { try { keepAssistantTask(boardId, localStorage); setTask(null); setProgress('Partial drafts kept. You can continue chatting.') } catch (e) { setError(message(e)) } }}>Keep partial work</button>}
      </section>}
      <div ref={chatEndRef} />
    </div>

    <form className="ib-chat-composer" onSubmit={e => { e.preventDefault(); if (!busy) void generate() }}>
      {contextOpen && <div className="ib-chat-context" role="group" aria-label="Task and context settings">
        <div className="ib-chat-context-head"><strong>Context</strong><span>Choose a task mode or select source material</span></div>
        <label>Task
          <select className="ib-panel-control" value={command} disabled={busy || !!review || blockedByTask} onChange={e => { setCommand(e.target.value as AssistantCommand | 'auto'); setReplace(false) }}>
            {commands.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
          <span className="ib-context-help">{commands.find(c => c.id === command)!.help}</span>
        </label>
        <label>Source material
          <select className="ib-panel-control" value={scope} disabled={busy || !!review || blockedByTask} onChange={e => setScope(e.target.value as typeof scope)}>
            <option value="selected">Selected sources ({sourceSelection.length})</option>
            <option value="board">All board sources ({props.availableSources.length})</option>
            <option value="goal">Goal only</option>
          </select>
        </label>
        <div className="ib-context-sources">
          {props.availableSources.length > 0 && <div className="ib-source-list" style={{ maxHeight: 170 }}>
            {props.availableSources.map(source => <div key={source.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input type="checkbox" aria-label={`Include ${source.source_label ?? source.title}`} checked={sources.some(selected => selected.id === source.id)} disabled={scope === 'board' || busy || !!review} onChange={event => setSourceSelection(current => event.target.checked ? [...new Set([...current, source.id])] : current.filter(id => id !== source.id))} />
              <button type="button" className="ib-panel-small" style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={`${sourceTypeName(source.kind)} · ${source.source_label ?? source.title}`} onClick={() => {
                if (source.kind === 'markdown' || source.kind === 'text') setPreviewSourceId(current => current === source.id ? null : source.id)
                else props.onLocateSource(source)
              }}>{source.source_label ?? source.title}</button>
              {status.available && (source.kind === 'image' || source.kind === 'pdf-page') && !source.body.trim() && <button type="button" className="ib-panel-small" title="Extract text on this Mac" aria-label={`Extract text from ${source.title}`} disabled={busy} onClick={() => void props.onExtractSourceText(source)}><Search size={13} /></button>}
              {(source.kind === 'markdown' || source.kind === 'text') && <button type="button" className="ib-panel-small" title="Remove imported source" aria-label={`Remove ${source.title}`} disabled={busy} onClick={() => void props.onRemoveSource(source).then(() => setSourceSelection(current => current.filter(id => id !== source.id))).catch(error => setError(message(error)))}><X size={13} /></button>}
            </div>)}
          </div>}
          {previewSourceId && props.availableSources.find(source => source.id === previewSourceId) && <div style={{ maxHeight: 110, overflow: 'auto', padding: 8, border: '1px solid #8891A4', borderRadius: 6, fontSize: 10, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{props.availableSources.find(source => source.id === previewSourceId)!.body.slice(0, 3000)}</div>}
          <button type="button" className="ib-panel-small" onClick={() => sourceFileInputRef.current?.click()} disabled={busy}><FileUp size={13} /> Add PDF, image, Markdown, or text</button>
          <input ref={sourceFileInputRef} hidden type="file" multiple accept=".pdf,.md,.markdown,.txt,image/png,image/jpeg,image/webp" onChange={event => {
            const files = Array.from(event.currentTarget.files ?? [])
            event.currentTarget.value = ''
            if (files.length) void props.onImportFiles(files).then(imported => setSourceSelection(current => [...new Set([...current, ...imported.map(source => source.id)])])).catch(error => setError(message(error)))
          }} />
          {sources.length ? <strong>{sources.length} source{sources.length === 1 ? '' : 's'} selected</strong> : <span>Only your prompt will be used. Unknown facts stay assumptions or questions.</span>}
          <span className="ib-context-help">Text and searchable PDF pages can be sent as text. Images are sent only when selected. Scanned pages can be read with on-device OCR.</span>
        </div>
        {sources.some(source => source.kind === 'pdf-page' && source.body.trim()) && <label className="ib-context-check"><input type="checkbox" checked={includePageImages} disabled={busy || !!review} onChange={event => setIncludePageImages(event.target.checked)} /> Also send selected PDF page images for visual details</label>}
        {needsFrame && <label>Framework
          <select className="ib-panel-control" value={frameId} disabled={busy || !!review} onChange={e => setFrameId(e.target.value)}>
            <option value="">Select a framework</option>
            {frames.filter(f => assistantFrameworks.some(d => d.type === f.type)).map(f => <option key={f.id} value={f.id}>{f.name || getFrameworkLabel(f.type, f.customFramework)}</option>)}
          </select>
          <span className="ib-context-help">Its current writing is included as context.</span>
        </label>}
        {command === 'expand' && definition && <label>Section
          <select className="ib-panel-control" value={currentSectionId} disabled={busy || !!review} onChange={e => setSectionId(e.target.value)}>{definition.sections.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}</select>
        </label>}
        {command === 'revise' && <label>Note to revise
          <select className="ib-panel-control" value={noteId} disabled={busy || !!review} onChange={e => setNoteId(e.target.value)}>
            <option value="">Select a note</option>
            {cards.map(c => <option key={c.id} value={c.id} disabled={c.locked}>{c.title}{c.locked ? ' (locked)' : ''}</option>)}
          </select>
          <span className="ib-context-help">Locked notes cannot be revised.</span>
        </label>}
        {needsFrame && <label className="ib-context-check"><input type="checkbox" checked={replace} disabled={busy || !!review || blockedByTask} onChange={e => setReplace(e.target.checked)} /> Suggest replacements with a comparison</label>}
        {status.available && <label className="ib-context-check"><input type="checkbox" checked={consent} disabled={busy} onChange={e => setConsent(e.target.checked)} /> Send this message, recent chat, selected sources, and target writing to my configured provider.</label>}
        {status.available && <button type="button" className="ib-panel-small" onClick={refreshStatus}>Check AI connection</button>}
      </div>}
      <div className="ib-chat-composer-tools">
          <button type="button" className="ib-panel-small ib-context-toggle" aria-expanded={contextOpen} onClick={() => setContextOpen(value => !value)} disabled={busy || !!review || blockedByTask}>
          <Paperclip size={14} /> {sources.length ? `${sources.length} source${sources.length === 1 ? '' : 's'}` : 'Add context'} <ChevronDown size={13} />
        </button>
        {!status.available && <span className="ib-composer-hint">Mac app required for AI</span>}
      </div>
      <textarea className="ib-chat-input" aria-label="Message Board Assistant" rows={2} value={goal} maxLength={ASSISTANT_LIMITS.goal} disabled={busy || !!review || !!pendingDelete || blockedByTask} onChange={e => setGoal(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (!busy) void generate() } }} placeholder={status.available ? 'Describe what you want to create or change…' : 'Connect AI in Mac settings for AI writing'} />
      <div className="ib-chat-composer-bottom">
        <span className="ib-composer-hint">{status.available && !consent ? 'Confirm sharing in Context' : status.configured ? `${status.provider ?? 'AI'}${status.model ? ` · ${status.model}` : ''}` : 'Your notes stay editable'}</span>
        {busy ? <button type="button" className="ib-panel-small ib-stop-button" onClick={() => abort.current?.abort()}><Square size={13} /> Stop</button> : <button type="submit" className="ib-send-button" aria-label="Send message" title="Send message" disabled={!canSubmit}><Send size={16} /></button>}
      </div>
    </form>
  </aside>
}

function Comparison({ label, before, after }: { label: string; before: string; after: string }) {
  return <div style={{ border: '1px solid #8891A4', borderRadius: 7, padding: 12 }}><strong style={{ fontSize: 13 }}>{label}</strong><div style={{ fontSize: 11, marginTop: 12, opacity: .75 }}>Current writing</div><pre>{before || '(Empty)'}</pre><div style={{ fontSize: 11, opacity: .75 }}>Suggested replacement</div><pre>{after}</pre></div>
}
function estimatedCardHeight(card: Card) {
  if (card.collapsed) return 52
  if (card.card_height) return card.card_height
  const charsPerLine = Math.max(18, Math.floor(card.card_width / 7))
  const countLines = (text: string) => text.split('\n').reduce((total, line) => total + Math.max(1, Math.ceil(line.length / charsPerLine)), 0)
  return Math.max(150, 86 + (countLines(card.title) + countLines(card.body)) * 21)
}
function relativeNotePosition(note: Card, destination: Card, direction: AssistantMoveDirection) {
  const gap = 48
  const noteWidth = note.card_width || 185
  const destinationWidth = destination.card_width || 185
  const noteHeight = estimatedCardHeight(note)
  const destinationHeight = estimatedCardHeight(destination)
  switch (direction) {
    case 'left': return { x: destination.x - noteWidth - gap, y: destination.y }
    case 'right': return { x: destination.x + destinationWidth + gap, y: destination.y }
    case 'above': return { x: destination.x, y: destination.y - noteHeight - gap }
    case 'below': return { x: destination.x, y: destination.y + destinationHeight + gap }
  }
}
function message(e: unknown) { return e instanceof Error ? e.message : 'The task could not be completed. Your request is kept.' }
function sourceTypeName(kind: AssistantSource['kind']) {
  switch (kind) {
    case 'pdf-page': return 'PDF page'
    case 'image': return 'Image'
    case 'text-block': return 'Canvas text'
    case 'framework': return 'Framework'
    case 'goal-tag': return 'Board goal'
    case 'markdown': return 'Markdown'
    case 'text': return 'Text file'
    default: return 'Note'
  }
}
