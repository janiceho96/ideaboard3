# PDF Import as Slide Tiles — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users upload PDF files onto the Ideaboard canvas; each page becomes a freely draggable image tile stored in IndexedDB, with tile metadata persisted to localStorage.

**Architecture:** Four new files handle isolated concerns — `slideImageStore.ts` (IndexedDB), `pdfImport.ts` (PDF.js rendering), `useSlides.ts` (localStorage hook), `SlideTile.tsx` (component) — then `Board.tsx` wires them together. Each new file has clear boundaries and is independently testable.

**Tech Stack:** React 18, TypeScript, Vite, Vitest, localStorage, IndexedDB, PDF.js v4 (CDN), fake-indexeddb (dev dependency for tests).

---

## File Map

| File | Change |
|------|--------|
| `src/types/index.ts` | Add `SlideTile` interface |
| `src/lib/slideImageStore.ts` | New — IndexedDB wrapper: `saveImage`, `getImage`, `deleteImage` |
| `src/lib/slideImageStore.test.ts` | New — unit tests using fake-indexeddb |
| `src/lib/pdfImport.ts` | New — renders PDF pages to PNG data URLs via PDF.js |
| `src/lib/pdfImport.test.ts` | New — unit tests with mocked PDF.js and canvas |
| `src/hooks/useSlides.ts` | New — loads/saves SlideTile[] from localStorage |
| `src/hooks/useSlides.test.ts` | New — unit tests for parseSlideTiles |
| `src/components/SlideTile.tsx` | New — draggable image tile component |
| `src/components/Board.tsx` | Modified — adds import button, tile rendering, tile drag |

---

## Task 1: `SlideTile` type + `slideImageStore`

**Files:**
- Modify: `src/types/index.ts`
- Create: `src/lib/slideImageStore.ts`
- Create: `src/lib/slideImageStore.test.ts`

- [ ] **Step 1: Install fake-indexeddb**

  ```bash
  cd C:\Users\User\Downloads\ideaboard-v3\ideaboard3
  npm install --save-dev fake-indexeddb
  ```

  Expected: package added to `devDependencies` in `package.json`.

- [ ] **Step 2: Add `SlideTile` interface to `src/types/index.ts`**

  Append to the bottom of `src/types/index.ts`:

  ```typescript
  export interface SlideTile {
    id: string
    board_id: string
    filename: string     // original PDF filename, shown in tile label
    page_number: number  // 1-based
    total_pages: number
    x: number            // world-space position
    y: number
    width: number        // world-units; default 260
    aspect_ratio: number // width/height ratio; tile height = width / aspect_ratio
    created_at: string
  }
  ```

- [ ] **Step 3: Write the failing tests for `slideImageStore`**

  Create `src/lib/slideImageStore.test.ts`:

  ```typescript
  import 'fake-indexeddb/auto'
  import { describe, it, expect } from 'vitest'
  import { saveImage, getImage, deleteImage } from './slideImageStore'

  describe('slideImageStore', () => {
    it('saves and retrieves an image by id', async () => {
      await saveImage('tile-1', 'data:image/png;base64,abc')
      const result = await getImage('tile-1')
      expect(result).toBe('data:image/png;base64,abc')
    })

    it('returns null for an id that has not been saved', async () => {
      const result = await getImage('nonexistent-id')
      expect(result).toBeNull()
    })

    it('deletes an image so it is no longer retrievable', async () => {
      await saveImage('tile-2', 'data:image/png;base64,xyz')
      await deleteImage('tile-2')
      const result = await getImage('tile-2')
      expect(result).toBeNull()
    })
  })
  ```

- [ ] **Step 4: Run — expect FAIL**

  ```bash
  npm test
  ```

  Expected: FAIL — `saveImage` not found.

