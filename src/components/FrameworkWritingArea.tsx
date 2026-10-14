import { memo, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { renderNoteMarkdown } from '../lib/noteHighlight'

interface Props {
  value: string
  label: string
  placeholder?: string
  guidance?: string
  style: CSSProperties
  onChange: (value: string) => void
  onSelect: () => void
}

function FrameworkWritingArea({ value, label, placeholder, guidance, style, onChange, onSelect }: Props) {
  const [editing, setEditing] = useState(false)
  const input = useRef<HTMLTextAreaElement>(null)
  const html = useMemo(() => !editing && value ? renderNoteMarkdown(value) : '', [value, editing])
  useEffect(() => { if (editing) input.current?.focus() }, [editing])
  const edit = () => { onSelect(); setEditing(true) }

  if (value && !editing) return <div className="no-drag md-body" role="textbox" aria-readonly="true" tabIndex={0}
    aria-label={label} title={`${guidance ?? label} Click to edit.`}
    onMouseDown={event => event.stopPropagation()}
    onClick={event => { event.preventDefault(); event.stopPropagation(); edit() }}
    onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); edit() } }}
    style={{ ...style, overflow: 'auto', cursor: 'text' }} dangerouslySetInnerHTML={{ __html: html }} />

  return <textarea ref={input} className="no-drag" value={value} aria-label={label}
    placeholder={placeholder} title={guidance} style={style}
    onFocus={() => setEditing(true)} onBlur={() => setEditing(false)}
    onChange={event => onChange(event.target.value)}
    onMouseDown={event => event.stopPropagation()}
    onClick={event => { event.stopPropagation(); onSelect() }} />
}

export default memo(FrameworkWritingArea)
