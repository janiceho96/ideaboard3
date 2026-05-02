# UX Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the broken PDF export, add JSON card backup/restore, and add keyboard shortcuts for canvas navigation (Ctrl+drag, arrow keys, zoom, Delete, Escape, and a `?` help overlay).

**Architecture:** All changes are in `src/components/Board.tsx` plus a `bulkImportCards` method added to `src/hooks/useBoard.ts`. No new files needed. Keyboard logic extends the existing `window` keydown useEffect. Ctrl+drag extends the existing `onCanvasMouseDown` / mousemove / mouseup handlers. The shortcuts overlay is a `position:fixed` panel rendered at the bottom-right of the viewport.

**Tech Stack:** React 18, TypeScript, Vite, vitest (tests run in node environment — Board.tsx has no unit tests, verification is `npx tsc --noEmit` + `npm test`)

---

## File Map

| File | Change |
|---|---|
| `src/hooks/useBoard.ts` | Add `bulkImportCards(inserts: CardInsert[])` method |
| `src/components/Board.tsx` | Fix export; add JSON export/import; Ctrl+drag pan; arrow key nav; zoom shortcuts; card selection; Delete/Escape; `?` overlay; topbar hint update |

---

## Task 1: Fix PDF export

**Files:**
- Modify: `src/components/Board.tsx` lines 419–445

The `exportPDF` function currently captures `worldRef` — the entire transformed world div — which can be arbitrarily large and causes html2canvas to silently fail. Fix by capturing `canvasRef` (the visible viewport). Also add `console.error` in the catch block so failures are diagnosable.

- [ ] **Step 1: Replace the html2canvas capture target**

In `src/components/Board.tsx`, find the `exportPDF` function (around line 419). Replace the `html2canvas` call so it captures `canvasRef.current!` instead of `worldRef.current`:

```typescript
const exportPDF = async () => {
  if (!canvasRef.current) return
  setExporting(true)
  showToast('Generating PDF…')
  try {
    const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
      import('html2canvas'),
      import('jspdf'),
    ])
    const canvas = await html2canvas(canvasRef.current, {
      scale: 1.5,
      backgroundColor: dark ? '#0F0F14' : '#faf8f0',
      useCORS: true,
      logging: false,
    })
    const imgData = canvas.toDataURL('image/png')
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'px', format: [canvas.width, canvas.height] })
    pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height)
    pdf.save(`${board.name}.pdf`)
    showToast('PDF downloaded ✓')
  } catch (err) {
    console.error('Export failed:', err)
    showToast('Export failed — try again')
  } finally {
    setExporting(false)
  }
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no new errors (ignore the pre-existing `TS2307` in `pdfImport.ts`).

- [ ] **Step 3: Run tests**

```bash
npm test
```

Expected: all ~30 tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/components/Board.tsx
git commit -m "fix: export PDF captures visible canvas viewport instead of world div"
```

---

## Task 2: Add bulkImportCards to useBoard

**Files:**
- Modify: `src/hooks/useBoard.ts`

`brd.addCard` adds cards one-at-a-time, applies random rotation, and uses default width 185 — which would lose preserved card dimensions on import. A bulk method pushes history once, preserves all card fields, and updates React state in one go.

- [ ] **Step 1: Add `bulkImportCards` to the return type interface**

In `src/hooks/useBoard.ts`, find the `UseBoardReturn` interface (line 6). Add one line:

```typescript
interface UseBoardReturn {
  cards: Card[]
  goalTags: GoalTag[]
  boardId: string | null
  boardName: string
  loading: boolean
  error: string | null
  addCard: (title: string, body: string, dateLabel: string, dueDate: string | null, tag: TagType, bg: string, worldX: number, worldY: number) => Promise<void>
  updateCard: (id: string, changes: Partial<Card>) => Promise<void>
  moveCard: (id: string, x: number, y: number) => void
  commitCardMove: (id: string, x: number, y: number) => Promise<void>
  resizeCard: (id: string, w: number, h: number | null) => void
  commitCardResize: (id: string, w: number, h: number | null) => Promise<void>
  removeCard: (id: string) => Promise<void>
  duplicateCard: (id: string) => Promise<void>
  bulkImportCards: (inserts: import('../types').CardInsert[]) => Promise<void>
  moveGoalTag: (id: string, x: number, y: number) => void
  commitGoalTagMove: (id: string, x: number, y: number) => Promise<void>
  removeGoalTag: (id: string) => Promise<void>
  undo: () => void
  canUndo: boolean
}
```

