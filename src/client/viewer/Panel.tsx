/** The annotation list docked under the pages, and the action bar beneath it. */
import type { ReactNode } from 'react'
import { ChevronIcon, CommentIcon, EditIcon, InsertIcon, LocateIcon, MinusIcon, PlusIcon, SendIcon, TrashIcon } from '../icons.tsx'
import type { Translate } from '../host.ts'
import type { Annotation } from '../model.ts'

/** Props for the annotation list. */
export interface PanelProps {
  readonly t: Translate
  readonly annotations: readonly Annotation[]
  readonly busy: boolean
  readonly onLocate: (id: string) => void
  readonly onEdit: (id: string) => void
  readonly onDelete: (id: string) => void
  readonly onClear: () => void
  readonly onInsert: () => void
  readonly onSend: () => void
  readonly onClose: () => void
}

/**
 * Every comment on this file, in document order, numbered like the badges on the pages.
 * @param props - annotations and callbacks.
 * @returns the list panel.
 */
export function Panel({ t, annotations, busy, onLocate, onEdit, onDelete, onClear, onInsert, onSend, onClose }: PanelProps): ReactNode {
  return (
    <section className="pdfa-panel" aria-label={t('panel.title', { count: annotations.length })} data-pdfa-panel>
      <header className="pdfa-panel-head">
        <span className="pdfa-panel-title">{t('panel.title', { count: annotations.length })}</span>
        <button type="button" className="pdfa-icon-button" aria-label={t('panel.close')} title={t('panel.close')} onClick={onClose}>
          <ChevronIcon up={false} />
        </button>
      </header>
      {annotations.length === 0
        ? <p className="pdfa-panel-empty">{t('panel.empty')}</p>
        : (
          <ol className="pdfa-list">
            {annotations.map((annotation, index) => (
              <li key={annotation.id} className="pdfa-item" data-pdfa-item={annotation.id}>
                <div className="pdfa-item-head">
                  <span className="pdfa-item-badge">{index + 1}</span>
                  <button type="button" className="pdfa-item-page" onClick={() => { onLocate(annotation.id) }}>
                    {t('viewer.page', { page: annotation.page })}
                  </button>
                  <span className="pdfa-item-tools">
                    <button type="button" className="pdfa-icon-button" aria-label={t('panel.locate')} title={t('panel.locate')} onClick={() => { onLocate(annotation.id) }}><LocateIcon /></button>
                    <button type="button" className="pdfa-icon-button" aria-label={t('panel.edit')} title={t('panel.edit')} onClick={() => { onEdit(annotation.id) }}><EditIcon /></button>
                    <button type="button" className="pdfa-icon-button" aria-label={t('panel.delete')} title={t('panel.delete')} onClick={() => { onDelete(annotation.id) }}><TrashIcon /></button>
                  </span>
                </div>
                <blockquote className="pdfa-item-quote" title={annotation.quote}>{annotation.quote}</blockquote>
                {annotation.comment.trim() !== '' && <p className="pdfa-item-comment">{annotation.comment}</p>}
              </li>
            ))}
          </ol>
        )}
      <footer className="pdfa-panel-foot">
        <button type="button" className="pdfa-button" disabled={annotations.length === 0} onClick={onClear}>{t('panel.clear')}</button>
        <span className="pdfa-spacer" />
        <button type="button" className="pdfa-button" disabled={annotations.length === 0 || busy} onClick={onInsert} title={t('dock.insertHint')}>
          <InsertIcon />{t('dock.insert')}
        </button>
        <button type="button" className="pdfa-button pdfa-button-primary" disabled={annotations.length === 0 || busy} onClick={onSend} title={t('panel.sendHint')} data-pdfa-send>
          <SendIcon />{t('panel.send')}
        </button>
      </footer>
      <p className="pdfa-panel-hint">{t('panel.sendHint')}</p>
    </section>
  )
}

/** Props for the action bar. */
export interface DockProps {
  readonly t: Translate
  readonly count: number
  readonly panelOpen: boolean
  readonly busy: boolean
  readonly zoomLabel: string
  readonly onToggle: () => void
  readonly onZoomOut: () => void
  readonly onZoomFit: () => void
  readonly onZoomIn: () => void
  readonly onInsert: () => void
}

/**
 * Always-visible bar: comment count (toggles the list), zoom, and Add to chat.
 * @param props - counts, zoom label and callbacks.
 * @returns the bar.
 */
export function Dock({ t, count, panelOpen, busy, zoomLabel, onToggle, onZoomOut, onZoomFit, onZoomIn, onInsert }: DockProps): ReactNode {
  return (
    <div className="pdfa-dock" data-pdfa-dock>
      <button type="button" className="pdfa-button pdfa-dock-toggle" aria-expanded={panelOpen} onClick={onToggle} data-pdfa-toggle>
        <CommentIcon />{t('dock.toggle', { count })}<ChevronIcon up={!panelOpen} />
      </button>
      <span className="pdfa-spacer" />
      <span className="pdfa-zoom" role="group">
        <button type="button" className="pdfa-icon-button" aria-label={t('dock.zoomOut')} title={t('dock.zoomOut')} onClick={onZoomOut}><MinusIcon /></button>
        <button type="button" className="pdfa-zoom-value" title={t('dock.zoomFit')} onClick={onZoomFit}>{zoomLabel}</button>
        <button type="button" className="pdfa-icon-button" aria-label={t('dock.zoomIn')} title={t('dock.zoomIn')} onClick={onZoomIn}><PlusIcon /></button>
      </span>
      <button type="button" className="pdfa-button pdfa-button-primary" disabled={count === 0 || busy} onClick={onInsert} title={t('dock.insertHint')} data-pdfa-insert>
        <InsertIcon />{t('dock.insert')}
      </button>
    </div>
  )
}
