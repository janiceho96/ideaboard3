// src/components/CardModal.tsx
import { useState, useEffect, useRef } from 'react'
import type { Card, CardFontFamily, TagType } from '../types'
import { Check, X } from 'lucide-react'
import { colors, fonts, radii, shadows } from '../lib/designTokens'
import { CARD_FONT_OPTIONS } from '../lib/cardTypography'
import MarkdownEditor from './MarkdownEditor'

const TAG_OPTS: { key: TagType; label: string; bg: string; color: string }[] = [
  { key: 'idea',     label: 'Idea',     bg: '#EEE9FF', color: '#4137A8' },
  { key: 'critical', label: 'Critical', bg: colors.markerCoral, color: '#6E252E' },
  { key: 'planned',  label: 'Planned',  bg: colors.markerYellow, color: '#523F00' },
  { key: 'delegate', label: 'Delegate', bg: colors.markerCyan, color: '#0E4B68' },
  { key: 'remove',   label: 'Remove',   bg: '#E7E9EF', color: '#4C566C' },
  { key: 'done',     label: 'Done',     bg: colors.markerMint, color: '#164D40' },
]
const COLORS = [
  { value: 'white',   border: '#B7BBC5' },
  { value: colors.markerMint }, { value: colors.markerYellow }, { value: colors.markerCoral },
  { value: '#EEE9FF' }, { value: '#FFDDE1' }, { value: colors.markerCyan },
  { value: colors.inkDark },
]

const TEMPLATES: { label: string; title: string; body: string; tag: TagType; bg: string }[] = [
  { label: 'Bug Report',   title: 'Bug: ',     body: '**Steps:**\n\n**Expected:**',   tag: 'critical', bg: '#FFD6E0' },
  { label: 'Feature Idea', title: 'Feature: ', body: '**Why:**\n\n**How:**',           tag: 'idea',     bg: '#E8E0F5' },
  { label: 'Meeting Note', title: 'Meeting: ', body: '**Attendees:**\n\n**Actions:**', tag: 'planned',  bg: '#D0E8FF' },
  { label: 'Task',         title: 'Task: ',    body: '',                              tag: 'planned',  bg: 'white'   },
  { label: 'Quick Note',   title: '',          body: '',                              tag: 'idea',     bg: '#FFF9C4' },
]

interface CardModalProps {
  card: Card | null
  isOpen: boolean
  onClose: () => void
  onSave: (data: { title: string; body: string; dateLabel: string; dueDate: string | null; tag: TagType; bg: string; fontFamily: CardFontFamily }) => void
  onDelete?: () => void
  dark?: boolean
}

