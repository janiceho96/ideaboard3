import { useState, memo } from 'react'
import FrameworkWritingArea from './FrameworkWritingArea'
import { FrameworkLayoutSurface } from './FrameworkLayoutPreview'
import type { BuiltinFrameworkType, FrameInstance } from '../types'
import { FRAMEWORK_LABELS, FRAMEWORK_GROUPS, FRAMEWORK_REGISTRY, getFrameworkDefinition, getFrameworkLabel, getFrameworkSectionNotes } from '../hooks/useFrames'

interface FrameworkOverlayProps {
  frame: FrameInstance
  dark: boolean
  selected: boolean
  onMoveStart: (id: string, e: React.MouseEvent) => void
  onResizeStart: (id: string, e: React.MouseEvent) => void
  onDelete: (id: string) => void
  onSelect: (id: string) => void
  onTypeChange: (id: string, type: BuiltinFrameworkType) => void
  onRename: (id: string, name: string) => void
  onUpdateNotes: (id: string, notes: string) => void
  onUpdateNoteArea: (id: string, areaId: string, notes: string) => void
}

function FrameworkOverlay({
  frame, dark, selected,
  onMoveStart, onResizeStart, onDelete, onSelect, onTypeChange, onRename, onUpdateNotes, onUpdateNoteArea,
}: FrameworkOverlayProps) {
  const [typePickerOpen, setTypePickerOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const { id, type, name, x, y, width, height } = frame
  const frameworkLabel = getFrameworkLabel(type, frame.customFramework)
  const label = name ? `${frameworkLabel} — ${name}` : frameworkLabel
  const definition = getFrameworkDefinition(type, frame.customFramework) ?? FRAMEWORK_REGISTRY.blank
  const areas = definition.sections
  const earlierAreas = definition.legacySections.filter(area => getFrameworkSectionNotes(frame, area.id))

  return (
    <div
      className="world-item"
      onClick={e => { if (!(e.target as HTMLElement).closest('.no-drag')) onSelect(id) }}
      style={{
        position: 'absolute', left: x, top: y,
        ...(type.startsWith('custom:') ? { width, height } : {}),
        userSelect: 'none',
        outline: selected ? '2px solid #49B6E5' : 'none',
        outlineOffset: 3,
        borderRadius: 10,
      }}
    >
      {/* Header bar — sits 28px above the frame content */}
      <div style={{
        position: 'absolute', top: -28, left: 0, right: 0, height: 28,
        background: '#263D5B', borderRadius: '6px 6px 0 0',
        display: 'flex', alignItems: 'center', gap: 4, padding: '0 6px',
        zIndex: 5,
      }}>
        <span
          onMouseDown={e => { e.stopPropagation(); e.preventDefault(); onMoveStart(id, e) }}
          style={{ cursor: 'grab', opacity: 0.6, fontSize: 14, lineHeight: 1, flexShrink: 0, color: 'white' }}
        >⠿</span>

        {editing ? (
          <input
            autoFocus
            defaultValue={name ?? ''}
            onBlur={e => { onRename(id, e.target.value); setEditing(false) }}
            onKeyDown={e => {
              if (e.key === 'Enter') { onRename(id, (e.target as HTMLInputElement).value); setEditing(false) }
              if (e.key === 'Escape') { setEditing(false) }
            }}
            onMouseDown={e => e.stopPropagation()}
            onClick={e => e.stopPropagation()}
            className="no-drag"
            style={{
              flex: 1, background: 'transparent', border: 'none',
              borderBottom: '1px solid rgba(255,255,255,.4)',
              color: 'rgba(255,255,255,.9)', fontSize: 9, letterSpacing: '0.07em',
              outline: 'none', padding: 0, fontFamily: 'inherit', width: 0,
            }}
          />
        ) : (
          <span
            onDoubleClick={e => { e.stopPropagation(); setEditing(true) }}
            title="Double-click to rename"
            style={{
              flex: 1, fontSize: 9, letterSpacing: '0.07em',
              color: 'rgba(255,255,255,.8)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              cursor: 'text',
            }}
          >
            {label}
          </span>
        )}

        <div style={{ position: 'relative' }} className="no-drag">
          <button
            onClick={e => { e.stopPropagation(); setTypePickerOpen(o => !o) }}
            title="Change frame type"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,.7)', fontSize: 10, padding: '2px 4px', lineHeight: 1 }}
          >▾</button>
          {typePickerOpen && (
            <>
              <div style={{ position: 'fixed', inset: 0, zIndex: 998 }} onClick={() => setTypePickerOpen(false)} />
              <div style={{
                position: 'absolute', top: 26, left: -4, zIndex: 999,
                background: dark ? '#152336' : 'white',
                border: `1px solid ${dark ? '#1E3451' : '#ddd'}`,
                borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,.2)',
                minWidth: 200, maxHeight: 320, overflowY: 'auto',
              }}>
                {FRAMEWORK_GROUPS.map((entry, i) =>
                  'sep' in entry ? (
                    <div key={entry.sep + i} style={{ padding: '7px 12px 2px', fontSize: 8, letterSpacing: '0.1em', color: dark ? '#555' : '#aaa', fontWeight: 700 }}>
                      {entry.sep}
                    </div>
                  ) : (
                    <button
                      key={entry.key}
                      onClick={() => { onTypeChange(id, entry.key!); setTypePickerOpen(false) }}
                      style={{
                        display: 'block', width: '100%', padding: '8px 12px', border: 'none',
                        background: type === entry.key ? (dark ? 'rgba(73,182,229,.15)' : 'rgba(73,182,229,.08)') : 'transparent',
                        cursor: 'pointer', textAlign: 'left', fontSize: 11,
                        color: type === entry.key ? '#49B6E5' : (dark ? '#ddd' : '#152336'),
                        fontFamily: "'DM Sans',sans-serif",
                      }}
                    >
                      {FRAMEWORK_LABELS[entry.key!]}
                    </button>
                  )
                )}
              </div>
            </>
          )}
        </div>

        <button
          className="no-drag"
          onClick={e => { e.stopPropagation(); onDelete(id) }}
          title="Remove frame"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,.6)', fontSize: 14, padding: '2px 4px', lineHeight: 1 }}
        >×</button>
      </div>

      {type === 'blank' && <div style={shell(width, height, dark)}>{header('BLANK — LEGACY NOTES')}</div>}
      {type === 'eisenhower'            && <EisenhowerMatrix   width={width} height={height} dark={dark} />}
      {type === 'ooda'                  && <OodaLoop           width={width} height={height} dark={dark} />}
      {type === 'ikigai'                && <IkigaiDiagram      width={width} height={height} dark={dark} />}
      {type === 'wheel-of-life'         && <WheelOfLife        width={width} height={height} dark={dark} />}
      {type === 'grow'                  && <GrowModel          width={width} height={height} dark={dark} />}
      {type === 'smart-goals'           && <SmartGoals         width={width} height={height} dark={dark} />}
      {type === 'start-stop-continue'   && <StartStopContinue  width={width} height={height} dark={dark} />}
      {type === 'personal-kanban'       && <PersonalKanban     width={width} height={height} dark={dark} />}
      {type === 'five-whys'             && <FiveWhys           width={width} height={height} dark={dark} />}
      {type === 'daily-reflection'      && <DailyReflection    width={width} height={height} dark={dark} />}
      {type === 'okr'                   && <OKRFramework       width={width} height={height} dark={dark} />}
      {type === 'energy-audit'          && <EnergyAudit        width={width} height={height} dark={dark} />}
      {type === 'eat-that-frog'         && <EatThatFrog        width={width} height={height} dark={dark} />}
      {type === 'gtd'                   && <GTD                width={width} height={height} dark={dark} />}
      {type === 'stp'                   && <STPMarketing       width={width} height={height} dark={dark} />}
      {type === 'marketing-mix'         && <MarketingMix       width={width} height={height} dark={dark} />}
      {type === 'aida'                  && <AIDAFunnel         width={width} height={height} dark={dark} />}
      {type === 'swot'                  && <SWOTAnalysis       width={width} height={height} dark={dark} />}
      {type === 'customer-journey'      && <CustomerJourney    width={width} height={height} dark={dark} />}
      {type === 'first-principles'      && <FirstPrinciples    width={width} height={height} dark={dark} />}
      {type === 'six-thinking-hats'     && <SixThinkingHats    width={width} height={height} dark={dark} />}
      {type === 'scamper'               && <SCAMPERFramework   width={width} height={height} dark={dark} />}
      {type === 'pros-cons'             && <ProsCons           width={width} height={height} dark={dark} />}
      {type === 'impact-effort'         && <ImpactEffort       width={width} height={height} dark={dark} />}
      {type.startsWith('custom:') && frame.customFramework && <CustomFrameworkSurface frame={frame} dark={dark} />}

      {type === 'wheel-of-life' && areas.map(area => (
        <span key={`label-${area.id}`} style={{ position: 'absolute', left: '43%', top: `${area.top - 2}%`, fontSize: 9, color: dark ? '#F0EEE8' : '#263D5B', fontFamily: "'DM Sans',sans-serif", zIndex: 4 }}>{area.label}</span>
      ))}
      {!!earlierAreas.length && (
        <details className="no-drag" onMouseDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()}
          style={{ position: 'absolute', top: 38, left: 8, width: '36%', color: dark ? '#F0EEE8' : '#263D5B', maxHeight: '85%', overflowY: 'auto', zIndex: 6, background: dark ? '#152336' : '#fff', border: '1.5px solid #263D5B', borderRadius: 6, padding: 6 }}>
          <summary style={{ cursor: 'pointer', fontSize: 11 }}>Earlier notes ({earlierAreas.length})</summary>
          <p style={{ fontSize: 11 }}>These earlier notes were written in positional boxes. Choose a life area before moving their contents.</p>
          {earlierAreas.map(area => (
            <label key={area.id} style={{ display: 'block', fontSize: 11, marginTop: 8 }}>
              {area.label}
              <FrameworkWritingArea label={area.label} value={getFrameworkSectionNotes(frame, area.id) ?? ''}
                onChange={value => onUpdateNoteArea(id, area.storageKey, value)} onSelect={() => onSelect(id)} dark={dark}
                style={{ display: 'block', width: '100%', minHeight: 80, boxSizing: 'border-box', fontFamily: 'inherit', color: dark ? '#F0EEE8' : '#263D5B', background: dark ? '#152336' : '#fff' }} />
            </label>
          ))}
        </details>
      )}
      {areas.map(area => (
        <FrameworkWritingArea
          key={area.id}
          value={getFrameworkSectionNotes(frame, area.id) ?? ''}
          onChange={value => onUpdateNoteArea(id, area.storageKey, value)}
          onSelect={() => onSelect(id)}
          label={area.label}
          placeholder={type.startsWith('custom:') ? area.writingGuidance : `${area.label}...`}
          guidance={area.writingGuidance}
          dark={dark}
          style={{
            position: 'absolute',
            left: `${area.left}%`,
            top: type.startsWith('custom:') ? `calc(${area.top}% + 4.5%)` : `${area.top}%`,
            width: `${area.width}%`,
            height: type.startsWith('custom:') ? `calc(${area.height}% - 4.5%)` : `${area.height}%`,
            resize: 'none',
            border: selected ? '1px dashed rgba(73,182,229,.42)' : '1px solid transparent',
            borderRadius: 7,
            background: selected ? (dark ? 'rgba(13,27,46,.22)' : 'rgba(255,255,255,.32)') : 'transparent',
            color: dark ? '#F0EEE8' : '#263D5B',
            fontFamily: "'Delius', cursive",
            fontSize: Math.max(11, Math.min(15, width / 54)),
            lineHeight: 1.45,
            padding: 8,
            outline: 'none',
            zIndex: 4,
            opacity: selected || getFrameworkSectionNotes(frame, area.id) ? 1 : 0,
            transition: 'opacity .12s, border-color .12s, background .12s',
            boxSizing: 'border-box',
          }}
        />
      ))}
      {!areas.length && (
        <FrameworkWritingArea
          value={frame.notes ?? ''}
          onChange={value => onUpdateNotes(id, value)}
          onSelect={() => onSelect(id)}
          label="Framework writing"
          placeholder="Write on this framework..."
          dark={dark}
          style={{
            position: 'absolute',
            left: 16,
            right: 16,
            top: 18,
            bottom: 16,
            resize: 'none',
            border: selected ? '1px dashed rgba(73,182,229,.55)' : '1px solid transparent',
            borderRadius: 8,
            background: selected ? (dark ? 'rgba(13,27,46,.28)' : 'rgba(255,255,255,.28)') : 'transparent',
            color: dark ? '#F0EEE8' : '#263D5B',
            fontFamily: "'Delius', cursive",
            fontSize: Math.max(13, Math.min(18, width / 42)),
            lineHeight: 1.55,
            padding: 12,
            outline: 'none',
            zIndex: 4,
            opacity: selected || frame.notes ? 1 : 0,
            transition: 'opacity .12s, border-color .12s, background .12s',
          }}
        />
      )}

      <div
        className="no-drag"
        onMouseDown={e => { e.stopPropagation(); e.preventDefault(); onResizeStart(id, e) }}
        title="Drag to resize"
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

