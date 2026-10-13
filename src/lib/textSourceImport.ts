/**
 * Bounded plain-text and Markdown import for future board source workflows.
 * Files are limited to 512 KiB and 200,000 JavaScript UTF-16 code units before
 * normalization; normalized output is subject to the same character limit.
 */
export const MAX_TEXT_SOURCE_BYTES = 512 * 1024
export const MAX_TEXT_SOURCE_CHARACTERS = 200_000

export interface RawTextSource {
  name: string
  content: string
}

type FileTextSource = Pick<File, 'name' | 'size' | 'text'>
type TextSourceInput = FileTextSource | RawTextSource

const SUPPORTED_EXTENSIONS = new Set(['.txt', '.md', '.markdown'])
const SAFE_LINK_SCHEME = /^(?:https?:\/\/|mailto:|tel:|#|\/(?!\/))/i

function isFileTextSource(value: unknown): value is FileTextSource {
  if (!value || typeof value !== 'object') return false
  const source = value as Partial<FileTextSource>
  return typeof source.name === 'string'
    && typeof source.size === 'number'
    && typeof source.text === 'function'
}

function assertSupportedName(name: string): void {
  const filename = name.trim().replace(/^.*[\\/]/, '')
  const extension = filename.slice(filename.lastIndexOf('.')).toLowerCase()
  if (!SUPPORTED_EXTENSIONS.has(extension)) {
    throw new Error('Unsupported file type. Choose a .txt, .md, or .markdown file.')
  }
}

function characterCount(value: string): number {
  return value.length
}

function assertWithinLimits(value: string): void {
  if (characterCount(value) > MAX_TEXT_SOURCE_CHARACTERS) {
    throw new Error(`Text source exceeds the ${MAX_TEXT_SOURCE_CHARACTERS.toLocaleString()}-character limit.`)
  }

  const byteLength = new TextEncoder().encode(value).byteLength
  if (byteLength > MAX_TEXT_SOURCE_BYTES) {
    throw new Error('Text source exceeds the 512 KiB file-size limit.')
  }
}

function isSafeLink(destination: string): boolean {
  return SAFE_LINK_SCHEME.test(destination)
}

function stripHtmlMarkup(value: string): string {
  return value
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<!doctype\b[^>]*>/gi, '')
    .replace(/<\?[\s\S]*?\?>/g, '')
    .replace(/<!\[CDATA\[[\s\S]*?\]\]>/gi, '')
    .replace(/<(script|style|iframe|object)\b[^>]*>[\s\S]*?(?:<\/\1\s*>|$)/gi, '')
    .replace(/<(https?:\/\/[^>\s]+)>/gi, '$1')
    .replace(/<mailto:([^>\s]+)>/gi, 'mailto:$1')
    .replace(/<img\b[^>]*\balt\s*=\s*(?:"([^"]*)"|'([^']*)')[^>]*>/gi, (_tag, doubleQuoted: string, singleQuoted: string) => doubleQuoted ?? singleQuoted)
    .replace(/<\/?(?:br|hr)\b[^>]*>/gi, '\n')
    .replace(/<\/?(?:address|article|aside|blockquote|div|dl|fieldset|figcaption|figure|footer|form|h[1-6]|header|li|main|nav|ol|p|pre|section|table|tbody|td|tfoot|th|thead|tr|ul)\b[^>]*>/gi, '\n')
    .replace(/<\/?[a-z][a-z0-9:-]*(?:\s+[^<>]*?)?\s*\/?>/gi, '')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#(\d+);/g, (entity, decimal: string) => {
      const codePoint = Number(decimal)
      return Number.isInteger(codePoint) && codePoint > 0 && codePoint <= 0x10ffff && codePoint !== 60 && codePoint !== 62
        ? String.fromCodePoint(codePoint)
        : entity
    })
    .replace(/&#x([\da-f]+);/gi, (entity, hex: string) => {
      const codePoint = Number.parseInt(hex, 16)
      return Number.isInteger(codePoint) && codePoint > 0 && codePoint <= 0x10ffff && codePoint !== 60 && codePoint !== 62
        ? String.fromCodePoint(codePoint)
        : entity
    })
}