export default function CardModal({ card, isOpen, onClose, onSave, onDelete, dark = false }: CardModalProps) {
  const [title, setTitle]       = useState('')
  const [body, setBody]         = useState('')
  const [fontFamily, setFontFamily] = useState<CardFontFamily>('marker')
  const [dateLabel, setDateLabel] = useState('')
  const [dueDate, setDueDate]   = useState('')
  const [tag, setTag]           = useState<TagType>('idea')
  const [bg, setBg]             = useState('white')
  const [titleErr, setTitleErr] = useState(false)
  const [activeTemplate, setActiveTemplate] = useState<string | null>(null)
  const titleRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen) {
      setTitle(card?.title ?? ''); setBody(card?.body ?? '')
      setFontFamily(card?.font_family ?? 'marker')
      setDateLabel(card?.date_label ?? ''); setDueDate(card?.due_date ?? '')
      setTag(card?.tag ?? 'idea'); setBg(card?.bg ?? 'white'); setTitleErr(false)
      setActiveTemplate(null)
      setTimeout(() => titleRef.current?.focus(), 180)
    }
  }, [card, isOpen])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const handleSave = () => {
    if (!title.trim()) { setTitleErr(true); titleRef.current?.focus(); return }
    onSave({ title: title.trim(), body: body.trim(), dateLabel: dateLabel.trim() || 'No date', dueDate: dueDate || null, tag, bg, fontFamily })
    onClose()
  }

  const modalBg  = dark ? colors.surfaceDark : colors.surfaceLight
  const borderC  = dark ? colors.borderDark : colors.borderLight
  const textC    = dark ? '#F7F7F2' : colors.ink
  const inputBg  = dark ? '#111A2D' : colors.surfaceLight
  const labelC   = dark ? '#AAB5C9' : '#5F687B'

  const inp: React.CSSProperties = { width: '100%', minHeight: 38, border: `1.5px solid ${borderC}`, borderRadius: radii.control, padding: '9px 12px', fontSize: 13, fontFamily: fonts.ui, outline: 'none', boxSizing: 'border-box', resize: 'none', background: inputBg, color: textC }

  return (
    <div className="ib-dialog-backdrop" role="presentation" style={{ position: 'fixed', inset: 0, background: 'rgba(16,23,42,.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: isOpen ? 1 : 0, pointerEvents: isOpen ? 'all' : 'none', transition: 'opacity .2s', fontFamily: fonts.ui }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="ib-dialog" role="dialog" aria-modal="true" aria-labelledby="card-dialog-heading" style={{ background: modalBg, borderRadius: radii.panel, border: `2px solid ${colors.ink}`, width: 'min(440px, calc(100vw - 28px))', maxHeight: 'calc(100vh - 28px)', overflowY: 'auto', padding: 24, boxShadow: '8px 9px 0 rgba(23,32,56,.26)', transform: isOpen ? 'translateY(0) scale(1)' : 'translateY(12px) scale(.97)', transition: 'transform .22s' }}>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 id="card-dialog-heading" style={{ fontFamily: fonts.display, fontWeight: 800, fontSize: 20, color: textC }}>{card ? 'Edit card' : 'New card'}</h2>
          <button onClick={onClose} aria-label="Close card dialog" title="Close" style={{ width: 30, height: 30, borderRadius: radii.control, background: dark ? '#263654' : '#EEF1F8', border: `1px solid ${borderC}`, cursor: 'pointer', color: textC, display: 'grid', placeItems: 'center' }}><X size={15} /></button>
        </div>

        {/* Starter templates are available only when creating a card. */}
        {!card && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.05em', textTransform: 'uppercase', color: labelC, marginBottom: 6 }}>Start from template</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {TEMPLATES.map(tpl => (
                <button
                  key={tpl.label}
                  type="button"
                  onClick={() => {
                    setTitle(tpl.title)
                    setBody(tpl.body)
                    setTag(tpl.tag)
                    setBg(tpl.bg)
                    setActiveTemplate(tpl.label)
                    setTitleErr(false)
                    setTimeout(() => titleRef.current?.focus(), 0)
                  }}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 16,
                    border: `1.5px solid ${activeTemplate === tpl.label ? colors.markerPurple : borderC}`,
                    background: activeTemplate === tpl.label ? 'rgba(105,87,255,.1)' : 'transparent',
                    color: activeTemplate === tpl.label ? colors.markerPurple : labelC,
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontFamily: "'DM Sans',sans-serif",
                    transition: 'all .15s',
                  }}
                >{tpl.label}</button>
              ))}
            </div>
          </div>
        )}

        <Field label="Title *" dark={dark}>
          <input ref={titleRef} type="text" value={title} onChange={e => { setTitle(e.target.value); setTitleErr(false) }}
            placeholder="What's the idea?" maxLength={80}
            aria-invalid={titleErr}
            aria-describedby={titleErr ? 'card-title-error' : undefined}
            style={{ ...inp, borderColor: titleErr ? '#C5303A' : borderC }}
            onFocus={e => e.target.style.borderColor = colors.markerPurple}
            onBlur={e => e.target.style.borderColor = titleErr ? '#C5303A' : borderC}
          />
          {titleErr && <div id="card-title-error" role="alert" style={{ marginTop: 5, color: '#C5303A', fontSize: 11 }}>Give this idea a title first.</div>}
        </Field>

        <Field label="Description (markdown supported)" dark={dark}>
          <MarkdownEditor value={body} onChange={setBody} label="Description" placeholder="Write a note..."
            rows={5} dark={dark} textareaStyle={inp}
          />
        </Field>

        <Field label="Note font" dark={dark}>
          <select
            value={fontFamily}
            onChange={e => setFontFamily(e.target.value as CardFontFamily)}
            aria-label="Note font"
            style={{ ...inp, height: 40, cursor: 'pointer' }}
          >
            {CARD_FONT_OPTIONS.map(option => (
              <option key={option.id} value={option.id} style={{ fontFamily: option.body }}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
          <Field label="Label" dark={dark}>
            <input type="text" value={dateLabel} onChange={e => setDateLabel(e.target.value)}
              placeholder="e.g. Backlog" style={inp}
              onFocus={e => e.target.style.borderColor = colors.markerPurple}
              onBlur={e => e.target.style.borderColor = borderC}
            />
          </Field>
          <Field label="Due date" dark={dark}>
            <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
              style={{ ...inp, colorScheme: dark ? 'dark' : 'light' }}
              onFocus={e => e.target.style.borderColor = colors.markerPurple}
              onBlur={e => e.target.style.borderColor = borderC}
            />
          </Field>
        </div>

        <Field label="Card color" dark={dark}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {COLORS.map(c => (
              <button
                key={c.value}
                type="button"
                aria-label={`Use ${c.value === 'white' ? 'white' : 'this'} card color`}
                aria-pressed={bg === c.value}
                onClick={() => setBg(c.value)}
                style={{ width: 28, height: 28, borderRadius: 6, padding: 0, background: c.value, cursor: 'pointer', border: bg === c.value ? `3px solid ${colors.markerPurple}` : `1.5px solid ${c.border ?? 'transparent'}`, transition: 'transform .15s', transform: bg === c.value ? 'scale(1.12)' : 'scale(1)' }}
              />
            ))}
          </div>
        </Field>

        <Field label="Tag" dark={dark}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {TAG_OPTS.map(t => (
              <button
                key={t.key}
                type="button"
                aria-pressed={tag === t.key}
                onClick={() => setTag(t.key)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 10px', borderRadius: radii.control, background: t.bg, color: t.color, fontSize: 11, fontWeight: 700, cursor: 'pointer', border: tag === t.key ? `2px solid ${colors.ink}` : '2px solid transparent' }}
              ><span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: '50%', background: t.color }} />{t.label}{tag === t.key && <Check size={11} />}</button>
            ))}
          </div>
        </Field>

        <div style={{ display: 'flex', gap: 10, marginTop: 20, paddingTop: 16, borderTop: `1px solid ${borderC}`, alignItems: 'center' }}>
          {onDelete && (
            <button onClick={onDelete} style={{ height: 36, padding: '0 14px', borderRadius: radii.control, border: `1.5px solid ${colors.markerCoral}`, background: 'transparent', color: '#A52A32', cursor: 'pointer', fontSize: 13, fontFamily: fonts.ui }}>Delete</button>
          )}
          <div style={{ flex: 1 }}/>
          <button onClick={onClose} style={{ height: 36, padding: '0 16px', borderRadius: radii.control, border: `1.5px solid ${borderC}`, background: 'transparent', color: textC, cursor: 'pointer', fontSize: 13, fontFamily: fonts.ui }}>Cancel</button>
          <button onClick={handleSave} style={{ height: 36, padding: '0 18px', borderRadius: radii.control, border: `2px solid ${colors.ink}`, boxShadow: shadows.control, background: colors.markerPurple, color: 'white', cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: fonts.ui }}>Save card</button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children, dark }: { label: string; children: React.ReactNode; dark: boolean }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, letterSpacing: '.05em', textTransform: 'uppercase', color: dark ? '#666' : '#888', marginBottom: 5 }}>{label}</label>
      {children}
    </div>
  )
}
