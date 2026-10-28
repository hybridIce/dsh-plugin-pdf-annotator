import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { appendToComposer } from '../src/client/chat/composer.ts'
import { deliverAnnotations, sendAnnotationMessage } from '../src/client/chat/delivery.ts'
import { STORAGE_PREFIX } from '../src/client/annotations/persistence.ts'
import { createAnnotationStore } from '../src/client/annotations/store.ts'
import type { InputActions, SendResult, SessionSender } from '../src/client/host.ts'
import type { Annotation } from '../src/client/model.ts'

const key = 'dsh-resource://file/session/test/paper.pdf'
const accepted: SendResult = { ok: true, value: { accepted: true } }

function note(id = 'one', comment = 'Explain this'): Annotation {
  return { id, page: 1, quote: 'A sentence', comment, createdAt: 1, rects: [{ page: 1, x: .1, y: .2, w: .3, h: .02 }] }
}

class MemoryStorage {
  data = new Map<string, string>()
  readError = false
  writeError = false
  removeError = false
  getItem(key: string): string | null {
    if (this.readError) throw new Error('SecurityError')
    return this.data.get(key) ?? null
  }
  setItem(key: string, value: string): void {
    if (this.writeError) throw new Error('QuotaExceededError')
    this.data.set(key, value)
  }
  removeItem(key: string): void {
    if (this.removeError) throw new Error('SecurityError')
    this.data.delete(key)
  }
}

