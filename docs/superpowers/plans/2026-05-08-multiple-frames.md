# Multiple Frames Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single per-board framework overlay with multiple independently draggable, resizable frame overlays, each with its own type, position, and size.

**Architecture:** A new `useFrames` hook manages `FrameInstance[]` in localStorage (`ideaboard_frames_<boardId>`), auto-migrating existing single-framework boards. `FrameworkOverlay` gains a header bar (drag handle, type picker, × button) and selection outline. `Board.tsx` wires frame drag/resize/select/delete and a sidebar "+ Add Frame" button; the old topbar framework picker is removed.

**Tech Stack:** React 18, TypeScript, localStorage, inline styles (existing project patterns).

---

## File Map

| File | Change |
|---|---|
| `src/types/index.ts` | Add `FrameworkType`, `FrameInstance` |
| `src/hooks/useFramework.ts` | Delete |
| `src/hooks/useFramework.test.ts` | Delete |
| `src/hooks/useFrames.ts` | New — multi-frame hook |
| `src/hooks/useFrames.test.ts` | New — tests for `parseFrameInstances` |
| `src/components/FrameworkOverlay.tsx` | New props, header bar, selection outline |
| `src/components/Board.tsx` | Replace `useFramework`, frame interactions, sidebar button |

---

## Task 1: Add `FrameworkType` and `FrameInstance` to types

**Files:**
- Modify: `src/types/index.ts`

- [ ] **Step 1: Append types to `src/types/index.ts`**

At the very end of `src/types/index.ts` (after the `BoardGroup` interface), append:

```typescript
export type FrameworkType =
  | 'blank' | 'eisenhower' | 'ooda'
  | 'ikigai' | 'wheel-of-life' | 'grow' | 'smart-goals'
  | 'start-stop-continue' | 'personal-kanban' | 'five-whys'
  | 'daily-reflection' | 'okr' | 'energy-audit'
  | 'eat-that-frog' | 'gtd'

export interface FrameInstance {
  id: string
  type: FrameworkType
  x: number        // world-space position (inside the transformed worldRef div)
  y: number
  width: number    // world-space size
  height: number
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd C:\Users\User\Downloads\ideaboard-v3\ideaboard3
npx tsc --noEmit
```

Expected: only the pre-existing `pdfImport.ts` TS2307, nothing new.

- [ ] **Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: add FrameworkType and FrameInstance to types"
```

---

## Task 2: `useFrames` hook (TDD)

**Files:**
- Create: `src/hooks/useFrames.test.ts`
- Create: `src/hooks/useFrames.ts`

- [ ] **Step 1: Write failing tests**

Create `src/hooks/useFrames.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest'

let store: Record<string, string> = {}
vi.stubGlobal('localStorage', {
  getItem:    (k: string) => store[k] ?? null,
  setItem:    (k: string, v: string) => { store[k] = v },
  removeItem: (k: string) => { delete store[k] },
  clear:      () => { store = {} },
})

import { parseFrameInstances } from './useFrames'

describe('parseFrameInstances', () => {
  it('returns [] when both args are null', () => {
    expect(parseFrameInstances(null, null)).toEqual([])
  })

  it('parses a stored frames array', () => {
    const stored = JSON.stringify([
      { id: 'f1', type: 'eisenhower', x: 60, y: 40, width: 640, height: 540 },
    ])
    const result = parseFrameInstances(stored, null)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('f1')
    expect(result[0].type).toBe('eisenhower')
    expect(result[0].x).toBe(60)
  })

  it('migrates old non-blank single framework to one-item array at (60, 40)', () => {
    const old = JSON.stringify({ type: 'okr', width: 640, height: 440 })
    const result = parseFrameInstances(null, old)
    expect(result).toHaveLength(1)
    expect(result[0].type).toBe('okr')
    expect(result[0].x).toBe(60)
    expect(result[0].y).toBe(40)
    expect(result[0].width).toBe(640)
    expect(result[0].height).toBe(440)
    expect(typeof result[0].id).toBe('string')
  })

  it('migrates old blank single framework to empty array', () => {
    const old = JSON.stringify({ type: 'blank', width: 640, height: 540 })
    expect(parseFrameInstances(null, old)).toEqual([])
  })

  it('ignores old framework when new frames already exist', () => {
    const newRaw = JSON.stringify([{ id: 'f1', type: 'ikigai', x: 0, y: 0, width: 520, height: 520 }])
    const old    = JSON.stringify({ type: 'okr', width: 640, height: 440 })
    const result = parseFrameInstances(newRaw, old)
    expect(result).toHaveLength(1)
    expect(result[0].type).toBe('ikigai')
  })

  it('returns [] for malformed JSON', () => {
    expect(parseFrameInstances('not-json', null)).toEqual([])
  })
})
```

- [ ] **Step 2: Run tests — verify the 6 new ones fail**

```bash
npx vitest run src/hooks/useFrames.test.ts
```

Expected: 6 failures (`Cannot find module './useFrames'`).

- [ ] **Step 3: Create `src/hooks/useFrames.ts`**

```typescript
import { useState, useCallback } from 'react'
import type { FrameworkType, FrameInstance } from '../types'

