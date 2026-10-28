/** Reading the reader's text selection as a quote plus page-relative highlight boxes. */
import type { PageRect } from '../model.ts'
import { normalizeQuote } from './text.ts'

/** A selection captured when the pointer is released. */
export interface CapturedSelection {
  readonly quote: string
  readonly page: number
  readonly rects: readonly PageRect[]
  /** The selection's last line box, in viewport coordinates, to anchor the toolbar. */
  readonly anchor: DOMRect
}

interface PageBox {
  readonly page: number
  readonly box: DOMRect
}

/** Page boxes currently in the document, with their 1-based page numbers. */
function pageBoxes(root: HTMLElement): PageBox[] {
  return [...root.querySelectorAll<HTMLElement>('[data-pdfa-page]')].map(element => ({
    page: Number(element.dataset.pdfaPage),
    box: element.getBoundingClientRect(),
  }))
}

/** The page whose box contains a rectangle's center. */
function pageOf(rect: DOMRect, pages: readonly PageBox[]): PageBox | undefined {
  const x = rect.left + rect.width / 2
  const y = rect.top + rect.height / 2
  return pages.find(({ box }) => x >= box.left && x <= box.right && y >= box.top && y <= box.bottom)
}

/**
 * Join boxes that sit on the same line and touch, so one highlighted line is
 * one box instead of one per text run.
 */
export function mergeLineRects(rects: readonly PageRect[]): PageRect[] {
  const sorted = [...rects].sort((a, b) => a.page - b.page || a.y - b.y || a.x - b.x)
  const merged: PageRect[] = []
  for (const rect of sorted) {
    const last = merged.at(-1)
    const sameLine = last !== undefined && last.page === rect.page
      && Math.abs((last.y + last.h / 2) - (rect.y + rect.h / 2)) < Math.min(last.h, rect.h) * 0.5
    if (sameLine && rect.x <= last.x + last.w + 0.012) {
      const x = Math.min(last.x, rect.x)
      const y = Math.min(last.y, rect.y)
      merged[merged.length - 1] = {
        page: rect.page, x, y,
        w: Math.max(last.x + last.w, rect.x + rect.w) - x,
        h: Math.max(last.y + last.h, rect.y + rect.h) - y,
      }
    } else {
      merged.push(rect)
    }
  }
  return merged
}

/**
 * Capture the current selection when it lies in this viewer's text layers.
 * Only the selected portions of text nodes produce boxes, so containers that
 * a long selection fully covers never paint a whole page.
 * @param root - the element holding the page boxes.
 * @returns the captured selection, or undefined when there is none inside `root`.
 */
export function captureSelection(root: HTMLElement): CapturedSelection | undefined {
  const selection = root.ownerDocument.getSelection()
  if (selection === null || selection.isCollapsed || selection.rangeCount === 0) return undefined
  const range = selection.getRangeAt(0)
  if (!root.contains(range.commonAncestorContainer)) return undefined
  const quote = normalizeQuote(selection.toString())
  if (quote === '') return undefined

  const pages = pageBoxes(root)
  const ancestor = range.commonAncestorContainer
  const walkRoot = ancestor.nodeType === Node.TEXT_NODE ? ancestor.parentNode ?? ancestor : ancestor
  const walker = root.ownerDocument.createTreeWalker(walkRoot, NodeFilter.SHOW_TEXT, {
    acceptNode: node => range.intersectsNode(node) && node.parentElement?.closest('[data-pdfa-text]') != null
      ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT,
  })
  const rects: PageRect[] = []
  let anchor: DOMRect | undefined
  const piece = root.ownerDocument.createRange()
  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
    const text = node as Text
    const start = text === range.startContainer ? range.startOffset : 0
    const end = text === range.endContainer ? range.endOffset : text.length
    if (end <= start || text.data.slice(start, end).trim() === '') continue
    piece.setStart(text, start)
    piece.setEnd(text, end)
    for (const rect of piece.getClientRects()) {
      if (rect.width < 0.5 || rect.height < 0.5) continue
      const owner = pageOf(rect, pages)
      if (owner === undefined) continue
      rects.push({
        page: owner.page,
        x: (rect.left - owner.box.left) / owner.box.width,
        y: (rect.top - owner.box.top) / owner.box.height,
        w: rect.width / owner.box.width,
        h: rect.height / owner.box.height,
      })
      anchor = rect
    }
  }
  piece.detach()
  if (rects.length === 0 || anchor === undefined) return undefined
  const merged = mergeLineRects(rects)
  return { quote, page: Math.min(...merged.map(rect => rect.page)), rects: merged, anchor }
}
