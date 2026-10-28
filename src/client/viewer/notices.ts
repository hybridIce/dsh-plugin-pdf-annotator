/** What the strip above the action bar says, and for how long. */
import type { Annotation, Delivery } from '../model.ts'

/** A short-lived message from an action in this viewer. */
export interface Notice {
  readonly text: string
  /** Annotations the action removed; the notice offers Restore. */
  readonly undo?: readonly Annotation[]
  /** Distinguishes repeats of the same text. */
  readonly seq: number
}

/** How long an ordinary notice stays. */
export const NOTICE_MS = 6000
/** Notices that offer Restore stay longer, so the reader has time to reach the button. */
export const UNDO_NOTICE_MS = 20000

/** @returns how long `notice` stays on screen. */
export function noticeLifetime(notice: Notice): number {
  return notice.undo === undefined ? NOTICE_MS : UNDO_NOTICE_MS
}

/** The "Send now" strip derived from the file's delivery state. */
export interface DeliveryBanner {
  readonly tone: 'progress' | 'success' | 'warning'
  /** Dictionary key, taking `{count}`. */
  readonly key: 'notice.sending' | 'notice.sent' | 'notice.sendFailed'
  readonly count: number
}

/**
 * Derived from state rather than copied into the viewer, so reopening the
 * preview never replays an old result: progress shows while the attempt
 * runs, success briefly, and failure for as long as unsent annotations remain.
 * @param delivery - the file's last attempt.
 * @param remaining - annotations still in the file.
 * @param now - current time in epoch milliseconds.
 */
export function deliveryBanner(delivery: Delivery | undefined, remaining: number, now: number): DeliveryBanner | undefined {
  if (delivery === undefined) return undefined
  switch (delivery.kind) {
    case 'sending':
      return { tone: 'progress', key: 'notice.sending', count: delivery.count }
    case 'accepted':
      return now - delivery.at < NOTICE_MS ? { tone: 'success', key: 'notice.sent', count: delivery.count } : undefined
    case 'failed':
      return remaining > 0 ? { tone: 'warning', key: 'notice.sendFailed', count: delivery.count } : undefined
  }
}
