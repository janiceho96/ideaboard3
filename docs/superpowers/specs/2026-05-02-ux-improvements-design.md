# UX Improvements Design — 2026-05-02

## Overview

Three focused improvements to the Ideaboard canvas app:
1. Fix the broken PDF export button
2. Add JSON card backup and restore
3. Add keyboard shortcuts for canvas navigation, zoom, and card actions (including Ctrl+drag mouse pan)

---

## 1. Fix Export

### Problem
Clicking the export button does nothing — no PDF is downloaded, no error is shown.

### Fix
- Wrap the export function in `Board.tsx` in a try/catch with user-visible error feedback
- Add a loading state on the export button (`Exporting...`) while the operation runs
- Diagnose and fix the root cause of the silent failure (likely html2canvas or jsPDF async issue)
- On success: trigger file download as before
- On failure: show an inline error message near the button

---

## 2. JSON Card Backup and Restore

### Export Cards
- New **Export Cards** button in the sidebar
- Downloads a `.json` file named `<board-name>-<YYYY-MM-DD>.json`
- File contains all cards for the current board, preserving: `id`, `title`, `body`, `x`, `y`, `width`, `height`, `color`, `tag`, `due_date`, `collapsed`, `locked`
- File format:
  ```json
  {
    "exportedAt": "2026-05-02T10:00:00Z",
    "boardName": "My Board",
    "cards": [ ...Card[] ]
  }
  ```

### Import Cards
- New **Import Cards** button in the sidebar (opens a hidden `<input type="file" accept=".json">`)
- Reads and parses the selected file; validates it has a `cards` array
- Adds imported cards to the current board alongside existing cards (non-destructive — nothing is deleted)
- Cards appear at their saved positions; if positions conflict visually, they still load at those coordinates and the user can drag them
- On parse error: shows a clear inline message ("Could not read file — make sure it's a valid Ideaboard export")
- Each imported card gets a new `id` to avoid collisions with existing cards

---

## 3. Keyboard Shortcuts

### Canvas Navigation

| Input | Action |
|---|---|
| `Ctrl + drag` (mouse) | Pan canvas — hold Ctrl, click empty canvas, drag to move |
| `↑ ↓ ← →` (arrow keys) | Pan canvas (20px per keypress) |
| `Shift + ↑↓←→` | Pan canvas faster (100px per keypress) |
| `+` / `=` | Zoom in |
| `-` | Zoom out |
| `0` | Reset zoom to 100% |

### Card Actions (when a card is selected)

| Input | Action |
|---|---|
| `Escape` | Deselect card / close modal |
| `Delete` / `Backspace` | Delete the selected card |

### Shortcuts Overlay

| Input | Action |
|---|---|
| `?` | Toggle shortcuts panel |

### Ctrl + Drag Behaviour
- Triggers on `mousedown` on the canvas background (not on a card) when `ctrlKey` is true
- Cursor changes to `grab` on mousedown, `grabbing` while dragging
- `mousemove` updates `panX`/`panY` by the delta (same as existing pan logic)
- `mouseup` or loss of Ctrl ends pan mode
- Does not interfere with card drag — cards capture their own mousedown events

### Arrow Key Behaviour
- Keyboard handler on `window` keydown
- Guards: skip if `event.target` is an `<input>`, `<textarea>`, or `contenteditable` element (user is typing)
- Skip if a modal is open
- `panX`/`panY` updated directly; no commit needed (pan is not persisted)

### Shortcuts Overlay UI
- Fixed position: bottom-right corner of the canvas viewport
- Semi-transparent dark panel (`background: rgba(26,26,46,0.92)`)
- Two sections: **Navigation** and **Cards**
- Toggled by pressing `?`; also has an `×` close button
- `position: fixed` so it stays on screen regardless of pan/zoom

---

## Files Changed

| File | Change |
|---|---|
| `src/components/Board.tsx` | Fix export error handling; add keyboard event listeners; Ctrl+drag pan; shortcuts overlay component |
| `src/components/Board.tsx` | Export Cards and Import Cards buttons in sidebar |

All changes are in `Board.tsx` — no new files needed.

---

## Out of Scope

- Multi-card select
- Search / filter
- PNG export option
- Undo/redo for import (imported cards can be deleted individually)
