// src/lib/pdfImport.ts

// ── Types ────────────────────────────────────────────────────────────────────

import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

interface PdfjsViewport {
  width: number
  height: number
}

interface PdfjsPage {
  getViewport: (opts: { scale: number }) => PdfjsViewport
  render: (opts: { canvasContext: CanvasRenderingContext2D; viewport: PdfjsViewport }) => { promise: Promise<void> }
  getTextContent?: () => Promise<{ items: Array<{ str?: string; hasEOL?: boolean }> }>
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
  textContent?: string
}

// ── Defaults (browser only) ──────────────────────────────────────────────────

const defaultCanvasMaker: CanvasMaker = {
  makeCanvas: (w: number, h: number) => {
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('pdfImport: could not acquire 2D canvas context')
    return {
      ctx,
      toDataURL: () => canvas.toDataURL('image/png'),
    }
  },
}

async function defaultPdfjsLoader(): Promise<PdfjsLib> {
  const lib = await import('pdfjs-dist') as unknown as PdfjsLib
  lib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl
  return lib
}

// ── Main function ────────────────────────────────────────────────────────────

function normalizeTextContent(items: Array<{ str?: string; hasEOL?: boolean }>): string {
  const lines: string[] = []
  let line = ''

  for (const item of items) {
    const text = item.str?.replace(/\s+/g, ' ').trim() ?? ''
    if (text) line = line ? `${line} ${text}` : text
    if (item.hasEOL && line) {
      lines.push(line)
      line = ''
    }
  }

  if (line) lines.push(line)
  return lines.join('\n')
}

export async function importPdf(
  file: File,
  canvasMaker: CanvasMaker = defaultCanvasMaker,
  pdfjsLoader: () => Promise<PdfjsLib> = defaultPdfjsLoader,
): Promise<RenderedPage[]> {
  const pdfjsLib = await pdfjsLoader()

  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  const pages: RenderedPage[] = []

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const viewport = page.getViewport({ scale: 1.5 })
    const { ctx, toDataURL } = canvasMaker.makeCanvas(viewport.width, viewport.height)
    await page.render({ canvasContext: ctx, viewport }).promise

    let textContent: string | undefined
    if (page.getTextContent) {
      try {
        const content = await page.getTextContent()
        textContent = normalizeTextContent(content.items)
      } catch {
        // Text extraction is best-effort; preserve the existing visual import.
      }
    }

    pages.push({
      dataUrl: toDataURL(),
      aspectRatio: viewport.width / viewport.height,
      ...(textContent !== undefined ? { textContent } : {}),
    })
  }

  return pages
}