- [ ] **Step 5: Create `src/lib/slideImageStore.ts`**

  ```typescript
  // src/lib/slideImageStore.ts
  const DB_NAME = 'ideaboard_db'
  const STORE_NAME = 'slide_images'
  const DB_VERSION = 1

  function openDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION)
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE_NAME)) {
          req.result.createObjectStore(STORE_NAME)
        }
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
  }

  export async function saveImage(id: string, dataUrl: string): Promise<void> {
    const db = await openDb()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      tx.objectStore(STORE_NAME).put(dataUrl, id)
      tx.oncomplete = () => { db.close(); resolve() }
      tx.onerror = () => { db.close(); reject(tx.error) }
    })
  }

  export async function getImage(id: string): Promise<string | null> {
    const db = await openDb()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const req = tx.objectStore(STORE_NAME).get(id)
      req.onsuccess = () => { db.close(); resolve((req.result as string | undefined) ?? null) }
      req.onerror = () => { db.close(); reject(req.error) }
    })
  }

  export async function deleteImage(id: string): Promise<void> {
    const db = await openDb()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      tx.objectStore(STORE_NAME).delete(id)
      tx.oncomplete = () => { db.close(); resolve() }
      tx.onerror = () => { db.close(); reject(tx.error) }
    })
  }
  ```

- [ ] **Step 6: Run — expect PASS**

  ```bash
  npm test
  ```

  Expected:
  ```
  ✓ src/lib/slideImageStore.test.ts (3)
  Test Files  4 passed (4)
  Tests  21 passed (21)
  ```

- [ ] **Step 7: Commit**

  ```bash
  git add src/types/index.ts src/lib/slideImageStore.ts src/lib/slideImageStore.test.ts package.json package-lock.json
  git commit -m "feat: SlideTile type and IndexedDB slideImageStore"
  ```

---

## Task 2: `pdfImport` function

**Files:**
- Create: `src/lib/pdfImport.ts`
- Create: `src/lib/pdfImport.test.ts`

- [ ] **Step 1: Write the failing tests**

  Create `src/lib/pdfImport.test.ts`:

  ```typescript
  import { describe, it, expect } from 'vitest'
  import { importPdf } from './pdfImport'
  import type { PdfjsLib, CanvasMaker } from './pdfImport'

  // Mock PDF.js: 2-page document, pages are 800×600 at scale=1 (so 1200×900 at scale=1.5)
  const mockPdfjs: PdfjsLib = {
    GlobalWorkerOptions: { workerSrc: '' },
    getDocument: (_src) => ({
      promise: Promise.resolve({
        numPages: 2,
        getPage: async (_n: number) => ({
          getViewport: ({ scale }: { scale: number }) => ({
            width: 800 * scale,
            height: 600 * scale,
          }),
          render: (_opts: unknown) => ({ promise: Promise.resolve() }),
        }),
      }),
    }),
  }

  // Mock canvas: toDataURL returns a predictable string
  const mockCanvasMaker: CanvasMaker = {
    makeCanvas: (w: number, h: number) => ({
      ctx: {} as CanvasRenderingContext2D,
      toDataURL: () => `data:image/png;base64,mock_${w}x${h}`,
    }),
  }

  function makeFile(name = 'test.pdf'): File {
    return new File([new Uint8Array([1, 2, 3])], name, { type: 'application/pdf' })
  }

  describe('importPdf', () => {
    it('returns one RenderedPage per PDF page', async () => {
      const pages = await importPdf(makeFile(), mockCanvasMaker, () => Promise.resolve(mockPdfjs))
      expect(pages).toHaveLength(2)
    })

    it('renders at 1.5x scale — width is 800 * 1.5 = 1200', async () => {
      const pages = await importPdf(makeFile(), mockCanvasMaker, () => Promise.resolve(mockPdfjs))
      expect(pages[0].dataUrl).toContain('1200x')
    })

    it('aspect_ratio is width / height', async () => {
      const pages = await importPdf(makeFile(), mockCanvasMaker, () => Promise.resolve(mockPdfjs))
      // width=1200, height=900 → ratio = 1200/900 ≈ 1.333
      expect(pages[0].aspectRatio).toBeCloseTo(1200 / 900)
    })

    it('each page has a non-empty dataUrl', async () => {
      const pages = await importPdf(makeFile(), mockCanvasMaker, () => Promise.resolve(mockPdfjs))
      for (const p of pages) {
        expect(p.dataUrl.startsWith('data:')).toBe(true)
      }
    })
  })
  ```

- [ ] **Step 2: Run — expect FAIL**

  ```bash
  npm test
  ```

  Expected: FAIL — `importPdf` not found.