- [ ] **Step 2: Add the `bulkImportCards` implementation**

In `src/hooks/useBoard.ts`, after the `duplicateCard` `useCallback` (around line 138), add:

```typescript
const bulkImportCards = useCallback(async (inserts: CardInsert[]) => {
  if (!activeBoardId) return
  setCards(prev => { pushHistory(prev, goalTags); return prev })
  const newCards = await Promise.all(inserts.map(insert => db.createCard(insert)))
  setCards(prev => [...prev, ...newCards])
}, [activeBoardId, goalTags, pushHistory])
```

- [ ] **Step 3: Add `bulkImportCards` to the return statement**

In `src/hooks/useBoard.ts`, find the `return {` at the bottom. Add `bulkImportCards` to it:

```typescript
return {
  cards, goalTags,
  boardId: activeBoardId, boardName, loading, error,
  addCard, updateCard, moveCard, commitCardMove,
  resizeCard, commitCardResize, removeCard, duplicateCard,
  bulkImportCards,
  moveGoalTag, commitGoalTagMove, removeGoalTag,
  undo, canUndo,
}
```

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit
```

Expected: no new errors.

- [ ] **Step 5: Run tests**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useBoard.ts
git commit -m "feat: add bulkImportCards to useBoard — preserves card dimensions, single history push"
```

---

## Task 3: JSON card export

**Files:**
- Modify: `src/components/Board.tsx`

Add an `exportCards` function and a sidebar button with a download icon.

- [ ] **Step 1: Add the `exportCards` function**

In `src/components/Board.tsx`, after the `exportPDF` function (after line ~445), add:

```typescript
// ── JSON card export ────────────────────────────────────────
const exportCards = () => {
  const slug = board.name.replace(/[^a-z0-9]/gi, '-').toLowerCase()
  const date = new Date().toISOString().slice(0, 10)
  const data = {
    exportedAt: new Date().toISOString(),
    boardName: board.name,
    cards: brd.cards,
  }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${slug}-${date}.json`
  a.click()
  URL.revokeObjectURL(url)
  showToast('Cards exported ✓')
}
```

- [ ] **Step 2: Add the sidebar button**

In `src/components/Board.tsx`, find the sidebar section. After the existing `SbBtn` for "Export as PDF" (around line 513), add a new button for JSON export:

```tsx
<SbBtn title="Export cards as JSON backup" onClick={exportCards} dark={dark}>
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
    <line x1="12" y1="18" x2="12" y2="12"/><polyline points="9 15 12 18 15 15"/>
  </svg>
