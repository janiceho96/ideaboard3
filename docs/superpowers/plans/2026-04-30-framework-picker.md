# Framework Picker & Resizable Matrix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a topbar dropdown to switch between Blank, Eisenhower Matrix, and OODA Loop frameworks, with a drag-resize handle on the framework overlay, all persisted per board in localStorage.

**Architecture:** A new `useFramework` hook owns localStorage persistence. A new `FrameworkOverlay` component renders the three framework variants. `Board.tsx` imports both, replaces the inline Eisenhower Matrix JSX, adds a dropdown button to the topbar, and extends its existing resize logic to handle framework resize via a `resizeTarget` ref.

**Tech Stack:** React 18, TypeScript, Vite, Vitest, localStorage.

---

## File Map

| File | Change |
|------|--------|
| `src/hooks/useFramework.ts` | New — loads/saves framework settings, exposes setType/setSize/commitSize |
| `src/hooks/useFramework.test.ts` | New — unit tests for `parseFrameworkSettings` pure function |
| `src/components/FrameworkOverlay.tsx` | New — renders blank/eisenhower/ooda with resize handle |
| `src/components/Board.tsx` | Import hook + overlay; replace inline matrix; add dropdown; add framework resize |

---

## Task 1: `useFramework` Hook

**Files:**
- Create: `src/hooks/useFramework.ts`
- Create: `src/hooks/useFramework.test.ts`

- [ ] **Step 1: Write the failing tests**

  Create `src/hooks/useFramework.test.ts`:

  ```typescript
  import { describe, it, expect } from 'vitest'
  import { parseFrameworkSettings } from './useFramework'

  describe('parseFrameworkSettings', () => {
    it('defaults to eisenhower with 640×540 when no stored value', () => {
      const result = parseFrameworkSettings(null)
      expect(result).toEqual({ type: 'eisenhower', width: 640, height: 540 })
    })

    it('restores stored eisenhower settings including custom size', () => {
      const stored = JSON.stringify({ type: 'eisenhower', width: 800, height: 700 })
      expect(parseFrameworkSettings(stored)).toEqual({ type: 'eisenhower', width: 800, height: 700 })
    })

    it('restores blank type with eisenhower default size', () => {
      const stored = JSON.stringify({ type: 'blank', width: 640, height: 540 })
      expect(parseFrameworkSettings(stored)).toEqual({ type: 'blank', width: 640, height: 540 })
    })

    it('defaults ooda size to 720×220 when size is missing', () => {
      const stored = JSON.stringify({ type: 'ooda' })
      const result = parseFrameworkSettings(stored)
      expect(result.type).toBe('ooda')
      expect(result.width).toBe(720)
      expect(result.height).toBe(220)
    })

    it('falls back to eisenhower for an unrecognised type string', () => {
      const stored = JSON.stringify({ type: 'kanban' })
      expect(parseFrameworkSettings(stored).type).toBe('eisenhower')
    })

    it('falls back to eisenhower for malformed JSON', () => {
      expect(parseFrameworkSettings('not-json').type).toBe('eisenhower')
    })
  })
  ```

- [ ] **Step 2: Run — expect FAIL**

  ```bash
  cd C:\Users\User\Downloads\ideaboard-v3\ideaboard3
  npm test
  ```

  Expected: FAIL — `parseFrameworkSettings` not found.