- [ ] **Step 3: Create `src/lib/pdfImport.ts`**

  ```typescript
  // src/lib/pdfImport.ts

  // ── Types ────────────────────────────────────────────────────────────────────

  interface PdfjsViewport {
    width: number
    height: number
  }

  interface PdfjsPage {
    getViewport: (opts: { scale: number }) => PdfjsViewport
    render: (opts: { canvasContext: CanvasRenderingContext2D; viewport: PdfjsViewport }) => { promise: Promise<void> }
  }

  interface PdfjsDoc {
    numPages: number
    getPage: (n: number) => Promise<PdfjsPage>
  }

  export interface PdfjsLib {
    GlobalWorkerOptions: { workerSrc: string }
    getDocument: (src: { data: ArrayBuffer }) => { promise: Promise<PdfjsDoc> }
  }

  export interface CanvasMaker {
    makeCanvas: (w: number, h: number) => {
      ctx: CanvasRenderingContext2D
      toDataURL: () => string
    }
  }

  export interface RenderedPage {
    dataUrl: string
    aspectRatio: number  // width / height
  }

  // ── Defaults (browser only) ──────────────────────────────────────────────────

  const defaultCanvasMaker: CanvasMaker = {
    makeCanvas: (w: number, h: number) => {
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      return {
        ctx: canvas.getContext('2d')!,
        toDataURL: () => canvas.toDataURL('image/png'),
      }
    },
  }

  async function defaultPdfjsLoader(): Promise<PdfjsLib> {
    const lib = await import(
      /* @vite-ignore */ 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4/build/pdf.min.mjs'
    ) as unknown as PdfjsLib
    return lib
  }

  // ── Main function ────────────────────────────────────────────────────────────

  export async function importPdf(
    file: File,
    canvasMaker: CanvasMaker = defaultCanvasMaker,
    pdfjsLoader: () => Promise<PdfjsLib> = defaultPdfjsLoader,
  ): Promise<RenderedPage[]> {
    const pdfjsLib = await pdfjsLoader()
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdn.jsdelivr.net/npm/pdfjs-dist@4/build/pdf.worker.min.mjs'

    const arrayBuffer = await file.arrayBuffer()
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
    const pages: RenderedPage[] = []

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i)
      const viewport = page.getViewport({ scale: 1.5 })
      const { ctx, toDataURL } = canvasMaker.makeCanvas(viewport.width, viewport.height)
      await page.render({ canvasContext: ctx, viewport }).promise
      pages.push({
        dataUrl: toDataURL(),
        aspectRatio: viewport.width / viewport.height,
      })
    }

    return pages
  }
  ```

- [ ] **Step 4: Run — expect PASS**

  ```bash
  npm test
  ```

  Expected:
  ```
  ✓ src/lib/pdfImport.test.ts (4)
  Test Files  5 passed (5)
  Tests  25 passed (25)
  ```

- [ ] **Step 5: Commit**

  ```bash
  git add src/lib/pdfImport.ts src/lib/pdfImport.test.ts
  git commit -m "feat: pdfImport renders PDF pages to data URLs via injectable PDF.js"
  ```

---

## Task 3: `useSlides` hook

**Files:**
- Create: `src/hooks/useSlides.ts`
- Create: `src/hooks/useSlides.test.ts`

- [ ] **Step 1: Write the failing tests**

  Create `src/hooks/useSlides.test.ts`:

  ```typescript
  import { describe, it, expect } from 'vitest'
  import { parseSlideTiles } from './useSlides'

  describe('parseSlideTiles', () => {
    it('returns empty array for null input', () => {
      expect(parseSlideTiles(null)).toEqual([])
    })

    it('returns empty array for empty JSON array', () => {
      expect(parseSlideTiles('[]')).toEqual([])
    })

    it('parses a stored tile array', () => {
      const tile = {
        id: 'abc', board_id: 'b1', filename: 'deck.pdf',
        page_number: 1, total_pages: 3,
        x: 100, y: 200, width: 260, aspect_ratio: 1.333,
        created_at: '2026-04-30T00:00:00.000Z',
      }
      const result = parseSlideTiles(JSON.stringify([tile]))
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('abc')
      expect(result[0].aspect_ratio).toBe(1.333)
    })

    it('returns empty array for malformed JSON', () => {
      expect(parseSlideTiles('not-json')).toEqual([])
    })

    it('returns empty array when stored value is not an array', () => {
      expect(parseSlideTiles(JSON.stringify({ id: 'x' }))).toEqual([])
    })
  })
  ```

