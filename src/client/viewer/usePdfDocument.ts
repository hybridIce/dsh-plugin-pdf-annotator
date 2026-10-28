/** Opening the previewed bytes with PDF.js, and opening them again on Retry. */
import { useCallback, useEffect, useState } from 'react'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { CSS_UNITS, openPdf, type PageSize } from './pdf.ts'

/** Where opening the document stands. */
export type PdfDocumentState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'failed'; readonly error: unknown; readonly retry: () => void }
  | { readonly kind: 'loaded'; readonly doc: PDFDocumentProxy; readonly firstPage: PageSize }

/** The outcome for one set of bytes. */
type Settled =
  | { readonly data: Uint8Array; readonly kind: 'loaded'; readonly doc: PDFDocumentProxy; readonly firstPage: PageSize }
  | { readonly data: Uint8Array; readonly kind: 'failed'; readonly error: unknown }

const LOADING: PdfDocumentState = { kind: 'loading' }

/**
 * Open `data`. The document and its worker are released when `data` changes
 * or the viewer unmounts.
 * @param data - complete PDF bytes; undefined while the preview has none.
 */
export function usePdfDocument(data: Uint8Array<ArrayBuffer> | undefined): PdfDocumentState {
  const [attempt, setAttempt] = useState(0)
  const [settled, setSettled] = useState<Settled>()
  const retry = useCallback(() => { setAttempt(value => value + 1) }, [])

  useEffect(() => {
    if (data === undefined) return
    let alive = true
    setSettled(undefined)
    const session = openPdf(data, (error) => { if (alive) setSettled({ data, kind: 'failed', error }) })
    session.document
      .then(async (doc) => {
        const viewport = (await doc.getPage(1)).getViewport({ scale: CSS_UNITS })
        if (alive) setSettled({ data, kind: 'loaded', doc, firstPage: { width: viewport.width, height: viewport.height } })
      })
      .catch((error: unknown) => { if (alive) setSettled({ data, kind: 'failed', error }) })
    return () => {
      alive = false
      void session.dispose()
    }
  }, [data, attempt])

  // An outcome for earlier bytes is stale until the new load settles.
  if (settled === undefined || settled.data !== data) return LOADING
  return settled.kind === 'loaded'
    ? { kind: 'loaded', doc: settled.doc, firstPage: settled.firstPage }
    : { kind: 'failed', error: settled.error, retry }
}
