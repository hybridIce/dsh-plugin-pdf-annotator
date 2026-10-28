/**
 * The document-body entry. PDF.js and the viewer live in the package-local
 * `client.viewer.js` chunk, which loads only when a PDF is first opened, so
 * the app's startup script stays small.
 */
import { lazy, Suspense, type ComponentType, type ReactNode } from 'react'
import { annotationStore, useEntry } from './annotations/shared.ts'
import { createChatActions } from './chat/actions.ts'
import type { BodyProps, ViewerKit, ViewerProps } from './kit.ts'
import { injectStyle } from './style.ts'

const LoadedViewer = lazy(async () => {
  const chunk = await __dshRequire.async('./client.viewer.js') as { PdfAnnotatorViewer: ComponentType<ViewerProps> }
  return { default: chunk.PdfAnnotatorViewer }
})

const kit: ViewerKit = { store: annotationStore, useEntry, injectStyle, ...createChatActions(annotationStore) }

/**
 * Suspend while the viewer chunk arrives.
 * @param props - document slot props and the Session sender.
 * @returns the viewer.
 */
export function LazyViewer(props: BodyProps): ReactNode {
  return (
    <Suspense fallback={<div className="pdfa-loading" role="status">{props.t('viewer.loading')}</div>}>
      <LoadedViewer {...props} kit={kit} />
    </Suspense>
  )
}
