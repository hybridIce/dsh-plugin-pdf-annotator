/**
 * The annotating PDF viewer. `PdfAnnotatorViewer` opens the document;
 * `AnnotatedDocument` shows it: pages with a selectable text layer, the
 * selection toolbar, the comment editor and tip, the comment list, the
 * status strips, and the action bar.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import type { AnnotatedFile } from '../chat/actions.ts'
import type { Translate } from '../host.ts'
import type { ViewerProps } from '../kit.ts'
import type { Annotation } from '../model.ts'
import { Banners, useNotice } from './Banners.tsx'
import { CommentEditor } from './CommentEditor.tsx'
import { CommentTip, SelectionToolbar } from './Floating.tsx'
import { usePageSizes, useScrollport, useZoom } from './layout.ts'
import { marksByPage, type PageMark } from './marks.ts'
import { PageView } from './PageView.tsx'
import { Dock, Panel } from './Panel.tsx'
import { PdfWorkerFailure, type PageSize } from './pdf.ts'
import { annotationUnder, lastLineRect, placeUnder, scrollTopFor, type Floating } from './placement.ts'
import type { CapturedSelection } from './selection.ts'
import { usePdfDocument } from './usePdfDocument.ts'
import { useSelectionToolbar } from './useSelectionToolbar.ts'
import viewerCss from './viewer.css'

const TOOLBAR_WIDTH = 196
const EDITOR_MAX_WIDTH = 380
/** Matches `.pdfa-tip { max-width }`. */
const TIP_WIDTH = 260
/** How long a located annotation blinks. */
const FLASH_MS = 1600
const NO_MARKS: readonly PageMark[] = []

/** The comment editor: writing a comment for a selection, or changing a saved one. */
type EditorState =
  | ({ readonly kind: 'new'; readonly captured: CapturedSelection } & Floating)
  | ({ readonly kind: 'edit'; readonly id: string } & Floating)

function newId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

function failureText(error: unknown, t: Translate): string {
  if (error instanceof Error && error.name === 'PasswordException') return t('viewer.password')
  if (error instanceof PdfWorkerFailure) return t('viewer.failed', { message: error.message })
  return t('viewer.failed', { message: error instanceof Error ? error.message : String(error) })
}

/**
 * The document body for `.pdf` files.
 * @param props - document slot props, the Session sender, and the main bundle's kit.
 * @returns the viewer, or the loading or failure state.
 */
export function PdfAnnotatorViewer(props: ViewerProps): ReactNode {
  const { content, t, kit } = props
  useLayoutEffect(() => { kit.injectStyle('viewer', viewerCss) }, [kit])
  const pdf = usePdfDocument(content.kind === 'bytes' ? content.data : undefined)
  if (content.kind !== 'bytes') return <p className="pdfa-status" role="alert">{t('viewer.unsupported')}</p>
  if (pdf.kind === 'loading') return <div className="pdfa-status" role="status">{t('viewer.loading')}</div>
  if (pdf.kind === 'failed') {
    return (
      <div className="pdfa-status" role="alert">
        <span>{failureText(pdf.error, t)}</span>
        <button type="button" className="pdfa-button" onClick={pdf.retry}>{t('viewer.retry')}</button>
      </div>
    )
  }
  return <AnnotatedDocument {...props} doc={pdf.doc} firstPage={pdf.firstPage} />
}

/** Props for the opened document. */
interface AnnotatedDocumentProps extends ViewerProps {
  readonly doc: PDFDocumentProxy
  readonly firstPage: PageSize
}

