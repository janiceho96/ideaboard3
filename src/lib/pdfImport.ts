// src/lib/pdfImport.ts

// ── Types ────────────────────────────────────────────────────────────────────

interface PdfjsViewport {
  width: number
  height: number
}

interface PdfjsPage {
  getViewport: (opts: { scale: number }) => PdfjsViewport
  render: (opts: { canvasContext: CanvasRenderingContext2D; viewport: PdfjsViewport }) => { promise: Promise<void> }
}

interface PdfjsDoc {
  numPages: number
  getPage: (n: number) => Promise<PdfjsPage>
}

export interface PdfjsLib {
  GlobalWorkerOptions: { workerSrc: string }
  getDocument: (src: { data: ArrayBuffer }) => { promise: Promise<PdfjsDoc> }
}

export interface CanvasMaker {
  makeCanvas: (w: number, h: number) => {
    ctx: CanvasRenderingContext2D
    toDataURL: () => string
  }
}

export interface RenderedPage {
  dataUrl: string
  aspectRatio: number  // width / height
}

// ── Defaults (browser only) ──────────────────────────────────────────────────

const defaultCanvasMaker: CanvasMaker = {
  makeCanvas: (w: number, h: number) => {
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    return {
      ctx: canvas.getContext('2d')!,
      toDataURL: () => canvas.toDataURL('image/png'),
    }
  },
}

async function defaultPdfjsLoader(): Promise<PdfjsLib> {
  const lib = await import(
    /* @vite-ignore */ 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4/build/pdf.min.mjs'
  ) as unknown as PdfjsLib
  return lib
}

// ── Main function ────────────────────────────────────────────────────────────

export async function importPdf(
  file: File,
  canvasMaker: CanvasMaker = defaultCanvasMaker,
  pdfjsLoader: () => Promise<PdfjsLib> = defaultPdfjsLoader,
): Promise<RenderedPage[]> {
  const pdfjsLib = await pdfjsLoader()
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdn.jsdelivr.net/npm/pdfjs-dist@4/build/pdf.worker.min.mjs'

  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  const pages: RenderedPage[] = []

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const viewport = page.getViewport({ scale: 1.5 })
    const { ctx, toDataURL } = canvasMaker.makeCanvas(viewport.width, viewport.height)
    await page.render({ canvasContext: ctx, viewport }).promise
    pages.push({
      dataUrl: toDataURL(),
      aspectRatio: viewport.width / viewport.height,
    })
  }

  return pages
}
