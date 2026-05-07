// src/components/FrameworkOverlay.tsx
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
      {type === 'eisenhower'        && <EisenhowerMatrix   width={width} height={height} dark={dark} />}
      {type === 'ooda'              && <OodaLoop           width={width} height={height} dark={dark} />}
      {type === 'ikigai'            && <IkigaiDiagram      width={width} height={height} dark={dark} />}
      {type === 'wheel-of-life'     && <WheelOfLife        width={width} height={height} dark={dark} />}
      {type === 'grow'              && <GrowModel          width={width} height={height} dark={dark} />}
      {type === 'smart-goals'       && <SmartGoals         width={width} height={height} dark={dark} />}
      {type === 'start-stop-continue' && <StartStopContinue width={width} height={height} dark={dark} />}
      {type === 'personal-kanban'   && <PersonalKanban     width={width} height={height} dark={dark} />}
      {type === 'five-whys'         && <FiveWhys           width={width} height={height} dark={dark} />}
      {type === 'daily-reflection'  && <DailyReflection    width={width} height={height} dark={dark} />}
      {type === 'okr'               && <OKRFramework       width={width} height={height} dark={dark} />}
      {type === 'energy-audit'      && <EnergyAudit        width={width} height={height} dark={dark} />}
      {type === 'eat-that-frog'     && <EatThatFrog        width={width} height={height} dark={dark} />}
      {type === 'gtd'               && <GTD                width={width} height={height} dark={dark} />}

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

// ── Shared style helpers ──────────────────────────────────────────────────────

const NAVY       = '#263D5B'
const NAVY_ALPHA = 'rgba(38,61,91,0.15)'
const PRIMARY    = '#49B6E5'
const FONT       = "'Delius Swash Caps', cursive"

const shell = (width: number, height: number, dark: boolean): React.CSSProperties => ({
  width, height,
  border: `2.5px solid ${NAVY}`,
  borderRadius: 8,
  boxShadow: '3px 3px 0 rgba(38,61,91,0.2)',
  overflow: 'hidden',
  background: dark ? '#1A1A24' : 'white',
  display: 'flex',
  flexDirection: 'column',
  fontFamily: FONT,
})

const header = (label: string, extra?: React.ReactNode): React.ReactElement => (
  <div style={{ height: 28, background: NAVY, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, gap: 10 }}>
    <span style={{ fontSize: 10, letterSpacing: '0.1em', color: 'rgba(255,255,255,0.85)' }}>{label}</span>
    {extra}
  </div>
)

// ── Eisenhower Matrix ─────────────────────────────────────────────────────────