function CustomFrameworkSurface({ frame, dark }: { frame: FrameInstance; dark: boolean }) {
  return <FrameworkLayoutSurface template={frame.customFramework!} dark={dark} width={frame.width} />
}

// ── Shared style helpers ──────────────────────────────────────────────────────

const NAVY       = '#263D5B'
const NAVY_ALPHA = 'rgba(38,61,91,0.15)'
const PRIMARY    = '#49B6E5'
const FONT       = "'Delius Swash Caps', cursive"

// Returns a scale factor relative to the framework's default size.
// Clamped so text never gets smaller than half or larger than 4× the default.
const scaleOf = (w: number, h: number, dw: number, dh: number) =>
  Math.max(0.5, Math.min(4, Math.sqrt((w / dw) * (h / dh))))

const s = (base: number, sc: number) => Math.round(base * sc)

const shell = (width: number, height: number, dark: boolean): React.CSSProperties => ({
  width, height,
  border: `2.5px solid ${NAVY}`,
  borderRadius: 8,
  boxShadow: '3px 3px 0 rgba(38,61,91,0.2)',
  overflow: 'hidden',
  background: dark ? '#152336' : 'white',
  display: 'flex',
  flexDirection: 'column',
  fontFamily: FONT,
})

const header = (label: string, sc = 1, extra?: React.ReactNode): React.ReactElement => (
  <div style={{ height: s(28, sc), background: NAVY, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, gap: 10 }}>
    <span style={{ fontSize: s(10, sc), letterSpacing: '0.1em', color: 'rgba(255,255,255,0.85)' }}>{label}</span>
    {extra}
  </div>
)

