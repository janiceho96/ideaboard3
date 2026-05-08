# Multiple Frames — Design Spec

## Goal

Replace the single per-board framework overlay with an unlimited number of independently draggable, resizable frame overlays. Each frame can be a different framework type (Eisenhower, OKR, Ikigai, etc.) and lives at its own position on the canvas.

---

## Scope

| File | Change |
|---|---|
| `src/types/index.ts` | Add `FrameInstance` interface; move `FrameworkType` here from `useFramework.ts` |
| `src/hooks/useFramework.ts` | Remove (replaced) |
| `src/hooks/useFramework.test.ts` | Remove (replaced) |
| `src/hooks/useFrames.ts` | New — multi-frame hook; contains `DEFAULTS`, `VALID_TYPES`, `parseFrameInstances` |
| `src/hooks/useFrames.test.ts` | New — unit tests |
| `src/components/FrameworkOverlay.tsx` | Update props, add drag handle, × button, type picker, selection border |
| `src/components/Board.tsx` | Wire `useFrames`, add frame drag/resize/delete/select logic, update sidebar |

---

## Data Model

### Types moved to `src/types/index.ts`

`FrameworkType` currently lives in `useFramework.ts`. It moves to `src/types/index.ts` so it can be shared by `useFrames.ts`, `FrameworkOverlay.tsx`, and `Board.tsx` without a circular dependency.

```typescript
// src/types/index.ts  (additions)
export type FrameworkType =
  | 'blank' | 'eisenhower' | 'ooda'
  | 'ikigai' | 'wheel-of-life' | 'grow' | 'smart-goals'
  | 'start-stop-continue' | 'personal-kanban' | 'five-whys'
  | 'daily-reflection' | 'okr' | 'energy-audit'
  | 'eat-that-frog' | 'gtd'

export interface FrameInstance {
  id: string
  type: FrameworkType
  x: number        // world-space position
  y: number
  width: number
  height: number
}
```

`DEFAULTS` (per-type width/height) and `VALID_TYPES` move into `useFrames.ts`.

### Storage

- **New key:** `ideaboard_frames_<boardId>` — stores `FrameInstance[]` as JSON
- **Old key:** `ideaboard_framework_<boardId>` — read once for migration, never written

### Migration

On hook initialisation, if `ideaboard_frames_<boardId>` is absent but `ideaboard_framework_<boardId>` exists with a non-`blank` type, convert the old settings to a single-item `FrameInstance` array at position `{ x: 60, y: 40 }` and persist it. The old key is left in place but ignored going forward.

---

## Hook: `useFrames`

`src/hooks/useFrames.ts` — replaces `useFramework`.

```typescript
export function useFrames(boardId: string): {
  frames: FrameInstance[]
  addFrame: (type: FrameworkType, viewportCx: number, viewportCy: number, zoom: number, panX: number, panY: number) => FrameInstance
  moveFrame: (id: string, x: number, y: number) => void          // optimistic, no save
  commitFrameMove: (id: string, x: number, y: number) => void    // saves
  setFrameSize: (id: string, w: number, h: number) => void       // optimistic, no save
  commitFrameResize: (id: string, w: number, h: number) => void  // saves
  changeFrameType: (id: string, type: FrameworkType) => void     // saves immediately
  deleteFrame: (id: string) => void                              // saves immediately
}
```

`addFrame` calculates world-space centre from viewport centre: `x = (viewportCx - panX) / zoom - defaultWidth / 2`, same formula for y.

Two-phase commit pattern (optimistic update on every mousemove, single localStorage write on mouseup) matches `useSlides` and `useTextBlocks`.

---

## Component: `FrameworkOverlay` (updated)

### New props

```typescript
interface FrameworkOverlayProps {
  frame: FrameInstance
  dark: boolean
  selected: boolean
  zoom: number
  panX: number
  panY: number
  onMoveStart: (id: string, e: React.MouseEvent) => void
  onResizeStart: (id: string, e: React.MouseEvent) => void
  onDelete: (id: string) => void
  onSelect: (id: string) => void
  onTypeChange: (id: string, type: FrameworkType) => void
}
```

