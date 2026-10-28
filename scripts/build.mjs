/**
 * Build the plugin without the DSH monorepo toolchain.
 *
 * DSH serves a browser plugin as a "closure factory" script: the file calls
 * `window.__ModuleLoader__.load({ id, factory })`, and the factory receives a
 * `require` that answers the shared module table (React, Cordis, ...). This
 * script bundles each entry as CommonJS with those modules external, then
 * wraps the result in that handshake. Outputs:
 *
 *   lib/index.js          Host half (an empty Cordis plugin; the work is in the browser)
 *   lib/client.js         Browser half: registrations, toolbar button, lazy loader
 *   lib/client.viewer.js  On-demand chunk: PDF.js, the viewer, the annotation UI
 */
import { readFileSync, readdirSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))

/** Modules the DSH shell shares with every plugin (packages/client/web/src/platform.ts). */
const PLATFORM_MODULES = [
  'react', 'react/jsx-runtime', 'react-dom', 'react-dom/client', '@deepseek-ai/cordis',
  'zod', '@tanstack/react-virtual',
  '@deepseek-ai/dsh-client-store', '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-ui-primitives', '@deepseek-ai/dsh-client-ui-dockkit',
]
/** Node-only branches inside PDF.js; they never run in the browser. */
const NODE_ONLY = ['fs', 'url', 'path', 'module', 'zlib', 'http', 'https', 'canvas', 'path2d']

const pdfRoot = dirname(require.resolve('pdfjs-dist/package.json'))

/** Font maps, standard fonts and image decoders PDF.js would otherwise fetch over the network. */
function pdfAssets() {
  return JSON.stringify(Object.fromEntries([
    ['cMapUrl', 'cmaps'], ['standardFontDataUrl', 'standard_fonts'], ['wasmUrl', 'wasm'],
  ].map(([kind, directory]) => [kind, Object.fromEntries(
    readdirSync(join(pdfRoot, directory)).filter(name => !name.startsWith('LICENSE')).sort()
      .map(name => [name, readFileSync(join(pdfRoot, directory, name)).toString('base64')]),
  )])))
}

/** Keep the PDF.js license visible in the artifact that embeds it. */
function pdfLicenseBanner() {
  const text = readFileSync(join(pdfRoot, 'LICENSE'), 'utf8').trimEnd()
  return ['//! PDF.js (Apache-2.0) is bundled below.', ...text.split('\n').map(line => `// ${line}`)].join('\n')
}

/** Import the PDF.js worker as source text; a factory bundle has no URL to load a worker file from. */
const workerAsText = {
  name: 'pdf-worker-source',
  setup(b) {
    b.onResolve({ filter: /^pdfjs-dist\/build\/pdf\.worker\.min\.mjs\?raw$/ }, () => ({
      path: require.resolve('pdfjs-dist/build/pdf.worker.min.mjs'), namespace: 'raw-text',
    }))
    b.onLoad({ filter: /.*/, namespace: 'raw-text' }, args => ({
      contents: readFileSync(args.path, 'utf8'), loader: 'text',
    }))
  },
}

/** Wrap a CommonJS bundle in DSH's module-loader handshake. */
function wrap(code, chunk) {
  const header = [
    'window.__ModuleLoader__.load({',
    `\tid: ${JSON.stringify(pkg.name)},`,
    ...(chunk === undefined ? [] : [`\tchunk: ${JSON.stringify(chunk)},`]),
    '\tfactory: (require) => {',
    '\t\tvar __dshRequire = require;',
    '\t\tvar module = { exports: {} };',
    '\t\tvar exports = module.exports;',
  ].join('\n')
  return `${header}\n${code}\n\t\treturn module.exports;\n\t}\n});\n`
}

/**
 * Bundle one browser entry and write it in factory form.
 * @returns the written byte length.
 */
async function bundleClient(entry, outFile, { chunk, banner, plugins = [], define = {} } = {}) {
  const result = await build({
    entryPoints: [join(root, entry)],
    bundle: true,
    write: false,
    format: 'cjs',
    platform: 'browser',
    target: 'chrome120',
    jsx: 'automatic',
    legalComments: 'none',
    charset: 'utf8',
    external: [...PLATFORM_MODULES, ...NODE_ONLY],
    loader: { '.css': 'text' },
    mainFields: ['browser', 'module', 'main'],
    define: { 'process.env.NODE_ENV': '"production"', ...define },
    plugins,
    logLevel: 'warning',
  })
  const text = (banner === undefined ? '' : `${banner}\n`) + wrap(result.outputFiles[0].text, chunk)
  writeFileSync(join(root, outFile), text)
  return Buffer.byteLength(text)
}

rmSync(join(root, 'lib'), { recursive: true, force: true })
mkdirSync(join(root, 'lib'), { recursive: true })

await build({
  entryPoints: [join(root, 'src/index.ts')],
  outfile: join(root, 'lib/index.js'),
  bundle: true, format: 'esm', platform: 'node', target: 'node22', logLevel: 'warning',
})
const client = await bundleClient('src/client/index.ts', 'lib/client.js')
const viewer = await bundleClient('src/client/viewer/index.ts', 'lib/client.viewer.js', {
  chunk: 'client.viewer.js',
  banner: pdfLicenseBanner(),
  plugins: [workerAsText],
  define: { __PDFA_ASSETS__: pdfAssets() },
})
console.log(`built lib/index.js, lib/client.js (${(client / 1024).toFixed(0)} KiB), lib/client.viewer.js (${(viewer / 1024 / 1024).toFixed(1)} MiB)`)