// ── Eisenhower Matrix ─────────────────────────────────────────────────────────

function EisenhowerMatrix({ width, height, dark }: { width: number; height: number; dark: boolean }) {
  const sc       = scaleOf(width, height, 640, 540)
  const HEADER_H = s(28, sc)
  const LABEL_W  = s(90, sc)
  const bodyH    = Math.max(0, height - HEADER_H)

  return (
    <div style={shell(width, height, dark)}>
      <div style={{ height: HEADER_H, background: NAVY, display: 'flex', flexShrink: 0 }}>
        <div style={{ width: LABEL_W, borderRight: '2px solid rgba(255,255,255,0.2)', flexShrink: 0 }} />
        {['URGENT', 'NOT URGENT'].map((label, i) => (
          <div key={label} style={{
            flex: 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: s(9, sc), letterSpacing: '0.05em', color: 'rgba(255,255,255,0.85)',
            borderRight: i === 0 ? '1.5px solid rgba(255,255,255,0.15)' : 'none',
          }}>
            {label}
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', height: bodyH, overflow: 'hidden' }}>
        <div style={{ width: LABEL_W, display: 'flex', flexDirection: 'column', borderRight: `2px solid ${NAVY}`, flexShrink: 0 }}>
          {['IMPORTANT', 'NOT IMPORTANT'].map((label, i) => (
            <div key={label} style={{
              flex: 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: s(9, sc), letterSpacing: '0.05em',
              color: dark ? 'rgba(255,255,255,0.4)' : 'rgba(38,61,91,0.55)',
              writingMode: 'vertical-lr',
              transform: 'rotate(180deg)',
              borderBottom: i === 0 ? `1.5px solid ${NAVY_ALPHA}` : 'none',
            }}>
              {label}
            </div>
          ))}
        </div>
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr' }}>
          {(['Do First', 'Schedule', 'Delegate', 'Eliminate'] as const).map((label, i) => (
            <div key={label} style={{
              padding: s(10, sc),
              borderRight:  (i === 0 || i === 2) ? `1.5px solid ${NAVY_ALPHA}` : 'none',
              borderBottom: (i === 0 || i === 1) ? `1.5px solid ${NAVY_ALPHA}` : 'none',
              background: dark ? 'rgba(38,61,91,0.05)' : 'transparent',
            }}>
              <div style={{ fontSize: s(10, sc), color: dark ? 'rgba(255,255,255,0.25)' : 'rgba(38,61,91,0.4)', fontStyle: 'italic' }}>
                {label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── OODA Loop ─────────────────────────────────────────────────────────────────

function OodaLoop({ width, height, dark }: { width: number; height: number; dark: boolean }) {
  const sc       = scaleOf(width, height, 720, 220)
  const HEADER_H = s(28, sc)
  const cols     = ['OBSERVE', 'ORIENT', 'DECIDE', 'ACT']
  const bodyH    = Math.max(0, height - HEADER_H)

  return (
    <div style={shell(width, height, dark)}>
      <div style={{ height: HEADER_H, background: NAVY, display: 'flex', flexShrink: 0 }}>
        {cols.map((label, i) => (
          <div key={label} style={{
            flex: 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: s(9, sc), letterSpacing: '0.05em', color: 'rgba(255,255,255,0.85)',
            borderRight: i < 3 ? '1.5px solid rgba(255,255,255,0.15)' : 'none',
          }}>
            {label}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', height: bodyH, position: 'relative' }}>
        {cols.map((label, i) => (
          <div key={label} style={{
            flex: 1,
            position: 'relative',
            borderRight: i < 3 ? `1.5px solid rgba(38,61,91,0.15)` : 'none',
            background: dark ? 'rgba(38,61,91,0.05)' : 'transparent',
            overflow: 'hidden',
          }}>
            <div style={{
              position: 'absolute', bottom: 8, left: 0, right: 0,
              textAlign: 'center', fontSize: s(32, sc),
              color: dark ? 'rgba(255,255,255,0.04)' : 'rgba(38,61,91,0.06)',
              pointerEvents: 'none', userSelect: 'none', lineHeight: 1,
            }}>
              {label}
            </div>
            {i < 3 && (
              <div style={{
                position: 'absolute', right: -9, top: '50%',
                transform: 'translateY(-50%)',
                fontSize: s(12, sc), color: PRIMARY, pointerEvents: 'none', lineHeight: 1,
              }}>
                ›
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Ikigai ────────────────────────────────────────────────────────────────────

function IkigaiDiagram({ width, height, dark }: { width: number; height: number; dark: boolean }) {
  const sc       = scaleOf(width, height, 520, 520)
  const HEADER_H = s(28, sc)
  const svgH = height - HEADER_H
  const cx = width / 2
  const cy = svgH / 2
  const r  = Math.min(width, svgH) * 0.28
  const off = r * 0.6
  const tc = dark ? 'rgba(255,255,255,0.5)' : 'rgba(38,61,91,0.6)'

  const circles = [
    { dx: 0,    dy: -1, fill: 'rgba(232,100,100,0.15)', label: 'LOVE',        sub: 'passion' },
    { dx: 1,    dy:  0, fill: 'rgba(73,182,229,0.15)',  label: 'GOOD AT',     sub: 'profession' },
    { dx: 0,    dy:  1, fill: 'rgba(100,200,130,0.15)', label: 'WORLD NEEDS', sub: 'mission' },
    { dx: -1,   dy:  0, fill: 'rgba(255,190,80,0.15)',  label: 'PAID FOR',    sub: 'vocation' },
  ]

  return (
    <div style={shell(width, height, dark)}>
      {header('IKIGAI — REASON FOR BEING', sc)}
      <svg width={width} height={svgH}>
        {circles.map((c, i) => (
          <circle key={i} cx={cx + c.dx * off} cy={cy + c.dy * off} r={r}
            fill={c.fill} stroke={NAVY} strokeWidth={1.5} strokeOpacity={0.3} />
        ))}

        {/* Center label */}
        <text x={cx} y={cy - 5} textAnchor="middle" fontSize={s(10, sc)} fontStyle="italic"
          fill={tc} fontFamily={FONT}>IKIGAI</text>
        <text x={cx} y={cy + s(9, sc)} textAnchor="middle" fontSize={s(8, sc)}
          fill={tc} fontFamily={FONT}>✦</text>

        {/* Outer labels */}
        {circles.map((c, i) => {
          const lx = cx + c.dx * (off + r * 0.72)
          const ly = cy + c.dy * (off + r * 0.72)
          return (
            <g key={`lbl-${i}`}>
              <text x={lx} y={ly - 5} textAnchor="middle" fontSize={s(9, sc)}
                fill={tc} fontFamily={FONT}>{c.label}</text>
              <text x={lx} y={ly + s(8, sc)} textAnchor="middle" fontSize={s(7, sc)} fontStyle="italic"
                fill={tc} fontFamily={FONT}>{c.sub}</text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

// ── Wheel of Life ─────────────────────────────────────────────────────────────

function WheelOfLife({ width, height, dark }: { width: number; height: number; dark: boolean }) {
  const sc       = scaleOf(width, height, 500, 520)
  const HEADER_H = s(28, sc)
  const svgH = height - HEADER_H
  const cx = width * 0.20
  const cy = svgH / 2
  const r  = Math.min(width * 0.18, cy * 0.62)
  const tc = dark ? 'rgba(255,255,255,0.55)' : 'rgba(38,61,91,0.65)'

  const colors = ['rgba(73,182,229,0.22)', 'rgba(100,200,130,0.22)', 'rgba(232,100,100,0.22)', 'rgba(255,190,80,0.22)', 'rgba(200,120,200,0.22)', 'rgba(73,182,229,0.22)', 'rgba(100,200,130,0.22)', 'rgba(232,190,100,0.22)']
  const segments = FRAMEWORK_REGISTRY['wheel-of-life'].sections.map((section, i) => ({ label: section.label, color: colors[i] }))

  const toRad = (d: number) => (d * Math.PI) / 180
  const n = segments.length
  const step = 360 / n

  const segPath = (i: number) => {
    const a1 = toRad(-90 + i * step)
    const a2 = toRad(-90 + (i + 1) * step)
    const x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1)
    const x2 = cx + r * Math.cos(a2), y2 = cy + r * Math.sin(a2)
    return `M${cx},${cy} L${x1},${y1} A${r},${r} 0 0,1 ${x2},${y2} Z`
  }

  return (
    <div style={shell(width, height, dark)}>
      {header('WHEEL OF LIFE', sc)}
      <svg width={width} height={svgH}>
        {/* Filled segments */}
        {segments.map((seg, i) => (
          <path key={i} d={segPath(i)} fill={seg.color} stroke={NAVY} strokeWidth={1} strokeOpacity={0.2} />
        ))}

        {/* Concentric scoring rings */}
        {[0.2, 0.4, 0.6, 0.8].map(sv => (
          <circle key={sv} cx={cx} cy={cy} r={r * sv} fill="none"
            stroke={NAVY} strokeWidth={0.5} strokeOpacity={0.15} strokeDasharray="3 3" />
        ))}

        {/* Outer ring */}
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={NAVY} strokeWidth={1.5} strokeOpacity={0.35} />

        {/* Center score hint */}
        <text x={cx} y={cy + 4} textAnchor="middle" dominantBaseline="middle"
          fontSize={s(8, sc)} fill={tc} fontFamily={FONT}>1 – 10</text>

        {/* Segment labels */}
        {segments.map((seg, i) => {
          const mid = toRad(-90 + (i + 0.5) * step)
          const labelR = r * 0.8
          const lx = cx + labelR * Math.cos(mid)
          const ly = cy + labelR * Math.sin(mid)
          return (
            <text key={`lbl-${i}`} x={lx} y={ly} textAnchor="middle"
              dominantBaseline="middle" fontSize={s(8, sc)} fill={tc} fontFamily={FONT}>
              {seg.label}
            </text>
          )
        })}
      </svg>
    </div>
  )
}

// ── GROW Model ────────────────────────────────────────────────────────────────

function GrowModel({ width, height, dark }: { width: number; height: number; dark: boolean }) {
  const sc       = scaleOf(width, height, 640, 540)
  const HEADER_H = s(28, sc)
  const bodyH = height - HEADER_H
  const tc = dark ? 'rgba(255,255,255,0.45)' : 'rgba(38,61,91,0.55)'

  const quadrants = [
    { letter: 'G', name: 'Goal',    prompt: 'What do you want to achieve?', bg: 'rgba(73,182,229,0.06)' },
    { letter: 'R', name: 'Reality', prompt: 'Where are you now?',           bg: 'rgba(100,200,130,0.06)' },
    { letter: 'O', name: 'Options', prompt: 'What could you do?',           bg: 'rgba(255,190,80,0.06)' },
    { letter: 'W', name: 'Will',    prompt: 'What WILL you do?',            bg: 'rgba(232,100,100,0.06)' },
  ]

  return (
    <div style={shell(width, height, dark)}>
      {header('GROW MODEL — A COACHING FRAMEWORK', sc)}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', height: bodyH }}>
        {quadrants.map(({ letter, name, prompt, bg }, i) => (
          <div key={letter} style={{
            padding: `${s(12, sc)}px ${s(14, sc)}px`,
            borderRight:  i % 2 === 0 ? `1.5px solid ${NAVY_ALPHA}` : 'none',
            borderBottom: i < 2       ? `1.5px solid ${NAVY_ALPHA}` : 'none',
            background: bg,
          }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: s(6, sc), marginBottom: s(4, sc) }}>
              <span style={{ fontSize: s(24, sc), fontWeight: 700, color: dark ? 'rgba(255,255,255,0.12)' : 'rgba(38,61,91,0.12)' }}>{letter}</span>
              <span style={{ fontSize: s(12, sc), fontWeight: 600, color: tc }}>{name}</span>
            </div>
            <div style={{ fontSize: s(9, sc), color: dark ? 'rgba(255,255,255,0.2)' : 'rgba(38,61,91,0.3)', fontStyle: 'italic' }}>{prompt}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── SMART Goals ───────────────────────────────────────────────────────────────

function SmartGoals({ width, height, dark }: { width: number; height: number; dark: boolean }) {
  const sc       = scaleOf(width, height, 800, 220)
  const HEADER_H = s(28, sc)
  const bodyH = height - HEADER_H
  const tc = dark ? 'rgba(255,255,255,0.45)' : 'rgba(38,61,91,0.55)'

  const cols = [
    { letter: 'S', word: 'Specific',    desc: 'Clear & well-defined' },
    { letter: 'M', word: 'Measurable',  desc: 'Track your progress' },
    { letter: 'A', word: 'Achievable',  desc: 'Realistic & attainable' },
    { letter: 'R', word: 'Relevant',    desc: 'Aligned to your goals' },
    { letter: 'T', word: 'Time-Bound',  desc: 'Has a deadline' },
  ]

  return (
    <div style={shell(width, height, dark)}>
      <div style={{ height: HEADER_H, background: NAVY, display: 'flex', flexShrink: 0 }}>
        {cols.map((col, i) => (
          <div key={col.letter} style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: s(13, sc), fontWeight: 700, letterSpacing: '0.05em', color: 'rgba(255,255,255,0.85)',
            borderRight: i < 4 ? '1.5px solid rgba(255,255,255,0.15)' : 'none',
            fontFamily: FONT,
          }}>
            {col.letter}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', height: bodyH }}>
        {cols.map((col, i) => (
          <div key={col.letter} style={{
            flex: 1, padding: `${s(10, sc)}px ${s(8, sc)}px`,
            borderRight: i < 4 ? `1.5px solid ${NAVY_ALPHA}` : 'none',
            background: dark ? 'rgba(38,61,91,0.05)' : 'transparent',
            overflow: 'hidden',
          }}>
            <div style={{ fontSize: s(10, sc), fontWeight: 700, color: tc, marginBottom: s(3, sc) }}>{col.word}</div>
            <div style={{ fontSize: s(8, sc), color: dark ? 'rgba(255,255,255,0.2)' : 'rgba(38,61,91,0.3)', fontStyle: 'italic' }}>{col.desc}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Start / Stop / Continue ───────────────────────────────────────────────────

function StartStopContinue({ width, height, dark }: { width: number; height: number; dark: boolean }) {
  const sc       = scaleOf(width, height, 720, 400)
  const HEADER_H = s(28, sc)
  const bodyH = height - HEADER_H

  const cols = [
    { label: 'START',    desc: 'New habits to adopt',   accent: '#2D9E5F', bg: 'rgba(100,200,130,0.12)' },
    { label: 'STOP',     desc: 'Habits to let go of',   accent: '#C0392B', bg: 'rgba(232,100,100,0.12)' },
    { label: 'CONTINUE', desc: 'Habits that are working', accent: '#2980B9', bg: 'rgba(73,182,229,0.12)' },
  ]

  return (
    <div style={shell(width, height, dark)}>
      {header('START · STOP · CONTINUE', sc)}
      <div style={{ display: 'flex', height: bodyH }}>
        {cols.map((col, i) => (
          <div key={col.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', borderRight: i < 2 ? `1.5px solid ${NAVY_ALPHA}` : 'none' }}>
            <div style={{ padding: `${s(7, sc)}px ${s(10, sc)}px`, background: col.bg, borderBottom: `1px solid ${NAVY_ALPHA}` }}>
              <div style={{ fontSize: s(10, sc), fontWeight: 700, color: col.accent }}>{col.label}</div>
              <div style={{ fontSize: s(8, sc), color: dark ? 'rgba(255,255,255,0.25)' : 'rgba(38,61,91,0.4)', fontStyle: 'italic', marginTop: s(1, sc) }}>{col.desc}</div>
            </div>
            <div style={{ flex: 1, background: dark ? 'rgba(38,61,91,0.04)' : 'transparent' }} />
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Personal Kanban ───────────────────────────────────────────────────────────

function PersonalKanban({ width, height, dark }: { width: number; height: number; dark: boolean }) {
  const sc       = scaleOf(width, height, 720, 400)
  const HEADER_H = s(28, sc)
  const bodyH = height - HEADER_H
  const tc = dark ? 'rgba(255,255,255,0.45)' : 'rgba(38,61,91,0.55)'

  const cols = [
    { label: 'BACKLOG',      desc: 'Tasks queued up',     bg: 'rgba(120,120,120,0.06)' },
    { label: 'IN PROGRESS',  desc: 'WIP limit: 1 – 3',    bg: 'rgba(73,182,229,0.08)' },
    { label: 'DONE',         desc: 'Completed ✓',         bg: 'rgba(100,200,130,0.08)' },
  ]

  return (
    <div style={shell(width, height, dark)}>
      {header('PERSONAL KANBAN', sc)}
      <div style={{ display: 'flex', height: bodyH }}>
        {cols.map((col, i) => (
          <div key={col.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', borderRight: i < 2 ? `1.5px solid ${NAVY_ALPHA}` : 'none', background: col.bg }}>
            <div style={{ padding: `${s(7, sc)}px ${s(10, sc)}px`, borderBottom: `1px solid ${NAVY_ALPHA}` }}>
              <div style={{ fontSize: s(10, sc), fontWeight: 700, color: tc }}>{col.label}</div>
              <div style={{ fontSize: s(8, sc), color: dark ? 'rgba(255,255,255,0.2)' : 'rgba(38,61,91,0.3)', fontStyle: 'italic', marginTop: s(1, sc) }}>{col.desc}</div>
            </div>
            <div style={{ flex: 1 }} />
          </div>
        ))}
      </div>
    </div>
  )
}

// ── 5 Whys ────────────────────────────────────────────────────────────────────

function FiveWhys({ width, height, dark }: { width: number; height: number; dark: boolean }) {
  const sc     = scaleOf(width, height, 640, 380)
  const tc = dark ? 'rgba(255,255,255,0.45)' : 'rgba(38,61,91,0.55)'
  const border = `1px solid ${NAVY_ALPHA}`

  return (
    <div style={shell(width, height, dark)}>
      {header('5 WHYS — ROOT CAUSE ANALYSIS', sc)}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: `${s(10, sc)}px ${s(16, sc)}px`, gap: 0 }}>
        {/* Problem row */}
        <div style={{ padding: `${s(8, sc)}px 0`, borderBottom: `1.5px solid ${NAVY_ALPHA}` }}>
          <span style={{ fontSize: s(9, sc), fontWeight: 700, color: tc, letterSpacing: '0.06em' }}>PROBLEM STATEMENT</span>
        </div>

        {/* 5 why rows */}
        {[1, 2, 3, 4, 5].map(n => (
          <div key={n} style={{ display: 'flex', alignItems: 'center', gap: s(10, sc), padding: `${s(7, sc)}px 0`, borderBottom: n < 5 ? border : 'none' }}>
            <span style={{ fontSize: s(13, sc), color: PRIMARY, lineHeight: 1, flexShrink: 0 }}>↓</span>
            <span style={{ fontSize: s(9, sc), color: tc, fontStyle: 'italic' }}>Why {n}?</span>
          </div>
        ))}

        {/* Root cause */}
        <div style={{ padding: `${s(8, sc)}px 0`, borderTop: `1.5px solid ${NAVY_ALPHA}`, marginTop: s(4, sc) }}>
          <span style={{ fontSize: s(9, sc), fontWeight: 700, color: PRIMARY, letterSpacing: '0.06em' }}>✦ ROOT CAUSE</span>
        </div>
      </div>
    </div>
  )
}

// ── Daily Reflection ──────────────────────────────────────────────────────────

function DailyReflection({ width, height, dark }: { width: number; height: number; dark: boolean }) {
  const sc = scaleOf(width, height, 640, 540)

  const sections = [
    { label: 'GRATEFUL FOR',        prompt: '3 things I appreciate…',            bg: 'rgba(255,190,80,0.08)' },
    { label: "TODAY'S FOCUS",        prompt: 'My top priority today…',            bg: 'rgba(73,182,229,0.08)' },
    { label: 'WINS & PROGRESS',      prompt: 'What went well…',                   bg: 'rgba(100,200,130,0.08)' },
    { label: 'LESSONS LEARNED',      prompt: 'What I would do differently…',      bg: 'rgba(232,100,100,0.08)' },
    { label: "TOMORROW'S INTENTION", prompt: 'One thing to focus on tomorrow…',   bg: 'rgba(200,120,200,0.08)' },
  ]

  return (
    <div style={shell(width, height, dark)}>
      {header('DAILY REFLECTION', sc)}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {sections.map((sec, i) => (
          <div key={sec.label} style={{
            flex: 1, padding: `${s(6, sc)}px ${s(14, sc)}px`,
            background: sec.bg,
            borderBottom: i < sections.length - 1 ? `1px solid ${NAVY_ALPHA}` : 'none',
            display: 'flex', flexDirection: 'column', justifyContent: 'center',
          }}>
            <div style={{ fontSize: s(9, sc), fontWeight: 700, color: dark ? 'rgba(255,255,255,0.5)' : 'rgba(38,61,91,0.65)', letterSpacing: '0.05em' }}>{sec.label}</div>
            <div style={{ fontSize: s(8, sc), color: dark ? 'rgba(255,255,255,0.2)' : 'rgba(38,61,91,0.3)', fontStyle: 'italic', marginTop: s(2, sc) }}>{sec.prompt}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── OKR ───────────────────────────────────────────────────────────────────────

function OKRFramework({ width, height, dark }: { width: number; height: number; dark: boolean }) {
  const sc       = scaleOf(width, height, 640, 440)
  const HEADER_H = s(28, sc)
  const bodyH    = height - HEADER_H
  const OBJ_H    = Math.round(bodyH * 0.38)
  const KR_H     = bodyH - OBJ_H
  const tc = dark ? 'rgba(255,255,255,0.4)' : 'rgba(38,61,91,0.5)'

  return (
    <div style={shell(width, height, dark)}>
      {header('OKR — OBJECTIVES & KEY RESULTS', sc)}

      {/* Objective */}
      <div style={{ height: OBJ_H, padding: `${s(10, sc)}px ${s(14, sc)}px`, borderBottom: `2px solid ${NAVY_ALPHA}`, background: dark ? 'rgba(73,182,229,0.04)' : 'rgba(73,182,229,0.03)', flexShrink: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div style={{ fontSize: s(10, sc), fontWeight: 700, color: PRIMARY, letterSpacing: '0.05em', marginBottom: s(4, sc) }}>OBJECTIVE</div>
        <div style={{ fontSize: s(8, sc), color: tc, fontStyle: 'italic' }}>What do you want to achieve?</div>
      </div>

      {/* Key Results */}
      <div style={{ display: 'flex', height: KR_H }}>
        {[1, 2, 3].map(n => (
          <div key={n} style={{
            flex: 1, padding: `${s(10, sc)}px ${s(12, sc)}px`,
            borderRight: n < 3 ? `1.5px solid ${NAVY_ALPHA}` : 'none',
            background: dark ? 'rgba(38,61,91,0.04)' : 'transparent',
            display: 'flex', flexDirection: 'column', justifyContent: 'flex-start',
          }}>
            <div style={{ fontSize: s(9, sc), fontWeight: 700, color: tc, letterSpacing: '0.05em', marginBottom: s(3, sc) }}>KEY RESULT {n}</div>
            <div style={{ fontSize: s(8, sc), color: dark ? 'rgba(255,255,255,0.18)' : 'rgba(38,61,91,0.28)', fontStyle: 'italic' }}>Measurable outcome…</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Energy Audit ──────────────────────────────────────────────────────────────

function EnergyAudit({ width, height, dark }: { width: number; height: number; dark: boolean }) {
  const sc       = scaleOf(width, height, 640, 540)
  const HEADER_H = s(28, sc)
  const LABEL_W  = s(90, sc)
  const bodyH    = Math.max(0, height - HEADER_H)

  return (
    <div style={shell(width, height, dark)}>
      <div style={{ height: HEADER_H, background: NAVY, display: 'flex', flexShrink: 0 }}>
        <div style={{ width: LABEL_W, borderRight: '2px solid rgba(255,255,255,0.2)', flexShrink: 0 }} />
        {['POSITIVE', 'NEGATIVE'].map((label, i) => (
          <div key={label} style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: s(9, sc), letterSpacing: '0.05em', color: 'rgba(255,255,255,0.85)',
            borderRight: i === 0 ? '1.5px solid rgba(255,255,255,0.15)' : 'none',
          }}>
            {label}
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', height: bodyH, overflow: 'hidden' }}>
        {/* Row labels */}
        <div style={{ width: LABEL_W, display: 'flex', flexDirection: 'column', borderRight: `2px solid ${NAVY}`, flexShrink: 0 }}>
          {['HIGH ENERGY', 'LOW ENERGY'].map((label, i) => (
            <div key={label} style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: s(9, sc), letterSpacing: '0.05em',
              color: dark ? 'rgba(255,255,255,0.4)' : 'rgba(38,61,91,0.55)',
              writingMode: 'vertical-lr', transform: 'rotate(180deg)',
              borderBottom: i === 0 ? `1.5px solid ${NAVY_ALPHA}` : 'none',
            }}>
              {label}
            </div>
          ))}
        </div>

        {/* 2×2 grid */}
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr' }}>
          {([
            { label: 'Flow',    sub: 'Peak performance', bg: 'rgba(100,200,130,0.10)' },
            { label: 'Stress',  sub: 'Pressure zone',    bg: 'rgba(255,190,80,0.10)' },
            { label: 'Rest',    sub: 'Recharge zone',    bg: 'rgba(73,182,229,0.10)' },
            { label: 'Burnout', sub: 'Danger zone',      bg: 'rgba(232,100,100,0.10)' },
          ] as const).map(({ label, sub, bg }, i) => (
            <div key={label} style={{
              padding: s(10, sc),
              borderRight:  (i === 0 || i === 2) ? `1.5px solid ${NAVY_ALPHA}` : 'none',
              borderBottom: (i === 0 || i === 1) ? `1.5px solid ${NAVY_ALPHA}` : 'none',
              background: bg,
            }}>
              <div style={{ fontSize: s(11, sc), fontStyle: 'italic', color: dark ? 'rgba(255,255,255,0.35)' : 'rgba(38,61,91,0.5)' }}>{label}</div>
              <div style={{ fontSize: s(8, sc), color: dark ? 'rgba(255,255,255,0.15)' : 'rgba(38,61,91,0.3)', marginTop: s(2, sc) }}>{sub}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Eat That Frog ─────────────────────────────────────────────────────────────

function EatThatFrog({ width, height, dark }: { width: number; height: number; dark: boolean }) {
  const sc    = scaleOf(width, height, 580, 440)
  const tasks = ['#1 Frog (Most Important)', '#2 Task', '#3 Task', '#4 Task', '#5 Task']
  return (
    <div style={shell(width, height, dark)}>
      {header('EAT THAT FROG', sc)}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: s(6, sc), padding: s(12, sc), overflowY: 'auto' }}>
        {tasks.map((label, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: s(8, sc),
            padding: `${s(6, sc)}px ${s(10, sc)}px`,
            background: i === 0 ? NAVY_ALPHA : (dark ? 'rgba(255,255,255,0.04)' : 'rgba(38,61,91,0.04)'),
            border: `1.5px solid ${i === 0 ? NAVY : (dark ? 'rgba(255,255,255,0.08)' : 'rgba(38,61,91,0.1)')}`,
            borderRadius: 6,
          }}>
            <span style={{ fontSize: s(11, sc), fontWeight: i === 0 ? 700 : 400, color: dark ? 'rgba(255,255,255,0.7)' : NAVY, fontFamily: FONT }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── GTD (Getting Things Done) ─────────────────────────────────────────────────

function GTD({ width, height, dark }: { width: number; height: number; dark: boolean }) {
  const sc      = scaleOf(width, height, 840, 260)
  const buckets = ['INBOX', 'NEXT ACTIONS', 'PROJECTS', 'WAITING FOR', 'SOMEDAY']
  const colW = Math.floor((width - 2) / buckets.length)
  return (
    <div style={shell(width, height, dark)}>
      {header('GETTING THINGS DONE', sc)}
      <div style={{ flex: 1, display: 'flex' }}>
        {buckets.map((label, i) => (
          <div key={label} style={{
            width: colW, flexShrink: 0,
            borderRight: i < buckets.length - 1 ? `1.5px solid ${dark ? 'rgba(255,255,255,0.08)' : 'rgba(38,61,91,0.1)'}` : 'none',
            display: 'flex', flexDirection: 'column',
          }}>
            <div style={{ padding: `${s(6, sc)}px ${s(8, sc)}px`, borderBottom: `1px solid ${dark ? 'rgba(255,255,255,0.08)' : 'rgba(38,61,91,0.1)'}` }}>
              <span style={{ fontSize: s(8, sc), letterSpacing: '0.06em', color: dark ? 'rgba(255,255,255,0.45)' : 'rgba(38,61,91,0.55)', fontFamily: FONT }}>{label}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function ColumnFramework({ width, height, dark, title, labels }: { width: number; height: number; dark: boolean; title: string; labels: string[] }) {
  const sc = scaleOf(width, height, 720, 400)
  return (
    <div style={shell(width, height, dark)}>
      {header(title, sc)}
      <div style={{ flex: 1, display: 'flex' }}>
        {labels.map((label, i) => (
          <div key={label} style={{ flex: 1, borderRight: i < labels.length - 1 ? `1.5px solid ${NAVY_ALPHA}` : 'none' }}>
            <div style={{ padding: `${s(8, sc)}px ${s(10, sc)}px`, borderBottom: `1px solid ${NAVY_ALPHA}`, color: dark ? 'rgba(255,255,255,.55)' : 'rgba(38,61,91,.62)', fontSize: s(10, sc), fontWeight: 700 }}>
              {label}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function STPMarketing(props: { width: number; height: number; dark: boolean }) {
  return <ColumnFramework {...props} title="STP MARKETING" labels={['SEGMENTATION', 'TARGETING', 'POSITIONING']} />
}

function MarketingMix({ width, height, dark }: { width: number; height: number; dark: boolean }) {
  const sc = scaleOf(width, height, 720, 400)
  return (
    <div style={shell(width, height, dark)}>
      {header('4P MARKETING MIX', sc)}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr' }}>
        {['PRODUCT', 'PRICE', 'PLACE', 'PROMOTION'].map((label, i) => (
          <div key={label} style={{ padding: s(12, sc), borderRight: i % 2 === 0 ? `1.5px solid ${NAVY_ALPHA}` : 'none', borderBottom: i < 2 ? `1.5px solid ${NAVY_ALPHA}` : 'none' }}>
            <div style={{ color: dark ? 'rgba(255,255,255,.55)' : 'rgba(38,61,91,.62)', fontSize: s(11, sc), fontWeight: 700 }}>{label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function AIDAFunnel({ width, height, dark }: { width: number; height: number; dark: boolean }) {
  const sc = scaleOf(width, height, 560, 520)
  return (
    <div style={shell(width, height, dark)}>
      {header('AIDA FUNNEL', sc)}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-around', padding: s(16, sc) }}>
        {[
          ['ATTENTION', '82%'],
          ['INTEREST', '68%'],
          ['DESIRE', '54%'],
          ['ACTION', '40%'],
        ].map(([label, w]) => (
          <div key={label} style={{ width: w, height: '18%', border: `1.5px solid ${NAVY_ALPHA}`, background: dark ? 'rgba(73,182,229,.08)' : 'rgba(73,182,229,.10)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: dark ? 'rgba(255,255,255,.55)' : 'rgba(38,61,91,.62)', fontSize: s(11, sc), fontWeight: 700 }}>
            {label}
          </div>
        ))}
      </div>
    </div>
  )
}

function SWOTAnalysis({ width, height, dark }: { width: number; height: number; dark: boolean }) {
  const sc = scaleOf(width, height, 640, 540)
  return (
    <div style={shell(width, height, dark)}>
      {header('SWOT ANALYSIS', sc)}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr' }}>
        {['STRENGTHS', 'WEAKNESSES', 'OPPORTUNITIES', 'THREATS'].map((label, i) => (
          <div key={label} style={{ padding: s(12, sc), borderRight: i % 2 === 0 ? `1.5px solid ${NAVY_ALPHA}` : 'none', borderBottom: i < 2 ? `1.5px solid ${NAVY_ALPHA}` : 'none', background: i === 0 || i === 2 ? 'rgba(100,200,130,.07)' : 'rgba(232,100,100,.07)' }}>
            <div style={{ color: dark ? 'rgba(255,255,255,.55)' : 'rgba(38,61,91,.62)', fontSize: s(11, sc), fontWeight: 700 }}>{label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function CustomerJourney(props: { width: number; height: number; dark: boolean }) {
  return <ColumnFramework {...props} title="CUSTOMER JOURNEY" labels={['AWARENESS', 'CONSIDERATION', 'PURCHASE', 'ONBOARDING', 'RETENTION']} />
}

function FirstPrinciples({ width, height, dark }: { width: number; height: number; dark: boolean }) {
  const sc = scaleOf(width, height, 700, 440)
  return (
    <div style={shell(width, height, dark)}>
      {header('FIRST PRINCIPLES THINKING', sc)}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1.15fr' }}>
        {['ASSUMPTIONS', 'KNOWN TRUTHS', 'REBUILD FROM BASICS'].map((label, i) => (
          <div key={label} style={{ gridColumn: i === 2 ? '1 / 3' : undefined, padding: s(12, sc), borderRight: i === 0 ? `1.5px solid ${NAVY_ALPHA}` : 'none', borderBottom: i < 2 ? `1.5px solid ${NAVY_ALPHA}` : 'none' }}>
            <div style={{ color: dark ? 'rgba(255,255,255,.55)' : 'rgba(38,61,91,.62)', fontSize: s(11, sc), fontWeight: 700 }}>{label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function SixThinkingHats(props: { width: number; height: number; dark: boolean }) {
  return <ColumnFramework {...props} title="SIX THINKING HATS" labels={['WHITE FACTS', 'RED FEELINGS', 'BLACK RISKS', 'YELLOW BENEFITS', 'GREEN IDEAS', 'BLUE PROCESS']} />
}

function SCAMPERFramework(props: { width: number; height: number; dark: boolean }) {
  return <ColumnFramework {...props} title="SCAMPER" labels={['SUBSTITUTE', 'COMBINE', 'ADAPT', 'MODIFY', 'PUT TO USE', 'ELIMINATE', 'REVERSE']} />
}

function ProsCons(props: { width: number; height: number; dark: boolean }) {
  return <ColumnFramework {...props} title="PROS / CONS" labels={['PROS', 'CONS']} />
}

function ImpactEffort({ width, height, dark }: { width: number; height: number; dark: boolean }) {
  const sc = scaleOf(width, height, 640, 540)
  return (
    <div style={shell(width, height, dark)}>
      <div style={{ height: s(28, sc), background: NAVY, display: 'flex', flexShrink: 0 }}>
        <div style={{ width: s(90, sc), borderRight: '2px solid rgba(255,255,255,.2)' }} />
        {['LOW EFFORT', 'HIGH EFFORT'].map((label, i) => <div key={label} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: s(9, sc), color: 'rgba(255,255,255,.85)', borderRight: i === 0 ? '1.5px solid rgba(255,255,255,.15)' : 'none' }}>{label}</div>)}
      </div>
      <div style={{ flex: 1, display: 'flex' }}>
        <div style={{ width: s(90, sc), display: 'flex', flexDirection: 'column', borderRight: `2px solid ${NAVY}` }}>
          {['HIGH IMPACT', 'LOW IMPACT'].map((label, i) => <div key={label} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', writingMode: 'vertical-lr', transform: 'rotate(180deg)', fontSize: s(9, sc), color: dark ? 'rgba(255,255,255,.4)' : 'rgba(38,61,91,.55)', borderBottom: i === 0 ? `1.5px solid ${NAVY_ALPHA}` : 'none' }}>{label}</div>)}
        </div>
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr' }}>
          {['QUICK WINS', 'MAJOR PROJECTS', 'FILL-INS', 'TIME SINKS'].map((label, i) => <div key={label} style={{ padding: s(12, sc), borderRight: i % 2 === 0 ? `1.5px solid ${NAVY_ALPHA}` : 'none', borderBottom: i < 2 ? `1.5px solid ${NAVY_ALPHA}` : 'none' }}><div style={{ fontSize: s(10, sc), color: dark ? 'rgba(255,255,255,.45)' : 'rgba(38,61,91,.55)' }}>{label}</div></div>)}
        </div>
      </div>
    </div>
  )
}

export default memo(FrameworkOverlay)
