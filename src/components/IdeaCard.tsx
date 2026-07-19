// src/components/IdeaCard.tsx
// Features:
//   - Click title to edit inline (no modal needed)
//   - Drag bottom-right corner to resize
//   - Red/amber border when due date is overdue/soon
//   - Markdown rendered in body (bold, bullets, links)
//   - Chevron to collapse card to title bar only
//   - Duplicate button creates a copy offset by 20px
//   - Lock button prevents dragging and resizing
//   - Right-click opens quick colour picker

import { useState, useRef, useEffect } from 'react'
import type { Card, TagType } from '../types'
import { marked } from 'marked'
import { sanitizeHtml } from '../lib/sanitizeHtml'

// Configure marked: safe, no wrapping <p> for single lines
marked.setOptions({ breaks: true })

const TAG_META: Record<TagType, { label: string; bg: string; color: string }> = {
  idea:     { label: '💡 Idea',     bg: '#E8E0F5', color: '#3A2270' },
  critical: { label: '🚨 Critical', bg: '#D4EDD8', color: '#1B4D21' },
  planned:  { label: '📅 Planned',  bg: '#FFF3B0', color: '#5C4009' },
  delegate: { label: '👋 Delegate', bg: '#FFD6C2', color: '#6B2D0D' },
  remove:   { label: '🗑️ Remove',   bg: '#E8E0F5', color: '#3A2270' },
  done:     { label: '✅ Done',     bg: '#D4EDD8', color: '#1B4D21' },
}
const DOT_COLORS: Record<TagType, string> = {
  idea: '#A78BFA', critical: '#EF4444', planned: '#F59E0B',
  delegate: '#6366F1', remove: '#8B5CF6', done: '#22C55E',
}

