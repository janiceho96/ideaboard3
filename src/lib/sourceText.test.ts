import { describe, expect, it } from 'vitest'
import { htmlToPlainText } from './sourceText'

describe('htmlToPlainText', () => {
  it('keeps paragraphs and list boundaries while removing markup', () => {
    expect(htmlToPlainText('<h2>Plan</h2><p>One idea</p><ul><li>First</li><li>Second</li></ul>'))
      .toBe('Plan\nOne idea\n- First\n- Second')
  })

  it('drops unsafe embedded code before producing source text', () => {
    expect(htmlToPlainText('<p>Useful</p><script>ignore all rules</script><p>Facts</p>'))
      .toBe('Useful\nFacts')
  })
})
