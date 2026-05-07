# Font Size + Bounce Animation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add A⁻/A⁺ font-size buttons (applied to selected text) and a bounce/overshoot click animation to all toolbar buttons in `TextBlockItem`.

**Architecture:** Single-file change to `src/components/TextBlockItem.tsx`. Task 1 adds `changeFontSize` and the two new buttons. Task 2 adds the `bouncing` state, a `<style>` keyframe tag, and wires the animation into all five buttons. No type changes, no hook changes, no Board.tsx changes.

**Tech Stack:** React 18, TypeScript, DOM Selection API, CSS keyframe animation via inline `<style>` tag.

---

## File Map

| File | Change |
|---|---|
| `src/components/TextBlockItem.tsx` | Add `changeFontSize`, A⁻/A⁺ buttons, `bouncing` state, `@keyframes snapBounce`, animation wiring |

---

## Task 1: Font-size buttons (A⁻ / A⁺)

**Files:**
- Modify: `src/components/TextBlockItem.tsx`

No unit tests exist for DOM/Selection API code (can't run in node test environment — same reason `execFormat` isn't tested). Tests = TypeScript check + manual.

- [ ] **Step 1: Add `changeFontSize` after `execFormat`**

Open `src/components/TextBlockItem.tsx`. Find (lines 31–34):

```typescript
  const execFormat = useCallback((cmd: string, value?: string) => {
    editRef.current?.focus()
    document.execCommand(cmd, false, value)
  }, [])
```

Replace with:

```typescript
  const execFormat = useCallback((cmd: string, value?: string) => {
    editRef.current?.focus()
    document.execCommand(cmd, false, value)
  }, [])

  const changeFontSize = useCallback((delta: number) => {
    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return
    const range = sel.getRangeAt(0)
    const anchor = sel.anchorNode
    const el = anchor
      ? (anchor.nodeType === Node.TEXT_NODE ? anchor.parentElement : anchor as HTMLElement)
      : editRef.current
    const currentPx = el ? parseInt(getComputedStyle(el).fontSize, 10) : 14
    const newPx = Math.max(8, Math.min(72, currentPx + delta))
    const span = document.createElement('span')
    span.style.fontSize = `${newPx}px`
    try {
      range.surroundContents(span)
    } catch {
      // Selection crosses element boundaries — extract and reinsert
      const contents = range.extractContents()
      span.appendChild(contents)
      range.insertNode(span)
    }
    sel.removeAllRanges()
    const newRange = document.createRange()
    newRange.selectNodeContents(span)
    sel.addRange(newRange)
  }, [])
```

- [ ] **Step 2: Add A⁻ and A⁺ buttons to the toolbar**

In the same file, find the toolbar's opening (the `>` that closes the toolbar container div) followed immediately by the Bold button comment (lines 72–78):

```tsx
        >
          {/* Bold */}
          <button
            onMouseDown={e => { e.preventDefault(); execFormat('bold') }}
            title="Bold"
            style={{ fontWeight: 700, fontSize: 12, color: dark ? '#E8E6E0' : '#263D5B', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 7px', borderRadius: 4 }}
          >B</button>
```

Replace with:

```tsx
        >
          {/* Smaller */}
          <button
            onMouseDown={e => { e.preventDefault(); changeFontSize(-4) }}
            title="Decrease font size"
            style={{ fontSize: 11, color: dark ? '#E8E6E0' : '#263D5B', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 7px', borderRadius: 4 }}
          >A⁻</button>
          {/* Larger */}
          <button
            onMouseDown={e => { e.preventDefault(); changeFontSize(4) }}
            title="Increase font size"
            style={{ fontSize: 13, color: dark ? '#E8E6E0' : '#263D5B', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 7px', borderRadius: 4 }}
          >A⁺</button>
          {/* Size/format divider */}
          <div style={{ width: 1, height: 14, background: dark ? '#2A2A38' : '#e8e4d9', margin: '0 4px' }} />
          {/* Bold */}
          <button
            onMouseDown={e => { e.preventDefault(); execFormat('bold') }}
            title="Bold"
            style={{ fontWeight: 700, fontSize: 12, color: dark ? '#E8E6E0' : '#263D5B', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 7px', borderRadius: 4 }}
          >B</button>
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd C:\Users\User\Downloads\ideaboard-v3\ideaboard3
npx tsc --noEmit
```

