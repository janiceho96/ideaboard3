import { Marked, Renderer, type MarkedExtension, type Tokens } from 'marked'
import { sanitizeHtml } from './sanitizeHtml'

export const NOTE_HIGHLIGHT_COLORS = ['yellow', 'mint', 'coral', 'cyan'] as const

export type NoteHighlightColor = (typeof NOTE_HIGHLIGHT_COLORS)[number]

export type NoteHighlightEditResult =
  | { status: 'updated'; markdown: string }
  | { status: 'not-found'; markdown: string; matches: 0 }
  | { status: 'ambiguous'; markdown: string; matches: number }
  | { status: 'already-highlighted'; markdown: string }
  | { status: 'invalid-color'; markdown: string }
  | { status: 'invalid-quote'; markdown: string }

export const NOTE_HIGHLIGHT_SWATCHES: Record<NoteHighlightColor, string> = {
  yellow: '#FFF3A3',
  mint: '#B7E4C7',
  coral: '#FFB4A2',
  cyan: '#A8DADC',
}

let renderSequence = 0

const OPEN_PREFIX = '{{ib-highlight:'
const CLOSE_MARKER = '{{/ib-highlight}}'
const OPEN_MARKER_RE = /^\{\{ib-highlight:(yellow|mint|coral|cyan)\}\}/
const HIGHLIGHT_RANGE_RE =
  /\{\{ib-highlight:(yellow|mint|coral|cyan)\}\}([\s\S]*?)\{\{\/ib-highlight\}\}/g

interface HighlightRange {
  start: number
  contentStart: number
  contentEnd: number
  end: number
}

interface NoteHighlightToken extends Tokens.Generic {
  type: 'noteHighlight'
  color: NoteHighlightColor
  text: string
  tokens: Tokens.Generic[]
}

function isHighlightColor(value: string): value is NoteHighlightColor {
  return (NOTE_HIGHLIGHT_COLORS as readonly string[]).includes(value)
}

function findHighlightRanges(markdown: string): HighlightRange[] {
  const ranges: HighlightRange[] = []

  for (const match of markdown.matchAll(HIGHLIGHT_RANGE_RE)) {
    const start = match.index
    const contentStart = start + match[0].indexOf('}}') + 2
    const contentEnd = contentStart + match[2].length
    ranges.push({ start, contentStart, contentEnd, end: start + match[0].length })
  }

  return ranges
}

function findOccurrences(markdown: string, quote: string, ranges: HighlightRange[]): number[] {
  const positions: number[] = []
  const delimiterRanges = ranges.flatMap((range) => [
    { start: range.start, end: range.contentStart },
    { start: range.contentEnd, end: range.end },
  ])
  let from = 0

  while (from <= markdown.length - quote.length) {
    const index = markdown.indexOf(quote, from)
    if (index === -1) break
    const end = index + quote.length
    if (!delimiterRanges.some((range) => index < range.end && end > range.start))
      positions.push(index)
    from = index + 1
  }

  return positions
}

function hasReservedMarker(quote: string): boolean {
  return quote.includes(OPEN_PREFIX) || quote.includes(CLOSE_MARKER)
}

/** Wraps one exact Markdown source occurrence in a symbolic highlight marker. */
export function addNoteHighlight(
  markdown: string,
  quote: string,
  color: string,
): NoteHighlightEditResult {
  if (!isHighlightColor(color)) return { status: 'invalid-color', markdown }
  if (!quote || hasReservedMarker(quote)) return { status: 'invalid-quote', markdown }

  const ranges = findHighlightRanges(markdown)
  const matches = findOccurrences(markdown, quote, ranges)
  if (matches.length === 0) return { status: 'not-found', markdown, matches: 0 }
  if (matches.length > 1) return { status: 'ambiguous', markdown, matches: matches.length }

  const index = matches[0]
  if (
    ranges.some((range) => index >= range.contentStart && index + quote.length <= range.contentEnd)
  ) {
    return { status: 'already-highlighted', markdown }
  }

  const start = `{{ib-highlight:${color}}}`
  const highlighted = `${start}${quote}${CLOSE_MARKER}`
  return {
    status: 'updated',
    markdown: markdown.slice(0, index) + highlighted + markdown.slice(index + quote.length),
  }
}