- [ ] **Step 3: Create `src/hooks/useFramework.ts`**

  ```typescript
  import { useState, useCallback } from 'react'

  export type FrameworkType = 'blank' | 'eisenhower' | 'ooda'

  export interface FrameworkSettings {
    type: FrameworkType
    width: number
    height: number
  }

  const VALID_TYPES: FrameworkType[] = ['blank', 'eisenhower', 'ooda']

  const DEFAULTS: Record<FrameworkType, { width: number; height: number }> = {
    blank:      { width: 640, height: 540 },
    eisenhower: { width: 640, height: 540 },
    ooda:       { width: 720, height: 220 },
  }

  export function parseFrameworkSettings(raw: string | null): FrameworkSettings {
    if (!raw) return { type: 'eisenhower', ...DEFAULTS.eisenhower }
    try {
      const parsed = JSON.parse(raw) as Partial<FrameworkSettings>
      const type: FrameworkType = VALID_TYPES.includes(parsed.type as FrameworkType)
        ? (parsed.type as FrameworkType)
        : 'eisenhower'
      return {
        type,
        width:  typeof parsed.width  === 'number' ? parsed.width  : DEFAULTS[type].width,
        height: typeof parsed.height === 'number' ? parsed.height : DEFAULTS[type].height,
      }
    } catch {
      return { type: 'eisenhower', ...DEFAULTS.eisenhower }
    }
  }

  function storageKey(boardId: string) {
    return `ideaboard_framework_${boardId}`
  }

  function save(boardId: string, s: FrameworkSettings) {
    localStorage.setItem(storageKey(boardId), JSON.stringify(s))
  }

  export function useFramework(boardId: string) {
    const [framework, setFramework] = useState<FrameworkSettings>(
      () => parseFrameworkSettings(localStorage.getItem(storageKey(boardId)))
    )

    const setType = useCallback((type: FrameworkType) => {
      setFramework(prev => {
        // Keep current size if switching to same type; otherwise use defaults
        const size = prev.type === type
          ? { width: prev.width, height: prev.height }
          : DEFAULTS[type]
        const next = { type, ...size }
        save(boardId, next)
        return next
      })
    }, [boardId])

    // Visual update during drag — does NOT save to localStorage
    const setSize = useCallback((width: number, height: number) => {
      setFramework(prev => ({ ...prev, width, height }))
    }, [])

    // Saves to localStorage — call on mouse-up
    const commitSize = useCallback((width: number, height: number) => {
      setFramework(prev => {
        const next = { ...prev, width, height }
        save(boardId, next)
        return next
      })
    }, [boardId])

    return { framework, setType, setSize, commitSize }
  }
  ```

- [ ] **Step 4: Run — expect PASS**

  ```bash
  npm test
  ```

  Expected:
  ```
  ✓ src/hooks/useFramework.test.ts (6)
  ✓ src/lib/db.test.ts (4)
  ✓ src/lib/snapPosition.test.ts (7)
  Test Files  3 passed (3)
  Tests  17 passed (17)
  ```

- [ ] **Step 5: Commit**

  ```bash
  git add src/hooks/useFramework.ts src/hooks/useFramework.test.ts
  git commit -m "feat: useFramework hook with localStorage persistence"
  ```

---

## Task 2: `FrameworkOverlay` Component

**Files:**
- Create: `src/components/FrameworkOverlay.tsx`

- [ ] **Step 1: Create `src/components/FrameworkOverlay.tsx`**

  ```typescript
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
  ```

- [ ] **Step 2: Verify TypeScript compiles**

  ```bash
  npx tsc --noEmit
  ```

  Expected: no errors.

- [ ] **Step 3: Commit**

  ```bash
  git add src/components/FrameworkOverlay.tsx
  git commit -m "feat: FrameworkOverlay component with Eisenhower, OODA, and Blank modes"
  ```

---

## Task 3: Integrate into `Board.tsx`

**Files:**
- Modify: `src/components/Board.tsx`

This task has three parts: (A) replace the inline matrix with `FrameworkOverlay`, (B) add the topbar dropdown, (C) add framework resize logic.

- [ ] **Step 1: Add imports and hook**

  At the top of `src/components/Board.tsx`, add two imports after the existing imports:

  ```typescript
  import { useFramework } from '../hooks/useFramework'
  import type { FrameworkType } from '../hooks/useFramework'
  import FrameworkOverlay from './FrameworkOverlay'
  ```

  Inside the `Board` component function, after `const brd = useBoard(board.id)`, add:

  ```typescript
  const fw = useFramework(board.id)
  ```

- [ ] **Step 2: Add resize constants and refs**

  Add these two constants alongside `CARD_MIN_W` and `CARD_MIN_H` (before the component function):

  ```typescript
  const FRAMEWORK_MIN_W = 400
  const FRAMEWORK_MIN_H = 200
  ```

  Inside the component, add a `resizeTarget` ref alongside the other resize refs (after `resizeStartH`):

  ```typescript
  const resizeTarget = useRef<'card' | 'framework'>('card')
  ```

  Also add a ref that always points to the latest `fw` object so the `useEffect` event handlers can call `setSize` / `commitSize` without stale closures:

  ```typescript
  const fwRef = useRef(fw)
  useEffect(() => { fwRef.current = fw })
  ```

- [ ] **Step 3: Add framework dropdown state**

  Alongside the other `useState` calls, add:

  ```typescript
  const [frameworkDropdownOpen, setFrameworkDropdownOpen] = useState(false)
  ```

- [ ] **Step 4: Add `onFrameworkResizeStart` handler**

  Add this callback alongside `onResizeStart` (the card resize handler):

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

