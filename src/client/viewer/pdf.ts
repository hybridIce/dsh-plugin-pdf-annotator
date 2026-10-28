/**
 * Opening a PDF with PDF.js: one module Worker per document, created from the
 * bundled worker source, and support files served from memory, mirroring
 * how DSH's built-in viewer runs PDF.js inside the app.
 */
import { getDocument, PDFWorker, type PDFDocumentProxy, type PDFPageProxy, type PageViewport } from 'pdfjs-dist'
import workerSource from 'pdfjs-dist/build/pdf.worker.min.mjs?raw'
import { TextLayerBuilder } from 'pdfjs-dist/web/pdf_viewer.mjs'

/** PDF points to CSS pixels at 100% zoom. */
export const CSS_UNITS = 96 / 72

/** Largest canvas bitmap, in pixels, before the render resolution is capped. */
const MAX_CANVAS_PIXELS = 16_777_216

const WORKER_READY = 'dsh-pdf-annotator-worker-ready'

type AssetKind = 'cMapUrl' | 'standardFontDataUrl' | 'wasmUrl'

/** PDF.js 6 asks this factory for CMaps, standard fonts and wasm decoders instead of fetching URLs. */
class BinaryDataFactory {
  fetch({ kind, filename }: { readonly kind: AssetKind; readonly filename: string }): Promise<Uint8Array> {
    return Promise.resolve().then(() => {
      const files = __PDFA_ASSETS__[kind]
      const data = Object.hasOwn(files, filename) ? files[filename] : undefined
      if (data === undefined) throw new Error(`PDF.js asset is not bundled: ${kind}/${filename}`)
      return Uint8Array.from(atob(data), character => character.charCodeAt(0))
    })
  }
}

/** A worker that failed to start or crashed. */
export class PdfWorkerFailure extends Error {
  constructor(event: Event) {
    super(event instanceof ErrorEvent && event.message !== '' ? event.message : 'PDF worker failed')
    this.name = 'PdfWorkerFailure'
  }
}

/** One loading document and its complete cleanup. */
export interface PdfSession {
  readonly document: Promise<PDFDocumentProxy>
  /** Destroy the document, the worker and its source URL; never rejects. */
  dispose(): Promise<void>
}

/**
 * Open complete PDF bytes.
 * @param data - file bytes; PDF.js receives a copy, so the caller's array stays usable.
 * @param onFailure - called when the worker dies after the document loaded.
 * @returns the pending document and its disposer.
 */
export function openPdf(data: Uint8Array<ArrayBuffer>, onFailure: (error: Error) => void): PdfSession {
  const url = URL.createObjectURL(new Blob([workerSource, `\nself.postMessage({type:${JSON.stringify(WORKER_READY)}});\n`], { type: 'text/javascript' }))
  const worker = new Worker(url, { type: 'module', name: 'dsh-pdf-annotator' })
  let bridge: PDFWorker | undefined
  let loading: ReturnType<typeof getDocument> | undefined
  let closing: Promise<void> | undefined
  const failed = Promise.withResolvers<never>()
  let disposed = false

  const workerFailed = (event: Event): void => {
    const error = new PdfWorkerFailure(event)
    failed.reject(error)
    if (!disposed) onFailure(error)
  }
  worker.addEventListener('error', workerFailed)
  worker.addEventListener('messageerror', workerFailed)
  // Keep an unobserved rejection from surfacing as an unhandled error.
  failed.promise.catch(() => {})

  const ready = new Promise<void>((resolve) => {
    const listener = (event: MessageEvent<unknown>): void => {
      const message = event.data
      if (typeof message !== 'object' || message === null || !('type' in message) || message.type !== WORKER_READY) return
      worker.removeEventListener('message', listener)
      resolve()
    }
    worker.addEventListener('message', listener)
  })

  const document = Promise.race([ready, failed.promise]).then(() => {
    bridge = PDFWorker.create({ port: worker })
    loading = getDocument({
      data: data.slice(),
      worker: bridge,
      BinaryDataFactory,
      cMapPacked: true,
      useWorkerFetch: false,
      enableXfa: false,
      stopAtErrors: false,
      isEvalSupported: false,
    } as Parameters<typeof getDocument>[0])
    return Promise.race([loading.promise, failed.promise])
  })

  const dispose = (): Promise<void> => {
    closing ??= (async () => {
      disposed = true
      try {
        await loading?.destroy()
      } catch (error) {
        console.error('[pdf-annotator] document cleanup failed', error)
      } finally {
        bridge?.destroy()
        worker.removeEventListener('error', workerFailed)
        worker.removeEventListener('messageerror', workerFailed)
        worker.terminate()
        URL.revokeObjectURL(url)
      }
    })()
    return closing
  }
  return { document, dispose }
}

/** Size of one page in CSS pixels at 100% zoom. */
export interface PageSize {
  readonly width: number
  readonly height: number
}

/**
 * Draw a page into a canvas at a pixel ratio, capped to a sane bitmap size.
 * @param page - loaded page.
 * @param canvas - canvas owned by this render.
 * @param pixelRatio - CSS-to-device scale times zoom.
 * @param signal - cancels the render.
 * @returns the page size at 100% zoom.
 */
export async function renderPage(page: PDFPageProxy, canvas: HTMLCanvasElement, pixelRatio: number, signal: AbortSignal): Promise<PageSize> {
  const viewport = page.getViewport({ scale: CSS_UNITS })
  const ratio = Math.min(pixelRatio, Math.sqrt(MAX_CANVAS_PIXELS / (viewport.width * viewport.height)))
  canvas.width = Math.max(1, Math.floor(viewport.width * ratio))
  canvas.height = Math.max(1, Math.floor(viewport.height * ratio))
  const task = page.render({
    canvas,
    viewport,
    transform: ratio === 1 ? undefined : [ratio, 0, 0, ratio, 0, 0],
  } as Parameters<PDFPageProxy['render']>[0])
  const cancel = (): void => { task.cancel() }
  signal.addEventListener('abort', cancel, { once: true })
  try {
    await task.promise
  } finally {
    signal.removeEventListener('abort', cancel)
  }
  return { width: viewport.width, height: viewport.height }
}

/** A text layer placed over a page; cancel() removes it and its observer. */
export interface TextLayerHandle {
  readonly done: Promise<void>
  cancel(): void
}

/**
 * Build the selectable text layer for a page inside `host`, which spans the
 * page box. The layer is laid out at 100% zoom and scaled with the box, so
 * zooming never rebuilds it.
 */
export function renderTextLayer(page: PDFPageProxy, host: HTMLElement): TextLayerHandle {
  const viewport: PageViewport = page.getViewport({ scale: CSS_UNITS })
  const layer = new TextLayerBuilder({ pdfPage: page })
  const container = layer.div
  container.style.setProperty('--total-scale-factor', String(viewport.scale * viewport.userUnit))
  container.style.setProperty('--scale-round-x', '1px')
  container.style.setProperty('--scale-round-y', '1px')
  host.append(container)
  const resize = (): void => {
    container.style.scale = String(host.getBoundingClientRect().width / viewport.width)
  }
  const observer = new ResizeObserver(resize)
  observer.observe(host)
  resize()
  return {
    // PDF.js 6 types `images` as required; the viewer renders text-only layers without it.
    done: layer.render({ viewport } as Parameters<TextLayerBuilder['render']>[0]),
    cancel() {
      observer.disconnect()
      layer.cancel()
      container.remove()
    },
  }
}
