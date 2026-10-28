/**
 * "Send now": the batch goes to the Session on its own, and the annotations
 * leave the PDF only once the Host admits it. This lives outside React so
 * closing the preview cannot lose the outcome.
 */
import type { SendResult, SessionSender } from '../host.ts'
import type { AnnotationStore } from '../annotations/store.ts'

/** Sends one message to the viewer's Session. */
export type SendAnnotations = (text: string) => Promise<SendResult>

let attempts = 0

/**
 * Submit a message the way the composer does: register the submission echo,
 * then prompt with its request id; abandon the echo if the Host refuses.
 * @param session - the Session's sender; undefined when the binding is gone.
 * @param text - the message.
 * @returns the Host's answer.
 */
export async function sendAnnotationMessage(session: SessionSender | undefined, text: string): Promise<SendResult> {
  if (session === undefined) return { ok: false }
  const submission = session.beginSubmission({ mode: 'queue', text, attachments: [] })
  try {
    const result = await session.prompt([{ type: 'text', text }], 'queue', undefined, submission.requestId)
    if (!result.ok) submission.abandon()
    return result
  } catch (error) {
    submission.abandon()
    throw error
  }
}

/** Only an explicit acceptance counts; a malformed answer is a failure. */
export function isAccepted(result: SendResult): boolean {
  return result.ok && result.value?.accepted === true
}

/** Whether the Host admitted the message; a refusal and a thrown error both count as no. */
async function admitted(send: SendAnnotations, text: string): Promise<boolean> {
  try {
    return isAccepted(await send(text))
  } catch {
    return false
  }
}

/**
 * Send a file's annotations as one message and follow the attempt in the
 * file's delivery state. One attempt at a time; never retried automatically.
 * Annotations added or edited while it is in flight stay in the PDF.
 * @param store - annotation store.
 * @param key - the file's resource address.
 * @param text - the formatted message.
 * @param send - sends to the viewer's Session.
 */
export async function deliverAnnotations(store: AnnotationStore, key: string, text: string, send: SendAnnotations): Promise<void> {
  const { annotations, delivery } = store.get(key)
  if (delivery?.kind === 'sending' || annotations.length === 0) return
  const attempt = { count: annotations.length, seq: ++attempts }
  // Set synchronously, so a second click before React re-renders is refused too.
  store.setDelivery(key, { ...attempt, kind: 'sending', at: Date.now() })
  const accepted = await admitted(send, text)
  if (accepted) {
    store.acknowledge(key, annotations)
    if (store.get(key).annotations.length === 0) store.setPanel(key, false)
  }
  store.setDelivery(key, { ...attempt, kind: accepted ? 'accepted' : 'failed', at: Date.now() })
}
