import type { CardFontFamily, CardInsert } from '../types'

export const CARD_FONT_OPTIONS: { id: CardFontFamily; label: string; title: string; body: string; titleWeight: number; bodyWeight: number }[] = [
  { id: 'marker', label: 'Marker', title: "'Syne', sans-serif", body: "'DM Sans', sans-serif", titleWeight: 700, bodyWeight: 400 },
  { id: 'delius', label: 'Delius', title: "'Delius Swash Caps', cursive", body: "'Delius', cursive", titleWeight: 400, bodyWeight: 400 },
  { id: 'dm-sans', label: 'DM Sans', title: "'DM Sans', sans-serif", body: "'DM Sans', sans-serif", titleWeight: 700, bodyWeight: 400 },
  { id: 'syne', label: 'Syne', title: "'Syne', sans-serif", body: "'Syne', sans-serif", titleWeight: 700, bodyWeight: 500 },
  { id: 'lora', label: 'Lora', title: "'Lora', serif", body: "'Lora', serif", titleWeight: 700, bodyWeight: 400 },
  { id: 'caveat', label: 'Caveat', title: "'Caveat', cursive", body: "'Caveat', cursive", titleWeight: 700, bodyWeight: 500 },
  { id: 'jetbrains-mono', label: 'JetBrains Mono', title: "'JetBrains Mono', monospace", body: "'JetBrains Mono', monospace", titleWeight: 700, bodyWeight: 400 },
]

export function getCardTypography(fontFamily?: CardFontFamily) {
  return CARD_FONT_OPTIONS.find(option => option.id === fontFamily) ?? CARD_FONT_OPTIONS[0]
}

export function isCardFontFamily(value: unknown): value is CardFontFamily {
  return CARD_FONT_OPTIONS.some(option => option.id === value)
}

export function preserveImportedCardFonts(data: unknown, cards: CardInsert[]): CardInsert[] {
  if (!data || typeof data !== 'object') return cards
  const sourceCards = (data as { cards?: unknown }).cards
  if (!Array.isArray(sourceCards)) return cards

  return cards.map((card, index) => {
    const source = sourceCards[index]
    if (!source || typeof source !== 'object') return card
    const fontFamily = (source as { font_family?: unknown }).font_family
    return isCardFontFamily(fontFamily) ? { ...card, font_family: fontFamily } : card
  })
}
