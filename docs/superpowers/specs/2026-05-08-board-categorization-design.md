# Board Categorization — Design Spec

## Goal

Add named groups to the home screen so boards can be organized into labelled sections. Boards can belong to multiple groups. Uncategorized boards collect at the bottom.

---

## Scope

Three files change:

| File | Change |
|---|---|
| `src/types/index.ts` | Add `Group` and `BoardGroup` types |
| `src/lib/db.ts` | Add group CRUD and board-group membership CRUD |
| `src/components/HomeScreen.tsx` | Rewrite rendering: grouped sections, drag-reorder, tag assignment dropdown |

No changes to `Board.tsx`, `App.tsx`, or any hook.

---

## Data Model

Two new localStorage keys — no changes to the existing `Board` type or `ideaboard_boards` key.

### `ideaboard_groups`

```typescript
interface Group {
  id: string
  name: string
  order: number      // ascending integer; controls section order on screen
  created_at: string
}
```

### `ideaboard_board_groups`

```typescript
interface BoardGroup {
  board_id: string
  group_id: string
}
```

Many-to-many. A board with no `BoardGroup` rows is Uncategorized. Deleting a group deletes its `BoardGroup` rows; the boards themselves are unaffected.

---

## UI Layout

### Home screen structure

```
[topbar: Ideaboard logo | email | dark toggle | sign out]

Your Boards                                    [+ New Group]  [+ New Board]

⠿  Work                                        ✏️  🗑️  + New Board
──────────────────────────────────────────────────────────────────
[board card]  [board card]  [board card]

⠿  Personal                                    ✏️  🗑️  + New Board
──────────────────────────────────────────────────────────────────
[board card]

Uncategorized
──────────────────────────────────────────────────────────────────
[board card]  [board card]
```

- Named group sections are ordered by `group.order` ascending.
- The Uncategorized section appears last, hidden if every board belongs to at least one group.
- The existing top-bar `+ New Board` button creates a board with no group (lands in Uncategorized).

### Group section header

Left side: `⠿` drag handle + group name (inline-editable on ✏️ click).
Right side: ✏️ rename, 🗑️ delete, `+ New Board` (creates board pre-assigned to this group).

Rename uses the same inline-input pattern as board rename today — click ✏️, input appears in place of the name, Enter/blur confirms, Escape cancels.

### Board card

Group-tag chips added below the date line:

```
┌─────────────────────────────┐
│ [colour preview]            │
│ Board name            ✏️ 🗑️ │
│ Jan 5                       │
│ [Work] [Personal] [+]       │
└─────────────────────────────┘
```

- Each chip is the group name in a small pill.
- `[+]` opens the group-assignment dropdown.
- Clicking an existing chip also opens the dropdown (to remove that group or add others).
- If the board has no groups, only `[+]` is shown.

### Group-assignment dropdown

Anchored below the clicked chip. Lists all groups, each with a checkbox. Checking/unchecking immediately writes to `ideaboard_board_groups` — no confirm. Click outside closes. Board card re-renders with updated chips.

---

## Interactions

### Create group

`+ New Group` button (top bar, beside `+ New Board`) → inline input appears at top of section list → Enter confirms, Escape cancels → new group inserted with `order: 0`, all existing groups have their `order` incremented by 1.

### Rename group

Click ✏️ on group header → name replaced by input → Enter/blur saves (calls `updateGroup`), Escape cancels.

### Delete group

Click 🗑️ → `confirm()` dialog: "Delete group «Name»? Boards will move to Uncategorized." → delete `Group` row + all matching `BoardGroup` rows.

### Reorder groups (drag)

Mouse down on `⠿` handle → plain screen-space drag (no zoom/pan) → as cursor crosses the vertical midpoint of an adjacent section, swap their `order` values in React state → mouse up writes updated `order` values to localStorage via `reorderGroups(orderedIds: string[])`.

### Assign board to group

Clicking `[+]` or any existing chip on a board card opens the dropdown checklist. Each check/uncheck calls `addBoardToGroup` or `removeBoardFromGroup` immediately.

### Board appears in multiple sections

A board in N groups is rendered once per group section (same board, same controls). Renaming or deleting the board from any section affects it globally.

### Create board inside a group

`+ New Board` on a group section header → same inline input as the global create → on confirm, creates the board then calls `addBoardToGroup(newBoard.id, group.id)`.

---

## db.ts API additions

```typescript
// Groups
fetchGroups(): Promise<Group[]>                        // sorted by order asc
createGroup(name: string): Promise<Group>              // order = 0, shifts others
updateGroup(id: string, name: string): Promise<void>
deleteGroup(id: string): Promise<void>                 // also deletes BoardGroup rows
reorderGroups(orderedIds: string[]): Promise<void>     // writes new order values

// Board-group membership
fetchBoardGroups(): Promise<BoardGroup[]>
addBoardToGroup(boardId: string, groupId: string): Promise<void>
removeBoardFromGroup(boardId: string, groupId: string): Promise<void>
```

---

## Testing

No DOM APIs used — all new `db.ts` functions are pure localStorage operations and are unit-testable.

Tests to add in `src/lib/db.test.ts`:

- `fetchGroups` returns empty array when key missing
- `createGroup` inserts with order 0 and shifts existing groups
- `deleteGroup` removes group and its BoardGroup rows
- `reorderGroups` writes correct order values
- `addBoardToGroup` / `removeBoardFromGroup` add and remove rows correctly
- `fetchBoardGroups` returns all rows

HomeScreen interactions are manual-only (DOM drag, dropdown).

---

## Edge Cases

| Case | Behaviour |
|---|---|
| Board in zero groups | Appears in Uncategorized only |
| Board in multiple groups | Rendered in each group section; delete/rename affect all |
| Group with zero boards | Section header still visible (allows pre-creating groups) |
| All boards in ≥1 group | Uncategorized section hidden |
| Delete group with boards | Boards lose that group; appear in Uncategorized if no other groups remain |
| Drag with one group | No-op (nothing to swap with) |
