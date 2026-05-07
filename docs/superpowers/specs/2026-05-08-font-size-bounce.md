# Font Size + Bounce Animation — Design Spec

## Goal

Add **A⁻ / A⁺** font-size buttons to the text block toolbar (applied to selected text), and add a **bounce/overshoot animation** to all five toolbar buttons on click.

---

## Scope

One file changes: `src/components/TextBlockItem.tsx`

No changes to `TextBlock` type, `useTextBlocks`, `Board.tsx`, or any other file.

---

## Feature 1: Font Size (A⁻ / A⁺)

### Toolbar layout

```
A⁻  A⁺  |  B  I  H  |  ✕
```

Two new buttons added left of the existing B·I·H group, separated by a divider. The existing divider before ✕ remains.

### Button labels

- `A⁻` — smaller text (visually: small "A" with minus)
- `A⁺` — larger text (visually: large "A" with plus)

### Behaviour

- Applies to the **current text selection** only. If nothing is selected (collapsed cursor), does nothing.
- Step size: **4px** per click.
- Range: **8px minimum, 72px maximum**.
- Default block font size is 14px (set on the contentEditable div).

### Implementation: `changeFontSize(delta: number)`

```typescript
const changeFontSize = useCallback((delta: number) => {
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return
  const range = sel.getRangeAt(0)

  // Read computed font size at anchor node
  const anchor = sel.anchorNode
  const el = anchor
    ? (anchor.nodeType === Node.TEXT_NODE ? anchor.parentElement : anchor as HTMLElement)
    : editRef.current
  const currentPx = el ? parseInt(getComputedStyle(el).fontSize, 10) : 14
  const newPx = Math.max(8, Math.min(72, currentPx + delta))

  // Wrap selection in a span with the new size
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

  // Restore selection to span contents
  sel.removeAllRanges()
  const newRange = document.createRange()
  newRange.selectNodeContents(span)
  sel.addRange(newRange)
}, [])
```

### Persistence

The `<span style="font-size: Xpx">` is part of the contentEditable's `innerHTML`. The existing `onBlur` → `updateBlockHtml` flow saves it to localStorage. No extra wiring needed.

### Event handler pattern

Same as B/I/H: `onMouseDown` + `e.preventDefault()` to preserve the text selection before the button action fires.

---

## Feature 2: Bounce Animation on All Toolbar Buttons

### Animation definition

A `<style>` tag rendered inside the component (above the outer div) defines one keyframe:

```css
@keyframes snapBounce {
  0%   { transform: scale(1); }
  25%  { transform: scale(0.88); }
  65%  { transform: scale(1.15); }
  100% { transform: scale(1); }
}
```

Duration: **240ms**, timing: `ease-out`.

### State

```typescript
const [bouncing, setBouncing] = useState<string | null>(null)
```

A single state value holds the id of the currently-bouncing button (`'smaller'`, `'larger'`, `'bold'`, `'italic'`, `'highlight'`), or `null` when no button is animating.

### Per-button wiring

Each button's `onMouseDown` handler:
1. Calls `setBouncing(buttonId)`
2. Calls `setTimeout(() => setBouncing(null), 240)` to clear after the animation completes
3. Performs the existing formatting action (same as before)

```typescript
onMouseDown={e => {
  e.preventDefault()
  setBouncing('bold')
  setTimeout(() => setBouncing(null), 240)
  execFormat('bold')
}}
```

### Applying the animation

Each button gets:
```typescript
style={{
  ...existingStyles,
  animation: bouncing === buttonId ? 'snapBounce 240ms ease-out' : 'none',
}}
```

The `transformOrigin` defaults to `center center`, which is correct for a scale animation.

---

## Button Styling

A⁻ and A⁺ match the existing B/I/H button style:

```
fontSize: 12, color: dark ? '#E8E6E0' : '#263D5B'
background: none, border: none, cursor: pointer
padding: '2px 7px', borderRadius: 4
```

A⁻ label: `A⁻` (or `a−` for a subtler look)
A⁺ label: `A⁺`

Both have `title` attributes: `"Decrease font size"` / `"Increase font size"`.

---

## Files

| File | Change |
|---|---|
| `src/components/TextBlockItem.tsx` | Add `changeFontSize`, `bouncing` state, `<style>` tag, A⁻/A⁺ buttons, bounce wiring on all 5 buttons |

---

## Testing

- Manual: select text in a block, click A⁺ repeatedly — font grows in 4px steps up to 72px
- Manual: click A⁻ — font shrinks in 4px steps, stops at 8px
- Manual: click with no selection — nothing happens
- Manual: reload page — font size spans persist
- Manual: click B/I/H/A⁻/A⁺ — bounce animation fires on each
- Manual: dark mode — button colours correct
