/**
 * Host half of the PDF annotator. Everything happens in the browser half
 * (`lib/client.js`), which DSH discovers through `dsh.client` in package.json;
 * the Loader still needs an importable plugin module for this entry.
 */
export const name = 'pdf-annotator'

/** Nothing to register on the Host. */
export function apply(): void {}