</SbBtn>
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/Board.tsx
git commit -m "feat: export cards as JSON backup file"
```

---

## Task 4: JSON card import

**Files:**
- Modify: `src/components/Board.tsx`

Add an `importCards` function, a hidden file input ref, and a sidebar button.

- [ ] **Step 1: Add the `jsonInputRef` ref**

In `src/components/Board.tsx`, near line 99 where `pdfInputRef` is declared, add:

```typescript
const jsonInputRef = useRef<HTMLInputElement>(null)
```

- [ ] **Step 2: Add the `importCards` function**

After the `exportCards` function added in Task 3, add:

```typescript
// ── JSON card import ────────────────────────────────────────
const importCards = async (files: FileList | null) => {
  if (!files || !files.length) return
  const file = files[0]
  try {
    const text = await file.text()
    const data = JSON.parse(text)
    if (!Array.isArray(data.cards)) throw new Error('missing cards array')
    const inserts: import('../types').CardInsert[] = data.cards.map((c: import('../types').Card) => ({
      board_id: board.id,
      title: c.title ?? '',
      body: c.body ?? '',
      date_label: c.date_label ?? '',
      due_date: c.due_date ?? null,
      tag: c.tag ?? 'idea',
      bg: c.bg ?? 'white',
      x: typeof c.x === 'number' ? c.x : 100,
      y: typeof c.y === 'number' ? c.y : 100,
      rotation: typeof c.rotation === 'number' ? c.rotation : 0,
      card_width: typeof c.card_width === 'number' ? c.card_width : 185,
      card_height: typeof c.card_height === 'number' ? c.card_height : null,
      collapsed: c.collapsed ?? false,
      locked: c.locked ?? false,
    }))
    await brd.bulkImportCards(inserts)
    showToast(`Imported ${inserts.length} card${inserts.length !== 1 ? 's' : ''} ✓`)
  } catch {
    showToast("Could not read file — make sure it's a valid Ideaboard export")
  }
}
```

- [ ] **Step 3: Add the sidebar button and hidden file input**

In the sidebar, after the JSON export button added in Task 3, add:

```tsx
<SbBtn title="Import cards from JSON backup" onClick={() => jsonInputRef.current?.click()} dark={dark}>
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
    <line x1="12" y1="12" x2="12" y2="18"/><polyline points="15 15 12 12 9 15"/>
  </svg>
</SbBtn>
<input
  ref={jsonInputRef}
  type="file"
  accept=".json"
  style={{ display: 'none' }}
  onChange={e => { importCards(e.target.files); e.target.value = '' }}
/>
```

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit
```

Expected: no new errors.