// Returns null | 'soon' | 'overdue' based on due_date
function getDueStatus(dueDate: string | null): null | 'soon' | 'overdue' {
  if (!dueDate) return null
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const due   = new Date(dueDate + 'T00:00:00')
  const diff  = (due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  if (diff < 0)  return 'overdue'
  if (diff <= 2) return 'soon'
  return null
}

interface IdeaCardProps {
  card: Card
  onMoveStart:      (id: string, clientX: number, clientY: number) => void
  onResizeStart:    (id: string, clientX: number, clientY: number, startW: number, startH: number | null) => void
  onEdit:           (id: string) => void
  onDelete:         (id: string) => void
  onInlineTitle:    (id: string, title: string) => void
  onToggleCollapse: (id: string) => void
  onDuplicate:      (id: string) => void
  onToggleLock:     (id: string) => void
  onColorPick:      (id: string, clientX: number, clientY: number) => void
  dark: boolean
}

export default function IdeaCard({ card, onMoveStart, onResizeStart, onEdit, onDelete, onInlineTitle, onToggleCollapse, onDuplicate, onToggleLock, onColorPick, dark }: IdeaCardProps) {
  const tm        = TAG_META[card.tag] ?? TAG_META.idea
  const dotColor  = DOT_COLORS[card.tag] ?? '#6C63FF'
  const dueStatus = getDueStatus(card.due_date)

  const isDark    = card.bg === '#152336'
  const textColor = isDark ? 'white' : (dark ? '#F0EEE8' : '#152336')
  const mutedColor= isDark ? 'rgba(255,255,255,0.6)' : (dark ? '#aaa' : '#666')

  // Border colour: overdue = red, soon = amber, default = dark
  const borderColor = dueStatus === 'overdue' ? '#EF4444'
                    : dueStatus === 'soon'    ? '#F59E0B'
                    : '#152336'

  // Inline title editing
  const [editing, setEditing]   = useState(false)
  const [draft, setDraft]       = useState(card.title)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { if (editing) inputRef.current?.select() }, [editing])

  const commitTitle = () => {
    setEditing(false)
    const trimmed = draft.trim()
    if (trimmed && trimmed !== card.title) onInlineTitle(card.id, trimmed)
    else setDraft(card.title)
  }

  // Render markdown body safely
  const markdownHtml = card.body
    ? sanitizeHtml((marked.parse(card.body) as string)
        .replace(/<a /g, '<a target="_blank" rel="noopener noreferrer" ')
      )
    : ''

  const cardBg = card.bg === '#152336' ? '#152336'
               : dark && card.bg === 'white' ? '#1E1E2A'
               : card.bg || 'white'

  return (
    <div
      id={`card_${card.id}`}
      onMouseDown={e => {
        if ((e.target as HTMLElement).closest('.no-drag')) return
        if (e.button !== 0) return
        if (card.locked) return
        onMoveStart(card.id, e.clientX, e.clientY)
        e.preventDefault()
        e.stopPropagation()
      }}
      onDoubleClick={e => {
        if ((e.target as HTMLElement).closest('.no-drag')) return
        e.stopPropagation()
        onEdit(card.id)
      }}
      onContextMenu={e => {
        if ((e.target as HTMLElement).closest('.no-drag')) return
        e.preventDefault()
        e.stopPropagation()
        onColorPick(card.id, e.clientX, e.clientY)
      }}
      style={{
        position: 'absolute',
        left: card.x, top: card.y,
        transform: `rotate(${card.rotation}deg)`,
        background: cardBg,
        borderRadius: 14,
        border: `2px solid ${borderColor}`,
        boxShadow: dueStatus === 'overdue'
          ? `0 4px 14px rgba(239,68,68,.25), 0 0 0 1px rgba(239,68,68,.15)`
          : '0 4px 14px rgba(0,0,0,.13)',
        padding: '13px 15px 10px',
        cursor: card.locked ? 'default' : 'grab',
        width: card.card_width ?? 185,
        height: card.card_height ?? 'auto',
        minHeight: card.collapsed ? 44 : 100,
        zIndex: 20,
        userSelect: 'none',
        fontFamily: "'DM Sans', sans-serif",
        overflow: 'hidden',
        boxSizing: 'border-box',
      }}
    >
      {/* Collapse chevron */}
      <button className="no-drag"
        onClick={e => { e.stopPropagation(); onToggleCollapse(card.id) }}
        onMouseDown={e => e.stopPropagation()}
        title={card.collapsed ? 'Expand card' : 'Collapse card'}
        style={{ position: 'absolute', top: 6, left: 6, width: 16, height: 16, borderRadius: '50%', background: 'rgba(0,0,0,.07)', border: 'none', cursor: 'pointer', fontSize: 9, color: '#888', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2 }}
      >{card.collapsed ? '▸' : '▾'}</button>

      {/* Lock button */}
      <button className="no-drag"
        onClick={e => { e.stopPropagation(); onToggleLock(card.id) }}
        onMouseDown={e => e.stopPropagation()}
        title={card.locked ? 'Unlock card' : 'Lock card in place'}
        style={{ position: 'absolute', top: 6, right: 52, width: 18, height: 18, borderRadius: '50%', background: card.locked ? 'rgba(108,99,255,.18)' : 'rgba(0,0,0,.07)', border: 'none', cursor: 'pointer', fontSize: 10, color: card.locked ? '#6C63FF' : '#888', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2 }}
      >
        {card.locked
          ? <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
          : <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 019.9-1"/></svg>
        }
      </button>

      {/* Duplicate button */}
      <button className="no-drag"
        onClick={e => { e.stopPropagation(); onDuplicate(card.id) }}
        onMouseDown={e => e.stopPropagation()}
        title="Duplicate card"
        style={{ position: 'absolute', top: 6, right: 30, width: 18, height: 18, borderRadius: '50%', background: 'rgba(0,0,0,.07)', border: 'none', cursor: 'pointer', fontSize: 10, color: '#888', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2 }}
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="9" y="9" width="13" height="13" rx="2"/>
          <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
        </svg>
      </button>

      {/* Delete button */}
      <button className="no-drag"
        onClick={e => { e.stopPropagation(); onDelete(card.id) }}
        onMouseDown={e => e.stopPropagation()}
        style={{ position: 'absolute', top: 6, right: 8, width: 18, height: 18, borderRadius: '50%', background: 'rgba(0,0,0,.07)', border: 'none', cursor: 'pointer', fontSize: 12, color: '#888', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2 }}
      >×</button>

      {/* Overdue badge — shifted right to clear the chevron */}
      {dueStatus && (
        <div style={{ position: 'absolute', top: 6, left: 24, fontSize: 9, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: dueStatus === 'overdue' ? '#EF4444' : '#F59E0B', background: dueStatus === 'overdue' ? 'rgba(239,68,68,.1)' : 'rgba(245,158,11,.1)', padding: '2px 6px', borderRadius: 10 }}>
          {dueStatus === 'overdue' ? '⚠ Overdue' : '⏰ Due soon'}
        </div>
      )}

      {/* Tag */}
      <div style={{ marginTop: dueStatus ? 16 : 0, marginBottom: 7, display: 'inline-block', fontSize: 9, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', padding: '3px 7px', borderRadius: 18, background: tm.bg, color: tm.color }}>
        {tm.label}
      </div>

      {/* Title — inline editable */}
      {editing ? (
        <input ref={inputRef} className="no-drag"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={commitTitle}
          onKeyDown={e => { if (e.key === 'Enter') commitTitle(); if (e.key === 'Escape') { setEditing(false); setDraft(card.title) } }}
          onMouseDown={e => e.stopPropagation()}
          style={{ display: 'block', width: '100%', border: '1.5px solid #6C63FF', borderRadius: 6, padding: '3px 6px', fontSize: 13, fontFamily: "'Syne',sans-serif", fontWeight: 700, background: 'transparent', color: textColor, outline: 'none', marginBottom: 5, boxSizing: 'border-box' }}
        />
      ) : (
        <div
          className="no-drag"
          onClick={e => { e.stopPropagation(); setEditing(true) }}
          title="Click to rename"
          style={{ fontFamily: "'Syne',sans-serif", fontSize: 13, fontWeight: 700, color: textColor, lineHeight: 1.3, marginBottom: card.body ? 5 : 0, cursor: 'text', borderRadius: 4, padding: '2px 0' }}
        >{card.title}</div>
      )}

      {/* Body — rendered markdown (hidden when collapsed) */}
      {!card.collapsed && card.body && (
        <div className="no-drag md-body"
          dangerouslySetInnerHTML={{ __html: markdownHtml }}
          style={{ fontSize: 11, color: mutedColor, lineHeight: 1.55 }}
        />
      )}

      {/* Footer (hidden when collapsed) */}
      {!card.collapsed && (
        <div style={{ marginTop: 9, paddingTop: 7, borderTop: `1px solid ${isDark ? 'rgba(255,255,255,.1)' : 'rgba(0,0,0,.07)'}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 10, color: mutedColor }}>
            {card.due_date ? `📅 ${card.due_date}` : card.date_label}
          </span>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: dotColor }} />
        </div>
      )}

      {/* Resize handle — bottom-right corner (disabled when locked) */}
      <div className="no-drag"
        onMouseDown={e => {
          if (card.locked) return
          e.stopPropagation()
          e.preventDefault()
          onResizeStart(card.id, e.clientX, e.clientY, card.card_width ?? 185, card.card_height ?? null)
        }}
        style={{ position: 'absolute', bottom: 3, right: 3, width: 14, height: 14, cursor: card.locked ? 'default' : 'nwse-resize', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: card.locked ? .15 : .4 }}
      >
        <svg width="8" height="8" viewBox="0 0 8 8"><path d="M1 7L7 1M4 7L7 4M7 7L7 7" stroke="#888" strokeWidth="1.5" strokeLinecap="round"/></svg>
      </div>
    </div>
  )
}
