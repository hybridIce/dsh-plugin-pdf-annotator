/** Viewer rules that need no DOM: highlight marks, hit testing, and the status strips. */
import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import type { Annotation, Delivery } from '../src/client/model.ts'
import { annotationAt, marksByPage, PENDING_ID } from '../src/client/viewer/marks.ts'
import { NOTICE_MS, UNDO_NOTICE_MS, deliveryBanner, noticeLifetime } from '../src/client/viewer/notices.ts'

function note(id: string, rects: Annotation['rects']): Annotation {
  return { id, page: rects[0]?.page ?? 1, quote: id, comment: '', createdAt: 1, rects }
}

const first = note('first', [{ page: 1, x: 0.1, y: 0.1, w: 0.5, h: 0.02 }, { page: 1, x: 0.1, y: 0.13, w: 0.3, h: 0.02 }])
const across = note('across', [{ page: 1, x: 0.1, y: 0.9, w: 0.5, h: 0.02 }, { page: 2, x: 0.1, y: 0.05, w: 0.4, h: 0.02 }])

test('marks are grouped by page, badged once per annotation, in list order', () => {
  const marks = marksByPage([first, across], {})
  assert.deepEqual(marks.get(1)?.map(mark => [mark.id, mark.badge, mark.state]), [
    ['first', 1, 'idle'], ['first', undefined, 'idle'], ['across', 2, 'idle'],
  ])
  assert.deepEqual(marks.get(2)?.map(mark => [mark.id, mark.badge]), [['across', undefined]])
})

test('flash wins over hover, and a pending selection is drawn on its own', () => {
  const pending = [{ page: 2, x: 0.2, y: 0.5, w: 0.1, h: 0.02 }]
  const marks = marksByPage([first, across], { flash: 'across', hover: ['across', 'first', undefined], pending })
  assert.deepEqual([...new Set(marks.get(1)?.map(mark => `${mark.id}:${mark.state}`))], ['first:hover', 'across:flash'])
  assert.deepEqual(marks.get(2)?.map(mark => `${mark.id}:${mark.state}`), ['across:flash', `${PENDING_ID}:pending`])
})

test('a point hits the annotation whose box contains it, with a little slack', () => {
  assert.equal(annotationAt([first, across], 1, 0.3, 0.11), 'first')
  assert.equal(annotationAt([first, across], 1, 0.098, 0.135), 'first')
  assert.equal(annotationAt([first, across], 2, 0.3, 0.06), 'across')
  assert.equal(annotationAt([first, across], 2, 0.3, 0.11), undefined)
  assert.equal(annotationAt([first, across], 3, 0.3, 0.11), undefined)
})

test('the send strip shows progress, success briefly, and failure while comments remain', () => {
  const at = 1_000_000
  const delivery = (kind: Delivery['kind']): Delivery => ({ kind, count: 2, seq: 1, at })
  assert.equal(deliveryBanner(undefined, 1, at), undefined)
  assert.deepEqual(deliveryBanner(delivery('sending'), 2, at + 60_000), { tone: 'progress', key: 'notice.sending', count: 2 })
  assert.deepEqual(deliveryBanner(delivery('accepted'), 0, at + NOTICE_MS - 1), { tone: 'success', key: 'notice.sent', count: 2 })
  assert.equal(deliveryBanner(delivery('accepted'), 0, at + NOTICE_MS), undefined)
  assert.deepEqual(deliveryBanner(delivery('failed'), 2, at + 60_000), { tone: 'warning', key: 'notice.sendFailed', count: 2 })
  assert.equal(deliveryBanner(delivery('failed'), 0, at), undefined)
})

test('notices offering Restore stay longer', () => {
  assert.equal(noticeLifetime({ text: 'x', seq: 1 }), NOTICE_MS)
  assert.equal(noticeLifetime({ text: 'x', seq: 1, undo: [first] }), UNDO_NOTICE_MS)
})