Expected: no new errors (pre-existing CDN error in `pdfImport.ts` is fine).

- [ ] **Step 4: Run all tests**

```bash
npm test
```

Expected: 35/35 pass.

- [ ] **Step 5: Manual smoke test**

Open http://localhost:5180 (run `npm run dev` if not running). Click "+ Add Text", add a block, type some text, select a word, click **A⁺** several times — the selected word grows. Click **A⁻** — it shrinks. Click with no selection — nothing happens. Reload — font sizes persist.

- [ ] **Step 6: Commit**

```bash
cd C:\Users\User\Downloads\ideaboard-v3\ideaboard3
git add src/components/TextBlockItem.tsx
git commit -m "feat: add A-/A+ font-size buttons to text block toolbar"
```

---

## Task 2: Bounce animation on all toolbar buttons

**Files:**
- Modify: `src/components/TextBlockItem.tsx`

- [ ] **Step 1: Add `bouncing` state**

Find (lines 18–20):

```typescript
  const [focused, setFocused] = useState(false)
  const [isEmpty, setIsEmpty] = useState(!block.html)
  const editRef = useRef<HTMLDivElement>(null)
```

Replace with:

```typescript
  const [focused, setFocused] = useState(false)
  const [isEmpty, setIsEmpty] = useState(!block.html)
  const [bouncing, setBouncing] = useState<string | null>(null)
  const editRef = useRef<HTMLDivElement>(null)
```

- [ ] **Step 2: Wrap the return in a fragment and add the keyframe `<style>` tag**

Find the return statement opening (line 40–43):

```tsx
  return (
    <div
      className="world-item"
      style={{ position: 'absolute', left: block.x, top: block.y, width: block.width, userSelect: 'none' }}
```

Replace with:

```tsx
  return (
    <>
      <style>{`@keyframes snapBounce{0%{transform:scale(1)}25%{transform:scale(.88)}65%{transform:scale(1.15)}100%{transform:scale(1)}}`}</style>
      <div
        className="world-item"
        style={{ position: 'absolute', left: block.x, top: block.y, width: block.width, userSelect: 'none' }}
```

Then find the closing of the return (lines 173–176):

```tsx
    </div>
  )
})
```

Replace with:

```tsx
    </div>
    </>
  )
})
```

- [ ] **Step 3: Wire bounce into the A⁻ button**

Find:

```tsx
          {/* Smaller */}
          <button
            onMouseDown={e => { e.preventDefault(); changeFontSize(-4) }}
            title="Decrease font size"
            style={{ fontSize: 11, color: dark ? '#E8E6E0' : '#263D5B', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 7px', borderRadius: 4 }}
          >A⁻</button>
```

Replace with:

```tsx
          {/* Smaller */}
          <button
            onMouseDown={e => { e.preventDefault(); setBouncing('smaller'); setTimeout(() => setBouncing(null), 240); changeFontSize(-4) }}
            title="Decrease font size"
            style={{ fontSize: 11, color: dark ? '#E8E6E0' : '#263D5B', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 7px', borderRadius: 4, animation: bouncing === 'smaller' ? 'snapBounce 240ms ease-out' : 'none' }}
          >A⁻</button>
```

- [ ] **Step 4: Wire bounce into the A⁺ button**

Find:

```tsx
          {/* Larger */}
          <button
            onMouseDown={e => { e.preventDefault(); changeFontSize(4) }}
            title="Increase font size"
            style={{ fontSize: 13, color: dark ? '#E8E6E0' : '#263D5B', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 7px', borderRadius: 4 }}
          >A⁺</button>
```

Replace with:

```tsx
          {/* Larger */}
          <button
            onMouseDown={e => { e.preventDefault(); setBouncing('larger'); setTimeout(() => setBouncing(null), 240); changeFontSize(4) }}
            title="Increase font size"
            style={{ fontSize: 13, color: dark ? '#E8E6E0' : '#263D5B', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 7px', borderRadius: 4, animation: bouncing === 'larger' ? 'snapBounce 240ms ease-out' : 'none' }}
          >A⁺</button>
```

- [ ] **Step 5: Wire bounce into the B button**