- [ ] **Step 5: Update the `onMove` handler inside the `useEffect` to handle framework resize**

  Find the `onMove` function inside the `useEffect` (the one that starts with `const onMove = (e: MouseEvent) => {`). It currently ends with the resize card block:

  ```typescript
      if (isResizing.current && resizeCardId.current) {
        const dx = (e.clientX - resizeStartX.current) / zoom
        const dy = (e.clientY - resizeStartY.current) / zoom
        const newW = Math.max(CARD_MIN_W, resizeStartW.current + dx)
        const newH = resizeStartH.current !== null
          ? Math.max(CARD_MIN_H, resizeStartH.current + dy)
          : Math.max(CARD_MIN_H, 160 + dy)
        brd.resizeCard(resizeCardId.current, newW, newH)
      }
  ```

  Replace that block with:

  ```typescript
      if (isResizing.current) {
        const dx = (e.clientX - resizeStartX.current) / zoom
        const dy = (e.clientY - resizeStartY.current) / zoom
        if (resizeTarget.current === 'framework') {
          fwRef.current.setSize(
            Math.max(FRAMEWORK_MIN_W, resizeStartW.current + dx),
            Math.max(FRAMEWORK_MIN_H, (resizeStartH.current ?? 540) + dy),
          )
        } else if (resizeCardId.current) {
          const newW = Math.max(CARD_MIN_W, resizeStartW.current + dx)
          const newH = resizeStartH.current !== null
            ? Math.max(CARD_MIN_H, resizeStartH.current + dy)
            : Math.max(CARD_MIN_H, 160 + dy)
          brd.resizeCard(resizeCardId.current, newW, newH)
        }
      }
  ```

- [ ] **Step 6: Update the `onUp` handler to handle framework resize**

  Find the `onUp` function's resize block (starts with `if (isResizing.current && resizeCardId.current)`). Replace it with:

  ```typescript
      if (isResizing.current) {
        const dx = (e.clientX - resizeStartX.current) / zoom
        const dy = (e.clientY - resizeStartY.current) / zoom
        if (resizeTarget.current === 'framework') {
          fwRef.current.commitSize(
            Math.max(FRAMEWORK_MIN_W, resizeStartW.current + dx),
            Math.max(FRAMEWORK_MIN_H, (resizeStartH.current ?? 540) + dy),
          )
        } else if (resizeCardId.current) {
          const newW = Math.max(CARD_MIN_W, resizeStartW.current + dx)
          const newH = resizeStartH.current !== null
            ? Math.max(CARD_MIN_H, resizeStartH.current + dy)
            : Math.max(CARD_MIN_H, 160 + dy)
          brd.commitCardResize(resizeCardId.current, newW, newH)
        }
        isResizing.current = false
        resizeCardId.current = null
        resizeTarget.current = 'card'
      }
  ```

  Note: the original code had `isResizing.current = false; resizeCardId.current = null` at the end — make sure those are now inside the `if (isResizing.current)` block as shown above, and add `resizeTarget.current = 'card'` to reset it.

- [ ] **Step 7: Update the card `onResizeStart` callback to set `resizeTarget`**

  Find `const onResizeStart = useCallback(...)`. Add `resizeTarget.current = 'card'` at the start:

  ```typescript
  const onResizeStart = useCallback((id: string, cx: number, cy: number, startW: number, startH: number | null) => {
    resizeTarget.current  = 'card'
    isResizing.current    = true
    resizeCardId.current  = id
    resizeStartX.current  = cx
    resizeStartY.current  = cy
    resizeStartW.current  = startW
    resizeStartH.current  = startH
  }, [])
  ```

- [ ] **Step 8: Replace the inline Eisenhower Matrix with `<FrameworkOverlay>`**

  In the JSX, find this block (inside the world div):

  ```tsx
            {/* Eisenhower Matrix */}
            <div className="world-item" style={{ position: 'absolute', left: 60, top: 40, width: 640, height: 540 }}>
              <div style={{ display: 'flex', padding: '0 0 6px 56px' }}>
                ...entire matrix JSX...
              </div>
            </div>
  ```

  Replace the entire block (from `{/* Eisenhower Matrix */}` to its closing `</div>`) with:

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

