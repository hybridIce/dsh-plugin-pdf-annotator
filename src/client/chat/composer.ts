/** Writing into the conversation composer through its public InputActions face. */
import type { InputActions, InputState } from '../host.ts'

/** The composer state an insertion is computed from, as last rendered. */
export type ComposerSnapshot = Pick<InputState, 'draft' | 'draftRev'>

/** Whether the composer is between Enter and the Host's answer, when it refuses edits. */
export function composerBusy(phase: InputState['phase']): boolean {
  return phase === 'adjudicating' || phase === 'submitting' || phase === 'sending'
}

/** Blank-line separation from whatever the draft already ends with. */
function separatorAfter(draft: string): string {
  if (draft.trim() === '' || draft.endsWith('\n\n')) return ''
  return draft.endsWith('\n') ? '\n' : '\n\n'
}

/**
 * Append a block after everything in the draft, as one undo step. Text,
 * selection and reference chips in the draft stay as they are. The edit is
 * guarded by the draft revision: a draft that changed after `composer` was
 * rendered refuses it instead of taking it at a stale offset.
 * @param input - the Session's composer actions.
 * @param composer - draft text and revision from the same render.
 * @param text - the block to append.
 * @returns false when the composer refused (revision moved on, or sending).
 */
export function appendToComposer(input: InputActions, composer: ComposerSnapshot, text: string): boolean {
  const { draftRev } = input.captureInsertion()
  if (draftRev !== composer.draftRev) return false
  const end = composer.draft.length
  return input.insertText(separatorAfter(composer.draft) + text + '\n', { start: end, end, draftRev })
}
