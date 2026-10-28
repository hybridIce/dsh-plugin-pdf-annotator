/**
 * The two ways a file's annotations leave the PDF, as the viewer triggers
 * them. Kept out of React so the rules are testable on their own.
 */
import type { InputActions, InputState, Translate } from '../host.ts'
import type { Annotation, FileEntry } from '../model.ts'
import type { AnnotationStore } from '../annotations/store.ts'
import { appendToComposer, composerBusy, type ComposerSnapshot } from './composer.ts'
import { deliverAnnotations, type SendAnnotations } from './delivery.ts'
import { formatMessage } from './format.ts'

/** The previewed file: its store key and the address its @mention is built from. */
export interface AnnotatedFile {
  readonly key: string
  readonly address: string
}

/** What "Add to chat" did. */
export type AddToChatOutcome =
  | { readonly kind: 'added'; readonly removed: readonly Annotation[] }
  | { readonly kind: 'busy' | 'refused' | 'empty' }

/** What "Send now" did; the attempt's result arrives later as the file's delivery state. */
export type SendNowOutcome = 'started' | 'busy' | 'empty'

/** The actions, bound to one store. */
export interface ChatActions {
  /** Whether both actions are unavailable right now. */
  busy(file: AnnotatedFile, phase: InputState['phase']): boolean
  /**
   * Append every annotation to the composer as one block after the draft,
   * then take them off the PDF and close the list; the caller offers Restore.
   */
  addToChat(file: AnnotatedFile, t: Translate, input: InputActions, composer: ComposerSnapshot & Pick<InputState, 'phase'>): AddToChatOutcome
  /** Send the annotations on their own, leaving the composer's draft alone. */
  sendNow(file: AnnotatedFile, t: Translate, phase: InputState['phase'], send: SendAnnotations): SendNowOutcome
}

/** Nothing leaves while the composer is submitting or a batch is in flight. */
export function annotationsBusy(entry: FileEntry, phase: InputState['phase']): boolean {
  return composerBusy(phase) || entry.delivery?.kind === 'sending'
}

/** @param store - the store whose annotations the actions move. */
export function createChatActions(store: AnnotationStore): ChatActions {
  return {
    busy(file, phase) {
      return annotationsBusy(store.get(file.key), phase)
    },
    addToChat(file, t, input, composer) {
      const entry = store.get(file.key)
      if (entry.annotations.length === 0) return { kind: 'empty' }
      if (annotationsBusy(entry, composer.phase)) return { kind: 'busy' }
      if (!appendToComposer(input, composer, formatMessage(t, file.address, entry.annotations))) return { kind: 'refused' }
      const removed = store.clear(file.key)
      store.setPanel(file.key, false)
      return { kind: 'added', removed }
    },
    sendNow(file, t, phase, send) {
      const entry = store.get(file.key)
      if (entry.annotations.length === 0) return 'empty'
      if (annotationsBusy(entry, phase)) return 'busy'
      void deliverAnnotations(store, file.key, formatMessage(t, file.address, entry.annotations), send)
      return 'started'
    },
  }
}