- [ ] **Step 2: Run — expect FAIL**

  ```bash
  npm test
  ```

  Expected: FAIL — `parseSlideTiles` not found.

- [ ] **Step 3: Create `src/hooks/useSlides.ts`**

  ```typescript
  // src/hooks/useSlides.ts
  import { useState, useCallback } from 'react'
  import type { SlideTile } from '../types'

  function storageKey(boardId: string): string {
    return `ideaboard_slides_${boardId}`
  }

  export function parseSlideTiles(raw: string | null): SlideTile[] {
    try {
      const parsed: unknown = JSON.parse(raw ?? '[]')
      return Array.isArray(parsed) ? (parsed as SlideTile[]) : []
    } catch {
      return []
    }
  }

  function saveTiles(boardId: string, tiles: SlideTile[]): void {
    localStorage.setItem(storageKey(boardId), JSON.stringify(tiles))
  }

  export interface UseSlidesReturn {
    tiles: SlideTile[]
    addTiles: (newTiles: SlideTile[]) => void
    moveTile: (id: string, x: number, y: number) => void
    commitTileMove: (id: string, x: number, y: number) => void
    removeTile: (id: string) => void
  }

  export function useSlides(boardId: string): UseSlidesReturn {
    const [tiles, setTiles] = useState<SlideTile[]>(
      () => parseSlideTiles(localStorage.getItem(storageKey(boardId)))
    )

    const addTiles = useCallback((newTiles: SlideTile[]) => {
      setTiles(prev => {
        const next = [...prev, ...newTiles]
        saveTiles(boardId, next)
        return next
      })
    }, [boardId])

    // Visual update during drag — does NOT save to localStorage
    const moveTile = useCallback((id: string, x: number, y: number) => {
      setTiles(prev => prev.map(t => t.id === id ? { ...t, x, y } : t))
    }, [])

    // Saves final position to localStorage — call on mouse-up
    const commitTileMove = useCallback((id: string, x: number, y: number) => {
      setTiles(prev => {
        const next = prev.map(t => t.id === id ? { ...t, x, y } : t)
        saveTiles(boardId, next)
        return next
      })
    }, [boardId])

    const removeTile = useCallback((id: string) => {
      setTiles(prev => {
        const next = prev.filter(t => t.id !== id)
        saveTiles(boardId, next)
        return next
      })
    }, [boardId])

    return { tiles, addTiles, moveTile, commitTileMove, removeTile }
  }
  ```

- [ ] **Step 4: Run — expect PASS**

  ```bash
  npm test
  ```

  Expected:
  ```
  ✓ src/hooks/useSlides.test.ts (5)
  Test Files  6 passed (6)
  Tests  30 passed (30)
  ```

- [ ] **Step 5: Commit**

  ```bash
  git add src/hooks/useSlides.ts src/hooks/useSlides.test.ts
  git commit -m "feat: useSlides hook with localStorage persistence"
  ```

---

## Task 4: `SlideTile` component

**Files:**
- Create: `src/components/SlideTile.tsx`

