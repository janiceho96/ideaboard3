# PDF Import as Slide Tiles — Design Spec

## Goal

Let users upload one or more PDF files onto the Ideaboard canvas. Each page becomes a freely draggable image tile, positioned in a temporary 4-wide grid near the current view. Cards and remarks can be placed around the tiles freely.

---

## Features

### 1. Import PDF button

A new "Import PDF" button is added to the sidebar (below the existing PDF export button, separated by a divider). Clicking it opens the browser's native file picker filtered to `.pdf` files. Multiple files can be selected at once.

### 2. Slide tile rendering

Each PDF page is rendered to a PNG image using **PDF.js** (CDN-loaded, no bundle size cost). Pages are rendered at 1.5× pixel density for sharpness. The rendered image is stored in **IndexedDB** keyed by a unique slide ID.

### 3. Slide tile appearance

Each tile on the canvas:
- Displays the rendered page image, filling the tile with correct aspect ratio
- Has a default width of **260 world-units** (height is derived from the page's aspect ratio)
- Shows a small label below the image: `filename — p.N` (e.g. `Q2-Review.pdf — p.3`), in a muted colour, 9px font
- Shows a small × delete button on hover (top-right corner)
- Has `className="world-item"` so it participates in the canvas event system (pan prevention, etc.)
- Is **draggable** exactly like cards (uses the same `onCardMoveStart` / `onMove` / `onUp` mouse event system)
- Has a fixed aspect ratio — **no resize** for now

### 4. Initial layout

When a PDF is imported, its tiles are placed in a grid of **up to 4 tiles per row** starting at the current canvas view centre, with 20 world-unit gaps between tiles. Each row is offset downward by `tileHeight + 20`. If multiple PDFs are imported in one batch, each PDF's grid starts 40 world-units below the last row of the previous PDF. The user can then drag tiles freely.

### 5. Delete tile

Hovering a tile shows a × button (top-right, same style as card delete). Clicking it removes the tile's metadata from localStorage and its image from IndexedDB.

### 6. Multiple PDFs

Multiple PDFs can be imported onto the same board. Each adds more tiles. There is no visual grouping between different PDFs — all tiles are independent once placed.

---

## Data Model

### localStorage

A new key per board stores all slide tile metadata:

```
ideaboard_slides_${boardId}  →  JSON: SlideTile[]
```

```typescript
interface SlideTile {
  id: string           // unique tile ID (uuid)
  board_id: string
  filename: string     // original PDF filename (for the label)
  page_number: number  // 1-based
  total_pages: number  // total pages in that PDF (for label context)
  x: number            // world-space position
  y: number
  width: number        // world-units (default 260)
  aspect_ratio: number // height = width / aspect_ratio
  created_at: string
}
```

No changes to the existing `Card`, `Board`, or `GoalTag` types.

### IndexedDB

Database: `ideaboard_db`
Object store: `slide_images`
Key: `tile.id` (string)
Value: PNG data URL (string)

---

## Architecture

### Files created
- `src/hooks/useSlides.ts` — loads/saves `SlideTile[]` from localStorage; provides `addTiles`, `moveTile`, `commitTileMove`, `removeTile`
- `src/lib/pdfImport.ts` — pure async function `importPdf(file: File): Promise<{ dataUrl: string; aspectRatio: number }[]>` that uses PDF.js to render each page to a PNG data URL
- `src/lib/slideImageStore.ts` — thin IndexedDB wrapper: `saveImage(id, dataUrl)`, `getImage(id)`, `deleteImage(id)`
- `src/components/SlideTile.tsx` — renders a single slide tile; props: `tile`, `imageUrl`, `dark`, `onMoveStart`, `onDelete`

### Files modified
- `src/components/Board.tsx`
  - Import and use `useSlides`
  - Add "Import PDF" sidebar button
  - Load tile images from IndexedDB on mount
  - Render `SlideTile` components in the world div
  - Extend drag logic to handle slide tile drag (reuse `onCardMoveStart` pattern with a `dragTileId` ref)

---

## PDF.js Loading

PDF.js is loaded from CDN at import time using a dynamic `import()`:

```typescript
// src/lib/pdfImport.ts
const pdfjsLib = await import('https://cdn.jsdelivr.net/npm/pdfjs-dist@4/build/pdf.min.mjs')
pdfjsLib.GlobalWorkerOptions.workerSrc =
  'https://cdn.jsdelivr.net/npm/pdfjs-dist@4/build/pdf.worker.min.mjs'
```

This keeps the bundle small — PDF.js is only loaded when the user first clicks "Import PDF".

---

## Testing

- Unit test: `pdfImport.ts` is tested with a mock PDF.js (pure function, mockable)
- Unit test: `slideImageStore.ts` basic save/get/delete (jsdom or node with fake-indexeddb)
- Unit test: `useSlides.ts` — `addTiles`, `moveTile`, `removeTile` against localStorage
- Manual: import a 4-page PDF → 4 tiles appear in a 4-wide grid
- Manual: import two PDFs → tiles from both appear, independently draggable
- Manual: delete a tile → tile gone from canvas and image gone from IndexedDB
- Manual: reload page → tiles reappear in last dragged positions with images restored
