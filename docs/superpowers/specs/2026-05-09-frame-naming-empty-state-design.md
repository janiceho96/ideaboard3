# Frame Naming & Empty State — Design Spec

## Goal

Two small UI improvements:
1. Let users give each frame a custom name, shown alongside the framework type in the header.
2. Show a subtle hint on empty boards so new users know where to start.

---

## Scope

| File | Change |
|---|---|
| `src/types/index.ts` | Add `name?: string` to `FrameInstance` |
| `src/hooks/useFrames.ts` | Add `renameFrame(id, name)` method |
| `src/components/FrameworkOverlay.tsx` | Double-click label → inline edit input |
| `src/components/Board.tsx` | Render empty-state hint when board has no frames and no cards |

---

## Feature 1 — Frame Naming

### Data model

`FrameInstance` gains one optional field:

```typescript
export interface FrameInstance {
  id: string
  type: FrameworkType
  name?: string       // user-defined label; absent = use type label only
  x: number
  y: number
  width: number
  height: number
}
```

Existing frames with no `name` field continue to work unchanged — `name` is optional and absent by default.

### Hook

`useFrames` adds:

```typescript
renameFrame: (id: string, name: string) => void
```

Behaviour: trims whitespace; if the result is empty, deletes the `name` field from the frame (sets it to `undefined`). Saves to localStorage immediately (same pattern as `changeFrameType` and `deleteFrame`).

### Header label

The label `<span>` in `FrameworkOverlay` currently shows `FRAMEWORK_LABELS[type]`.

New logic:

```typescript
const label = frame.name
  ? `${FRAMEWORK_LABELS[type]} — ${frame.name}`
  : FRAMEWORK_LABELS[type]
```

Examples:
- No name → `"OKR"`
- Name set → `"OKR — My Q2 Goals"`

### Inline editing

The label `<span>` gains a `onDoubleClick` handler. When triggered:

1. A local `editing: boolean` state (inside `FrameworkOverlay`) flips to `true`
2. The `<span>` is replaced by an `<input>` pre-filled with `frame.name ?? ''`
3. The input is auto-focused (`autoFocus`)
4. On **Enter** (`onKeyDown`) or **blur** (`onBlur`): call `onRename(id, input.value)` and set `editing` to `false`
5. On **Escape** (`onKeyDown`): set `editing` to `false` without calling `onRename`

The input inherits the header's text style (white, small, monospace letter-spacing) and has no visible border — just a subtle underline (`borderBottom: '1px solid rgba(255,255,255,.4)'`, `background: transparent`).

The double-click target is the label span only, not the whole header bar. `e.stopPropagation()` prevents the canvas drag from firing.

### New prop

`FrameworkOverlay` gains one new prop:

```typescript
onRename: (id: string, name: string) => void
```

`Board.tsx` wires it: `onRename={(id, name) => frmRef.current.renameFrame(id, name)}`

---

## Feature 2 — Empty State

### Condition

Show when both are true:
- `frm.frames.length === 0`
- `brd.cards.length === 0`

### Render location

Inside `Board.tsx`, inside the canvas `<div>` but **outside** the world-transform `<div>` (the `worldRef` div). This keeps the hint centred in the viewport regardless of pan/zoom.

### Visual

```tsx
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
```

`pointerEvents: 'none'` ensures the hint never blocks canvas clicks. It disappears automatically as soon as `frm.frames` or `brd.cards` is non-empty.

---

## Testing

No automated tests needed for either feature:
- `renameFrame` is a straightforward localStorage write — same pattern as `changeFrameType`, which is not individually tested
- The empty state and inline edit are pure render — covered by manual smoke test

### Manual smoke test

**Frame naming:**
- Add a frame → double-click the label → type "My Goals" → press Enter → header shows "OKR — My Goals"
- Reload page → name persists
- Double-click → clear the text → press Enter → header shows just "OKR" again
- Double-click → type something → press Escape → name unchanged
- Change frame type via ▾ → name is preserved, type label updates

**Empty state:**
- Open a fresh board → centred hint is visible
- Add a frame → hint disappears
- Delete all frames (no cards) → hint reappears
- Add a card → hint disappears
- Delete the card (no frames) → hint reappears

---

## Out of Scope

- Showing the name in any list or export view
- Searching/filtering frames by name
- Character limit enforcement (browser's natural input behaviour is fine)
