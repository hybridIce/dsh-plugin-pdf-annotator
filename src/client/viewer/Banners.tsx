/** The strips above the action bar: storage trouble, the last "Send now", and action notices. */
import { useCallback, useEffect, useReducer, useState, type ReactNode } from 'react'
import type { Translate } from '../host.ts'
import type { Annotation, Delivery, StorageError } from '../model.ts'
import { NOTICE_MS, deliveryBanner, noticeLifetime, type Notice } from './notices.ts'

let notices = 0

/** The current action notice; each one dismisses itself after its lifetime. */
export interface NoticeState {
  readonly notice: Notice | undefined
  /** Show `text`, offering Restore when `undo` is given. */
  readonly show: (text: string, undo?: readonly Annotation[]) => void
  readonly dismiss: () => void
}

/** @returns the current notice and functions to show or dismiss one. */
export function useNotice(): NoticeState {
  const [notice, setNotice] = useState<Notice>()
  useEffect(() => {
    if (notice === undefined) return
    const timer = window.setTimeout(() => { setNotice(undefined) }, noticeLifetime(notice))
    return () => { window.clearTimeout(timer) }
  }, [notice])
  const show = useCallback((text: string, undo?: readonly Annotation[]) => {
    notices += 1
    setNotice(undo === undefined ? { text, seq: notices } : { text, undo, seq: notices })
  }, [])
  const dismiss = useCallback(() => { setNotice(undefined) }, [])
  return { notice, show, dismiss }
}

/**
 * The current time, re-read when the success strip of `delivery` is due to
 * disappear, so the strip leaves without any other change.
 */
function useDeliveryClock(delivery: Delivery | undefined): number {
  const [, tick] = useReducer((count: number) => count + 1, 0)
  useEffect(() => {
    if (delivery?.kind !== 'accepted') return
    const left = delivery.at + NOTICE_MS - Date.now()
    if (left <= 0) return
    const timer = window.setTimeout(tick, left)
    return () => { window.clearTimeout(timer) }
  }, [delivery])
  return Date.now()
}

/** Props for the strips. */
export interface BannersProps {
  readonly t: Translate
  readonly storageError: StorageError | undefined
  readonly onRetryStorage: () => void
  readonly delivery: Delivery | undefined
  /** Annotations still in the file; a failed send only matters while some remain. */
  readonly remaining: number
  readonly notice: Notice | undefined
  readonly onRestore: (annotations: readonly Annotation[]) => void
}

/**
 * Storage trouble stays until a retry succeeds. The "Send now" strip follows
 * the file's delivery state. Action notices offer Restore when they removed
 * annotations.
 * @param props - states and callbacks.
 * @returns the strips that apply, possibly none.
 */
export function Banners({ t, storageError, onRetryStorage, delivery, remaining, notice, onRestore }: BannersProps): ReactNode {
  const now = useDeliveryClock(delivery)
  const sent = deliveryBanner(delivery, remaining, now)
  return (
    <>
      {storageError !== undefined && (
        <div className="pdfa-strip" data-tone="warning" role="alert" data-pdfa-storage-error>
          <span>{t(storageError === 'read' ? 'storage.readFailed' : 'storage.writeFailed')}</span>
          <button type="button" className="pdfa-link-button" onClick={onRetryStorage}>{t('storage.retry')}</button>
        </div>
      )}
      {sent !== undefined && delivery !== undefined && (
        <div
          className="pdfa-strip"
          data-tone={sent.tone}
          role={sent.tone === 'warning' ? 'alert' : 'status'}
          key={`delivery:${delivery.seq}:${delivery.kind}`}
          data-pdfa-delivery={delivery.kind}
        >
          <span>{t(sent.key, { count: sent.count })}</span>
        </div>
      )}
      {notice !== undefined && (
        <div className="pdfa-strip" role="status" key={`notice:${notice.seq}`} data-pdfa-notice>
          <span>{notice.text}</span>
          {notice.undo !== undefined && (
            <button type="button" className="pdfa-link-button" onClick={() => { onRestore(notice.undo ?? []) }}>
              {t('notice.undo')}
            </button>
          )}
        </div>
      )}
    </>
  )
}
