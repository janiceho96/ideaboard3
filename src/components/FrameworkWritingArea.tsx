import { memo, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { renderNoteMarkdown } from '../lib/noteHighlight'
import { toggleMarkdownChecklistItem } from '../lib/markdownEditor'
import MarkdownEditor from './MarkdownEditor'

interface Props {
  value: string
  label: string
  placeholder?: string
  guidance?: string
  style: CSSProperties
  onChange: (value: string) => void
  onSelect: () => void
  dark?: boolean
}

function FrameworkWritingArea({ value, label, placeholder, guidance, style, onChange, onSelect, dark = false }: Props) {
  const [editing, setEditing] = useState(false)
  const input = useRef<HTMLTextAreaElement>(null)
  const html = useMemo(() => !editing && value ? renderNoteMarkdown(value) : '', [value, editing])
  useEffect(() => { if (editing) input.current?.focus() }, [editing])
  const edit = () => { onSelect(); setEditing(true) }

  if (value && !editing) return <div className="no-drag md-body" role="group" tabIndex={0}
    aria-label={label} title={`${guidance ?? label} Click to edit.`}
    onMouseDown={event => event.stopPropagation()}
    onClick={event => {
      const checkbox = (event.target as HTMLElement).closest<HTMLInputElement>('input[data-ideaboard-task]')
      if (checkbox) {
        event.preventDefault()
        event.stopPropagation()
        const index = Number(checkbox.dataset.ideaboardTask)
        const next = toggleMarkdownChecklistItem(value, index, checkbox.dataset.checked !== 'true')
        if (next !== value) { onSelect(); onChange(next) }
        return
      }
      event.preventDefault()
      event.stopPropagation()
      edit()
    }}
    onKeyDown={event => {
      if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) {
        event.preventDefault()
        event.stopPropagation()
        edit()
      }
    }}
    style={{ ...style, overflow: 'auto', cursor: 'text' }} dangerouslySetInnerHTML={{ __html: html }} />

  const textareaStyle: CSSProperties = {
    position: 'absolute', inset: 0, width: '100%', height: '100%', boxSizing: 'border-box',
    resize: 'none', border: 0, borderRadius: 7, background: 'transparent',
    color: dark ? '#F0EEE8' : '#263D5B', fontFamily: "'Delius', cursive",
    fontSize: style.fontSize, lineHeight: 1.45, padding: '34px 8px 8px', outline: 'none',
  }
  return <div className="no-drag" style={{ ...style, overflow: 'visible', padding: 0, zIndex: editing ? 15 : 7 }}
    onMouseDown={event => event.stopPropagation()}>
    <MarkdownEditor textareaRef={input} value={value} onChange={onChange} label={label} placeholder={placeholder}
      compact dark={dark} textareaStyle={textareaStyle}
      containerStyle={{ position: 'absolute', inset: 0, zIndex: 8, overflow: 'visible' }}
      onFocus={() => { onSelect(); setEditing(true) }}
      onBlur={() => setEditing(false)} />
  </div>
}

export default memo(FrameworkWritingArea)