- [ ] **Step 5: Run tests**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/Board.tsx
git commit -m "feat: import cards from JSON backup — non-destructive, preserves positions and dimensions"
```

---

## Task 5: Ctrl+drag canvas pan

**Files:**
- Modify: `src/components/Board.tsx`

When the user holds Ctrl and mousedowns on the canvas background (not on a card), the canvas pans as they drag. A `ctrlHeld` state controls the cursor. An `isCtrlPanning` ref (similar to `isPanning`) drives the mousemove/mouseup handlers.

- [ ] **Step 1: Add state and refs**

In `src/components/Board.tsx`, after the existing pan refs (around lines 59–61), add:

```typescript
const isCtrlPanning  = useRef(false)
const ctrlPanStart   = useRef({ x: 0, y: 0, px: 0, py: 0 })
const [ctrlHeld, setCtrlHeld] = useState(false)
```

- [ ] **Step 2: Track Ctrl key state for cursor**

Add a `useEffect` after the existing keyboard shortcuts `useEffect` (around line 396):

```typescript
useEffect(() => {
  const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Control') setCtrlHeld(true) }
  const onKeyUp   = (e: KeyboardEvent) => { if (e.key === 'Control') { setCtrlHeld(false); isCtrlPanning.current = false } }
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup',   onKeyUp)
  return () => { window.removeEventListener('keydown', onKeyDown); window.removeEventListener('keyup', onKeyUp) }
}, [])
```

- [ ] **Step 3: Modify `onCanvasMouseDown` to intercept Ctrl+click**

Replace the existing `onCanvasMouseDown` function (around line 132) with:

```typescript
const onCanvasMouseDown = (e: React.MouseEvent) => {
  if (e.button !== 0) return
  if ((e.target as HTMLElement).closest('.world-item')) return
  if (e.ctrlKey) {
    isCtrlPanning.current = true
    ctrlPanStart.current = { x: e.clientX, y: e.clientY, px: panX, py: panY }
    e.preventDefault()
    return
  }
  isPanning.current = true
  panStart.current = { x: e.clientX, y: e.clientY, px: panX, py: panY }
  e.preventDefault()
}
```

- [ ] **Step 4: Add Ctrl-pan branch to the mousemove handler**

In the global `useEffect` that registers `onMove` (around line 283), add the `isCtrlPanning` branch at the top of `onMove`, before the existing `isPanning` check:

```typescript
const onMove = (e: MouseEvent) => {
  if (isCtrlPanning.current) {
    setPanX(ctrlPanStart.current.px + (e.clientX - ctrlPanStart.current.x))
    setPanY(ctrlPanStart.current.py + (e.clientY - ctrlPanStart.current.y))
    return
  }
  if (isPanning.current) {
    // ... existing isPanning logic unchanged
```

- [ ] **Step 5: Add Ctrl-pan stop to the mouseup handler**

In the same `useEffect`, add a stop branch to `onUp` before the existing `isPanning` stop:

```typescript
const onUp = (_e: MouseEvent) => {
  if (isCtrlPanning.current) { isCtrlPanning.current = false; return }
  if (isPanning.current) { isPanning.current = false; return }
  // ... rest of existing onUp unchanged
```

- [ ] **Step 6: Apply cursor to canvas div**

Find the canvas `<div>` with `cursor: 'crosshair'` (around line 619). Change the cursor line to:

```typescript
cursor: ctrlHeld ? 'grab' : 'crosshair',
```

- [ ] **Step 7: Type-check**

```bash
npx tsc --noEmit
```

Expected: no new errors.

- [ ] **Step 8: Run tests**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 9: Commit**

```bash
git add src/components/Board.tsx
git commit -m "feat: Ctrl+drag to pan canvas — grab cursor when Ctrl held"
```

---

## Task 6: Arrow key navigation + zoom keyboard shortcuts

**Files:**
- Modify: `src/components/Board.tsx`

Extend the existing keyboard `useEffect`. Arrow keys pan the canvas (20px per press, 100px with Shift). `+`/`=` zooms in, `-` zooms out, `0` resets zoom. A `zoomRef` keeps the current zoom value accessible inside the event handler without making it a dependency.

- [ ] **Step 1: Add `zoomRef` to keep zoom accessible in keyboard handler**

After the canvas refs (around line 55), add:

```typescript
const zoomRef = useRef(zoom)
useEffect(() => { zoomRef.current = zoom }, [zoom])
```

- [ ] **Step 2: Extend the keyboard `useEffect`**

Find the existing keyboard `useEffect` (around line 382). Replace the entire `onKey` function inside it with:

```typescript
const onKey = (e: KeyboardEvent) => {
  const target = e.target as HTMLElement
  if (target.closest('input,textarea,[contenteditable]')) return
  if ((e.ctrlKey || e.metaKey) && e.key === 'z') { brd.undo(); showToast('Undone ↩'); return }

  // Arrow key pan
  if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)) {
    if (e.ctrlKey || e.metaKey) return  // let browser handle Ctrl+arrow
    e.preventDefault()
    const step = e.shiftKey ? 100 : 20
    if (e.key === 'ArrowLeft')  setPanX(px => px + step)
    if (e.key === 'ArrowRight') setPanX(px => px - step)
    if (e.key === 'ArrowUp')    setPanY(py => py + step)
    if (e.key === 'ArrowDown')  setPanY(py => py - step)
    return
  }

  // Zoom shortcuts
  if ((e.key === '+' || e.key === '=') && !e.ctrlKey && !e.metaKey) {
    e.preventDefault()
    const cr = canvasRef.current?.getBoundingClientRect()
    if (!cr) return
    const cx = cr.width / 2, cy = cr.height / 2
    const nz = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoomRef.current * 1.2))
    setPanX(px => cx - (cx - px) * (nz / zoomRef.current))
    setPanY(py => cy - (cy - py) * (nz / zoomRef.current))
    setZoom(nz)
    return
  }
  if (e.key === '-' && !e.ctrlKey && !e.metaKey) {
    e.preventDefault()
    const cr = canvasRef.current?.getBoundingClientRect()
    if (!cr) return
    const cx = cr.width / 2, cy = cr.height / 2
    const nz = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoomRef.current * 0.8))
    setPanX(px => cx - (cx - px) * (nz / zoomRef.current))
    setPanY(py => cy - (cy - py) * (nz / zoomRef.current))
    setZoom(nz)
    return
  }
  if (e.key === '0' && !e.ctrlKey && !e.metaKey) {
    e.preventDefault()
    setPanX(0); setPanY(0); setZoom(1)
    return
  }

  if (e.key === 'Escape') { setColourPicker(null); setFrameworkDropdownOpen(false) }
  if (e.key === 'n' && !e.ctrlKey && !e.metaKey) {
    const cr = canvasRef.current?.getBoundingClientRect()
    if (cr) { newCardWorld.current = screenToWorld(cr.left + cr.width / 2, cr.top + cr.height / 2); setEditingCard(null); setModalOpen(true) }
  }
}
```

Keep the dependency array unchanged: `[brd, screenToWorld]`. The `setPanX`/`setPanY`/`setZoom` setters are stable and don't need to be listed. `canvasRef` is a ref and is also stable.

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Expected: no new errors.

- [ ] **Step 4: Run tests**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/Board.tsx
git commit -m "feat: arrow key canvas pan (20px / 100px with Shift) and +/-/0 zoom shortcuts"
```

