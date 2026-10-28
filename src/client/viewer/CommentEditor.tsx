/** The floating editor for writing or changing one comment. */
import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { Translate } from '../host.ts'

/** Props for the comment editor. */
export interface CommentEditorProps {
  readonly t: Translate
  /** Position inside the page column, in CSS pixels. */
  readonly left: number
  readonly top: number
  readonly width: number
  readonly quote: string
  readonly initial: string
  /** Editing an existing comment adds Delete. */
  readonly editing: boolean
  readonly onSave: (comment: string) => void
  readonly onCancel: () => void
  readonly onDelete: () => void
}

/**
 * Write a comment for a quote. Enter saves, Shift+Enter breaks the line, Esc
 * cancels; Enter during IME composition belongs to the input method.
 * @param props - placement, quote, and callbacks.
 * @returns the editor card.
 */
export function CommentEditor({ t, left, top, width, quote, initial, editing, onSave, onCancel, onDelete }: CommentEditorProps): ReactNode {
  const [value, setValue] = useState(initial)
  const card = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const field = input.current
    if (field === null) return
    field.focus({ preventScroll: true })
    field.setSelectionRange(field.value.length, field.value.length)
    card.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [])

  return (
    <div
      ref={card}
      className="pdfa-editor"
      style={{ left: `${left}px`, top: `${top}px`, width: `${width}px` }}
      role="dialog"
      aria-label={t('selection.comment')}
      data-pdfa-editor
      onPointerDown={(event) => { event.stopPropagation() }}
      onPointerUp={(event) => { event.stopPropagation() }}
    >
      <blockquote className="pdfa-editor-quote">{quote}</blockquote>
      <textarea
        ref={input}
        className="pdfa-editor-input"
        value={value}
        rows={3}
        placeholder={t('editor.placeholder')}
        onChange={(event) => { setValue(event.target.value) }}
        onKeyDown={(event) => {
          if (event.nativeEvent.isComposing || event.key === 'Process') return
          if (event.key === 'Escape') {
            event.preventDefault()
            event.stopPropagation()
            onCancel()
          } else if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault()
            onSave(value)
          }
        }}
      />
      <div className="pdfa-editor-foot">
        <span className="pdfa-editor-hint">{t('editor.hint')}</span>
        {editing && (
          <button type="button" className="pdfa-button pdfa-button-danger" onClick={onDelete}>{t('editor.delete')}</button>
        )}
        <button type="button" className="pdfa-button" onClick={onCancel}>{t('editor.cancel')}</button>
        <button type="button" className="pdfa-button pdfa-button-primary" onClick={() => { onSave(value) }} data-pdfa-save>
          {t('editor.save')}
        </button>
      </div>
    </div>
  )
}
