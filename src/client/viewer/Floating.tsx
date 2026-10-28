/** Boxes floating over the pages: the selection toolbar and the comment tip. */
import type { ReactNode } from 'react'
import { CommentIcon, QuoteIcon } from '../icons.tsx'
import type { Translate } from '../host.ts'
import type { Floating } from './placement.ts'

/** Props for the selection toolbar. */
export interface SelectionToolbarProps {
  readonly t: Translate
  readonly position: Floating
  readonly onComment: () => void
  readonly onQuote: () => void
}

/**
 * Comment on the selection, or keep it as a quote without a comment.
 * @param props - position and actions.
 * @returns the toolbar.
 */
export function SelectionToolbar({ t, position, onComment, onQuote }: SelectionToolbarProps): ReactNode {
  return (
    <div
      className="pdfa-toolbar"
      data-pdfa-toolbar
      style={{ left: `${position.left}px`, top: `${position.top}px` }}
      // Pressing a button must not collapse the selection it acts on.
      onPointerDown={(event) => { event.preventDefault() }}
    >
      <button type="button" className="pdfa-toolbar-button" onClick={onComment} data-pdfa-comment>
        <CommentIcon />{t('selection.comment')}
      </button>
      <button type="button" className="pdfa-toolbar-button" onClick={onQuote} data-pdfa-quote>
        <QuoteIcon />{t('selection.quote')}
      </button>
    </div>
  )
}

/**
 * A highlight's comment, shown while the pointer rests on it.
 * @param props - position and text.
 * @returns the tip.
 */
export function CommentTip({ position, text }: { readonly position: Floating; readonly text: string }): ReactNode {
  return (
    <div className="pdfa-tip" style={{ left: `${position.left}px`, top: `${position.top}px` }} role="tooltip">
      {text}
    </div>
  )
}
