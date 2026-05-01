# Doodle Redesign — Design Spec

## Goal

Apply the Doodle design system (playful, sketch-like, handwritten) to the Ideaboard canvas, sidebar, topbar, and framework overlays. Cards are unchanged. The result should feel like a real sketchbook — warm cream paper, hand-lettered labels, clean minimal icons.

---

## Design Tokens

| Token | Value | Usage |
|-------|-------|-------|
| `primary` | `#49B6E5` | Buttons, active states, accents |
| `secondary` | `#263D5B` | Navy — borders, headers, text |
| `surface` | `#fdfcf5` | Topbar background |
| `canvas-bg` | `#faf8f0` | Canvas background (cream) |
| `canvas-dot` | `rgba(0,0,0,0.16)` | Dot colour on canvas |
| `sidebar-bg` | `#141418` | Sidebar background |
| `sidebar-border` | `#1A1A22` | Sidebar right border |
| `topbar-border` | `#e8e4d9` | Topbar bottom border |
| `text` | `#111827` | Body text |
| `font-display` | `Delius Swash Caps` | Headings, labels, nav (Google Fonts) |
| `font-mono` | `JetBrains Mono` | Coordinate HUD |

---

## 1. Canvas Background

- Background colour: `#faf8f0`
- Dot pattern: `radial-gradient(circle, rgba(0,0,0,0.16) 1px, transparent 1px)` at `22px × 22px` spacing
- Background position shifts with pan to give parallax feel (existing behaviour retained)
- Dark mode canvas: `#0F0F14` with `rgba(255,255,255,0.08)` dots (unchanged from current)

---

## 2. Sidebar

### Structure
- Width: 68px (unchanged)
- Background: `#141418`
- Right border: `1px solid #1A1A22`
- Logo pill: 36×36px, `border-radius: 10px`, gradient `linear-gradient(135deg, #49B6E5, #263D5B)`, white border `2px solid rgba(255,255,255,0.2)`, letter "I" in Delius Swash Caps

### Buttons
- Size: 42×42px, `border-radius: 10px`
- Default: `color: rgba(255,255,255,0.45)`, no background, no border
- Hover/active: `background: rgba(73,182,229,0.12)`, `color: #49B6E5`, `border: 1px solid rgba(73,182,229,0.3)`
- Dividers: `width: 28px`, `height: 1px`, `background: #1A1A22`, `margin: 4px 0`

### Icons (Set C — Minimal Sharp, SVG, 18×18, stroke-width 1.8, round caps/joins)

| Button | Icon description |
|--------|-----------------|
| Back to boards | Left arrow: `M19 12H5 M12 5l-7 7 7 7` |
| New Card | Plus cross: `M12 5v14 M5 12h14` |
| Fit All | Expand arrows: `M15 3h6v6 M9 21H3v-6 M21 3l-7 7 M3 21l7-7` |
| Reset Zoom | Magnifier with plus: `circle cx=11 cy=11 r=8` + crosshair lines |
| Export PDF | File with down arrow: folder + `M12 10v6m0 0l-3-3m3 3l3-3` |
| Import PDF | Upload arrow: `M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1 M8 8l4-4 4 4 M12 4v12` |
| Undo | Curved undo: `M3 7v6h6` + `M21 17a9 9 0 00-9-9 9 9 0 00-6 2.3L3 13` |
| Dark mode (light) | Crescent moon: `M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z` |
| Dark mode (dark) | Sun: circle r=5 + 8 ray lines |
| User avatar | Initials circle — unchanged |

---

## 3. Topbar

- Height: 50px (unchanged)
- Background: `rgba(253,252,245,0.97)` with `backdrop-filter: blur(12px)`
- Bottom border: `2px solid #e8e4d9`

### Elements (left → right)
1. **Breadcrumb** `"Boards /"` — 12px, `#aaa`, font: Delius
2. **Board name** — 15px bold, `#263D5B`, font: **Delius Swash Caps**
3. **Framework pill** — `border: 1.5px solid #263D5B`, `border-radius: 20px`, 10px Delius Swash Caps, `color: #263D5B`, no fill background; shows current framework + `▾` chevron
4. **Spacer**
5. **Hint text** — unchanged
6. **Add Card button** — `background: #49B6E5`, `color: white`, `border: 2px solid #263D5B`, `border-radius: 8px`, `box-shadow: 2px 2px 0 #263D5B`, font: Delius Swash Caps 11px bold

---

## 4. Eisenhower Matrix Framework

