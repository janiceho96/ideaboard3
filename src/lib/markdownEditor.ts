import { Lexer, type Token, type Tokens } from 'marked'

export type MarkdownCommand =
  | 'bold'
  | 'italic'
  | 'heading'
  | 'bullet-list'
  | 'numbered-list'
  | 'checklist'
  | 'highlight'
  | 'link'

export interface MarkdownEdit {
  value: string
  selectionStart: number
  selectionEnd: number
}

export function isSafeMarkdownLink(url: string): boolean {
  if (!/^(?:https?:\/\/|mailto:|tel:|#|\/)/i.test(url.trim())) return false
  return [...url].every(character => {
    const code = character.charCodeAt(0)
    return code > 0x20 && (code < 0x7f || code > 0x9f) && character !== '<' && character !== '>'
  })
}

function wrapSelection(
  value: string,
  start: number,
  end: number,
  before: string,
  after: string,
  placeholder: string,
): MarkdownEdit {
  const selected = value.slice(start, end) || placeholder
  const next = value.slice(0, start) + before + selected + after + value.slice(end)
  const selectionStart = start + before.length
  return {
    value: next,
    selectionStart,
    selectionEnd: selectionStart + selected.length,
  }
}

function editLines(
  value: string,
  start: number,
  end: number,
  transform: (line: string, index: number, allLinesToggle: boolean) => string,
  isFormatted: (line: string) => boolean,
): MarkdownEdit {
  const lineStart = value.lastIndexOf('\n', Math.max(0, start - 1)) + 1
  const endLineBreak = value.indexOf('\n', end)
  const lineEnd = endLineBreak === -1 ? value.length : endLineBreak
  const source = value.slice(lineStart, lineEnd)
  const lines = source.split('\n')
  const nonEmpty = lines.map((line, index) => ({ line, index })).filter(item => item.line.trim())
  const remove = nonEmpty.length > 0 && nonEmpty.every(item => isFormatted(item.line))
  const nextLines = lines.map((line, index) => transform(line, index, remove))
  const next = value.slice(0, lineStart) + nextLines.join('\n') + value.slice(lineEnd)
  return {
    value: next,
    selectionStart: lineStart,
    selectionEnd: lineStart + nextLines.join('\n').length,
  }
}

function applyList(value: string, start: number, end: number, kind: 'bullet' | 'number' | 'check'): MarkdownEdit {
  const pattern = kind === 'bullet' ? /^([ \t]*)(?:[-+*])\s+/ : kind === 'number' ? /^([ \t]*)\d+[.)]\s+/ : /^([ \t]*)[-+*]\s+\[[ xX]\]\s*/
  let number = 0
  return editLines(value, start, end, (line, _index, remove) => {
    if (!line.trim()) return line
    number += 1
    const existing = pattern.exec(line)
    if (remove) return existing ? line.slice(0, existing[0].length - existing[0].trimStart().length) + line.slice(existing[0].length) : line
    const indentation = existing?.[1] ?? (/^[ \t]*/.exec(line)?.[0] ?? '')
    const content = existing ? line.slice(existing[0].length) : line.slice(indentation.length)
    const prefix = kind === 'bullet' ? '- ' : kind === 'number' ? `${number}. ` : '- [ ] '
    return indentation + prefix + content
  }, line => pattern.test(line))
}

export function formatMarkdown(
  value: string,
  start: number,
  end: number,
  command: MarkdownCommand,
  color = 'yellow',
  linkUrl = 'https://example.com',
): MarkdownEdit {
  if (command === 'bold') return wrapSelection(value, start, end, '**', '**', 'bold text')
  if (command === 'italic') return wrapSelection(value, start, end, '*', '*', 'italic text')
  if (command === 'highlight') return wrapSelection(value, start, end, `{{ib-highlight:${color}}}`, '{{/ib-highlight}}', 'highlighted text')
  if (command === 'link') return wrapSelection(value, start, end, '[', `](${linkUrl})`, 'link text')
  if (command === 'bullet-list') return applyList(value, start, end, 'bullet')
  if (command === 'numbered-list') return applyList(value, start, end, 'number')
  if (command === 'checklist') return applyList(value, start, end, 'check')

  return editLines(value, start, end, (line, _index, remove) => {
    if (!line.trim()) return line
    const indentation = /^[ \t]*/.exec(line)?.[0] ?? ''
    const content = line.slice(indentation.length)
    if (remove && /^##\s/.test(content)) return indentation + content.replace(/^##\s+/, '')
    return indentation + `## ${content.replace(/^#{1,6}\s+/, '')}`
  }, line => /^\s*##\s/.test(line))
}

function taskItemRaw(tokens: readonly Token[], result: string[]): void {
  for (const token of tokens) {
    if (token.type === 'list') {
      for (const item of (token as Tokens.List).items) {
        if (item.task) result.push(item.raw)
        taskItemRaw(item.tokens, result)
      }
    } else if (token.type === 'blockquote') {
      taskItemRaw((token as Tokens.Blockquote).tokens, result)
    }
  }
}

/** Updates one rendered GFM checkbox in its Markdown source, including nested lists. */
export function toggleMarkdownChecklistItem(value: string, index: number, checked: boolean): string {
  if (!Number.isInteger(index) || index < 0) return value
  const tasks: string[] = []
  taskItemRaw(Lexer.lex(value, { gfm: true, breaks: true }), tasks)
  if (index >= tasks.length) return value

  let searchFrom = 0
  for (let taskIndex = 0; taskIndex <= index; taskIndex += 1) {
    const raw = tasks[taskIndex]
    const rawStart = value.indexOf(raw, searchFrom)
    if (rawStart === -1) return value
    const marker = /\[([ xX])\]/.exec(raw)
    if (!marker) return value
    const markerStart = rawStart + marker.index
    searchFrom = markerStart + marker[0].length
    if (taskIndex === index) {
      const nextMark = checked ? 'x' : ' '
      return value.slice(0, markerStart + 1) + nextMark + value.slice(markerStart + 2)
    }
  }
  return value
}
