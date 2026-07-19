import { describe, it, expect } from 'vitest'
import { sanitizeHtml } from './sanitizeHtml'

describe('sanitizeHtml', () => {
  it('removes script tags and inline event handlers', () => {
    const html = '<p onclick="alert(1)">Hi<script>alert(2)</script></p>'

    expect(sanitizeHtml(html)).toBe('<p>Hi</p>')
  })

  it('removes javascript URLs while preserving safe links', () => {
    const html = '<a href="javascript:alert(1)">bad</a><a href="https://example.com">good</a>'

    expect(sanitizeHtml(html)).toBe('<a>bad</a><a href="https://example.com">good</a>')
  })
})
