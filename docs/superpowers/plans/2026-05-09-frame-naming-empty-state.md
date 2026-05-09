# Frame Naming & Empty State Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add optional custom names to frames (double-click the header label to edit) and show a centred hint on empty boards.

**Architecture:** Task 1 adds `name?: string` to `FrameInstance` and `renameFrame` to `useFrames`. Task 2 updates `FrameworkOverlay` to show the name in the header and enable inline editing, updates `Board.tsx` to wire the new prop and render the empty-state hint. Both tasks commit independently.

**Tech Stack:** React 18, TypeScript, localStorage, inline styles.

---

## File Map

| File | Change |
|---|---|
| `src/types/index.ts` | Add `name?: string` to `FrameInstance` |
| `src/hooks/useFrames.ts` | Add `renameFrame(id, name)` method |
| `src/components/FrameworkOverlay.tsx` | Add `onRename` prop, update label, inline edit input |
| `src/components/Board.tsx` | Pass `onRename`, add empty-state hint |

---

## Task 1: Data model + hook

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/hooks/useFrames.ts`

- [ ] **Step 1: Add `name` field to `FrameInstance`**

In `src/types/index.ts`, find:

```typescript
export interface FrameInstance {
  id: string
  type: FrameworkType
  x: number        // world-space position (inside the transformed worldRef div)
  y: number
  width: number    // world-space size
  height: number
}
```

Replace with:

```typescript
export interface FrameInstance {
  id: string
  type: FrameworkType
  name?: string     // user-defined label; absent = show type name only
  x: number        // world-space position (inside the transformed worldRef div)
  y: number
  width: number    // world-space size
  height: number
}
```

- [ ] **Step 2: Add `renameFrame` to `useFrames.ts`**

In `src/hooks/useFrames.ts`, find:

```typescript
  const deleteFrame = useCallback((id: string) => {
```

Immediately before that line, insert:

```typescript
  const renameFrame = useCallback((id: string, name: string) => {
    const trimmed = name.trim()
    setFrames(prev => {
      const next = prev.map(f =>
        f.id === id ? { ...f, name: trimmed || undefined } : f
      )
      save(boardId, next)
      return next
    })
  }, [boardId])

```

Then find the return statement:

```typescript
  return { frames, addFrame, moveFrame, commitFrameMove, setFrameSize, commitFrameResize, changeFrameType, deleteFrame }
```

Replace with:

```typescript
  return { frames, addFrame, moveFrame, commitFrameMove, setFrameSize, commitFrameResize, changeFrameType, renameFrame, deleteFrame }
```

- [ ] **Step 3: TypeScript check**

```bash
cd "C:\Users\User\Downloads\ideaboard-v3\ideaboard3"
npx tsc --noEmit
```

Expected: only the pre-existing `pdfImport.ts` TS2307, nothing new.

- [ ] **Step 4: Run full test suite**

```bash
cd "C:\Users\User\Downloads\ideaboard-v3\ideaboard3"
npm test
```

Expected: 45 passed.

- [ ] **Step 5: Commit**

```bash
cd "C:\Users\User\Downloads\ideaboard-v3\ideaboard3"
git add src/types/index.ts src/hooks/useFrames.ts
git commit -m "feat: add name field to FrameInstance and renameFrame to useFrames"
```

---

## Task 2: `FrameworkOverlay` + `Board.tsx`

These two files must change together — `FrameworkOverlay` gets a new required prop `onRename` which TypeScript will flag as missing in `Board.tsx` until it is passed.

**Files:**
- Modify: `src/components/FrameworkOverlay.tsx`
- Modify: `src/components/Board.tsx`

### Part A — FrameworkOverlay

- [ ] **Step 1: Add `onRename` to the props interface**

In `src/components/FrameworkOverlay.tsx`, find:

```typescript
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
```

Replace with:

```typescript
interface FrameworkOverlayProps {
  frame: FrameInstance
  dark: boolean
  selected: boolean
  onMoveStart: (id: string, e: React.MouseEvent) => void
  onResizeStart: (id: string, e: React.MouseEvent) => void
  onDelete: (id: string) => void
  onSelect: (id: string) => void
  onTypeChange: (id: string, type: FrameworkType) => void
  onRename: (id: string, name: string) => void
}
```

- [ ] **Step 2: Update the component function**

Find:

```typescript
export default function FrameworkOverlay({
  frame, dark, selected,
  onMoveStart, onResizeStart, onDelete, onSelect, onTypeChange,
}: FrameworkOverlayProps) {
  const [typePickerOpen, setTypePickerOpen] = useState(false)
  const { id, type, x, y, width, height } = frame
```

Replace with:

```typescript
export default function FrameworkOverlay({
  frame, dark, selected,
  onMoveStart, onResizeStart, onDelete, onSelect, onTypeChange, onRename,
}: FrameworkOverlayProps) {
  const [typePickerOpen, setTypePickerOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const { id, type, name, x, y, width, height } = frame
  const label = name ? `${FRAMEWORK_LABELS[type]} — ${name}` : FRAMEWORK_LABELS[type]
```

- [ ] **Step 3: Replace the label span with the editable version**

Find:

```tsx
        <span style={{
          flex: 1, fontSize: 9, letterSpacing: '0.07em',
          color: 'rgba(255,255,255,.8)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {FRAMEWORK_LABELS[type]}
        </span>
```

Replace with:

```tsx
        {editing ? (
          <input
            autoFocus
            defaultValue={name ?? ''}
            onBlur={e => { onRename(id, e.target.value); setEditing(false) }}
            onKeyDown={e => {
              if (e.key === 'Enter') { onRename(id, (e.target as HTMLInputElement).value); setEditing(false) }
              if (e.key === 'Escape') { setEditing(false) }
            }}
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
```

### Part B — Board.tsx

- [ ] **Step 4: Pass `onRename` to `<FrameworkOverlay>`**

In `src/components/Board.tsx`, find:

```tsx
                onTypeChange={(id, type) => frmRef.current.changeFrameType(id, type)}
              />
```

Replace with:

```tsx
                onTypeChange={(id, type) => frmRef.current.changeFrameType(id, type)}
                onRename={(id, name) => frmRef.current.renameFrame(id, name)}
              />
```

- [ ] **Step 5: Add the empty-state hint**

Find:

```tsx
          </div>{/* end world */}

          {/* ── HUD ── */}
```

Replace with:

```tsx
          </div>{/* end world */}

          {/* Empty state */}
          {frm.frames.length === 0 && brd.cards.length === 0 && (
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              pointerEvents: 'none',
              gap: 8,
            }}>
              <div style={{ fontSize: 28, opacity: 0.2, color: dark ? 'white' : '#263D5B' }}>✦</div>
              <div style={{ fontSize: 13, color: dark ? 'rgba(255,255,255,.25)' : 'rgba(38,61,91,.35)', letterSpacing: '0.03em' }}>
                Your board is empty
              </div>
              <div style={{ fontSize: 11, color: dark ? 'rgba(255,255,255,.15)' : 'rgba(38,61,91,.25)' }}>
                Click <span style={{ color: '#49B6E5', opacity: 0.7 }}>+</span> in the sidebar to add a frame
              </div>
            </div>
          )}

          {/* ── HUD ── */}
```

### Part C — Verify and commit

- [ ] **Step 6: TypeScript check**

```bash
cd "C:\Users\User\Downloads\ideaboard-v3\ideaboard3"
npx tsc --noEmit
```

Expected: only the pre-existing `pdfImport.ts` TS2307, nothing new.

- [ ] **Step 7: Run full test suite**

```bash
cd "C:\Users\User\Downloads\ideaboard-v3\ideaboard3"
npm test
```

Expected: 45 passed.

- [ ] **Step 8: Manual smoke test**

Run `npm run dev` and open `http://localhost:5180`.

**Frame naming:**
- Add a frame → double-click the header label → type "My Goals" → press Enter → header shows "OKR — My Goals"
- Reload page → name persists
- Double-click → clear the text → press Enter → header shows "OKR" again
- Double-click → type something → press Escape → name unchanged
- Change frame type via ▾ → name is preserved, only the type label changes

**Empty state:**
- Open a fresh board → centred hint is visible (✦ icon, two lines of text)
- Add a frame → hint disappears
- Delete all frames (no cards) → hint reappears
- Add a card → hint disappears
- Dark mode → hint text is visible (lighter colour)

- [ ] **Step 9: Commit**

```bash
cd "C:\Users\User\Downloads\ideaboard-v3\ideaboard3"
git add src/components/FrameworkOverlay.tsx src/components/Board.tsx
git commit -m "feat: frame naming (double-click to edit) and empty board hint"
```

---

## Final Verification

- [ ] `npm test` — 45 tests pass
- [ ] `npx tsc --noEmit` — no new errors
- [ ] Double-clicking frame label opens inline input; Enter saves; Escape cancels
- [ ] Name persists after page reload
- [ ] Empty name clears back to type-only label
- [ ] Empty board shows centred hint; hint disappears when anything is added
