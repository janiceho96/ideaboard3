# Magnetic Card Snap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a card is dropped near another card it snaps to sit beside it (left / right / above / below) with a 6px gap and a ghost preview shows the target while dragging.

**Architecture:** Extract the snap maths into a pure function `snapPosition()` in `src/lib/snapPosition.ts` so it can be unit-tested in isolation. Wire the ghost state and mouse-handler changes entirely in `Board.tsx` — no other files touched.

**Tech Stack:** React, TypeScript, Vite, Vitest (added for unit tests)

---

## File Map

| Action | File | What changes |
|--------|------|--------------|
| Create | `src/lib/snapPosition.ts` | Pure snap calculation function |
| Create | `src/lib/snapPosition.test.ts` | Vitest unit tests |
| Modify | `vite.config.ts` | Add vitest config block |
| Modify | `package.json` | Add test script + vitest devDeps |
| Modify | `src/components/Board.tsx` | snapGhost state, ghost render, onMove + onUp wiring |

---

## Task 1 — Install Vitest and configure

**Files:**
- Modify: `package.json`
- Modify: `vite.config.ts`

- [ ] **Step 1: Install vitest**

```bash
cd C:/Users/User/Downloads/ideaboard-v3/ideaboard3
npm install -D vitest
```

Expected: `added N packages`

- [ ] **Step 2: Add test script to package.json**

In `package.json`, change the `"scripts"` block to:

```json
"scripts": {
  "dev": "vite",
  "build": "tsc && vite build",
  "preview": "vite preview",
  "test": "vitest run"
},
```

- [ ] **Step 3: Add vitest config block to vite.config.ts**

Replace the entire contents of `vite.config.ts` with:

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
  },
})
```

- [ ] **Step 4: Verify vitest runs (no tests yet = zero failures)**

```bash
npm test
```

Expected output contains: `No test files found` or `0 tests passed` — either is fine. Should NOT error out.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json vite.config.ts
git commit -m "chore: add vitest for unit testing"
```

---

## Task 2 — Write failing tests for snapPosition

**Files:**
- Create: `src/lib/snapPosition.test.ts`

- [ ] **Step 1: Create the test file**

Create `src/lib/snapPosition.test.ts` with this content:

```ts
import { describe, it, expect } from 'vitest'
import { snapPosition } from './snapPosition'
import type { Card } from '../types'

function makeCard(overrides: Partial<Card> & { id: string; x: number; y: number }): Card {
  return {
    board_id: 'b1',
    title: 'Test',
    body: '',
    date_label: '',
    due_date: null,
    tag: 'idea',
    bg: 'white',
    rotation: 0,
    card_width: 185,
    card_height: null,
    created_at: '',
    updated_at: '',
    ...overrides,
  }
}

const dragging = makeCard({ id: 'drag', x: 0, y: 0 })

describe('snapPosition — magnetic snap', () => {
  it('snaps to the right of a neighbour when dropped to its right', () => {
    const neighbour = makeCard({ id: 'nb', x: 100, y: 100 })
    // Drop dragging card just to the right of neighbour
    const result = snapPosition(310, 100, dragging, [neighbour])
    // right slot = neighbour.x + neighbour.card_width + 6 = 100 + 185 + 6 = 291
    expect(result).toEqual({ x: 291, y: 100 })
  })

  it('snaps to the left of a neighbour when dropped to its left', () => {
    const neighbour = makeCard({ id: 'nb', x: 300, y: 100 })
    // Drop dragging card just to the left of neighbour
    const result = snapPosition(90, 100, dragging, [neighbour])
    // left slot = neighbour.x - dragging.card_width - 6 = 300 - 185 - 6 = 109
    expect(result).toEqual({ x: 109, y: 100 })
  })

  it('snaps below a neighbour when dropped below it', () => {
    const neighbour = makeCard({ id: 'nb', x: 100, y: 100 })
    // Drop dragging card below neighbour — use card_height estimate 160
    const result = snapPosition(100, 280, dragging, [neighbour])
    // below slot = neighbour.y + 160 + 6 = 266
    expect(result).toEqual({ x: 100, y: 266 })
  })

  it('snaps above a neighbour when dropped above it', () => {
    const neighbour = makeCard({ id: 'nb', x: 100, y: 300 })
    // Drop dragging card above neighbour
    const result = snapPosition(100, 120, dragging, [neighbour])
    // above slot = neighbour.y - dragging height estimate - 6 = 300 - 160 - 6 = 134
    expect(result).toEqual({ x: 100, y: 134 })
  })

  it('skips the dragging card itself when scanning neighbours', () => {
    // Only card in list is the dragging card — should fall back to grid
    const result = snapPosition(55, 55, dragging, [dragging])
    expect(result).toEqual({ x: 40, y: 40 }) // nearest 40px grid point
  })

  it('falls back to grid snap when no neighbour is within 200px', () => {
    const farCard = makeCard({ id: 'far', x: 2000, y: 2000 })
    const result = snapPosition(55, 75, dragging, [farCard])
    expect(result).toEqual({ x: 40, y: 80 })
  })

  it('falls back to grid snap when card list is empty', () => {
    const result = snapPosition(50, 90, dragging, [])
    expect(result).toEqual({ x: 40, y: 80 })
  })
})
```

