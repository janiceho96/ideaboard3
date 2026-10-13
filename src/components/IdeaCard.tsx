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

import { useState, useRef, useEffect, useMemo, memo } from 'react'
import type { Card, TagType } from '../types'
import { marked } from 'marked'
import { sanitizeHtml } from '../lib/sanitizeHtml'
import { AlertTriangle, CalendarDays, ChevronDown, ChevronRight, Clock3, Copy, Lock, LockOpen, Trash2 } from 'lucide-react'
import { colors, fonts, radii, shadows } from '../lib/designTokens'
import { getCardTypography } from '../lib/cardTypography'

// Configure marked: safe, no wrapping <p> for single lines
marked.setOptions({ breaks: true })

const TAG_META: Record<TagType, { label: string; bg: string; color: string }> = {
  idea:     { label: 'Idea',     bg: '#EEE9FF', color: '#4137A8' },
  critical: { label: 'Critical', bg: colors.markerCoral, color: '#6E252E' },
  planned:  { label: 'Planned',  bg: colors.markerYellow, color: '#523F00' },
  delegate: { label: 'Delegate', bg: colors.markerCyan, color: '#0E4B68' },
  remove:   { label: 'Remove',   bg: '#E7E9EF', color: '#4C566C' },
  done:     { label: 'Done',     bg: colors.markerMint, color: '#164D40' },
}
const DOT_COLORS: Record<TagType, string> = {
  idea: colors.markerPurple, critical: colors.markerCoral, planned: colors.markerYellow,
  delegate: colors.markerCyan, remove: '#8D96A9', done: colors.markerMint,
}

// Returns null | 'soon' | 'overdue' based on due_date
function getDueStatus(dueDate: string | null, today: number): null | 'soon' | 'overdue' {
  if (!dueDate) return null
  const due   = new Date(dueDate + 'T00:00:00')
  const diff  = (due.getTime() - today) / (1000 * 60 * 60 * 24)
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
  today: number
}

