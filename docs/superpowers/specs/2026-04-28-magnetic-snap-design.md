# Magnetic Card Snap — Design Spec
_Date: 2026-04-28_

## Overview

When a card is dropped near another card, it snaps to sit directly beside it (left, right, above, or below) with a 6px gap — like a magnet clicking into place. A ghost outline shows the snap target while dragging so the user always knows where the card will land.

---

## Behaviour

### While dragging
1. On every mouse move, scan all other cards for the nearest one within **200 world-px** of the dragged card's current position.
2. If a neighbour is found, compute 4 candidate snap positions around it:
   - **Right:** `{ x: neighbour.x + neighbour.card_width + 6, y: neighbour.y }`
   - **Left:** `{ x: neighbour.x - dragging.card_width - 6, y: neighbour.y }`
   - **Below:** `{ x: neighbour.x, y: neighbour.y + neighbourHeight + 6 }`
   - **Above:** `{ x: neighbour.x, y: neighbour.y - draggingHeight - 6 }`
3. Pick the candidate whose centre is closest to the **dragged card's current centre** (not raw cursor — the drag offset is already subtracted so `wx,wy` is the card's top-left in world coords; centre = `wx + card_width/2, wy + height/2`).
4. Store that position as `snapGhost` in component state.
5. If no neighbour is within 200px, round the cursor position to the nearest **40px grid point** and store that as `snapGhost`.
6. Render a semi-transparent purple ghost card (`opacity: 0.25`, dashed purple border) at `snapGhost` in the world div.

### On release
- Commit the card to `snapGhost.x / snapGhost.y` instead of raw cursor position.
- Clear `snapGhost`.

### Card height estimate
Cards can have auto height (`card_height: null`). For snap maths, use `card.card_height ?? 160` as the height estimate for both the dragged card and neighbours.

---

## Constants

| Name | Value | Purpose |
|---|---|---|
| `SNAP_RADIUS` | 200 world-px | Distance within which magnetic snap activates |
| `SNAP_GAP` | 6 px | Gap between docked cards |
| `SNAP_GRID` | 40 px | Grid size used when no neighbour is nearby |
| `CARD_HEIGHT_ESTIMATE` | 160 px | Fallback height when card_height is null |

---

## Code changes

### New: `snapPosition()` utility (inside `Board.tsx`)
Pure function — no side effects. Takes:
- `wx, wy` — card's current top-left in world coordinates (cursor already has drag offset removed)
- `draggingCard` — the card being moved (for its width/height)
- `allCards` — full card list (dragged card excluded inside the function)

Returns `{ x: number, y: number }` — the snapped top-left position to commit.

### Modified: `Board.tsx`
1. Add `snapGhost` state: `const [snapGhost, setSnapGhost] = useState<{x:number,y:number}|null>(null)`
2. In `onMove` — when `dragCardId.current` is set, compute world coords and call `setSnapGhost(snapPosition(...))`
3. In `onUp` — use `snapGhost` position (if set) when calling `brd.commitCardMove()`; then `setSnapGhost(null)`
4. In the world div render — below the cards list, add a ghost card div when `snapGhost` is not null:
   ```
   {snapGhost && dragCardId.current && (() => {
     const card = brd.cards.find(c => c.id === dragCardId.current)
     if (!card) return null
     return <div style={{ position:'absolute', left:snapGhost.x, top:snapGhost.y,
       width: card.card_width ?? 185, height: card.card_height ?? 'auto', minHeight: 100,
       border: '2px dashed #6C63FF', borderRadius: 14, background: 'rgba(108,99,255,0.08)',
       pointerEvents: 'none', zIndex: 19 }} />
   })()}
   ```

### No changes needed
- `useBoard.ts` — `moveCard` and `commitCardMove` stay the same; snap happens before calling them
- `IdeaCard.tsx` — no changes
- `db.ts` — no changes

---

## Edge cases

| Scenario | Behaviour |
|---|---|
| Only one card on board | Falls back to grid snap (no neighbour) |
| Dropped exactly on top of neighbour | Closest candidate slot wins (ties broken by array order) |
| Card resized to custom width | `card.card_width` used directly — right slot accounts for actual width |
| Card height is null (auto) | Uses 160px estimate — close enough for snap feel |
| Neighbour cards overlap existing cards | Snap still fires; layout cleanup is user's responsibility |
