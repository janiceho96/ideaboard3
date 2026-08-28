import type { Card } from '../types'
import { colors, radii, shadows } from '../lib/designTokens'

interface BoardThumbnailProps {
  cards: Card[]
  dark: boolean
}

const FALLBACK_COLORS = [colors.markerYellow, colors.markerMint, colors.markerCoral, colors.markerCyan]

function cardColor(card: Card, index: number): string {
  if (card.bg && card.bg !== 'white') return card.bg
  return FALLBACK_COLORS[index % FALLBACK_COLORS.length]
}

export default function BoardThumbnail({ cards, dark }: BoardThumbnailProps) {
  const canvas = dark ? '#111A2D' : colors.canvasLight
  const ink = dark ? '#F7F7F2' : colors.ink

  if (cards.length === 0) {
    return (
      <div
        aria-label="Empty board. Start with an idea."
        style={{ height: 104, borderRadius: radii.card, marginBottom: 14, background: canvas, border: `1.5px dashed ${dark ? colors.borderDark : colors.borderLight}`, display: 'grid', placeItems: 'center', color: dark ? '#AAB5C9' : '#5F687B', fontSize: 11, fontWeight: 700 }}
      >
        Start with an idea
      </div>
    )
  }

  const visibleCards = cards.slice(0, 3)
  const positions = [
    { left: 14, top: 15, rotate: -2 },
    { left: 72, top: 30, rotate: 2 },
    { left: 37, top: 59, rotate: -1 },
  ]

  return (
    <div
      aria-label={`Board preview with ${cards.length} card${cards.length === 1 ? '' : 's'}`}
      style={{ position: 'relative', height: 104, borderRadius: radii.card, marginBottom: 14, overflow: 'hidden', background: canvas, backgroundImage: dark ? 'radial-gradient(#30405e 0.7px, transparent 0.7px)' : 'radial-gradient(#C1C4CC 0.7px, transparent 0.7px)', backgroundSize: '12px 12px' }}
    >
      {visibleCards.map((card, index) => {
        const position = positions[index]
        return (
          <div
            key={card.id}
            style={{ position: 'absolute', left: position.left, top: position.top, width: 84, height: 50, padding: '7px 8px', overflow: 'hidden', border: `1.5px solid ${ink}`, borderRadius: radii.card, background: cardColor(card, index), boxShadow: shadows.card, transform: `rotate(${position.rotate}deg)`, color: ink, boxSizing: 'border-box' }}
          >
            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: "'Syne', sans-serif", fontSize: 8, fontWeight: 800 }}>{card.title || 'Untitled idea'}</div>
            <div style={{ width: '75%', height: 3, marginTop: 8, borderRadius: 2, background: 'rgba(23,32,56,.28)' }} />
            <div style={{ width: '52%', height: 3, marginTop: 4, borderRadius: 2, background: 'rgba(23,32,56,.17)' }} />
          </div>
        )
      })}
      <span style={{ position: 'absolute', right: 10, bottom: 7, color: dark ? '#AAB5C9' : 'rgba(23,32,56,.55)', fontSize: 12, fontWeight: 800 }}>✦</span>
    </div>
  )
}