### Header bar layout

```
[ ⠿ ]  EISENHOWER MATRIX  [ ▾ ]  [ × ]
  drag    type name        change  delete
```

- **⠿** — `cursor: grab`, `onMouseDown` → `onMoveStart(frame.id, e)`
- **▾** — click opens an inline dropdown listing all framework types; selecting one calls `onTypeChange(frame.id, type)`
- **×** — click calls `onDelete(frame.id)`

### Selection

When `selected`, the outer wrapper gets `outline: 2px solid #49B6E5`. Clicking the frame body calls `onSelect(frame.id)`.

### Position formula

```typescript
style={{
  position: 'absolute',
  left: frame.x * zoom + panX,
  top:  frame.y * zoom + panY,
  width:  frame.width  * zoom,
  height: frame.height * zoom,
}}
```

Matches the formula used for `IdeaCard` and `TextBlockItem`.

---

## Board.tsx Changes

### Removed

- `useFramework` import and `fw` / `fwRef`
- `frameworkDropdownOpen` state and the toolbar framework type picker
- `resizeTarget === 'framework'` branches that reference the old single-frame hook

### Added

- `frm = useFrames(board.id)`, `frmRef` (ref kept in sync for mouse handlers)
- `selectedFrameId: string | null` state — set on frame click, cleared on canvas click
- `dragFrameId: React.MutableRefObject<string | null>` for frame drag
- Frame drag logic in `onMouseMove` / `onMouseUp` (same pattern as text block drag)
- Frame resize logic: `resizeTarget` gains `'frame'` as a value; `resizeFrameId` ref
- Keyboard handler: `Delete` / `Backspace` when `selectedFrameId !== null` → `frm.deleteFrame(selectedFrameId)`
- `<FrameworkOverlay>` rendered by mapping over `frm.frames`

### Sidebar: "+ Add Frame"

The existing sidebar framework section is replaced with:

1. A **"+ Add Frame" button** — always visible
2. An **inline type list** that appears below the button when clicked — shows all framework types with names, grouped as today's dropdown is grouped
3. Clicking a type calls `frm.addFrame(type, viewportCx, viewportCy, zoom, panX, panY)` and closes the list

Viewport centre is calculated from `canvasRef.current.getBoundingClientRect()`.

---

## Testing

### `src/hooks/useFrames.test.ts`

Tests use a `localStorage` shim (same pattern as `useFramework.test.ts`).

Key cases:
- Empty board → `frames` is `[]`
- Migration: old `ideaboard_framework_<boardId>` with non-blank type → one-item array at (60, 40)
- Migration: old `ideaboard_framework_<boardId>` with `blank` type → empty array (no frame created)
- `addFrame` → appends a frame with correct default size for that type
- `moveFrame` → optimistic update, no localStorage write
- `commitFrameMove` → localStorage write
- `deleteFrame` → removes from array, persists

### No automated tests for `FrameworkOverlay`

Pure render component — covered by manual smoke test.

---

## Manual Smoke Test

- Empty board → sidebar shows "+ Add Frame", canvas has no frames
- Add an Eisenhower frame → appears near canvas centre, draggable, resizable
- Add a second frame (OKR) → two frames coexist independently
- Drag a frame → moves smoothly, position persists after page reload
- Resize a frame → size persists after page reload
- Click frame → selected (blue outline); click canvas → deselected
- Press Delete while selected → frame removed
- Click × on header → frame removed
- Change type via ▾ → frame updates in place, size resets to new type's default
- Old board with Eisenhower set → opens with one Eisenhower frame at (60, 40)
- Dark mode → all frames render correctly

---

## Out of Scope

- Naming individual frames
- Locking frames in place
- Copying/duplicating frames
- Undo for frame operations (existing undo covers cards/tags only)
