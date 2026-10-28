/**
 * Browser half: register a PDF renderer that outranks the built-in one, its
 * body, and a header toolbar button, through the document preview's public
 * extension points. The built-in viewer stays one click away in the
 * preview's "Open with" menu.
 */
import type { ComponentType } from 'react'
import actionCss from './action.css'
import { AnnotationsAction } from './AnnotationsAction.tsx'
import { sendAnnotationMessage } from './chat/delivery.ts'
import type { ClientContext } from './host.ts'
import { LazyViewer } from './LazyViewer.tsx'
import { NS, dictionaries } from './locales.ts'
import { injectStyle } from './style.ts'

/** The renderer id: its document-slot key and its "Open with" identity. */
export const VIEWER_ID = 'dsh-plugin-pdf-annotator/viewer'

/** Browser plugin name. */
export const name = 'pdf-annotator'

/** Slot renderer, locale, document preview, and Session services. */
export const inject = ['slots', 'locale', 'documentPreviews', 'sessions']

/**
 * Register the renderer, its body and toolbar button, and the dictionaries.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  injectStyle('action', actionCss)
  ctx.effect(() => ctx.locale.register(NS, dictionaries), 'pdf-annotator: dictionaries')
  const t = ctx.locale.bind(NS)
  ctx.effect(() => ctx.documentPreviews.register({
    id: VIEWER_ID,
    extensions: ['pdf'],
    binaryExtensions: ['pdf'],
    priority: 'extension',
    title: () => t('viewer.title'),
    loading: 'bytes-complete',
    wrap: false,
  }), 'pdf-annotator: renderer')
  ctx.effect(() => ctx.slots.inject('sidebar.right.tab.document', () => ctx.slots.register({
    name: 'sidebar.right.tab.document',
    key: VIEWER_ID,
    locale: NS,
    // Each Session's viewer sends "Send now" batches through that Session.
    inject: sessionId => ({
      sendAnnotations: (text: string) => sendAnnotationMessage(ctx.sessions.binding(sessionId)?.session, text),
    }),
  }, LazyViewer as ComponentType<never>)), 'pdf-annotator: body')
  ctx.effect(() => ctx.slots.inject('sidebar.right.tab.document.action', () => ctx.slots.register({
    name: 'sidebar.right.tab.document.action', key: VIEWER_ID, locale: NS,
  }, AnnotationsAction as ComponentType<never>)), 'pdf-annotator: toolbar')
}