export const VALID_TYPES: FrameworkType[] = [
  'blank', 'eisenhower', 'ooda',
  'ikigai', 'wheel-of-life', 'grow', 'smart-goals',
  'start-stop-continue', 'personal-kanban', 'five-whys',
  'daily-reflection', 'okr', 'energy-audit',
  'eat-that-frog', 'gtd',
]

export const DEFAULTS: Record<FrameworkType, { width: number; height: number }> = {
  blank:                 { width: 640, height: 540 },
  eisenhower:            { width: 640, height: 540 },
  ooda:                  { width: 720, height: 220 },
  ikigai:                { width: 520, height: 520 },
  'wheel-of-life':       { width: 500, height: 520 },
  grow:                  { width: 640, height: 540 },
  'smart-goals':         { width: 800, height: 220 },
  'start-stop-continue': { width: 720, height: 400 },
  'personal-kanban':     { width: 720, height: 400 },
  'five-whys':           { width: 640, height: 380 },
  'daily-reflection':    { width: 640, height: 540 },
  okr:                   { width: 640, height: 440 },
  'energy-audit':        { width: 640, height: 540 },
  'eat-that-frog':       { width: 580, height: 440 },
  gtd:                   { width: 840, height: 260 },
}

export const FRAMEWORK_LABELS: Record<FrameworkType, string> = {
  blank:                 'Blank',
  eisenhower:            'Eisenhower Matrix',
  ooda:                  'OODA Loop',
  ikigai:                'Ikigai',
  'wheel-of-life':       'Wheel of Life',
  grow:                  'GROW Model',
  'smart-goals':         'SMART Goals',
  'start-stop-continue': 'Start / Stop / Continue',
  'personal-kanban':     'Personal Kanban',
  'five-whys':           '5 Whys',
  'daily-reflection':    'Daily Reflection',
  okr:                   'OKR',
  'energy-audit':        'Energy Audit',
  'eat-that-frog':       'Eat That Frog',
  gtd:                   'GTD',
}

export type FrameworkGroupEntry = { sep: string } | { key: FrameworkType }

export const FRAMEWORK_GROUPS: FrameworkGroupEntry[] = [
  { key: 'eisenhower' }, { key: 'ooda' },
  { sep: 'PERSONAL GROWTH' },
  { key: 'ikigai' }, { key: 'wheel-of-life' }, { key: 'grow' }, { key: 'smart-goals' },
  { key: 'start-stop-continue' }, { key: 'personal-kanban' }, { key: 'five-whys' },
  { key: 'daily-reflection' }, { key: 'okr' }, { key: 'energy-audit' },
  { key: 'eat-that-frog' }, { key: 'gtd' },
]

function framesKey(boardId: string) { return `ideaboard_frames_${boardId}` }
function oldKey(boardId: string)    { return `ideaboard_framework_${boardId}` }

function save(boardId: string, frames: FrameInstance[]) {
  localStorage.setItem(framesKey(boardId), JSON.stringify(frames))
}

export function parseFrameInstances(
  newRaw: string | null,
  oldRaw: string | null,
): FrameInstance[] {
  if (newRaw) {
    try {
      const parsed = JSON.parse(newRaw)
      if (Array.isArray(parsed)) return parsed as FrameInstance[]
    } catch { /* fall through */ }
  }
  if (oldRaw) {
    try {
      const old = JSON.parse(oldRaw) as Record<string, unknown>
      const type: FrameworkType = VALID_TYPES.includes(old['type'] as FrameworkType)
        ? (old['type'] as FrameworkType)
        : 'eisenhower'
      if (type === 'blank') return []
      const def = DEFAULTS[type]
      return [{
        id: crypto.randomUUID(),
        type,
        x: 60,
        y: 40,
        width:  typeof old['width']  === 'number' ? old['width']  : def.width,
        height: typeof old['height'] === 'number' ? old['height'] : def.height,
      }]
    } catch { /* fall through */ }
  }
  return []
}

