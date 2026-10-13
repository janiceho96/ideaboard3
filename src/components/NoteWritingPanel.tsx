import { useEffect, useRef, useState } from 'react'
import { Check, Maximize2, Minimize2, Search, Sparkles, X } from 'lucide-react'
import type { Card } from '../types'
import { colors, fonts } from '../lib/designTokens'
import { PanelStyle } from './BoardAssistantPanel'

interface Draft { title: string; body: string; baseTitle: string; baseBody: string; baseVersion: string }
interface Props {
  card: Card
  dark: boolean
  onClose: () => void
  onSearch: () => void
  onAssistant: () => void
  onDetails: () => void
  sourceNotes: { id: string; title: string }[]
  onLocateSource: (id: string) => void
  onSave: (card: Card, title: string, body: string) => Promise<void>
}
const draftKey = (card: Card) => `ideaboard_writing_draft_${card.board_id}_${card.id}`

export default function NoteWritingPanel({ card, dark, onClose, onSearch, onAssistant, onDetails, sourceNotes, onLocateSource, onSave }: Props) {
  const [draft, setDraft] = useState<Draft>({ title: card.title, body: card.body, baseTitle: card.title, baseBody: card.body, baseVersion: card.updated_at })
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const savingRef = useRef(false)
  const [expanded, setExpanded] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const bodyRef = useRef<HTMLTextAreaElement>(null)
  const latestDraft = useRef(draft)
  const initialCard = useRef(card)
  const localDraftKey = draftKey(card)
  latestDraft.current = draft

  useEffect(() => {
    try {
      const original = initialCard.current
      const raw = localStorage.getItem(draftKey(original))
      if (raw) {
        const saved = JSON.parse(raw) as Draft
        if (typeof saved.title !== 'string' || typeof saved.body !== 'string' || typeof saved.baseTitle !== 'string' || typeof saved.baseBody !== 'string' || typeof saved.baseVersion !== 'string') throw new Error()
        setDraft(saved)
        setMessage(saved.baseVersion === original.updated_at ? 'Recovered your local draft.' : 'Recovered an older draft. The saved note changed; copy useful writing or reload the saved note.')
      }
    } catch { setMessage('The local draft could not be read. The saved note is still available.') }
    setLoaded(true)
    bodyRef.current?.focus()
  }, [])

  const changed = draft.title !== draft.baseTitle || draft.body !== draft.baseBody
  const conflict = card.updated_at !== draft.baseVersion || card.title !== draft.baseTitle || card.body !== draft.baseBody
  useEffect(() => {
    if (!loaded || !changed) return
    try { localStorage.setItem(localDraftKey, JSON.stringify(draft)) }
    catch { setMessage('Your draft could not be saved locally. Keep this panel open and retry Save note.') }
  }, [draft, loaded, changed, localDraftKey])

  const save = async () => {
    if (savingRef.current || !draft.title.trim() || card.locked || conflict) return
    const writing = draft
    const original = { ...card }
    savingRef.current = true; setSaving(true); setMessage('Saving note…')
    try {
      await onSave(original, writing.title.trim(), writing.body)
      // Typing stays available during persistence; keep later edits as a draft.
      const current = latestDraft.current
      const persisted = (JSON.parse(localStorage.getItem('ideaboard_cards') ?? '[]') as Card[]).find(c => c.id === card.id && c.board_id === card.board_id)
      if (!persisted || persisted.title !== writing.title.trim() || persisted.body !== writing.body) throw new Error('Save could not be verified. Your draft is kept.')
      const next = { ...current, baseTitle: persisted.title, baseBody: persisted.body, baseVersion: persisted.updated_at }
      if (current.title === writing.title && current.body === writing.body) {
        next.title = persisted.title
        localStorage.removeItem(draftKey(card))
        setMessage('Saved locally.')
      } else {
        localStorage.setItem(draftKey(card), JSON.stringify(next))
        setMessage('Saved. Newer typing is kept as a draft.')
      }
      setDraft(next)
    } catch (e) { setMessage(e instanceof Error ? e.message : 'Save failed. Your draft is kept; retry Save note.') }
    finally { savingRef.current = false; setSaving(false) }
  }

  const insert = (prefix: string, suffix = '') => {
    const input = bodyRef.current
    if (!input) return
    const start = input.selectionStart, end = input.selectionEnd
    const text = `${draft.body.slice(0, start)}${prefix}${draft.body.slice(start, end)}${suffix}${draft.body.slice(end)}`
    setDraft(d => ({ ...d, body: text }))
    requestAnimationFrame(() => { input.focus(); input.setSelectionRange(start + prefix.length, end + prefix.length) })
  }

  return <aside className="ib-writing-panel" aria-label="Write note" style={{ background: dark ? colors.surfaceDark : colors.surfaceLight, color: dark ? '#F7F7F2' : colors.ink, ...(expanded ? { position: 'absolute', right: 0, top: 0, bottom: 0, width: 'min(780px, calc(100vw - 68px))' } : {}) }}>
    <PanelStyle dark={dark} />
    <div style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 8, borderBottom: `2px solid ${dark ? colors.borderDark : colors.ink}` }}>
      <h2 style={{ margin: 0, flex: 1, fontFamily: fonts.display, fontSize: 19 }}>Write note</h2>
      <button className="ib-panel-small" onClick={() => setExpanded(e => !e)} aria-label={expanded ? 'Reduce writing view' : 'Expand writing view'}>{expanded ? <Minimize2 size={15} /> : <Maximize2 size={15} />}</button>
      <button className="ib-panel-small" onClick={onClose} aria-label="Close writing panel"><X size={15} /></button>
    </div>
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto', flex: 1, minHeight: 0 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><button className="ib-panel-small" onClick={onSearch}><Search size={13} /> Find notes</button><button className="ib-panel-small" onClick={onAssistant}><Sparkles size={13} /> Use AI</button><button className="ib-panel-small" onClick={onDetails}>Card details</button></div>
      {card.locked && <div role="status" style={{ fontSize: 13 }}>This note is locked. Unlock it on the canvas to change its writing.</div>}
      <label>Title<input className="ib-panel-control" value={draft.title} maxLength={80} disabled={card.locked} onChange={e => setDraft(d => ({ ...d, title: e.target.value }))} /></label>
      {sourceNotes.length > 0 && <div style={{ display: 'grid', gap: 6, fontSize: 12 }}><strong>Sources</strong>{sourceNotes.map(source => <button className="ib-panel-small" key={source.id} onClick={() => onLocateSource(source.id)} style={{ textAlign: 'left' }}>{source.title}</button>)}</div>}
      <div role="group" aria-label="Markdown formatting" style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {[
          ['Bold', '**', '**'], ['Italic', '*', '*'], ['Heading', '\n## ', ''], ['List', '\n- ', ''], ['Task', '\n- [ ] ', ''], ['Link', '[', '](https://)'],
        ].map(([label, before, after]) => <button key={label} className="ib-panel-small" disabled={card.locked} onClick={() => insert(before, after)}>{label}</button>)}
      </div>
      <label style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 280 }}>Writing · Markdown supported
        <textarea ref={bodyRef} className="ib-panel-control" value={draft.body} disabled={card.locked} onChange={e => setDraft(d => ({ ...d, body: e.target.value }))} style={{ flex: 1, resize: 'vertical', minHeight: 270, fontSize: 15, lineHeight: 1.8 }} />
      </label>
      {conflict && <div role="alert" style={{ fontSize: 13, lineHeight: 1.6 }}>The saved note changed after this draft began. Copy any writing you want to keep, then reload the current saved note.</div>}
      <div role="status" aria-live="polite" style={{ fontSize: 12, lineHeight: 1.6 }}>{message || (changed ? 'Local draft kept while you write.' : 'Saved note')}</div>
      {conflict && <button className="ib-panel-small" onClick={() => { localStorage.removeItem(draftKey(card)); setDraft({ title: card.title, body: card.body, baseTitle: card.title, baseBody: card.body, baseVersion: card.updated_at }); setMessage('Loaded the current saved note.') }}>Reload saved note</button>}
      <button className="ib-panel-button" disabled={saving || conflict || card.locked || !changed || !draft.title.trim()} onClick={save}><Check size={15} /> {saving ? 'Saving…' : 'Save note'}</button>
    </div>
  </aside>
}
