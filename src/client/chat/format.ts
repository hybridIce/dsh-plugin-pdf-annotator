/** Turning annotations into the chat message the agent receives. */
import type { Translate } from '../host.ts'
import type { Annotation } from '../model.ts'

const FILE_ADDRESS = /^dsh-resource:\/\/file\/session\/[^/]+\/(.+)$/

/**
 * The file path inside a Session file address.
 * @param address - `dsh-resource://file/session/<sessionId>/<encoded path>`.
 * @returns the decoded path (workspace-relative or absolute), or undefined.
 */
export function pathOfAddress(address: string): string | undefined {
  const match = FILE_ADDRESS.exec(address)
  if (match?.[1] === undefined) return undefined
  try {
    return match[1].split('/').map(decodeURIComponent).join('/')
  } catch {
    return undefined
  }
}

/**
 * Mention a file the way DSH's `@file` references serialize, so the agent can
 * open it with its file tools: `@path`, or `@"path"` when it contains spaces.
 * A path the grammar cannot carry (quotes, control characters) falls back to
 * inline code.
 */
export function mentionOf(address: string): string {
  const path = pathOfAddress(address)
  if (path === undefined) return '`PDF`'
  // eslint-disable-next-line no-control-regex
  if (/["\u0000-\u001f]/.test(path)) return `\`${path.replace(/`/g, '')}\``
  return /\s/.test(path) ? `@"${path}"` : `@${path}`
}

/**
 * Build one chat message from a file's annotations, in document order.
 * Quotes become Markdown blockquotes, which DSH renders as quotations.
 * @param t - this plugin's translator (the UI language decides the wording).
 * @param address - the previewed file's resource address.
 * @param annotations - annotations, already sorted.
 * @returns the message text.
 */
export function formatMessage(t: Translate, address: string, annotations: readonly Annotation[]): string {
  const lines = [t('message.header', { file: mentionOf(address), count: annotations.length })]
  annotations.forEach((annotation, index) => {
    lines.push('', t('message.item', { n: index + 1, page: annotation.page }))
    for (const line of annotation.quote.split('\n')) lines.push(`> ${line}`)
    const comment = annotation.comment.trim()
    if (comment !== '') lines.push(t('message.comment', { comment }))
  })
  return lines.join('\n')
}
