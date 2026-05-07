# Board Thumbnails — Design Spec

## Goal

Replace the hard-coded 2×2 pastel squares on each home-screen board card with a stacked card preview built from the board's actual idea cards.

---

## Scope

Three files change:

| File | Change |
|---|---|
| `src/lib/db.ts` | Add `fetchAllCards(): Promise<Card[]>` |
| `src/components/BoardThumbnail.tsx` | New — renders stacked card preview |
| `src/components/HomeScreen.tsx` | Load all cards on mount; pass slice to `BoardThumbnail` |

No changes to `Board.tsx`, types, or any hook.

---

## Visual Design

The existing preview area (80px tall, `borderRadius: 10`, background `dark ? '#25252F' : '#F5F0E8'`) is preserved. Inside it, up to 3 cards are stacked as a fan centred in the area.

### Stack layout

Cards are absolutely positioned inside a relative wrapper centred in the preview div. Each card is 80px × 60px.

| Layer | Which card | Colour | Rotation | Offset |
|---|---|---|---|---|
| Back (z=1) | 3rd most recently updated | solid `bg` | +4deg | left +16px, top +8px |
| Middle (z=2) | 2nd most recently updated | solid `bg` | −2deg | left +8px, top +4px |
| Front (z=3) | Most recently updated | `bg` + title + lines | 0deg | left 0, top 0 |

### Front card content

```
┌────────────────────────────┐
│ Q2 launch plan             │  ← title, 9px bold, truncated, rgba(0,0,0,.65)
│ ▬▬▬▬▬▬▬▬▬▬▬▬▬▬            │  ← faint line, rgba(0,0,0,.12)
│ ▬▬▬▬▬▬▬▬▬                 │  ← faint line, rgba(0,0,0,.08)
└────────────────────────────┘
```

Padding: 8px 10px. Title is one line, `overflow: hidden`, `textOverflow: ellipsis`, `whiteSpace: nowrap`.

### Dark mode

Front card text colour: `rgba(0,0,0,.65)` regardless of dark mode (the card bg is always a pastel colour).
Line colours unchanged (`rgba(0,0,0,.12)` / `.08`).
The preview container background: `dark ? '#25252F' : '#F5F0E8'` — same as today.

### Edge cases

| Board state | Behaviour |
|---|---|
| 0 cards | Single 80px × 60px div, `border: 1.5px dashed`, colour `dark ? '#3A3A50' : '#C8C4BB'`, centred in preview |
| 1 card | Front card only (no fan) |
| 2 cards | Front + middle (no back) |
| 3+ cards | Full 3-layer fan |

---

## Data

### New db function

```typescript
// src/lib/db.ts
export async function fetchAllCards(): Promise<Card[]> {
  return load<Card>(CARDS_KEY)
}
```

Returns every card across all boards unsorted. HomeScreen groups and sorts by `board_id` in JS.

### HomeScreen load change

The existing `useEffect` loads boards + groups + boardGroups. Extend it to also load all cards:

```typescript
Promise.all([
  db.fetchBoards(),
  db.fetchGroups(),
  db.fetchBoardGroups(),
  db.fetchAllCards(),
]).then(([b, g, bg, allCards]) => {
  setBoards(b)
  setGroups(g)
  setBoardGroups(bg)
  setAllCards(allCards)
  setLoading(false)
})
```

Add `const [allCards, setAllCards] = useState<Card[]>([])` to state.

Helper to get cards for a board, sorted newest-updated first:

```typescript
const cardsForBoard = (boardId: string) =>
  allCards
    .filter(c => c.board_id === boardId)
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    .slice(0, 3)
```

### BoardThumbnail props

```typescript
interface BoardThumbnailProps {
  cards: Card[]   // pre-filtered and sorted, up to 3
  dark: boolean
}
```

---

## Component: BoardThumbnail

`src/components/BoardThumbnail.tsx` — pure presentational, no state, no side effects.

Renders the preview area div with the stacked card fan inside. Takes `cards` (0–3, sorted newest first) and `dark`.

---

## Testing

`BoardThumbnail` has no DOM or localStorage dependency — it is a pure render function. Unit tests are not required; the component is covered by manual smoke test.

No new `db.test.ts` tests needed — `fetchAllCards` is a one-liner using the already-tested `load` helper.

Manual smoke test:
- Board with 0 cards → dashed outline
- Board with 1 card → single front card, correct colour and title
- Board with 3+ cards → 3-layer fan, front card shows most recently updated
- Dark mode → container background switches, card colours unchanged
- Long title → truncated with ellipsis, does not overflow

---

## Out of Scope

- Updating the thumbnail live when a card is added/renamed from within the board (thumbnails reflect state at home-screen load time)
- Showing slide tiles or text blocks in the preview
- Thumbnail caching
