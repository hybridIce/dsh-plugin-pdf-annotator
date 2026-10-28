/** The contract between the main bundle and the lazily loaded viewer chunk. */
import type { AnnotationStore } from './annotations/store.ts'
import type { ChatActions } from './chat/actions.ts'
import type { SendAnnotations } from './chat/delivery.ts'
import type { DocumentBodyProps } from './host.ts'
import type { FileEntry } from './model.ts'

/**
 * State and actions the viewer uses. They come from the main bundle so the
 * toolbar button and the viewer share one store instance.
 */
export interface ViewerKit extends ChatActions {
  readonly store: AnnotationStore
  readonly useEntry: <T>(key: string, select: (entry: FileEntry) => T) => T
  readonly injectStyle: (name: string, css: string) => void
}

/** The document slot's props plus the per-Session sender injected at registration. */
export interface BodyProps extends DocumentBodyProps {
  readonly sendAnnotations: SendAnnotations
}

/** The viewer chunk's props. */
export interface ViewerProps extends BodyProps {
  readonly kit: ViewerKit
}
