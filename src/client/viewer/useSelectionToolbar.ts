/** Offering the Comment / Quote toolbar over a finished text selection. */
import { useCallback, useEffect, useState, type RefObject } from 'react'
import type { Floating } from './placement.ts'
import { captureSelection, type CapturedSelection } from './selection.ts'

/** A finished selection inside the pages, and where its toolbar goes. */
export interface OfferedSelection extends Floating {
  readonly captured: CapturedSelection
}

/**
 * Watch the document's selection. Finishing one inside `column` (pointer
 * released, Shift + arrows, select all) offers the toolbar; collapsing it or
 * pressing Escape withdraws the offer.
 * @param column - the element holding the pages.
 * @param place - positions the toolbar under the selection's end; must be stable.
 * @returns the offered selection, and a function that withdraws it.
 */
export function useSelectionToolbar(
  column: RefObject<HTMLElement | null>,
  place: (anchor: DOMRect) => Floating | undefined,
): [OfferedSelection | undefined, () => void] {
  const [offered, setOffered] = useState<OfferedSelection>()

  useEffect(() => {
    const host = column.current
    if (host === null) return
    const doc = host.ownerDocument
    let timer = 0
    // Read the selection after the event, once the browser has finished updating it.
    const check = (): void => {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        const captured = captureSelection(host)
        const position = captured === undefined ? undefined : place(captured.anchor)
        setOffered(captured === undefined || position === undefined ? undefined : { captured, ...position })
      }, 0)
    }
    const onKeyUp = (event: KeyboardEvent): void => {
      if (event.shiftKey || event.key === 'Shift' || ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'a')) check()
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setOffered(undefined)
    }
    const onSelectionChange = (): void => {
      const selection = doc.getSelection()
      if (selection === null || selection.isCollapsed) setOffered(undefined)
    }
    doc.addEventListener('pointerup', check)
    doc.addEventListener('keyup', onKeyUp)
    doc.addEventListener('keydown', onKeyDown)
    doc.addEventListener('selectionchange', onSelectionChange)
    return () => {
      window.clearTimeout(timer)
      doc.removeEventListener('pointerup', check)
      doc.removeEventListener('keyup', onKeyUp)
      doc.removeEventListener('keydown', onKeyDown)
      doc.removeEventListener('selectionchange', onSelectionChange)
    }
  }, [column, place])

  const withdraw = useCallback(() => { setOffered(undefined) }, [])
  return [offered, withdraw]
}
