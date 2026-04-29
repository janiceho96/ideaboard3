# Card Upgrades Group A — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add five card enhancements to Ideaboard v3 — collapse to title, duplicate, right-click colour picker, lock in place, and card templates.

**Architecture:** Two new boolean fields (`collapsed`, `locked`) are added to the `Card` type and normalised in `db.ts` for backwards compatibility with existing localStorage data. All UI changes live in `IdeaCard.tsx` (new buttons/guards) and `Board.tsx` (colour picker overlay). Templates live entirely in `CardModal.tsx`.

**Tech Stack:** React 18, TypeScript, Vite, Vitest, localStorage (no external DB).

---

## File Map

| File | Change |
|------|--------|
| `src/types/index.ts` | Add `collapsed`, `locked` to `Card` |
| `src/lib/db.ts` | Export `normaliseCard`; add defaults for new fields |
| `src/lib/db.test.ts` | New — unit tests for `normaliseCard` |
| `src/hooks/useBoard.ts` | Add `duplicateCard`; pass `collapsed`/`locked` in `addCard` |
| `src/components/IdeaCard.tsx` | Chevron, duplicate button, lock button, drag guard, colour pick handler |
| `src/components/Board.tsx` | Colour picker overlay state + render; wire new IdeaCard callbacks |
| `src/components/CardModal.tsx` | Template chips row |

---