export function useFrames(boardId: string) {
  const [frames, setFrames] = useState<FrameInstance[]>(() =>
    parseFrameInstances(
      localStorage.getItem(framesKey(boardId)),
      localStorage.getItem(oldKey(boardId)),
    )
  )

  const addFrame = useCallback((
    type: FrameworkType,
    viewportCx: number,
    viewportCy: number,
    zoom: number,
    panX: number,
    panY: number,
  ): FrameInstance => {
    const t = type === 'blank' ? 'eisenhower' : type
    const { width, height } = DEFAULTS[t]
    const x = (viewportCx - panX) / zoom - width / 2
    const y = (viewportCy - panY) / zoom - height / 2
    const frame: FrameInstance = { id: crypto.randomUUID(), type: t, x, y, width, height }
    setFrames(prev => { const next = [...prev, frame]; save(boardId, next); return next })
    return frame
  }, [boardId])

  const moveFrame = useCallback((id: string, x: number, y: number) => {
    setFrames(prev => prev.map(f => f.id === id ? { ...f, x, y } : f))
  }, [])

  const commitFrameMove = useCallback((id: string, x: number, y: number) => {
    setFrames(prev => {
      const next = prev.map(f => f.id === id ? { ...f, x, y } : f)
      save(boardId, next)
      return next
    })
  }, [boardId])

  const setFrameSize = useCallback((id: string, width: number, height: number) => {
    setFrames(prev => prev.map(f => f.id === id ? { ...f, width, height } : f))
  }, [])

  const commitFrameResize = useCallback((id: string, width: number, height: number) => {
    setFrames(prev => {
      const next = prev.map(f => f.id === id ? { ...f, width, height } : f)
      save(boardId, next)
      return next
    })
  }, [boardId])

  const changeFrameType = useCallback((id: string, type: FrameworkType) => {
    const t = type === 'blank' ? 'eisenhower' : type
    setFrames(prev => {
      const { width, height } = DEFAULTS[t]
      const next = prev.map(f => f.id === id ? { ...f, type: t, width, height } : f)
      save(boardId, next)
      return next
    })
  }, [boardId])

  const deleteFrame = useCallback((id: string) => {
    setFrames(prev => {
      const next = prev.filter(f => f.id !== id)
      save(boardId, next)
      return next
    })
  }, [boardId])

  return { frames, addFrame, moveFrame, commitFrameMove, setFrameSize, commitFrameResize, changeFrameType, deleteFrame }
}
```

- [ ] **Step 4: Run tests — verify all 6 pass**

```bash
npx vitest run src/hooks/useFrames.test.ts
```

Expected: 6 passed.

- [ ] **Step 5: Run full test suite**

```bash
npm test
```

Expected: 51 passed (45 existing + 6 new).

- [ ] **Step 6: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: only the pre-existing `pdfImport.ts` TS2307, nothing new.

- [ ] **Step 7: Commit**

```bash
git add src/hooks/useFrames.ts src/hooks/useFrames.test.ts
git commit -m "feat: add useFrames hook for multi-frame support"
```

---

## Task 3: Update `FrameworkOverlay` and `Board.tsx`

These two files must change together — `FrameworkOverlay` gets a new props interface which would break `Board.tsx` until both are updated.

**Files:**
- Modify: `src/components/FrameworkOverlay.tsx`
- Modify: `src/components/Board.tsx`
- Delete: `src/hooks/useFramework.ts`
- Delete: `src/hooks/useFramework.test.ts`

### Part A — `FrameworkOverlay.tsx`

- [ ] **Step 1: Replace the top of `FrameworkOverlay.tsx`**

Find (everything from line 1 up to, but NOT including, `// ── Shared style helpers`):

```typescript
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
```

Replace with:

