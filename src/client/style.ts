/** Plugin-owned style tags, tagged the way DSH tags plugin CSS so its module eviction can find them. */

/** The package name, which DSH uses as this plugin's module id. */
export const PLUGIN_ID = 'dsh-plugin-pdf-annotator'

/**
 * Add a stylesheet once per document.
 * @param name - stable name within this plugin.
 * @param css - stylesheet text.
 */
export function injectStyle(name: string, css: string): void {
  if (typeof document === 'undefined') return
  const tagId = `${PLUGIN_ID}/${name}`
  if (document.querySelector(`style[data-plugin-css=${JSON.stringify(tagId)}]`) !== null) return
  const tag = document.createElement('style')
  tag.dataset.plugin = PLUGIN_ID
  tag.dataset.pluginCss = tagId
  tag.textContent = css
  document.head.appendChild(tag)
}
