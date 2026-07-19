// src/components/CardModal.tsx
import { useState, useEffect, useRef } from 'react'
import type { Card, TagType } from '../types'

const TAG_OPTS: { key: TagType; label: string; bg: string; color: string }[] = [
  { key: 'idea',     label: '💡 Idea',     bg: '#E8E0F5', color: '#3A2270' },
  { key: 'critical', label: '🚨 Critical', bg: '#D4EDD8', color: '#1B4D21' },
  { key: 'planned',  label: '📅 Planned',  bg: '#FFF3B0', color: '#5C4009' },
  { key: 'delegate', label: '👋 Delegate', bg: '#FFD6C2', color: '#6B2D0D' },
  { key: 'remove',   label: '🗑️ Remove',   bg: '#E8E0F5', color: '#3A2270' },
  { key: 'done',     label: '✅ Done',     bg: '#D4EDD8', color: '#1B4D21' },
]
const COLORS = [
  { value: 'white',   border: '#ddd' },
  { value: '#D4EDD8' }, { value: '#FFF3B0' }, { value: '#FFD6C2' },
  { value: '#E8E0F5' }, { value: '#FFDDE1' }, { value: '#C8E6FF' },
  { value: '#152336' },
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
  onSave: (data: { title: string; body: string; dateLabel: string; dueDate: string | null; tag: TagType; bg: string }) => void
  onDelete?: () => void
  dark?: boolean
}

export default function CardModal({ card, isOpen, onClose, onSave, onDelete, dark = false }: CardModalProps) {
  const [title, setTitle]       = useState('')
  const [body, setBody]         = useState('')
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
    onSave({ title: title.trim(), body: body.trim(), dateLabel: dateLabel.trim() || 'No date', dueDate: dueDate || null, tag, bg })
    onClose()
  }

  const modalBg  = dark ? '#152336' : 'white'
  const borderC  = dark ? '#1E3451' : '#E0E0E0'
  const textC    = dark ? '#F0EEE8' : '#152336'
  const inputBg  = dark ? '#162845' : 'white'
  const labelC   = dark ? '#666'    : '#888'

  const inp: React.CSSProperties = { width: '100%', border: `1.5px solid ${borderC}`, borderRadius: 9, padding: '9px 12px', fontSize: 13, fontFamily: "'DM Sans',sans-serif", outline: 'none', boxSizing: 'border-box', resize: 'none', background: inputBg, color: textC }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: isOpen ? 1 : 0, pointerEvents: isOpen ? 'all' : 'none', transition: 'opacity .2s', fontFamily: "'DM Sans',sans-serif" }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: modalBg, borderRadius: 20, border: `2px solid ${dark ? '#6C63FF' : '#152336'}`, width: 440, padding: 28, boxShadow: '0 24px 64px rgba(0,0,0,.3)', transform: isOpen ? 'translateY(0) scale(1)' : 'translateY(12px) scale(.97)', transition: 'transform .22s' }}>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 18, color: textC }}>{card ? 'Edit Card' : 'New Card'}</h2>
          <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: '50%', background: dark ? '#162845' : '#f5f5f5', border: 'none', cursor: 'pointer', fontSize: 16, color: labelC }}>×</button>
        </div>

        {/* Template chips — only shown for new cards */}
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
                    border: `1.5px solid ${activeTemplate === tpl.label ? '#6C63FF' : (dark ? '#1E3451' : '#E0E0E0')}`,
                    background: activeTemplate === tpl.label ? 'rgba(108,99,255,.1)' : 'transparent',
                    color: activeTemplate === tpl.label ? '#6C63FF' : (dark ? '#888' : '#555'),
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
            style={{ ...inp, borderColor: titleErr ? '#E53E3E' : borderC }}
            onFocus={e => e.target.style.borderColor = '#6C63FF'}
            onBlur={e => e.target.style.borderColor = titleErr ? '#E53E3E' : borderC}
          />
        </Field>

        <Field label="Description (markdown supported)" dark={dark}>
          <textarea value={body} onChange={e => setBody(e.target.value)}
            placeholder={'**bold**, - bullet list, [link](url)'}
            rows={3} style={inp}
            onFocus={e => (e.target as HTMLTextAreaElement).style.borderColor = '#6C63FF'}
            onBlur={e => (e.target as HTMLTextAreaElement).style.borderColor = borderC}
          />
        </Field>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
          <Field label="Label" dark={dark}>
            <input type="text" value={dateLabel} onChange={e => setDateLabel(e.target.value)}
              placeholder="e.g. Backlog" style={inp}
              onFocus={e => e.target.style.borderColor = '#6C63FF'}
              onBlur={e => e.target.style.borderColor = borderC}
            />
          </Field>
          <Field label="Due date" dark={dark}>
            <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
              style={{ ...inp, colorScheme: dark ? 'dark' : 'light' }}
              onFocus={e => e.target.style.borderColor = '#6C63FF'}
              onBlur={e => e.target.style.borderColor = borderC}
            />
          </Field>
        </div>

        <Field label="Card color" dark={dark}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {COLORS.map(c => (
              <div key={c.value} onClick={() => setBg(c.value)}
                style={{ width: 28, height: 28, borderRadius: '50%', background: c.value, cursor: 'pointer', border: bg === c.value ? '2.5px solid #6C63FF' : `2.5px solid ${c.border ?? 'transparent'}`, transition: 'transform .15s', transform: bg === c.value ? 'scale(1.15)' : 'scale(1)' }}
              />
            ))}
          </div>
        </Field>

        <Field label="Tag" dark={dark}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {TAG_OPTS.map(t => (
              <div key={t.key} onClick={() => setTag(t.key)}
                style={{ padding: '5px 11px', borderRadius: 18, background: t.bg, color: t.color, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: tag === t.key ? '2px solid #152336' : '2px solid transparent' }}
              >{t.label}</div>
            ))}
          </div>
        </Field>

        <div style={{ display: 'flex', gap: 10, marginTop: 20, paddingTop: 16, borderTop: `1px solid ${borderC}`, alignItems: 'center' }}>
          {onDelete && (
            <button onClick={onDelete} style={{ height: 36, padding: '0 14px', borderRadius: 9, border: '1.5px solid #fcc', background: 'transparent', color: '#E53E3E', cursor: 'pointer', fontSize: 13, fontFamily: "'DM Sans',sans-serif" }}>Delete</button>
          )}
          <div style={{ flex: 1 }}/>
          <button onClick={onClose} style={{ height: 36, padding: '0 16px', borderRadius: 9, border: `1.5px solid ${borderC}`, background: 'transparent', color: textC, cursor: 'pointer', fontSize: 13, fontFamily: "'DM Sans',sans-serif" }}>Cancel</button>
          <button onClick={handleSave} style={{ height: 36, padding: '0 18px', borderRadius: 9, border: 'none', background: '#6C63FF', color: 'white', cursor: 'pointer', fontSize: 13, fontWeight: 500, fontFamily: "'DM Sans',sans-serif" }}>Save Card</button>
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
