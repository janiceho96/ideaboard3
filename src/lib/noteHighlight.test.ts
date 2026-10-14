import { describe, expect, it } from 'vitest'
import {
  addNoteHighlight,
  NOTE_HIGHLIGHT_COLORS,
  removeNoteHighlight,
  renderNoteMarkdown,
} from './noteHighlight'

describe('note highlight edits', () => {
  it('wraps one exact quote without rewriting surrounding Markdown', () => {
    const markdown = '**Bold** phrase beside [a link](https://example.com).'

    expect(addNoteHighlight(markdown, 'phrase', 'yellow')).toEqual({
      status: 'updated',
      markdown:
        '**Bold** {{ib-highlight:yellow}}phrase{{/ib-highlight}} beside [a link](https://example.com).',
    })
  })

  it('reports zero matches without changing the Markdown', () => {
    expect(addNoteHighlight('A short note.', 'missing', 'mint')).toEqual({
      status: 'not-found',
      markdown: 'A short note.',
      matches: 0,
    })
  })

  it('reports multiple exact matches, including overlapping matches', () => {
    expect(addNoteHighlight('Repeat phrase; phrase.', 'phrase', 'coral')).toMatchObject({
      status: 'ambiguous',
      markdown: 'Repeat phrase; phrase.',
      matches: 2,
    })
    expect(addNoteHighlight('aaa', 'aa', 'coral')).toMatchObject({
      status: 'ambiguous',
      matches: 2,
    })
  })

  it('does not allow nested highlights or reserved marker text in a quote', () => {
    const markdown = '{{ib-highlight:mint}}already marked{{/ib-highlight}}'

    expect(addNoteHighlight(markdown, 'marked', 'yellow')).toEqual({
      status: 'already-highlighted',
      markdown,
    })
    expect(addNoteHighlight(markdown, 'mint', 'yellow')).toEqual({
      status: 'not-found',
      markdown,
      matches: 0,
    })
    expect(addNoteHighlight('plain text', '{{/ib-highlight}}', 'yellow')).toEqual({
      status: 'invalid-quote',
      markdown: 'plain text',
    })
  })

  it('removes exactly one marker while preserving the marked Markdown source', () => {
    const markdown = '**Before** {{ib-highlight:cyan}}*phrase*{{/ib-highlight}} after.'

    expect(removeNoteHighlight(markdown, '*phrase*')).toEqual({
      status: 'updated',
      markdown: '**Before** *phrase* after.',
    })
  })

  it('reports absent and repeated highlighted quotes when removing', () => {
    expect(removeNoteHighlight('Unmarked phrase.', 'phrase')).toEqual({
      status: 'not-found',
      markdown: 'Unmarked phrase.',
      matches: 0,
    })

    const repeated =
      '{{ib-highlight:yellow}}same{{/ib-highlight}} and {{ib-highlight:cyan}}same{{/ib-highlight}}'
    expect(removeNoteHighlight(repeated, 'same')).toMatchObject({
      status: 'ambiguous',
      markdown: repeated,
      matches: 2,
    })
  })

  it('rejects colors outside the symbolic allowlist', () => {
    expect(NOTE_HIGHLIGHT_COLORS).toEqual(['yellow', 'mint', 'coral', 'cyan'])
    expect(addNoteHighlight('phrase', 'phrase', 'red')).toEqual({
      status: 'invalid-color',
      markdown: 'phrase',
    })
  })
})

describe('note highlight Markdown rendering', () => {
  it('renders a marker as a sanitized mark with its mapped symbolic color', () => {
    const html = renderNoteMarkdown(
      'Before {{ib-highlight:yellow}}**important**{{/ib-highlight}} after.',
    )

    expect(html).toContain(
      '<mark style="background-color: #FFF3A3"><strong>important</strong></mark>',
    )
    expect(html).not.toContain('ib-highlight')
  })

  it('does not render unknown marker colors as marks or accept arbitrary style values', () => {
    const html = renderNoteMarkdown('{{ib-highlight:red}}phrase{{/ib-highlight}}')

    expect(html).not.toContain('<mark')
    expect(html).toContain('{{ib-highlight:red}}phrase{{/ib-highlight}}')
    expect(html).not.toContain('background-color: red')
  })
})

describe('highlights in code', () => {
  it('displays a phrase inside inline code without exposing marker delimiters', () => {
    const edit = addNoteHighlight('Use `medium_agent/.env` for configuration.', 'medium_agent/.env', 'yellow')
    expect(renderNoteMarkdown(edit.markdown)).toContain('<code><mark style="background-color: #FFF3A3">medium_agent/.env</mark></code>')
  })
  it('renders marked code safely in a fenced block', () => {
    const edit = addNoteHighlight('```sh\nprint("<script>")\n```', 'print', 'mint')
    const html = renderNoteMarkdown(edit.markdown)
    expect(html).toContain('<mark style="background-color: #B7E4C7">print</mark>')
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })
})
