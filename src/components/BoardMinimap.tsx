import { memo, useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { getViewportWorldRect, type BoardRect } from '../lib/boardGeometry'
import { getMinimapBounds, MINIMAP_HEIGHT, MINIMAP_WIDTH } from '../lib/minimapGeometry'
import type { CanvasCamera } from '../lib/canvasZoom'
import { colors } from '../lib/designTokens'

export interface MinimapItem { id: string; label: string; rect: BoardRect; color: string; frame?: boolean }
interface Props {
  items: MinimapItem[]
  camera: CanvasCamera
  canvasRef: RefObject<HTMLDivElement>
  dark: boolean
  onNavigate: (x: number, y: number) => void
}

function BoardMinimap({ items, camera, canvasRef, dark, onNavigate }: Props) {
  const { panX, panY, zoom } = camera
  const [size, setSize] = useState({ width: 1, height: 1 })
  const [dragBounds, setDragBounds] = useState<BoardRect | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const update = () => {
      const { width, height } = canvas.getBoundingClientRect()
      setSize(previous => previous.width === width && previous.height === height ? previous : { width, height })
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(canvas)
    return () => observer.disconnect()
  }, [canvasRef])
  const viewport = useMemo(() => getViewportWorldRect({ ...size, panX, panY, zoom }), [size, panX, panY, zoom])
  const bounds = useMemo(() => getMinimapBounds(items.map(item => item.rect), viewport), [items, viewport])
  const view = dragBounds ?? bounds
  const navigate = (clientX: number, clientY: number, projection = view) => {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect?.width || !rect.height) return
    const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    const y = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height))
    onNavigate(projection.x + x * projection.width, projection.y + y * projection.height)
  }

  return <button type="button" aria-label="Board minimap" title="Click or drag to navigate. Arrow keys pan; Enter recenters."
    onMouseDown={event => event.stopPropagation()}
    onMouseMove={event => event.stopPropagation()}
    onDoubleClick={event => event.stopPropagation()}
    onPointerDown={event => {
      if (event.button !== 0) return
      event.stopPropagation()
      event.currentTarget.setPointerCapture(event.pointerId)
      // Freeze the projection while navigating so the pointer does not chase changing bounds.
      setDragBounds(bounds)
      navigate(event.clientX, event.clientY, bounds)
    }}
    onPointerMove={event => {
      if (!event.currentTarget.hasPointerCapture(event.pointerId)) return
      event.stopPropagation()
      navigate(event.clientX, event.clientY)
    }}
    onPointerUp={event => {
      if (!event.currentTarget.hasPointerCapture(event.pointerId)) return
      navigate(event.clientX, event.clientY)
      event.currentTarget.releasePointerCapture(event.pointerId)
      setDragBounds(null)
    }}
    onLostPointerCapture={() => setDragBounds(null)}
    onClick={event => { if (event.detail === 0) onNavigate(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2) }}
    onKeyDown={event => {
      const direction = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key]
      if (!direction) return
      event.preventDefault()
      event.stopPropagation()
      onNavigate(viewport.x + viewport.width / 2 + direction[0] * 60 / camera.zoom, viewport.y + viewport.height / 2 + direction[1] * 60 / camera.zoom)
    }}
    style={{ position: 'absolute', right: 62, bottom: 22, width: MINIMAP_WIDTH, height: MINIMAP_HEIGHT, padding: 0, display: 'block', boxSizing: 'content-box', background: dark ? colors.surfaceDark : '#f0ede5', borderRadius: 9, border: `1px solid ${dark ? colors.borderDark : colors.borderLight}`, boxShadow: '0 2px 8px rgba(0,0,0,.1)', overflow: 'hidden', zIndex: 50, cursor: dragBounds ? 'grabbing' : 'crosshair', touchAction: 'none' }}>
    <svg ref={svgRef} width={MINIMAP_WIDTH} height={MINIMAP_HEIGHT} viewBox={`${view.x} ${view.y} ${view.width} ${view.height}`} role="img" aria-label="Board items and visible area" style={{ display: 'block', pointerEvents: 'none' }}>
      {items.filter(item => [item.rect.x, item.rect.y, item.rect.width, item.rect.height].every(Number.isFinite) && item.rect.width >= 0 && item.rect.height >= 0).map(item => <rect key={item.id} data-minimap-item={item.id} x={item.rect.x} y={item.rect.y} width={item.rect.width} height={item.rect.height} rx={2 / (MINIMAP_WIDTH / view.width)} fill={item.color} fillOpacity={item.frame ? .18 : .8} stroke={dark ? '#B8C5D9' : '#5F687B'} strokeWidth={.7} vectorEffect="non-scaling-stroke"><title>{item.label}</title></rect>)}
      <rect data-minimap-viewport="true" x={viewport.x} y={viewport.y} width={viewport.width} height={viewport.height} fill={colors.markerPurple} fillOpacity={.08} stroke={dark ? '#C4B5FD' : colors.markerPurple} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
    </svg>
  </button>
}

export default memo(BoardMinimap)
