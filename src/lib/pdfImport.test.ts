import { describe, it, expect } from 'vitest'
import { importPdf } from './pdfImport'
import type { PdfjsLib, CanvasMaker } from './pdfImport'

// Mock PDF.js: 2-page document, pages are 800×600 at scale=1 (so 1200×900 at scale=1.5)
const mockPdfjs: PdfjsLib = {
  GlobalWorkerOptions: { workerSrc: '' },
  getDocument: (_src) => ({
    promise: Promise.resolve({
      numPages: 2,
      getPage: async (_n: number) => ({
        getViewport: ({ scale }: { scale: number }) => ({
          width: 800 * scale,
          height: 600 * scale,
        }),
        render: (_opts: unknown) => ({ promise: Promise.resolve() }),
      }),
    }),
  }),
}

// Mock canvas: toDataURL returns a predictable string
const mockCanvasMaker: CanvasMaker = {
  makeCanvas: (w: number, h: number) => ({
    ctx: {} as CanvasRenderingContext2D,
    toDataURL: () => `data:image/png;base64,mock_${w}x${h}`,
  }),
}

function makeFile(name = 'test.pdf'): File {
  return new File([new Uint8Array([1, 2, 3])], name, { type: 'application/pdf' })
}

describe('importPdf', () => {
  it('returns one RenderedPage per PDF page', async () => {
    const pages = await importPdf(makeFile(), mockCanvasMaker, () => Promise.resolve(mockPdfjs))
    expect(pages).toHaveLength(2)
  })

  it('renders at 1.5x scale — width is 800 * 1.5 = 1200', async () => {
    const pages = await importPdf(makeFile(), mockCanvasMaker, () => Promise.resolve(mockPdfjs))
    expect(pages[0].dataUrl).toContain('1200x')
  })

  it('aspectRatio is width / height', async () => {
    const pages = await importPdf(makeFile(), mockCanvasMaker, () => Promise.resolve(mockPdfjs))
    // width=1200, height=900 → ratio = 1200/900 ≈ 1.333
    expect(pages[0].aspectRatio).toBeCloseTo(1200 / 900)
  })

  it('each page has a non-empty dataUrl starting with data:', async () => {
    const pages = await importPdf(makeFile(), mockCanvasMaker, () => Promise.resolve(mockPdfjs))
    for (const p of pages) {
      expect(p.dataUrl.startsWith('data:')).toBe(true)
    }
  })
})
