import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowDown, ArrowUp, FilePlus2, LoaderCircle, Plus, Sparkles, Square, Trash2, X } from 'lucide-react'
import type { CustomFrameworkTemplate, FrameworkLayout } from '../types'
import { colors, fonts } from '../lib/designTokens'
import { buildFrameworkDesignerRequest, createCustomFrameworkTemplate, validateFrameworkDesignReply, type FrameworkSectionDraft } from '../lib/customFrameworks'
import type { AssistantSource } from '../lib/assistantPlan'
import { generateValidatedAssistantDraft, nativeAIStatus, type NativeAIStatus } from '../lib/nativeAssistant'
import FrameworkLayoutPreview, { FrameworkLayoutThumbnail } from './FrameworkLayoutPreview'
import { clearFrameworkDesignerDraft, frameworkDesignerDraftKey, readFrameworkDesignerDraft, writeFrameworkDesignerDraft } from '../lib/frameworkDesignerDraft'

const layoutChoices: { value: FrameworkLayout; label: string; detail: string }[] = [
  { value: 'grid', label: 'Idea grid', detail: 'Explore independent ideas' },
  { value: 'flow', label: 'Step-by-step', detail: 'Follow a sequence' },
  { value: 'matrix', label: '2 × 2 matrix', detail: 'Compare four quadrants' },
  { value: 'cycle', label: 'Learning cycle', detail: 'Repeat and improve' },
]

interface Props {
  open: boolean
  boardId: string
  dark: boolean
  sources: AssistantSource[]
  initialTemplate?: CustomFrameworkTemplate
  initialDesign?: { template: CustomFrameworkTemplate; goal: string; sourceIds: string[] }
  onImportFiles?: (files: File[]) => Promise<AssistantSource[]>
  onSave: (template: CustomFrameworkTemplate) => boolean
  onDelete: (id: string) => boolean
  onAdd: (template: CustomFrameworkTemplate) => boolean
  onClose: () => void
}

function templateSignature(template: {
  label: string
  purpose: string
  layout: FrameworkLayout
  sections: { id?: string; label: string; guidance?: string; writingGuidance?: string }[]
}) {
  return JSON.stringify({
    label: template.label,
    purpose: template.purpose,
    layout: template.layout,
    sections: template.sections.map(section => ({ id: section.id, label: section.label, guidance: section.guidance ?? section.writingGuidance ?? '' })),
  })
}

