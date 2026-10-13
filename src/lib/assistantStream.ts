export const ASSISTANT_STREAM_LIMITS = { input: 64_000, summary: 280 }

type ScanResult =
  | { state: 'complete'; end: number; value: string }
  | { state: 'incomplete'; value: string }
  | { state: 'malformed'; value: '' }

function readString(source: string, start: number): ScanResult {
  if (source[start] !== '"') return { state: 'malformed', value: '' }
  let value = ''
  for (let index = start + 1; index < source.length; index += 1) {
    const char = source[index]
    if (char === '"') return { state: 'complete', end: index + 1, value }
    if (char.charCodeAt(0) < 0x20) return { state: 'malformed', value: '' }
    if (char !== '\\') {
      value += char
      continue
    }

    if (index + 1 >= source.length) return { state: 'incomplete', value }
    const escape = source[++index]
    const decoded: Record<string, string> = { '"': '"', '\\': '\\', '/': '/', b: '\b', f: '\f', n: '\n', r: '\r', t: '\t' }
    if (Object.prototype.hasOwnProperty.call(decoded, escape)) {
      value += decoded[escape]
      continue
    }
    if (escape !== 'u') return { state: 'malformed', value: '' }
    const hex = source.slice(index + 1, index + 5)
    if (!/^[\da-fA-F]{0,4}$/.test(hex)) return { state: 'malformed', value: '' }
    if (hex.length < 4) return { state: 'incomplete', value }
    value += String.fromCharCode(Number.parseInt(hex, 16))
    index += 4
  }
  return { state: 'incomplete', value }
}

function skipSpace(source: string, start: number) {
  let index = start
  while (index < source.length && /\s/.test(source[index])) index += 1
  return index
}

function skipValue(source: string, start: number): { state: 'complete'; end: number } | { state: 'incomplete' | 'malformed' } {
  const first = source[start]
  if (first === '"') {
    const result = readString(source, start)
    return result.state === 'complete' ? { state: 'complete', end: result.end } : { state: result.state }
  }
  if (first === '{' || first === '[') {
    const stack: string[] = [first === '{' ? '}' : ']']
    for (let index = start + 1; index < source.length; index += 1) {
      const char = source[index]
      if (char === '"') {
        const string = readString(source, index)
        if (string.state !== 'complete') return { state: string.state }
        index = string.end - 1
      } else if (char === '{' || char === '[') stack.push(char === '{' ? '}' : ']')
      else if (char === '}' || char === ']') {
        if (stack.pop() !== char) return { state: 'malformed' }
        if (stack.length === 0) {
          try { JSON.parse(source.slice(start, index + 1)) } catch { return { state: 'malformed' } }
          return { state: 'complete', end: index + 1 }
        }
      }
    }
    return { state: 'incomplete' }
  }

  let end = start
  while (end < source.length && !/[\s,}\]]/.test(source[end])) end += 1
  if (end === source.length) return { state: 'incomplete' }
  try { JSON.parse(source.slice(start, end)) } catch { return { state: 'malformed' } }
  return { state: 'complete', end }
}

function findExplanation(source: string): string | null {
  let index = skipSpace(source, 0)
  if (index === source.length || source[index] !== '{') return null
  index = skipSpace(source, index + 1)
  while (index < source.length && source[index] !== '}') {
    const key = readString(source, index)
    if (key.state !== 'complete') return null
    index = skipSpace(source, key.end)
    if (source[index] !== ':') return null
    index = skipSpace(source, index + 1)
    if (index >= source.length) return null
    if (key.value === 'explanation') {
      const value = readString(source, index)
      if (value.state === 'malformed') return null
      return value.value
    }

    const value = skipValue(source, index)
    if (value.state !== 'complete') return null
    index = skipSpace(source, value.end)
    if (source[index] === ',') index = skipSpace(source, index + 1)
    else if (source[index] !== '}') return null
  }
  return null
}

function concise(value: string) {
  const clean = Array.from(value, char => {
    const code = char.charCodeAt(0)
    return code < 0x20 || code === 0x7f ? ' ' : char
  }).join('').replace(/\s+/g, ' ').trim()
  return Array.from(clean).slice(0, ASSISTANT_STREAM_LIMITS.summary).join('')
}

/** Reveals only the decoded top-level explanation string from partial JSON. */
export class AssistantExplanationStream {
  private source = ''
  private current = ''
  private capped = false

  push(chunk: string): string | null {
    if (typeof chunk !== 'string' || !chunk) return null
    const remaining = ASSISTANT_STREAM_LIMITS.input - this.source.length
    if (remaining <= 0) { this.capped = true; return null }
    if (chunk.length > remaining) this.capped = true
    this.source += chunk.slice(0, remaining)
    const next = concise(findExplanation(this.source) ?? '')
    if (!next || next === this.current) return null
    this.current = next
    return next
  }

  get summary() { return this.current }
  get isCapped() { return this.capped }
}