## Task 1: Data Model — `collapsed` + `locked` fields

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/lib/db.ts`
- Create: `src/lib/db.test.ts`

- [ ] **Step 1: Add the two fields to the `Card` interface**

  Open `src/types/index.ts`. Replace the `Card` interface with:

  ```typescript
  export interface Card {
    id: string
    board_id: string
    title: string
    body: string
    date_label: string
    due_date: string | null      // ISO date string e.g. "2024-08-15"
    tag: TagType
    bg: string
    x: number
    y: number
    rotation: number
    card_width: number           // resizable width in world px
    card_height: number | null   // null = auto height
    collapsed: boolean           // true = shrunk to title bar only
    locked: boolean              // true = cannot be dragged or resized
    created_at: string
    updated_at: string
  }
  ```

- [ ] **Step 2: Export `normaliseCard` and add defaults for new fields**

  Open `src/lib/db.ts`. Replace the `normaliseCard` function (currently at the bottom, private) with an exported version that also handles the two new fields:

  ```typescript
  export function normaliseCard(c: Record<string, unknown>): Card {
    return {
      ...c,
      card_width:  (c.card_width  as number)        ?? 185,
      card_height: (c.card_height as number | null) ?? null,
      due_date:    (c.due_date    as string | null)  ?? null,
      collapsed:   (c.collapsed   as boolean)        ?? false,
      locked:      (c.locked      as boolean)        ?? false,
    } as Card
  }
  ```

- [ ] **Step 3: Write the failing test**

  Create `src/lib/db.test.ts`:

  ```typescript
  import { describe, it, expect } from 'vitest'
  import { normaliseCard } from './db'

  // A card record as it would have been stored before the new fields were added
  const oldCard = {
    id: 'x', board_id: 'b', title: 'T', body: '', date_label: '',
    due_date: null, tag: 'idea', bg: 'white',
    x: 0, y: 0, rotation: 0, card_width: 185, card_height: null,
    created_at: '', updated_at: '',
  }

  describe('normaliseCard — backwards compatibility', () => {
    it('defaults collapsed to false for old cards missing the field', () => {
      expect(normaliseCard(oldCard as unknown as Record<string, unknown>).collapsed).toBe(false)
    })

    it('defaults locked to false for old cards missing the field', () => {
      expect(normaliseCard(oldCard as unknown as Record<string, unknown>).locked).toBe(false)
    })

    it('preserves collapsed: true when already set', () => {
      const c = { ...oldCard, collapsed: true, locked: false }
      expect(normaliseCard(c as unknown as Record<string, unknown>).collapsed).toBe(true)
    })

    it('preserves locked: true when already set', () => {
      const c = { ...oldCard, collapsed: false, locked: true }
      expect(normaliseCard(c as unknown as Record<string, unknown>).locked).toBe(true)
    })
  })
  ```

- [ ] **Step 4: Run the test — expect FAIL**

  ```bash
  cd C:\Users\User\Downloads\ideaboard-v3\ideaboard3
  npm test
  ```

  Expected: FAIL — `normaliseCard` is not exported yet (or the new fields aren't added yet if you haven't saved).

- [ ] **Step 5: Run the test — expect PASS**

  After saving both file changes, run:

  ```bash
  npm test
  ```

  Expected output:
  ```
  ✓ src/lib/db.test.ts (4)
  ✓ src/lib/snapPosition.test.ts (7)
  Test Files  2 passed (2)
  Tests  11 passed (11)
  ```

- [ ] **Step 6: Fix TypeScript — update `addCard` in `useBoard.ts`**

  `CardInsert` is now `Omit<Card, 'id'|'created_at'|'updated_at'>` so it requires `collapsed` and `locked`. Open `src/hooks/useBoard.ts` and add the two fields to the `db.createCard` call inside `addCard`:

  ```typescript
  const newCard = await db.createCard({
    board_id: activeBoardId, title, body,
    date_label: dateLabel, due_date: dueDate, tag, bg,
    x: worldX, y: worldY,
    rotation: (Math.random() - 0.5) * 3,
    card_width: 185, card_height: null,
    collapsed: false, locked: false,
  })
  ```

- [ ] **Step 7: Verify TypeScript compiles**

  ```bash
  npx tsc --noEmit
  ```

  Expected: no errors.

- [ ] **Step 8: Commit**

  ```bash
  git add src/types/index.ts src/lib/db.ts src/lib/db.test.ts src/hooks/useBoard.ts
  git commit -m "feat: add collapsed and locked fields to Card type"
  ```

---

## Task 2: Collapse to Title

**Files:**
- Modify: `src/components/IdeaCard.tsx`
- Modify: `src/components/Board.tsx`

- [ ] **Step 1: Add `onToggleCollapse` prop and chevron button to `IdeaCard`**

  Open `src/components/IdeaCard.tsx`.

  **1a. Update the props interface** (replace the existing `IdeaCardProps`):

  ```typescript
  interface IdeaCardProps {
    card: Card
    onMoveStart:      (id: string, clientX: number, clientY: number) => void
    onResizeStart:    (id: string, clientX: number, clientY: number, startW: number, startH: number | null) => void
    onEdit:           (id: string) => void
    onDelete:         (id: string) => void
    onInlineTitle:    (id: string, title: string) => void
    onToggleCollapse: (id: string) => void
    dark: boolean
  }
  ```

  **1b. Update the function signature** to destructure the new prop:

  ```typescript
  export default function IdeaCard({ card, onMoveStart, onResizeStart, onEdit, onDelete, onInlineTitle, onToggleCollapse, dark }: IdeaCardProps) {
  ```

  **1c. Add the chevron button** — insert it right after the delete button (which is the first element inside the outer `<div>`). Also shift the overdue badge left position to 24px to make room for the chevron:

  Replace the existing **delete button + overdue badge** block:

  ```tsx
  {/* Delete button */}
  <button className="no-drag"
    onClick={e => { e.stopPropagation(); onDelete(card.id) }}
    onMouseDown={e => e.stopPropagation()}
    style={{ position: 'absolute', top: 6, right: 8, width: 18, height: 18, borderRadius: '50%', background: 'rgba(0,0,0,.07)', border: 'none', cursor: 'pointer', fontSize: 12, color: '#888', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2 }}
  >×</button>

  {/* Overdue badge */}
  {dueStatus && (
    <div style={{ position: 'absolute', top: 6, left: 10, fontSize: 9, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: dueStatus === 'overdue' ? '#EF4444' : '#F59E0B', background: dueStatus === 'overdue' ? 'rgba(239,68,68,.1)' : 'rgba(245,158,11,.1)', padding: '2px 6px', borderRadius: 10 }}>
      {dueStatus === 'overdue' ? '⚠ Overdue' : '⏰ Due soon'}
    </div>
  )}
  ```

  With this updated version:

  ```tsx
  {/* Collapse chevron */}
  <button className="no-drag"
    onClick={e => { e.stopPropagation(); onToggleCollapse(card.id) }}
    onMouseDown={e => e.stopPropagation()}
    title={card.collapsed ? 'Expand card' : 'Collapse card'}
    style={{ position: 'absolute', top: 6, left: 6, width: 16, height: 16, borderRadius: '50%', background: 'rgba(0,0,0,.07)', border: 'none', cursor: 'pointer', fontSize: 9, color: '#888', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2 }}
  >{card.collapsed ? '▸' : '▾'}</button>

  {/* Delete button */}
  <button className="no-drag"
    onClick={e => { e.stopPropagation(); onDelete(card.id) }}
    onMouseDown={e => e.stopPropagation()}
    style={{ position: 'absolute', top: 6, right: 8, width: 18, height: 18, borderRadius: '50%', background: 'rgba(0,0,0,.07)', border: 'none', cursor: 'pointer', fontSize: 12, color: '#888', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2 }}
  >×</button>

  {/* Overdue badge */}
  {dueStatus && (
    <div style={{ position: 'absolute', top: 6, left: 24, fontSize: 9, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: dueStatus === 'overdue' ? '#EF4444' : '#F59E0B', background: dueStatus === 'overdue' ? 'rgba(239,68,68,.1)' : 'rgba(245,158,11,.1)', padding: '2px 6px', borderRadius: 10 }}>
      {dueStatus === 'overdue' ? '⚠ Overdue' : '⏰ Due soon'}
    </div>
  )}
  ```

  **1d. Conditionally hide body and footer when collapsed.** Find the body render block and the footer, and wrap them:

  Replace:

  ```tsx
  {/* Body — rendered markdown */}
  {card.body && (
    <div className="no-drag md-body"
      dangerouslySetInnerHTML={{ __html: markdownHtml }}
      style={{ fontSize: 11, color: mutedColor, lineHeight: 1.55 }}
    />
  )}

  {/* Footer */}
  <div style={{ marginTop: 9, paddingTop: 7, borderTop: `1px solid ${isDark ? 'rgba(255,255,255,.1)' : 'rgba(0,0,0,.07)'}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
    <span style={{ fontSize: 10, color: mutedColor }}>
      {card.due_date ? `📅 ${card.due_date}` : card.date_label}
    </span>
    <div style={{ width: 7, height: 7, borderRadius: '50%', background: dotColor }} />
  </div>
  ```

  With:

  ```tsx
  {/* Body — rendered markdown (hidden when collapsed) */}
  {!card.collapsed && card.body && (
    <div className="no-drag md-body"
      dangerouslySetInnerHTML={{ __html: markdownHtml }}
      style={{ fontSize: 11, color: mutedColor, lineHeight: 1.55 }}
    />
  )}

  {/* Footer (hidden when collapsed) */}
  {!card.collapsed && (
    <div style={{ marginTop: 9, paddingTop: 7, borderTop: `1px solid ${isDark ? 'rgba(255,255,255,.1)' : 'rgba(0,0,0,.07)'}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <span style={{ fontSize: 10, color: mutedColor }}>
        {card.due_date ? `📅 ${card.due_date}` : card.date_label}
      </span>
      <div style={{ width: 7, height: 7, borderRadius: '50%', background: dotColor }} />
    </div>
  )}
  ```

  **1e. Reduce minHeight when collapsed.** In the outer card `<div>` style, change:

  ```tsx
  minHeight: 100,
  ```

  to:

  ```tsx
  minHeight: card.collapsed ? 44 : 100,
  ```

- [ ] **Step 2: Wire `onToggleCollapse` in `Board.tsx`**

  Open `src/components/Board.tsx`. Find the `IdeaCard` render inside the cards map (around line 422) and add `onToggleCollapse`:

  Replace:

  ```tsx
  <IdeaCard
    card={card} dark={dark}
    onMoveStart={onCardMoveStart}
    onResizeStart={onResizeStart}
    onEdit={openEdit}
    onDelete={async id => { await brd.removeCard(id); showToast('Card deleted') }}
    onInlineTitle={async (id, title) => { await brd.updateCard(id, { title }); showToast('Renamed ✓') }}
  />
  ```

  With:

  ```tsx
  <IdeaCard
    card={card} dark={dark}
    onMoveStart={onCardMoveStart}
    onResizeStart={onResizeStart}
    onEdit={openEdit}
    onDelete={async id => { await brd.removeCard(id); showToast('Card deleted') }}
    onInlineTitle={async (id, title) => { await brd.updateCard(id, { title }); showToast('Renamed ✓') }}
    onToggleCollapse={async id => { await brd.updateCard(id, { collapsed: !brd.cards.find(c => c.id === id)?.collapsed }) }}
  />
  ```

- [ ] **Step 3: Verify TypeScript compiles**

  ```bash
  npx tsc --noEmit
  ```

  Expected: no errors.

- [ ] **Step 4: Test manually in browser**

  Start the dev server (`npm run dev`), open the app. Confirm:
  - Every card has a small ▾ button at top-left
  - Clicking ▾ collapses the card to just the tag + title strip (≈44px tall)
  - Chevron changes to ▸
  - Clicking ▸ expands back to full card
  - Reload the page — collapsed cards stay collapsed (persisted in localStorage)

- [ ] **Step 5: Commit**

  ```bash
  git add src/components/IdeaCard.tsx src/components/Board.tsx
  git commit -m "feat: collapse card to title bar with chevron toggle"
  ```

---

## Task 3: Duplicate Card

**Files:**
- Modify: `src/hooks/useBoard.ts`
- Modify: `src/components/IdeaCard.tsx`
- Modify: `src/components/Board.tsx`

- [ ] **Step 1: Add `duplicateCard` to `useBoard.ts`**

  Open `src/hooks/useBoard.ts`.

  **1a. Add `duplicateCard` to the `UseBoardReturn` interface:**

  ```typescript
  duplicateCard: (id: string) => Promise<void>
  ```

  **1b. Add the implementation** after `removeCard`:

  ```typescript
  const duplicateCard = useCallback(async (id: string) => {
    const original = cards.find(c => c.id === id)
    if (!original || !activeBoardId) return
    setCards(prev => { pushHistory(prev, goalTags); return prev })
    const newCard = await db.createCard({
      board_id: activeBoardId,
      title: original.title,
      body: original.body,
      date_label: original.date_label,
      due_date: original.due_date,
      tag: original.tag,
      bg: original.bg,
      x: original.x + 20,
      y: original.y + 20,
      rotation: (Math.random() - 0.5) * 3,
      card_width: original.card_width,
      card_height: original.card_height,
      collapsed: false,
      locked: false,
    })
    setCards(prev => [...prev, newCard])
  }, [activeBoardId, cards, goalTags, pushHistory])
  ```

  **1c. Add `duplicateCard` to the return object:**

  ```typescript
  return {
    cards, goalTags,
    boardId: activeBoardId, boardName, loading, error,
    addCard, updateCard, moveCard, commitCardMove,
    resizeCard, commitCardResize, removeCard, duplicateCard,
    moveGoalTag, commitGoalTagMove, removeGoalTag,
    undo, canUndo,
  }
  ```

- [ ] **Step 2: Add duplicate button to `IdeaCard.tsx`**

  Open `src/components/IdeaCard.tsx`.

  **2a. Add `onDuplicate` to the props interface:**

  ```typescript
  interface IdeaCardProps {
    card: Card
    onMoveStart:      (id: string, clientX: number, clientY: number) => void
    onResizeStart:    (id: string, clientX: number, clientY: number, startW: number, startH: number | null) => void
    onEdit:           (id: string) => void
    onDelete:         (id: string) => void
    onInlineTitle:    (id: string, title: string) => void
    onToggleCollapse: (id: string) => void
    onDuplicate:      (id: string) => void
    dark: boolean
  }
  ```

  **2b. Update the function signature:**

  ```typescript
  export default function IdeaCard({ card, onMoveStart, onResizeStart, onEdit, onDelete, onInlineTitle, onToggleCollapse, onDuplicate, dark }: IdeaCardProps) {
  ```

  **2c. Add the duplicate button** between the delete button and the collapse chevron. Insert after the delete button:

  ```tsx
  {/* Duplicate button */}
  <button className="no-drag"
    onClick={e => { e.stopPropagation(); onDuplicate(card.id) }}
    onMouseDown={e => e.stopPropagation()}
    title="Duplicate card"
    style={{ position: 'absolute', top: 6, right: 30, width: 18, height: 18, borderRadius: '50%', background: 'rgba(0,0,0,.07)', border: 'none', cursor: 'pointer', fontSize: 10, color: '#888', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2 }}
  >
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2"/>
      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
    </svg>
  </button>
  ```

- [ ] **Step 3: Wire `onDuplicate` in `Board.tsx`**

  Open `src/components/Board.tsx`. Find the `IdeaCard` render and add `onDuplicate`:

  ```tsx
  <IdeaCard
    card={card} dark={dark}
    onMoveStart={onCardMoveStart}
    onResizeStart={onResizeStart}
    onEdit={openEdit}
    onDelete={async id => { await brd.removeCard(id); showToast('Card deleted') }}
    onInlineTitle={async (id, title) => { await brd.updateCard(id, { title }); showToast('Renamed ✓') }}
    onToggleCollapse={async id => { await brd.updateCard(id, { collapsed: !brd.cards.find(c => c.id === id)?.collapsed }) }}
    onDuplicate={async id => { await brd.duplicateCard(id); showToast('Card duplicated ✓') }}
  />
  ```

- [ ] **Step 4: Verify TypeScript compiles**

  ```bash
  npx tsc --noEmit
  ```

  Expected: no errors.

- [ ] **Step 5: Test manually in browser**

  Confirm:
  - Each card has a small copy icon button (top-right, just left of the ×)
  - Clicking it creates a new identical card offset by 20px
  - The duplicate is saved (persists after reload)
  - Undo (Ctrl+Z) removes the duplicate

- [ ] **Step 6: Commit**

  ```bash
  git add src/hooks/useBoard.ts src/components/IdeaCard.tsx src/components/Board.tsx
  git commit -m "feat: duplicate card with offset copy button"
  ```

---

## Task 4: Lock in Place

**Files:**
- Modify: `src/components/IdeaCard.tsx`
- Modify: `src/components/Board.tsx`

- [ ] **Step 1: Add lock button to `IdeaCard.tsx` and guard drag/resize**

  Open `src/components/IdeaCard.tsx`.

  **1a. Add `onToggleLock` to props interface:**

  ```typescript
  interface IdeaCardProps {
    card: Card
    onMoveStart:      (id: string, clientX: number, clientY: number) => void
    onResizeStart:    (id: string, clientX: number, clientY: number, startW: number, startH: number | null) => void
    onEdit:           (id: string) => void
    onDelete:         (id: string) => void
    onInlineTitle:    (id: string, title: string) => void
    onToggleCollapse: (id: string) => void
    onDuplicate:      (id: string) => void
    onToggleLock:     (id: string) => void
    dark: boolean
  }
  ```

  **1b. Update the function signature:**

  ```typescript
  export default function IdeaCard({ card, onMoveStart, onResizeStart, onEdit, onDelete, onInlineTitle, onToggleCollapse, onDuplicate, onToggleLock, dark }: IdeaCardProps) {
  ```

  **1c. Add lock button** — add after the duplicate button:

  ```tsx
  {/* Lock button */}
  <button className="no-drag"
    onClick={e => { e.stopPropagation(); onToggleLock(card.id) }}
    onMouseDown={e => e.stopPropagation()}
    title={card.locked ? 'Unlock card' : 'Lock card in place'}
    style={{ position: 'absolute', top: 6, right: 52, width: 18, height: 18, borderRadius: '50%', background: card.locked ? 'rgba(108,99,255,.18)' : 'rgba(0,0,0,.07)', border: 'none', cursor: 'pointer', fontSize: 10, color: card.locked ? '#6C63FF' : '#888', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2 }}
  >
    {card.locked
      ? <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
      : <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 019.9-1"/></svg>
    }
  </button>
  ```

  **1d. Guard drag — update the outer div's `onMouseDown`:**

  Replace the existing `onMouseDown` on the card's outer `<div>`:

  ```tsx
  onMouseDown={e => {
    if ((e.target as HTMLElement).closest('.no-drag')) return
    if (e.button !== 0) return
    onMoveStart(card.id, e.clientX, e.clientY)
    e.preventDefault()
    e.stopPropagation()
  }}
  ```

  With:

  ```tsx
  onMouseDown={e => {
    if ((e.target as HTMLElement).closest('.no-drag')) return
    if (e.button !== 0) return
    if (card.locked) return
    onMoveStart(card.id, e.clientX, e.clientY)
    e.preventDefault()
    e.stopPropagation()
  }}
  ```

  **1e. Guard resize — update the resize handle's `onMouseDown`:**

  Replace:

  ```tsx
  onMouseDown={e => {
    e.stopPropagation()
    e.preventDefault()
    onResizeStart(card.id, e.clientX, e.clientY, card.card_width ?? 185, card.card_height ?? null)
  }}
  ```

  With:

  ```tsx
  onMouseDown={e => {
    if (card.locked) return
    e.stopPropagation()
    e.preventDefault()
    onResizeStart(card.id, e.clientX, e.clientY, card.card_width ?? 185, card.card_height ?? null)
  }}
  ```

  **1f. Show a locked cursor when the card is locked.** In the card's outer `<div>` style, change:

  ```tsx
  cursor: 'grab',
  ```

  to:

  ```tsx
  cursor: card.locked ? 'default' : 'grab',
  ```

- [ ] **Step 2: Wire `onToggleLock` in `Board.tsx`**

  Open `src/components/Board.tsx`. Add `onToggleLock` to the `IdeaCard` render:

  ```tsx
  <IdeaCard
    card={card} dark={dark}
    onMoveStart={onCardMoveStart}
    onResizeStart={onResizeStart}
    onEdit={openEdit}
    onDelete={async id => { await brd.removeCard(id); showToast('Card deleted') }}
    onInlineTitle={async (id, title) => { await brd.updateCard(id, { title }); showToast('Renamed ✓') }}
    onToggleCollapse={async id => { await brd.updateCard(id, { collapsed: !brd.cards.find(c => c.id === id)?.collapsed }) }}
    onDuplicate={async id => { await brd.duplicateCard(id); showToast('Card duplicated ✓') }}
    onToggleLock={async id => {
      const locked = !brd.cards.find(c => c.id === id)?.locked
      await brd.updateCard(id, { locked })
      showToast(locked ? 'Card locked 🔒' : 'Card unlocked')
    }}
  />
  ```

- [ ] **Step 3: Verify TypeScript compiles**

  ```bash
  npx tsc --noEmit
  ```

  Expected: no errors.

- [ ] **Step 4: Test manually in browser**

  Confirm:
  - Each card has a small lock icon button (top-right, left of the copy icon)
  - Clicking it turns purple and card cannot be dragged
  - Resize handle is also disabled when locked
  - Clicking again unlocks and drag/resize work again
  - Lock state persists after reload

- [ ] **Step 5: Commit**

  ```bash
  git add src/components/IdeaCard.tsx src/components/Board.tsx
  git commit -m "feat: lock card in place to prevent accidental dragging"
  ```

---

## Task 5: Right-Click Colour Picker

**Files:**
- Modify: `src/components/IdeaCard.tsx`
- Modify: `src/components/Board.tsx`

- [ ] **Step 1: Add `onColorPick` prop to `IdeaCard`**

  Open `src/components/IdeaCard.tsx`.

  **1a. Add `onColorPick` to props interface:**

  ```typescript
  interface IdeaCardProps {
    card: Card
    onMoveStart:      (id: string, clientX: number, clientY: number) => void
    onResizeStart:    (id: string, clientX: number, clientY: number, startW: number, startH: number | null) => void
    onEdit:           (id: string) => void
    onDelete:         (id: string) => void
    onInlineTitle:    (id: string, title: string) => void
    onToggleCollapse: (id: string) => void
    onDuplicate:      (id: string) => void
    onToggleLock:     (id: string) => void
    onColorPick:      (id: string, clientX: number, clientY: number) => void
    dark: boolean
  }
  ```

  **1b. Update the function signature:**

  ```typescript
  export default function IdeaCard({ card, onMoveStart, onResizeStart, onEdit, onDelete, onInlineTitle, onToggleCollapse, onDuplicate, onToggleLock, onColorPick, dark }: IdeaCardProps) {
  ```

  **1c. Add `onContextMenu` to the outer card div.** The outer `<div>` currently starts:

  ```tsx
  <div
    id={`card_${card.id}`}
    onMouseDown={e => {
  ```

  Add `onContextMenu` after `onDoubleClick`:

  ```tsx
  onContextMenu={e => {
    if ((e.target as HTMLElement).closest('.no-drag')) return
    e.preventDefault()
    e.stopPropagation()
    onColorPick(card.id, e.clientX, e.clientY)
  }}
  ```

- [ ] **Step 2: Add colour picker overlay to `Board.tsx`**

  Open `src/components/Board.tsx`.

  **2a. Add the colour swatches constant** — add near the top of the file, after the `import` statements (before the `BoardProps` interface):

  ```typescript
  const COLOUR_SWATCHES = [
    { value: 'white',   label: 'White',  border: '#ddd' },
    { value: '#FFF9C4', label: 'Yellow' },
    { value: '#FFD6E0', label: 'Pink'   },
    { value: '#D4EDD8', label: 'Green'  },
    { value: '#D0E8FF', label: 'Blue'   },
    { value: '#E8E0F5', label: 'Purple' },
    { value: '#FFD6C2', label: 'Peach'  },
    { value: '#1A1A2E', label: 'Dark'   },
  ]
  ```

  **2b. Add the colour picker state** — add alongside the other `useState` calls near the top of the `Board` component body:

  ```typescript
  const [colourPicker, setColourPicker] = useState<{ cardId: string; x: number; y: number } | null>(null)
  ```

  **2c. Add the handler** — add alongside other handlers (`openEdit`, `handleSave`, etc.):

  ```typescript
  const handleColorPick = useCallback((cardId: string, clientX: number, clientY: number) => {
    setColourPicker({ cardId, x: clientX, y: clientY })
  }, [])
  ```

  **2d. Add Escape to close picker** — find the keyboard shortcut `useEffect` and add:

  ```typescript
  if (e.key === 'Escape') setColourPicker(null)
  ```

  The full handler becomes:

  ```typescript
  const onKey = (e: KeyboardEvent) => {
    const target = e.target as HTMLElement
    if (target.closest('input,textarea')) return
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') { brd.undo(); showToast('Undone ↩') }
    if (e.key === 'Escape') setColourPicker(null)
    if (e.key === 'n' && !e.ctrlKey && !e.metaKey) {
      const cr = canvasRef.current?.getBoundingClientRect()
      if (cr) { newCardWorld.current = screenToWorld(cr.left + cr.width / 2, cr.top + cr.height / 2); setEditingCard(null); setModalOpen(true) }
    }
  }
  ```

  **2e. Render the colour picker overlay.** Add this just before the `<CardModal` line (near the end of the JSX return, inside the outermost `<div>`):

  ```tsx
  {/* Colour picker overlay */}
  {colourPicker && (
    <>
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 900 }}
        onClick={() => setColourPicker(null)}
        onContextMenu={e => { e.preventDefault(); setColourPicker(null) }}
      />
      <div style={{
        position: 'fixed',
        left: Math.min(colourPicker.x, window.innerWidth - 180),
        top: Math.min(colourPicker.y, window.innerHeight - 80),
        zIndex: 901,
        background: dark ? '#1A1A24' : 'white',
        border: `1px solid ${dark ? '#2A2A38' : '#ddd'}`,
        borderRadius: 12,
        padding: '10px 12px',
        boxShadow: '0 8px 24px rgba(0,0,0,.22)',
        display: 'flex',
        gap: 8,
        flexWrap: 'wrap',
        width: 164,
      }}>
        {COLOUR_SWATCHES.map(sw => (
          <div
            key={sw.value}
            onClick={() => {
              brd.updateCard(colourPicker.cardId, { bg: sw.value })
              setColourPicker(null)
            }}
            title={sw.label}
            style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              background: sw.value,
              cursor: 'pointer',
              border: `2px solid ${(sw as { border?: string }).border ?? 'transparent'}`,
              boxSizing: 'border-box',
              transition: 'transform .12s',
            }}
            onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.transform = 'scale(1.15)'}
            onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.transform = 'scale(1)'}
          />
        ))}
      </div>
    </>
  )}
  ```

  **2f. Wire `onColorPick` in the IdeaCard render:**

  ```tsx
  <IdeaCard
    card={card} dark={dark}
    onMoveStart={onCardMoveStart}
    onResizeStart={onResizeStart}
    onEdit={openEdit}
    onDelete={async id => { await brd.removeCard(id); showToast('Card deleted') }}
    onInlineTitle={async (id, title) => { await brd.updateCard(id, { title }); showToast('Renamed ✓') }}
    onToggleCollapse={async id => { await brd.updateCard(id, { collapsed: !brd.cards.find(c => c.id === id)?.collapsed }) }}
    onDuplicate={async id => { await brd.duplicateCard(id); showToast('Card duplicated ✓') }}
    onToggleLock={async id => {
      const locked = !brd.cards.find(c => c.id === id)?.locked
      await brd.updateCard(id, { locked })
      showToast(locked ? 'Card locked 🔒' : 'Card unlocked')
    }}
    onColorPick={handleColorPick}
  />
  ```

- [ ] **Step 3: Verify TypeScript compiles**

  ```bash
  npx tsc --noEmit
  ```

  Expected: no errors.

- [ ] **Step 4: Test manually in browser**

  Confirm:
  - Right-clicking a card opens an 8-colour palette near the cursor
  - Clicking a swatch immediately changes the card background
  - Clicking outside the palette closes it
  - Pressing Escape closes it
  - Right-clicking with palette already open on same card: replaces it
  - Palette doesn't appear when right-clicking buttons on the card (`.no-drag` guard)

- [ ] **Step 5: Commit**

  ```bash
  git add src/components/IdeaCard.tsx src/components/Board.tsx
  git commit -m "feat: right-click colour picker on cards"
  ```

---

## Task 6: Card Templates

**Files:**
- Modify: `src/components/CardModal.tsx`

- [ ] **Step 1: Add the templates to `CardModal.tsx`**

  Open `src/components/CardModal.tsx`.

  **1a. Add `TEMPLATES` constant** — add after the existing `COLORS` constant (around line 18):

  ```typescript
  const TEMPLATES: { label: string; title: string; body: string; tag: TagType; bg: string }[] = [
    { label: 'Bug Report',   title: 'Bug: ',     body: '**Steps:**\n\n**Expected:**',     tag: 'critical', bg: '#FFD6E0' },
    { label: 'Feature Idea', title: 'Feature: ', body: '**Why:**\n\n**How:**',             tag: 'idea',     bg: '#E8E0F5' },
    { label: 'Meeting Note', title: 'Meeting: ', body: '**Attendees:**\n\n**Actions:**',   tag: 'planned',  bg: '#D0E8FF' },
    { label: 'Task',         title: 'Task: ',    body: '',                                tag: 'planned',  bg: 'white'   },
    { label: 'Quick Note',   title: '',          body: '',                                tag: 'idea',     bg: '#FFF9C4' },
  ]
  ```

  **1b. Add `activeTemplate` state** inside the `CardModal` function, alongside the other `useState` calls:

  ```typescript
  const [activeTemplate, setActiveTemplate] = useState<string | null>(null)
  ```

  **1c. Reset `activeTemplate` when modal opens** — update the existing `useEffect` that handles `isOpen`:

  ```typescript
  useEffect(() => {
    if (isOpen) {
      setTitle(card?.title ?? ''); setBody(card?.body ?? '')
      setDateLabel(card?.date_label ?? ''); setDueDate(card?.due_date ?? '')
      setTag(card?.tag ?? 'idea'); setBg(card?.bg ?? 'white'); setTitleErr(false)
      setActiveTemplate(null)
      setTimeout(() => titleRef.current?.focus(), 180)
    }
  }, [card, isOpen])
  ```

  **1d. Add the template chips row** — insert it between the modal header (`<div style={{ display: 'flex', alignItems: 'center' ... }}>`) and the first `<Field label="Title *">`. The exact location is after the closing `</div>` of the header block and before `<Field label="Title *"`:

  ```tsx
  {/* Template chips — only shown for new cards */}
  {!card && (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.05em', textTransform: 'uppercase', color: labelC, marginBottom: 6 }}>Start from template</div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {TEMPLATES.map(tpl => (
          <button
            key={tpl.label}
            type="button"
            onClick={() => {
              setTitle(tpl.title)
              setBody(tpl.body)
              setTag(tpl.tag)
              setBg(tpl.bg)
              setActiveTemplate(tpl.label)
              setTitleErr(false)
              setTimeout(() => titleRef.current?.focus(), 0)
            }}
            style={{
              padding: '4px 10px',
              borderRadius: 16,
              border: `1.5px solid ${activeTemplate === tpl.label ? '#6C63FF' : (dark ? '#2A2A38' : '#E0E0E0')}`,
              background: activeTemplate === tpl.label ? 'rgba(108,99,255,.1)' : 'transparent',
              color: activeTemplate === tpl.label ? '#6C63FF' : (dark ? '#888' : '#555'),
              fontSize: 11,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: "'DM Sans',sans-serif",
              transition: 'all .15s',
            }}
          >{tpl.label}</button>
        ))}
      </div>
    </div>
  )}
  ```

- [ ] **Step 2: Verify TypeScript compiles**

  ```bash
  npx tsc --noEmit
  ```

  Expected: no errors.

- [ ] **Step 3: Test manually in browser**

  Open the "Add Card" modal (click "+ Add Card" or double-click the canvas). Confirm:
  - A "Start from template" row appears with 5 chip buttons
  - Clicking "Bug Report" fills in the title as "Bug: ", sets tag to Critical, sets bg to pink
  - Clicking "Feature Idea" overwrites the fields immediately (no confirm)
  - The active template chip highlights purple
  - When editing an existing card (double-click), the template row does NOT appear
  - After filling from a template, the user can still edit all fields freely

- [ ] **Step 4: Run all tests**

  ```bash
  npm test
  ```

  Expected:
  ```
  ✓ src/lib/db.test.ts (4)
  ✓ src/lib/snapPosition.test.ts (7)
  Test Files  2 passed (2)
  Tests  11 passed (11)
  ```

- [ ] **Step 5: Commit**

  ```bash
  git add src/components/CardModal.tsx
  git commit -m "feat: card templates in add card modal"
  ```

---

## Final Verification

- [ ] Start dev server and do a full walkthrough: collapse, expand, duplicate, lock, unlock, colour pick, all 5 templates
- [ ] Reload the page and confirm: collapsed cards stay collapsed, locked cards stay locked, colours persist
- [ ] Undo (Ctrl+Z) after duplicating removes the duplicate
- [ ] Run `npm test` — all 11 tests pass
- [ ] Run `npx tsc --noEmit` — zero errors
