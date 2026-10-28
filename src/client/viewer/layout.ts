/** The page column's layout: its scroller, zoom relative to fit-width, and page sizes. */
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefCallback } from 'react'
import type { PageSize } from './pdf.ts'

/** Padding around the page column, matching `.pdfa-column`. */
const COLUMN_PADDING = 12
const ZOOM_STEPS = [0.5, 0.67, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3]
const MIN_ZOOM = 0.3
const MAX_ZOOM = 4

function clampZoom(value: number): number {
  return Math.min(Math.max(value, MIN_ZOOM), MAX_ZOOM)
}

/**
 * Own the scroll container and report it to the preview, which then saves
 * and restores the tab's scroll position on it.
 * @param report - the preview's `scrollportRef`.
 * @returns the element once mounted, and the ref to attach it with.
 */
export function useScrollport(report: RefCallback<HTMLElement>): [HTMLDivElement | null, RefCallback<HTMLDivElement>] {
  const [scroller, setScroller] = useState<HTMLDivElement | null>(null)
  const bind = useCallback((element: HTMLDivElement | null) => {
    setScroller(element)
    report(element)
  }, [report])
  return [scroller, bind]
}

/** Zoom state and the scale pages are drawn at. */
export interface Zoom {
  /** CSS scale for 100%-size pages: fit-width times the zoom factor. */
  readonly scale: number
  /** The zoom factor relative to fit-width, as the bar shows it ("125%"). */
  readonly label: string
  readonly zoomIn: () => void
  readonly zoomOut: () => void
  readonly fit: () => void
  /** Attach to the scroller, so changing the scale keeps the middle of the view in place. */
  readonly onScroll: () => void
}

/**
 * Fit the first page's width to the scroller and zoom from there with the bar
 * or Ctrl/⌘ + wheel. Whenever the scale changes, the point in the middle of
 * the view stays where it was.
 * @param scroller - the scroll container.
 * @param pageWidth - the first page's width at 100%.
 */
export function useZoom(scroller: HTMLElement | null, pageWidth: number): Zoom {
  const [available, setAvailable] = useState(0)
  const [zoom, setZoom] = useState(1)

  useEffect(() => {
    if (scroller === null) return
    const update = (): void => { setAvailable(scroller.clientWidth) }
    const observer = new ResizeObserver(update)
    observer.observe(scroller)
    update()
    return () => { observer.disconnect() }
  }, [scroller])

  useEffect(() => {
    if (scroller === null) return
    const onWheel = (event: WheelEvent): void => {
      if (!event.ctrlKey && !event.metaKey) return
      event.preventDefault()
      setZoom(value => clampZoom(value * Math.exp(-event.deltaY * 0.0025)))
    }
    scroller.addEventListener('wheel', onWheel, { passive: false })
    return () => { scroller.removeEventListener('wheel', onWheel) }
  }, [scroller])

  const fit = available > 0 ? Math.max(0.1, (available - 2 * COLUMN_PADDING) / pageWidth) : 1
  const scale = fit * zoom

  // The middle of the view, as a fraction of the content height.
  const anchor = useRef<number>()
  const onScroll = useCallback(() => {
    if (scroller !== null && scroller.scrollHeight > 0) anchor.current = (scroller.scrollTop + scroller.clientHeight / 2) / scroller.scrollHeight
  }, [scroller])
  useLayoutEffect(() => {
    if (scroller === null || anchor.current === undefined) return
    scroller.scrollTop = anchor.current * scroller.scrollHeight - scroller.clientHeight / 2
  }, [scale, scroller])

  return {
    scale,
    label: `${Math.round(zoom * 100)}%`,
    zoomIn: () => { setZoom(value => ZOOM_STEPS.find(step => step > value + 0.001) ?? MAX_ZOOM) },
    zoomOut: () => { setZoom(value => ZOOM_STEPS.findLast(step => step < value - 0.001) ?? MIN_ZOOM) },
    fit: () => { setZoom(1) },
    onScroll,
  }
}

/**
 * Page sizes at 100%, learned as pages render; until then a page is assumed to
 * match the first one. The viewer remounts for a new document, which starts
 * this afresh.
 * @returns the size of a page, and the callback pages report their real size to.
 */
export function usePageSizes(firstPage: PageSize): [(page: number) => PageSize, (page: number, size: PageSize) => void] {
  const [sizes, setSizes] = useState<ReadonlyMap<number, PageSize>>(() => new Map())
  const onSize = useCallback((page: number, size: PageSize) => {
    setSizes((previous) => {
      const known = previous.get(page)
      if (known !== undefined && Math.abs(known.width - size.width) < 0.5 && Math.abs(known.height - size.height) < 0.5) return previous
      return new Map(previous).set(page, size)
    })
  }, [])
  return [page => sizes.get(page) ?? firstPage, onSize]
}
