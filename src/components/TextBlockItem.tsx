import React, { useState, useRef, useCallback, useLayoutEffect } from 'react'
import type { TextBlock } from '../types'

const TEXT_MIN_W = 120

interface TextBlockItemProps {
  block: TextBlock
  dark: boolean
  onMoveStart: (id: string, cx: number, cy: number) => void
  onUpdateHtml: (id: string, html: string) => void
  onResizeStart: (id: string, cx: number, cy: number, startW: number) => void
  onRemove: (id: string) => void
}

const TextBlockItem = React.memo(function TextBlockItem({
  block, dark, onMoveStart, onUpdateHtml, onResizeStart, onRemove,
}: TextBlockItemProps) {
  const [focused, setFocused] = useState(false)
  const [isEmpty, setIsEmpty] = useState(!block.html)
  const editRef = useRef<HTMLDivElement>(null)

  // Sync innerHTML when block.html changes externally (e.g. on reload)
  // Skip update while the element is focused to avoid clobbering the cursor
  useLayoutEffect(() => {
    if (editRef.current && !editRef.current.matches(':focus')) {
      editRef.current.innerHTML = block.html
      setIsEmpty(!block.html)
    }
  }, [block.html])

  const execFormat = useCallback((cmd: string, value?: string) => {
    editRef.current?.focus()
    document.execCommand(cmd, false, value)
  }, [])

  const borderColor = focused
    ? '#49B6E5'
    : dark ? '#2A2A38' : '#e8e4d9'

  return (
    <div
      className="world-item"
      style={{ position: 'absolute', left: block.x, top: block.y, width: block.width, userSelect: 'none' }}
      onMouseDown={e => {
        if (e.button !== 0) return
        if ((e.target as HTMLElement).closest('.text-no-drag')) return
        onMoveStart(block.id, e.clientX, e.clientY)
        e.preventDefault()
        e.stopPropagation()
      }}
    >
      {/* Toolbar — pinned above block, visible when focused */}
      {focused && (
        <div
          className="text-no-drag"
          style={{
            position: 'absolute',
            top: -40,
            left: 0,
            right: 0,
            height: 32,
            background: dark ? '#1A1A24' : 'white',
            border: `1.5px solid ${dark ? '#2A2A38' : '#e8e4d9'}`,
            borderRadius: 6,
            display: 'flex',
            alignItems: 'center',
            padding: '0 8px',
            gap: 2,
            boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
            zIndex: 10,
          }}
        >
          {/* Bold */}
          <button
            onMouseDown={e => { e.preventDefault(); execFormat('bold') }}
            title="Bold"
            style={{ fontWeight: 700, fontSize: 12, color: dark ? '#E8E6E0' : '#263D5B', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 7px', borderRadius: 4 }}
          >B</button>
          {/* Italic */}
          <button
            onMouseDown={e => { e.preventDefault(); execFormat('italic') }}
            title="Italic"
            style={{ fontStyle: 'italic', fontSize: 12, color: dark ? '#E8E6E0' : '#263D5B', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 7px', borderRadius: 4 }}
          >I</button>
          {/* Highlight */}
          <button
            onMouseDown={e => { e.preventDefault(); execFormat('hiliteColor', '#ffe082') }}
            title="Highlight"
            style={{ fontSize: 12, color: dark ? '#E8E6E0' : '#263D5B', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 7px', borderRadius: 4 }}
          ><span style={{ background: '#ffe082', padding: '0 3px', borderRadius: 2 }}>H</span></button>
          {/* Divider */}
          <div style={{ width: 1, height: 14, background: dark ? '#2A2A38' : '#e8e4d9', margin: '0 4px' }} />
          {/* Delete */}
          <button
            className="text-no-drag"
            onMouseDown={e => { e.preventDefault(); onRemove(block.id) }}
            title="Delete text block"
            style={{ marginLeft: 'auto', fontSize: 14, lineHeight: 1, color: dark ? '#666' : '#aaa', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px' }}
          >✕</button>
        </div>
      )}

      {/* Block body */}
      <div
        style={{
          background: dark ? 'rgba(30,30,40,0.85)' : 'rgba(255,255,255,0.85)',
          border: `1.5px solid ${borderColor}`,
          borderRadius: 8,
          boxShadow: '2px 2px 0 rgba(38,61,91,0.08)',
          minHeight: 60,
          padding: '12px 14px',
          position: 'relative',
          cursor: focused ? 'text' : 'grab',
          transition: 'border-color 0.15s',
          boxSizing: 'border-box',
        }}
      >
        {/* Placeholder */}
        {isEmpty && !focused && (
          <div style={{
            position: 'absolute', top: 12, left: 14,
            fontSize: 14, color: dark ? '#555' : '#bbb',
            pointerEvents: 'none',
            fontFamily: "'Delius', cursive",
          }}>
            Click to type…
          </div>
        )}

        {/* Editable text area */}
        <div
          ref={editRef}
          className="text-no-drag"
          contentEditable
          suppressContentEditableWarning
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false)
            const hasText = !!editRef.current?.textContent?.trim()
            const html = hasText ? (editRef.current?.innerHTML ?? '') : ''
            setIsEmpty(!hasText)
            onUpdateHtml(block.id, html)
          }}
          onInput={() => setIsEmpty(!editRef.current?.textContent?.trim())}
          style={{
            outline: 'none',
            fontSize: 14,
            color: dark ? '#E8E6E0' : '#263D5B',
            lineHeight: 1.6,
            fontFamily: "'Delius', cursive",
            minHeight: 36,
            wordBreak: 'break-word',
          }}
        />

        {/* Right-edge resize handle */}
        <div
          className="text-no-drag"
          onMouseDown={e => {
            if (e.button !== 0) return
            onResizeStart(block.id, e.clientX, e.clientY, block.width)
            e.preventDefault()
            e.stopPropagation()
          }}
          style={{
            position: 'absolute',
            right: 0, top: 0, bottom: 0,
            width: 8,
            cursor: 'ew-resize',
            borderRadius: '0 8px 8px 0',
          }}
        />
      </div>
    </div>
  )
})

export { TEXT_MIN_W }
export default TextBlockItem
