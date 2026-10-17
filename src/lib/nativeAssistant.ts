export interface NativeAIStatus {
  available: boolean
  configured: boolean
  provider?: string
  model?: string
}
interface NativeMessage {
  id: string
  method: string
  payload: Record<string, unknown>
}
interface NativeReply {
  id: string
  ok: boolean
  event?: string
  result?: unknown
  error?: { code?: string; message?: string }
}
interface NativeHost {
  webkit?: { messageHandlers?: { ideaboardAI?: { postMessage: (message: NativeMessage) => void } } }
  ideaboardAIReply?: (reply: unknown) => void
}
interface PendingRequest {
  resolve: (value: unknown) => void
  reject: (error: Error) => void
  onDelta?: (text: string) => void
}

export class NativeAIRequestError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message)
    this.name = 'NativeAIRequestError'
  }
}
const pending = new Map<string, PendingRequest>()
let installedHost: NativeHost | undefined

export function hasNativeAssistant(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof (window as NativeHost).webkit?.messageHandlers?.ideaboardAI?.postMessage === 'function'
  )
}

function installReply(host: NativeHost) {
  if (installedHost === host) return
  installedHost = host
  // Only the native service calls this data callback. Model JSON never becomes code
  // or calls board operations here; it must pass the task validator first.
  host.ideaboardAIReply = (value: unknown) => {
    if (!value || typeof value !== 'object') return
    const reply = value as NativeReply
    if (typeof reply.id !== 'string' || typeof reply.ok !== 'boolean') return
    const request = pending.get(reply.id)
    if (!request) return // cancelled, timed-out or duplicate reply
    if (reply.event === 'delta') {
      if (reply.ok && typeof (reply.result as { text?: unknown } | undefined)?.text === 'string') {
        try {
          request.onDelta?.((reply.result as { text: string }).text)
        } catch {
          /* UI observers cannot break the native request */
        }
      }
      return
    }
    pending.delete(reply.id)
    if (reply.ok) request.resolve(reply.result)
    else
      request.reject(
        new NativeAIRequestError(
          typeof reply.error?.code === 'string' ? reply.error.code : 'unknown_error',
          typeof reply.error?.message === 'string'
            ? reply.error.message
            : 'AI could not complete the request. Check native AI settings and try again.',
        ),
      )
  }
}

export function nativeAIRequest(
  method: 'status' | 'settings' | 'generate' | 'extractText',
  payload: Record<string, unknown> = {},
  signal?: AbortSignal,
  onDelta?: (text: string) => void,
): Promise<unknown> {
  if (!hasNativeAssistant())
    return Promise.reject(
      new Error(
        'AI is available in the installed Mac app. Browser notes and frameworks remain available.',
      ),
    )
  const host = window as NativeHost
  installReply(host)
  const handler = host.webkit!.messageHandlers!.ideaboardAI!
  const id = crypto.randomUUID()
  return new Promise((resolve, reject) => {
    const finish = () => {
      clearTimeout(timer)
      signal?.removeEventListener('abort', stop)
      pending.delete(id)
    }
    const cancelRequest = (message: string) => {
      finish()
      try {
        handler.postMessage({
          id: crypto.randomUUID(),
          method: 'cancel',
          payload: { requestId: id },
        })
      } catch {
        /* local cancellation still wins */
      }
      reject(new Error(message))
    }
    const stop = () =>
      cancelRequest('Generation stopped. Your request is kept; generate again when ready.')
    if (signal?.aborted) {
      reject(new Error('Generation stopped.'))
      return
    }
    const timer = setTimeout(
      () => {
        cancelRequest(
          'The AI request timed out. Your request is kept; check the connection before trying again.',
        )
      },
      method === 'generate'
        ? 120000
        : method === 'settings'
          ? 600000
          : method === 'extractText'
            ? 30000
            : 15000,
    )
    pending.set(id, {
      onDelta,
      resolve: (value) => {
        finish()
        resolve(value)
      },
      reject: (error) => {
        finish()
        reject(error)
      },
    })
    signal?.addEventListener('abort', stop, { once: true })
    try {
      handler.postMessage({ id, method, payload })
    } catch (error) {
      finish()
      reject(error instanceof Error ? error : new Error('The Mac AI connection is unavailable.'))
    }
  })
}

export async function nativeAIStatus(): Promise<NativeAIStatus> {
  if (!hasNativeAssistant()) return { available: false, configured: false }
  const value = await nativeAIRequest('status')
  if (!value || typeof value !== 'object')
    throw new Error('The Mac app returned an invalid AI status.')
  const s = value as Record<string, unknown>
  return {
    available: true,
    configured: s.configured === true,
    provider: typeof s.provider === 'string' ? s.provider : undefined,
    model: typeof s.model === 'string' ? s.model : undefined,
  }
}

export async function generateNativeAssistant(
  payload: Record<string, unknown>,
  signal: AbortSignal,
  onDelta?: (text: string) => void,
): Promise<unknown> {
  const value = await nativeAIRequest('generate', payload, signal, onDelta)
  if (typeof value === 'string') {
    try {
      return JSON.parse(value)
    } catch {
      throw new Error(
        'The assistant returned text instead of a structured board draft. Try a more focused goal.',
      )
    }
  }
  return value
}

export function shouldRepairAssistantDraft(error: unknown): boolean {
  if (error instanceof NativeAIRequestError) return error.code === 'invalid_response'
  if (!(error instanceof Error)) return false
  return /(?:structured board draft|invalid object|returned an invalid|unsupported framework|unauthorized framework|section that does not exist|different action than requested|missing its framework recommendation|did not identify a framework|no framework was drafted|no sections were drafted|invalid source references|missing or oversized writing|response is too large|assistant response is too large|too many items or an invalid list|duplicate section writes|each new framework must have writing)/i.test(
    error.message,
  )
}

export async function generateValidatedAssistantDraft<T>(
  payload: Record<string, unknown>,
  signal: AbortSignal,
  validate: (value: unknown) => T,
  onDelta?: (text: string) => void,
  onRepair?: () => void,
): Promise<T> {
  let firstError: unknown
  try {
    return validate(await generateNativeAssistant(payload, signal, onDelta))
  } catch (error) {
    firstError = error
  }
  if (signal.aborted || !shouldRepairAssistantDraft(firstError)) throw firstError
  const instruction = payload.instruction
  const repairNote = `\n\nOne correction attempt: the previous draft failed the app's output checks. Re-read the original request and return corrected JSON that follows the same requested action, targets, sources, and scope. Do not widen permissions or change existing writing. Validation issue: ${firstError instanceof Error ? firstError.message : 'invalid draft'}`
  if (typeof instruction !== 'string' || instruction.length + repairNote.length > 8192)
    throw firstError
  onRepair?.()
  if (signal.aborted) throw new Error('Generation stopped. Your request is kept.')
  const repairedPayload = { ...payload, instruction: instruction + repairNote }
  return validate(await generateNativeAssistant(repairedPayload, signal, onDelta))
}

export async function extractNativeImageText(dataUrl: string): Promise<string> {
  const value = await nativeAIRequest('extractText', { dataUrl })
  if (
    !value ||
    typeof value !== 'object' ||
    typeof (value as Record<string, unknown>).text !== 'string'
  )
    throw new Error('The Mac app returned an invalid OCR result.')
  return (value as { text: string }).text
}