- [ ] **Step 1: Create `src/components/SlideTile.tsx`**

  ```typescript
  // src/components/SlideTile.tsx
  import { useState } from 'react'
  import type { SlideTile as SlideTileType } from '../types'

  interface SlideTileProps {
    tile: SlideTileType
    imageUrl: string | null
    dark: boolean
    onMoveStart: (id: string, clientX: number, clientY: number) => void
    onDelete: (id: string) => void
  }

  export default function SlideTile({ tile, imageUrl, dark, onMoveStart, onDelete }: SlideTileProps) {
    const [hovered, setHovered] = useState(false)
    const tileHeight = Math.round(tile.width / tile.aspect_ratio)

    return (
      <div
        className="world-item"
        style={{
          position: 'absolute',
          left: tile.x,
          top: tile.y,
          width: tile.width,
          userSelect: 'none',
          cursor: 'grab',
        }}
        onMouseDown={e => {
          if (e.button !== 0) return
          if ((e.target as HTMLElement).closest('.slide-no-drag')) return
          onMoveStart(tile.id, e.clientX, e.clientY)
          e.preventDefault()
          e.stopPropagation()
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* Slide image area */}
        <div style={{
          width: tile.width,
          height: tileHeight,
          background: dark ? '#1A1A24' : '#f0ede5',
          borderRadius: 6,
          overflow: 'hidden',
          border: `1px solid ${dark ? '#2A2A38' : '#ddd'}`,
          boxShadow: '0 2px 12px rgba(0,0,0,.18)',
          position: 'relative',
        }}>
          {imageUrl
            ? (
              <img
                src={imageUrl}
                alt={`${tile.filename} p.${tile.page_number}`}
                style={{ width: '100%', height: '100%', display: 'block', objectFit: 'fill' }}
                draggable={false}
              />
            )
            : (
              <div style={{
                width: '100%', height: '100%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: dark ? '#444' : '#bbb', fontSize: 11,
                fontFamily: "'DM Sans',sans-serif",
              }}>
                Loading…
              </div>
            )
          }

          {/* Delete button — visible when tile is hovered */}
          {hovered && (
            <button
              className="slide-no-drag"
              onClick={e => { e.stopPropagation(); onDelete(tile.id) }}
              onMouseDown={e => e.stopPropagation()}
              title="Remove slide"
              style={{
                position: 'absolute', top: 5, right: 5,
                width: 20, height: 20,
                borderRadius: '50%',
                background: 'rgba(0,0,0,.55)',
                color: 'white',
                border: 'none',
                cursor: 'pointer',
                fontSize: 14,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: "'DM Sans',sans-serif",
                lineHeight: 1,
              }}
            >×</button>
          )}
        </div>

        {/* Label */}
        <div style={{
          marginTop: 4,
          fontSize: 9,
          color: dark ? '#444' : '#aaa',
          fontFamily: "'DM Sans',sans-serif",
          textAlign: 'center',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          maxWidth: tile.width,
        }}>
          {tile.filename} — p.{tile.page_number}/{tile.total_pages}
        </div>
      </div>
    )
  }
  ```

- [ ] **Step 2: Verify TypeScript compiles**

  ```bash
  cd C:\Users\User\Downloads\ideaboard-v3\ideaboard3
  npx tsc --noEmit
  ```

  Expected: no errors.

- [ ] **Step 3: Run all tests**

  ```bash
  npm test
  ```

  Expected: 30 tests pass.

- [ ] **Step 4: Commit**

  ```bash
  git add src/components/SlideTile.tsx
  git commit -m "feat: SlideTile component with hover-delete and label"
  ```

---

## Task 5: Integrate into `Board.tsx`

**Files:**
- Modify: `src/components/Board.tsx`

This task has five parts: (A) imports + hook wiring, (B) tile drag refs + handlers, (C) image loading, (D) sidebar button, (E) render tiles.

- [ ] **Step 1: Add imports**

  After `import { snapPosition } from '../lib/snapPosition'` (the last existing import), add:

  ```typescript
  import { useSlides } from '../hooks/useSlides'
  import { importPdf } from '../lib/pdfImport'
  import { saveImage, getImage, deleteImage } from '../lib/slideImageStore'
  import SlideTile from './SlideTile'
  import type { SlideTile as SlideTileType } from '../types'
  ```

- [ ] **Step 2: Call `useSlides` and add `sldRef` sync**

  Inside the `Board` component function, after `const fw = useFramework(board.id)`, add:

  ```typescript
  const sld = useSlides(board.id)
  const sldRef = useRef(sld)
  useEffect(() => { sldRef.current = sld }, [sld])
  ```

- [ ] **Step 3: Add tile drag refs**

  After `const resizeTarget = useRef<'card' | 'framework'>('card')`, add:

  ```typescript
  const dragTileId = useRef<string | null>(null)
  ```