---

## Task 7: Card selection + Escape/Delete shortcuts

**Files:**
- Modify: `src/components/Board.tsx`

Add a `selectedCardId` state. Clicking a card (via `onCardMoveStart`) selects it. Clicking the canvas background deselects it. A thin blue ring renders around the selected card in world space. `Delete`/`Backspace` deletes the selected card. `Escape` deselects.

- [ ] **Step 1: Add `selectedCardId` state**

Near the other `useState` declarations (around line 84), add:

```typescript
const [selectedCardId, setSelectedCardId] = useState<string | null>(null)
```

- [ ] **Step 2: Set selection when a card drag starts**

In the `onCardMoveStart` callback (around line 140), add `setSelectedCardId(id)` as the first line inside the callback:

```typescript
const onCardMoveStart = useCallback((id: string, cx: number, cy: number) => {
  setSelectedCardId(id)
  isDragging.current  = true
  // ... rest unchanged
```

- [ ] **Step 3: Clear selection on canvas background click**

In `onCanvasMouseDown` (modified in Task 5), add `setSelectedCardId(null)` in both branches (ctrl-pan and normal pan):

```typescript
const onCanvasMouseDown = (e: React.MouseEvent) => {
  if (e.button !== 0) return
  if ((e.target as HTMLElement).closest('.world-item')) return
  setSelectedCardId(null)
  if (e.ctrlKey) {
    isCtrlPanning.current = true
    ctrlPanStart.current = { x: e.clientX, y: e.clientY, px: panX, py: panY }
    e.preventDefault()
    return
  }
  isPanning.current = true
  panStart.current = { x: e.clientX, y: e.clientY, px: panX, py: panY }
  e.preventDefault()
}
```

- [ ] **Step 4: Render selection ring in the world div**

In the world div, after the snap ghost block (around line 706), add the selection ring:

```tsx
{/* Selection ring */}
{selectedCardId && (() => {
  const card = brd.cards.find(c => c.id === selectedCardId)
  if (!card) return null
  return (
    <div style={{
      position: 'absolute',
      left: card.x - 5,
      top: card.y - 5,
      width: (card.card_width ?? 185) + 10,
      height: card.card_height ? card.card_height + 10 : undefined,
      minHeight: card.card_height ? undefined : 110,
      border: '2px solid #49B6E5',
      borderRadius: 18,
      pointerEvents: 'none',
      zIndex: 21,
      boxSizing: 'border-box',
      boxShadow: '0 0 0 3px rgba(73,182,229,0.15)',
    }} />
  )
})()}
```

- [ ] **Step 5: Add Escape deselect and Delete/Backspace card deletion to keyboard handler**

In the `onKey` function modified in Task 6, update the `Escape` line and add `Delete`/`Backspace`:

