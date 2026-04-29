# Framework Picker & Resizable Matrix — Design Spec

## Goal

Let users switch between board frameworks (Blank, Eisenhower Matrix, OODA Loop) from a topbar dropdown, and drag-resize the Eisenhower Matrix. All choices persist per board in localStorage.

## Features

### 1. Framework Picker (Topbar Dropdown)

A small pill button sits in the topbar, right after the board name. It shows the current framework name and a ▾ chevron. Clicking it opens a small dropdown panel with three options:

| Key | Label | Description |
|-----|-------|-------------|
| `blank` | Blank Board | No overlay — pure dotted canvas |
| `eisenhower` | Eisenhower Matrix | 2×2 grid: Do First / Schedule / Delegate / Eliminate |
| `ooda` | OODA Loop | Flow diagram: Observe → Orient → Decide → Act |

Clicking an option closes the dropdown and switches immediately. Pressing Escape or clicking outside also closes the dropdown.

The default framework for new boards is `eisenhower` (preserves current behaviour).

### 2. Blank Board

When `framework === 'blank'`, the framework overlay div is simply not rendered. The canvas shows only the dotted background and cards.

### 3. OODA Loop Framework

A four-box horizontal flow diagram rendered on the canvas at the same position as the Eisenhower Matrix:

```
[ Observe ] → [ Orient ] → [ Decide ] → [ Act ]
```

Each box is a rounded rectangle with a coloured header and a large body area for cards. Arrows between boxes are SVG lines with arrowheads. The overall frame is resizable the same way as the Eisenhower Matrix.

Box colours:
- Observe: `#D0E8FF` (blue)
- Orient: `#FFF9C4` (yellow)
- Decide: `#D4EDD8` (green)
- Act: `#FFD6C2` (peach)

### 4. Resizable Matrix / OODA Frame

A resize handle (bottom-right corner, same SVG grip icon as cards) is placed on the framework overlay. Dragging it resizes the entire framework freely (width and height independently):

- Minimum size: 400 × 300 world-px
- Default Eisenhower size: 640 × 540 world-px
- Default OODA size: 720 × 220 world-px
- Resize is live (updates while dragging), saved to localStorage on mouse-up

The resize interacts with the existing mouse event system in `Board.tsx` (same `isResizing` / `onMove` / `onUp` pattern used for cards).

---

## Data Model

A new localStorage key per board stores framework settings:

```
ideaboard_framework_${boardId}  →  JSON: { type: 'blank'|'eisenhower'|'ooda', width: number, height: number }
```

This is separate from the main cards/boards/tags keys. No changes to the `Card`, `Board`, or `GoalTag` types.

A new `useFramework(boardId)` hook owns this state:

```typescript
interface FrameworkSettings {
  type: 'blank' | 'eisenhower' | 'ooda'
  width: number
  height: number
}

// Returns:
{
  framework: FrameworkSettings
  setFrameworkType: (type: FrameworkType) => void
  setFrameworkSize: (width: number, height: number) => void
}
```

---

## Architecture

### Files created
- `src/hooks/useFramework.ts` — loads/saves framework settings for a board
- `src/components/FrameworkOverlay.tsx` — renders the chosen framework (blank = null, eisenhower = existing matrix JSX, ooda = new flow diagram)

### Files modified
- `src/components/Board.tsx`
  - Import and use `useFramework`
  - Replace inline Eisenhower Matrix JSX with `<FrameworkOverlay>`
  - Add dropdown state + render dropdown button in topbar
  - Add framework resize handling (reuse `isResizing` ref pattern with a `resizeTarget: 'card' | 'framework'` distinction)

### Resize implementation detail

`Board.tsx` currently uses `isResizing`, `resizeCardId`, `resizeStartX/Y/W/H` refs for card resize. Framework resize reuses the same `onMove`/`onUp` handlers by adding a `resizeTarget` ref that is either `'card'` or `'framework'`. When `resizeTarget === 'framework'`, `onMove` calls `fw.setFrameworkSize` (visual update) and `onUp` persists.

---

## Testing

- Manual: switch between all three frameworks, confirm instant switch and correct render
- Manual: resize matrix, reload — size is remembered
- Manual: create a new board — defaults to Eisenhower
- Unit test: `useFramework` defaults (`type: 'eisenhower'`, correct width/height) when no localStorage entry exists
