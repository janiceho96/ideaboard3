import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type ChangeEvent, type RefObject } from 'react'
import { Bold, CheckSquare, Heading2, Highlighter, Italic, Link2, List, ListOrdered, Redo2, Undo2 } from 'lucide-react'
import { NOTE_HIGHLIGHT_COLORS, NOTE_HIGHLIGHT_SWATCHES } from '../lib/noteHighlight'
import { formatMarkdown, isSafeMarkdownLink, type MarkdownCommand } from '../lib/markdownEditor'

interface Props {
  value: string
  onChange: (value: string) => void
  label: string
  placeholder?: string
  rows?: number
  textareaRef?: RefObject<HTMLTextAreaElement>
  compact?: boolean
  dark?: boolean
  textareaStyle?: CSSProperties
  containerStyle?: CSSProperties
  onFocus?: () => void
  onBlur?: () => void
}

type History = { undo: string[]; redo: string[]; lastType: string; lastAt: number }
const MAX_HISTORY = 80

function MarkdownEditor({ value, onChange, label, placeholder, rows = 4, textareaRef, compact = false, dark = false, textareaStyle, containerStyle, onFocus, onBlur }: Props) {
  const internalInput = useRef<HTMLTextAreaElement>(null)
  const input = textareaRef ?? internalInput
  const valueRef = useRef(value)
  const propValueRef = useRef(value)
  const selection = useRef({ start: 0, end: 0 })
  const history = useRef<History>({ undo: [], redo: [], lastType: '', lastAt: 0 })
  const [historyVersion, setHistoryVersion] = useState(0)
  const [toolbarOpen, setToolbarOpen] = useState(!compact)
  const [highlightColor, setHighlightColor] = useState<(typeof NOTE_HIGHLIGHT_COLORS)[number]>('yellow')
  const [linkOpen, setLinkOpen] = useState(false)
  const [linkUrl, setLinkUrl] = useState('https://')
  const [linkError, setLinkError] = useState('')

  useEffect(() => {
    if (value !== propValueRef.current && value !== valueRef.current) {
      valueRef.current = value
      history.current = { undo: [], redo: [], lastType: '', lastAt: 0 }
      setHistoryVersion(version => version + 1)
    }
    propValueRef.current = value
  }, [value])

  const remember = (snapshot: string) => {
    const state = history.current
    if (state.undo[state.undo.length - 1] !== snapshot) {
      state.undo = [...state.undo.slice(-(MAX_HISTORY - 1)), snapshot]
    }
    state.redo = []
    state.lastType = ''
    state.lastAt = 0
    setHistoryVersion(version => version + 1)
  }

  const write = (next: string, caret?: { start: number; end: number }) => {
    valueRef.current = next
    onChange(next)
    if (caret) requestAnimationFrame(() => {
      input.current?.focus()
      input.current?.setSelectionRange(caret.start, caret.end)
      selection.current = caret
    })
  }

  const apply = (command: MarkdownCommand, color = highlightColor, url = 'https://example.com') => {
    const current = valueRef.current
    const range = input.current
      ? { start: input.current.selectionStart, end: input.current.selectionEnd }
      : selection.current
    const result = formatMarkdown(current, range.start, range.end, command, color, url)
    if (result.value === current) return
    remember(current)
    write(result.value, { start: result.selectionStart, end: result.selectionEnd })
    if (compact) setToolbarOpen(false)
  }

  const beginLink = () => {
    setLinkUrl('https://')
    setLinkError('')
    setLinkOpen(true)
    if (compact) setToolbarOpen(true)
  }

  const insertLink = () => {
    if (!isSafeMarkdownLink(linkUrl)) {
      setLinkError('Use an http, https, mailto, tel, or relative link.')
      return
    }
    const safeUrl = linkUrl.replace(/[()\\]/g, character => encodeURIComponent(character))
    apply('link', highlightColor, safeUrl)
    setLinkOpen(false)
    setLinkError('')
  }

  const undo = () => {
    const state = history.current
    const previous = state.undo.pop()
    if (previous === undefined) return
    state.redo.push(valueRef.current)
    state.lastType = ''
    state.lastAt = 0
    write(previous)
    setHistoryVersion(version => version + 1)
  }

  const redo = () => {
    const state = history.current
    const next = state.redo.pop()
    if (next === undefined) return
    state.undo.push(valueRef.current)
    state.lastType = ''
    state.lastAt = 0
    write(next)
    setHistoryVersion(version => version + 1)
  }

  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    const next = event.target.value
    const inputType = (event.nativeEvent as InputEvent).inputType || 'insertText'
    const state = history.current
    const typing = inputType === 'insertText' || inputType.startsWith('deleteContent')
    const now = Date.now()
    if (!typing || inputType !== state.lastType || now - state.lastAt > 750) remember(valueRef.current)
    state.lastType = typing ? inputType : ''
    state.lastAt = now
    valueRef.current = next
    selection.current = { start: event.target.selectionStart, end: event.target.selectionEnd }
    history.current.redo = []
    onChange(next)
    setHistoryVersion(version => version + 1)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (!(event.metaKey || event.ctrlKey)) return
    const key = event.key.toLowerCase()
    if (key === 'z') {
      event.preventDefault()
      event.stopPropagation()
      if (event.shiftKey) redo()
      else undo()
    } else if (key === 'y') {
      event.preventDefault()
      event.stopPropagation()
      redo()
    } else if (!event.shiftKey && key === 'b') {
      event.preventDefault()
      apply('bold')
    } else if (!event.shiftKey && key === 'i') {
      event.preventDefault()
      apply('italic')
    } else if (!event.shiftKey && key === 'k') {
      event.preventDefault()
      beginLink()
    }
  }

  const buttonStyle: CSSProperties = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4,
    minWidth: 27, height: 27, padding: '0 5px', borderRadius: 5,
    border: `1px solid ${dark ? '#52617A' : '#C8CED9'}`,
    background: dark ? '#1E2C43' : '#FFFFFF', color: dark ? '#F3F5F8' : '#263D5B',
    cursor: 'pointer', fontSize: 11,
  }
  const toolbar = <div role="toolbar" aria-label={`${label} formatting`} onMouseDown={event => {
    if (!(event.target instanceof HTMLInputElement)) event.preventDefault()
  }}
    style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 4, padding: 4,
      borderRadius: 6, border: `1px solid ${dark ? '#52617A' : '#D5D9E2'}`,
      background: dark ? '#152238' : '#F6F7FA', boxShadow: '0 2px 7px rgba(24,34,52,.12)' }}>
    <button type="button" aria-label="Bold" title="Bold (⌘/Ctrl+B)" style={buttonStyle} onClick={() => apply('bold')}><Bold size={14} /></button>
    <button type="button" aria-label="Italic" title="Italic (⌘/Ctrl+I)" style={buttonStyle} onClick={() => apply('italic')}><Italic size={14} /></button>
    <button type="button" aria-label="Heading" title="Toggle heading" style={buttonStyle} onClick={() => apply('heading')}><Heading2 size={15} /></button>
    <button type="button" aria-label="Bulleted list" title="Bulleted list" style={buttonStyle} onClick={() => apply('bullet-list')}><List size={15} /></button>
    <button type="button" aria-label="Numbered list" title="Numbered list" style={buttonStyle} onClick={() => apply('numbered-list')}><ListOrdered size={15} /></button>
    <button type="button" aria-label="Checklist" title="Checklist" style={buttonStyle} onClick={() => apply('checklist')}><CheckSquare size={15} /></button>
    <button type="button" aria-label="Insert link" title="Insert Markdown link (⌘/Ctrl+K)" style={buttonStyle} onClick={beginLink}><Link2 size={14} /></button>
    {NOTE_HIGHLIGHT_COLORS.map(color => <button key={color} type="button" aria-label={`Highlight ${color}`} title={`Highlight ${color}`}
      aria-pressed={highlightColor === color} style={{ ...buttonStyle, minWidth: 22, width: 22, padding: 0, background: NOTE_HIGHLIGHT_SWATCHES[color], color: '#263D5B', borderColor: highlightColor === color ? '#263D5B' : '#C8CED9' }}
      onClick={() => { setHighlightColor(color); apply('highlight', color) }}><Highlighter size={12} /></button>)}
    <button type="button" aria-label="Undo text edit" title="Undo text edit (⌘/Ctrl+Z)" disabled={!history.current.undo.length} style={{ ...buttonStyle, opacity: history.current.undo.length ? 1 : .45 }} onClick={undo}><Undo2 size={14} /></button>
    <button type="button" aria-label="Redo text edit" title="Redo text edit (⌘/Ctrl+Shift+Z)" disabled={!history.current.redo.length} style={{ ...buttonStyle, opacity: history.current.redo.length ? 1 : .45 }} onClick={redo}><Redo2 size={14} /></button>
    {linkOpen && <div role="group" aria-label="Insert link" style={{ display: 'flex', alignItems: 'center', gap: 4, width: '100%' }}>
      <input type="url" aria-label="Link address" value={linkUrl} onChange={event => { setLinkUrl(event.target.value); setLinkError('') }}
        onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); insertLink() } if (event.key === 'Escape') setLinkOpen(false) }}
        placeholder="https://example.com" style={{ flex: 1, minWidth: 90, height: 27, borderRadius: 4, border: '1px solid #AAB2C2', padding: '0 6px', fontSize: 11 }} />
      <button type="button" style={buttonStyle} onClick={insertLink}>Insert</button>
      <button type="button" aria-label="Cancel link" style={buttonStyle} onClick={() => setLinkOpen(false)}>Cancel</button>
      {linkError && <span role="alert" style={{ width: '100%', color: '#B42332', fontSize: 10 }}>{linkError}</span>}
    </div>}
  </div>

  // Read the history length during render so the toolbar's disabled state updates.
  void historyVersion
  return <div className="ib-markdown-editor" style={{ position: 'relative', width: '100%', ...containerStyle }}>
    {compact && <button type="button" aria-label="Text formatting" aria-expanded={toolbarOpen} title="Text formatting"
      onMouseDown={event => event.preventDefault()} onClick={() => setToolbarOpen(open => !open)}
      style={{ ...buttonStyle, position: 'absolute', zIndex: 8, top: 3, left: 3, fontWeight: 700, background: dark ? '#253954' : '#FFFFFF' }}>Aa</button>}
    {toolbarOpen && <div style={compact ? { position: 'absolute', zIndex: 9, top: 32, left: 0, width: 268, maxWidth: '85vw' } : { marginBottom: 6 }}>{toolbar}</div>}
    <textarea ref={input} value={value} onChange={handleChange} onKeyDown={handleKeyDown}
      onSelect={event => { selection.current = { start: event.currentTarget.selectionStart, end: event.currentTarget.selectionEnd } }}
      onFocus={onFocus} onBlur={event => {
        if (!event.relatedTarget || !event.currentTarget.parentElement?.contains(event.relatedTarget)) onBlur?.()
      }} aria-label={label} placeholder={placeholder} rows={rows}
      style={{ boxSizing: 'border-box', width: '100%', ...textareaStyle, ...(compact ? { paddingTop: Math.max(30, Number.parseFloat(String(textareaStyle?.paddingTop ?? 0)) || 0) } : {}) }} />
  </div>
}

export default MarkdownEditor