/** Removes a highlight only when exactly one marker encloses the exact quote. */
export function removeNoteHighlight(markdown: string, quote: string): NoteHighlightEditResult {
  if (!quote || hasReservedMarker(quote)) return { status: 'invalid-quote', markdown }

  const ranges = findHighlightRanges(markdown).filter(
    (range) => markdown.slice(range.contentStart, range.contentEnd) === quote,
  )

  if (ranges.length === 0) return { status: 'not-found', markdown, matches: 0 }
  if (ranges.length > 1) return { status: 'ambiguous', markdown, matches: ranges.length }

  const { start, contentStart, contentEnd, end } = ranges[0]
  return {
    status: 'updated',
    markdown:
      markdown.slice(0, start) + markdown.slice(contentStart, contentEnd) + markdown.slice(end),
  }
}

/** Marked inline extension for the non-HTML highlight markers emitted above. */
export const noteHighlightMarkedExtension: MarkedExtension = {
  extensions: [
    {
      name: 'noteHighlight',
      level: 'inline',
      start(source) {
        const index = source.indexOf(OPEN_PREFIX)
        return index === -1 ? undefined : index
      },
      tokenizer(source) {
        const opening = OPEN_MARKER_RE.exec(source)
        if (!opening) return undefined

        const contentStart = opening[0].length
        const closeIndex = source.indexOf(CLOSE_MARKER, contentStart)
        if (closeIndex === -1) return undefined

        const color = opening[1]
        if (!isHighlightColor(color)) return undefined

        const text = source.slice(contentStart, closeIndex)
        return {
          type: 'noteHighlight',
          raw: source.slice(0, closeIndex + CLOSE_MARKER.length),
          color,
          text,
          tokens: this.lexer.inline(text),
        }
      },
      renderer(token) {
        const highlight = token as NoteHighlightToken
        const backgroundColor = NOTE_HIGHLIGHT_SWATCHES[highlight.color]
        if (!backgroundColor) return highlight.text

        const content = this.parser.parseInline(highlight.tokens)
        return `<mark style="background-color: ${backgroundColor}">${content}</mark>`
      },
    },
  ],
}

/** Parses note Markdown with safe highlighting and interactive task checkboxes. */
export function renderNoteMarkdown(markdown: string, options: { checklistsInteractive?: boolean } = {}): string {
  const parser = new Marked({ breaks: true, gfm: true })
  const taskStates: boolean[] = []
  const taskTokenPrefix = `\uE000IDEABOARD_TASK_${Date.now()}_${++renderSequence}_`
  parser.use(noteHighlightMarkedExtension)
  const markedCode = (escaped: string) => escaped.replace(HIGHLIGHT_RANGE_RE, (_match, color: NoteHighlightColor, text: string) => `<mark style="background-color: ${NOTE_HIGHLIGHT_SWATCHES[color]}">${text}</mark>`)
  const codeRenderer = new Renderer()
  parser.use({ renderer: {
    codespan: text => markedCode(codeRenderer.codespan(text)),
    code: (text, language, escaped) => markedCode(codeRenderer.code(text, language, escaped)),
    checkbox: checked => {
      const index = taskStates.push(checked) - 1
      return `${taskTokenPrefix}${index}\uE001`
    },
  } })
  let html = sanitizeHtml(parser.parse(markdown) as string)
  taskStates.forEach((checked, index) => {
    const token = `${taskTokenPrefix}${index}\uE001`
    const input = `<input type="checkbox" data-ideaboard-task="${index}" data-checked="${checked}" aria-label="Checklist item ${index + 1}"${checked ? ' checked' : ''}${options.checklistsInteractive === false ? ' disabled' : ''}>`
    html = html.split(token).join(input)
  })
  return html
}
