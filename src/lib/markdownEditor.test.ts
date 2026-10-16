import { describe, expect, it } from 'vitest'
import { formatMarkdown, isSafeMarkdownLink, toggleMarkdownChecklistItem } from './markdownEditor'

describe('Markdown editor commands', () => {
  it('wraps selected text and places the caret inside an empty format', () => {
    expect(formatMarkdown('Keep this idea', 10, 14, 'bold')).toMatchObject({
      value: 'Keep this **idea**', selectionStart: 12, selectionEnd: 16,
    })
    expect(formatMarkdown('Keep this ', 10, 10, 'italic')).toMatchObject({
      value: 'Keep this *italic text*', selectionStart: 11, selectionEnd: 22,
    })
  })

  it('formats multiple lines and toggles headings and list markers off again', () => {
    const heading = formatMarkdown('Decision\nNext step', 0, 19, 'heading')
    expect(heading.value).toBe('## Decision\n## Next step')
    expect(formatMarkdown(heading.value, 0, heading.value.length, 'heading').value).toBe('Decision\nNext step')

    const list = formatMarkdown('First\nSecond', 0, 12, 'bullet-list')
    expect(list.value).toBe('- First\n- Second')
    expect(formatMarkdown(list.value, 0, list.value.length, 'bullet-list').value).toBe('First\nSecond')
    expect(formatMarkdown('First\nSecond', 0, 12, 'numbered-list').value).toBe('1. First\n2. Second')
  })

  it('inserts exact highlight markers and link templates', () => {
    expect(formatMarkdown('Keep this idea', 10, 14, 'highlight', 'mint').value)
      .toBe('Keep this {{ib-highlight:mint}}idea{{/ib-highlight}}')
    expect(formatMarkdown('Read this', 5, 9, 'link', 'yellow', 'https://example.org/guide').value)
      .toBe('Read [this](https://example.org/guide)')
    expect(isSafeMarkdownLink('mailto:hello@example.org')).toBe(true)
    expect(isSafeMarkdownLink('javascript:alert(1)')).toBe(false)
  })

  it('toggles selected checkboxes without treating fenced code as a task', () => {
    const source = '```md\n- [ ] code sample\n```\n\n- [ ] First\n  - [ ] Nested\n- [x] Last'
    expect(toggleMarkdownChecklistItem(source, 0, true)).toContain('- [x] First')
    expect(toggleMarkdownChecklistItem(source, 1, true)).toContain('  - [x] Nested')
    expect(toggleMarkdownChecklistItem(source, 2, false)).toContain('- [ ] Last')
    expect(toggleMarkdownChecklistItem(source, 3, true)).toBe(source)
  })
})
