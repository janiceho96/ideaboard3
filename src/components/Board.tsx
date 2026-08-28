// src/components/Board.tsx
import { useState, useRef, useEffect, useCallback, useMemo, Fragment } from 'react'
import type { LocalUser, Board as BoardType, Card, GoalTagInsert, TagType } from '../types'
import { useBoard } from '../hooks/useBoard'
import IdeaCard from './IdeaCard'
import CardModal from './CardModal'
import { snapPosition, snapPositionGeneric } from '../lib/snapPosition'
import { playSnapSound } from '../lib/snapSound'
import { useFrames, FRAMEWORK_LABELS, FRAMEWORK_GROUPS } from '../hooks/useFrames'
import FrameworkOverlay from './FrameworkOverlay'
import { useSlides } from '../hooks/useSlides'
import { importPdf } from '../lib/pdfImport'
import { saveImage, getImage, deleteImage } from '../lib/slideImageStore'
import SlideTile from './SlideTile'
import type { SlideTile as SlideTileType } from '../types'
import TextBlockItem, { TEXT_MIN_W } from './TextBlockItem'
import { useTextBlocks } from '../hooks/useTextBlocks'
import type { UseTextBlocksReturn } from '../hooks/useTextBlocks'
import { buildExportBounds, type BoardRect } from '../lib/boardGeometry'
import { colors, fonts } from '../lib/designTokens'
import { buildBulkDeleteItems, type BulkDeleteItem } from '../lib/bulkDelete'
import { buildWhiteboardExport } from '../lib/whiteboardExport'
import { buildWhiteboardImport } from '../lib/whiteboardImport'
import { buildBoardNavigationItems, filterCardsForBoard, type BoardNavigationItem } from '../lib/boardNavigation'
import { normalizeSelectionRect, selectCardIdsInRect, selectSlideIdsInRect, type SelectionRect } from '../lib/multiSelect'
import { ArrowLeft, CircleHelp, Download, FolderInput, Maximize2, Moon, Plus, Search, SquarePlus, Sun, Trash2, Type, Undo2, Upload, Workflow, ZoomIn, ZoomOut } from 'lucide-react'

const COLOUR_SWATCHES = [
  { value: 'white',   label: 'White',  border: '#ddd' },
  { value: colors.markerYellow, label: 'Yellow' },
  { value: colors.markerCoral, label: 'Coral'   },
  { value: colors.markerMint, label: 'Mint'  },
  { value: colors.markerCyan, label: 'Cyan'   },
  { value: '#EEE9FF', label: 'Purple' },
  { value: '#E7E9EF', label: 'Neutral'  },
  { value: colors.inkDark, label: 'Dark'   },
]

interface BoardProps {
  user: LocalUser
  board: BoardType
  onBack: () => void
  dark: boolean
  onToggleDark: () => void
}

interface SlideGroup {
  id: string
  board_id: string
  name: string
  tileIds: string[]
  created_at: string
}

const MIN_ZOOM = 0.15
const MAX_ZOOM = 3
const CARD_MIN_W = 140
const CARD_MIN_H = 100
const FRAMEWORK_MIN_W = 400
const FRAMEWORK_MIN_H = 200
const TEXT_HEIGHT_ESTIMATE = 80
const TEXT_SNAP_RADIUS = 110
const EXPORT_PADDING = 80
const SLIDE_GROUP_PADDING = 26

function slideGroupStorageKey(boardId: string): string {
  return `ideaboard_slide_groups_${boardId}`
}

function getSlideHeight(tile: SlideTileType): number {
  return tile.aspect_ratio > 0 ? tile.width / tile.aspect_ratio : tile.width
}

function getSlideGroupBounds(tiles: SlideTileType[]): BoardRect | null {
  if (!tiles.length) return null
  const left = Math.min(...tiles.map(tile => tile.x))
  const top = Math.min(...tiles.map(tile => tile.y))
  const right = Math.max(...tiles.map(tile => tile.x + tile.width))
  const bottom = Math.max(...tiles.map(tile => tile.y + getSlideHeight(tile)))
  return {
    x: left - SLIDE_GROUP_PADDING,
    y: top - SLIDE_GROUP_PADDING - 34,
    width: right - left + SLIDE_GROUP_PADDING * 2,
    height: bottom - top + SLIDE_GROUP_PADDING * 2 + 34,
  }
}

function pointInRect(x: number, y: number, rect: BoardRect): boolean {
  return x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height
}