### Outer container
- Border: `2.5px solid #263D5B`, `border-radius: 8px`
- Box shadow: `3px 3px 0 rgba(38,61,91,0.2)`
- Background: white (inside the frame)

### Header row (top, 28px tall)
- Background: `#263D5B`
- Left corner cell (blank, 90px wide): `border-right: 2px solid rgba(255,255,255,0.2)`
- Two column cells: "URGENT" and "NOT URGENT" in white, 9px Delius Swash Caps, letter-spacing 0.05em
- Cells separated by `border-right: 1.5px solid rgba(255,255,255,0.15)`

### Left label column (90px wide)
- Border-right: `2px solid #263D5B`
- Two row cells: "IMPORTANT" and "NOT IMPORTANT" — vertical text (rotated 180°), 9px Delius Swash Caps, `rgba(38,61,91,0.55)`
- Separated by `border-bottom: 1.5px solid rgba(38,61,91,0.15)`

### Quadrant grid (2×2)
- Quadrant dividers: `1.5px solid rgba(38,61,91,0.15)`
- Each quadrant has a label in top-left: "Do First", "Schedule", "Delegate", "Eliminate"
- Label style: 10px Delius Swash Caps, `rgba(38,61,91,0.4)`, italic
- Cards placed freely inside quadrants (no snap-to-zone — unchanged behaviour)

### Resize handle
- Bottom-right corner SVG grip — unchanged behaviour, unchanged style

---

## 5. OODA Loop Framework

Same ruled-sections treatment as Eisenhower:
- Outer border: `2.5px solid #263D5B`, `border-radius: 8px`, same shadow
- Header row: `#263D5B` background with 4 column labels: "OBSERVE", "ORIENT", "DECIDE", "ACT" — white, Delius Swash Caps
- No row labels column (OODA is horizontal only)
- Between columns: each of the 3 divider lines has a small `›` chevron SVG centred vertically on it, `color: #49B6E5`, 12px, `pointer-events: none` (decorative only)
- Column body: white background, column name repeated as a large watermark label in very light `rgba(38,61,91,0.06)`, 32px Delius Swash Caps
- Resize handle: unchanged

---

## 6. Font Loading

Add to `index.html` `<head>`:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Delius+Swash+Caps&family=Delius&family=JetBrains+Mono:wght@400&display=swap" rel="stylesheet">
```

`Delius Swash Caps` is used for: board name, framework pill, sidebar logo, topbar Add Card button, framework quadrant/column labels, HUD zoom percentage.

`Delius` (non-swash) is used for: topbar breadcrumb, hint text, card date labels (light body copy).

`JetBrains Mono` is used for: world coordinate HUD (bottom-left).

---

## 7. Cards (Unchanged)

No changes to `IdeaCard.tsx` or `CardModal.tsx`. Card colours, tags, borders, shadows, resize handle, and collapse/lock behaviour are all preserved exactly as-is.

---

## 8. Dark Mode

Dark mode canvas and sidebar backgrounds are already dark — the main changes in dark mode:
- Topbar switches to `rgba(13,13,18,0.94)` (existing dark topbar colour)
- Topbar board name: `#F0EEE8` (existing light text)
- Framework pill in dark: `border-color: #49B6E5`, `color: #49B6E5`
- Topbar border: `rgba(255,255,255,0.06)` (existing)
- All Delius font usage follows the same light/dark colour swap as existing text colours

---

## Files Modified

| File | Change |
|------|--------|
| `index.html` | Add Google Fonts link tags |
| `src/components/Board.tsx` | Canvas background, sidebar icons + styling, topbar styling, framework pill styling, Add Card button styling |
| `src/components/FrameworkOverlay.tsx` | Full restyle of Eisenhower Matrix and OODA Loop to ruled-sections design |

No new files created. No changes to `IdeaCard.tsx`, `CardModal.tsx`, `useBoard.ts`, `useFramework.ts`, or any hooks/lib files.

---

## Testing

- Manual: board loads with cream dotted canvas, Delius fonts visible in topbar and sidebar
- Manual: all 8 sidebar icons render correctly, hover state glows blue
- Manual: Eisenhower Matrix shows navy header row with column/row labels, quadrant italic labels
- Manual: OODA Loop shows 4-column ruled layout with arrows between columns
- Manual: dark mode toggle — topbar/canvas switch correctly, fonts remain readable
- Manual: resize handle on framework still works, size persists on reload
- Manual: cards unchanged — create, edit, drag, resize all work as before
