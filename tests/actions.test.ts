/** The viewer's two exits, "Add to chat" and "Send now", without React. */
import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { createChatActions, type AnnotatedFile } from '../src/client/chat/actions.ts'
import { createAnnotationStore } from '../src/client/annotations/store.ts'
import type { StorageFace } from '../src/client/annotations/persistence.ts'
import type { InputActions, SendResult, Translate } from '../src/client/host.ts'
import type { Annotation } from '../src/client/model.ts'

const file: AnnotatedFile = { key: 'dsh-resource://file/session/s/paper.pdf', address: 'dsh-resource://file/session/s/paper.pdf' }
const t: Translate = (key, params = {}) => `${key}${JSON.stringify(params)}`

function memory(): StorageFace {
  const data = new Map<string, string>()
  return { getItem: key => data.get(key) ?? null, setItem: (key, value) => { data.set(key, value) }, removeItem: (key) => { data.delete(key) } }
}

function note(id: string, page = 1): Annotation {
  return { id, page, quote: `quote ${id}`, comment: `comment ${id}`, createdAt: 1, rects: [{ page, x: 0.1, y: 0.2, w: 0.3, h: 0.02 }] }
}

function setup(...annotations: Annotation[]) {
  const storage = memory()
  const store = createAnnotationStore(() => storage)
  for (const annotation of annotations) store.add(file.key, annotation)
  store.setPanel(file.key, true)
  return { store, actions: createChatActions(store) }
}

/** A composer at revision 3 that records what it was asked to insert. */
function composer(accept = true) {
  const inserted: string[] = []
  let submitted = 0
  const input: InputActions = {
    captureInsertion: () => ({ start: 0, end: 0, draftRev: 3 }),
    insertText: (text) => { inserted.push(text); return accept },
    submit: () => { submitted += 1 },
  }
  return { input, inserted, submitted: () => submitted }
}

test('add to chat appends one block after the draft, then takes the annotations off the PDF', () => {
  const { store, actions } = setup(note('a'), note('b', 2))
  const chat = composer()
  const outcome = actions.addToChat(file, t, chat.input, { draft: 'my request', draftRev: 3, phase: 'plain' })
  assert.equal(outcome.kind, 'added')
  assert.deepEqual(outcome.kind === 'added' ? outcome.removed.map(item => item.id) : [], ['a', 'b'])
  assert.equal(chat.inserted.length, 1)
  assert.ok(chat.inserted[0]?.startsWith('\n\nmessage.header'))
  assert.match(chat.inserted[0] ?? '', /> quote a[\s\S]*> quote b/)
  assert.equal(chat.submitted(), 0)
  assert.equal(store.get(file.key).annotations.length, 0)
  assert.equal(store.get(file.key).panelOpen, false)
})

test('add to chat keeps the annotations when the composer is busy or refuses', () => {
  const { store, actions } = setup(note('a'))
  for (const phase of ['submitting', 'adjudicating', 'sending'] as const) {
    const chat = composer()
    assert.deepEqual(actions.addToChat(file, t, chat.input, { draft: '', draftRev: 3, phase }), { kind: 'busy' })
    assert.equal(chat.inserted.length, 0)
  }
  assert.deepEqual(actions.addToChat(file, t, composer().input, { draft: '', draftRev: 2, phase: 'plain' }), { kind: 'refused' })
  assert.deepEqual(actions.addToChat(file, t, composer(false).input, { draft: '', draftRev: 3, phase: 'plain' }), { kind: 'refused' })
  assert.equal(store.get(file.key).annotations.length, 1)
  assert.equal(store.get(file.key).panelOpen, true)
  assert.deepEqual(setup().actions.addToChat(file, t, composer().input, { draft: '', draftRev: 3, phase: 'plain' }), { kind: 'empty' })
})

test('send now leaves the composer alone and clears the batch once the Host accepts it', async () => {
  const { store, actions } = setup(note('a'))
  const chat = composer()
  let accept!: (result: SendResult) => void
  const sent: string[] = []
  const send = (text: string) => { sent.push(text); return new Promise<SendResult>((resolve) => { accept = resolve }) }
  assert.equal(actions.sendNow(file, t, 'plain', send), 'started')
  assert.equal(store.get(file.key).delivery?.kind, 'sending')
  assert.equal(actions.busy(file, 'plain'), true)
  assert.equal(actions.sendNow(file, t, 'plain', send), 'busy')
  assert.deepEqual(actions.addToChat(file, t, chat.input, { draft: '', draftRev: 3, phase: 'plain' }), { kind: 'busy' })
  assert.equal(sent.length, 1)
  accept({ ok: true, value: { accepted: true } })
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(store.get(file.key).delivery?.kind, 'accepted')
  assert.equal(store.get(file.key).annotations.length, 0)
  assert.equal(chat.inserted.length + chat.submitted(), 0)
  assert.equal(actions.sendNow(file, t, 'plain', send), 'empty')
})

test('send now waits while the composer itself is submitting', () => {
  const { store, actions } = setup(note('a'))
  assert.equal(actions.sendNow(file, t, 'submitting', async () => ({ ok: true, value: { accepted: true } })), 'busy')
  assert.equal(store.get(file.key).delivery, undefined)
})