```typescript
if (e.key === 'Escape') {
  setColourPicker(null)
  setFrameworkDropdownOpen(false)
  setSelectedCardId(null)
  setModalOpen(false)
}
if ((e.key === 'Delete' || e.key === 'Backspace') && !e.ctrlKey && !e.metaKey) {
  if (selectedCardId) {
    e.preventDefault()
    brd.removeCard(selectedCardId).then(() => showToast('Card deleted'))
    setSelectedCardId(null)
  }
}
```

Because `selectedCardId` is now used inside the keyboard `useEffect`, add it to the dependency array:

```typescript
}, [brd, screenToWorld, selectedCardId])
```

- [ ] **Step 6: Type-check**

```bash
npx tsc --noEmit
```

Expected: no new errors.

- [ ] **Step 7: Run tests**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 8: Commit**

```bash
git add src/components/Board.tsx
git commit -m "feat: card selection ring with Delete/Backspace to remove and Escape to deselect"
```

---

## Task 8: Shortcuts help overlay

**Files:**
- Modify: `src/components/Board.tsx`

A `showShortcuts` state toggles a fixed-position panel at the bottom-right. Press `?` to toggle it. It lists all shortcuts in two sections: Navigation and Cards.

- [ ] **Step 1: Add `showShortcuts` state**

Near the other `useState` declarations, add:

```typescript
const [showShortcuts, setShowShortcuts] = useState(false)
```

- [ ] **Step 2: Add `?` key to the keyboard handler**

In the `onKey` function, after the `n` shortcut block, add:

```typescript
if (e.key === '?') { e.preventDefault(); setShowShortcuts(s => !s) }
```

- [ ] **Step 3: Also close the overlay on Escape**

In the `Escape` block of `onKey`, add `setShowShortcuts(false)`:

```typescript
if (e.key === 'Escape') {
  setColourPicker(null)
  setFrameworkDropdownOpen(false)
  setSelectedCardId(null)
  setModalOpen(false)
  setShowShortcuts(false)
}
```

Add `showShortcuts` is not needed in the `useEffect` deps since `setShowShortcuts` setter is stable — no change to dependency array needed beyond what Task 7 added.

- [ ] **Step 4: Add `Fragment` to the React import**

In `src/components/Board.tsx` line 2, add `Fragment` to the named imports from `'react'`:

```typescript
import { useState, useRef, useEffect, useCallback, Fragment } from 'react'
```

- [ ] **Step 5: Render the shortcuts overlay**

In `src/components/Board.tsx`, just before the closing `</div>` of the root div (before the final `}`), add the overlay after the toast:

```tsx
{/* Keyboard shortcuts overlay */}
{showShortcuts && (
  <div style={{
    position: 'fixed',
    right: 20,
    bottom: 80,
    zIndex: 500,
    background: 'rgba(26,26,46,0.95)',
    backdropFilter: 'blur(8px)',
    borderRadius: 12,
    padding: '16px 20px',
    color: '#fff',
    fontSize: 13,
    width: 290,
    boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
    fontFamily: "'DM Sans',sans-serif",
  }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
      <span style={{ fontWeight: 700, fontSize: 14 }}>Keyboard Shortcuts</span>
      <button
        onClick={() => setShowShortcuts(false)}
        style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: 0 }}
      >×</button>
    </div>

    <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, opacity: 0.5, marginBottom: 8 }}>Navigation</div>
    <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 14px', alignItems: 'center', marginBottom: 14 }}>
      {([
        ['Ctrl + drag', 'Pan with mouse'],
        ['↑ ↓ ← →',    'Pan canvas'],
        ['Shift + arrows', 'Pan faster'],
        ['+  /  -',    'Zoom in / out'],
        ['0',          'Reset zoom'],
      ] as [string, string][]).map(([key, desc], i) => (
        <Fragment key={i}>
          <span style={{ background: '#263D5B', padding: '2px 7px', borderRadius: 4, fontFamily: 'monospace', fontSize: 12, whiteSpace: 'nowrap', textAlign: 'center' }}>{key}</span>
          <span style={{ opacity: 0.85 }}>{desc}</span>
        </Fragment>
      ))}
    </div>

    <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, opacity: 0.5, marginBottom: 8 }}>Cards</div>
    <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 14px', alignItems: 'center', marginBottom: 14 }}>
      {([
        ['N',        'New card'],
        ['Esc',      'Deselect / close'],
        ['Delete',   'Delete selected card'],
        ['Ctrl + Z', 'Undo'],
      ] as [string, string][]).map(([key, desc], i) => (
        <Fragment key={i}>
          <span style={{ background: '#263D5B', padding: '2px 7px', borderRadius: 4, fontFamily: 'monospace', fontSize: 12, whiteSpace: 'nowrap', textAlign: 'center' }}>{key}</span>
          <span style={{ opacity: 0.85 }}>{desc}</span>
        </Fragment>
      ))}
    </div>

    <div style={{ opacity: 0.4, fontSize: 11, borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 10 }}>
      Press <span style={{ fontFamily: 'monospace' }}>?</span> to close
    </div>
  </div>
)}
```