```typescript
import { useState } from 'react'
import type { FrameworkType, FrameInstance } from '../types'
import { FRAMEWORK_LABELS, FRAMEWORK_GROUPS } from '../hooks/useFrames'

interface FrameworkOverlayProps {
  frame: FrameInstance
  dark: boolean
  selected: boolean
  onMoveStart: (id: string, e: React.MouseEvent) => void
  onResizeStart: (id: string, e: React.MouseEvent) => void
  onDelete: (id: string) => void
  onSelect: (id: string) => void
  onTypeChange: (id: string, type: FrameworkType) => void
}

export default function FrameworkOverlay({
  frame, dark, selected,
  onMoveStart, onResizeStart, onDelete, onSelect, onTypeChange,
}: FrameworkOverlayProps) {
  const [typePickerOpen, setTypePickerOpen] = useState(false)
  const { id, type, x, y, width, height } = frame

  return (
    <div
      className="world-item"
      onClick={e => { if (!(e.target as HTMLElement).closest('.no-drag')) onSelect(id) }}
      style={{
        position: 'absolute', left: x, top: y,
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

        <span style={{
          flex: 1, fontSize: 9, letterSpacing: '0.07em',
          color: 'rgba(255,255,255,.8)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {FRAMEWORK_LABELS[type]}
        </span>

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
                background: dark ? '#1A1A24' : 'white',
                border: `1px solid ${dark ? '#2A2A38' : '#ddd'}`,
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
                        color: type === entry.key ? '#49B6E5' : (dark ? '#ddd' : '#1A1A2E'),
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
```

### Part B — `Board.tsx`

Make each of these targeted edits to `src/components/Board.tsx` in order.

- [ ] **Step 2: Update imports**

Find:
```typescript
import { useFramework } from '../hooks/useFramework'
import type { FrameworkType } from '../hooks/useFramework'
import FrameworkOverlay from './FrameworkOverlay'
```

Replace with:
```typescript
import { useFrames, FRAMEWORK_LABELS, FRAMEWORK_GROUPS } from '../hooks/useFrames'
import FrameworkOverlay from './FrameworkOverlay'
```

- [ ] **Step 3: Remove the old framework constants**

Find and delete this entire block (lines 40–77):
```typescript
const FRAMEWORK_LABELS: Record<FrameworkType, string> = {
  blank:                 'Blank Board',
  eisenhower:            'Eisenhower Matrix',
  ooda:                  'OODA Loop',
  ikigai:                'Ikigai',
  'wheel-of-life':       'Wheel of Life',
  grow:                  'GROW Model',
  'smart-goals':         'SMART Goals',
  'start-stop-continue': 'Start / Stop / Continue',
  'personal-kanban':     'Personal Kanban',
  'five-whys':           '5 Whys',
  'daily-reflection':    'Daily Reflection',
  okr:                   'OKR',
  'energy-audit':        'Energy Audit',
  'eat-that-frog':       'Eat That Frog',
  gtd:                   'GTD',
}

type DropdownEntry =
  | { key: FrameworkType; label: string; desc: string }
  | { sep: string }

const FRAMEWORK_DROPDOWN: DropdownEntry[] = [
  { key: 'blank',      label: 'Blank Board',       desc: 'Clean canvas, no overlay' },
  { key: 'eisenhower', label: 'Eisenhower Matrix',  desc: 'Urgent / Important grid' },
  { key: 'ooda',       label: 'OODA Loop',          desc: 'Observe → Orient → Decide → Act' },
  { sep: 'PERSONAL GROWTH' },
  { key: 'ikigai',                label: 'Ikigai',                  desc: 'Find your reason for being' },
  { key: 'wheel-of-life',         label: 'Wheel of Life',           desc: 'Balance across 8 life areas' },
  { key: 'grow',                  label: 'GROW Model',              desc: 'Goal → Reality → Options → Will' },
  { key: 'smart-goals',           label: 'SMART Goals',             desc: 'Specific · Measurable · Achievable · Relevant · Time-bound' },
  { key: 'start-stop-continue',   label: 'Start / Stop / Continue', desc: 'Retrospective for habits & actions' },
  { key: 'personal-kanban',       label: 'Personal Kanban',         desc: 'Backlog → In Progress → Done' },
  { key: 'five-whys',             label: '5 Whys',                  desc: 'Drill down to root causes' },
  { key: 'daily-reflection',      label: 'Daily Reflection',        desc: 'Gratitude · Focus · Wins · Lessons' },
  { key: 'okr',                   label: 'OKR',                     desc: 'Objective + Key Results' },
  { key: 'energy-audit',          label: 'Energy Audit',            desc: 'Map activities by energy level' },
]
```

- [ ] **Step 4: Replace `useFramework` with `useFrames` in the component body**