- [ ] **Step 2: Run tests — confirm they all FAIL**

```bash
npm test
```

Expected: all 7 tests fail with `Cannot find module './snapPosition'`

---

## Task 3 — Implement snapPosition

**Files:**
- Create: `src/lib/snapPosition.ts`

- [ ] **Step 1: Create the implementation**

Create `src/lib/snapPosition.ts` with this content:

```ts
import type { Card } from '../types'

const SNAP_RADIUS = 200          // world-px: distance to activate magnetic snap
const SNAP_GAP = 6               // world-px: gap between docked cards
const SNAP_GRID = 40             // world-px: grid size for fallback snap
const CARD_HEIGHT_ESTIMATE = 160 // world-px: fallback when card_height is null

export function snapPosition(
  wx: number,
  wy: number,
  draggingCard: Card,
  allCards: Card[],
): { x: number; y: number } {
  const dw = draggingCard.card_width ?? 185
  const dh = draggingCard.card_height ?? CARD_HEIGHT_ESTIMATE
  const dragCx = wx + dw / 2
  const dragCy = wy + dh / 2

  // Find nearest neighbour within snap radius (exclude dragging card itself)
  let nearest: Card | null = null
  let nearestDist = SNAP_RADIUS

  for (const card of allCards) {
    if (card.id === draggingCard.id) continue
    const nw = card.card_width ?? 185
    const nh = card.card_height ?? CARD_HEIGHT_ESTIMATE
    const ncx = card.x + nw / 2
    const ncy = card.y + nh / 2
    const dist = Math.sqrt((dragCx - ncx) ** 2 + (dragCy - ncy) ** 2)
    if (dist < nearestDist) {
      nearestDist = dist
      nearest = card
    }
  }

  if (nearest) {
    const nw = nearest.card_width ?? 185
    const nh = nearest.card_height ?? CARD_HEIGHT_ESTIMATE

    // 4 candidate positions around the neighbour
    const candidates = [
      { x: nearest.x + nw + SNAP_GAP, y: nearest.y },   // right
      { x: nearest.x - dw - SNAP_GAP, y: nearest.y },   // left
      { x: nearest.x, y: nearest.y + nh + SNAP_GAP },   // below
      { x: nearest.x, y: nearest.y - dh - SNAP_GAP },   // above
    ]

    // Pick candidate closest to the dragged card's current centre
    let best = candidates[0]
    let bestDist = Infinity
    for (const c of candidates) {
      const cx = c.x + dw / 2
      const cy = c.y + dh / 2
      const d = Math.sqrt((cx - dragCx) ** 2 + (cy - dragCy) ** 2)
      if (d < bestDist) {
        bestDist = d
        best = c
      }
    }
    return best
  }

  // Fallback: nearest grid point
  return {
    x: Math.round(wx / SNAP_GRID) * SNAP_GRID,
    y: Math.round(wy / SNAP_GRID) * SNAP_GRID,
  }
}
```

- [ ] **Step 2: Run tests — confirm they all PASS**

```bash
npm test
```

Expected: `7 tests passed`

- [ ] **Step 3: Commit**

```bash
git add src/lib/snapPosition.ts src/lib/snapPosition.test.ts
git commit -m "feat: add snapPosition pure function with tests"
```

---

## Task 4 — Add snapGhost state and ghost render to Board.tsx

**Files:**
- Modify: `src/components/Board.tsx`

- [ ] **Step 1: Import snapPosition at the top of Board.tsx**

Add this import after the existing imports (around line 8):

```ts
import { snapPosition } from '../lib/snapPosition'
```

- [ ] **Step 2: Add snapGhost state**

After the existing `const [exporting, setExporting] = useState(false)` line (around line 61), add:

