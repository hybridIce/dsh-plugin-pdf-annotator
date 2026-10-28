/**
 * The slice of the DSH browser API this plugin relies on, declared locally so
 * the plugin builds outside the DSH monorepo. Shapes follow DSH 0.2.1-rc.3
 * (`ui-sidebar-documentpreview`, `ui-conversation`, `ui-slots`,
 * `api-session-controller`); fields the plugin never reads are omitted.
 */
import type { ComponentType, RefCallback } from 'react'

/** Translate a key of this plugin's dictionary namespace. */
export type Translate = (key: string, params?: Record<string, unknown>) => string

/** Document content the preview owner hands a renderer (DocumentContent). */
export type DocumentContent =
  | { readonly kind: 'bytes'; readonly data: Uint8Array<ArrayBuffer> }
  | { readonly kind: 'text' }
  | { readonly kind: 'renderer' }

/** Revision-guarded composer selection (TokenSpan). */
export interface TokenSpan {
  readonly start: number
  readonly end: number
  readonly draftRev: number
}

/** The composer face every Session-scope slot component receives (InputActions). */
export interface InputActions {
  captureInsertion(): TokenSpan
  insertText(text: string, span: TokenSpan): boolean
  submit(): void
}

/** The part of the composer state this plugin reads (InputState); newer composers add `sending`. */
export interface InputState {
  readonly draft: string
  readonly draftRev: number
  readonly phase: 'plain' | 'adjudicating' | 'claimed' | 'submitting' | 'sending'
}

/** The Host's answer to a prompt: admission, not merely a click or a local echo. */
export type SendResult =
  | { readonly ok: true; readonly value: { readonly accepted: true } }
  | { readonly ok: false; readonly error?: { readonly message?: string } }

/** The public ISession methods the composer itself uses to submit. */
export interface SessionSender {
  beginSubmission(input: {
    readonly mode: 'queue'
    readonly text: string
    readonly attachments: readonly []
  }): { readonly requestId: string; abandon(): void }
  prompt(content: { type: 'text'; text: string }[], mode: 'queue', signal: undefined, requestId: string): Promise<SendResult>
}

/** The enclosing Sidebar tab (UseSidebarRightTabInfo). */
export interface TabInfo {
  readonly tab: {
    readonly id: string
    /** The tab's resource address, `dsh-resource://file/session/<sessionId>/<path>`. */
    readonly contentId: string
    /** Ends with the tab record (not with body visibility). */
    readonly signal: AbortSignal
  }
}

/** Standard props every Session-scope slot component receives. */
export interface SessionSlotProps {
  readonly t: Translate
  readonly useTabInfo: () => TabInfo
  readonly inputActions: InputActions
  readonly useInput: <T>(selector: (state: InputState) => T) => T
}

/** `sidebar.right.tab.document` owner props plus the standard Session kit. */
export interface DocumentBodyProps extends SessionSlotProps {
  readonly content: DocumentContent
  readonly resourceAddress: string
  readonly scrollportRef: RefCallback<HTMLElement>
}

/** `sidebar.right.tab.document.action` owner props plus the standard Session kit. */
export interface DocumentActionProps extends SessionSlotProps {
  readonly content: DocumentContent
}

/** Registration metadata for one file-extension renderer (DocumentPreviewDefinition). */
export interface DocumentPreviewDefinition {
  readonly id: string
  readonly extensions: readonly string[]
  readonly binaryExtensions?: readonly string[]
  readonly priority?: 'builtin' | 'extension'
  readonly title: () => string
  readonly loading: 'text-pages' | 'bytes-complete' | 'renderer'
  readonly wrap?: boolean
}

/** The browser Cordis context services this plugin injects. */
export interface ClientContext {
  effect(execute: () => () => void, label?: string): void
  readonly locale: {
    register(ns: string, dicts: Record<string, Record<string, string>>): () => void
    bind(ns: string): Translate
  }
  readonly documentPreviews: {
    register(definition: DocumentPreviewDefinition): () => void
  }
  readonly sessions: {
    binding(id: string): { readonly session: SessionSender } | undefined
  }
  readonly slots: {
    inject(name: string, callback: () => () => void): () => void
    register(options: {
      readonly name: string
      readonly key: string
      readonly locale?: string
      /** Extra props for the component, computed per Session. */
      readonly inject?: (sessionId: string) => Record<string, unknown>
    }, component: ComponentType<never>): () => void
  }
}
