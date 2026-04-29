// src/components/Board.tsx
import { useState, useRef, useEffect, useCallback } from 'react'
import type { LocalUser, Board as BoardType, Card, TagType } from '../types'
import { useBoard } from '../hooks/useBoard'
import IdeaCard from './IdeaCard'
import CardModal from './CardModal'
import { snapPosition } from '../lib/snapPosition'

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

export default function Board({ user, board, onBack, dark, onToggleDark }: BoardProps) {
  const brd = useBoard(board.id)

  // Camera
  const [panX, setPanX] = useState(0)
  const [panY, setPanY] = useState(0)
  const [zoom, setZoom] = useState(1)

  const canvasRef    = useRef<HTMLDivElement>(null)
  const worldRef     = useRef<HTMLDivElement>(null)

  // Pan
  const isPanning    = useRef(false)
  const panStart     = useRef({ x: 0, y: 0, px: 0, py: 0 })

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
    isPanning.current = true
    panStart.current = { x: e.clientX, y: e.clientY, px: panX, py: panY }
    e.preventDefault()
  }

  const onCardMoveStart = useCallback((id: string, cx: number, cy: number) => {
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
    isResizing.current    = true
    resizeCardId.current  = id
    resizeStartX.current  = cx
    resizeStartY.current  = cy
    resizeStartW.current  = startW
    resizeStartH.current  = startH
  }, [])

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
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
        return
      }
      if (isResizing.current && resizeCardId.current) {
        const dx = (e.clientX - resizeStartX.current) / zoom
        const dy = (e.clientY - resizeStartY.current) / zoom
        const newW = Math.max(CARD_MIN_W, resizeStartW.current + dx)
        const newH = resizeStartH.current !== null
          ? Math.max(CARD_MIN_H, resizeStartH.current + dy)
          : Math.max(CARD_MIN_H, 160 + dy)
        brd.resizeCard(resizeCardId.current, newW, newH)
      }
    }

    const onUp = (e: MouseEvent) => {
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
        isDragging.current = false; dragCardId.current = null; dragTagId.current = null
        setSnapGhost(null)
        return
      }
      if (isResizing.current && resizeCardId.current) {
        const dx = (e.clientX - resizeStartX.current) / zoom
        const dy = (e.clientY - resizeStartY.current) / zoom
        const newW = Math.max(CARD_MIN_W, resizeStartW.current + dx)
        const newH = resizeStartH.current !== null
          ? Math.max(CARD_MIN_H, resizeStartH.current + dy)
          : Math.max(CARD_MIN_H, 160 + dy)
        brd.commitCardResize(resizeCardId.current, newW, newH)
        isResizing.current = false; resizeCardId.current = null
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
      if (target.closest('input,textarea')) return
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') { brd.undo(); showToast('Undone ↩') }
      if (e.key === 'Escape') setColourPicker(null)
      if (e.key === 'n' && !e.ctrlKey && !e.metaKey) {
        const cr = canvasRef.current?.getBoundingClientRect()
        if (cr) { newCardWorld.current = screenToWorld(cr.left + cr.width / 2, cr.top + cr.height / 2); setEditingCard(null); setModalOpen(true) }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [brd, screenToWorld])

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
    if (!worldRef.current) return
    setExporting(true)
    showToast('Generating PDF…')
    try {
      // Dynamically import so bundle stays small
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
      ])
      const canvas = await html2canvas(worldRef.current, {
        scale: 1.5,
        backgroundColor: dark ? '#0F0F14' : '#ECEAE3',
        useCORS: true,
        logging: false,
      })
      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'px', format: [canvas.width, canvas.height] })
      pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height)
      pdf.save(`${board.name}.pdf`)
      showToast('PDF downloaded ✓')
    } catch {
      showToast('Export failed — try again')
    } finally {
      setExporting(false)
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
    await brd.removeCard(editingCard.id)
    setModalOpen(false); showToast('Card deleted')
  }

  // ── Theme colours ───────────────────────────────────────────
  const sbBg   = dark ? '#0D0D12' : '#141418'
  const topBg  = dark ? 'rgba(13,13,18,.94)' : 'rgba(248,246,240,.94)'
  const topBdr = dark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.08)'
  const txtC   = dark ? '#F0EEE8' : '#1A1A2E'
  const subC   = dark ? '#666'    : '#999'
  const cvBg   = dark ? '#0F0F14' : '#ECEAE3'
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
            cursor: 'crosshair',
          }}
        >
          {/* THE WORLD */}
          <div ref={worldRef}
            style={{ position: 'absolute', left: 0, top: 0, transformOrigin: '0 0', transform: `translate(${panX}px,${panY}px) scale(${zoom})` }}>

            {/* Eisenhower Matrix */}
            <div className="world-item" style={{ position: 'absolute', left: 60, top: 40, width: 640, height: 540 }}>
              <div style={{ display: 'flex', padding: '0 0 6px 56px' }}>
                {['Important','Not Important'].map((l,i)=>(
                  <div key={l} style={{ flex:1, textAlign:'center', fontSize:9, fontWeight:700, letterSpacing:'.08em', textTransform:'uppercase', color: i===0 ? (dark?'#666':'#999') : (dark?'#444':'#ccc') }}>{l}</div>
                ))}
              </div>
              <div style={{ display:'flex', height:490 }}>
                <div style={{ width:56, display:'flex', flexDirection:'column', justifyContent:'space-around', paddingRight:8 }}>
                  {['Urgent','Not Urgent'].map((l,i)=>(
                    <div key={l} style={{ fontSize:9, fontWeight:700, letterSpacing:'.08em', textTransform:'uppercase', color: i===0?(dark?'#666':'#999'):(dark?'#444':'#ccc'), writingMode:'vertical-rl', transform:'rotate(180deg)', textAlign:'center', height:'50%', display:'flex', alignItems:'center', justifyContent:'center' }}>{l}</div>
                  ))}
                </div>
                <div style={{ flex:1, display:'grid', gridTemplateColumns:'1fr 1fr', gridTemplateRows:'1fr 1fr', gap:5 }}>
                  {(['Do First','Schedule','Delegate','Eliminate'] as const).map((label,i)=>{
                    const bgs = ['#D4EDD8','#FFF3B0','#FFD6C2','#E8E0F5']
                    const tcs = ['#1B4D21','#5C4009','#6B2D0D','#3A2270']
                    const qs  = ['Q1','Q2','Q3','Q4']
                    const bg  = dark ? `${bgs[i]}22` : bgs[i]
                    return (
                      <div key={label} style={{ background:bg, borderRadius:15, border:`2px solid rgba(0,0,0,${dark?.04:.07})`, padding:13 }}>
                        <div style={{ fontFamily:"'Syne',sans-serif", fontSize:10, fontWeight:700, letterSpacing:'.06em', textTransform:'uppercase', opacity:.45, marginBottom:3, color:tcs[i] }}>{qs[i]}</div>
                        <div style={{ fontFamily:"'Syne',sans-serif", fontSize:15, fontWeight:800, color:tcs[i] }}>{label}</div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Cards */}
            {brd.cards.map(card => (
              <div key={card.id} className="world-item">
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