Find:
```typescript
  const brd = useBoard(board.id)
  const fw = useFramework(board.id)
  const sld = useSlides(board.id)
  const sldRef = useRef(sld)
  useEffect(() => { sldRef.current = sld }, [sld])
  const txt = useTextBlocks(board.id)
  const txtRef = useRef<UseTextBlocksReturn>(txt)
  useEffect(() => { txtRef.current = txt }, [txt])
```

Replace with:
```typescript
  const brd = useBoard(board.id)
  const frm = useFrames(board.id)
  const frmRef = useRef(frm)
  useEffect(() => { frmRef.current = frm }, [frm])
  const sld = useSlides(board.id)
  const sldRef = useRef(sld)
  useEffect(() => { sldRef.current = sld }, [sld])
  const txt = useTextBlocks(board.id)
  const txtRef = useRef<UseTextBlocksReturn>(txt)
  useEffect(() => { txtRef.current = txt }, [txt])
```

- [ ] **Step 5: Add new refs and update state**

Find:
```typescript
  const resizeTarget = useRef<'card' | 'framework' | 'textblock'>('card')
  const dragTileId   = useRef<string | null>(null)
  const lastSnapId   = useRef<string | null>(null)
  const dragTextId   = useRef<string | null>(null)
  const resizeTextId = useRef<string | null>(null)
  const fwRef = useRef(fw)
  useEffect(() => { fwRef.current = fw }, [fw])
```

Replace with:
```typescript
  const resizeTarget  = useRef<'card' | 'framework' | 'textblock'>('card')
  const dragTileId    = useRef<string | null>(null)
  const lastSnapId    = useRef<string | null>(null)
  const dragTextId    = useRef<string | null>(null)
  const resizeTextId  = useRef<string | null>(null)
  const dragFrameId   = useRef<string | null>(null)
  const resizeFrameId = useRef<string | null>(null)
```

Find:
```typescript
  const [frameworkDropdownOpen, setFrameworkDropdownOpen] = useState(false)
```

Replace with:
```typescript
  const [selectedFrameId,  setSelectedFrameId]  = useState<string | null>(null)
  const [addFrameMenuOpen, setAddFrameMenuOpen]  = useState(false)
  const addFrameBtnRef = useRef<HTMLDivElement>(null)
```

- [ ] **Step 6: Replace the old framework resize handler with frame handlers**

Find:
```typescript
  const onFrameworkResizeStart = useCallback((e: React.MouseEvent) => {
    isResizing.current   = true
    resizeTarget.current = 'framework'
    resizeStartX.current = e.clientX
    resizeStartY.current = e.clientY
    resizeStartW.current = fwRef.current.framework.width
    resizeStartH.current = fwRef.current.framework.height
  }, [])
```

Replace with:
```typescript
  const onFrameMoveStart = useCallback((id: string, e: React.MouseEvent) => {
    const frame = frmRef.current.frames.find(f => f.id === id)
    if (!frame) return
    isDragging.current  = true
    dragFrameId.current = id
    dragCardId.current  = null
    dragTagId.current   = null
    dragTileId.current  = null
    dragTextId.current  = null
    snapZoom.current    = zoom
    snapPanX.current    = panX
    snapPanY.current    = panY
    const cr = canvasRef.current!.getBoundingClientRect()
    dragOffWX.current = (e.clientX - cr.left - panX) / zoom - frame.x
    dragOffWY.current = (e.clientY - cr.top  - panY) / zoom - frame.y
  }, [zoom, panX, panY])

  const onFrameResizeStart = useCallback((id: string, e: React.MouseEvent) => {
    const frame = frmRef.current.frames.find(f => f.id === id)
    if (!frame) return
    isResizing.current    = true
    resizeTarget.current  = 'framework'
    resizeFrameId.current = id
    resizeStartX.current  = e.clientX
    resizeStartY.current  = e.clientY
    resizeStartW.current  = frame.width
    resizeStartH.current  = frame.height
  }, [])
```

- [ ] **Step 7: Add frame drag to `onMove` handler**

In the `onMove` function, inside the `if (isDragging.current && canvasRef.current)` block, find:

```typescript
        if (dragTextId.current) {
          txtRef.current.moveBlock(dragTextId.current, wx, wy)
```

After the entire `if (dragTextId.current) { ... }` block (which ends with the snap ghost logic), add:

```typescript
        if (dragFrameId.current) frmRef.current.moveFrame(dragFrameId.current, wx, wy)
```

Then find the resize section:

```typescript
        if (resizeTarget.current === 'framework') {
          fwRef.current.setSize(
            Math.max(FRAMEWORK_MIN_W, resizeStartW.current + dx),
            Math.max(FRAMEWORK_MIN_H, (resizeStartH.current ?? 540) + dy),
          )
        } else if (resizeCardId.current) {
```

Replace with:
```typescript
        if (resizeTarget.current === 'framework' && resizeFrameId.current) {
          frmRef.current.setFrameSize(
            resizeFrameId.current,
            Math.max(FRAMEWORK_MIN_W, resizeStartW.current + dx),
            Math.max(FRAMEWORK_MIN_H, (resizeStartH.current ?? 540) + dy),
          )
        } else if (resizeCardId.current) {
```

- [ ] **Step 8: Add frame commit to `onUp` handler**

In the `onUp` function, inside the `if (isDragging.current && canvasRef.current)` block, find:

```typescript
        if (dragTextId.current) {
```

Find the entire `if (dragTextId.current) { ... }` block and add the following immediately after it (before `isDragging.current = false`):

```typescript
        if (dragFrameId.current) {
          frmRef.current.commitFrameMove(dragFrameId.current, wx, wy)
        }
```

Then add `dragFrameId.current = null` to the cleanup section. Find:

```typescript
        isDragging.current = false
        dragCardId.current = null
        dragTagId.current = null
        dragTileId.current = null
        dragTextId.current = null
        lastSnapId.current = null
        setSnapGhost(null)
        return
```

Replace with:
```typescript
        isDragging.current  = false
        dragCardId.current  = null
        dragTagId.current   = null
        dragTileId.current  = null
        dragTextId.current  = null
        dragFrameId.current = null
        lastSnapId.current  = null
        setSnapGhost(null)
        return
```

Then find the resize commit:

```typescript
        if (resizeTarget.current === 'framework') {
          fwRef.current.commitSize(
            Math.max(FRAMEWORK_MIN_W, resizeStartW.current + dx),
            Math.max(FRAMEWORK_MIN_H, (resizeStartH.current ?? 540) + dy),
          )
        } else if (resizeCardId.current) {
```

Replace with:
```typescript
        if (resizeTarget.current === 'framework' && resizeFrameId.current) {
          frmRef.current.commitFrameResize(
            resizeFrameId.current,
            Math.max(FRAMEWORK_MIN_W, resizeStartW.current + dx),
            Math.max(FRAMEWORK_MIN_H, (resizeStartH.current ?? 540) + dy),
          )
          resizeFrameId.current = null
        } else if (resizeCardId.current) {
```

- [ ] **Step 9: Update keyboard and canvas click handlers**

In the keyboard handler, find:

```typescript
      if (e.key === 'Escape') {
        setColourPicker(null)
        setFrameworkDropdownOpen(false)
        setSelectedCardId(null)
        setModalOpen(false)
        setShowShortcuts(false)
      }
```

Replace with:
```typescript
      if (e.key === 'Escape') {
        setColourPicker(null)
        setAddFrameMenuOpen(false)
        setSelectedCardId(null)
        setSelectedFrameId(null)
        setModalOpen(false)
        setShowShortcuts(false)
      }
```

Find the Delete/Backspace handler:
```typescript
      if ((e.key === 'Delete' || e.key === 'Backspace') && !e.ctrlKey && !e.metaKey) {
        if (selectedCardId && !modalOpen) {
          const card = brd.cards.find(c => c.id === selectedCardId)
          if (!card || card.locked) return
          e.preventDefault()
          brd.removeCard(selectedCardId).then(() => showToast('Card deleted'))
          setSelectedCardId(null)
        }
      }
```

Replace with:
```typescript
      if ((e.key === 'Delete' || e.key === 'Backspace') && !e.ctrlKey && !e.metaKey) {
        if (selectedCardId && !modalOpen) {
          const card = brd.cards.find(c => c.id === selectedCardId)
          if (!card || card.locked) return
          e.preventDefault()
          brd.removeCard(selectedCardId).then(() => showToast('Card deleted'))
          setSelectedCardId(null)
        }
        if (selectedFrameId) {
          e.preventDefault()
          frmRef.current.deleteFrame(selectedFrameId)
          setSelectedFrameId(null)
        }
      }
```

In `onCanvasMouseDown`, find:
```typescript
    setSelectedCardId(null)
    if (e.ctrlKey) { e.preventDefault(); return }
```