function IdeaCard({ card, onMoveStart, onResizeStart, onEdit, onDelete, onInlineTitle, onToggleCollapse, onDuplicate, onToggleLock, onColorPick, dark, today }: IdeaCardProps) {
  const tm        = TAG_META[card.tag] ?? TAG_META.idea
  const dotColor  = DOT_COLORS[card.tag] ?? colors.markerPurple
  const dueStatus = getDueStatus(card.due_date, today)

  const legacyDarkCard = card.bg === '#152336' || card.bg === colors.inkDark

  // Border colour: overdue = red, soon = amber, default = dark
  const borderColor = dueStatus === 'overdue' ? '#EF4444'
                    : dueStatus === 'soon'    ? '#F59E0B'
                    : colors.ink

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
  const markdownHtml = useMemo(() => card.body
    ? sanitizeHtml((marked.parse(card.body) as string)
        .replace(/<a /g, '<a target="_blank" rel="noopener noreferrer" ')
      )
    : '', [card.body])

  const cardBg = legacyDarkCard ? colors.inkDark
               : dark && card.bg === 'white' ? colors.surfaceDark
               : card.bg || 'white'
  const darkSurface = cardBg === colors.inkDark || cardBg === colors.surfaceDark
  const textColor = darkSurface ? '#F7F7F2' : colors.ink
  const mutedColor = darkSurface ? 'rgba(255,255,255,0.6)' : '#5F687B'
  const typography = getCardTypography(card.font_family)

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
        borderRadius: radii.card,
        border: `2px solid ${borderColor}`,
        boxShadow: dueStatus === 'overdue'
          ? `0 4px 14px rgba(239,68,68,.25), 0 0 0 1px rgba(239,68,68,.15)`
          : shadows.card,
        padding: '13px 15px 10px',
        cursor: card.locked ? 'default' : 'grab',
        width: card.card_width ?? 185,
        height: card.card_height ?? 'auto',
        minHeight: card.collapsed ? 44 : 100,
        zIndex: 20,
        userSelect: 'none',
        fontFamily: fonts.ui,
        overflow: 'hidden',
        boxSizing: 'border-box',
      }}
    >
      {/* Collapse chevron */}
      <button className="no-drag"
        onClick={e => { e.stopPropagation(); onToggleCollapse(card.id) }}
        onMouseDown={e => e.stopPropagation()}
        title={card.collapsed ? 'Expand card' : 'Collapse card'}
        aria-label={card.collapsed ? 'Expand card' : 'Collapse card'}
        style={{ position: 'absolute', top: 6, left: 6, width: 18, height: 18, borderRadius: 5, background: 'rgba(0,0,0,.07)', border: 'none', cursor: 'pointer', color: mutedColor, display: 'grid', placeItems: 'center', zIndex: 2 }}
      >{card.collapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}</button>

      {/* Lock button */}
      <button className="no-drag"
        onClick={e => { e.stopPropagation(); onToggleLock(card.id) }}
        onMouseDown={e => e.stopPropagation()}
        title={card.locked ? 'Unlock card' : 'Lock card in place'}
        aria-label={card.locked ? 'Unlock card' : 'Lock card in place'}
        style={{ position: 'absolute', top: 6, right: 52, width: 18, height: 18, borderRadius: 5, background: card.locked ? 'rgba(105,87,255,.18)' : 'rgba(0,0,0,.07)', border: 'none', cursor: 'pointer', color: card.locked ? colors.markerPurple : mutedColor, display: 'grid', placeItems: 'center', zIndex: 2 }}
      >
        {card.locked ? <Lock size={11} /> : <LockOpen size={11} />}
      </button>

      {/* Duplicate button */}
      <button className="no-drag"
        onClick={e => { e.stopPropagation(); onDuplicate(card.id) }}
        onMouseDown={e => e.stopPropagation()}
        title="Duplicate card"
        aria-label="Duplicate card"
        style={{ position: 'absolute', top: 6, right: 30, width: 18, height: 18, borderRadius: 5, background: 'rgba(0,0,0,.07)', border: 'none', cursor: 'pointer', color: mutedColor, display: 'grid', placeItems: 'center', zIndex: 2 }}
      ><Copy size={11} /></button>

      {/* Delete button */}
      <button className="no-drag"
        onClick={e => { e.stopPropagation(); onDelete(card.id) }}
        onMouseDown={e => e.stopPropagation()}
        title="Delete card"
        aria-label="Delete card"
        style={{ position: 'absolute', top: 6, right: 8, width: 18, height: 18, borderRadius: 5, background: 'rgba(0,0,0,.07)', border: 'none', cursor: 'pointer', color: mutedColor, display: 'grid', placeItems: 'center', zIndex: 2 }}
      ><Trash2 size={11} /></button>

      {/* Overdue badge is shifted right to clear the collapse control. */}
      {dueStatus && (
        <div style={{ position: 'absolute', top: 6, left: 24, fontSize: 9, fontWeight: 800, letterSpacing: '.05em', textTransform: 'uppercase', color: dueStatus === 'overdue' ? '#A52A32' : '#765900', background: dueStatus === 'overdue' ? 'rgba(255,142,142,.28)' : 'rgba(255,218,69,.34)', padding: '3px 6px', borderRadius: radii.control, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          {dueStatus === 'overdue' ? <AlertTriangle size={10} /> : <Clock3 size={10} />}
          {dueStatus === 'overdue' ? 'Overdue' : 'Due soon'}
        </div>
      )}

      {/* Tag */}
      <div style={{ marginTop: dueStatus ? 16 : 0, marginBottom: 7, display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 9, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', padding: '4px 7px', borderRadius: radii.control, background: tm.bg, color: tm.color }}>
        <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: '50%', background: dotColor }} />
        {tm.label}
      </div>

      {/* Title: inline editable */}
      {editing ? (
        <input ref={inputRef} className="no-drag"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={commitTitle}
          onKeyDown={e => { if (e.key === 'Enter') commitTitle(); if (e.key === 'Escape') { setEditing(false); setDraft(card.title) } }}
          onMouseDown={e => e.stopPropagation()}
          style={{ display: 'block', width: '100%', border: `1.5px solid ${colors.markerPurple}`, borderRadius: radii.control, padding: '3px 6px', fontSize: 13, fontFamily: typography.title, fontWeight: typography.titleWeight, background: 'transparent', color: textColor, outline: 'none', marginBottom: 5, boxSizing: 'border-box' }}
        />
      ) : (
        <div
          className="no-drag"
          onClick={e => { e.stopPropagation(); setEditing(true) }}
          title="Click to rename"
          style={{ fontFamily: typography.title, fontSize: 13, fontWeight: typography.titleWeight, color: textColor, lineHeight: 1.3, marginBottom: card.body ? 5 : 0, cursor: 'text', borderRadius: 4, padding: '2px 0' }}
        >{card.title}</div>
      )}

      {/* Body: rendered markdown, hidden when collapsed */}
      {!card.collapsed && card.body && (
        <div className="no-drag md-body"
          dangerouslySetInnerHTML={{ __html: markdownHtml }}
          style={{ fontSize: card.font_family === 'caveat' ? 14 : 11, fontFamily: typography.body, fontWeight: typography.bodyWeight, color: mutedColor, lineHeight: 1.55 }}
        />
      )}

      {/* Footer: hidden when collapsed */}
      {!card.collapsed && (
        <div style={{ marginTop: 9, paddingTop: 7, borderTop: `1px solid ${darkSurface ? 'rgba(255,255,255,.1)' : 'rgba(0,0,0,.07)'}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 10, color: mutedColor }}>
            {card.due_date ? <><CalendarDays size={11} style={{ verticalAlign: 'text-bottom', marginRight: 4 }} />{card.due_date}</> : card.date_label}
          </span>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: dotColor }} />
        </div>
      )}

      {/* Resize handle: bottom-right corner, disabled when locked */}
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

export default memo(IdeaCard)
