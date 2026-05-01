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
