/** Which highlight boxes each page paints, and which annotation sits under a point. */
import type { Annotation, PageRect } from '../model.ts'

/** One highlight box to paint on a page. */
export interface PageMark {
  readonly id: string
  readonly rect: PageRect
  /** 1-based number shown beside the annotation's first box, if this is it. */
  readonly badge?: number
  readonly state: 'idle' | 'hover' | 'flash' | 'pending'
}

/** Annotations the reader is looking at right now. */
export interface MarkFocus {
  /** Blinking after "Show". */
  readonly flash?: string
  /** Under the pointer, or open in the editor. */
  readonly hover?: readonly (string | undefined)[]
  /** A selection being commented on, not saved yet. */
  readonly pending?: readonly PageRect[]
}

/** Id of the selection being commented on. */
export const PENDING_ID = 'pending'

/**
 * Group highlight boxes by page. Badges count annotations in document order,
 * matching the numbers in the list and in the message sent to the agent.
 */
export function marksByPage(annotations: readonly Annotation[], focus: MarkFocus): ReadonlyMap<number, readonly PageMark[]> {
  const byPage = new Map<number, PageMark[]>()
  const push = (mark: PageMark): void => {
    const list = byPage.get(mark.rect.page)
    if (list === undefined) byPage.set(mark.rect.page, [mark])
    else list.push(mark)
  }
  annotations.forEach((annotation, index) => {
    const state = annotation.id === focus.flash ? 'flash' : focus.hover?.includes(annotation.id) === true ? 'hover' : 'idle'
    annotation.rects.forEach((rect, part) => {
      push(part === 0 ? { id: annotation.id, rect, state, badge: index + 1 } : { id: annotation.id, rect, state })
    })
  })
  for (const rect of focus.pending ?? []) push({ id: PENDING_ID, rect, state: 'pending' })
  return byPage
}

/** How far outside a box, as a fraction of the page, a pointer still hits it. */
const HIT_SLACK = 0.003

/**
 * The annotation whose box contains a point.
 * @param page - 1-based page number.
 * @param fx - horizontal position as a fraction of the page width.
 * @param fy - vertical position as a fraction of the page height.
 * @returns the first annotation in document order, or undefined.
 */
export function annotationAt(annotations: readonly Annotation[], page: number, fx: number, fy: number): string | undefined {
  return annotations.find(annotation => annotation.rects.some(rect => rect.page === page
    && fx >= rect.x - HIT_SLACK && fx <= rect.x + rect.w + HIT_SLACK
    && fy >= rect.y - HIT_SLACK && fy <= rect.y + rect.h + HIT_SLACK))?.id
}