export default function FrameworkDesignerModal({ open, boardId, dark, sources, initialTemplate, initialDesign, onImportFiles, onSave, onDelete, onAdd, onClose }: Props) {
  const startingTemplate = initialDesign?.template ?? initialTemplate
  const draftKey = frameworkDesignerDraftKey(boardId, startingTemplate?.id)
  const [recoveredDraft] = useState(() => {
    const draft = readFrameworkDesignerDraft(draftKey)
    return initialTemplate && draft?.savedStructure !== templateSignature(initialTemplate) ? null : draft
  })
  const [goal, setGoal] = useState(recoveredDraft?.goal ?? initialDesign?.goal ?? initialTemplate?.purpose ?? '')
  const [label, setLabel] = useState(recoveredDraft?.label ?? startingTemplate?.label ?? '')
  const [purpose, setPurpose] = useState(recoveredDraft?.purpose ?? startingTemplate?.purpose ?? '')
  const [layout, setLayout] = useState<FrameworkLayout>(recoveredDraft?.layout ?? startingTemplate?.layout ?? 'grid')
  const [sections, setSections] = useState<FrameworkSectionDraft[]>(recoveredDraft?.sections ?? startingTemplate?.sections.map(section => ({
    id: section.id, label: section.label, guidance: section.writingGuidance,
  })) ?? [])
  const [templateId, setTemplateId] = useState(recoveredDraft?.templateId ?? startingTemplate?.id)
  const [savedTemplateId, setSavedTemplateId] = useState(recoveredDraft?.savedTemplateId ?? initialTemplate?.id)
  const [templateRevision, setTemplateRevision] = useState(recoveredDraft?.templateRevision ?? startingTemplate?.revision ?? 1)
  const [savedStructure, setSavedStructure] = useState(recoveredDraft?.savedStructure ?? (initialTemplate ? templateSignature(initialTemplate) : ''))
  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>(recoveredDraft?.selectedSourceIds ?? initialDesign?.sourceIds ?? [])
  const [sendSources, setSendSources] = useState(false)
  const [status, setStatus] = useState<NativeAIStatus>({ available: false, configured: false })
  const [busy, setBusy] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importNotice, setImportNotice] = useState('')
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [receiving, setReceiving] = useState(false)
  const [progress, setProgress] = useState(initialDesign ? 'Framework ready to edit. Review the preview, then save it.' : '')
  const [designResponse, setDesignResponse] = useState('')
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(!!recoveredDraft || !!initialDesign)
  const [draftStored, setDraftStored] = useState(!!recoveredDraft)
  const dialogRef = useRef<HTMLElement>(null)
  const briefRef = useRef<HTMLTextAreaElement>(null)
  const controllerRef = useRef<AbortController | null>(null)
  const importInputRef = useRef<HTMLInputElement>(null)
  const importingRef = useRef(false)
  const mountedRef = useRef(false)
  const working = busy || importing
  const visibleSources = useMemo(() => sources.slice(0, 200), [sources])
  const selectedSources = useMemo(() => sources.filter(source => source.body.trim() && selectedSourceIds.includes(source.id)), [selectedSourceIds, sources])
  const designSources = selectedSources.map(source => ({ id: source.id, title: source.source_label ?? source.title, body: source.body }))
  const contextSize = JSON.stringify({ command: 'design-framework', goal: goal.trim(), boardId, sources: designSources, frameworks: [] }).length
  const contextTooLong = contextSize > 24000
  const canSave = !!label.trim() && !!purpose.trim() && sections.length >= 2 && sections.length <= 8 && (layout !== 'matrix' || sections.length === 4)
    && sections.every(section => section.label.trim() && section.guidance.trim())
  const previewTemplate = useMemo(() => {
    const count = layout === 'matrix' || !sections.length ? 4 : Math.max(2, sections.length)
    return createCustomFrameworkTemplate({ label: label.trim() || 'Your framework', purpose: purpose.trim() || 'A reusable space to think through your goal.', layout,
      sections: Array.from({ length: count }, (_, index) => ({ id: `preview-${index}`, label: sections[index]?.label.trim() || `Section ${index + 1}`, guidance: sections[index]?.guidance.trim() || 'Add a question or writing prompt.' })),
    }, () => 'preview')
  }, [label, layout, purpose, sections])
  const surface = dark ? '#202B43' : '#FFFDF5'
  const ink = dark ? '#F7F7F2' : colors.ink
  const muted = dark ? '#C4CAD8' : '#5A6274'
  const border = dark ? '#8290A8' : '#8891A4'

  useEffect(() => {
    if (!open || !hasUnsavedChanges) return
    setDraftStored(writeFrameworkDesignerDraft(draftKey, { goal, label, purpose, layout, sections, templateId, savedTemplateId, templateRevision, savedStructure, selectedSourceIds }))
  }, [draftKey, goal, hasUnsavedChanges, label, layout, open, purpose, savedStructure, savedTemplateId, sections, selectedSourceIds, templateId, templateRevision])

  useEffect(() => {
    if (!open) return
    mountedRef.current = true
    let cancelled = false
    void nativeAIStatus().then(next => { if (!cancelled) setStatus(next) }).catch(() => {})
    const timer = window.setTimeout(() => (initialTemplate ? dialogRef.current?.querySelector<HTMLInputElement>('[data-first-focus]') : briefRef.current)?.focus(), 0)
    return () => { cancelled = true; mountedRef.current = false; clearTimeout(timer); controllerRef.current?.abort() }
  }, [initialTemplate, open])

  useEffect(() => {
    if (!busy) return
    const startedAt = Date.now()
    const timer = window.setInterval(() => setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000)), 1000)
    return () => window.clearInterval(timer)
  }, [busy])

  const close = () => {
    if (busy || importingRef.current) return
    if (hasUnsavedChanges && !writeFrameworkDesignerDraft(draftKey, { goal, label, purpose, layout, sections, templateId, savedTemplateId, templateRevision, savedStructure, selectedSourceIds })
      && !window.confirm('Your draft could not be saved locally. Close and discard these unsaved edits?')) return
    onClose()
  }

  const generate = async () => {
    if (importingRef.current || controllerRef.current || !goal.trim() || !status.configured || contextTooLong || (selectedSources.length && !sendSources)) return
    setError('')
    setSaved(false)
    setHasUnsavedChanges(true)
    const controller = new AbortController()
    controllerRef.current = controller
    setElapsedSeconds(0)
    setReceiving(false)
    setDesignResponse('')
    setBusy(true)
    setProgress('Request started · waiting for an AI response…')
    try {
      const request = buildFrameworkDesignerRequest(boardId, goal, designSources, layout)
      let receivedResponse = false
      const { template, response } = await generateValidatedAssistantDraft(request, controller.signal, output =>
        validateFrameworkDesignReply(output, undefined, layout), chunk => {
        if (!chunk || receivedResponse || controller.signal.aborted) return
        receivedResponse = true
        setReceiving(true)
        setProgress('AI response arriving · designing your sections…')
      }, () => setProgress('The first draft did not fit your brief. Correcting it once…'))
      if (controller.signal.aborted) return
      setProgress('Response received · checking the framework…')
      setDesignResponse(response)
      setLabel(template.label)
      setPurpose(template.purpose)
      setLayout(template.layout)
      setSections(template.sections.map(section => ({ id: section.id, label: section.label, guidance: section.writingGuidance })))
      if (!templateId) {
        setTemplateId(template.id)
        setTemplateRevision(template.revision)
      }
      setProgress('Framework ready to edit.')
    } catch (cause) {
      if (controller.signal.aborted) {
        setError('')
        setProgress('Design stopped. Your brief and framework edits are kept.')
      } else {
        setError(cause instanceof Error ? cause.message : 'Could not design this framework. Try a more specific brief.')
        setProgress('')
      }
    } finally {
      setBusy(false)
      controllerRef.current = null
    }
  }

  const buildTemplate = () => createCustomFrameworkTemplate({
    id: templateId,
    revision: templateId && templateId === savedTemplateId
      ? templateRevision + (savedStructure && savedStructure !== templateSignature({ label, purpose, layout, sections }) ? 1 : 0)
      : 1,
    label,
    purpose,
    layout,
    sections,
  })

  const save = (addToBoard: boolean) => {
    if (busy || importingRef.current) return
    setError('')
    try {
      const template = buildTemplate()
      if (!onSave(template)) return
      setTemplateId(template.id)
      setSavedTemplateId(template.id)
      setTemplateRevision(template.revision)
      setSavedStructure(templateSignature(template))
      setSaved(true)
      setHasUnsavedChanges(false)
      clearFrameworkDesignerDraft(draftKey)
      if (addToBoard) {
        if (!onAdd(template)) {
          setError('The framework is saved, but could not be added to the canvas.')
          return
        }
        onClose()
      } else {
        setProgress('Saved to My frameworks.')
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Complete the framework fields and try again.')
    }
  }

  const remove = () => {
    if (!initialTemplate) return
    const detail = hasUnsavedChanges ? ' Unsaved changes will also be discarded.' : ''
    if (!window.confirm(`Remove “${initialTemplate.label}” from My frameworks? Existing board frames will stay unchanged.${detail}`)) return
    try {
      if (onDelete(initialTemplate.id)) { clearFrameworkDesignerDraft(draftKey); onClose() }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not remove this framework.')
    }
  }

  const updateSection = (index: number, patch: Partial<FrameworkSectionDraft>) => {
    setSaved(false)
    setHasUnsavedChanges(true)
    setSections(current => current.map((section, i) => i === index ? { ...section, ...patch } : section))
  }
  const moveSection = (index: number, direction: -1 | 1) => {
    setSaved(false)
    setHasUnsavedChanges(true)
    setSections(current => {
      const target = index + direction
      if (target < 0 || target >= current.length) return current
      const next = [...current]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  const chooseLayout = (next: FrameworkLayout) => {
    if (busy || importingRef.current) return
    setLayout(next)
    if (next === 'matrix' && sections.length < 4) setSections(current => [...current, ...Array.from({ length: 4 - current.length }, () => ({ id: `section-${crypto.randomUUID()}`, label: '', guidance: '' }))])
    setSaved(false)
    setHasUnsavedChanges(true)
    setError('')
  }

  const discardDraft = () => {
    if (busy || importingRef.current) return
    if (!window.confirm('Discard this local draft? Saved frameworks and board material will stay unchanged.')) return
    if (!clearFrameworkDesignerDraft(draftKey)) { setError('Could not remove the local draft. Your edits are kept.'); return }
    setHasUnsavedChanges(false)
    onClose()
  }

  const importFiles = async (files: File[]) => {
    if (!onImportFiles || !files.length || busy || importingRef.current) return
    importingRef.current = true
    setImporting(true)
    setSendSources(false)
    setError('')
    setImportNotice('')
    try {
      const imported = await onImportFiles(files)
      if (!mountedRef.current) return
      const nextSources = [...designSources]
      let excluded = 0
      for (const source of imported) {
        if (nextSources.some(item => item.id === source.id)) continue
        const candidate = { id: source.id, title: source.source_label ?? source.title, body: source.body }
        const candidateSize = JSON.stringify({ command: 'design-framework', goal: goal.trim(), boardId, sources: [...nextSources, candidate], frameworks: [] }).length
        if (!source.body.trim() || nextSources.length >= 12 || candidateSize > 24000) excluded++
        else nextSources.push(candidate)
      }
      setSelectedSourceIds(nextSources.map(source => source.id))
      setHasUnsavedChanges(true)
      setSaved(false)
      setImportNotice(imported.length
        ? `Added ${imported.length} ${imported.length === 1 ? 'file' : 'files'} to your board.${excluded ? ` ${excluded} could not be selected within the text or item limit; the files are kept on your board.` : ' Their text is selected below.'} Review the text and allow sharing before designing.`
        : 'No files were added. Choose a Markdown (.md, .markdown) or text (.txt) file.')
    } catch (cause) {
      if (!mountedRef.current) return
      setError(cause instanceof Error ? cause.message : 'Could not import the file. Try a Markdown (.md, .markdown) or text (.txt) file.')
    } finally {
      importingRef.current = false
      if (mountedRef.current) setImporting(false)
    }
  }

  if (!open) return null
  return createPortal(<div className="ib-framework-scrim" onMouseDown={event => { if (event.target === event.currentTarget) close() }}>
    <section
      ref={dialogRef}
      className="ib-framework-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ib-framework-title"
      onKeyDown={event => {
        if (event.key === 'Escape') { event.preventDefault(); close(); return }
        if (event.key !== 'Tab' || !dialogRef.current) return
        const items = [...dialogRef.current.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled),summary')]
          .filter(item => item.offsetParent !== null)
        if (!items.length) return
        const first = items[0]
        const last = items[items.length - 1]
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
      }}
      style={{ '--ib-surface': surface, '--ib-ink': ink, '--ib-muted': muted, '--ib-border': border } as React.CSSProperties}
    >
      <style>{`
        .ib-framework-scrim { position:fixed; inset:0; z-index:300; display:grid; place-items:center; padding:14px; background:rgba(18,24,38,.52); font-family:${fonts.ui}; color:var(--ib-ink); }
        .ib-framework-dialog { width:min(920px,calc(100vw - 28px)); max-height:calc(100dvh - 28px); display:flex; flex-direction:column; overflow:hidden; border:2px solid ${colors.ink}; border-radius:10px; background:var(--ib-surface); color:var(--ib-ink); box-shadow:0 18px 56px rgba(0,0,0,.28); }
        .ib-framework-dialog * { box-sizing:border-box; }
        .ib-framework-dialog :focus-visible { outline:3px solid ${colors.markerCyan}; outline-offset:2px; }
        .ib-framework-head { display:flex; justify-content:space-between; align-items:center; gap:14px; padding:16px 18px; border-bottom:2px solid ${colors.ink}; }
        .ib-framework-head h2 { margin:0; font-family:${fonts.display}; font-size:20px; line-height:1.2; }
        .ib-framework-body { display:grid; grid-template-columns:minmax(230px,.8fr) minmax(0,1.35fr); flex:1; min-height:0; overflow:hidden; }
        .ib-framework-brief,.ib-framework-preview { min-width:0; padding:16px 18px; overflow:auto; }
        .ib-framework-brief { border-right:1px solid var(--ib-border); }
        .ib-framework-preview { display:grid; align-content:start; gap:13px; }
        .ib-framework-dialog label { display:grid; gap:6px; font-size:12px; font-weight:700; }
        .ib-framework-control { width:100%; min-width:0; border:1.5px solid var(--ib-border); border-radius:6px; padding:9px 10px; background:transparent; color:var(--ib-ink); font:inherit; font-size:13px; }
        .ib-framework-control:focus-visible { border-color:${colors.markerPurple}; }
        .ib-framework-dialog textarea.ib-framework-control { min-height:92px; resize:vertical; line-height:1.5; }
        .ib-framework-help { margin:7px 0 14px; color:var(--ib-muted); font-size:11px; line-height:1.45; }
        .ib-framework-source-list { display:grid; max-height:210px; overflow:auto; margin-top:7px; border-top:1px solid var(--ib-border); }
        .ib-framework-source { display:flex!important; grid-template-columns:none!important; align-items:center; gap:8px!important; padding:8px 2px; border-bottom:1px solid color-mix(in srgb,var(--ib-border) 45%,transparent); font-size:11px!important; font-weight:500!important; }
        .ib-framework-source span { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .ib-framework-source input,.ib-framework-consent input { accent-color:${colors.markerPurple}; }
        .ib-framework-source-row { padding:8px 0; border-bottom:1px solid var(--ib-border); }
        .ib-framework-source-row .ib-framework-source { border-bottom:0; padding:0; align-items:flex-start; }
        .ib-framework-source-row .ib-framework-source span { white-space:normal; overflow:visible; }
        .ib-framework-source-info { padding-left:22px; margin-top:4px; font-size:11px; line-height:1.45; color:var(--ib-muted); }
        .ib-framework-source-info summary { padding:4px 0; cursor:pointer; color:var(--ib-ink); }
        .ib-framework-source-info pre { white-space:pre-wrap; overflow-wrap:anywhere; max-height:160px; overflow:auto; font:inherit; margin:6px 0; }
        .ib-framework-shapes { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px; margin:10px 0 16px; }
        .ib-framework-shape { display:flex; flex-direction:column; align-items:center; gap:7px; background:transparent; color:var(--ib-ink); border:1.5px solid var(--ib-border); border-radius:7px; padding:10px 6px; font:inherit; font-size:12px; min-width:0; }
        .ib-framework-shape span { font-size:11px; color:var(--ib-muted); }
        .ib-framework-shape[aria-pressed="true"] { border-color:${colors.markerPurple}; background:${dark ? '#302E52' : '#F1EEFF'}; }
        .ib-framework-shape:disabled { opacity:.65; cursor:not-allowed; }
        .ib-framework-sharing { font-size:12px; line-height:1.5; margin:14px 0 10px; }
        .ib-framework-step { display:block; font-size:12px; margin:18px 0 7px; }
        .ib-framework-consent { display:flex!important; grid-template-columns:auto 1fr!important; align-items:flex-start; gap:8px!important; margin-top:11px; font-size:11px!important; font-weight:500!important; line-height:1.45; }
        .ib-framework-consent input { margin:2px 0 0; }
        .ib-framework-section { display:grid; grid-template-columns:minmax(100px,.8fr) minmax(140px,1.2fr) auto; align-items:start; gap:8px; padding:10px 0; border-bottom:1px solid color-mix(in srgb,var(--ib-border) 55%,transparent); }
        .ib-framework-section .ib-framework-control { font-size:12px; }
        .ib-framework-section textarea.ib-framework-control { min-height:64px; }
        .ib-framework-icon { width:34px; height:34px; display:grid; place-items:center; border:1px solid var(--ib-border); border-radius:6px; background:transparent; color:var(--ib-ink); }
        .ib-framework-actions { display:flex; flex-wrap:wrap; justify-content:space-between; align-items:center; gap:10px; padding:12px 18px; border-top:2px solid ${colors.ink}; }
        .ib-framework-actions-right { display:flex; flex-wrap:wrap; gap:8px; }
        .ib-framework-button { min-height:38px; display:inline-flex; justify-content:center; align-items:center; gap:7px; border:1.5px solid ${colors.ink}; border-radius:6px; padding:8px 12px; background:transparent; color:var(--ib-ink); font:inherit; font-size:12px; font-weight:700; }
        .ib-framework-button-primary { background:${colors.markerPurple}; color:white; }
        .ib-framework-button:disabled { opacity:.5; cursor:not-allowed; }
        .ib-framework-button.is-loading:disabled { opacity:1; }
        .ib-framework-loading { margin-top:12px; padding:12px; border:1.5px solid var(--ib-border); border-radius:7px; background:${dark ? '#273651' : '#F3F0FF'}; font-size:12px; line-height:1.5; }
        .ib-framework-loading-status { display:flex; align-items:flex-start; gap:8px; }
        .ib-framework-spinner { display:inline-flex; flex-shrink:0; animation:ib-framework-spin 1s linear infinite; }
        .ib-framework-loading-controls { display:flex; align-items:center; justify-content:space-between; gap:8px; margin-top:10px; }
        .ib-framework-loading p { margin:10px 0 0; color:var(--ib-muted); font-size:11px; }
        .ib-framework-loading-controls .ib-framework-button { min-height:32px; padding:5px 9px; }
        @keyframes ib-framework-spin { to { transform:rotate(360deg); } }
        @media(prefers-reduced-motion:reduce) { .ib-framework-spinner { animation:none; } }
        .ib-framework-alert { margin:0 18px 10px; color:${colors.markerCoral}; font-size:12px; line-height:1.45; }
        .ib-framework-status { min-height:18px; color:var(--ib-muted); font-size:11px; }
        @media(max-width:700px) { .ib-framework-body { grid-template-columns:1fr; overflow:auto; } .ib-framework-brief,.ib-framework-preview { overflow:visible; } .ib-framework-brief { border-right:0; border-bottom:1px solid var(--ib-border); } .ib-framework-dialog { max-height:calc(100dvh - 18px); } }
        @media(max-width:480px) { .ib-framework-scrim { padding:8px; } .ib-framework-dialog { width:calc(100vw - 16px); max-height:calc(100dvh - 16px); } .ib-framework-section { grid-template-columns:1fr auto; } .ib-framework-section label:nth-child(2) { grid-column:1; } .ib-framework-section-tools { grid-column:2; grid-row:1 / span 2; } .ib-framework-head,.ib-framework-brief,.ib-framework-preview,.ib-framework-actions { padding-left:13px; padding-right:13px; } }
      `}</style>
      <header className="ib-framework-head">
        <h2 id="ib-framework-title">{initialTemplate ? 'Edit framework' : 'Design a framework'}</h2>
        <button type="button" className="ib-framework-icon" aria-label="Close framework designer" title="Close" disabled={working} onClick={close}><X size={17} /></button>
      </header>
      <div className="ib-framework-body">
        <div className="ib-framework-brief">
          <label htmlFor="ib-framework-brief">What should it help you think through?</label>
          <textarea ref={briefRef} id="ib-framework-brief" className="ib-framework-control" disabled={working} maxLength={3000} value={goal} onChange={event => { setGoal(event.target.value); setDesignResponse(''); setError(''); setSaved(false); setHasUnsavedChanges(true) }} placeholder="For example: review a campaign idea before deciding whether to launch it." />
          <p className="ib-framework-help">Describe the decisions, stages, or questions the framework should organize.</p>
          {recoveredDraft && <p className="ib-framework-help" role="status">Recovered your local draft. Review the material and allow sharing again before using AI.</p>}
          <strong className="ib-framework-step">Choose a shape</strong>
          <div className="ib-framework-shapes" role="group" aria-label="Framework layout">
            {layoutChoices.map(choice => <button key={choice.value} type="button" className="ib-framework-shape" disabled={working} aria-pressed={layout === choice.value} onClick={() => chooseLayout(choice.value)} aria-label={choice.label}>
              <FrameworkLayoutThumbnail layout={choice.value} /><strong>{choice.label}</strong><span>{choice.detail}</span>
            </button>)}
          </div>
          {layout === 'matrix' && <p className="ib-framework-help">A matrix has four sections. Name the quadrants to match your comparison.{sections.length > 4 ? ' Remove extra sections before saving.' : ''}</p>}
          <strong className="ib-framework-step">Add board material <span style={{ fontWeight: 500 }}>(optional)</span></strong>
          <p className="ib-framework-help">Choose text that helps explain your goal, or leave everything unchecked. Pictures are used only through extracted text.</p>
          {onImportFiles && <>
            <input ref={importInputRef} type="file" accept=".md,.markdown,.txt" multiple hidden disabled={working} onChange={event => {
              const files = Array.from(event.target.files ?? [])
              event.target.value = ''
              setSendSources(false)
              void importFiles(files)
            }} />
            <button type="button" className={`ib-framework-button${importing ? ' is-loading' : ''}`} disabled={working} onClick={() => importInputRef.current?.click()}>
              {importing ? <span className="ib-framework-spinner" aria-hidden="true"><LoaderCircle size={15} /></span> : <FilePlus2 size={15} />}
              {importing ? 'Adding files…' : 'Add Markdown or text'}
            </button>
            {importing && <p className="ib-framework-help" role="status">Importing text to your board. No AI request is being sent.</p>}
            {importNotice && <p className="ib-framework-help" role="status">{importNotice}</p>}
          </>}
          <div className="ib-framework-source-list" role="group" aria-label="Board source text">
            {visibleSources.map(source => {
              const selected = selectedSourceIds.includes(source.id)
              const noText = !source.body.trim()
              const candidateSize = JSON.stringify({ command: 'design-framework', goal: goal.trim(), boardId, sources: [...designSources, { id: source.id, title: source.source_label ?? source.title, body: source.body }], frameworks: [] }).length
              const reason = noText ? (source.kind === 'image' || source.kind === 'pdf-page' ? 'Needs text extraction · extract it in the Assistant first' : 'Empty · add some writing first')
                : !selected && selectedSources.length >= 12 ? 'Selection full · untick another item first'
                : !selected && candidateSize > 24000 ? 'Too much text · choose fewer or shorter items' : selected ? 'Included' : 'Ready to use'
              return <div className="ib-framework-source-row" key={source.id}>
                <label className="ib-framework-source">
                  <input type="checkbox" checked={selected && !noText} disabled={working || noText || (!selected && (selectedSources.length >= 12 || candidateSize > 24000))} onChange={event => { setSelectedSourceIds(event.target.checked ? [...selectedSources.map(item => item.id), source.id] : selectedSources.filter(item => item.id !== source.id).map(item => item.id)); setSendSources(false); setHasUnsavedChanges(true); setError('') }} />
                  <span>{source.source_label ?? source.title}</span>
                </label>
                <div className="ib-framework-source-info"><span>{reason}{!noText ? ` · ${source.body.length.toLocaleString()} characters` : ''}</span>
                  {!noText && <details><summary>Preview text</summary><pre>{source.body}</pre></details>}
                </div>
              </div>
            })}
            {!visibleSources.length && <p className="ib-framework-help">No board material yet. Your brief is enough to design a framework.</p>}
          </div>
          {sources.length > 200 && <p className="ib-framework-help">Showing the first 200 board items.</p>}
          <p className="ib-framework-sharing" aria-live="polite"><strong>{selectedSources.length}/12 items selected</strong><br />AI receives: your brief{selectedSources.length ? ` + ${selectedSources.length} selected text ${selectedSources.length === 1 ? 'item' : 'items'}` : ' only'}.</p>
          {!!selectedSources.length && <label className="ib-framework-consent"><input type="checkbox" disabled={working} checked={sendSources} onChange={event => setSendSources(event.target.checked)} /><span>Allow sharing these {selectedSources.length} selected text {selectedSources.length === 1 ? 'item' : 'items'} with my AI provider.</span></label>}
          {contextTooLong && <p className="ib-framework-help" role="alert">Selected text is too long. Untick an item or shorten its writing before designing.</p>}
          <p className="ib-framework-help">Unchecked items and original pictures are excluded. The brief and selected text must fit within 24,000 characters.</p>
          <button type="button" className={`ib-framework-button ib-framework-button-primary${busy ? ' is-loading' : ''}`} disabled={working || !status.configured || !goal.trim() || contextTooLong || (!!selectedSources.length && !sendSources)} onClick={() => void generate()}>
            {busy ? <span className="ib-framework-spinner" aria-hidden="true"><LoaderCircle size={15} /></span> : <Sparkles size={15} />} {busy ? 'Designing…' : 'Design with AI'}
          </button>
          {busy && <div className="ib-framework-loading">
            <div className="ib-framework-loading-status" role="status" aria-live="polite" aria-atomic="true">
              <span className="ib-framework-spinner" aria-hidden="true"><LoaderCircle size={18} /></span><strong>{progress}</strong>
            </div>
            <div className="ib-framework-loading-controls">
              <span aria-live="off">{elapsedSeconds}s elapsed</span>
              <button type="button" className="ib-framework-button" onClick={() => controllerRef.current?.abort()} aria-label="Stop designing"><Square size={12} /> Stop</button>
            </div>
            <p>{elapsedSeconds >= 30 && !receiving ? 'Still waiting for the first response. You can stop and try again; your brief stays here.' : 'You can stop at any time. Your brief and existing framework edits stay here.'}</p>
          </div>}
          {error && <p className="ib-framework-alert" role="alert" style={{ margin: '12px 0 0' }}>{error}</p>}
          {!status.available && <p className="ib-framework-help">Open the installed Mac app to connect an AI provider.</p>}
          {status.available && !status.configured && <p className="ib-framework-help">Connect an AI provider in AI settings to generate a design.</p>}
        </div>
        <div className="ib-framework-preview" aria-busy={working}>
          <strong style={{ fontSize: 13 }}>Preview &amp; edit</strong>
          {designResponse && <p role="status" style={{ margin: 0, fontSize: 12, lineHeight: 1.5 }}><strong>AI suggestion:</strong> {designResponse}</p>}
          <FrameworkLayoutPreview template={previewTemplate} dark={dark} />
          {!sections.length && <p className="ib-framework-help">Example preview. Design with AI or add your own sections below.</p>}
          <label>Framework name
            <input data-first-focus className="ib-framework-control" disabled={working} maxLength={80} value={label} onChange={event => { setLabel(event.target.value); setSaved(false); setHasUnsavedChanges(true) }} placeholder="Name this framework" />
          </label>
          <label>Purpose
            <textarea className="ib-framework-control" disabled={working} maxLength={600} value={purpose} onChange={event => { setPurpose(event.target.value); setSaved(false); setHasUnsavedChanges(true) }} placeholder="What this framework helps organize" />
          </label>
          <div>
            <strong style={{ fontSize: 12 }}>Sections <span style={{ color: muted, fontWeight: 500 }}>({sections.length}/8)</span></strong>
            {!sections.length && <p className="ib-framework-help">Generate a structure or add your own sections below.</p>}
            {sections.map((section, index) => <div className="ib-framework-section" key={section.id ?? index}>
              <label>Section name
                <input className="ib-framework-control" disabled={working} maxLength={70} value={section.label} onChange={event => updateSection(index, { label: event.target.value })} placeholder="Name" />
              </label>
              <label>Writing prompt
                <textarea className="ib-framework-control" disabled={working} maxLength={300} value={section.guidance} onChange={event => updateSection(index, { guidance: event.target.value })} placeholder="What belongs here?" />
              </label>
              <div className="ib-framework-section-tools" style={{ display: 'flex', gap: 4 }}>
                <button type="button" className="ib-framework-icon" aria-label={`Move ${section.label || 'section'} up`} title="Move up" disabled={working || index === 0} onClick={() => moveSection(index, -1)}><ArrowUp size={14} /></button>
                <button type="button" className="ib-framework-icon" aria-label={`Move ${section.label || 'section'} down`} title="Move down" disabled={working || index === sections.length - 1} onClick={() => moveSection(index, 1)}><ArrowDown size={14} /></button>
                <button type="button" className="ib-framework-icon" aria-label={`Remove ${section.label || 'section'}`} title="Remove section" disabled={working || sections.length <= (layout === 'matrix' ? 4 : 2)} onClick={() => { setSections(current => current.filter((_, i) => i !== index)); setSaved(false); setHasUnsavedChanges(true) }}><Trash2 size={14} /></button>
              </div>
            </div>)}
            <button type="button" className="ib-framework-button" style={{ marginTop: 10 }} disabled={working || sections.length >= (layout === 'matrix' ? 4 : 8)} onClick={() => { setSections(current => [...current, { id: `section-${crypto.randomUUID()}`, label: '', guidance: '' }]); setSaved(false); setHasUnsavedChanges(true) }}><Plus size={14} /> Add section</button>
          </div>
        </div>
      </div>
      <div className="ib-framework-actions">
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          {initialTemplate && <button type="button" className="ib-framework-button" style={{ color: colors.markerCoral }} disabled={working} onClick={remove}><Trash2 size={14} /> Delete saved framework</button>}
          {hasUnsavedChanges && <button type="button" className="ib-framework-button" disabled={working} onClick={discardDraft}>Discard draft</button>}
          {hasUnsavedChanges && <span className="ib-framework-status">{draftStored ? 'Draft saved locally' : 'Draft not saved locally · keep this window open'}</span>}
          <span className="ib-framework-status" aria-live="polite">{busy ? progress : saved ? progress || 'Saved to My frameworks.' : progress}</span>
        </div>
        <div className="ib-framework-actions-right">
          <button type="button" className="ib-framework-button" disabled={working || !canSave} onClick={() => save(false)}>Save framework</button>
          <button type="button" className="ib-framework-button ib-framework-button-primary" disabled={working || !canSave} onClick={() => save(true)}>Save &amp; add to board</button>
        </div>
      </div>
    </section>
  </div>, document.body)
}
