/**
 * Annotations per previewed file, keyed by the tab's resource address
 * (`dsh-resource://file/session/<sessionId>/<path>`), so a file's comments
 * belong to the conversation they will be sent to.
 *
 * Memory is the working copy and every change is published at once; storage
 * is then brought in line. Two facts per file decide what syncing may do:
 *
 * - `unread`: the saved copy could not be read, so storage may hold comments
 *   memory has never seen. Nothing is written until a read succeeds and the
 *   two are merged.
 * - `dirty`: memory has changes storage has not accepted yet.
 *
 * Either fact shows as the entry's `storageError` until a retry succeeds.
 */
import { sameVersion, sortByPosition, type Annotation, type Delivery, type FileEntry } from '../model.ts'
import { storagePersistence, type StorageFace } from './persistence.ts'

/** Store operations; one instance lives in the main bundle and is handed to the viewer chunk. */
export interface AnnotationStore {
  subscribe(key: string, listener: () => void): () => void
  get(key: string): FileEntry
  add(key: string, annotation: Annotation): void
  update(key: string, id: string, patch: Pick<Annotation, 'comment'>): void
  remove(key: string, id: string): void
  /** Remove every annotation. @returns the removed annotations, for Restore. */
  clear(key: string): readonly Annotation[]
  /** Put annotations back, keeping any with the same id that exist now. */
  restore(key: string, annotations: readonly Annotation[]): void
  /** Remove the annotations a send carried, unless they were edited since. */
  acknowledge(key: string, sent: readonly Annotation[]): void
  setPanel(key: string, open: boolean): void
  setDelivery(key: string, delivery: Delivery): void
  /** Try storage again after a failed read or write. */
  retryPersistence(key: string): void
}

/** Union by id; on a clash the later list wins. */
function mergeById(earlier: readonly Annotation[], later: readonly Annotation[]): readonly Annotation[] {
  return [...new Map([...earlier, ...later].map(item => [item.id, item])).values()]
}

/** @param access - the Storage to persist to; tests pass failing ones. */
export function createAnnotationStore(access: () => StorageFace | undefined = () => globalThis.localStorage): AnnotationStore {
  const persistence = storagePersistence(access)
  const entries = new Map<string, FileEntry>()
  const listeners = new Map<string, Set<() => void>>()
  const unread = new Set<string>()
  const dirty = new Set<string>()

  function read(key: string): FileEntry {
    let entry = entries.get(key)
    if (entry === undefined) {
      try {
        entry = { annotations: persistence.load(key), panelOpen: false }
      } catch {
        unread.add(key)
        entry = { annotations: [], panelOpen: false, storageError: 'read' }
      }
      entries.set(key, entry)
    }
    return entry
  }

  function publish(key: string, entry: FileEntry): void {
    entries.set(key, entry)
    for (const listener of listeners.get(key) ?? []) listener()
  }

  /** Bring storage in line with `entry`, reporting what is still out of sync. */
  function sync(key: string, entry: FileEntry): FileEntry {
    let annotations = entry.annotations
    if (unread.has(key)) {
      try {
        annotations = sortByPosition(mergeById(persistence.load(key), annotations))
        unread.delete(key)
      } catch {
        return { ...entry, storageError: 'read' }
      }
    }
    if (dirty.has(key)) {
      try {
        persistence.save(key, annotations)
        dirty.delete(key)
      } catch {
        return { ...entry, annotations, storageError: 'write' }
      }
    }
    return { ...entry, annotations, storageError: undefined }
  }

  function change(key: string, annotations: readonly Annotation[]): void {
    dirty.add(key)
    publish(key, sync(key, { ...read(key), annotations: sortByPosition(annotations) }))
  }

  return {
    subscribe(key, listener) {
      let set = listeners.get(key)
      if (set === undefined) listeners.set(key, set = new Set())
      set.add(listener)
      return () => { set.delete(listener) }
    },
    get: read,
    add(key, annotation) {
      change(key, [...read(key).annotations, annotation])
    },
    update(key, id, patch) {
      change(key, read(key).annotations.map(item => item.id === id ? { ...item, ...patch } : item))
    },
    remove(key, id) {
      change(key, read(key).annotations.filter(item => item.id !== id))
    },
    clear(key) {
      const removed = read(key).annotations
      change(key, [])
      return removed
    },
    restore(key, annotations) {
      change(key, mergeById(annotations, read(key).annotations))
    },
    acknowledge(key, sent) {
      change(key, read(key).annotations.filter(item => !sent.some(done => sameVersion(done, item))))
    },
    setPanel(key, open) {
      const entry = read(key)
      if (entry.panelOpen !== open) publish(key, { ...entry, panelOpen: open })
    },
    setDelivery(key, delivery) {
      publish(key, { ...read(key), delivery })
    },
    retryPersistence(key) {
      publish(key, sync(key, read(key)))
    },
  }
}