function convertInlineMarkdown(line: string): string {
  const withLinks = line.replace(/!?\[([^\]]*)\]\(\s*(?:<([^>]+)>|((?:\\.|[^()\s]|\([^()\s]*\))+))(?:\s+["'][^"']*["'])?\s*\)/g,
    (_match, label: string, angledDestination: string, bareDestination: string) => {
      const destination = angledDestination ?? bareDestination
      const text = label.trim() || 'Image'
      return isSafeLink(destination) && destination !== text ? `${text} (${destination})` : text
    })

  return withLinks
    .replace(/`+([^`]+)`+/g, '$1')
    .replace(/(\*\*|__)(\S(?:.*?\S)?)\1/g, '$2')
    .replace(/~~(\S(?:.*?\S)?)~~/g, '$1')
    .replace(/(^|[\s([{])([*_])(\S(?:.*?\S)?)\2(?=$|[\s)\]},.!?;:])/g, '$1$3')
    .replace(/\\([\\`*_{}()#+.!<>|~-])/g, '$1')
    .replace(/\\\[/g, '[')
    .replace(/\\\]/g, ']')
}

function normalizeMarkdown(value: string): string {
  const source = stripHtmlMarkup(value)
    .replace(/^\uFEFF/, '')
    .replace(/\r\n?/g, '\n')
    .replace(/[\u2028\u2029]/g, '\n')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, '')
    .normalize('NFC')

  const lines = source.split('\n')
  const output: string[] = []
  let fence: { character: string; length: number } | null = null

  for (const originalLine of lines) {
    const fenceMatch = originalLine.match(/^\s{0,3}(`{3,}|~{3,})\s*([\w+-]{1,24})?.*$/)
    if (fenceMatch) {
      if (!fence) {
        fence = { character: fenceMatch[1][0], length: fenceMatch[1].length }
        output.push(fenceMatch[2] ? `Code (${fenceMatch[2]}):` : 'Code:')
      } else if (fenceMatch[1][0] === fence.character && fenceMatch[1].length >= fence.length) {
        fence = null
      } else {
        output.push(originalLine.trimEnd())
      }
      continue
    }

    if (fence) {
      output.push(originalLine.trimEnd())
      continue
    }

    let line = originalLine
      .replace(/^\s{0,3}#{1,6}\s+/, '')
      .replace(/^\s{0,3}>\s?/, '> ')
      .trimEnd()

    if (/^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line)) continue
    if (/^\s{0,3}(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line)) continue

    if (line.includes('|')) {
      line = line.trim().replace(/^\|\s*/, '').replace(/\s*\|$/, '')
      line = line.split('|').map(cell => cell.trim()).join(' | ')
    }

    output.push(convertInlineMarkdown(line))
  }

  return output
    .join('\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * Read and normalize a `.txt`, `.md`, or `.markdown` source without rendering
 * HTML. Raw sources can be passed as `{ name, content }` or as two arguments.
 */
export function parseTextSource(source: TextSourceInput): Promise<string>
export function parseTextSource(name: string, content?: string): Promise<string>
export async function parseTextSource(source: TextSourceInput | string, rawContent?: string): Promise<string> {
  let name: string
  let content: string

  if (typeof source === 'string') {
    if (typeof rawContent !== 'string') throw new Error('Provide both a filename and text content.')
    name = source
    content = rawContent
  } else if (isFileTextSource(source)) {
    name = source.name
    assertSupportedName(name)
    if (source.size > MAX_TEXT_SOURCE_BYTES) {
      throw new Error('Text source exceeds the 512 KiB file-size limit.')
    }
    try {
      content = await source.text()
    } catch {
      throw new Error('Could not read this text source. Try exporting it as UTF-8 plain text.')
    }
  } else {
    const raw = source as RawTextSource
    if (!raw || typeof raw.name !== 'string' || typeof raw.content !== 'string') {
      throw new Error('Provide a file or a filename and text content.')
    }
    name = raw.name
    content = raw.content
  }

  assertSupportedName(name)
  assertWithinLimits(content)

  const normalized = normalizeMarkdown(content)
  if (!normalized) throw new Error('Text source is empty after formatting is removed.')
  assertWithinLimits(normalized)
  return normalized
}