Replace with:
```typescript
    setSelectedCardId(null)
    setSelectedFrameId(null)
    if (e.ctrlKey) { e.preventDefault(); return }
```

- [ ] **Step 10: Add "+ Add Frame" button to sidebar**

In the sidebar, find this divider and the bottom section:
```typescript
        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
```

Immediately before that line, insert:

```tsx
        <div style={{ width: 28, height: 1, background: '#1A1A22', margin: '4px 0' }}/>

        <div ref={addFrameBtnRef} style={{ position: 'relative' }}>
          <SbBtn title="Add Frame" onClick={() => setAddFrameMenuOpen(o => !o)} dark={dark}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2"/>
              <path d="M12 8v8M8 12h8"/>
            </svg>
          </SbBtn>
          {addFrameMenuOpen && (() => {
            const rect = addFrameBtnRef.current?.getBoundingClientRect()
            return (
              <>
                <div style={{ position: 'fixed', inset: 0, zIndex: 998 }} onClick={() => setAddFrameMenuOpen(false)} />
                <div style={{
                  position: 'fixed',
                  left: 76,
                  top: rect ? Math.min(rect.top, window.innerHeight - 420) : 200,
                  zIndex: 999,
                  background: dark ? '#1A1A24' : 'white',
                  border: `1px solid ${dark ? '#2A2A38' : '#ddd'}`,
                  borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,.18)',
                  minWidth: 200, maxHeight: 400, overflowY: 'auto',
                }}>
                  <div style={{ padding: '8px 14px 4px', fontSize: 10, fontWeight: 700, color: dark ? '#666' : '#aaa', letterSpacing: '0.08em' }}>ADD FRAME</div>
                  {FRAMEWORK_GROUPS.map((entry, i) =>
                    'sep' in entry ? (
                      <div key={entry.sep + i} style={{ padding: '7px 14px 2px', fontSize: 8, letterSpacing: '0.1em', color: dark ? '#555' : '#aaa', fontWeight: 700 }}>
                        {entry.sep}
                      </div>
                    ) : (
                      <button
                        key={entry.key}
                        onClick={() => {
                          const cr = canvasRef.current?.getBoundingClientRect()
                          if (!cr) return
                          frm.addFrame(entry.key!, cr.left + cr.width / 2, cr.top + cr.height / 2, zoom, panX, panY)
                          setAddFrameMenuOpen(false)
                        }}
                        style={{
                          display: 'block', width: '100%', padding: '9px 14px',
                          border: 'none', background: 'transparent', cursor: 'pointer',
                          textAlign: 'left', fontSize: 12, fontWeight: 500,
                          color: dark ? '#ddd' : '#1A1A2E',
                          fontFamily: "'DM Sans',sans-serif",
                        }}
                      >
                        {FRAMEWORK_LABELS[entry.key!]}
                      </button>
                    )
                  )}
                </div>
              </>
            )
          })()}
        </div>
```

- [ ] **Step 11: Remove the topbar framework picker**

Find and delete this entire block (the framework picker in the topbar):

```tsx
          {/* Framework picker dropdown */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setFrameworkDropdownOpen(o => !o)}
              style={{ height: 28, padding: '0 10px', borderRadius: 20, border: `1.5px solid ${dark ? '#49B6E5' : '#263D5B'}`, background: 'transparent', color: dark ? '#49B6E5' : '#263D5B', cursor: 'pointer', fontSize: 10, fontFamily: "'Delius Swash Caps',cursive", display: 'flex', alignItems: 'center', gap: 5 }}
            >
              {FRAMEWORK_LABELS[fw.framework.type]}
              <span style={{ fontSize: 9 }}>▾</span>
            </button>

            {frameworkDropdownOpen && (
              <>
                {/* Click-outside overlay */}
                <div
                  style={{ position: 'fixed', inset: 0, zIndex: 998 }}
                  onClick={() => setFrameworkDropdownOpen(false)}
                />
                {/* Dropdown panel */}
                <div style={{ position: 'absolute', top: 34, left: 0, zIndex: 999, background: dark ? '#1A1A24' : 'white', border: `1px solid ${dark ? '#2A2A38' : '#ddd'}`, borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,.18)', overflow: 'hidden', minWidth: 220, maxHeight: 420, overflowY: 'auto' }}>
                  {FRAMEWORK_DROPDOWN.map((entry, i) =>
                    'sep' in entry ? (
                      <div key={entry.sep + i} style={{ padding: '8px 14px 3px', fontSize: 8, letterSpacing: '0.1em', color: dark ? '#555' : '#aaa', fontFamily: "'DM Sans',sans-serif", fontWeight: 700 }}>
                        {entry.sep}
                      </div>
                    ) : (
                      <button
                        key={entry.key}
                        onClick={() => { fw.setType(entry.key); setFrameworkDropdownOpen(false) }}
                        style={{ display: 'block', width: '100%', padding: '10px 14px', border: 'none', background: fw.framework.type === entry.key ? (dark ? 'rgba(108,99,255,.15)' : 'rgba(108,99,255,.08)') : 'transparent', cursor: 'pointer', textAlign: 'left', fontFamily: "'DM Sans',sans-serif" }}
                      >
                        <div style={{ fontSize: 12, fontWeight: 600, color: fw.framework.type === entry.key ? '#6C63FF' : (dark ? '#ddd' : '#1A1A2E') }}>{entry.label}</div>
                        <div style={{ fontSize: 10, color: dark ? '#666' : '#999', marginTop: 1 }}>{entry.desc}</div>
                      </button>
                    )
                  )}
                </div>
              </>
            )}
          </div>
```

