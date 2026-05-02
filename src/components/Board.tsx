// src/components/Board.tsx
import { useState, useRef, useEffect, useCallback, Fragment } from 'react'
import type { LocalUser, Board as BoardType, Card, TagType } from '../types'
import { useBoard } from '../hooks/useBoard'
import IdeaCard from './IdeaCard'
import CardModal from './CardModal'
import { snapPosition } from '../lib/snapPosition'
import { useFramework } from '../hooks/useFramework'
import type { FrameworkType } from '../hooks/useFramework'
import FrameworkOverlay from './FrameworkOverlay'
import { useSlides } from '../hooks/useSlides'
import { importPdf } from '../lib/pdfImport'
import { saveImage, getImage, deleteImage } from '../lib/slideImageStore'
import SlideTile from './SlideTile'
import type { SlideTile as SlideTileType } from '../types'

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

interface BoardProps {
  user: LocalUser
  board: BoardType
  onBack: () => void
  dark: boolean
  onToggleDark: () => void
}

const MIN_ZOOM = 0.15
const MAX_ZOOM = 3
const CARD_MIN_W = 140
const CARD_MIN_H = 100
const FRAMEWORK_MIN_W = 400
const FRAMEWORK_MIN_H = 200

export default function Board({ user, board, onBack, dark, onToggleDark }: BoardProps) {
  const brd = useBoard(board.id)
  const fw = useFramework(board.id)
  const sld = useSlides(board.id)
  const sldRef = useRef(sld)
  useEffect(() => { sldRef.current = sld }, [sld])

  // Camera
  const [panX, setPanX] = useState(0)
  const [panY, setPanY] = useState(0)
  const [zoom, setZoom] = useState(1)

  const canvasRef    = useRef<HTMLDivElement>(null)
  const worldRef     = useRef<HTMLDivElement>(null)
  const zoomRef      = useRef(zoom)
  useEffect(() => { zoomRef.current = zoom }, [zoom])

  // Pan
  const isPanning    = useRef(false)
  const panStart     = useRef({ x: 0, y: 0, px: 0, py: 0 })
  const isCtrlPanning  = useRef(false)
  const ctrlPanStart   = useRef({ x: 0, y: 0, px: 0, py: 0 })
  const [ctrlHeld, setCtrlHeld] = useState(false)
  const [ctrlPanActive, setCtrlPanActive] = useState(false)

  // Card drag
  const isDragging   = useRef(false)
  const dragCardId   = useRef<string | null>(null)
  const dragTagId    = useRef<string | null>(null)
  const dragOffWX    = useRef(0)
  const dragOffWY    = useRef(0)
  const snapZoom     = useRef(1)
  const snapPanX     = useRef(0)
  const snapPanY     = useRef(0)

  // Resize
  const isResizing   = useRef(false)
  const resizeCardId = useRef<string | null>(null)
  const resizeStartX = useRef(0)
  const resizeStartY = useRef(0)
  const resizeStartW = useRef(185)
  const resizeStartH = useRef<number | null>(null)
  const resizeTarget = useRef<'card' | 'framework'>('card')
  const dragTileId = useRef<string | null>(null)
  const fwRef = useRef(fw)
  useEffect(() => { fwRef.current = fw }, [fw])

  // Selection
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null)

  // Modal
  const [modalOpen, setModalOpen]     = useState(false)
  const [editingCard, setEditingCard] = useState<Card | null>(null)
  const newCardWorld = useRef({ x: 300, y: 300 })

  // Export
  const [exporting, setExporting] = useState(false)

  // Snap ghost
  const [snapGhost, setSnapGhost] = useState<{ x: number; y: number } | null>(null)

  // Colour picker
  const [colourPicker, setColourPicker] = useState<{ cardId: string; x: number; y: number } | null>(null)
  const [frameworkDropdownOpen, setFrameworkDropdownOpen] = useState(false)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [tileImages, setTileImages] = useState<Record<string, string>>({})
  const pdfInputRef = useRef<HTMLInputElement>(null)
  const jsonInputRef = useRef<HTMLInputElement>(null)

  // Load tile images from IndexedDB when tiles are added or removed
  const tileIdKey = sld.tiles.map(t => t.id).join(',')
  useEffect(() => {
    if (!sld.tiles.length) return
    let cancelled = false
    for (const tile of sld.tiles) {
      if (tileImages[tile.id]) continue   // already in state — skip
      getImage(tile.id).then(img => {
        if (img && !cancelled)
          setTileImages(p => p[tile.id] ? p : { ...p, [tile.id]: img })
      })
    }
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tileIdKey])

  // Toast
  const [toast, setToast]   = useState<string | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout>>()
  const showToast = (msg: string) => {
    setToast(msg); clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 3000)
  }

  // ── Coord helpers ───────────────────────────────────────────
  const screenToWorld = useCallback((sx: number, sy: number) => {
    const cr = canvasRef.current!.getBoundingClientRect()
    return { x: (sx - cr.left - panX) / zoom, y: (sy - cr.top - panY) / zoom }
  }, [panX, panY, zoom])

  // ── Mouse handlers ──────────────────────────────────────────
  const onCanvasMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return
    if ((e.target as HTMLElement).closest('.world-item')) return
    setSelectedCardId(null)
    if (e.ctrlKey) {
      isCtrlPanning.current = true
      setCtrlPanActive(true)
      ctrlPanStart.current = { x: e.clientX, y: e.clientY, px: panX, py: panY }
      e.preventDefault()
      return
    }
    isPanning.current = true
    panStart.current = { x: e.clientX, y: e.clientY, px: panX, py: panY }
    e.preventDefault()
  }

  const onCardMoveStart = useCallback((id: string, cx: number, cy: number) => {
    setSelectedCardId(id)
    isDragging.current  = true
    dragCardId.current  = id
    dragTagId.current   = null
    snapZoom.current    = zoom
    snapPanX.current    = panX
    snapPanY.current    = panY
    const card = brd.cards.find(c => c.id === id)
    if (!card) return
    const cr = canvasRef.current!.getBoundingClientRect()
    const mwx = (cx - cr.left - panX) / zoom
    const mwy = (cy - cr.top  - panY) / zoom
    dragOffWX.current = mwx - card.x
    dragOffWY.current = mwy - card.y
  }, [zoom, panX, panY, brd.cards])

  const onTagMoveStart = useCallback((id: string, cx: number, cy: number, tx: number, ty: number) => {
    isDragging.current = true
    dragTagId.current  = id
    dragCardId.current = null
    snapZoom.current   = zoom
    snapPanX.current   = panX
    snapPanY.current   = panY
    const cr = canvasRef.current!.getBoundingClientRect()
    const mwx = (cx - cr.left - panX) / zoom
    const mwy = (cy - cr.top  - panY) / zoom
    dragOffWX.current = mwx - tx
    dragOffWY.current = mwy - ty
  }, [zoom, panX, panY])

  const onResizeStart = useCallback((id: string, cx: number, cy: number, startW: number, startH: number | null) => {
    resizeTarget.current  = 'card'
    isResizing.current    = true
    resizeCardId.current  = id
    resizeStartX.current  = cx
    resizeStartY.current  = cy
    resizeStartW.current  = startW
    resizeStartH.current  = startH
  }, [])

  const onFrameworkResizeStart = useCallback((e: React.MouseEvent) => {
    isResizing.current   = true
    resizeTarget.current = 'framework'
    resizeStartX.current = e.clientX
    resizeStartY.current = e.clientY
    resizeStartW.current = fwRef.current.framework.width
    resizeStartH.current = fwRef.current.framework.height
  }, [])

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

  const handleDeleteTile = useCallback(async (id: string) => {
    try {
      await deleteImage(id)
    } catch {
      // Best effort — still remove tile from board
    }
    sldRef.current.removeTile(id)
    setTileImages(prev => {
      const next = { ...prev }
      delete next[id]
      return next
    })
  }, [])

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

    try {
      await Promise.all(imageEntries.map(({ id, dataUrl }) => saveImage(id, dataUrl)))
    } catch {
      // Rollback any images that were saved before the failure
      await Promise.allSettled(imageEntries.map(({ id }) => deleteImage(id)))
      showToast('Import failed — storage may be full')
      return
    }
    sldRef.current.addTiles(newTiles)
    showToast(`Imported ${newTiles.length} slide${newTiles.length !== 1 ? 's' : ''} ✓`)
  }, [board.id, screenToWorld])

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (isCtrlPanning.current) {
        setPanX(ctrlPanStart.current.px + (e.clientX - ctrlPanStart.current.x))
        setPanY(ctrlPanStart.current.py + (e.clientY - ctrlPanStart.current.y))
        return
      }
      if (isPanning.current) {
        setPanX(panStart.current.px + (e.clientX - panStart.current.x))
        setPanY(panStart.current.py + (e.clientY - panStart.current.y))
        return
      }
      if (isDragging.current && canvasRef.current) {
        const cr = canvasRef.current.getBoundingClientRect()
        const wx = (e.clientX - cr.left - snapPanX.current) / snapZoom.current - dragOffWX.current
        const wy = (e.clientY - cr.top  - snapPanY.current) / snapZoom.current - dragOffWY.current
        if (dragCardId.current) {
          brd.moveCard(dragCardId.current, wx, wy)
          const draggingCard = brd.cards.find(c => c.id === dragCardId.current)
          if (draggingCard) setSnapGhost(snapPosition(wx, wy, draggingCard, brd.cards))
        }
        if (dragTagId.current) brd.moveGoalTag(dragTagId.current, wx, wy)
        if (dragTileId.current) sldRef.current.moveTile(dragTileId.current, wx, wy)
        return
      }
      if (isResizing.current) {
        const dx = (e.clientX - resizeStartX.current) / zoom
        const dy = (e.clientY - resizeStartY.current) / zoom
        if (resizeTarget.current === 'framework') {
          fwRef.current.setSize(
            Math.max(FRAMEWORK_MIN_W, resizeStartW.current + dx),
            Math.max(FRAMEWORK_MIN_H, (resizeStartH.current ?? 540) + dy),
          )
        } else if (resizeCardId.current) {
          const newW = Math.max(CARD_MIN_W, resizeStartW.current + dx)
          const newH = resizeStartH.current !== null
            ? Math.max(CARD_MIN_H, resizeStartH.current + dy)
            : Math.max(CARD_MIN_H, 160 + dy)
          brd.resizeCard(resizeCardId.current, newW, newH)
        }
      }
    }

    const onUp = (e: MouseEvent) => {
      if (isCtrlPanning.current) { isCtrlPanning.current = false; setCtrlPanActive(false); return }
      if (isPanning.current) { isPanning.current = false; return }
      if (isDragging.current && canvasRef.current) {
        const cr = canvasRef.current.getBoundingClientRect()
        const wx = (e.clientX - cr.left - snapPanX.current) / snapZoom.current - dragOffWX.current
        const wy = (e.clientY - cr.top  - snapPanY.current) / snapZoom.current - dragOffWY.current
        if (dragCardId.current) {
          const draggingCard = brd.cards.find(c => c.id === dragCardId.current)
          const finalPos = draggingCard
            ? snapPosition(wx, wy, draggingCard, brd.cards)
            : { x: wx, y: wy }
          brd.moveCard(dragCardId.current, finalPos.x, finalPos.y)
          brd.commitCardMove(dragCardId.current, finalPos.x, finalPos.y)
        }
        if (dragTagId.current) brd.commitGoalTagMove(dragTagId.current, wx, wy)
        if (dragTileId.current) sldRef.current.commitTileMove(dragTileId.current, wx, wy)
        isDragging.current = false
        dragCardId.current = null
        dragTagId.current = null
        dragTileId.current = null
        setSnapGhost(null)
        return
      }
      if (isResizing.current) {
        const dx = (e.clientX - resizeStartX.current) / zoom
        const dy = (e.clientY - resizeStartY.current) / zoom
        if (resizeTarget.current === 'framework') {
          fwRef.current.commitSize(
            Math.max(FRAMEWORK_MIN_W, resizeStartW.current + dx),
            Math.max(FRAMEWORK_MIN_H, (resizeStartH.current ?? 540) + dy),
          )
        } else if (resizeCardId.current) {
          const newW = Math.max(CARD_MIN_W, resizeStartW.current + dx)
          const newH = resizeStartH.current !== null
            ? Math.max(CARD_MIN_H, resizeStartH.current + dy)
            : Math.max(CARD_MIN_H, 160 + dy)
          brd.commitCardResize(resizeCardId.current, newW, newH)
        }
        isResizing.current = false
        resizeCardId.current = null
        resizeTarget.current = 'card'
      }
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [brd, zoom])

  // ── Scroll to zoom ──────────────────────────────────────────
  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const cr = canvasRef.current!.getBoundingClientRect()
    const mx = e.clientX - cr.left
    const my = e.clientY - cr.top
    const delta = e.deltaY > 0 ? 0.9 : 1.1
    const nz = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom * delta))
    setPanX(px => mx - (mx - px) * (nz / zoom))
    setPanY(py => my - (my - py) * (nz / zoom))
    setZoom(nz)
  }, [zoom])

  // ── Keyboard shortcuts ──────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target.closest('input,textarea,[contenteditable]')) return
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') { brd.undo(); showToast('Undone ↩'); return }

      // Arrow key pan
      if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)) {
        if (e.ctrlKey || e.metaKey) return
        e.preventDefault()
        const step = e.shiftKey ? 100 : 20
        if (e.key === 'ArrowLeft')  setPanX(px => px + step)
        if (e.key === 'ArrowRight') setPanX(px => px - step)
        if (e.key === 'ArrowUp')    setPanY(py => py + step)
        if (e.key === 'ArrowDown')  setPanY(py => py - step)
        return
      }

      // Zoom shortcuts
      if ((e.key === '+' || e.key === '=') && !e.ctrlKey && !e.metaKey) {
        e.preventDefault()
        const cr = canvasRef.current?.getBoundingClientRect()
        if (!cr) return
        const cx = cr.width / 2, cy = cr.height / 2
        const nz = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoomRef.current * 1.2))
        setPanX(px => cx - (cx - px) * (nz / zoomRef.current))
        setPanY(py => cy - (cy - py) * (nz / zoomRef.current))
        setZoom(nz)
        return
      }
      if (e.key === '-' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault()
        const cr = canvasRef.current?.getBoundingClientRect()
        if (!cr) return
        const cx = cr.width / 2, cy = cr.height / 2
        const nz = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoomRef.current * 0.8))
        setPanX(px => cx - (cx - px) * (nz / zoomRef.current))
        setPanY(py => cy - (cy - py) * (nz / zoomRef.current))
        setZoom(nz)
        return
      }
      if (e.key === '0' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault()
        setPanX(0); setPanY(0); setZoom(1)
        return
      }

      if (e.key === 'Escape') {
        setColourPicker(null)
        setFrameworkDropdownOpen(false)
        setSelectedCardId(null)
        setModalOpen(false)
        setShowShortcuts(false)
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && !e.ctrlKey && !e.metaKey) {
        if (selectedCardId) {
          const card = brd.cards.find(c => c.id === selectedCardId)
          if (!card || card.locked) return
          e.preventDefault()
          brd.removeCard(selectedCardId).then(() => showToast('Card deleted'))
          setSelectedCardId(null)
        }
      }
      if (e.key === 'n' && !e.ctrlKey && !e.metaKey) {
        const cr = canvasRef.current?.getBoundingClientRect()
        if (cr) { newCardWorld.current = screenToWorld(cr.left + cr.width / 2, cr.top + cr.height / 2); setEditingCard(null); setModalOpen(true) }
      }
      if (e.key === '?') { e.preventDefault(); setShowShortcuts(s => !s) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [brd, screenToWorld, selectedCardId])

  // ── Ctrl key for cursor ──────────────────────────────────────
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Control') setCtrlHeld(true) }
    const onKeyUp   = (e: KeyboardEvent) => { if (e.key === 'Control') { setCtrlHeld(false); isCtrlPanning.current = false; setCtrlPanActive(false) } }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup',   onKeyUp)
    return () => { window.removeEventListener('keydown', onKeyDown); window.removeEventListener('keyup', onKeyUp) }
  }, [])

  // ── Double-click canvas ─────────────────────────────────────
  const onCanvasDblClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.world-item')) return
    newCardWorld.current = screenToWorld(e.clientX, e.clientY)
    setEditingCard(null); setModalOpen(true)
  }

  // ── View helpers ────────────────────────────────────────────
  const fitAll = () => {
    if (!brd.cards.length || !canvasRef.current) return
    const cr = canvasRef.current.getBoundingClientRect()
    const xs = brd.cards.map(c => c.x), ys = brd.cards.map(c => c.y)
    const minX = Math.min(...xs) - 80, minY = Math.min(...ys) - 80
    const maxX = Math.max(...xs) + 280, maxY = Math.max(...ys) + 220
    const nz = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.min(cr.width / (maxX - minX), cr.height / (maxY - minY)) * 0.85))
    setZoom(nz)
    setPanX(cr.width  / 2 - (minX + (maxX - minX) / 2) * nz)
    setPanY(cr.height / 2 - (minY + (maxY - minY) / 2) * nz)
  }

  // ── PDF Export ──────────────────────────────────────────────
  const exportPDF = async () => {
    if (!canvasRef.current) return
    setExporting(true)
    showToast('Generating PDF…')
    try {
      // Dynamically import so bundle stays small
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
      ])
      const canvas = await html2canvas(canvasRef.current, {
        scale: 1.5,
        backgroundColor: dark ? '#0F0F14' : '#faf8f0',
        useCORS: true,
        logging: false,
      })
      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'px', format: [canvas.width, canvas.height] })
      pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height)
      pdf.save(`${board.name}.pdf`)
      showToast('PDF downloaded ✓')
    } catch (err) {
      console.error('Export failed:', err)
      showToast('Export failed — try again')
    } finally {
      setExporting(false)
    }
  }

  // ── JSON card export ────────────────────────────────────────
  const exportCards = () => {
    const slug = board.name.replace(/[^a-z0-9]/gi, '-').toLowerCase()
    const date = new Date().toISOString().slice(0, 10)
    const data = {
      exportedAt: new Date().toISOString(),
      boardName: board.name,
      cards: brd.cards,
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${slug}-${date}.json`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 100)
    showToast('Cards exported ✓')
  }

  // ── JSON card import ────────────────────────────────────────
  const importCards = async (files: FileList | null) => {
    if (!files || !files.length) return
    const file = files[0]
    try {
      const text = await file.text()
      const data = JSON.parse(text)
      if (!Array.isArray(data.cards)) throw new Error('missing cards array')
      const inserts: import('../types').CardInsert[] = data.cards.map((c: import('../types').Card) => ({
        board_id: board.id,
        title: c.title ?? '',
        body: c.body ?? '',
        date_label: c.date_label ?? '',
        due_date: c.due_date ?? null,
        tag: c.tag ?? 'idea',
        bg: c.bg ?? 'white',
        x: typeof c.x === 'number' ? c.x : 100,
        y: typeof c.y === 'number' ? c.y : 100,
        rotation: typeof c.rotation === 'number' ? c.rotation : 0,
        card_width: typeof c.card_width === 'number' ? c.card_width : 185,
        card_height: typeof c.card_height === 'number' ? c.card_height : null,
        collapsed: c.collapsed ?? false,
        locked: c.locked ?? false,
      }))
      await brd.bulkImportCards(inserts)
      showToast(`Imported ${inserts.length} card${inserts.length !== 1 ? 's' : ''} ✓`)
    } catch (err) {
      const msg = err instanceof Error && err.message === 'missing cards array'
        ? "Could not read file — make sure it's a valid Ideaboard export"
        : 'Import failed — storage may be full'
      showToast(msg)
    }
  }

  // ── Colour picker ───────────────────────────────────────────
  const handleColorPick = useCallback((cardId: string, clientX: number, clientY: number) => {
    setColourPicker({ cardId, x: clientX, y: clientY })
  }, [])

  // ── Modal ───────────────────────────────────────────────────
  const openEdit = (id: string) => { setEditingCard(brd.cards.find(c => c.id === id) ?? null); setModalOpen(true) }

  const handleSave = async (data: { title: string; body: string; dateLabel: string; dueDate: string | null; tag: TagType; bg: string }) => {
    try {
      if (editingCard) {
        await brd.updateCard(editingCard.id, { title: data.title, body: data.body, date_label: data.dateLabel, due_date: data.dueDate, tag: data.tag, bg: data.bg })
        showToast('Card updated ✓')
      } else {
        await brd.addCard(data.title, data.body, data.dateLabel, data.dueDate, data.tag, data.bg, newCardWorld.current.x, newCardWorld.current.y)
        showToast('Card added ✓')
      }
    } catch (err) {
      showToast('Error: ' + (err instanceof Error ? err.message : 'Failed to save card'))
    }
  }

  const handleDelete = async () => {
    if (!editingCard) return
    if (editingCard?.id === selectedCardId) setSelectedCardId(null)
    await brd.removeCard(editingCard.id)
    setModalOpen(false); showToast('Card deleted')
  }

  // ── Theme colours ───────────────────────────────────────────
  const sbBg   = dark ? '#0D0D12' : '#141418'
  const topBg  = dark ? 'rgba(13,13,18,.94)' : 'rgba(248,246,240,.94)'
  const topBdr = dark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.08)'
  const txtC   = dark ? '#F0EEE8' : '#1A1A2E'
  const subC   = dark ? '#666'    : '#999'
  const cvBg   = dark ? '#0F0F14' : '#faf8f0'
  const dotClr = dark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.12)'

  if (brd.loading) return <Centered dark={dark}>Loading board…</Centered>
  if (brd.error)   return <Centered dark={dark} error>{brd.error}</Centered>

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', fontFamily: "'DM Sans',sans-serif" }}>

      {/* ── SIDEBAR ── */}
      <aside style={{ width: 68, background: sbBg, borderRight: `1px solid ${dark ? '#1A1A22' : '#2A2A32'}`, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '14px 0', gap: 2, flexShrink: 0, zIndex: 100 }}>
        <div style={{ width: 38, height: 38, background: 'linear-gradient(135deg,#6C63FF,#E040FB)', borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 17, color: 'white', marginBottom: 14 }}>I</div>

        <SbBtn title="Back to boards" onClick={onBack} dark={dark}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </SbBtn>

        <div style={{ width: 28, height: 1, background: dark ? '#1A1A22' : '#2A2A32', margin: '4px 0' }}/>

        <SbBtn title="New Card (N)" onClick={() => { const cr = canvasRef.current?.getBoundingClientRect(); if (cr) { newCardWorld.current = screenToWorld(cr.left + cr.width/2, cr.top + cr.height/2); setEditingCard(null); setModalOpen(true) } }} dark={dark}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
        </SbBtn>

        <SbBtn title="Fit all cards in view" onClick={fitAll} dark={dark}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3"/></svg>
        </SbBtn>

        <SbBtn title="Reset to 100%" onClick={() => { setPanX(0); setPanY(0); setZoom(1) }} dark={dark}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
        </SbBtn>

        <div style={{ width: 28, height: 1, background: dark ? '#1A1A22' : '#2A2A32', margin: '4px 0' }}/>

        <SbBtn title="Export as PDF" onClick={exportPDF} dark={dark}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
        </SbBtn>

        <SbBtn title="Export cards as JSON backup" onClick={exportCards} dark={dark}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
            <line x1="12" y1="18" x2="12" y2="12"/><polyline points="9 15 12 18 15 15"/>
          </svg>
        </SbBtn>

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

        <SbBtn title="Import cards from JSON backup" onClick={() => jsonInputRef.current?.click()} dark={dark}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
            <line x1="12" y1="12" x2="12" y2="18"/><polyline points="15 15 12 12 9 15"/>
          </svg>
        </SbBtn>
        <input
          ref={jsonInputRef}
          type="file"
          accept=".json"
          style={{ display: 'none' }}
          onChange={e => { importCards(e.target.files); e.target.value = '' }}
        />

        <SbBtn title="Undo (Ctrl+Z)" onClick={() => { brd.undo(); showToast('Undone ↩') }} dark={dark}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 102.13-9.36L1 10"/></svg>
        </SbBtn>

        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 28, height: 1, background: dark ? '#1A1A22' : '#2A2A32', marginBottom: 4 }}/>
          <SbBtn title="Toggle dark mode" onClick={onToggleDark} dark={dark}>
            <span style={{ fontSize: 14 }}>{dark ? '☀️' : '🌙'}</span>
          </SbBtn>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#6C63FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, color: 'white', border: `2px solid ${dark ? '#1A1A22' : '#2A2A32'}` }}>
            {user.email?.[0]?.toUpperCase() ?? 'U'}
          </div>
        </div>
      </aside>

      {/* ── MAIN ── */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>

        {/* Topbar */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 50, background: topBg, backdropFilter: 'blur(12px)', borderBottom: `1px solid ${topBdr}`, display: 'flex', alignItems: 'center', padding: '0 18px', gap: 10, zIndex: 50 }}>
          <span style={{ fontSize: 12, color: subC }}>Boards /</span>
          <span style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 14, color: txtC }}>{board.name}</span>

          {/* Framework picker dropdown */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setFrameworkDropdownOpen(o => !o)}
              style={{ height: 28, padding: '0 10px', borderRadius: 7, border: `1px solid ${dark ? '#2A2A38' : '#ddd'}`, background: dark ? '#1A1A24' : 'white', color: dark ? '#aaa' : '#555', cursor: 'pointer', fontSize: 11, fontFamily: "'DM Sans',sans-serif", display: 'flex', alignItems: 'center', gap: 5 }}
            >
              {fw.framework.type === 'blank'      && 'Blank Board'}
              {fw.framework.type === 'eisenhower' && 'Eisenhower Matrix'}
              {fw.framework.type === 'ooda'       && 'OODA Loop'}
              <span style={{ fontSize: 9 }}>▾</span>
            </button>

            {frameworkDropdownOpen && (
              <>
                {/* Click-outside overlay */}
                <div
                  style={{ position: 'fixed', inset: 0, zIndex: 998 }}
                  onClick={() => setFrameworkDropdownOpen(false)}
                />
                {/* Dropdown panel */}
                <div style={{ position: 'absolute', top: 34, left: 0, zIndex: 999, background: dark ? '#1A1A24' : 'white', border: `1px solid ${dark ? '#2A2A38' : '#ddd'}`, borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,.18)', overflow: 'hidden', minWidth: 190 }}>
                  {([
                    { key: 'blank',      label: 'Blank Board',        desc: 'Clean canvas, no overlay' },
                    { key: 'eisenhower', label: 'Eisenhower Matrix',  desc: 'Urgent / Important grid' },
                    { key: 'ooda',       label: 'OODA Loop',          desc: 'Observe → Orient → Decide → Act' },
                  ] as { key: FrameworkType; label: string; desc: string }[]).map(opt => (
                    <button
                      key={opt.key}
                      onClick={() => { fw.setType(opt.key); setFrameworkDropdownOpen(false) }}
                      style={{ display: 'block', width: '100%', padding: '10px 14px', border: 'none', background: fw.framework.type === opt.key ? (dark ? 'rgba(108,99,255,.15)' : 'rgba(108,99,255,.08)') : 'transparent', cursor: 'pointer', textAlign: 'left', fontFamily: "'DM Sans',sans-serif" }}
                    >
                      <div style={{ fontSize: 12, fontWeight: 600, color: fw.framework.type === opt.key ? '#6C63FF' : (dark ? '#ddd' : '#1A1A2E') }}>{opt.label}</div>
                      <div style={{ fontSize: 10, color: dark ? '#666' : '#999', marginTop: 1 }}>{opt.desc}</div>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <div style={{ flex: 1 }}/>
          <span style={{ fontSize: 11, color: subC, background: dark ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.05)', padding: '3px 8px', borderRadius: 6 }}>
            Double-click to add · Scroll to zoom · Drag to pan · N = new card
          </span>
          <button onClick={() => { const cr = canvasRef.current?.getBoundingClientRect(); if (cr) { newCardWorld.current = screenToWorld(cr.left + cr.width/2, cr.top + cr.height/2); setEditingCard(null); setModalOpen(true) } }}
            style={{ height: 30, padding: '0 14px', borderRadius: 7, border: 'none', background: '#6C63FF', color: 'white', cursor: 'pointer', fontSize: 12, fontFamily: "'DM Sans',sans-serif" }}>
            + Add Card
          </button>
        </div>

        {/* ── CANVAS ── */}
        <div
          ref={canvasRef}
          onMouseDown={onCanvasMouseDown}
          onDoubleClick={onCanvasDblClick}
          onWheel={onWheel}
          style={{
            position: 'absolute', inset: '50px 0 0 0',
            overflow: 'hidden',
            backgroundColor: cvBg,
            backgroundImage: `radial-gradient(circle, ${dotClr} 1px, transparent 1px)`,
            backgroundSize: `${24 * zoom}px ${24 * zoom}px`,
            backgroundPosition: `${panX % (24 * zoom)}px ${panY % (24 * zoom)}px`,
            cursor: ctrlPanActive ? 'grabbing' : ctrlHeld ? 'grab' : 'crosshair',
          }}
        >
          {/* THE WORLD */}
          <div ref={worldRef}
            style={{ position: 'absolute', left: 0, top: 0, transformOrigin: '0 0', transform: `translate(${panX}px,${panY}px) scale(${zoom})` }}>

            {/* Framework overlay */}
            <FrameworkOverlay
              type={fw.framework.type}
              width={fw.framework.width}
              height={fw.framework.height}
              dark={dark}
              onResizeStart={onFrameworkResizeStart}
            />

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

            {/* Cards */}
            {brd.cards.map(card => (
              <div key={card.id} className="world-item">
                <IdeaCard
                  card={card} dark={dark}
                  onMoveStart={onCardMoveStart}
                  onResizeStart={onResizeStart}
                  onEdit={openEdit}
                  onDelete={async id => {
                    if (id === selectedCardId) setSelectedCardId(null)
                    await brd.removeCard(id)
                    showToast('Card deleted')
                  }}
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
              </div>
            ))}

            {/* Goal tags */}
            {brd.goalTags.map(tag => (
              <div key={tag.id} className="world-item"
                onMouseDown={e => {
                  if ((e.target as HTMLElement).closest('.no-drag')) return
                  onTagMoveStart(tag.id, e.clientX, e.clientY, tag.x, tag.y)
                  e.preventDefault(); e.stopPropagation()
                }}
                style={{ position:'absolute', left:tag.x, top:tag.y, borderRadius:20, border:'2px solid #1A1A2E', padding:'7px 14px', fontFamily:"'Syne',sans-serif", fontSize:12, fontWeight:700, cursor:'grab', boxShadow:'3px 3px 0 #1A1A2E', zIndex:20, display:'flex', alignItems:'center', gap:6, whiteSpace:'nowrap', background:tag.bg, color:tag.color, userSelect:'none' }}
              >
                {tag.label}
                <button className="no-drag"
                  onClick={e => { e.stopPropagation(); brd.removeGoalTag(tag.id).then(() => showToast('Tag deleted')) }}
                  onMouseDown={e => e.stopPropagation()}
                  style={{ width:16,height:16,borderRadius:'50%',background:'rgba(0,0,0,.12)',border:'none',cursor:'pointer',fontSize:11,display:'flex',alignItems:'center',justifyContent:'center',color:'inherit' }}
                >×</button>
              </div>
            ))}

            {/* Snap ghost */}
            {snapGhost && dragCardId.current && (() => {
              const card = brd.cards.find(c => c.id === dragCardId.current)
              if (!card) return null
              return (
                <div style={{
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
                }} />
              )
            })()}

            {/* Selection ring */}
            {selectedCardId && (() => {
              const card = brd.cards.find(c => c.id === selectedCardId)
              if (!card) return null
              return (
                <div style={{
                  position: 'absolute',
                  left: card.x - 5,
                  top: card.y - 5,
                  width: (card.card_width ?? 185) + 10,
                  height: card.card_height ? card.card_height + 10 : undefined,
                  minHeight: card.card_height ? undefined : (card.collapsed ? 54 : 110),
                  border: '2px solid #49B6E5',
                  borderRadius: 18,
                  pointerEvents: 'none',
                  zIndex: 21,
                  boxSizing: 'border-box',
                  boxShadow: '0 0 0 3px rgba(73,182,229,0.15)',
                  transform: card.rotation ? `rotate(${card.rotation}deg)` : undefined,
                  transformOrigin: 'top left',
                }} />
              )
            })()}

          </div>{/* end world */}

          {/* ── HUD ── */}
          {/* Zoom controls */}
          <div style={{ position:'absolute', right:18, bottom:22, display:'flex', flexDirection:'column', gap:1, background: dark?'#1A1A24':'white', borderRadius:9, border:`1px solid ${dark?'#2A2A38':'rgba(0,0,0,.1)'}`, overflow:'hidden', boxShadow:'0 2px 8px rgba(0,0,0,.1)', zIndex:50 }}>
            {['+','−'].map((sym,i)=>(
              <button key={sym} onClick={() => {
                const nz = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom * (i===0?1.2:0.8)))
                const cr = canvasRef.current!.getBoundingClientRect()
                const cx = cr.width/2, cy = cr.height/2
                setPanX(px => cx-(cx-px)*(nz/zoom)); setPanY(py => cy-(cy-py)*(nz/zoom)); setZoom(nz)
              }} style={{ width:34,height:34,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',fontSize:17,color:dark?'#ccc':'#555',background:'none',border:'none' }}>{sym}</button>
            ))}
            <div style={{ height:1, background: dark?'#2A2A38':'#e8e8e8' }}/>
            <div style={{ width:34,height:26,display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,color:dark?'#666':'#888',fontFamily:"'DM Sans',sans-serif" }}>{Math.round(zoom*100)}%</div>
            <div style={{ height:1, background: dark?'#2A2A38':'#e8e8e8' }}/>
            <button onClick={() => { setPanX(0); setPanY(0); setZoom(1) }} style={{ width:34,height:24,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',fontSize:9,color:dark?'#666':'#888',background:'none',border:'none' }}>1:1</button>
          </div>

          {/* Minimap */}
          <div style={{ position:'absolute', right:62, bottom:22, width:110, height:74, background: dark?'#1A1A24':'white', borderRadius:9, border:`1px solid ${dark?'#2A2A38':'rgba(0,0,0,.1)'}`, boxShadow:'0 2px 8px rgba(0,0,0,.1)', overflow:'hidden', zIndex:50, opacity:.85 }}>
            <div style={{ width:'100%',height:'100%',background: dark?'#0F0F14':'#f0ede5',position:'relative' }}>
              {[['12%','8%','#D4EDD8'],['52%','8%','#FFF3B0'],['12%','52%','#FFD6C2'],['52%','52%','#E8E0F5']].map(([l,t,bg],i)=>(
                <div key={i} style={{ position:'absolute',left:l,top:t,width:'36%',height:'40%',background:bg,border:'1px solid rgba(0,0,0,.1)',borderRadius:3,opacity: dark?.5:1 }}/>
              ))}
              <div style={{ position:'absolute',inset:'5%',border:'1.5px solid #6C63FF',borderRadius:3,pointerEvents:'none' }}/>
            </div>
          </div>

          {/* World coords */}
          <div style={{ position:'absolute',left:18,bottom:22,fontSize:10,color:dark?'#444':subC,fontFamily:"'DM Sans',sans-serif",background: dark?'rgba(26,26,36,.8)':'rgba(255,255,255,.8)',padding:'3px 8px',borderRadius:6,border:`1px solid ${dark?'#2A2A38':'rgba(0,0,0,.06)'}` }}>
            {Math.round(-panX/zoom)}, {Math.round(-panY/zoom)}
          </div>

          {/* Export overlay */}
          {exporting && (
            <div style={{ position:'absolute',inset:0,background:'rgba(0,0,0,.4)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:200,color:'white',fontFamily:"'DM Sans',sans-serif",fontSize:16 }}>
              Generating PDF…
            </div>
          )}
        </div>
      </div>

      {/* Markdown styles */}
      <style>{`
        .md-body p { margin: 0 0 4px; }
        .md-body ul { margin: 4px 0; padding-left: 14px; }
        .md-body li { margin-bottom: 2px; }
        .md-body a { color: #6C63FF; text-decoration: underline; }
        .md-body strong { font-weight: 700; }
        .md-body em { font-style: italic; }
        .md-body code { background: rgba(0,0,0,.08); padding: 1px 4px; border-radius: 3px; font-size: 10px; }
      `}</style>

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
                onClick={() => { brd.updateCard(colourPicker.cardId, { bg: sw.value }); setColourPicker(null) }}
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

      <CardModal card={editingCard} isOpen={modalOpen} onClose={() => setModalOpen(false)} onSave={handleSave} onDelete={editingCard ? handleDelete : undefined} dark={dark} />

      {toast && (
        <div style={{ position:'fixed',bottom:24,left:'50%',transform:'translateX(-50%)',background: dark?'#25252F':'#1A1A2E',color:'white',borderRadius:10,padding:'10px 20px',fontSize:13,fontFamily:"'DM Sans',sans-serif",zIndex:2000,display:'flex',alignItems:'center',gap:10,boxShadow:'0 8px 24px rgba(0,0,0,.2)' }}>
          {toast}
          <button onClick={() => { brd.undo(); showToast('Undone ↩') }} style={{ background:'rgba(255,255,255,.15)',border:'1px solid rgba(255,255,255,.3)',borderRadius:6,padding:'2px 9px',cursor:'pointer',fontSize:11,color:'white',fontFamily:"'DM Sans',sans-serif" }}>Undo</button>
        </div>
      )}

      {/* Keyboard shortcuts overlay */}
      {showShortcuts && (
        <div style={{
          position: 'fixed',
          right: 20,
          bottom: 80,
          zIndex: 500,
          background: 'rgba(26,26,46,0.95)',
          backdropFilter: 'blur(8px)',
          borderRadius: 12,
          padding: '16px 20px',
          color: '#fff',
          fontSize: 13,
          width: 290,
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          fontFamily: "'DM Sans',sans-serif",
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <span style={{ fontWeight: 700, fontSize: 14 }}>Keyboard Shortcuts</span>
            <button
              onClick={() => setShowShortcuts(false)}
              style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: 0 }}
            >×</button>
          </div>

          <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, opacity: 0.5, marginBottom: 8 }}>Navigation</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 14px', alignItems: 'center', marginBottom: 14 }}>
            {([
              ['Ctrl + drag', 'Pan with mouse'],
              ['↑ ↓ ← →',    'Pan canvas'],
              ['Shift + arrows', 'Pan faster'],
              ['+  /  -',    'Zoom in / out'],
              ['0',          'Reset zoom'],
            ] as [string, string][]).map(([key, desc], i) => (
              <Fragment key={i}>
                <span style={{ background: '#263D5B', padding: '2px 7px', borderRadius: 4, fontFamily: 'monospace', fontSize: 12, whiteSpace: 'nowrap', textAlign: 'center' }}>{key}</span>
                <span style={{ opacity: 0.85 }}>{desc}</span>
              </Fragment>
            ))}
          </div>

          <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, opacity: 0.5, marginBottom: 8 }}>Cards</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 14px', alignItems: 'center', marginBottom: 14 }}>
            {([
              ['N',        'New card'],
              ['Esc',      'Deselect / close'],
              ['Delete',   'Delete selected card'],
              ['Ctrl + Z', 'Undo'],
            ] as [string, string][]).map(([key, desc], i) => (
              <Fragment key={i}>
                <span style={{ background: '#263D5B', padding: '2px 7px', borderRadius: 4, fontFamily: 'monospace', fontSize: 12, whiteSpace: 'nowrap', textAlign: 'center' }}>{key}</span>
                <span style={{ opacity: 0.85 }}>{desc}</span>
              </Fragment>
            ))}
          </div>

          <div style={{ opacity: 0.4, fontSize: 11, borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 10 }}>
            Press <span style={{ fontFamily: 'monospace' }}>?</span> to close
          </div>
        </div>
      )}
    </div>
  )
}

function SbBtn({ children, title, onClick, dark }: { children: React.ReactNode; title: string; onClick: () => void; dark: boolean }) {
  return (
    <button title={title} onClick={onClick}
      style={{ width:42,height:42,borderRadius:10,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',color:'#555',background:'none',border:'none',transition:'background .15s,color .15s' }}
      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = dark?'#1A1A22':'#22222A'; (e.currentTarget as HTMLButtonElement).style.color = '#ccc' }}
      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'none'; (e.currentTarget as HTMLButtonElement).style.color = '#555' }}
    >{children}</button>
  )
}

function Centered({ children, dark, error }: { children: React.ReactNode; dark: boolean; error?: boolean }) {
  return (
    <div style={{ height:'100vh',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:"'DM Sans',sans-serif",color: error?'#C53030':(dark?'#888':'#aaa'),background: dark?'#0F0F14':'#ECEAE3' }}>
      {children}
    </div>
  )
}
