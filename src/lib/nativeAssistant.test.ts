import { afterEach, describe, expect, it, vi } from 'vitest'
import { extractNativeImageText, generateNativeAssistant, hasNativeAssistant, nativeAIRequest, nativeAIStatus } from './nativeAssistant'

interface Request { id: string; method: string; payload: Record<string, unknown> }
function fixture(reply?: (request: Request) => unknown) {
  const requests: Request[] = []
  const host = {
    ideaboardAIReply: (_value: unknown) => {},
    webkit: { messageHandlers: { ideaboardAI: { postMessage: (request: Request) => {
      requests.push(request)
      if (reply) host.ideaboardAIReply(reply(request))
    } } } },
  }
  vi.stubGlobal('window', host)
  return { host, requests }
}
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers() })

describe('native AI bridge data contract', () => {
  it('reports browser unavailability and never sends a request', async () => {
    vi.stubGlobal('window', {})
    expect(hasNativeAssistant()).toBe(false)
    expect(await nativeAIStatus()).toEqual({ available: false, configured: false })
    await expect(nativeAIRequest('generate')).rejects.toThrow('installed Mac app')
  })
  it('correlates typed native status replies with the posted request ID', async () => {
    const { requests } = fixture(r => ({ id: r.id, ok: true, result: { configured: true, provider: 'openai', model: 'user-selected-model' } }))
    expect(await nativeAIStatus()).toEqual({ available: true, configured: true, provider: 'openai', model: 'user-selected-model' })
    expect(requests[0]).toMatchObject({ method: 'status', payload: {} })
    expect(requests[0].id).toMatch(/^[a-f0-9-]+$/)
  })
  it('requests local OCR through the native host without involving AI generation', async () => {
    const { requests } = fixture(r => ({ id: r.id, ok: true, result: { text: 'Visible words' } }))
    await expect(extractNativeImageText('data:image/jpeg;base64,AAAA')).resolves.toBe('Visible words')
    expect(requests[0]).toMatchObject({ method: 'extractText', payload: { dataUrl: 'data:image/jpeg;base64,AAAA' } })
  })
  it('passes output as data and keeps the native instruction/input shape intact', async () => {
    const payload = { instruction: 'Draft', input: '{"goal":"Cafe"}' }
    const { requests } = fixture(r => ({ id: r.id, ok: true, result: { explanation: '<script>never execute</script>', cards: [] } }))
    expect(await generateNativeAssistant(payload, new AbortController().signal)).toMatchObject({ explanation: '<script>never execute</script>' })
    expect(requests[0]).toMatchObject({ method: 'generate', payload })
  })
  it('streams output deltas without resolving until the validated final reply arrives', async () => {
    const { host, requests } = fixture()
    const deltas: string[] = []
    let completed = false
    const result = nativeAIRequest('generate', { instruction: 'Draft', input: '{}' }, undefined, text => deltas.push(text))
    void result.then(() => { completed = true })
    host.ideaboardAIReply({ id: requests[0].id, ok: true, event: 'delta', result: { text: '{"explanation":"A draft' } })
    await Promise.resolve()
    expect(deltas).toEqual(['{"explanation":"A draft'])
    expect(completed).toBe(false)
    host.ideaboardAIReply({ id: requests[0].id, ok: true, result: { explanation: 'A draft', cards: [] } })
    await expect(result).resolves.toEqual({ explanation: 'A draft', cards: [] })
    expect(completed).toBe(true)
  })
  it('retains provider failure messages for a user-directed retry', async () => {
    fixture(r => ({ id: r.id, ok: false, error: { code: 'provider_unconfigured', message: 'Configure a personal API key in AI Settings.' } }))
    await expect(nativeAIRequest('generate')).rejects.toThrow('personal API key')
  })
  it('cancels once with the original requestId and ignores late/duplicate replies', async () => {
    const { host, requests } = fixture()
    const controller = new AbortController()
    const result = nativeAIRequest('generate', { instruction: 'Draft', input: '{}' }, controller.signal)
    controller.abort()
    await expect(result).rejects.toThrow('stopped')
    expect(requests).toHaveLength(2)
    expect(requests[1]).toMatchObject({ method: 'cancel', payload: { requestId: requests[0].id } })
    expect(() => host.ideaboardAIReply({ id: requests[0].id, ok: true, result: { anything: true } })).not.toThrow()
    controller.abort()
    expect(requests).toHaveLength(2)
  })
  it('bounds waits and cancels a request that stops replying', async () => {
    vi.useFakeTimers()
    const { requests } = fixture()
    const result = nativeAIRequest('generate')
    const check = expect(result).rejects.toThrow('timed out')
    await vi.advanceTimersByTimeAsync(120000)
    await check
    expect(requests[1].method).toBe('cancel')
  })
  it('leaves enough time for native settings entry and accepts the sheet-close status', async () => {
    vi.useFakeTimers()
    const { host, requests } = fixture()
    const result = nativeAIRequest('settings')
    await vi.advanceTimersByTimeAsync(16000)
    expect(requests).toHaveLength(1)
    host.ideaboardAIReply({ id: requests[0].id, ok: true, result: { configured: true } })
    expect(await result).toEqual({ configured: true })
  })
  it('rejects malformed successful statuses and non-JSON generation output', async () => {
    fixture(r => ({ id: r.id, ok: true, result: 'not JSON' }))
    await expect(nativeAIStatus()).rejects.toThrow('invalid AI status')
    await expect(generateNativeAssistant({}, new AbortController().signal)).rejects.toThrow('structured board draft')
  })
})
