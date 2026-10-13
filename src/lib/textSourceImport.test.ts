import { describe, expect, it, vi } from 'vitest'
import {
  MAX_TEXT_SOURCE_BYTES,
  MAX_TEXT_SOURCE_CHARACTERS,
  parseTextSource,
} from './textSourceImport'

describe('parseTextSource', () => {
  it('normalizes raw text, line endings, whitespace, and control characters', async () => {
    await expect(parseTextSource('meeting.txt', '\uFEFFFirst line  \r\n\r\n\r\nSecond\u0000 line\r'))
      .resolves.toBe('First line\n\nSecond line')
  })

  it('preserves useful Markdown headings, lists, tables, code, and safe link text', async () => {
    const result = await parseTextSource({
      name: 'campaign.MD',
      content: [
        '# Launch plan',
        '',
        '- **Research** the audience',
        '- Review [the brief](https://example.com/brief)',
        '',
        '| Channel | Owner |',
        '| --- | --- |',
        '| Email | Alex |',
        '',
        '```ts',
        'const launch = true',
        '```',
        '',
        '[unsafe](javascript:alert(1))',
      ].join('\n'),
    })

    expect(result).toContain('Launch plan')
    expect(result).toContain('- Research the audience')
    expect(result).toContain('the brief (https://example.com/brief)')
    expect(result).toContain('Channel | Owner')
    expect(result).toContain('Email | Alex')
    expect(result).toContain('Code (ts):\nconst launch = true')
    expect(result).toContain('unsafe')
    expect(result).not.toContain('javascript:')
    expect(result).not.toMatch(/<[^>]+>/)
  })

  it('strips HTML markup while keeping ordinary text and removing script content', async () => {
    const result = await parseTextSource('notes.txt', '<!DOCTYPE html><html><body><h2>Notes</h2><p>Keep <strong>this</strong>.</p><script>secret()</script></body></html>')

    expect(result).toBe('Notes\n\nKeep this.')
    expect(result).not.toContain('<')
    expect(result).not.toContain('secret')
  })

  it('accepts a File and checks its extension before reading it', async () => {
    const file = new File(['# From a file'], 'source.markdown', { type: 'text/markdown' })
    await expect(parseTextSource(file)).resolves.toBe('From a file')

    const oversized = {
      name: 'large.txt',
      size: MAX_TEXT_SOURCE_BYTES + 1,
      text: vi.fn(),
    } as unknown as File
    await expect(parseTextSource(oversized)).rejects.toThrow(/512 KiB/)
    expect(oversized.text).not.toHaveBeenCalled()
  })

  it('rejects unsupported extensions and missing raw content with clear errors', async () => {
    await expect(parseTextSource('notes.pdf', 'not text')).rejects.toThrow(/\.txt, \.md, or \.markdown/)
    await expect(parseTextSource('notes.md')).rejects.toThrow(/filename and text content/)
  })

  it('rejects empty content after removing formatting', async () => {
    await expect(parseTextSource({ name: 'empty.md', content: '<!-- comment -->\n<script>not source</script>' }))
      .rejects.toThrow(/empty after formatting is removed/)
  })

  it('enforces both the UTF-8 byte limit and the character limit', async () => {
    const tooManyBytes = '界'.repeat(Math.floor(MAX_TEXT_SOURCE_BYTES / 3) + 1)
    await expect(parseTextSource('large.md', tooManyBytes)).rejects.toThrow(/512 KiB/)

    const tooManyCharacters = 'x'.repeat(MAX_TEXT_SOURCE_CHARACTERS + 1)
    await expect(parseTextSource('large.txt', tooManyCharacters)).rejects.toThrow(/character limit/)
  })
})
