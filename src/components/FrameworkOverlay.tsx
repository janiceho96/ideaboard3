// src/components/FrameworkOverlay.tsx
import { Fragment } from 'react'
import type { FrameworkType } from '../hooks/useFramework'

interface FrameworkOverlayProps {
  type: FrameworkType
  width: number
  height: number
  dark: boolean
  onResizeStart: (e: React.MouseEvent) => void
}

export default function FrameworkOverlay({ type, width, height, dark, onResizeStart }: FrameworkOverlayProps) {
  if (type === 'blank') return null

  return (
    <div
      className="world-item"
      style={{ position: 'absolute', left: 60, top: 40, width, height, userSelect: 'none' }}
    >
      {type === 'eisenhower' && <EisenhowerMatrix width={width} height={height} dark={dark} />}
      {type === 'ooda'       && <OodaLoop         width={width} height={height} dark={dark} />}

      {/* Resize handle */}
      <div
        onMouseDown={e => { e.stopPropagation(); e.preventDefault(); onResizeStart(e) }}
        title="Drag to resize framework"
        style={{
          position: 'absolute', bottom: 4, right: 4,
          width: 16, height: 16,
          cursor: 'nwse-resize',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          opacity: 0.45,
        }}
      >
        <svg width="10" height="10" viewBox="0 0 8 8">
          <path d="M1 7L7 1M4 7L7 4" stroke="#888" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </div>
    </div>
  )
}

// ── Eisenhower Matrix ─────────────────────────────────────────────────────────

function EisenhowerMatrix({ width, height, dark }: { width: number; height: number; dark: boolean }) {
  const labelW = 56
  const labelH = 22
  const bgs = ['#D4EDD8', '#FFF3B0', '#FFD6C2', '#E8E0F5']
  const tcs = ['#1B4D21', '#5C4009', '#6B2D0D', '#3A2270']

  return (
    <>
      {/* Column labels */}
      <div style={{ display: 'flex', paddingLeft: labelW, paddingBottom: 6, height: labelH }}>
        {['Important', 'Not Important'].map((l, i) => (
          <div key={l} style={{ flex: 1, textAlign: 'center', fontSize: 9, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: i === 0 ? (dark ? '#666' : '#999') : (dark ? '#444' : '#ccc') }}>
            {l}
          </div>
        ))}
      </div>

      {/* Row labels + grid */}
      <div style={{ display: 'flex', height: height - labelH }}>
        <div style={{ width: labelW, display: 'flex', flexDirection: 'column', justifyContent: 'space-around', paddingRight: 8 }}>
          {['Urgent', 'Not Urgent'].map((l, i) => (
            <div key={l} style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: i === 0 ? (dark ? '#666' : '#999') : (dark ? '#444' : '#ccc'), writingMode: 'vertical-rl', transform: 'rotate(180deg)', textAlign: 'center', height: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {l}
            </div>
          ))}
        </div>

        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', gap: 5 }}>
          {(['Do First', 'Schedule', 'Delegate', 'Eliminate'] as const).map((label, i) => (
            <div key={label} style={{ background: dark ? `${bgs[i]}22` : bgs[i], borderRadius: 15, border: `2px solid rgba(0,0,0,${dark ? .04 : .07})`, padding: 13 }}>
              <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', opacity: .45, marginBottom: 3, color: tcs[i] }}>
                Q{i + 1}
              </div>
              <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 15, fontWeight: 800, color: tcs[i] }}>
                {label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

// ── OODA Loop ─────────────────────────────────────────────────────────────────

function OodaLoop({ width, height, dark }: { width: number; height: number; dark: boolean }) {
  const boxes = [
    { label: 'Observe', sub: 'Gather data & context',      bg: '#D0E8FF', tc: '#1A3A5C' },
    { label: 'Orient',  sub: 'Analyse & make sense',       bg: '#FFF9C4', tc: '#5C4009' },
    { label: 'Decide',  sub: 'Choose a course of action',  bg: '#D4EDD8', tc: '#1B4D21' },
    { label: 'Act',     sub: 'Execute & observe results',  bg: '#FFD6C2', tc: '#6B2D0D' },
  ]
  const arrowW = 28
  const boxW = Math.floor((width - arrowW * 3) / 4)

  return (
    <div style={{ display: 'flex', alignItems: 'stretch', height: '100%', gap: 0 }}>
      {boxes.map((box, i) => (
        <Fragment key={box.label}>
          <div style={{ width: boxW, background: dark ? `${box.bg}22` : box.bg, borderRadius: 15, border: `2px solid rgba(0,0,0,${dark ? .04 : .07})`, padding: '16px 14px', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
            <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 14, fontWeight: 800, color: box.tc, marginBottom: 6 }}>
              {box.label}
            </div>
            <div style={{ fontSize: 10, color: box.tc, opacity: 0.6, lineHeight: 1.5 }}>
              {box.sub}
            </div>
          </div>
          {i < 3 && (
            <div style={{ width: arrowW, display: 'flex', alignItems: 'center', justifyContent: 'center', color: dark ? '#555' : '#bbb', fontSize: 18, flexShrink: 0 }}>
              →
            </div>
          )}
        </Fragment>
      ))}
    </div>
  )
}
