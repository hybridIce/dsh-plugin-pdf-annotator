/** The annotation data model, shared by the main bundle and the viewer chunk. */

/** One highlighted box, as fractions of its page's width and height. */
export interface PageRect {
  readonly page: number
  readonly x: number
  readonly y: number
  readonly w: number
  readonly h: number
}

/** One annotation: the quoted text, where it sits, and the reader's comment. */
export interface Annotation {
  readonly id: string
  /** First page the quote touches (1-based). */
  readonly page: number
  readonly quote: string
  /** The only field that changes after creation. */
  readonly comment: string
  readonly rects: readonly PageRect[]
  readonly createdAt: number
}

/** Which side of localStorage refused: reading the saved copy, or saving changes. */
export type StorageError = 'read' | 'write'

/** The last "Send now" attempt for a file. */
export interface Delivery {
  readonly kind: 'sending' | 'accepted' | 'failed'
  /** How many annotations the attempt carried. */
  readonly count: number
  /** Distinguishes attempts with the same kind and count. */
  readonly seq: number
  /** When the attempt reached this state, in epoch milliseconds. */
  readonly at: number
}

/** Everything known about one previewed file's annotations. */
export interface FileEntry {
  /** In document order. */
  readonly annotations: readonly Annotation[]
  readonly panelOpen: boolean
  /** Present until storage accepts a read or write again. */
  readonly storageError?: StorageError
  readonly delivery?: Delivery
}

/**
 * Document order: page, then the top of the first highlighted line, then its
 * left edge, then creation time.
 */
export function sortByPosition(annotations: readonly Annotation[]): readonly Annotation[] {
  const top = (a: Annotation): number => a.rects[0]?.y ?? 0
  const left = (a: Annotation): number => a.rects[0]?.x ?? 0
  return [...annotations].sort((a, b) => a.page - b.page || top(a) - top(b) || left(a) - left(b) || a.createdAt - b.createdAt)
}

/**
 * Whether two annotations are the same version of one comment. Only the
 * comment is editable, so an edit made while a batch was in flight shows here.
 */
export function sameVersion(a: Annotation, b: Annotation): boolean {
  return a.id === b.id && a.comment === b.comment
}
