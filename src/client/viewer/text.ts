/** Cleaning up text selected in a PDF text layer. */

const LIGATURES: Readonly<Record<string, string>> = {
  'ﬀ': 'ff', 'ﬁ': 'fi', 'ﬂ': 'fl', 'ﬃ': 'ffi', 'ﬄ': 'ffl', 'ﬅ': 'st', 'ﬆ': 'st',
}

/** CJK ideographs, kana, CJK punctuation and full-width forms: scripts written without spaces. */
const CJK = '\\u2e80-\\u2fdf\\u3000-\\u303f\\u3040-\\u30ff\\u3100-\\u312f\\u3400-\\u4dbf\\u4e00-\\u9fff\\uf900-\\ufaff\\ufe30-\\ufe4f\\uff00-\\uffef'
const CJK_LINE_BREAK = new RegExp(`([${CJK}])\\n(?=[${CJK}])`, 'gu')

/**
 * Turn a text-layer selection into one readable quote: PDF line breaks are
 * layout, not content, so lines are rejoined (without a space between CJK
 * characters), words hyphenated across lines are mended, and ligature
 * glyphs become letters.
 * @param raw - `Selection.toString()` over the text layer.
 * @returns the cleaned quote, possibly empty.
 */
export function normalizeQuote(raw: string): string {
  return raw
    .replace(/\u0000/g, '')
    .replace(/[ﬀ-ﬆ]/g, glyph => LIGATURES[glyph] ?? glyph)
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t ]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/([A-Za-z])-\n(?=[a-z])/g, '$1')
    .replace(CJK_LINE_BREAK, '$1')
    .replace(/\n+/g, ' ')
    .trim()
}