- [ ] **Step 4: Add `tileImages` state and `pdfInputRef`**

  After `const [colourPicker, setColourPicker] = useState<...>`, add:

  ```typescript
  const [tileImages, setTileImages] = useState<Record<string, string>>({})
  const pdfInputRef = useRef<HTMLInputElement>(null)
  ```

- [ ] **Step 5: Add `onTileMoveStart` callback**

  After the `onFrameworkResizeStart` callback, add:

  ```typescript
  const onTileMoveStart = useCallback((id: string, cx: number, cy: number) => {
    const tile = sld.tiles.find(t => t.id === id)
    if (!tile) return
    isDragging.current  = true
    dragTileId.current  = id
    dragCardId.current  = null
    dragTagId.current   = null
    snapZoom.current    = zoom
    snapPanX.current    = panX
    snapPanY.current    = panY
    const cr = canvasRef.current!.getBoundingClientRect()
    const mwx = (cx - cr.left - panX) / zoom
    const mwy = (cy - cr.top  - panY) / zoom
    dragOffWX.current = mwx - tile.x
    dragOffWY.current = mwy - tile.y
  }, [zoom, panX, panY, sld.tiles])
  ```

- [ ] **Step 6: Add `handleDeleteTile` callback**

  After `onTileMoveStart`, add:

  ```typescript
  const handleDeleteTile = useCallback(async (id: string) => {
    await deleteImage(id)
    sld.removeTile(id)
    setTileImages(prev => {
      const next = { ...prev }
      delete next[id]
      return next
    })
  }, [sld])
  ```

- [ ] **Step 7: Add `handleImportPdf` callback**

  After `handleDeleteTile`, add:

  ```typescript
  const handleImportPdf = useCallback(async (files: FileList | null) => {
    if (!files || !files.length) return
    const cr = canvasRef.current?.getBoundingClientRect()
    if (!cr) return
    const { x: cx, y: cy } = screenToWorld(cr.left + cr.width / 2, cr.top + cr.height / 2)

    const TILE_W = 260
    const GAP    = 20
    const COLS   = 4

    let yOffset = cy
    const newTiles: SlideTileType[] = []
    const imageEntries: Array<{ id: string; dataUrl: string }> = []

    for (const file of Array.from(files)) {
      try {
        const pages = await importPdf(file)
        if (!pages.length) continue

        const maxTileH = Math.max(...pages.map(p => TILE_W / p.aspectRatio))

        pages.forEach((page, i) => {
          const col = i % COLS
          const row = Math.floor(i / COLS)
          const tileH = TILE_W / page.aspectRatio
          const id = crypto.randomUUID()
          newTiles.push({
            id,
            board_id: board.id,
            filename: file.name,
            page_number: i + 1,
            total_pages: pages.length,
            x: cx + col * (TILE_W + GAP),
            y: yOffset + row * (tileH + GAP),
            width: TILE_W,
            aspect_ratio: page.aspectRatio,
            created_at: new Date().toISOString(),
          })
          imageEntries.push({ id, dataUrl: page.dataUrl })
        })

        const rows = Math.ceil(pages.length / COLS)
        yOffset += rows * (maxTileH + GAP) + 40
      } catch {
        showToast(`Failed to import ${file.name}`)
      }
    }

    if (!newTiles.length) return

    await Promise.all(imageEntries.map(({ id, dataUrl }) => saveImage(id, dataUrl)))
    sld.addTiles(newTiles)
    showToast(`Imported ${newTiles.length} slide${newTiles.length !== 1 ? 's' : ''} ✓`)
  }, [board.id, screenToWorld, sld])
  ```

- [ ] **Step 8: Update `onMove` inside the mouse `useEffect` to handle tile dragging**

  Inside the `useEffect`, find the `isDragging` block. It ends with:

  ```typescript
        if (dragTagId.current) brd.moveGoalTag(dragTagId.current, wx, wy)
        return
  ```

  Add a line for tile dragging right before `return`:

  ```typescript
        if (dragTagId.current) brd.moveGoalTag(dragTagId.current, wx, wy)
        if (dragTileId.current) sldRef.current.moveTile(dragTileId.current, wx, wy)
        return
  ```

