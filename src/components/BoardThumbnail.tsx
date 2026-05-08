import type { Card } from '../types'

interface BoardThumbnailProps {
  cards: Card[]   // sorted newest-updated first, max 3 items
  dark: boolean
}

export default function BoardThumbnail({ cards, dark }: BoardThumbnailProps) {
  const bg = dark ? '#25252F' : '#F5F0E8'

  if (cards.length === 0) {
    return (
      <div style={{ height: 80, borderRadius: 10, marginBottom: 14, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 80, height: 60, borderRadius: 7, border: `1.5px dashed ${dark ? '#3A3A50' : '#C8C4BB'}` }} />
      </div>
    )
  }

  const front  = cards[0]
  const middle = cards[1]
  const back   = cards[2]

  const cardBase = {
    position: 'absolute' as const,
    width: 80,
    height: 60,
    borderRadius: 7,
    boxShadow: '0 2px 6px rgba(0,0,0,.13)',
  }

  return (
    <div style={{ height: 80, borderRadius: 10, marginBottom: 14, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      <div style={{ position: 'relative', width: 120, height: 70 }}>
        {back && (
          <div style={{ ...cardBase, background: back.bg, left: 20, top: 5, transform: 'rotate(4deg)' }} />
        )}
        {middle && (
          <div style={{ ...cardBase, background: middle.bg, left: 10, top: 3, transform: 'rotate(-2deg)' }} />
        )}
        <div style={{ ...cardBase, background: front.bg, left: 0, top: 0, padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 5, overflow: 'hidden' }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: 'rgba(0,0,0,.65)', fontFamily: "'DM Sans',sans-serif", whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {front.title}
          </div>
          <div style={{ height: 4, background: 'rgba(0,0,0,.12)', borderRadius: 2, width: '80%' }} />
          <div style={{ height: 4, background: 'rgba(0,0,0,.08)', borderRadius: 2, width: '60%' }} />
        </div>
      </div>
    </div>
  )
}