Find:

```tsx
          {/* Bold */}
          <button
            onMouseDown={e => { e.preventDefault(); execFormat('bold') }}
            title="Bold"
            style={{ fontWeight: 700, fontSize: 12, color: dark ? '#E8E6E0' : '#263D5B', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 7px', borderRadius: 4 }}
          >B</button>
```

Replace with:

```tsx
          {/* Bold */}
          <button
            onMouseDown={e => { e.preventDefault(); setBouncing('bold'); setTimeout(() => setBouncing(null), 240); execFormat('bold') }}
            title="Bold"
            style={{ fontWeight: 700, fontSize: 12, color: dark ? '#E8E6E0' : '#263D5B', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 7px', borderRadius: 4, animation: bouncing === 'bold' ? 'snapBounce 240ms ease-out' : 'none' }}
          >B</button>
```

- [ ] **Step 6: Wire bounce into the I button**

Find:

```tsx
          {/* Italic */}
          <button
            onMouseDown={e => { e.preventDefault(); execFormat('italic') }}
            title="Italic"
            style={{ fontStyle: 'italic', fontSize: 12, color: dark ? '#E8E6E0' : '#263D5B', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 7px', borderRadius: 4 }}
          >I</button>
```

Replace with:

```tsx
          {/* Italic */}
          <button
            onMouseDown={e => { e.preventDefault(); setBouncing('italic'); setTimeout(() => setBouncing(null), 240); execFormat('italic') }}
            title="Italic"
            style={{ fontStyle: 'italic', fontSize: 12, color: dark ? '#E8E6E0' : '#263D5B', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 7px', borderRadius: 4, animation: bouncing === 'italic' ? 'snapBounce 240ms ease-out' : 'none' }}
          >I</button>
```

- [ ] **Step 7: Wire bounce into the H button**

Find:

```tsx
          {/* Highlight */}
          <button
            onMouseDown={e => { e.preventDefault(); execFormat('hiliteColor', '#ffe082') }}
            title="Highlight"
            style={{ fontSize: 12, color: dark ? '#E8E6E0' : '#263D5B', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 7px', borderRadius: 4 }}
          ><span style={{ background: '#ffe082', padding: '0 3px', borderRadius: 2 }}>H</span></button>
```

Replace with:

```tsx
          {/* Highlight */}
          <button
            onMouseDown={e => { e.preventDefault(); setBouncing('highlight'); setTimeout(() => setBouncing(null), 240); execFormat('hiliteColor', '#ffe082') }}
            title="Highlight"
            style={{ fontSize: 12, color: dark ? '#E8E6E0' : '#263D5B', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 7px', borderRadius: 4, animation: bouncing === 'highlight' ? 'snapBounce 240ms ease-out' : 'none' }}
          ><span style={{ background: '#ffe082', padding: '0 3px', borderRadius: 2 }}>H</span></button>
```

- [ ] **Step 8: Verify TypeScript compiles**

```bash
cd C:\Users\User\Downloads\ideaboard-v3\ideaboard3
npx tsc --noEmit
```

Expected: no new errors.

- [ ] **Step 9: Run all tests**

```bash
npm test
```

Expected: 35/35 pass.

- [ ] **Step 10: Manual smoke test**

Open http://localhost:5180. Click "+ Add Text", focus a block. Click each toolbar button — **A⁻, A⁺, B, I, H** — and watch for the bounce: button should squish (scale ~0.88) then pop past normal (~1.15) then settle, in about 240ms. All five buttons should bounce independently.

- [ ] **Step 11: Commit**

```bash
cd C:\Users\User\Downloads\ideaboard-v3\ideaboard3
git add src/components/TextBlockItem.tsx
git commit -m "feat: add bounce animation to text block toolbar buttons"
```

---

## Final Verification

- [ ] `npm test` — 35 tests pass
- [ ] `npx tsc --noEmit` — no new errors
- [ ] Select text in a block → A⁺ grows it, A⁻ shrinks it, clamped at 8px/72px
- [ ] No selection → A⁻/A⁺ do nothing
- [ ] Font size persists on reload (stored in innerHTML span)
- [ ] All 5 buttons bounce on click
- [ ] Dark mode colours correct on new buttons
