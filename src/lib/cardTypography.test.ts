import { describe, expect, it } from 'vitest'
import { getCardTypography, preserveImportedCardFonts } from './cardTypography'
import type { CardInsert } from '../types'

const importedCard: CardInsert = {
  board_id: 'target', title: 'Idea', body: 'A note', date_label: '', due_date: null,
  tag: 'idea', bg: 'white', x: 0, y: 0, rotation: 0, card_width: 185,
  card_height: null, collapsed: false, locked: false,
}

describe('card typography', () => {
  it('uses the original title and body fonts for cards without a font selection', () => {
    expect(getCardTypography()).toEqual(getCardTypography('marker'))
    expect(getCardTypography().title).toContain('Syne')
    expect(getCardTypography().body).toContain('DM Sans')
  })

  it('preserves bundled font ids through whiteboard import and ignores unknown ids', () => {
    const cards = preserveImportedCardFonts({ cards: [
      { font_family: 'caveat' },
      { font_family: 'custom-upload' },
      {},
    ] }, [importedCard, importedCard, importedCard])

    expect(cards.map(card => card.font_family)).toEqual(['caveat', undefined, undefined])
  })
})