function fixture() {
  const storage = new MemoryStorage()
  const store = createAnnotationStore(() => storage)
  store.add(key, note())
  return { storage, store }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

test('selected draft text and reference-chip identity survive append', () => {
  const chip = { type: 'reference', text: '@paper.pdf' }
  const nodes: (string | typeof chip)[] = ['保留已有要求 ', chip]
  const original = '保留已有要求 @paper.pdf'
  let draft = original
  const input: InputActions = {
    captureInsertion: () => ({ start: 0, end: draft.length, draftRev: 7 }),
    insertText: (text, span) => {
      assert.equal(span.start, original.length)
      assert.equal(span.start, span.end)
      assert.equal(span.draftRev, 7)
      nodes.push(text)
      draft = draft.slice(0, span.start) + text + draft.slice(span.end)
      return true
    },
    submit: () => { assert.fail('Insertion must not send') },
  }
  assert.equal(appendToComposer(input, { draft, draftRev: 7 }, 'PDF 批注'), true)
  assert.equal(draft, original + '\n\nPDF 批注\n')
  assert.equal(nodes[1], chip)
})

test('a stale rendered draft cannot append with a newer captured revision', () => {
  let edits = 0
  const input: InputActions = {
    captureInsertion: () => ({ start: 0, end: 0, draftRev: 8 }),
    insertText: () => { edits++; return true }, submit: () => {},
  }
  assert.equal(appendToComposer(input, { draft: 'stale', draftRev: 7 }, 'batch'), false)
  assert.equal(edits, 0)
  input.captureInsertion = () => ({ start: 0, end: 0, draftRev: 7 })
  input.insertText = () => false
  assert.equal(appendToComposer(input, { draft: 'current', draftRev: 7 }, 'batch'), false)
})

test('quota failure is visible, retains memory, and retry makes it survive reload', () => {
  const { storage, store } = fixture()
  storage.writeError = true
  store.update(key, 'one', { comment: 'Updated comment' })
  assert.equal(store.get(key).storageError, 'write')
  assert.equal(store.get(key).annotations[0]?.comment, 'Updated comment')
  store.setPanel(key, true)
  assert.equal(store.get(key).storageError, 'write')
  storage.writeError = false
  store.retryPersistence(key)
  assert.equal(store.get(key).storageError, undefined)
  assert.equal(createAnnotationStore(() => storage).get(key).annotations[0]?.comment, 'Updated comment')
})

test('a failed clear remains visibly unsaved until removeItem succeeds', () => {
  const { storage, store } = fixture()
  storage.removeError = true
  store.clear(key)
  assert.equal(store.get(key).annotations.length, 0)
  assert.equal(store.get(key).storageError, 'write')
  assert.equal(createAnnotationStore(() => storage).get(key).annotations.length, 1)
  storage.removeError = false
  store.retryPersistence(key)
  assert.equal(store.get(key).storageError, undefined)
  assert.equal(createAnnotationStore(() => storage).get(key).annotations.length, 0)
})

test('blocked initial read never overwrites older notes; retry merges new notes', () => {
  const { storage } = fixture()
  storage.readError = true
  const store = createAnnotationStore(() => storage)
  assert.equal(store.get(key).storageError, 'read')
  store.add(key, note('new'))
  assert.equal(store.get(key).storageError, 'read')
  assert.equal(JSON.parse(storage.data.get(STORAGE_PREFIX + key)!).length, 1)
  storage.readError = false
  store.retryPersistence(key)
  assert.equal(store.get(key).storageError, undefined)
  assert.deepEqual(createAnnotationStore(() => storage).get(key).annotations.map(x => x.id), ['one', 'new'])
})

test('missing storage, throwing storage getters, and corrupt data are not silent', () => {
  for (const access of [() => undefined, () => { throw new Error('SecurityError') }]) {
    const store = createAnnotationStore(access)
    store.add(key, note())
    assert.equal(store.get(key).storageError, 'read')
    assert.equal(store.get(key).annotations.length, 1)
    store.retryPersistence(key)
    assert.equal(store.get(key).storageError, 'read')
  }
  const storage = new MemoryStorage()
  storage.data.set(STORAGE_PREFIX + key, '{corrupt')
  const store = createAnnotationStore(() => storage)
  store.add(key, note())
  assert.equal(store.get(key).storageError, 'read')
  assert.equal(storage.data.get(STORAGE_PREFIX + key), '{corrupt')
})

test('pending send keeps annotations and blocks duplicate clicks until acknowledgment', async () => {
  const { store, storage } = fixture()
  const pending = deferred<SendResult>()
  let calls = 0
  const send = () => { calls++; return pending.promise }
  const job = deliverAnnotations(store, key, 'batch', send)
  assert.equal(store.get(key).delivery?.kind, 'sending')
  assert.equal(store.get(key).annotations.length, 1)
  assert.equal(createAnnotationStore(() => storage).get(key).annotations.length, 1)
  await deliverAnnotations(store, key, 'batch', send)
  assert.equal(calls, 1)
  pending.resolve(accepted)
  await job
  assert.equal(store.get(key).delivery?.kind, 'accepted')
  assert.equal(store.get(key).annotations.length, 0)
  assert.equal(createAnnotationStore(() => storage).get(key).annotations.length, 0)
})

test('rejection, thrown error and malformed acknowledgment retain annotations for retry', async () => {
  const { store } = fixture()
  const attempts = [
    async (): Promise<SendResult> => ({ ok: false }),
    async (): Promise<SendResult> => { throw new Error('offline') },
    async (): Promise<SendResult> => ({ ok: true, value: {} } as SendResult),
  ]
  for (const send of attempts) {
    await deliverAnnotations(store, key, 'batch', send)
    assert.equal(store.get(key).delivery?.kind, 'failed')
    assert.equal(store.get(key).annotations.length, 1)
  }
  await deliverAnnotations(store, key, 'batch', async () => accepted)
  assert.equal(store.get(key).delivery?.kind, 'accepted')
  assert.equal(store.get(key).annotations.length, 0)
})

test('late acknowledgment clears only sent versions in the original file', async () => {
  const { store } = fixture()
  store.add(key, note('unchanged'))
  store.add('another-session', note())
  const pending = deferred<SendResult>()
  const job = deliverAnnotations(store, key, 'batch', () => pending.promise)
  store.update(key, 'one', { comment: 'Edited while sending' })
  store.add(key, note('new'))
  pending.resolve(accepted)
  await job
  assert.deepEqual(store.get(key).annotations.map(x => x.id), ['one', 'new'])
  assert.equal(store.get(key).annotations[0]?.comment, 'Edited while sending')
  assert.equal(store.get('another-session').annotations.length, 1)
})

test('accepted send still surfaces persistence failure when cleanup cannot be saved', async () => {
  const { store, storage } = fixture()
  storage.removeError = true
  await deliverAnnotations(store, key, 'batch', async () => accepted)
  assert.equal(store.get(key).delivery?.kind, 'accepted')
  assert.equal(store.get(key).storageError, 'write')
  assert.equal(store.get(key).annotations.length, 0)
})

test('session adapter waits for the same identified queue request and never submits the draft', async () => {
  const pending = deferred<SendResult>()
  let abandoned = 0
  const session: SessionSender = {
    beginSubmission: input => {
      assert.deepEqual(input, { mode: 'queue', text: 'batch', attachments: [] })
      return { requestId: 'request-1', abandon: () => { abandoned++ } }
    },
    prompt: (content, mode, signal, requestId) => {
      assert.deepEqual(content, [{ type: 'text', text: 'batch' }])
      assert.equal(mode, 'queue')
      assert.equal(signal, undefined)
      assert.equal(requestId, 'request-1')
      return pending.promise
    },
  }
  const job = sendAnnotationMessage(session, 'batch')
  pending.resolve(accepted)
  assert.equal(await job, accepted)
  assert.equal(abandoned, 0)
  session.prompt = async () => ({ ok: false })
  assert.deepEqual(await sendAnnotationMessage(session, 'batch'), { ok: false })
  assert.equal(abandoned, 1)
  session.prompt = async () => { throw new Error('offline') }
  await assert.rejects(sendAnnotationMessage(session, 'batch'), /offline/)
  assert.equal(abandoned, 2)
  assert.deepEqual(await sendAnnotationMessage(undefined, 'batch'), { ok: false })
})
