/** Header toolbar button shown while this plugin's viewer is the selected PDF renderer. */
import type { ReactNode } from 'react'
import { CommentIcon } from './icons.tsx'
import { annotationStore, useEntry } from './annotations/shared.ts'
import type { DocumentActionProps } from './host.ts'

/**
 * Toggle the annotation list and show how many comments wait to be sent.
 * @param props - the document-action slot props.
 * @returns the toolbar button.
 */
export function AnnotationsAction({ useTabInfo, t }: DocumentActionProps): ReactNode {
  const { tab } = useTabInfo()
  const count = useEntry(tab.contentId, entry => entry.annotations.length)
  const open = useEntry(tab.contentId, entry => entry.panelOpen)
  const label = t('action.label')
  return (
    <button
      type="button"
      className="pdfa-tool"
      aria-pressed={open}
      aria-label={label}
      title={label}
      data-pdfa-action
      onClick={() => { annotationStore.setPanel(tab.contentId, !open) }}
    >
      <CommentIcon />
      {count > 0 && <span className="pdfa-tool-count">{count}</span>}
    </button>
  )
}
