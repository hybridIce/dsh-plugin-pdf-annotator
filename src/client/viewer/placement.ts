/** Positions measured from the DOM: floating boxes, annotation lines, and pointer hits. */
import type { Annotation } from '../model.ts'
import { annotationAt } from './marks.ts'

/** A position inside the page column, in CSS pixels. */
export interface Floating {
  readonly left: number
  readonly top: number
}

/**
 * Place a box of `width` just under a viewport rect, kept inside the part of
 * the column the scroller shows.
 * @param align - `end` lines the box's right edge up with the rect's (a selection's end); `start` its left edge.
 */
export function placeUnder(rect: DOMRect, width: number, align: 'start' | 'end', column: HTMLElement, scroller: HTMLElement): Floating {
  const view = scroller.getBoundingClientRect()
  const box = column.getBoundingClientRect()
  const minLeft = view.left - box.left + 8
  const maxLeft = Math.max(minLeft, view.right - box.left - width - 8)
  const left = align === 'end' ? rect.right - box.left - width : rect.left - box.left
  return { left: Math.min(Math.max(left, minLeft), maxLeft), top: rect.bottom - box.top + 6 }
}

function pageBox(column: HTMLElement, page: number): HTMLElement | null {
  return column.querySelector<HTMLElement>(`[data-pdfa-page="${page}"]`)
}

/** The viewport rect of an annotation's last line, measured from its page box. */
export function lastLineRect(annotation: Annotation, column: HTMLElement): DOMRect | undefined {
  const last = annotation.rects.at(-1)
  const page = last === undefined ? null : pageBox(column, last.page)
  if (last === undefined || page === null) return undefined
  const box = page.getBoundingClientRect()
  return new DOMRect(box.left + last.x * box.width, box.top + last.y * box.height, last.w * box.width, last.h * box.height)
}

/** The scroll offset that brings an annotation's first line to 30% of the scroller's height. */
export function scrollTopFor(annotation: Annotation, column: HTMLElement, scroller: HTMLElement): number | undefined {
  const first = annotation.rects[0]
  const page = first === undefined ? null : pageBox(column, first.page)
  if (first === undefined || page === null) return undefined
  const pageTop = page.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop
  return Math.max(0, pageTop + first.y * page.offsetHeight - scroller.clientHeight * 0.3)
}

/** The annotation under a pointer event's position, if it is over a page. */
export function annotationUnder(annotations: readonly Annotation[], target: EventTarget | null, x: number, y: number): string | undefined {
  const page = target instanceof Element ? target.closest<HTMLElement>('[data-pdfa-page]') : null
  if (page === null) return undefined
  const box = page.getBoundingClientRect()
  return annotationAt(annotations, Number(page.dataset.pdfaPage), (x - box.left) / box.width, (y - box.top) / box.height)
}
