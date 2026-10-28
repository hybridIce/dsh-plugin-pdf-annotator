/** Build-time and loader-provided names that TypeScript cannot see. */

/** CSS files are bundled as text and injected by `injectStyle`. */
declare module '*.css' {
  const css: string
  export default css
}

/** The PDF.js worker, bundled as source text (see scripts/build.mjs). */
declare module 'pdfjs-dist/build/pdf.worker.min.mjs?raw' {
  const source: string
  export default source
}

/** The official viewer's text layer, which ships its types beside the module. */
declare module 'pdfjs-dist/web/pdf_viewer.mjs' {
  export { TextLayerBuilder } from 'pdfjs-dist/types/web/text_layer_builder'
}

/** The module-loader `require` handed to this bundle's factory (see scripts/build.mjs). */
declare const __dshRequire: {
  /** Load a package-local chunk such as `./client.viewer.js`. */
  async(specifier: string): Promise<unknown>
}

/** Base64 PDF.js support files, inlined by the build. */
declare const __PDFA_ASSETS__: Readonly<Record<'cMapUrl' | 'standardFontDataUrl' | 'wasmUrl', Readonly<Record<string, string>>>>
