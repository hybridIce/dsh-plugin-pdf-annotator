/** One PDF page: canvas, highlight layer, selectable text layer, rendered only near the viewport. */
import { memo, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist'
import type { PageMark } from './marks.ts'
import { renderPage, renderTextLayer, type PageSize, type TextLayerHandle } from './pdf.ts'

/** Props for one page. */
export interface PageViewProps {
  readonly doc: PDFDocumentProxy
  readonly page: number
  /** Page size at 100% zoom, CSS pixels. */
  readonly size: PageSize
  /** CSS zoom applied to `size`. */
  readonly scale: number
  /** The scroll container, for visibility tracking. */
  readonly root: HTMLElement | null
  readonly marks: readonly PageMark[]
  readonly label: string
  readonly onSize: (page: number, size: PageSize) => void
}

/** Renders begin this far outside the viewport, and pages farther than `RELEASE_MARGIN` free their bitmaps. */
const RENDER_MARGIN = '120% 0px'
const RELEASE_MARGIN = '400% 0px'
/** Wait for zoom gestures to settle before redrawing at the new resolution. */
const RERENDER_DELAY_MS = 160

function isCancellation(error: unknown): boolean {
  return error instanceof Error && (error.name === 'RenderingCancelledException' || error.name === 'AbortError' || error.name === 'AbortException')
}

/** Observe whether an element is within a margin of the scroll container's viewport. */
function useNear(element: HTMLElement | null, root: HTMLElement | null, margin: string): boolean {
  const [near, setNear] = useState(false)
  useEffect(() => {
    if (element === null || root === null) return
    const observer = new IntersectionObserver(entries => {
      setNear(entries.some(entry => entry.isIntersecting))
    }, { root, rootMargin: margin })
    observer.observe(element)
    return () => { observer.disconnect() }
  }, [element, root, margin])
  return near
}

function PageViewImpl({ doc, page, size, scale, root, marks, label, onSize }: PageViewProps): ReactNode {
  const [box, setBox] = useState<HTMLDivElement | null>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const textHost = useRef<HTMLDivElement>(null)
  const proxy = useRef<PDFPageProxy>()
  const text = useRef<TextLayerHandle>()
  const renderedScale = useRef<number>()
  const chain = useRef(Promise.resolve())
  const [ready, setReady] = useState(false)
  const [failure, setFailure] = useState<string>()
  const near = useNear(box, root, RENDER_MARGIN)
  const keep = useNear(box, root, RELEASE_MARGIN)

  useEffect(() => {
    if (!near || renderedScale.current === scale) return
    const controller = new AbortController()
    const { signal } = controller
    const delay = renderedScale.current === undefined ? 0 : RERENDER_DELAY_MS
    const timer = window.setTimeout(() => {
      chain.current = chain.current.then(async () => {
        if (signal.aborted) return
        const pdfPage = proxy.current ??= await doc.getPage(page)
        if (signal.aborted) return
        // Draw off-screen so the previous bitmap stays up until the new one is ready.
        const buffer = document.createElement('canvas')
        try {
          const natural = await renderPage(pdfPage, buffer, window.devicePixelRatio * scale, signal)
          const target = canvas.current
          if (signal.aborted || target === null) return
          target.width = buffer.width
          target.height = buffer.height
          target.getContext('2d')?.drawImage(buffer, 0, 0)
          renderedScale.current = scale
          setFailure(undefined)
          setReady(true)
          onSize(page, natural)
          if (text.current === undefined && textHost.current !== null) {
            text.current = renderTextLayer(pdfPage, textHost.current)
            text.current.done.catch((error: unknown) => {
              if (!isCancellation(error)) console.warn('[pdf-annotator] text layer failed', error)
            })
          }
        } finally {
          buffer.width = 0
          buffer.height = 0
        }
      }).catch((error: unknown) => {
        if (signal.aborted || isCancellation(error)) return
        setFailure(error instanceof Error ? error.message : String(error))
      })
    }, delay)
    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [near, scale, doc, page, onSize])

  // Far from the viewport: give the bitmap, the text layer and PDF.js page data back.
  useEffect(() => {
    if (keep) return
    text.current?.cancel()
    text.current = undefined
    if (canvas.current !== null) {
      canvas.current.width = 0
      canvas.current.height = 0
    }
    renderedScale.current = undefined
    setReady(false)
    proxy.current?.cleanup()
  }, [keep])

  useEffect(() => () => {
    text.current?.cancel()
    text.current = undefined
  }, [])

  const style = { width: `${size.width * scale}px`, height: `${size.height * scale}px` } satisfies CSSProperties
  return (
    <div ref={setBox} className="pdfa-page" data-pdfa-page={page} style={style} aria-label={label}>
      {!ready && <div className="pdfa-placeholder" role={failure === undefined ? undefined : 'alert'}>{failure}</div>}
      <canvas ref={canvas} className="pdfa-canvas" hidden={!ready} />
      <div className="pdfa-marks" aria-hidden>
        {marks.map(mark => (
          <div
            key={`${mark.id}:${mark.rect.x}:${mark.rect.y}`}
            className="pdfa-mark"
            data-state={mark.state}
            style={{
              left: `${mark.rect.x * 100}%`, top: `${mark.rect.y * 100}%`,
              width: `${mark.rect.w * 100}%`, height: `${mark.rect.h * 100}%`,
            }}
          />
        ))}
      </div>
      <div ref={textHost} className="pdfa-text" data-pdfa-text />
      {marks.filter(mark => mark.badge !== undefined).map(mark => (
        <span
          key={`badge:${mark.id}`}
          className="pdfa-badge"
          data-state={mark.state}
          style={{ left: `${mark.rect.x * 100}%`, top: `${mark.rect.y * 100}%` }}
          aria-hidden
        >
          {mark.badge}
        </span>
      ))}
    </div>
  )
}

/** Pages re-render only when their own inputs change. */
export const PageView = memo(PageViewImpl)
