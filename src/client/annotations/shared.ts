/**
 * The one store instance shared by the header button and the lazy viewer.
 * The viewer chunk receives it through the kit instead of importing this
 * module, which would bundle a second, separate copy.
 */
import { useSyncExternalStore } from 'react'
import type { FileEntry } from '../model.ts'
import { createAnnotationStore } from './store.ts'

/** Backed by the page's localStorage. */
export const annotationStore = createAnnotationStore()

/**
 * Subscribe a component to one file's entry.
 * @param key - resource address.
 * @param select - must return a value already held by the entry (no new objects).
 * @returns the selected value.
 */
export function useEntry<T>(key: string, select: (entry: FileEntry) => T): T {
  return useSyncExternalStore(
    listener => annotationStore.subscribe(key, listener),
    () => select(annotationStore.get(key)),
  )
}