- [ ] **Step 9: Update `onUp` inside the mouse `useEffect` to handle tile dragging**

  Find the `isDragging` block in `onUp`. It currently ends with:

  ```typescript
        if (dragTagId.current) brd.commitGoalTagMove(dragTagId.current, wx, wy)
        isDragging.current = false; dragCardId.current = null; dragTagId.current = null
        setSnapGhost(null)
        return
  ```

  Replace those last three lines with:

  ```typescript
        if (dragTagId.current) brd.commitGoalTagMove(dragTagId.current, wx, wy)
        if (dragTileId.current) sldRef.current.commitTileMove(dragTileId.current, wx, wy)
        isDragging.current = false
        dragCardId.current = null
        dragTagId.current = null
        dragTileId.current = null
        setSnapGhost(null)
        return
  ```

- [ ] **Step 10: Add tile image loading effect**

  After the `fwRef` sync effect (`useEffect(() => { fwRef.current = fw }, [fw])`), add:

  ```typescript
  // Load tile images from IndexedDB when tiles are added or removed
  const tileIdKey = sld.tiles.map(t => t.id).join(',')
  useEffect(() => {
    if (!sld.tiles.length) return
    let cancelled = false
    async function loadMissing() {
      for (const tile of sld.tiles) {
        if (cancelled) return
        setTileImages(prev => {
          if (prev[tile.id]) return prev  // already loaded
          // Fire async load for this tile
          getImage(tile.id).then(img => {
            if (img && !cancelled) setTileImages(p => p[tile.id] ? p : { ...p, [tile.id]: img })
          })
          return prev
        })
      }
    }
    loadMissing()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tileIdKey])
  ```

- [ ] **Step 11: Add Import PDF sidebar button + hidden file input**

  In the sidebar JSX, after the PDF export `SbBtn` and before the undo `SbBtn`, add:

  ```tsx
          <SbBtn title="Import PDF" onClick={() => pdfInputRef.current?.click()} dark={dark}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          </SbBtn>
          <input
            ref={pdfInputRef}
            type="file"
            accept=".pdf"
            multiple
            style={{ display: 'none' }}
            onChange={e => { handleImportPdf(e.target.files); e.target.value = '' }}
          />
  ```

- [ ] **Step 12: Render `SlideTile` components in the world div**

  In the world div JSX, after the `{/* Framework overlay */}` block and before the `{/* Cards */}` block, add:

  ```tsx
            {/* Slide tiles */}
            {sld.tiles.map(tile => (
              <SlideTile
                key={tile.id}
                tile={tile}
                imageUrl={tileImages[tile.id] ?? null}
                dark={dark}
                onMoveStart={onTileMoveStart}
                onDelete={handleDeleteTile}
              />
            ))}
  ```

- [ ] **Step 13: Verify TypeScript compiles**

  ```bash
  npx tsc --noEmit
  ```

  Expected: no errors.

- [ ] **Step 14: Run all tests**

  ```bash
  npm test
  ```

  Expected:
  ```
  Test Files  6 passed (6)
  Tests  30 passed (30)
  ```

- [ ] **Step 15: Test manually in browser — open http://localhost:5180**

  Confirm:
  - Sidebar has an upload icon button (below PDF export)
  - Clicking it opens a file picker filtered to PDF files
  - Importing a PDF shows tiles in a grid near the canvas centre
  - Each tile shows the slide image with filename and page number below
  - Hovering a tile shows a × button; clicking it removes the tile
  - Tiles are draggable independently, same as cards
  - Importing a second PDF places its tiles below the first batch
  - Reloading the page: tiles reappear in their last positions with images restored
  - Cards and framework overlay still work normally

- [ ] **Step 16: Commit**

  ```bash
  git add src/components/Board.tsx
  git commit -m "feat: Board integrates PDF import — slide tiles draggable on canvas"
  ```

---

## Final Verification

- [ ] Import a 6-page PDF → 4 tiles in row 1, 2 in row 2
- [ ] Import a second PDF at the same time → tiles from both visible, independently draggable
- [ ] Delete a tile → gone from canvas; re-import the PDF to check it doesn't re-appear
- [ ] Drag a tile far across the canvas; reload → tile in new position with image restored
- [ ] `npm test` — 30 tests pass
- [ ] `npx tsc --noEmit` — zero errors