function EisenhowerMatrix({ width, height, dark }: { width: number; height: number; dark: boolean }) {
  const HEADER_H  = 28
  const LABEL_W   = 90
  const bodyH     = Math.max(0, height - HEADER_H)

  return (
    <div style={shell(width, height, dark)}>
      <div style={{ height: HEADER_H, background: NAVY, display: 'flex', flexShrink: 0 }}>
        <div style={{ width: LABEL_W, borderRight: '2px solid rgba(255,255,255,0.2)', flexShrink: 0 }} />
        {['URGENT', 'NOT URGENT'].map((label, i) => (
          <div key={label} style={{
            flex: 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 9, letterSpacing: '0.05em', color: 'rgba(255,255,255,0.85)',
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
              fontSize: 9, letterSpacing: '0.05em',
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
              padding: 10,
              borderRight:  (i === 0 || i === 2) ? `1.5px solid ${NAVY_ALPHA}` : 'none',
              borderBottom: (i === 0 || i === 1) ? `1.5px solid ${NAVY_ALPHA}` : 'none',
              background: dark ? 'rgba(38,61,91,0.05)' : 'transparent',
            }}>
              <div style={{ fontSize: 10, color: dark ? 'rgba(255,255,255,0.25)' : 'rgba(38,61,91,0.4)', fontStyle: 'italic' }}>
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
  const HEADER_H = 28
  const cols     = ['OBSERVE', 'ORIENT', 'DECIDE', 'ACT']
  const bodyH    = Math.max(0, height - HEADER_H)

  return (
    <div style={shell(width, height, dark)}>
      <div style={{ height: HEADER_H, background: NAVY, display: 'flex', flexShrink: 0 }}>
        {cols.map((label, i) => (
          <div key={label} style={{
            flex: 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 9, letterSpacing: '0.05em', color: 'rgba(255,255,255,0.85)',
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
              textAlign: 'center', fontSize: 32,
              color: dark ? 'rgba(255,255,255,0.04)' : 'rgba(38,61,91,0.06)',
              pointerEvents: 'none', userSelect: 'none', lineHeight: 1,
            }}>
              {label}
            </div>
            {i < 3 && (
              <div style={{
                position: 'absolute', right: -9, top: '50%',
                transform: 'translateY(-50%)',
                fontSize: 12, color: PRIMARY, pointerEvents: 'none', lineHeight: 1,
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
  const HEADER_H = 28
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
      {header('IKIGAI — REASON FOR BEING')}
      <svg width={width} height={svgH}>
        {circles.map((c, i) => (
          <circle key={i} cx={cx + c.dx * off} cy={cy + c.dy * off} r={r}
            fill={c.fill} stroke={NAVY} strokeWidth={1.5} strokeOpacity={0.3} />
        ))}

        {/* Center label */}
        <text x={cx} y={cy - 5} textAnchor="middle" fontSize={10} fontStyle="italic"
          fill={tc} fontFamily={FONT}>IKIGAI</text>
        <text x={cx} y={cy + 9} textAnchor="middle" fontSize={8}
          fill={tc} fontFamily={FONT}>✦</text>

        {/* Outer labels */}
        {circles.map((c, i) => {
          const lx = cx + c.dx * (off + r * 0.72)
          const ly = cy + c.dy * (off + r * 0.72)
          return (
            <g key={`lbl-${i}`}>
              <text x={lx} y={ly - 5} textAnchor="middle" fontSize={9}
                fill={tc} fontFamily={FONT}>{c.label}</text>
              <text x={lx} y={ly + 8} textAnchor="middle" fontSize={7} fontStyle="italic"
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
  const HEADER_H = 28
  const svgH = height - HEADER_H
  const cx = width / 2
  const cy = svgH / 2
  const r  = Math.min(cx, cy) * 0.62
  const tc = dark ? 'rgba(255,255,255,0.55)' : 'rgba(38,61,91,0.65)'

  const segments = [
    { label: 'Career',   color: 'rgba(73,182,229,0.22)' },
    { label: 'Finance',  color: 'rgba(100,200,130,0.22)' },
    { label: 'Health',   color: 'rgba(232,100,100,0.22)' },
    { label: 'Family',   color: 'rgba(255,190,80,0.22)' },
    { label: 'Romance',  color: 'rgba(200,120,200,0.22)' },
    { label: 'Growth',   color: 'rgba(73,182,229,0.22)' },
    { label: 'Fun',      color: 'rgba(100,200,130,0.22)' },
    { label: 'Home',     color: 'rgba(232,190,100,0.22)' },
  ]

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
      {header('WHEEL OF LIFE')}
      <svg width={width} height={svgH}>
        {/* Filled segments */}
        {segments.map((seg, i) => (
          <path key={i} d={segPath(i)} fill={seg.color} stroke={NAVY} strokeWidth={1} strokeOpacity={0.2} />
        ))}

        {/* Concentric scoring rings */}
        {[0.2, 0.4, 0.6, 0.8].map(s => (
          <circle key={s} cx={cx} cy={cy} r={r * s} fill="none"
            stroke={NAVY} strokeWidth={0.5} strokeOpacity={0.15} strokeDasharray="3 3" />
        ))}

        {/* Outer ring */}
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={NAVY} strokeWidth={1.5} strokeOpacity={0.35} />

        {/* Center score hint */}
        <text x={cx} y={cy + 4} textAnchor="middle" dominantBaseline="middle"
          fontSize={8} fill={tc} fontFamily={FONT}>1 – 10</text>

        {/* Segment labels */}
        {segments.map((seg, i) => {
          const mid = toRad(-90 + (i + 0.5) * step)
          const labelR = r * 0.8
          const lx = cx + labelR * Math.cos(mid)
          const ly = cy + labelR * Math.sin(mid)
          return (
            <text key={`lbl-${i}`} x={lx} y={ly} textAnchor="middle"
              dominantBaseline="middle" fontSize={9} fill={tc} fontFamily={FONT}>
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
  const HEADER_H = 28
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
      {header('GROW MODEL — A COACHING FRAMEWORK')}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', height: bodyH }}>
        {quadrants.map(({ letter, name, prompt, bg }, i) => (
          <div key={letter} style={{
            padding: '12px 14px',
            borderRight:  i % 2 === 0 ? `1.5px solid ${NAVY_ALPHA}` : 'none',
            borderBottom: i < 2       ? `1.5px solid ${NAVY_ALPHA}` : 'none',
            background: bg,
          }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 4 }}>
              <span style={{ fontSize: 24, fontWeight: 700, color: dark ? 'rgba(255,255,255,0.12)' : 'rgba(38,61,91,0.12)' }}>{letter}</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: tc }}>{name}</span>
            </div>
            <div style={{ fontSize: 9, color: dark ? 'rgba(255,255,255,0.2)' : 'rgba(38,61,91,0.3)', fontStyle: 'italic' }}>{prompt}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── SMART Goals ───────────────────────────────────────────────────────────────

function SmartGoals({ width, height, dark }: { width: number; height: number; dark: boolean }) {
  const HEADER_H = 28
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
            fontSize: 13, fontWeight: 700, letterSpacing: '0.05em', color: 'rgba(255,255,255,0.85)',
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
            flex: 1, padding: '10px 8px',
            borderRight: i < 4 ? `1.5px solid ${NAVY_ALPHA}` : 'none',
            background: dark ? 'rgba(38,61,91,0.05)' : 'transparent',
            overflow: 'hidden',
          }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: tc, marginBottom: 3 }}>{col.word}</div>
            <div style={{ fontSize: 8, color: dark ? 'rgba(255,255,255,0.2)' : 'rgba(38,61,91,0.3)', fontStyle: 'italic' }}>{col.desc}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Start / Stop / Continue ───────────────────────────────────────────────────

function StartStopContinue({ width, height, dark }: { width: number; height: number; dark: boolean }) {
  const HEADER_H = 28
  const bodyH = height - HEADER_H

  const cols = [
    { label: 'START',    desc: 'New habits to adopt',   accent: '#2D9E5F', bg: 'rgba(100,200,130,0.12)' },
    { label: 'STOP',     desc: 'Habits to let go of',   accent: '#C0392B', bg: 'rgba(232,100,100,0.12)' },
    { label: 'CONTINUE', desc: 'Habits that are working', accent: '#2980B9', bg: 'rgba(73,182,229,0.12)' },
  ]

  return (
    <div style={shell(width, height, dark)}>
      {header('START · STOP · CONTINUE')}
      <div style={{ display: 'flex', height: bodyH }}>
        {cols.map((col, i) => (
          <div key={col.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', borderRight: i < 2 ? `1.5px solid ${NAVY_ALPHA}` : 'none' }}>
            <div style={{ padding: '7px 10px', background: col.bg, borderBottom: `1px solid ${NAVY_ALPHA}` }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: col.accent }}>{col.label}</div>
              <div style={{ fontSize: 8, color: dark ? 'rgba(255,255,255,0.25)' : 'rgba(38,61,91,0.4)', fontStyle: 'italic', marginTop: 1 }}>{col.desc}</div>
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
  const HEADER_H = 28
  const bodyH = height - HEADER_H
  const tc = dark ? 'rgba(255,255,255,0.45)' : 'rgba(38,61,91,0.55)'

  const cols = [
    { label: 'BACKLOG',      desc: 'Tasks queued up',     bg: 'rgba(120,120,120,0.06)' },
    { label: 'IN PROGRESS',  desc: 'WIP limit: 1 – 3',    bg: 'rgba(73,182,229,0.08)' },
    { label: 'DONE',         desc: 'Completed ✓',         bg: 'rgba(100,200,130,0.08)' },
  ]

  return (
    <div style={shell(width, height, dark)}>
      {header('PERSONAL KANBAN')}
      <div style={{ display: 'flex', height: bodyH }}>
        {cols.map((col, i) => (
          <div key={col.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', borderRight: i < 2 ? `1.5px solid ${NAVY_ALPHA}` : 'none', background: col.bg }}>
            <div style={{ padding: '7px 10px', borderBottom: `1px solid ${NAVY_ALPHA}` }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: tc }}>{col.label}</div>
              <div style={{ fontSize: 8, color: dark ? 'rgba(255,255,255,0.2)' : 'rgba(38,61,91,0.3)', fontStyle: 'italic', marginTop: 1 }}>{col.desc}</div>
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
  const HEADER_H = 28
  const tc = dark ? 'rgba(255,255,255,0.45)' : 'rgba(38,61,91,0.55)'
  const border = `1px solid ${NAVY_ALPHA}`

  return (
    <div style={shell(width, height, dark)}>
      {header('5 WHYS — ROOT CAUSE ANALYSIS')}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '10px 16px', gap: 0 }}>
        {/* Problem row */}
        <div style={{ padding: '8px 0', borderBottom: `1.5px solid ${NAVY_ALPHA}` }}>
          <span style={{ fontSize: 9, fontWeight: 700, color: tc, letterSpacing: '0.06em' }}>PROBLEM STATEMENT</span>
        </div>

        {/* 5 why rows */}
        {[1, 2, 3, 4, 5].map(n => (
          <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: n < 5 ? border : 'none' }}>
            <span style={{ fontSize: 13, color: PRIMARY, lineHeight: 1, flexShrink: 0 }}>↓</span>
            <span style={{ fontSize: 9, color: tc, fontStyle: 'italic' }}>Why {n}?</span>
          </div>
        ))}

        {/* Root cause */}
        <div style={{ padding: '8px 0', borderTop: `1.5px solid ${NAVY_ALPHA}`, marginTop: 4 }}>
          <span style={{ fontSize: 9, fontWeight: 700, color: PRIMARY, letterSpacing: '0.06em' }}>✦ ROOT CAUSE</span>
        </div>
      </div>
    </div>
  )
}

// ── Daily Reflection ──────────────────────────────────────────────────────────

function DailyReflection({ width, height, dark }: { width: number; height: number; dark: boolean }) {
  const HEADER_H = 28

  const sections = [
    { label: 'GRATEFUL FOR',        prompt: '3 things I appreciate…',            bg: 'rgba(255,190,80,0.08)' },
    { label: "TODAY'S FOCUS",        prompt: 'My top priority today…',            bg: 'rgba(73,182,229,0.08)' },
    { label: 'WINS & PROGRESS',      prompt: 'What went well…',                   bg: 'rgba(100,200,130,0.08)' },
    { label: 'LESSONS LEARNED',      prompt: 'What I would do differently…',      bg: 'rgba(232,100,100,0.08)' },
    { label: "TOMORROW'S INTENTION", prompt: 'One thing to focus on tomorrow…',   bg: 'rgba(200,120,200,0.08)' },
  ]

  return (
    <div style={shell(width, height, dark)}>
      {header('DAILY REFLECTION')}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {sections.map((sec, i) => (
          <div key={sec.label} style={{
            flex: 1, padding: '6px 14px',
            background: sec.bg,
            borderBottom: i < sections.length - 1 ? `1px solid ${NAVY_ALPHA}` : 'none',
            display: 'flex', flexDirection: 'column', justifyContent: 'center',
          }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: dark ? 'rgba(255,255,255,0.5)' : 'rgba(38,61,91,0.65)', letterSpacing: '0.05em' }}>{sec.label}</div>
            <div style={{ fontSize: 8, color: dark ? 'rgba(255,255,255,0.2)' : 'rgba(38,61,91,0.3)', fontStyle: 'italic', marginTop: 2 }}>{sec.prompt}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── OKR ───────────────────────────────────────────────────────────────────────

function OKRFramework({ width, height, dark }: { width: number; height: number; dark: boolean }) {
  const HEADER_H = 28
  const bodyH    = height - HEADER_H
  const OBJ_H    = Math.round(bodyH * 0.38)
  const KR_H     = bodyH - OBJ_H
  const tc = dark ? 'rgba(255,255,255,0.4)' : 'rgba(38,61,91,0.5)'

  return (
    <div style={shell(width, height, dark)}>
      {header('OKR — OBJECTIVES & KEY RESULTS')}

      {/* Objective */}
      <div style={{ height: OBJ_H, padding: '10px 14px', borderBottom: `2px solid ${NAVY_ALPHA}`, background: dark ? 'rgba(73,182,229,0.04)' : 'rgba(73,182,229,0.03)', flexShrink: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: PRIMARY, letterSpacing: '0.05em', marginBottom: 4 }}>OBJECTIVE</div>
        <div style={{ fontSize: 8, color: tc, fontStyle: 'italic' }}>What do you want to achieve?</div>
      </div>

      {/* Key Results */}
      <div style={{ display: 'flex', height: KR_H }}>
        {[1, 2, 3].map(n => (
          <div key={n} style={{
            flex: 1, padding: '10px 12px',
            borderRight: n < 3 ? `1.5px solid ${NAVY_ALPHA}` : 'none',
            background: dark ? 'rgba(38,61,91,0.04)' : 'transparent',
            display: 'flex', flexDirection: 'column', justifyContent: 'flex-start',
          }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: tc, letterSpacing: '0.05em', marginBottom: 3 }}>KEY RESULT {n}</div>
            <div style={{ fontSize: 8, color: dark ? 'rgba(255,255,255,0.18)' : 'rgba(38,61,91,0.28)', fontStyle: 'italic' }}>Measurable outcome…</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Energy Audit ──────────────────────────────────────────────────────────────

function EnergyAudit({ width, height, dark }: { width: number; height: number; dark: boolean }) {
  const HEADER_H = 28
  const LABEL_W  = 90
  const bodyH    = Math.max(0, height - HEADER_H)

  return (
    <div style={shell(width, height, dark)}>
      <div style={{ height: HEADER_H, background: NAVY, display: 'flex', flexShrink: 0 }}>
        <div style={{ width: LABEL_W, borderRight: '2px solid rgba(255,255,255,0.2)', flexShrink: 0 }} />
        {['POSITIVE', 'NEGATIVE'].map((label, i) => (
          <div key={label} style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 9, letterSpacing: '0.05em', color: 'rgba(255,255,255,0.85)',
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
              fontSize: 9, letterSpacing: '0.05em',
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
              padding: 10,
              borderRight:  (i === 0 || i === 2) ? `1.5px solid ${NAVY_ALPHA}` : 'none',
              borderBottom: (i === 0 || i === 1) ? `1.5px solid ${NAVY_ALPHA}` : 'none',
              background: bg,
            }}>
              <div style={{ fontSize: 11, fontStyle: 'italic', color: dark ? 'rgba(255,255,255,0.35)' : 'rgba(38,61,91,0.5)' }}>{label}</div>
              <div style={{ fontSize: 8, color: dark ? 'rgba(255,255,255,0.15)' : 'rgba(38,61,91,0.3)', marginTop: 2 }}>{sub}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
