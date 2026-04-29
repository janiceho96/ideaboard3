# Card Upgrades Group A — Design Spec

## Goal

Add five quick card enhancements to Ideaboard v3: collapse to title, duplicate, right-click colour picker, lock in place, and card templates. All features work offline with localStorage.

## Features

### 1. Collapse to Title

A chevron button (▾ expanded / ▸ collapsed) appears in the top-left corner of every card. Clicking it toggles the card between:

- **Expanded** (default): full card — tag pill, title, body, footer
- **Collapsed**: card shrinks to show only the tag pill + title, ~50px tall

The `collapsed` boolean is stored in localStorage (via the `Card` type), so cards remain collapsed after page reload.

Double-clicking the title bar while collapsed expands the card (same as the edit shortcut already works when expanded).

### 2. Duplicate Card

A copy icon button sits next to the existing delete (×) button in the top-right corner of the card. Clicking it:

1. Creates a new card with all the same fields (title, body, tag, bg, due_date, date_label, card_width, card_height)
2. Places it at `x + 20, y + 20` relative to the original
3. Gives it a fresh `id`, `created_at`, `updated_at`, and `rotation` (same small random tilt as new cards)

No confirmation dialog. The new card appears immediately and is saved to localStorage.

### 3. Right-Click Colour Picker

Right-clicking anywhere on a card (that is not a button or the resize handle) opens a small floating colour palette positioned near the cursor. It contains 8 swatches:

| Label   | Hex       |
|---------|-----------|
| White   | `white`   |
| Yellow  | `#FFF9C4` |
| Pink    | `#FFD6E0` |
| Green   | `#D4EDD8` |
| Blue    | `#D0E8FF` |
| Purple  | `#E8E0F5` |
| Peach   | `#FFD6C2` |
| Dark    | `#1A1A2E` |

Clicking a swatch updates the card's `bg` field and saves immediately. Clicking outside the palette, pressing Escape, or right-clicking a different card closes the palette. Only one palette is open at a time.

Implementation: a single floating `<div>` rendered in `Board.tsx` (not inside `IdeaCard.tsx`) so it can sit above all cards at any zoom level. `IdeaCard` fires an `onColorPick` callback with `(id, clientX, clientY)`.

### 4. Lock in Place

A lock icon button (🔒 / 🔓) appears on the card when hovered, or always visible when locked. Clicking it toggles `locked: boolean` on the card, saved to localStorage.

When `locked === true`:
- `onMouseDown` on the card does not start dragging
- The resize handle `onMouseDown` is suppressed
- The card still shows all content and buttons normally
- A small lock badge is visible in the corner so the user can tell it's pinned

### 5. Card Templates

At the top of the existing **Add Card** modal (`CardModal.tsx`), a horizontal row of template chips appears above the title input:

| Template      | Title            | Body                          | Tag       | Bg        |
|---------------|------------------|-------------------------------|-----------|-----------|
| Bug Report    | Bug: …           | **Steps:**\n\n**Expected:**   | critical  | `#FFD6E0` |
| Feature Idea  | Feature: …       | **Why:**\n\n**How:**          | idea      | `#E8E0F5` |
| Meeting Note  | Meeting: …       | **Attendees:**\n\n**Actions:**| planned   | `#D0E8FF` |
| Task          | Task: …          | (empty)                       | planned   | `white`   |
| Quick Note    | (empty)          | (empty)                       | idea      | `#FFF9C4` |

Clicking a template pre-fills the form fields. The user can edit all fields before saving. If a template is active, its chip is highlighted. Selecting a different template always overwrites the current draft immediately — no confirmation.

---

## Data Model Changes

Add two boolean fields to the `Card` interface in `src/types/index.ts`:

```typescript
collapsed: boolean   // default: false
locked:    boolean   // default: false
```

The `normaliseCard` helper in `src/lib/db.ts` must default both to `false` for cards created before this feature (backwards compatibility with existing localStorage data).

---

## Architecture

### Files modified
- `src/types/index.ts` — add `collapsed`, `locked` to `Card`
- `src/lib/db.ts` — `normaliseCard` defaults for new fields
- `src/components/IdeaCard.tsx` — collapse toggle, duplicate button, lock button, lock guard on drag, `onColorPick` callback, `onDuplicate` callback
- `src/components/CardModal.tsx` — template chips row at top of form
- `src/components/Board.tsx` — colour picker overlay state + render, wire new IdeaCard callbacks (`onColorPick`, `onDuplicate`)
- `src/hooks/useBoard.ts` — `duplicateCard` method

### New IdeaCard props
```typescript
onColorPick:  (id: string, clientX: number, clientY: number) => void
onDuplicate:  (id: string) => void
onToggleCollapse: (id: string) => void
onToggleLock: (id: string) => void
```

### Colour picker overlay (Board.tsx state)
```typescript
type ColourPickerState = { cardId: string; x: number; y: number } | null
const [colourPicker, setColourPicker] = useState<ColourPickerState>(null)
```

Rendered as a fixed-position `<div>` outside the pan/zoom world div, so position is in screen coordinates (no zoom math needed).

---

## Testing

- Unit test: `normaliseCard` returns `collapsed: false, locked: false` for old cards missing those fields
- Manual: each feature exercised in the browser after implementation