```ts
const [snapGhost, setSnapGhost] = useState<{ x: number; y: number } | null>(null)
```

- [ ] **Step 3: Add the ghost card render inside the world div**

In `Board.tsx`, find the section that renders goal tags (around line 415 — the `{brd.goalTags.map(...)}` block). Add the ghost render **after** the goal tags block and **before** the closing `</div>{/* end world */}` comment:

```tsx
{/* Snap ghost */}
{snapGhost && dragCardId.current && (() => {
  const card = brd.cards.find(c => c.id === dragCardId.current)
  if (!card) return null
  return (
    <div
      style={{
        position: 'absolute',
        left: snapGhost.x,
        top: snapGhost.y,
        width: card.card_width ?? 185,
        height: card.card_height ?? 'auto',
        minHeight: 100,
        border: '2px dashed #6C63FF',
        borderRadius: 14,
        background: 'rgba(108,99,255,0.08)',
        pointerEvents: 'none',
        zIndex: 19,
        boxSizing: 'border-box',
      }}
    />
  )
})()}
```

- [ ] **Step 4: Verify the app still builds without errors**

```bash
npx tsc --noEmit
```

Expected: no output (zero errors)

- [ ] **Step 5: Commit**

```bash
git add src/components/Board.tsx
git commit -m "feat: add snap ghost render to board"
```

---

## Task 5 — Wire snap into onMove and onUp

**Files:**
- Modify: `src/components/Board.tsx`

- [ ] **Step 1: Update onMove to compute and show the ghost**

In `Board.tsx`, inside the `useEffect` that sets up mouse listeners (around line 125), find the `if (isDragging.current && canvasRef.current)` block inside `onMove`. Replace it with:

```ts
if (isDragging.current && canvasRef.current) {
  const cr = canvasRef.current.getBoundingClientRect()
  const wx = (e.clientX - cr.left - snapPanX.current) / snapZoom.current - dragOffWX.current
  const wy = (e.clientY - cr.top  - snapPanY.current) / snapZoom.current - dragOffWY.current
  if (dragCardId.current) {
    brd.moveCard(dragCardId.current, wx, wy)
    const draggingCard = brd.cards.find(c => c.id === dragCardId.current)
    if (draggingCard) {
      setSnapGhost(snapPosition(wx, wy, draggingCard, brd.cards))
    }
  }
  if (dragTagId.current) brd.moveGoalTag(dragTagId.current, wx, wy)
  return
}
```

- [ ] **Step 2: Update onUp to commit to the snap position and clear the ghost**

In the same `useEffect`, find the `if (isDragging.current && canvasRef.current)` block inside `onUp`. Replace it with:

```ts
if (isDragging.current && canvasRef.current) {
  const cr = canvasRef.current.getBoundingClientRect()
  const wx = (e.clientX - cr.left - snapPanX.current) / snapZoom.current - dragOffWX.current
  const wy = (e.clientY - cr.top  - snapPanY.current) / snapZoom.current - dragOffWY.current
  if (dragCardId.current) {
    const draggingCard = brd.cards.find(c => c.id === dragCardId.current)
    const finalPos = draggingCard
      ? snapPosition(wx, wy, draggingCard, brd.cards)
      : { x: wx, y: wy }
    brd.commitCardMove(dragCardId.current, finalPos.x, finalPos.y)
  }
  if (dragTagId.current) brd.commitGoalTagMove(dragTagId.current, wx, wy)
  isDragging.current = false
  dragCardId.current = null
  dragTagId.current = null
  setSnapGhost(null)
  return
}
```

- [ ] **Step 3: Verify the app builds cleanly**

```bash
npx tsc --noEmit
```

Expected: no output (zero errors)

- [ ] **Step 4: Manual smoke test in the browser**

The dev server should already be running at `http://localhost:5174`.

1. Open the board
2. Add two cards if the board is empty (click **+ Add Card** twice)
3. Drag one card slowly toward the other — a faint purple dashed outline should appear showing the snap slot
4. Release — the card should land at the ghost position, sitting 6px beside the neighbour
5. Drag a card far from all others and release — it should snap to the nearest 40px grid point (coordinates shown bottom-left of the canvas should be multiples of 40)

- [ ] **Step 5: Run unit tests one final time to confirm nothing regressed**

```bash
npm test
```

Expected: `7 tests passed`

- [ ] **Step 6: Final commit**

```bash
git add src/components/Board.tsx
git commit -m "feat: magnetic card snap on drop with ghost preview"
```
