/** Pure-logic checks: quote cleanup, line merging, message format, file mentions, composer spacing. */
import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { appendToComposer } from '../src/client/chat/composer.ts'
import { formatMessage, mentionOf, pathOfAddress } from '../src/client/chat/format.ts'
import { dictionaries } from '../src/client/locales.ts'
import type { InputActions, TokenSpan, Translate } from '../src/client/host.ts'
import type { Annotation } from '../src/client/model.ts'
import { mergeLineRects } from '../src/client/viewer/selection.ts'
import { normalizeQuote } from '../src/client/viewer/text.ts'

function translator(locale: 'zh' | 'en'): Translate {
  const dict = dictionaries[locale] as Record<string, string>
  return (key, params = {}) => (dict[key] ?? key).replace(/\{(\w+)\}/g, (_, name: string) => String(params[name]))
}

const ADDRESS = 'dsh-resource://file/session/session-1/papers/attention%20test.pdf'

function annotation(page: number, quote: string, comment: string, y = 0.1): Annotation {
  return { id: `${page}-${y}`, page, quote, comment, rects: [{ page, x: 0.1, y, w: 0.5, h: 0.02 }], createdAt: 0 }
}

test('normalizeQuote rejoins PDF lines', () => {
  assert.equal(normalizeQuote('based on complex\nrecurrent networks'), 'based on complex recurrent networks')
  assert.equal(normalizeQuote('sequence trans-\nduction models'), 'sequence transduction models')
  assert.equal(normalizeQuote('它允许对依\n赖关系进行建模'), '它允许对依赖关系进行建模')
  assert.equal(normalizeQuote('全局依赖关系。\nThe model'), '全局依赖关系。 The model')
  assert.equal(normalizeQuote('  eﬃcient   and\t fast \n\n'), 'efficient and fast')
  assert.equal(normalizeQuote('Self-\nAttention'), 'Self- Attention')
  assert.equal(normalizeQuote('\n \n'), '')
})

test('mergeLineRects joins touching boxes on one line only', () => {
  const merged = mergeLineRects([
    { page: 1, x: 0.10, y: 0.20, w: 0.30, h: 0.02 },
    { page: 1, x: 0.40, y: 0.201, w: 0.20, h: 0.02 },
    { page: 1, x: 0.10, y: 0.23, w: 0.40, h: 0.02 },
    { page: 2, x: 0.10, y: 0.20, w: 0.10, h: 0.02 },
  ])
  assert.equal(merged.length, 3)
  assert.equal(merged[0]?.x, 0.10)
  assert.ok(Math.abs((merged[0]?.w ?? 0) - 0.50) < 1e-9)
  assert.equal(merged[2]?.page, 2)
})

test('file mentions follow the @path grammar', () => {
  assert.equal(pathOfAddress(ADDRESS), 'papers/attention test.pdf')
  assert.equal(mentionOf(ADDRESS), '@"papers/attention test.pdf"')
  assert.equal(mentionOf('dsh-resource://file/session/s/Users/me/a.pdf'), '@Users/me/a.pdf')
  assert.equal(mentionOf('dsh-resource://file/session/s/%22odd%22.pdf'), '`"odd".pdf`')
  assert.equal(mentionOf('not-an-address'), '`PDF`')
})

test('formatMessage numbers comments and quotes each one', () => {
  const list = [annotation(1, 'first quote', '改写'), annotation(2, 'second quote', '')]
  assert.equal(formatMessage(translator('zh'), ADDRESS, list), [
    '请处理我在 @"papers/attention test.pdf" 中的 2 条批注：',
    '',
    '【1】第 1 页',
    '> first quote',
    '批注：改写',
    '',
    '【2】第 2 页',
    '> second quote',
  ].join('\n'))
  assert.match(formatMessage(translator('en'), ADDRESS, list), /^Please address my comments on @"papers\/attention test.pdf" \(2 in total\):\n\n\[1\] Page 1\n> first quote\nComment: 改写/)
})

function fakeInput(draft: string, span: { start: number; end: number }) {
  const inserted: string[] = []
  const input: InputActions = {
    captureInsertion: (): TokenSpan => ({ ...span, draftRev: 7 }),
    insertText: (text, at) => { assert.equal(at.draftRev, 7); inserted.push(text); return true },
    submit: () => {},
  }
  return { input, inserted, run: (text: string) => appendToComposer(input, { draft, draftRev: 7 }, text) }
}

test('appendToComposer appends the block with a blank line', () => {
  const empty = fakeInput('', { start: 0, end: 0 })
  empty.run('BLOCK')
  assert.deepEqual(empty.inserted, ['BLOCK\n'])

  const after = fakeInput('先看这几处：', { start: 6, end: 6 })
  after.run('BLOCK')
  assert.deepEqual(after.inserted, ['\n\nBLOCK\n'])

  const before = fakeInput('existing', { start: 0, end: 0 })
  before.run('BLOCK')
  assert.deepEqual(before.inserted, ['\n\nBLOCK\n'])

  const afterNewline = fakeInput('line\n', { start: 5, end: 5 })
  afterNewline.run('BLOCK')
  assert.deepEqual(afterNewline.inserted, ['\nBLOCK\n'])
})