- [ ] **Step 9: Add framework dropdown to the topbar**

  Find the topbar `<div>` (the one with `position: 'absolute', top: 0, ...`). It currently contains:

  ```tsx
          <span style={{ fontSize: 12, color: subC }}>Boards /</span>
          <span style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 14, color: txtC }}>{board.name}</span>
          <div style={{ flex: 1 }}/>
          <span style={{ fontSize: 11, ...hints... }}>Double-click to add…</span>
          <button ...>+ Add Card</button>
  ```

  After the board name `<span>` and before `<div style={{ flex: 1 }}/>`, insert:

  ```tsx
          {/* Framework picker dropdown */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setFrameworkDropdownOpen(o => !o)}
              style={{ height: 28, padding: '0 10px', borderRadius: 7, border: `1px solid ${dark ? '#2A2A38' : '#ddd'}`, background: dark ? '#1A1A24' : 'white', color: dark ? '#aaa' : '#555', cursor: 'pointer', fontSize: 11, fontFamily: "'DM Sans',sans-serif", display: 'flex', alignItems: 'center', gap: 5 }}
            >
              {fw.framework.type === 'blank'      && 'Blank Board'}
              {fw.framework.type === 'eisenhower' && 'Eisenhower Matrix'}
              {fw.framework.type === 'ooda'       && 'OODA Loop'}
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
                <div style={{ position: 'absolute', top: 34, left: 0, zIndex: 999, background: dark ? '#1A1A24' : 'white', border: `1px solid ${dark ? '#2A2A38' : '#ddd'}`, borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,.18)', overflow: 'hidden', minWidth: 190 }}>
                  {([
                    { key: 'blank',      label: 'Blank Board',        desc: 'Clean canvas, no overlay' },
                    { key: 'eisenhower', label: 'Eisenhower Matrix',  desc: 'Urgent / Important grid' },
                    { key: 'ooda',       label: 'OODA Loop',          desc: 'Observe → Orient → Decide → Act' },
                  ] as { key: FrameworkType; label: string; desc: string }[]).map(opt => (
                    <button
                      key={opt.key}
                      onClick={() => { fw.setType(opt.key); setFrameworkDropdownOpen(false) }}
                      style={{ display: 'block', width: '100%', padding: '10px 14px', border: 'none', background: fw.framework.type === opt.key ? (dark ? 'rgba(108,99,255,.15)' : 'rgba(108,99,255,.08)') : 'transparent', cursor: 'pointer', textAlign: 'left', fontFamily: "'DM Sans',sans-serif" }}
                    >
                      <div style={{ fontSize: 12, fontWeight: 600, color: fw.framework.type === opt.key ? '#6C63FF' : (dark ? '#ddd' : '#1A1A2E') }}>{opt.label}</div>
                      <div style={{ fontSize: 10, color: dark ? '#666' : '#999', marginTop: 1 }}>{opt.desc}</div>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
  ```

- [ ] **Step 10: Close dropdown on Escape**

  Find the keyboard shortcut `useEffect` and add a line for Escape:

  ```typescript
      if (e.key === 'Escape') { setColourPicker(null); setFrameworkDropdownOpen(false) }
  ```

  (Replace the existing single `setColourPicker(null)` line with this combined one.)

- [ ] **Step 11: Verify TypeScript compiles**

  ```bash
  npx tsc --noEmit
  ```

  Expected: no errors.

- [ ] **Step 12: Run all tests**

  ```bash
  npm test
  ```

  Expected:
  ```
  Test Files  3 passed (3)
  Tests  17 passed (17)
  ```

- [ ] **Step 13: Test manually in browser — open http://localhost:5180**

  Confirm:
  - Topbar shows a "Eisenhower Matrix ▾" button next to the board name
  - Clicking it opens a dropdown with three options
  - Selecting "Blank Board" hides the matrix overlay entirely
  - Selecting "OODA Loop" shows 4 coloured boxes (Observe → Orient → Decide → Act) with arrows
  - Selecting "Eisenhower Matrix" restores the grid
  - The resize handle (bottom-right grip) appears on the Eisenhower and OODA overlays
  - Dragging the handle resizes the overlay live
  - Reloading the page preserves both the chosen framework and its size

- [ ] **Step 14: Commit**

  ```bash
  git add src/components/Board.tsx
  git commit -m "feat: framework picker dropdown and resizable overlay in Board"
  ```

---

## Final Verification

- [ ] Switch from Eisenhower → Blank → OODA → Eisenhower; each switch instant, no errors
- [ ] Resize OODA loop wider; resize Eisenhower taller; reload — sizes preserved
- [ ] Card operations (drag, snap, duplicate, lock, colour pick) all still work on Blank board
- [ ] `npm test` — 17 tests pass
- [ ] `npx tsc --noEmit` — zero errors