export default function Board({ user, board, onBack, dark, onToggleDark }: BoardProps) {
  const brd = useBoard(board.id)
  const frm = useFrames(board.id)
  const frmRef = useRef(frm)
  useEffect(() => { frmRef.current = frm }, [frm])
  const sld = useSlides(board.id)
  const sldRef = useRef(sld)
  useEffect(() => { sldRef.current = sld }, [sld])
  const [slideGroups, setSlideGroups] = useState<SlideGroup[]>(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem(slideGroupStorageKey(board.id)) ?? '[]')
      return Array.isArray(parsed) ? parsed as SlideGroup[] : []
    } catch {
      return []
    }
  })
  const [focusGroupId, setFocusGroupId] = useState<string | null>(null)
  const [focusSlideIndex, setFocusSlideIndex] = useState(0)
  useEffect(() => {
    localStorage.setItem(slideGroupStorageKey(board.id), JSON.stringify(slideGroups))
  }, [board.id, slideGroups])
  const txt = useTextBlocks(board.id)
  const txtRef = useRef<UseTextBlocksReturn>(txt)
  useEffect(() => { txtRef.current = txt }, [txt])

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
  const lastCtrlPos = useRef<{ x: number; y: number } | null>(null)

  // Card drag
  const isDragging   = useRef(false)
  const dragCardId   = useRef<string | null>(null)
  const dragTagId    = useRef<string | null>(null)
  const dragOffWX    = useRef(0)
  const dragOffWY    = useRef(0)
  const dragStartWX  = useRef(0)
  const dragStartWY  = useRef(0)
  const multiDragStart = useRef<Record<string, { x: number; y: number }>>({})
  const multiTileDragStart = useRef<Record<string, { x: number; y: number }>>({})
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
  const resizeTarget  = useRef<'card' | 'framework' | 'textblock'>('card')
  const dragTileId    = useRef<string | null>(null)
  const lastSnapId    = useRef<string | null>(null)
  const dragTextId    = useRef<string | null>(null)
  const resizeTextId  = useRef<string | null>(null)
  const dragFrameId   = useRef<string | null>(null)
  const resizeFrameId = useRef<string | null>(null)
  const moveRaf = useRef<number | null>(null)
  const pendingMove = useRef<{ clientX: number; clientY: number } | null>(null)

  // Selection
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null)
  const [selectedCardIds, setSelectedCardIds] = useState<string[]>([])
  const [selectedTileIds, setSelectedTileIds] = useState<string[]>([])
  const [draggingTileId, setDraggingTileId] = useState<string | null>(null)
  const isSelecting = useRef(false)
  const selectionStart = useRef<{ x: number; y: number } | null>(null)
  const selectionRectRef = useRef<SelectionRect | null>(null)
  const [selectionRect, setSelectionRect] = useState<SelectionRect | null>(null)

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
  const [selectedFrameId,  setSelectedFrameId]  = useState<string | null>(null)
  const [addFrameMenuOpen, setAddFrameMenuOpen]  = useState(false)
  const addFrameBtnRef = useRef<HTMLDivElement>(null)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [bulkDeleteSelection, setBulkDeleteSelection] = useState<Record<string, boolean>>({})
  const [boardSearch, setBoardSearch] = useState('')
  const [hideDoneRemove, setHideDoneRemove] = useState(false)
  const [overdueOnly, setOverdueOnly] = useState(false)
  const [showBoardPanel, setShowBoardPanel] = useState(true)
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

  const panBoard = useCallback((dx: number, dy: number) => {
    setPanX(px => px + dx)
    setPanY(py => py + dy)
  }, [])

  const cardRects = useMemo(() => brd.cards.map(card => ({
    rect: {
      x: card.x,
      y: card.y,
      width: card.card_width ?? 185,
      height: card.card_height ?? (card.collapsed ? 54 : 160),
    },
  })), [brd.cards])

  const tileRects = useMemo(() => sld.tiles.map(tile => ({
    rect: {
      x: tile.x,
      y: tile.y,
      width: tile.width,
      height: tile.width / tile.aspect_ratio,
    },
  })), [sld.tiles])

  const textRects = useMemo(() => txt.blocks.map(block => ({
    rect: {
      x: block.x,
      y: block.y,
      width: block.width,
      height: TEXT_HEIGHT_ESTIMATE,
    },
  })), [txt.blocks])

  const frameRects = useMemo(() => frm.frames.map(frame => ({
    rect: { x: frame.x, y: frame.y, width: frame.width, height: frame.height },
  })), [frm.frames])

  const tagRects = useMemo(() => brd.goalTags.map(tag => ({
    rect: { x: tag.x, y: tag.y, width: Math.max(90, tag.label.length * 9 + 48), height: 38 },
  })), [brd.goalTags])

  const exportBounds = useMemo(() => {
    const rects: BoardRect[] = [
      ...cardRects.map(({ rect }) => rect),
      ...tileRects.map(({ rect }) => rect),
      ...textRects.map(({ rect }) => rect),
      ...frameRects.map(({ rect }) => rect),
      ...tagRects.map(({ rect }) => rect),
    ]
    return buildExportBounds(rects, EXPORT_PADDING)
  }, [cardRects, frameRects, tagRects, textRects, tileRects])

  const bulkDeleteItems = useMemo(() => buildBulkDeleteItems({
    cards: brd.cards,
    slides: sld.tiles,
    textBlocks: txt.blocks,
    frames: frm.frames,
    tags: brd.goalTags,
    frameLabel: type => FRAMEWORK_LABELS[type],
  }), [brd.cards, brd.goalTags, frm.frames, sld.tiles, txt.blocks])

  const selectedBulkItems = useMemo(
    () => bulkDeleteItems.filter(item => bulkDeleteSelection[item.key]),
    [bulkDeleteItems, bulkDeleteSelection],
  )

  const toggleBulkItem = useCallback((key: string) => {
    setBulkDeleteSelection(prev => ({ ...prev, [key]: !prev[key] }))
  }, [])

  const setBulkKind = useCallback((kind: BulkDeleteItem['kind'], selected: boolean) => {
    setBulkDeleteSelection(prev => {
      const next = { ...prev }
      for (const item of bulkDeleteItems) {
        if (item.kind === kind) next[item.key] = selected
      }
      return next
    })
  }, [bulkDeleteItems])

  const clearBulkDelete = useCallback(() => setBulkDeleteSelection({}), [])

  const visibleCards = useMemo(() => filterCardsForBoard(brd.cards, {
    query: boardSearch,
    hideDoneRemove,
    overdueOnly,
  }), [boardSearch, brd.cards, hideDoneRemove, overdueOnly])

  const selectedCards = useMemo(
    () => brd.cards.filter(card => selectedCardIds.includes(card.id)),
    [brd.cards, selectedCardIds],
  )
  const selectedBoardItemCount = selectedCardIds.length + selectedTileIds.length
  const slideGroupViews = useMemo(() => slideGroups.map(group => {
    const tiles = sld.tiles.filter(tile => group.tileIds.includes(tile.id))
    return { group, tiles, bounds: getSlideGroupBounds(tiles) }
  }).filter(view => view.bounds), [slideGroups, sld.tiles])
  const focusGroup = focusGroupId ? slideGroups.find(group => group.id === focusGroupId) ?? null : null
  const focusSlides = focusGroup ? sld.tiles.filter(tile => focusGroup.tileIds.includes(tile.id)) : []

  const navigationItems = useMemo(() => buildBoardNavigationItems({
    cards: brd.cards,
    textBlocks: txt.blocks,
    slides: sld.tiles,
    frames: frm.frames,
    tags: brd.goalTags,
    frameLabel: type => FRAMEWORK_LABELS[type],
  }), [brd.cards, brd.goalTags, frm.frames, sld.tiles, txt.blocks])

  const outlineItems = useMemo(() => {
    const q = boardSearch.trim().toLowerCase()
    if (!q) return navigationItems
    return navigationItems.filter(item => item.searchText.includes(q))
  }, [boardSearch, navigationItems])

  const jumpToItem = useCallback((item: BoardNavigationItem) => {
    const cr = canvasRef.current?.getBoundingClientRect()
    if (!cr) return
    const nextZoom = Math.max(zoomRef.current, 0.75)
    setZoom(nextZoom)
    setPanX(cr.width / 2 - item.x * nextZoom)
    setPanY(cr.height / 2 - item.y * nextZoom)
    if (item.kind === 'card') setSelectedCardId(item.id)
    if (item.kind === 'frame') setSelectedFrameId(item.id)
  }, [])

  // ── Mouse handlers ──────────────────────────────────────────
  const onCanvasMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0 && e.button !== 2) return
    if ((e.target as HTMLElement).closest('.world-item')) return
    if (e.shiftKey || e.button === 2) {
      const start = screenToWorld(e.clientX, e.clientY)
      isSelecting.current = true
      selectionStart.current = start
      const rect = { x: start.x, y: start.y, width: 0, height: 0 }
      selectionRectRef.current = rect
      setSelectionRect(rect)
      setSelectedCardId(null)
      setSelectedTileIds([])
      setSelectedFrameId(null)
      e.preventDefault()
      return
    }
    setSelectedCardId(null)
    setSelectedCardIds([])
    setSelectedTileIds([])
    setSelectedFrameId(null)
    if (e.ctrlKey) { e.preventDefault(); return }
    isPanning.current = true
    panStart.current = { x: e.clientX, y: e.clientY, px: panX, py: panY }
    e.preventDefault()
  }

  const onCardMoveStart = useCallback((id: string, cx: number, cy: number) => {
    setSelectedCardId(id)
    if (!selectedCardIds.includes(id)) setSelectedCardIds([id])
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
    dragStartWX.current = card.x
    dragStartWY.current = card.y
    const ids = selectedCardIds.includes(id) ? selectedCardIds : [id]
    multiDragStart.current = Object.fromEntries(
      brd.cards
        .filter(c => ids.includes(c.id))
        .map(c => [c.id, { x: c.x, y: c.y }]),
    )
    multiTileDragStart.current = Object.fromEntries(
      sldRef.current.tiles
        .filter(t => selectedTileIds.includes(t.id))
        .map(t => [t.id, { x: t.x, y: t.y }]),
    )
    dragOffWX.current = mwx - card.x
    dragOffWY.current = mwy - card.y
  }, [zoom, panX, panY, brd.cards, selectedCardIds, selectedTileIds])

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

  const onFrameMoveStart = useCallback((id: string, e: React.MouseEvent) => {
    const frame = frmRef.current.frames.find(f => f.id === id)
    if (!frame) return
    isDragging.current  = true
    dragFrameId.current = id
    dragCardId.current  = null
    dragTagId.current   = null
    dragTileId.current  = null
    dragTextId.current  = null
    snapZoom.current    = zoom
    snapPanX.current    = panX
    snapPanY.current    = panY
    const cr = canvasRef.current!.getBoundingClientRect()
    dragOffWX.current = (e.clientX - cr.left - panX) / zoom - frame.x
    dragOffWY.current = (e.clientY - cr.top  - panY) / zoom - frame.y
  }, [zoom, panX, panY])

  const onFrameResizeStart = useCallback((id: string, e: React.MouseEvent) => {
    const frame = frmRef.current.frames.find(f => f.id === id)
    if (!frame) return
    isResizing.current    = true
    resizeTarget.current  = 'framework'
    resizeFrameId.current = id
    resizeStartX.current  = e.clientX
    resizeStartY.current  = e.clientY
    resizeStartW.current  = frame.width
    resizeStartH.current  = frame.height
  }, [])

  const onTileMoveStart = useCallback((id: string, cx: number, cy: number) => {
    const tile = sldRef.current.tiles.find(t => t.id === id)
    if (!tile) return
    if (!selectedTileIds.includes(id)) {
      setSelectedTileIds([id])
      setSelectedCardIds([])
    }
    isDragging.current  = true
    dragTileId.current  = id
    dragCardId.current  = null
    dragTagId.current   = null
    dragTextId.current  = null
    dragFrameId.current = null
    dragStartWX.current = tile.x
    dragStartWY.current = tile.y
    multiDragStart.current = Object.fromEntries(
      brd.cards
        .filter(c => selectedTileIds.includes(id) && selectedCardIds.includes(c.id))
        .map(c => [c.id, { x: c.x, y: c.y }]),
    )
    const tileIds = selectedTileIds.includes(id) ? selectedTileIds : [id]
    multiTileDragStart.current = Object.fromEntries(
      sldRef.current.tiles
        .filter(t => tileIds.includes(t.id))
        .map(t => [t.id, { x: t.x, y: t.y }]),
    )
    setDraggingTileId(id)
    setSelectedCardId(null)
    setSelectedFrameId(null)
    setSnapGhost(null)
    snapZoom.current    = zoom
    snapPanX.current    = panX
    snapPanY.current    = panY
    const cr = canvasRef.current!.getBoundingClientRect()
    const mwx = (cx - cr.left - panX) / zoom
    const mwy = (cy - cr.top  - panY) / zoom
    dragOffWX.current = mwx - tile.x
    dragOffWY.current = mwy - tile.y
  }, [zoom, panX, panY, brd.cards, selectedCardIds, selectedTileIds])

  const onTextMoveStart = useCallback((id: string, cx: number, cy: number) => {
    const block = txtRef.current.blocks.find(b => b.id === id)
    if (!block) return
    isDragging.current  = true
    dragTextId.current  = id
    dragCardId.current  = null
    dragTagId.current   = null
    dragTileId.current  = null
    snapZoom.current    = zoom
    snapPanX.current    = panX
    snapPanY.current    = panY
    const cr = canvasRef.current!.getBoundingClientRect()
    const mwx = (cx - cr.left - panX) / zoom
    const mwy = (cy - cr.top  - panY) / zoom
    dragOffWX.current = mwx - block.x
    dragOffWY.current = mwy - block.y
  }, [zoom, panX, panY])

  const onTextResizeStart = useCallback((id: string, cx: number, cy: number, startW: number) => {
    resizeTarget.current  = 'textblock'
    isResizing.current    = true
    resizeTextId.current  = id
    resizeCardId.current  = null
    resizeStartX.current  = cx
    resizeStartY.current  = cy
    resizeStartW.current  = startW
  }, [])

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

  const deleteSelectedBulkItems = useCallback(async () => {
    const items = selectedBulkItems
    if (!items.length) return

    for (const item of items) {
      if (item.kind === 'card') {
        if (item.id === selectedCardId) setSelectedCardId(null)
        await brd.removeCard(item.id)
      } else if (item.kind === 'slide') {
        await handleDeleteTile(item.id)
      } else if (item.kind === 'text') {
        txtRef.current.removeBlock(item.id)
      } else if (item.kind === 'frame') {
        frmRef.current.deleteFrame(item.id)
        if (item.id === selectedFrameId) setSelectedFrameId(null)
      } else if (item.kind === 'tag') {
        await brd.removeGoalTag(item.id)
      }
    }

    setBulkDeleteSelection({})
    setBulkDeleteOpen(false)
    showToast(`Deleted ${items.length} item${items.length !== 1 ? 's' : ''}`)
  }, [brd, handleDeleteTile, selectedBulkItems, selectedCardId, selectedFrameId])

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

  const deleteSelectedBoardItems = useCallback(async () => {
    const cardIds = selectedCardIds
    const tileIds = selectedTileIds
    if (!cardIds.length && !tileIds.length) return
    await Promise.all(cardIds.map(id => brd.removeCard(id)))
    tileIds.forEach(id => sldRef.current.removeTile(id))
    setSelectedCardIds([])
    setSelectedTileIds([])
    setSelectedCardId(null)
    showToast(`Deleted ${cardIds.length + tileIds.length} item${cardIds.length + tileIds.length !== 1 ? 's' : ''}`)
  }, [brd, selectedCardIds, selectedTileIds])

  const createSlideGroupFromSelection = useCallback(() => {
    if (!selectedTileIds.length) return
    setSlideGroups(prev => {
      const existingIds = new Set(selectedTileIds)
      const next = prev.map(group => ({
        ...group,
        tileIds: group.tileIds.filter(id => !existingIds.has(id)),
      })).filter(group => group.tileIds.length)
      return [
        ...next,
        {
          id: crypto.randomUUID(),
          board_id: board.id,
          name: `Slide Group ${next.length + 1}`,
          tileIds: selectedTileIds,
          created_at: new Date().toISOString(),
        },
      ]
    })
    showToast(`Grouped ${selectedTileIds.length} slide${selectedTileIds.length !== 1 ? 's' : ''}`)
  }, [board.id, selectedTileIds])

  const syncSlideGroupsAfterDrop = useCallback((tileIds: string[], positions: Record<string, { x: number; y: number }> = {}) => {
    if (!tileIds.length) return
    const currentTiles = sldRef.current.tiles.map(tile => positions[tile.id] ? { ...tile, ...positions[tile.id] } : tile)
    const dropped = currentTiles.filter(tile => tileIds.includes(tile.id))
    setSlideGroups(prev => {
      let next = prev.map(group => ({ ...group, tileIds: group.tileIds.filter(id => !tileIds.includes(id)) }))
      for (const tile of dropped) {
        const cx = tile.x + tile.width / 2
        const cy = tile.y + getSlideHeight(tile) / 2
        const target = next.find(group => {
          const tiles = currentTiles.filter(t => group.tileIds.includes(t.id))
          const bounds = getSlideGroupBounds(tiles)
          return bounds ? pointInRect(cx, cy, bounds) : false
        })
        if (target) target.tileIds = [...target.tileIds, tile.id]
      }
      next = next.filter(group => group.tileIds.length)
      return next
    })
  }, [])

  const duplicateSelectedCards = useCallback(async () => {
    const ids = selectedCardIds
    if (!ids.length) return
    await Promise.all(ids.map(id => brd.duplicateCard(id)))
    showToast(`Duplicated ${ids.length} card${ids.length !== 1 ? 's' : ''}`)
  }, [brd, selectedCardIds])

  const updateSelectedCards = useCallback(async (changes: Partial<Card>) => {
    const ids = selectedCardIds
    if (!ids.length) return
    await Promise.all(ids.map(id => brd.updateCard(id, changes)))
    showToast(`Updated ${ids.length} card${ids.length !== 1 ? 's' : ''}`)
  }, [brd, selectedCardIds])

  useEffect(() => {
    const applyPointerMove = (clientX: number, clientY: number) => {
      if (isDragging.current && canvasRef.current) {
        const cr = canvasRef.current.getBoundingClientRect()
        const wx = (clientX - cr.left - snapPanX.current) / snapZoom.current - dragOffWX.current
        const wy = (clientY - cr.top  - snapPanY.current) / snapZoom.current - dragOffWY.current
        if (dragCardId.current) {
          const starts = multiDragStart.current
          const tileStarts = multiTileDragStart.current
          const ids = Object.keys(starts)
          const tileIds = Object.keys(tileStarts)
          if (ids.length > 1 || tileIds.length) {
            const dx = wx - dragStartWX.current
            const dy = wy - dragStartWY.current
            for (const id of ids) brd.moveCard(id, starts[id].x + dx, starts[id].y + dy)
            const tilePositions = Object.fromEntries(tileIds.map(id => [id, { x: tileStarts[id].x + dx, y: tileStarts[id].y + dy }]))
            if (tileIds.length) sldRef.current.moveTiles(tilePositions)
            setSnapGhost(null)
          } else {
            brd.moveCard(dragCardId.current, wx, wy)
            const draggingCard = brd.cards.find(c => c.id === dragCardId.current)
            if (draggingCard) {
            const snap = snapPosition(wx, wy, draggingCard, brd.cards)
            setSnapGhost(snap)
            if (snap.snappedToId && snap.snappedToId !== lastSnapId.current) playSnapSound()
            lastSnapId.current = snap.snappedToId
            }
          }
        }
        if (dragTagId.current) brd.moveGoalTag(dragTagId.current, wx, wy)
        if (dragTileId.current) {
          const tileStarts = multiTileDragStart.current
          const cardStarts = multiDragStart.current
          const tileIds = Object.keys(tileStarts)
          const cardIds = Object.keys(cardStarts)
          if (tileIds.length > 1 || cardIds.length) {
            const dx = wx - dragStartWX.current
            const dy = wy - dragStartWY.current
            const tilePositions = Object.fromEntries(tileIds.map(id => [id, { x: tileStarts[id].x + dx, y: tileStarts[id].y + dy }]))
            sldRef.current.moveTiles(tilePositions)
            for (const id of cardIds) brd.moveCard(id, cardStarts[id].x + dx, cardStarts[id].y + dy)
          } else {
            sldRef.current.moveTile(dragTileId.current, wx, wy)
          }
        }
        if (dragTextId.current) {
          txtRef.current.moveBlock(dragTextId.current, wx, wy)
          const draggingBlock = txtRef.current.blocks.find(b => b.id === dragTextId.current)
          if (draggingBlock) {
            const targets = txtRef.current.blocks.map(b => ({ id: b.id, x: b.x, y: b.y, w: b.width, h: TEXT_HEIGHT_ESTIMATE }))
            const snap = snapPositionGeneric(
              wx,
              wy,
              { id: draggingBlock.id, x: wx, y: wy, w: draggingBlock.width, h: TEXT_HEIGHT_ESTIMATE },
              targets,
              { radius: TEXT_SNAP_RADIUS, gridSize: null },
            )
            setSnapGhost(snap.snappedToId ? snap : null)
            if (snap.snappedToId && snap.snappedToId !== lastSnapId.current) playSnapSound()
            lastSnapId.current = snap.snappedToId
          }
        }
        if (dragFrameId.current) frmRef.current.moveFrame(dragFrameId.current, wx, wy)
        return
      }
      if (isResizing.current) {
        const dx = (clientX - resizeStartX.current) / zoom
        const dy = (clientY - resizeStartY.current) / zoom
        if (resizeTarget.current === 'framework' && resizeFrameId.current) {
          frmRef.current.setFrameSize(
            resizeFrameId.current,
            Math.max(FRAMEWORK_MIN_W, resizeStartW.current + dx),
            Math.max(FRAMEWORK_MIN_H, (resizeStartH.current ?? 540) + dy),
          )
        } else if (resizeCardId.current) {
          const newW = Math.max(CARD_MIN_W, resizeStartW.current + dx)
          const newH = resizeStartH.current !== null
            ? Math.max(CARD_MIN_H, resizeStartH.current + dy)
            : Math.max(CARD_MIN_H, 160 + dy)
          brd.resizeCard(resizeCardId.current, newW, newH)
        } else if (resizeTarget.current === 'textblock' && resizeTextId.current) {
          const newW = Math.max(TEXT_MIN_W, resizeStartW.current + (clientX - resizeStartX.current) / zoom)
          txtRef.current.resizeBlock(resizeTextId.current, newW)
        }
      }
    }

    const schedulePointerMove = (e: MouseEvent) => {
      pendingMove.current = { clientX: e.clientX, clientY: e.clientY }
      if (moveRaf.current !== null) return
      moveRaf.current = requestAnimationFrame(() => {
        moveRaf.current = null
        const point = pendingMove.current
        pendingMove.current = null
        if (point) applyPointerMove(point.clientX, point.clientY)
      })
    }

    const onMove = (e: MouseEvent) => {
      if (isSelecting.current && selectionStart.current) {
        const cr = canvasRef.current?.getBoundingClientRect()
        if (!cr) return
        const wx = (e.clientX - cr.left - panX) / zoom
        const wy = (e.clientY - cr.top - panY) / zoom
        const rect = {
          x: selectionStart.current.x,
          y: selectionStart.current.y,
          width: wx - selectionStart.current.x,
          height: wy - selectionStart.current.y,
        }
        selectionRectRef.current = rect
        setSelectionRect(rect)
        return
      }
      if (isPanning.current) {
        setPanX(panStart.current.px + (e.clientX - panStart.current.x))
        setPanY(panStart.current.py + (e.clientY - panStart.current.y))
        return
      }
      if (isDragging.current || isResizing.current) {
        schedulePointerMove(e)
      }
    }

    const onUp = (e: MouseEvent) => {
      if (isSelecting.current) {
        const rect = selectionRectRef.current
        const cardIds = rect ? selectCardIdsInRect(visibleCards, rect) : []
        const tileIds = rect ? selectSlideIdsInRect(sldRef.current.tiles, rect) : []
        setSelectedCardIds(cardIds)
        setSelectedTileIds(tileIds)
        setSelectedCardId(cardIds[0] ?? null)
        setSelectionRect(null)
        selectionRectRef.current = null
        selectionStart.current = null
        isSelecting.current = false
        const count = cardIds.length + tileIds.length
        if (count) showToast(`Selected ${count} item${count !== 1 ? 's' : ''}`)
        return
      }
      if (isPanning.current) { isPanning.current = false; return }
      if (isDragging.current && canvasRef.current) {
        const cr = canvasRef.current.getBoundingClientRect()
        const wx = (e.clientX - cr.left - snapPanX.current) / snapZoom.current - dragOffWX.current
        const wy = (e.clientY - cr.top  - snapPanY.current) / snapZoom.current - dragOffWY.current
        if (dragCardId.current) {
          const draggingCard = brd.cards.find(c => c.id === dragCardId.current)
          const starts = multiDragStart.current
          const tileStarts = multiTileDragStart.current
          const ids = Object.keys(starts)
          const tileIds = Object.keys(tileStarts)
          if (ids.length > 1 || tileIds.length) {
            const dx = wx - dragStartWX.current
            const dy = wy - dragStartWY.current
            for (const id of ids) {
              const next = { x: starts[id].x + dx, y: starts[id].y + dy }
              brd.moveCard(id, next.x, next.y)
              brd.commitCardMove(id, next.x, next.y)
            }
            const tilePositions = Object.fromEntries(tileIds.map(id => [id, { x: tileStarts[id].x + dx, y: tileStarts[id].y + dy }]))
            if (tileIds.length) {
              sldRef.current.commitTileMoves(tilePositions)
              syncSlideGroupsAfterDrop(tileIds, tilePositions)
            }
          } else {
            const finalPos = draggingCard
              ? snapPosition(wx, wy, draggingCard, brd.cards)
              : { x: wx, y: wy }
            brd.moveCard(dragCardId.current, finalPos.x, finalPos.y)
            brd.commitCardMove(dragCardId.current, finalPos.x, finalPos.y)
          }
        }
        if (dragTagId.current) brd.commitGoalTagMove(dragTagId.current, wx, wy)
        if (dragTileId.current) {
          const tileStarts = multiTileDragStart.current
          const cardStarts = multiDragStart.current
          const tileIds = Object.keys(tileStarts)
          const cardIds = Object.keys(cardStarts)
          if (tileIds.length > 1 || cardIds.length) {
            const dx = wx - dragStartWX.current
            const dy = wy - dragStartWY.current
            const tilePositions = Object.fromEntries(tileIds.map(id => [id, { x: tileStarts[id].x + dx, y: tileStarts[id].y + dy }]))
            if (tileIds.length) {
              sldRef.current.commitTileMoves(tilePositions)
              syncSlideGroupsAfterDrop(tileIds, tilePositions)
            }
            for (const id of cardIds) {
              const next = { x: cardStarts[id].x + dx, y: cardStarts[id].y + dy }
              brd.moveCard(id, next.x, next.y)
              brd.commitCardMove(id, next.x, next.y)
            }
          } else {
            sldRef.current.commitTileMove(dragTileId.current, wx, wy)
            syncSlideGroupsAfterDrop([dragTileId.current], { [dragTileId.current]: { x: wx, y: wy } })
          }
        }
        if (dragTextId.current) {
          const draggingBlock = txtRef.current.blocks.find(b => b.id === dragTextId.current)
          const targets = draggingBlock ? txtRef.current.blocks.map(b => ({ id: b.id, x: b.x, y: b.y, w: b.width, h: TEXT_HEIGHT_ESTIMATE })) : []
          const finalPos = draggingBlock
            ? snapPositionGeneric(
                wx,
                wy,
                { id: draggingBlock.id, x: wx, y: wy, w: draggingBlock.width, h: TEXT_HEIGHT_ESTIMATE },
                targets,
                { radius: TEXT_SNAP_RADIUS, gridSize: null },
              )
            : { x: wx, y: wy }
          txtRef.current.moveBlock(dragTextId.current, finalPos.x, finalPos.y)
          txtRef.current.commitBlockMove(dragTextId.current, finalPos.x, finalPos.y)
        }
        if (dragFrameId.current) {
          frmRef.current.commitFrameMove(dragFrameId.current, wx, wy)
        }
        isDragging.current  = false
        dragCardId.current  = null
        dragTagId.current   = null
        dragTileId.current  = null
        dragTextId.current  = null
        dragFrameId.current = null
        multiDragStart.current = {}
        multiTileDragStart.current = {}
        setDraggingTileId(null)
        lastSnapId.current  = null
        setSnapGhost(null)
        return
      }
      if (isResizing.current) {
        const dx = (e.clientX - resizeStartX.current) / zoom
        const dy = (e.clientY - resizeStartY.current) / zoom
        if (resizeTarget.current === 'framework' && resizeFrameId.current) {
          frmRef.current.commitFrameResize(
            resizeFrameId.current,
            Math.max(FRAMEWORK_MIN_W, resizeStartW.current + dx),
            Math.max(FRAMEWORK_MIN_H, (resizeStartH.current ?? 540) + dy),
          )
          resizeFrameId.current = null
        } else if (resizeCardId.current) {
          const newW = Math.max(CARD_MIN_W, resizeStartW.current + dx)
          const newH = resizeStartH.current !== null
            ? Math.max(CARD_MIN_H, resizeStartH.current + dy)
            : Math.max(CARD_MIN_H, 160 + dy)
          brd.commitCardResize(resizeCardId.current, newW, newH)
        } else if (resizeTarget.current === 'textblock' && resizeTextId.current) {
          const newW = Math.max(TEXT_MIN_W, resizeStartW.current + (e.clientX - resizeStartX.current) / zoom)
          txtRef.current.commitBlockResize(resizeTextId.current, newW)
          resizeTextId.current = null
        }
        isResizing.current    = false
        resizeCardId.current  = null
        resizeFrameId.current = null
        resizeTarget.current  = 'card'
      }
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      if (moveRaf.current !== null) cancelAnimationFrame(moveRaf.current)
      moveRaf.current = null
      pendingMove.current = null
    }
  }, [brd, panX, panY, selectionRect, syncSlideGroupsAfterDrop, visibleCards, zoom])

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

      // Arrow key pan (with or without Ctrl — Ctrl+Arrow also pans)
      if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)) {
        if (e.metaKey) return  // let browser handle Cmd+arrow
        e.preventDefault()
        const step = e.shiftKey ? 100 : 20
        if (e.key === 'ArrowLeft')  panBoard(step, 0)
        if (e.key === 'ArrowRight') panBoard(-step, 0)
        if (e.key === 'ArrowUp')    panBoard(0, step)
        if (e.key === 'ArrowDown')  panBoard(0, -step)
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
        setAddFrameMenuOpen(false)
        setSelectedCardId(null)
        setSelectedCardIds([])
        setSelectedTileIds([])
        setSelectedFrameId(null)
        setModalOpen(false)
        setShowShortcuts(false)
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && !e.ctrlKey && !e.metaKey) {
        if (selectedBoardItemCount > 1 && !modalOpen) {
          e.preventDefault()
          deleteSelectedBoardItems()
          return
        }
        if (selectedCardId && !modalOpen) {
          const card = brd.cards.find(c => c.id === selectedCardId)
          if (!card || card.locked) return
          e.preventDefault()
          brd.removeCard(selectedCardId).then(() => showToast('Card deleted'))
          setSelectedCardId(null)
        }
        if (selectedFrameId) {
          e.preventDefault()
          frmRef.current.deleteFrame(selectedFrameId)
          setSelectedFrameId(null)
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
  }, [brd, deleteSelectedBoardItems, panBoard, screenToWorld, selectedBoardItemCount, selectedCardId, selectedCardIds, selectedFrameId, modalOpen])

  // ── Ctrl key for cursor ──────────────────────────────────────
  useEffect(() => {
    const setCursor = (c: string) => { if (canvasRef.current) canvasRef.current.style.cursor = c }
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Control') setCursor('move') }
    const onKeyUp   = (e: KeyboardEvent) => { if (e.key === 'Control') { lastCtrlPos.current = null; setCursor('crosshair') } }
    const onBlur = () => { lastCtrlPos.current = null; setCursor('crosshair') }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup',   onKeyUp)
    window.addEventListener('blur',    onBlur)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup',   onKeyUp)
      window.removeEventListener('blur',    onBlur)
    }
  }, [])

  // ── Ctrl+move canvas pan ─────────────────────────────────────
  // Registered once on window so it catches moves over cards too.
  // Guarded against drag/pan/resize so it never corrupts snap offsets.
  useEffect(() => {
    const onCtrlMove = (e: MouseEvent) => {
      if (!e.ctrlKey || e.buttons !== 0) {
        lastCtrlPos.current = null
        if (canvasRef.current) canvasRef.current.style.cursor = 'crosshair'
        return
      }
      if (lastCtrlPos.current) {
        const dx = e.clientX - lastCtrlPos.current.x
        const dy = e.clientY - lastCtrlPos.current.y
        setPanX(px => px + dx)
        setPanY(py => py + dy)
        if (canvasRef.current && (Math.abs(dx) > 1 || Math.abs(dy) > 1)) {
          canvasRef.current.style.cursor =
            Math.abs(dx) >= Math.abs(dy)
              ? (dx > 0 ? 'e-resize' : 'w-resize')
              : (dy > 0 ? 's-resize' : 'n-resize')
        }
      } else {
        if (canvasRef.current) canvasRef.current.style.cursor = 'move'
      }
      lastCtrlPos.current = { x: e.clientX, y: e.clientY }
    }
    window.addEventListener('mousemove', onCtrlMove)
    return () => window.removeEventListener('mousemove', onCtrlMove)
  }, []) // empty deps — only refs and stable setters used inside

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
    if (!worldRef.current || !exportBounds) {
      showToast('Nothing to export yet')
      return
    }
    setExporting(true)
    showToast('Generating board PDF…')
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
      ])
      const worldEl = worldRef.current
      const previous = {
        transform: worldEl.style.transform,
        width: worldEl.style.width,
        height: worldEl.style.height,
      }
      worldEl.style.transform = `translate(${-exportBounds.x}px, ${-exportBounds.y}px) scale(1)`
      worldEl.style.width = `${exportBounds.width}px`
      worldEl.style.height = `${exportBounds.height}px`

      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))

      const canvas = await html2canvas(worldEl, {
        scale: 1.5,
        backgroundColor: dark ? '#0D1B2E' : '#faf8f0',
        width: Math.ceil(exportBounds.width),
        height: Math.ceil(exportBounds.height),
        windowWidth: Math.ceil(exportBounds.width),
        windowHeight: Math.ceil(exportBounds.height),
        useCORS: true,
        logging: false,
      })

      worldEl.style.transform = previous.transform
      worldEl.style.width = previous.width
      worldEl.style.height = previous.height

      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'px', format: [canvas.width, canvas.height] })
      pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height)
      pdf.save(`${board.name}.pdf`)
      showToast('PDF downloaded ✓')
    } catch (err) {
      console.error('Export failed:', err)
      showToast('Export failed — try again')
    } finally {
      if (worldRef.current) {
        worldRef.current.style.transform = `translate(${panX}px,${panY}px) scale(${zoom})`
        worldRef.current.style.width = ''
        worldRef.current.style.height = ''
      }
      setExporting(false)
    }
  }

  // ── Full whiteboard JSON export ─────────────────────────────
  const exportWhiteboard = async () => {
    const slug = board.name.replace(/[^a-z0-9]/gi, '-').toLowerCase()
    const date = new Date().toISOString().slice(0, 10)
    showToast('Preparing whiteboard backup…')

    const slideImages: Record<string, string | null> = {}
    await Promise.all(sld.tiles.map(async tile => {
      try {
        slideImages[tile.id] = await getImage(tile.id)
      } catch {
        slideImages[tile.id] = null
      }
    }))

    const data = buildWhiteboardExport({
      board,
      cards: brd.cards,
      goalTags: brd.goalTags,
      frames: frm.frames,
      textBlocks: txt.blocks,
      slides: sld.tiles,
      slideImages,
    })
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${slug || 'whiteboard'}-whiteboard-${date}.json`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 100)
    showToast('Whiteboard backup exported ✓')
  }

  // ── JSON whiteboard import ──────────────────────────────────
  const importWhiteboardJson = async (files: FileList | null) => {
    if (!files || !files.length) return
    const file = files[0]
    try {
      const text = await file.text()
      const data = JSON.parse(text)
      const imported = buildWhiteboardImport({ data, targetBoardId: board.id })

      await brd.bulkImportCards(imported.cards)
      if (imported.kind === 'whiteboard') {
        const tagInserts: GoalTagInsert[] = imported.goalTags.map(tag => ({
          board_id: board.id,
          label: tag.label,
          bg: tag.bg,
          color: tag.color,
          x: tag.x,
          y: tag.y,
        }))
        await brd.bulkImportGoalTags(tagInserts)
        frmRef.current.importFrames(imported.frames)
        txtRef.current.addBlocks(imported.textBlocks)
        await Promise.all(Object.entries(imported.slideImages).map(([id, dataUrl]) => saveImage(id, dataUrl)))
        sldRef.current.addTiles(imported.slides)
        setTileImages(prev => ({ ...prev, ...imported.slideImages }))
      }

      if (imported.kind === 'cards') {
        showToast(`Imported ${imported.cards.length} card${imported.cards.length !== 1 ? 's' : ''} ✓`)
        return
      }
      const count =
        imported.cards.length +
        imported.goalTags.length +
        imported.frames.length +
        imported.textBlocks.length +
        imported.slides.length
      showToast(`Imported whiteboard backup (${count} item${count !== 1 ? 's' : ''}) ✓`)
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
  const sbBg   = dark ? colors.sidebar : '#172038'
  const topBg  = dark ? 'rgba(16,24,42,.96)' : 'rgba(255,255,255,.96)'
  const topBdr = dark ? colors.borderDark : colors.borderLight
  const subC   = dark ? '#AAB5C9' : '#5F687B'
  const cvBg   = dark ? colors.canvasDark : colors.canvasLight
  const dotClr = dark ? '#30405E' : '#C1C4CC'

  if (brd.loading) return <Centered dark={dark}>Loading your workspace...</Centered>
  if (brd.error)   return <Centered dark={dark} error>{brd.error}</Centered>

  return (
    <div className="ib-board-shell" data-theme={dark ? 'dark' : 'light'} style={{ fontFamily: fonts.ui }}>

      {/* ── SIDEBAR ── */}
      <aside className="ib-board-sidebar" style={{ width: 68, background: sbBg, borderRight: '2px solid rgba(255,255,255,.08)', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '14px 0', gap: 2, flexShrink: 0, zIndex: 100 }}>
        <div className="ib-logo" style={{ width: 36, height: 36, marginBottom: 12 }}>I</div>

        <SbBtn title="Back to boards" onClick={onBack} dark={dark}>
          <ArrowLeft size={17} />
        </SbBtn>

        <div style={{ width: 28, height: 1, background: '#1A1A22', margin: '4px 0' }}/>

        <SbBtn title="New Card (N)" onClick={() => { const cr = canvasRef.current?.getBoundingClientRect(); if (cr) { newCardWorld.current = screenToWorld(cr.left + cr.width/2, cr.top + cr.height/2); setEditingCard(null); setModalOpen(true) } }} dark={dark}>
          <SquarePlus size={17} />
        </SbBtn>

        <SbBtn title="Fit all cards in view" onClick={fitAll} dark={dark}>
          <Maximize2 size={17} />
        </SbBtn>

        <SbBtn title="Reset to 100%" onClick={() => { setPanX(0); setPanY(0); setZoom(1) }} dark={dark}>
          <Search size={17} />
        </SbBtn>

        <div style={{ width: 28, height: 1, background: '#1A1A22', margin: '4px 0' }}/>

        <SbBtn title="Export as PDF" onClick={exportPDF} dark={dark}>
          <Download size={17} />
        </SbBtn>

        <SbBtn title="Export full whiteboard as JSON backup" onClick={exportWhiteboard} dark={dark}>
          <Download size={17} />
        </SbBtn>

        <SbBtn title="Import PDF" onClick={() => pdfInputRef.current?.click()} dark={dark}>
          <FolderInput size={17} />
        </SbBtn>
        <input
          ref={pdfInputRef}
          type="file"
          accept=".pdf"
          multiple
          style={{ display: 'none' }}
          onChange={e => { handleImportPdf(e.target.files); e.target.value = '' }}
        />

        <SbBtn title="Import JSON backup" onClick={() => jsonInputRef.current?.click()} dark={dark}>
          <Upload size={17} />
        </SbBtn>
        <input
          ref={jsonInputRef}
          type="file"
          accept=".json"
          style={{ display: 'none' }}
          onChange={e => { importWhiteboardJson(e.target.files); e.target.value = '' }}
        />

        <SbBtn title="Undo (Ctrl+Z)" onClick={() => { brd.undo(); showToast('Undone ↩') }} dark={dark}>
          <Undo2 size={17} />
        </SbBtn>

        <SbBtn title="Bulk delete items" onClick={() => setBulkDeleteOpen(true)} dark={dark}>
          <Trash2 size={17} />
        </SbBtn>

        <div style={{ width: 28, height: 1, background: '#1A1A22', margin: '4px 0' }}/>

        <div ref={addFrameBtnRef} style={{ position: 'relative' }}>
          <SbBtn title="Add Frame" onClick={() => setAddFrameMenuOpen(o => !o)} dark={dark}>
            <Workflow size={17} />
          </SbBtn>
          {addFrameMenuOpen && (() => {
            const rect = addFrameBtnRef.current?.getBoundingClientRect()
            return (
              <>
                <div style={{ position: 'fixed', inset: 0, zIndex: 998 }} onClick={() => setAddFrameMenuOpen(false)} />
                <div style={{
                  position: 'fixed',
                  left: 76,
                  top: rect ? Math.min(rect.top, window.innerHeight - 420) : 200,
                  zIndex: 999,
                  background: dark ? '#152336' : 'white',
                  border: `1px solid ${dark ? '#1E3451' : '#ddd'}`,
                  borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,.18)',
                  minWidth: 200, maxHeight: 400, overflowY: 'auto',
                }}>
                  <div style={{ padding: '8px 14px 4px', fontSize: 10, fontWeight: 700, color: dark ? '#666' : '#aaa', letterSpacing: '0.08em' }}>ADD FRAME</div>
                  {FRAMEWORK_GROUPS.map((entry, i) =>
                    'sep' in entry ? (
                      <div key={entry.sep + i} style={{ padding: '7px 14px 2px', fontSize: 8, letterSpacing: '0.1em', color: dark ? '#555' : '#aaa', fontWeight: 700 }}>
                        {entry.sep}
                      </div>
                    ) : (
                      <button
                        key={entry.key}
                        onClick={() => {
                          const cr = canvasRef.current?.getBoundingClientRect()
                          if (!cr) return
                          frm.addFrame(entry.key!, cr.width / 2, cr.height / 2, zoom, panX, panY)
                          setAddFrameMenuOpen(false)
                        }}
                        style={{
                          display: 'block', width: '100%', padding: '9px 14px',
                          border: 'none', background: 'transparent', cursor: 'pointer',
                          textAlign: 'left', fontSize: 12, fontWeight: 500,
                          color: dark ? '#ddd' : '#152336',
                          fontFamily: "'DM Sans',sans-serif",
                        }}
                      >
                        {FRAMEWORK_LABELS[entry.key!]}
                      </button>
                    )
                  )}
                </div>
              </>
            )
          })()}
        </div>

        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 28, height: 1, background: '#1A1A22', marginBottom: 4 }}/>
          <SbBtn title="Toggle dark mode" onClick={onToggleDark} dark={dark}>
            {dark ? <Sun size={17} /> : <Moon size={17} />}
          </SbBtn>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#6C63FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, color: 'white', border: `2px solid ${dark ? '#1A1A22' : '#1E3451'}` }}>
            {user.email?.[0]?.toUpperCase() ?? 'U'}
          </div>
        </div>
      </aside>

      {/* ── MAIN ── */}
      <div className="ib-board-main">

        {/* Topbar */}
        <div className="ib-board-header" style={{ background: topBg, borderColor: topBdr }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
            <span style={{ fontSize: 11, color: subC, fontFamily: fonts.ui }}>Boards /</span>
            <span className="ib-board-title" style={{ color: dark ? '#F7F7F2' : colors.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{board.name}</span>
            <span className="ib-board-status">Saved locally</span>
          </div>

          <div style={{ flex: 1 }}/>
          <div className="ib-board-header-actions">
          <button
            onClick={() => setShowBoardPanel(open => !open)}
            title={showBoardPanel ? 'Hide find board items' : 'Show find board items'}
            aria-label={showBoardPanel ? 'Hide find board items' : 'Show find board items'}
            className="ib-icon-button"
          >
            <Search size={15} />
          </button>
          <button
            onClick={() => {
              const cr = canvasRef.current?.getBoundingClientRect()
              if (!cr) return
              const cx = (cr.width  / 2 - panX) / zoom
              const cy = (cr.height / 2 - panY) / zoom
              txtRef.current.addBlock({
                id: crypto.randomUUID(),
                board_id: board.id,
                html: '',
                x: cx - 130,
                y: cy - 40,
                width: 260,
                created_at: new Date().toISOString(),
              })
            }}
            className="ib-action"
          >
            <Type size={14} /> Add text
          </button>
          <button className="ib-action ib-action-primary" onClick={() => { const cr = canvasRef.current?.getBoundingClientRect(); if (cr) { newCardWorld.current = screenToWorld(cr.left + cr.width/2, cr.top + cr.height/2); setEditingCard(null); setModalOpen(true) } }}>
            <SquarePlus size={15} /> Add card
          </button>
          </div>
        </div>

        <div className="ib-quick-add" aria-label="Quick add">
          <button type="button" onClick={() => { const cr = canvasRef.current?.getBoundingClientRect(); if (cr) { newCardWorld.current = screenToWorld(cr.left + cr.width / 2, cr.top + cr.height / 2); setEditingCard(null); setModalOpen(true) } }}>
            <Plus size={13} /> Note
          </button>
          <button type="button" onClick={() => {
            const cr = canvasRef.current?.getBoundingClientRect()
            if (!cr) return
            const cx = (cr.width / 2 - panX) / zoom
            const cy = (cr.height / 2 - panY) / zoom
            txtRef.current.addBlock({ id: crypto.randomUUID(), board_id: board.id, html: '', x: cx - 130, y: cy - 40, width: 260, created_at: new Date().toISOString() })
          }}>
            <Type size={13} /> Text
          </button>
          <button type="button" onClick={() => setAddFrameMenuOpen(true)}>
            <Workflow size={13} /> Frame
          </button>
        </div>

        {selectedBoardItemCount > 1 && (
          <div style={{
            position: 'absolute',
            top: 62,
            left: 18,
            zIndex: 80,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '9px 10px',
            borderRadius: 10,
            background: dark ? '#152336' : 'white',
            border: `1px solid ${dark ? '#1E3451' : '#e8e4d9'}`,
            boxShadow: '0 8px 24px rgba(0,0,0,.16)',
            color: dark ? '#F0EEE8' : '#263D5B',
            fontFamily: fonts.ui,
          }}>
            <span style={{ fontSize: 12, fontWeight: 900 }}>{selectedBoardItemCount} selected</span>
            {selectedCardIds.length > 1 && <button onClick={duplicateSelectedCards} style={{ height: 28, padding: '0 10px', borderRadius: 7, border: `1px solid ${dark ? '#1E3451' : '#ddd'}`, background: 'transparent', color: 'inherit', cursor: 'pointer', fontSize: 12 }}>Duplicate cards</button>}
            {selectedTileIds.length > 0 && <button onClick={createSlideGroupFromSelection} style={{ height: 28, padding: '0 10px', borderRadius: 7, border: `1px solid ${dark ? '#49B6E5' : '#49B6E5'}`, background: 'transparent', color: 'inherit', cursor: 'pointer', fontSize: 12 }}>Group slides</button>}
            <button onClick={deleteSelectedBoardItems} style={{ height: 28, padding: '0 10px', borderRadius: 7, border: 'none', background: '#D64545', color: 'white', cursor: 'pointer', fontSize: 12 }}>Delete</button>
            <select
              title="Assign tag"
              defaultValue=""
              onChange={e => { if (e.target.value) updateSelectedCards({ tag: e.target.value as TagType }); e.currentTarget.value = '' }}
              style={{ height: 28, borderRadius: 7, border: `1px solid ${dark ? '#1E3451' : '#ddd'}`, background: dark ? '#0D1B2E' : 'white', color: 'inherit', fontSize: 12 }}
            >
              <option value="">Tag</option>
              {(['idea','critical','planned','delegate','remove','done'] as TagType[]).map(tag => <option key={tag} value={tag}>{tag}</option>)}
            </select>
            <select
              title="Recolor"
              defaultValue=""
              onChange={e => { if (e.target.value) updateSelectedCards({ bg: e.target.value }); e.currentTarget.value = '' }}
              style={{ height: 28, borderRadius: 7, border: `1px solid ${dark ? '#1E3451' : '#ddd'}`, background: dark ? '#0D1B2E' : 'white', color: 'inherit', fontSize: 12 }}
            >
              <option value="">Color</option>
              {COLOUR_SWATCHES.map(sw => <option key={sw.value} value={sw.value}>{sw.label}</option>)}
            </select>
            <button onClick={() => { setSelectedCardIds([]); setSelectedTileIds([]); setSelectedCardId(null) }} style={{ width: 28, height: 28, borderRadius: 7, border: `1px solid ${dark ? '#1E3451' : '#ddd'}`, background: 'transparent', color: 'inherit', cursor: 'pointer' }}>×</button>
          </div>
        )}

        {/* ── CANVAS ── */}
        <div
          ref={canvasRef}
          onMouseDown={onCanvasMouseDown}
          onContextMenu={e => e.preventDefault()}
          onDoubleClick={onCanvasDblClick}
          onWheel={onWheel}
          style={{
            position: 'absolute', inset: '50px 0 0 0',
            overflow: 'hidden',
            backgroundColor: cvBg,
            backgroundImage: `radial-gradient(circle, ${dotClr} 1px, transparent 1px)`,
            backgroundSize: `${24 * zoom}px ${24 * zoom}px`,
            backgroundPosition: `${panX % (24 * zoom)}px ${panY % (24 * zoom)}px`,
            cursor: 'crosshair',
          }}
        >
          {brd.cards.length === 0 && (
            <div className="ib-empty-board" role="status">
              <strong>What are we trying to solve?</strong>
              <span>Start with one thought. You can shape it later.</span>
              <button className="ib-action ib-action-primary" type="button" onClick={() => { const cr = canvasRef.current?.getBoundingClientRect(); if (cr) { newCardWorld.current = screenToWorld(cr.left + cr.width / 2, cr.top + cr.height / 2); setEditingCard(null); setModalOpen(true) } }}>
                <Plus size={14} /> Add your first idea
              </button>
            </div>
          )}
          {/* THE WORLD */}
          <div ref={worldRef}
            style={{ position: 'absolute', left: 0, top: 0, transformOrigin: '0 0', transform: `translate(${panX}px,${panY}px) scale(${zoom})` }}>

            {/* Frame overlays */}
            {frm.frames.map(frame => (
              <FrameworkOverlay
                key={frame.id}
                frame={frame}
                dark={dark}
                selected={selectedFrameId === frame.id}
                onMoveStart={onFrameMoveStart}
                onResizeStart={onFrameResizeStart}
                onDelete={id => { frmRef.current.deleteFrame(id); setSelectedFrameId(null) }}
                onSelect={setSelectedFrameId}
                onTypeChange={(id, type) => frmRef.current.changeFrameType(id, type)}
                onRename={(id, name) => frmRef.current.renameFrame(id, name)}
                onUpdateNotes={(id, notes) => frmRef.current.updateFrameNotes(id, notes)}
                onUpdateNoteArea={(id, areaId, notes) => frmRef.current.updateFrameNoteArea(id, areaId, notes)}
              />
            ))}

            {/* Slide groups */}
            {slideGroupViews.map(({ group, bounds, tiles }) => bounds && (
              <div
                key={group.id}
                className="world-item"
                style={{
                  position: 'absolute',
                  left: bounds.x,
                  top: bounds.y,
                  width: bounds.width,
                  height: bounds.height,
                  borderRadius: 10,
                  border: `2px dashed ${dark ? '#49B6E5' : '#263D5B'}`,
                  background: dark ? 'rgba(73,182,229,0.06)' : 'rgba(73,182,229,0.07)',
                  boxSizing: 'border-box',
                  pointerEvents: 'none',
                  zIndex: 5,
                }}
              >
                <div style={{
                  position: 'absolute',
                  top: 8,
                  left: 10,
                  right: 10,
                  height: 24,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  pointerEvents: 'auto',
                  fontFamily: fonts.ui,
                  color: dark ? '#E8F4FF' : '#263D5B',
                }}>
                  <strong style={{ fontSize: 12 }}>{group.name}</strong>
                  <span style={{ fontSize: 11, opacity: .7 }}>{tiles.length} slide{tiles.length !== 1 ? 's' : ''}</span>
                  <button
                    onMouseDown={e => e.stopPropagation()}
                    onClick={() => { setFocusGroupId(group.id); setFocusSlideIndex(0) }}
                    style={{ marginLeft: 'auto', height: 22, padding: '0 8px', borderRadius: 7, border: 'none', background: '#49B6E5', color: 'white', fontSize: 11, cursor: 'pointer', fontWeight: 800 }}
                  >Focus</button>
                </div>
              </div>
            ))}

            {/* Slide tiles */}
            {sld.tiles.map(tile => (
              <SlideTile
                key={tile.id}
                tile={tile}
                imageUrl={tileImages[tile.id] ?? null}
                dark={dark}
                dragging={draggingTileId === tile.id}
                selected={selectedTileIds.includes(tile.id)}
                onMoveStart={onTileMoveStart}
                onDelete={handleDeleteTile}
              />
            ))}

            {/* Text blocks */}
            {txt.blocks.map(block => (
              <TextBlockItem
                key={block.id}
                block={block}
                dark={dark}
                onMoveStart={onTextMoveStart}
                onUpdateHtml={(id, html) => txtRef.current.updateBlockHtml(id, html)}
                onResizeStart={onTextResizeStart}
                onRemove={id => txtRef.current.removeBlock(id)}
              />
            ))}

            {/* Cards */}
            {visibleCards.map(card => (
              <div key={card.id} className="world-item">
                <IdeaCard
                  card={card} dark={dark}
                  onMoveStart={onCardMoveStart}
                  onResizeStart={onResizeStart}
                  onEdit={openEdit}
                  onDelete={async id => {
                    if (id === selectedCardId) setSelectedCardId(null)
                    setSelectedCardIds(prev => prev.filter(cardId => cardId !== id))
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
                style={{ position:'absolute', left:tag.x, top:tag.y, borderRadius:20, border:'2px solid #152336', padding:'7px 14px', fontFamily:"'Syne',sans-serif", fontSize:12, fontWeight:700, cursor:'grab', boxShadow:'3px 3px 0 #152336', zIndex:20, display:'flex', alignItems:'center', gap:6, whiteSpace:'nowrap', background:tag.bg, color:tag.color, userSelect:'none' }}
              >
                {tag.label}
                <button className="no-drag"
                  onClick={e => { e.stopPropagation(); brd.removeGoalTag(tag.id).then(() => showToast('Tag deleted')) }}
                  onMouseDown={e => e.stopPropagation()}
                  style={{ width:16,height:16,borderRadius:'50%',background:'rgba(0,0,0,.12)',border:'none',cursor:'pointer',fontSize:11,display:'flex',alignItems:'center',justifyContent:'center',color:'inherit' }}
                >×</button>
              </div>
            ))}

            {selectionRect && (() => {
              const rect = normalizeSelectionRect(selectionRect)
              return (
                <div style={{
                  position: 'absolute',
                  left: rect.x,
                  top: rect.y,
                  width: rect.width,
                  height: rect.height,
                  border: '1.5px solid #49B6E5',
                  background: 'rgba(73,182,229,.10)',
                  pointerEvents: 'none',
                  zIndex: 18,
                }} />
              )
            })()}

            {selectedCards.map(card => (
              <div key={`multi-${card.id}`} style={{
                position: 'absolute',
                left: card.x - 6,
                top: card.y - 6,
                width: (card.card_width ?? 185) + 12,
                height: (card.card_height ?? (card.collapsed ? 54 : 160)) + 12,
                border: '2px solid #6C63FF',
                borderRadius: 18,
                pointerEvents: 'none',
                zIndex: 21,
                boxSizing: 'border-box',
                boxShadow: '0 0 0 3px rgba(108,99,255,.16)',
                transform: card.rotation ? `rotate(${card.rotation}deg)` : undefined,
                transformOrigin: 'top left',
              }} />
            ))}

            {/* Snap ghost — cards */}
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
            {/* Snap ghost — text blocks */}
            {snapGhost && dragTextId.current && (() => {
              const block = txt.blocks.find(b => b.id === dragTextId.current)
              if (!block) return null
              return (
                <div style={{
                  position: 'absolute',
                  left: snapGhost.x,
                  top: snapGhost.y,
                  width: block.width,
                  minHeight: TEXT_HEIGHT_ESTIMATE,
                  border: '2px dashed #49B6E5',
                  borderRadius: 8,
                  background: 'rgba(73,182,229,0.08)',
                  pointerEvents: 'none',
                  zIndex: 19,
                  boxSizing: 'border-box',
                }} />
              )
            })()}

            {/* Selection ring */}
            {selectedCardId && (() => {
              const card = visibleCards.find(c => c.id === selectedCardId)
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
          <div style={{ position:'absolute', right:18, bottom:22, display:'flex', flexDirection:'column', gap:1, background: dark?colors.surfaceDark:'white', borderRadius:9, border:`2px solid ${dark?colors.borderDark:colors.ink}`, overflow:'hidden', boxShadow:'3px 4px 0 rgba(23,32,56,.14)', zIndex:50 }}>
            {[
              { label: 'Zoom in', icon: <ZoomIn size={14} />, factor: 1.2 },
              { label: 'Zoom out', icon: <ZoomOut size={14} />, factor: 0.8 },
            ].map(({ label, icon, factor }) => (
              <button key={label} aria-label={label} title={label} onClick={() => {
                const nz = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom * factor))
                const cr = canvasRef.current!.getBoundingClientRect()
                const cx = cr.width/2, cy = cr.height/2
                setPanX(px => cx-(cx-px)*(nz/zoom)); setPanY(py => cy-(cy-py)*(nz/zoom)); setZoom(nz)
              }} style={{ width:34,height:34,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',color:dark?'#F7F7F2':colors.ink,background:'none',border:'none' }}>{icon}</button>
            ))}
            <div style={{ height:1, background: dark?colors.borderDark:colors.borderLight }}/>
            <div style={{ width:34,height:26,display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,color:dark?'#666':'#888',fontFamily:"'Delius Swash Caps',cursive" }}>{Math.round(zoom*100)}%</div>
            <div style={{ height:1, background: dark?colors.borderDark:colors.borderLight }}/>
            <button onClick={() => { setPanX(0); setPanY(0); setZoom(1) }} aria-label="Reset zoom to 100 percent" title="Reset zoom" style={{ width:34,height:24,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',fontSize:9,color:dark?'#AAB5C9':'#5F687B',background:'none',border:'none' }}>1:1</button>
          </div>

          {/* Shortcuts hint button */}
          <button
            onClick={() => setShowShortcuts(s => !s)}
            title="Keyboard shortcuts (?)"
            aria-label="Toggle keyboard shortcuts"
            style={{ position:'absolute', right:18, bottom:160, width:34, height:34, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color: dark?'#F7F7F2':colors.ink, background: dark?colors.surfaceDark:'white', borderRadius:9, border:`2px solid ${dark?colors.borderDark:colors.ink}`, boxShadow:'3px 4px 0 rgba(23,32,56,.14)', zIndex:50 }}
          ><CircleHelp size={16} /></button>

          {/* Minimap */}
          <div style={{ position:'absolute', right:62, bottom:22, width:110, height:74, background: dark?'#152336':'white', borderRadius:9, border:`1px solid ${dark?'#1E3451':'rgba(0,0,0,.1)'}`, boxShadow:'0 2px 8px rgba(0,0,0,.1)', overflow:'hidden', zIndex:50, opacity:.85 }}>
            <div style={{ width:'100%',height:'100%',background: dark?'#0D1B2E':'#f0ede5',position:'relative' }}>
              {[['12%','8%','#D4EDD8'],['52%','8%','#FFF3B0'],['12%','52%','#FFD6C2'],['52%','52%','#E8E0F5']].map(([l,t,bg],i)=>(
                <div key={i} style={{ position:'absolute',left:l,top:t,width:'36%',height:'40%',background:bg,border:'1px solid rgba(0,0,0,.1)',borderRadius:3,opacity: dark?.5:1 }}/>
              ))}
              <div style={{ position:'absolute',inset:'5%',border:'1.5px solid #6C63FF',borderRadius:3,pointerEvents:'none' }}/>
            </div>
          </div>

          {/* World coords */}
          <div style={{ position:'absolute',left:18,bottom:22,fontSize:10,color:dark?'#444':subC,fontFamily:"'JetBrains Mono',monospace",background: dark?'rgba(26,26,36,.8)':'rgba(255,255,255,.8)',padding:'3px 8px',borderRadius:6,border:`1px solid ${dark?'#1E3451':'rgba(0,0,0,.06)'}` }}>
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

      {/* ── SEARCH + OUTLINE ── */}
      {showBoardPanel && (
      <aside style={{
        width: 306,
        flexShrink: 0,
        background: dark ? '#101F34' : '#fffdf7',
        borderLeft: `1px solid ${dark ? '#1E3451' : '#e8e4d9'}`,
        display: 'flex',
        flexDirection: 'column',
        color: dark ? '#F0EEE8' : '#263D5B',
        zIndex: 80,
      }}>
        <div style={{ padding: '14px 14px 12px', borderBottom: `1px solid ${dark ? '#1E3451' : '#e8e4d9'}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <div style={{ fontFamily: fonts.display, fontWeight: 800, fontSize: 14 }}>Find Board Items</div>
            <div style={{ flex: 1 }} />
            <button
              onClick={() => setShowBoardPanel(false)}
              style={{ height: 26, padding: '0 9px', borderRadius: 7, border: `1px solid ${dark ? '#1E3451' : '#ddd'}`, background: dark ? '#0D1B2E' : 'white', color: dark ? '#DCE8F5' : '#263D5B', cursor: 'pointer', fontSize: 11, fontWeight: 800 }}
            >
              Hide
            </button>
          </div>
          <div style={{ position: 'relative', marginBottom: 10 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', left: 10, top: 9, color: dark ? '#8EA5C0' : '#77879A' }}>
              <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
            </svg>
            <input
              value={boardSearch}
              onChange={e => setBoardSearch(e.target.value)}
              placeholder="Search cards, tags, dates..."
              style={{
                width: '100%',
                height: 34,
                padding: '0 10px 0 32px',
                borderRadius: 8,
                border: `1px solid ${dark ? '#1E3451' : '#ddd8ca'}`,
                background: dark ? '#0D1B2E' : 'white',
                color: dark ? '#F0EEE8' : '#263D5B',
                outline: 'none',
                boxSizing: 'border-box',
                fontFamily: fonts.ui,
                fontSize: 12,
              }}
            />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, marginBottom: 8, color: dark ? '#C8D7EA' : '#465F7C', cursor: 'pointer' }}>
            <input type="checkbox" checked={hideDoneRemove} onChange={e => setHideDoneRemove(e.target.checked)} style={{ accentColor: '#49B6E5' }} />
            Hide done/remove cards
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: dark ? '#C8D7EA' : '#465F7C', cursor: 'pointer' }}>
            <input type="checkbox" checked={overdueOnly} onChange={e => setOverdueOnly(e.target.checked)} style={{ accentColor: '#49B6E5' }} />
            Show overdue cards only
          </label>
          <div style={{ marginTop: 11, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
            {[
              ['Cards', visibleCards.length, '#49B6E5'],
              ['Text', txt.blocks.length, '#A78BFA'],
              ['Slides', sld.tiles.length, '#F59E0B'],
            ].map(([label, count, color]) => (
              <div key={label} style={{ border: `1px solid ${dark ? '#1E3451' : '#e8e4d9'}`, borderRadius: 7, padding: '7px 6px', background: dark ? '#0D1B2E' : '#faf8f0' }}>
                <div style={{ fontSize: 9, color: dark ? '#8EA5C0' : '#77879A', fontWeight: 800, textTransform: 'uppercase' }}>{label}</div>
                <div style={{ fontSize: 15, color: color as string, fontWeight: 900, marginTop: 1 }}>{count}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ padding: '12px 14px 8px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: '.08em', textTransform: 'uppercase', color: dark ? '#8EA5C0' : '#77879A' }}>Outline</div>
          <div style={{ flex: 1, height: 1, background: dark ? '#1E3451' : '#e8e4d9' }} />
          <div style={{ fontSize: 11, color: dark ? '#8EA5C0' : '#77879A' }}>{outlineItems.length}</div>
        </div>

        <div style={{ overflow: 'auto', padding: '0 10px 14px', display: 'grid', gap: 6 }}>
          {outlineItems.length === 0 ? (
            <div style={{ padding: 18, textAlign: 'center', fontSize: 12, color: dark ? '#8EA5C0' : '#77879A' }}>No matching board items</div>
          ) : outlineItems.map(item => {
            const chip = item.kind === 'card' ? '#49B6E5'
              : item.kind === 'text' ? '#A78BFA'
              : item.kind === 'slide' ? '#F59E0B'
              : item.kind === 'frame' ? '#22C55E'
              : '#EF4444'
            return (
              <button
                key={item.key}
                onClick={() => jumpToItem(item)}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '8px 1fr',
                  gap: 9,
                  alignItems: 'center',
                  textAlign: 'left',
                  border: `1px solid ${dark ? '#1E3451' : '#e8e4d9'}`,
                  background: dark ? '#0D1B2E' : 'white',
                  color: 'inherit',
                  borderRadius: 8,
                  padding: '9px 10px',
                  cursor: 'pointer',
                  fontFamily: fonts.ui,
                }}
              >
                <span style={{ width: 8, height: 8, borderRadius: 99, background: chip }} />
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 12, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label}</span>
                  <span style={{ display: 'block', fontSize: 10, color: dark ? '#8EA5C0' : '#77879A', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.detail}</span>
                </span>
              </button>
            )
          })}
        </div>
      </aside>
      )}

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
            background: dark ? '#152336' : 'white',
            border: `1px solid ${dark ? '#1E3451' : '#ddd'}`,
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

      {bulkDeleteOpen && (
        <div
          role="dialog"
          aria-modal={true}
          aria-label="Bulk delete"
          style={{ position: 'fixed', inset: 0, zIndex: 1800, background: 'rgba(0,0,0,.42)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
          onMouseDown={e => {
            if (e.target === e.currentTarget) setBulkDeleteOpen(false)
          }}
        >
          <div style={{
            width: 'min(680px, 92vw)',
            maxHeight: 'min(720px, 86vh)',
            background: dark ? '#152336' : '#fff',
            color: dark ? '#F0EEE8' : '#263D5B',
            border: `1px solid ${dark ? '#1E3451' : '#e8e4d9'}`,
            borderRadius: 10,
            boxShadow: '0 24px 80px rgba(0,0,0,.35)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            fontFamily: fonts.ui,
          }}>
            <div style={{ padding: '16px 18px', borderBottom: `1px solid ${dark ? '#1E3451' : '#e8e4d9'}`, display: 'flex', alignItems: 'center', gap: 12 }}>
              <div>
                <div style={{ fontFamily: fonts.display, fontSize: 17, fontWeight: 700 }}>Bulk Delete</div>
                <div style={{ fontSize: 12, color: dark ? '#8EA5C0' : '#77879A', marginTop: 3 }}>
                  Select imported slides or other board items to delete together.
                </div>
              </div>
              <div style={{ flex: 1 }} />
              <button
                onClick={() => setBulkDeleteOpen(false)}
                aria-label="Close bulk delete"
                style={{ width: 30, height: 30, borderRadius: 6, border: 'none', background: dark ? '#0D1B2E' : '#f2f0e8', color: 'inherit', cursor: 'pointer', fontSize: 18 }}
              >×</button>
            </div>

            <div style={{ padding: 14, overflow: 'auto' }}>
              {bulkDeleteItems.length === 0 ? (
                <div style={{ padding: 28, textAlign: 'center', color: dark ? '#8EA5C0' : '#77879A', fontSize: 13 }}>
                  Nothing on this board can be deleted yet.
                </div>
              ) : (
                ([
                  ['slide', 'Imported Slides'],
                  ['card', 'Cards'],
                  ['text', 'Text Blocks'],
                  ['frame', 'Frames'],
                  ['tag', 'Goal Tags'],
                ] as Array<[BulkDeleteItem['kind'], string]>).map(([kind, title]) => {
                  const entries = bulkDeleteItems.filter(item => item.kind === kind)
                  if (!entries.length) return null
                  const selectedCount = entries.filter(item => bulkDeleteSelection[item.key]).length
                  return (
                    <section key={kind} style={{ marginBottom: 14 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 7 }}>
                        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: dark ? '#8EA5C0' : '#77879A' }}>
                          {title} · {selectedCount}/{entries.length}
                        </div>
                        <div style={{ flex: 1, height: 1, background: dark ? '#1E3451' : '#e8e4d9' }} />
                        <button
                          onClick={() => setBulkKind(kind, true)}
                          style={{ border: 'none', background: 'transparent', color: '#49B6E5', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}
                        >Select all</button>
                        <button
                          onClick={() => setBulkKind(kind, false)}
                          style={{ border: 'none', background: 'transparent', color: dark ? '#8EA5C0' : '#77879A', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}
                        >Clear</button>
                      </div>
                      <div style={{ display: 'grid', gap: 6 }}>
                        {entries.map(item => (
                          <label
                            key={item.key}
                            style={{
                              display: 'grid',
                              gridTemplateColumns: '18px 1fr',
                              gap: 10,
                              alignItems: 'center',
                              padding: '9px 10px',
                              borderRadius: 8,
                              border: `1px solid ${bulkDeleteSelection[item.key] ? '#49B6E5' : (dark ? '#1E3451' : '#e8e4d9')}`,
                              background: bulkDeleteSelection[item.key]
                                ? (dark ? 'rgba(73,182,229,.12)' : 'rgba(73,182,229,.10)')
                                : (dark ? '#0D1B2E' : '#faf8f0'),
                              cursor: 'pointer',
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={!!bulkDeleteSelection[item.key]}
                              onChange={() => toggleBulkItem(item.key)}
                              style={{ width: 15, height: 15, accentColor: '#49B6E5' }}
                            />
                            <span>
                              <span style={{ display: 'block', fontSize: 13, fontWeight: 700, color: dark ? '#F0EEE8' : '#263D5B' }}>{item.label}</span>
                              <span style={{ display: 'block', fontSize: 11, color: dark ? '#8EA5C0' : '#77879A', marginTop: 2 }}>{item.detail}</span>
                            </span>
                          </label>
                        ))}
                      </div>
                    </section>
                  )
                })
              )}
            </div>

            <div style={{ padding: '13px 18px', borderTop: `1px solid ${dark ? '#1E3451' : '#e8e4d9'}`, display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 12, color: dark ? '#8EA5C0' : '#77879A' }}>
                {selectedBulkItems.length} selected
              </span>
              <div style={{ flex: 1 }} />
              <button
                onClick={clearBulkDelete}
                disabled={!selectedBulkItems.length}
                style={{ height: 34, padding: '0 12px', borderRadius: 7, border: `1px solid ${dark ? '#1E3451' : '#ddd'}`, background: 'transparent', color: dark ? '#DCE8F5' : '#263D5B', cursor: selectedBulkItems.length ? 'pointer' : 'not-allowed', opacity: selectedBulkItems.length ? 1 : .5 }}
              >Clear selection</button>
              <button
                onClick={deleteSelectedBulkItems}
                disabled={!selectedBulkItems.length}
                style={{ height: 34, padding: '0 14px', borderRadius: 7, border: 'none', background: selectedBulkItems.length ? '#D64545' : '#999', color: 'white', cursor: selectedBulkItems.length ? 'pointer' : 'not-allowed', fontWeight: 800 }}
              >Delete selected</button>
            </div>
          </div>
        </div>
      )}

      {focusGroup && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 1900, background: dark ? 'rgba(4,10,18,.92)' : 'rgba(20,28,38,.86)', display: 'flex', flexDirection: 'column', padding: 24, boxSizing: 'border-box' }}
          onMouseDown={e => e.stopPropagation()}
        >
          <div style={{ height: 42, display: 'flex', alignItems: 'center', gap: 12, color: 'white', fontFamily: fonts.ui }}>
            <strong style={{ fontSize: 16 }}>{focusGroup.name}</strong>
            <span style={{ fontSize: 12, opacity: .75 }}>{focusSlides.length ? focusSlideIndex + 1 : 0}/{focusSlides.length}</span>
            <button onClick={() => setFocusSlideIndex(i => Math.max(0, i - 1))} disabled={focusSlideIndex <= 0} style={{ marginLeft: 'auto', height: 30, padding: '0 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,.25)', background: 'transparent', color: 'white', cursor: focusSlideIndex <= 0 ? 'not-allowed' : 'pointer', opacity: focusSlideIndex <= 0 ? .5 : 1 }}>Prev</button>
            <button onClick={() => setFocusSlideIndex(i => Math.min(focusSlides.length - 1, i + 1))} disabled={focusSlideIndex >= focusSlides.length - 1} style={{ height: 30, padding: '0 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,.25)', background: 'transparent', color: 'white', cursor: focusSlideIndex >= focusSlides.length - 1 ? 'not-allowed' : 'pointer', opacity: focusSlideIndex >= focusSlides.length - 1 ? .5 : 1 }}>Next</button>
            <button onClick={() => setFocusGroupId(null)} style={{ height: 30, padding: '0 12px', borderRadius: 8, border: 'none', background: '#49B6E5', color: 'white', cursor: 'pointer', fontWeight: 800 }}>Close</button>
          </div>
          <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {focusSlides[focusSlideIndex] && tileImages[focusSlides[focusSlideIndex].id] ? (
              <img
                src={tileImages[focusSlides[focusSlideIndex].id]}
                alt={`${focusSlides[focusSlideIndex].filename} p.${focusSlides[focusSlideIndex].page_number}`}
                style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', boxShadow: '0 20px 60px rgba(0,0,0,.35)', borderRadius: 8 }}
                draggable={false}
              />
            ) : (
              <div style={{ color: 'white', fontFamily: fonts.ui, opacity: .75 }}>No slide preview available</div>
            )}
          </div>
        </div>
      )}

      {toast && (
        <div style={{ position:'fixed',bottom:24,left:'50%',transform:'translateX(-50%)',background: dark?'#162845':'#152336',color:'white',borderRadius:10,padding:'10px 20px',fontSize:13,fontFamily:"'DM Sans',sans-serif",zIndex:2000,display:'flex',alignItems:'center',gap:10,boxShadow:'0 8px 24px rgba(0,0,0,.2)' }}>
          {toast}
          <button onClick={() => { brd.undo(); showToast('Undone ↩') }} style={{ background:'rgba(255,255,255,.15)',border:'1px solid rgba(255,255,255,.3)',borderRadius:6,padding:'2px 9px',cursor:'pointer',fontSize:11,color:'white',fontFamily:"'DM Sans',sans-serif" }}>Undo</button>
        </div>
      )}

      {/* Keyboard shortcuts overlay */}
      {showShortcuts && (
        <div
          role="dialog"
          aria-modal={true}
          aria-label="Keyboard shortcuts"
          style={{
          position: 'fixed',
          right: 20,
          bottom: 170,
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
              aria-label="Close shortcuts"
              style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: 0 }}
            >×</button>
          </div>

          <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, opacity: 0.5, marginBottom: 8 }}>Navigation</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 14px', alignItems: 'center', marginBottom: 14 }}>
            {([
              ['Ctrl + move', 'Pan with mouse'],
              ['↑ ↓ ← →',    'Pan canvas'],
              ['Ctrl + ↑↓←→', 'Pan canvas'],
              ['Shift + arrows', 'Pan faster'],
              ['+  /  -',    'Zoom in / out'],
              ['0',          'Reset zoom'],
            ] as [string, string][]).map(([key, desc]) => (
              <Fragment key={key}>
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
              ['Del / Backspace', 'Delete selected card'],
              ['Ctrl + Z', 'Undo'],
            ] as [string, string][]).map(([key, desc]) => (
              <Fragment key={key}>
                <span style={{ background: '#263D5B', padding: '2px 7px', borderRadius: 4, fontFamily: 'monospace', fontSize: 12, whiteSpace: 'nowrap', textAlign: 'center' }}>{key}</span>
                <span style={{ opacity: 0.85 }}>{desc}</span>
              </Fragment>
            ))}
          </div>

          <div style={{ opacity: 0.4, fontSize: 11, borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 10 }}>
            Press <span style={{ fontFamily: 'monospace' }}>?</span> or <span style={{ fontFamily: 'monospace' }}>Esc</span> to close
          </div>
        </div>
      )}
    </div>
  )
}

function SbBtn({ children, title, onClick }: { children: React.ReactNode; title: string; onClick: () => void; dark?: boolean }) {
  return (
    <button title={title} onClick={onClick}
      style={{ width:42,height:42,borderRadius:10,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',color:'rgba(255,255,255,0.45)',background:'none',border:'1px solid transparent',transition:'background .15s,color .15s,border-color .15s' }}
      onMouseEnter={e => { const b = e.currentTarget as HTMLButtonElement; b.style.background = 'rgba(73,182,229,0.12)'; b.style.color = '#49B6E5'; b.style.borderColor = 'rgba(73,182,229,0.3)' }}
      onMouseLeave={e => { const b = e.currentTarget as HTMLButtonElement; b.style.background = 'none'; b.style.color = 'rgba(255,255,255,0.45)'; b.style.borderColor = 'transparent' }}
    >{children}</button>
  )
}

function Centered({ children, dark, error }: { children: React.ReactNode; dark: boolean; error?: boolean }) {
  return (
    <div style={{ height:'100vh',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:"'DM Sans',sans-serif",color: error?'#C53030':(dark?'#888':'#aaa'),background: dark?'#0D1B2E':'#ECEAE3' }}>
      {children}
    </div>
  )
}