function AnnotatedDocument(props: AnnotatedDocumentProps): ReactNode {
  const { doc, firstPage, resourceAddress, scrollportRef, inputActions, useInput, useTabInfo, t, kit, sendAnnotations } = props
  const { tab } = useTabInfo()
  const file = useMemo<AnnotatedFile>(() => ({ key: tab.contentId, address: resourceAddress }), [tab.contentId, resourceAddress])
  const entry = kit.useEntry(file.key, current => current)
  const { annotations } = entry
  const draft = useInput(state => state.draft)
  const draftRev = useInput(state => state.draftRev)
  const phase = useInput(state => state.phase)
  const busy = kit.busy(file, phase)

  // ---- layout ------------------------------------------------------------
  const [scroller, bindScroller] = useScrollport(scrollportRef)
  const column = useRef<HTMLDivElement>(null)
  const zoom = useZoom(scroller, firstPage.width)
  const [sizeOf, onSize] = usePageSizes(firstPage)
  const editorWidth = Math.max(220, Math.min(EDITOR_MAX_WIDTH, (scroller?.clientWidth ?? EDITOR_MAX_WIDTH) - 16))
  const place = useCallback((rect: DOMRect, width: number, align: 'start' | 'end' = 'end'): Floating | undefined =>
    column.current === null || scroller === null ? undefined : placeUnder(rect, width, align, column.current, scroller), [scroller])
  const lineOf = (annotation: Annotation | undefined): DOMRect | undefined =>
    annotation === undefined || column.current === null ? undefined : lastLineRect(annotation, column.current)

  // ---- selection, editor, tip --------------------------------------------
  const placeToolbar = useCallback((anchor: DOMRect) => place(anchor, TOOLBAR_WIDTH), [place])
  const [offered, withdraw] = useSelectionToolbar(column, placeToolbar)
  const [editor, setEditor] = useState<EditorState>()
  const [tip, setTip] = useState<Floating & { readonly id: string }>()

  const clearSelection = (): void => { column.current?.ownerDocument.getSelection()?.removeAllRanges() }
  const addAnnotation = (captured: CapturedSelection, comment: string): void => {
    kit.store.add(file.key, {
      id: newId(), page: captured.page, quote: captured.quote, comment: comment.trim(),
      rects: captured.rects, createdAt: Date.now(),
    })
  }
  const startComment = (): void => {
    if (offered === undefined) return
    const position = place(offered.captured.anchor, editorWidth)
    if (position !== undefined) setEditor({ kind: 'new', captured: offered.captured, ...position })
    withdraw()
    clearSelection()
  }
  const quoteOnly = (): void => {
    if (offered === undefined) return
    addAnnotation(offered.captured, '')
    withdraw()
    clearSelection()
  }
  const openEdit = (id: string): void => {
    const rect = lineOf(annotations.find(item => item.id === id))
    const position = rect === undefined ? undefined : place(rect, editorWidth)
    if (position !== undefined) setEditor({ kind: 'edit', id, ...position })
    setTip(undefined)
  }

  // Resting the pointer on a highlight shows its comment; clicking it opens the editor.
  const frame = useRef(0)
  useEffect(() => () => { cancelAnimationFrame(frame.current) }, [])
  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (event.buttons !== 0) return
    const { target, clientX, clientY } = event
    cancelAnimationFrame(frame.current)
    frame.current = requestAnimationFrame(() => {
      const id = annotationUnder(annotations, target, clientX, clientY)
      setTip((previous) => {
        if (id === undefined) return undefined
        if (previous?.id === id) return previous
        const rect = lineOf(annotations.find(item => item.id === id))
        const position = rect === undefined ? undefined : place(rect, TIP_WIDTH, 'start')
        return position === undefined ? undefined : { id, ...position }
      })
    })
  }
  const onClick = (event: ReactMouseEvent<HTMLDivElement>): void => {
    if (event.target instanceof Element && event.target.closest('[data-pdfa-editor],[data-pdfa-toolbar]') !== null) return
    const selection = column.current?.ownerDocument.getSelection()
    if (selection != null && !selection.isCollapsed) return
    const id = annotationUnder(annotations, event.target, event.clientX, event.clientY)
    if (id !== undefined) openEdit(id)
  }

  // ---- list --------------------------------------------------------------
  const [flash, setFlash] = useState<string>()
  useEffect(() => {
    if (flash === undefined) return
    const timer = window.setTimeout(() => { setFlash(undefined) }, FLASH_MS)
    return () => { window.clearTimeout(timer) }
  }, [flash])
  const locate = (id: string): void => {
    const annotation = annotations.find(item => item.id === id)
    const top = annotation === undefined || column.current === null || scroller === null
      ? undefined : scrollTopFor(annotation, column.current, scroller)
    if (top === undefined) return
    scroller?.scrollTo({ top, behavior: 'smooth' })
    setFlash(id)
  }

  // ---- leaving the PDF ---------------------------------------------------
  const { notice, show, dismiss } = useNotice()
  const addToChat = (): void => {
    const outcome = kit.addToChat(file, t, inputActions, { draft, draftRev, phase })
    switch (outcome.kind) {
      case 'added':
        setEditor(undefined)
        show(t('notice.inserted', { count: outcome.removed.length }), outcome.removed)
        break
      case 'busy':
        show(t('notice.busy'))
        break
      case 'refused':
        show(t('notice.failed'))
        break
      case 'empty':
        break
    }
  }
  const sendNow = (): void => {
    const outcome = kit.sendNow(file, t, phase, sendAnnotations)
    if (outcome === 'busy') show(t('notice.busy'))
    if (outcome === 'started') {
      setEditor(undefined)
      dismiss()
    }
  }
  const clearAll = (): void => {
    const removed = kit.store.clear(file.key)
    if (removed.length > 0) show(t('notice.cleared', { count: removed.length }), removed)
  }

  // ---- render ------------------------------------------------------------
  const editingId = editor?.kind === 'edit' ? editor.id : undefined
  const marks = useMemo(() => marksByPage(annotations, {
    flash,
    hover: [tip?.id, editingId],
    pending: editor?.kind === 'new' ? editor.captured.rects : undefined,
  }), [annotations, flash, tip?.id, editingId, editor])
  const editing = editor?.kind === 'edit' ? annotations.find(item => item.id === editor.id) : undefined
  const tipped = tip === undefined || editor !== undefined || offered !== undefined ? undefined : annotations.find(item => item.id === tip.id)

  return (
    <div className="pdfa-root" data-pdfa-viewer>
      <div ref={bindScroller} className="pdfa-scroll" onScroll={zoom.onScroll}>
        <div
          ref={column}
          className="pdfa-column"
          onPointerMove={onPointerMove}
          onPointerLeave={() => { setTip(undefined) }}
          onClick={onClick}
        >
          {Array.from({ length: doc.numPages }, (_, index) => (
            <PageView
              key={index}
              doc={doc}
              page={index + 1}
              size={sizeOf(index + 1)}
              scale={zoom.scale}
              root={scroller}
              marks={marks.get(index + 1) ?? NO_MARKS}
              label={t('viewer.page', { page: index + 1 })}
              onSize={onSize}
            />
          ))}
          {offered !== undefined && editor === undefined && (
            <SelectionToolbar t={t} position={offered} onComment={startComment} onQuote={quoteOnly} />
          )}
          {editor !== undefined && (editor.kind === 'new' || editing !== undefined) && (
            <CommentEditor
              key={editor.kind === 'new' ? `new:${editor.captured.anchor.top}:${editor.captured.anchor.left}` : `edit:${editor.id}`}
              t={t}
              left={editor.left}
              top={editor.top}
              width={editorWidth}
              quote={editor.kind === 'new' ? editor.captured.quote : editing?.quote ?? ''}
              initial={editor.kind === 'new' ? '' : editing?.comment ?? ''}
              editing={editor.kind === 'edit'}
              onSave={(comment) => {
                if (editor.kind === 'new') addAnnotation(editor.captured, comment)
                else kit.store.update(file.key, editor.id, { comment: comment.trim() })
                setEditor(undefined)
              }}
              onCancel={() => { setEditor(undefined) }}
              onDelete={() => {
                if (editor.kind === 'edit') kit.store.remove(file.key, editor.id)
                setEditor(undefined)
              }}
            />
          )}
          {tipped !== undefined && tip !== undefined && (
            <CommentTip position={tip} text={tipped.comment.trim() === '' ? t('mark.quoteOnly') : tipped.comment} />
          )}
        </div>
      </div>
      {entry.panelOpen && (
        <Panel
          t={t}
          annotations={annotations}
          busy={busy}
          onLocate={locate}
          onEdit={(id) => { locate(id); openEdit(id) }}
          onDelete={(id) => { kit.store.remove(file.key, id) }}
          onClear={clearAll}
          onInsert={addToChat}
          onSend={sendNow}
          onClose={() => { kit.store.setPanel(file.key, false) }}
        />
      )}
      <Banners
        t={t}
        storageError={entry.storageError}
        onRetryStorage={() => { kit.store.retryPersistence(file.key) }}
        delivery={entry.delivery}
        remaining={annotations.length}
        notice={notice}
        onRestore={(removed) => {
          kit.store.restore(file.key, removed)
          dismiss()
        }}
      />
      <Dock
        t={t}
        count={annotations.length}
        panelOpen={entry.panelOpen}
        busy={busy}
        zoomLabel={zoom.label}
        onToggle={() => { kit.store.setPanel(file.key, !entry.panelOpen) }}
        onZoomOut={zoom.zoomOut}
        onZoomFit={zoom.fit}
        onZoomIn={zoom.zoomIn}
        onInsert={addToChat}
      />
    </div>
  )
}
