import { describe, expect, it } from 'vitest'
import { AssistantExplanationStream } from './assistantStream'

describe('assistant explanation streaming', () => {
  it('reveals only the top-level explanation as JSON arrives in pieces', () => {
    const stream = new AssistantExplanationStream()
    expect(stream.push('{"assumptions":[],"cards":[],"explanation":"A focused ')).toBe('A focused')
    expect(stream.push('plan for the launch."}')).toBe('A focused plan for the launch.')
    expect(stream.summary).toBe('A focused plan for the launch.')
  })

  it('decodes split escapes and ignores nested fields with the same name', () => {
    const stream = new AssistantExplanationStream()
    expect(stream.push('{"metadata":{"explanation":"not for display"},"explanation":"Keep ')).toBe('Keep')
    expect(stream.push('it \\"clear\\" and use \\u00E9vidence"}')).toBe('Keep it "clear" and use évidence')
  })

  it('does not expose malformed or out-of-order partial content', () => {
    const stream = new AssistantExplanationStream()
    expect(stream.push('{"cards":[{"explanation":"private nested text"}]')).toBeNull()
    expect(stream.push(',"explanation":"A summary')).toBe('A summary')
    expect(stream.push('\\q"}')).toBeNull()
    expect(stream.summary).toBe('A summary')
  })

  it('bounds retained input and the visible summary', () => {
    const stream = new AssistantExplanationStream()
    expect(stream.push(`{"explanation":"${'x'.repeat(400)}`)).toHaveLength(280)
    expect(stream.push('y'.repeat(70_000))).toBeNull()
    expect(stream.isCapped).toBe(true)
  })
})