- [ ] **Step 6: Type-check**

```bash
npx tsc --noEmit
```

Expected: no new errors.

- [ ] **Step 7: Run tests**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 8: Commit**

```bash
git add src/components/Board.tsx
git commit -m "feat: keyboard shortcuts overlay — press ? to toggle, Escape to close"
```

---

## Task 9: Update topbar hint text + add ? button to HUD

**Files:**
- Modify: `src/components/Board.tsx`

Update the topbar hint text to mention the new shortcuts. Add a small `?` button to the HUD so mouse-only users can discover the shortcuts overlay.

- [ ] **Step 1: Update the topbar hint**

Find the topbar hint `<span>` (around line 597):

```tsx
<span style={{ fontSize: 11, color: subC, background: dark ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.05)', padding: '3px 8px', borderRadius: 6 }}>
  Double-click to add · Scroll to zoom · Drag to pan · N = new card
</span>
```

Replace with:

```tsx
<span style={{ fontSize: 11, color: subC, background: dark ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.05)', padding: '3px 8px', borderRadius: 6 }}>
  Double-click to add · Scroll to zoom · Ctrl+drag to pan · Press ? for shortcuts
</span>
```

- [ ] **Step 2: Add a `?` button to the HUD zoom controls**

Find the zoom controls HUD (around line 713). After the closing `</div>` of the zoom controls widget, add a `?` button:

```tsx
{/* Shortcuts hint button */}
<button
  onClick={() => setShowShortcuts(s => !s)}
  title="Keyboard shortcuts (?)"
  style={{ position:'absolute', right:18, bottom:160, width:34, height:34, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', fontSize:14, fontWeight:700, color: dark?'#ccc':'#555', background: dark?'#1A1A24':'white', borderRadius:9, border:`1px solid ${dark?'#2A2A38':'rgba(0,0,0,.1)'}`, boxShadow:'0 2px 8px rgba(0,0,0,.1)', zIndex:50 }}
>?</button>
```

- [ ] **Step 3: Final type-check**

```bash
npx tsc --noEmit
```

Expected: no new errors (and the pre-existing `TS2307` in `pdfImport.ts` is acceptable).

- [ ] **Step 4: Final test run**

```bash
npm test
```

Expected: all ~30 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/Board.tsx
git commit -m "feat: update topbar hints and add HUD button for shortcuts overlay"
```

---

## Done

All tasks complete. The app now has:
- ✅ Working PDF export (captures visible viewport)
- ✅ Export cards as JSON backup
- ✅ Import cards from JSON backup (preserves positions, sizes, non-destructive)
- ✅ Ctrl+drag to pan canvas with grab cursor
- ✅ Arrow keys to pan (20px / 100px with Shift)
- ✅ +/- to zoom, 0 to reset
- ✅ Click card to select it; Delete/Backspace to remove; Escape to deselect
- ✅ ? to toggle shortcuts overlay; × or Escape to close
- ✅ ? button in HUD for discoverability