- [ ] **Step 12: Replace the canvas frame render**

Find:
```tsx
            {/* Framework overlay */}
            <FrameworkOverlay
              type={fw.framework.type}
              width={fw.framework.width}
              height={fw.framework.height}
              dark={dark}
              onResizeStart={onFrameworkResizeStart}
            />
```

Replace with:
```tsx
            {/* Frame overlays */}
            {frm.frames.map(frame => (
              <FrameworkOverlay
                key={frame.id}
                frame={frame}
                dark={dark}
                selected={selectedFrameId === frame.id}
                onMoveStart={onFrameMoveStart}
                onResizeStart={onFrameResizeStart}
                onDelete={id => { frmRef.current.deleteFrame(id); setSelectedFrameId(null) }}
                onSelect={setSelectedFrameId}
                onTypeChange={(id, type) => frmRef.current.changeFrameType(id, type)}
              />
            ))}
```

### Part C — Delete old hook files

- [ ] **Step 13: Delete `useFramework.ts` and `useFramework.test.ts`**

```bash
rm src/hooks/useFramework.ts src/hooks/useFramework.test.ts
```

### Part D — Verify and commit

- [ ] **Step 14: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: only the pre-existing `pdfImport.ts` TS2307, nothing new.

- [ ] **Step 15: Run full test suite**

```bash
npm test
```

Expected: 51 passed (the 6 `useFramework.test.ts` tests are gone, replaced by the 6 `useFrames.test.ts` tests; net count stays at 51).

- [ ] **Step 16: Manual smoke test**

Run `npm run dev` and open `http://localhost:5180`.

Check each case:
- Empty board → no frames on canvas; sidebar shows "Add Frame" button (box with +)
- Old board that had Eisenhower set → opens with one Eisenhower frame at its old position, draggable
- Click "+ Add Frame" in sidebar → picker appears to the right of sidebar
- Pick "OKR" → OKR frame appears near canvas centre
- Drag a frame by its ⠿ handle → moves freely; position persists after page reload
- Click frame body → blue outline appears (selected)
- Press Delete while selected → frame removed
- Click × in header → frame removed
- Click ▾ in header → type picker opens; pick different type → frame content updates, size resets to new type's default
- Two frames on same board → both visible, independently draggable/resizable
- Dark mode → frame header stays navy, outlines correct

- [ ] **Step 17: Commit**

```bash
git add src/components/FrameworkOverlay.tsx src/components/Board.tsx src/hooks/useFrames.ts src/hooks/useFrames.test.ts src/types/index.ts
git rm src/hooks/useFramework.ts src/hooks/useFramework.test.ts
git commit -m "feat: multiple frames — drag, resize, type-switch, delete per frame"
```

---

## Final Verification

- [ ] `npm test` — 51 tests pass
- [ ] `npx tsc --noEmit` — no new errors
- [ ] Board with 0 frames → sidebar Add Frame button visible, canvas empty
- [ ] Board migrated from old single-framework → one frame at (60, 40)
- [ ] Two frames on same board → independent drag/resize/delete
- [ ] × button removes frame; keyboard Delete removes selected frame
- [ ] ▾ type picker changes type in place with default size reset
- [ ] Frame position and size survive page reload
