/**
 * Annotations in localStorage, in the 0.1.0 format and keys so upgrades keep
 * existing comments. Every failure throws; the store decides what it means.
 */
import { sortByPosition, type Annotation, type PageRect } from '../model.ts'

/** Key prefix, unchanged since 0.1.0. */
export const STORAGE_PREFIX = 'dsh-plugin-pdf-annotator:v1:'

/** The Storage methods used, so tests can supply a failing implementation. */
export type StorageFace = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

/** Loading and saving one file's annotations. */
export interface Persistence {
  /**
   * @returns the saved annotations in document order; none when nothing is saved.
   * @throws when storage is missing or blocked, or holds data this version cannot trust.
   */
  load(key: string): readonly Annotation[]
  /** @throws when storage refuses the write. */
  save(key: string, annotations: readonly Annotation[]): void
}

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isRect(value: unknown): value is PageRect {
  if (typeof value !== 'object' || value === null) return false
  const rect = value as Record<string, unknown>
  return finite(rect.page) && finite(rect.x) && finite(rect.y) && finite(rect.w) && finite(rect.h)
}

function isAnnotation(value: unknown): value is Annotation {
  if (typeof value !== 'object' || value === null) return false
  const item = value as Record<string, unknown>
  return typeof item.id === 'string' && finite(item.page) && typeof item.quote === 'string'
    && typeof item.comment === 'string' && finite(item.createdAt)
    && Array.isArray(item.rects) && item.rects.every(isRect)
}

/**
 * @param access - the Storage to use; it may return undefined or throw when the
 * browser blocks storage, which counts as a failed read or write.
 */
export function storagePersistence(access: () => StorageFace | undefined): Persistence {
  const storage = (): StorageFace => {
    const value = access()
    if (value === undefined) throw new Error('Storage unavailable')
    return value
  }
  return {
    load(key) {
      const raw = storage().getItem(STORAGE_PREFIX + key)
      if (raw === null) return []
      const parsed: unknown = JSON.parse(raw)
      // Partially valid data is still untrusted: reading it as empty would let the next save erase it.
      if (!Array.isArray(parsed) || !parsed.every(isAnnotation)) throw new Error('Invalid saved annotations')
      return sortByPosition(parsed)
    },
    save(key, annotations) {
      if (annotations.length === 0) storage().removeItem(STORAGE_PREFIX + key)
      else storage().setItem(STORAGE_PREFIX + key, JSON.stringify(annotations))
    },
  }
}
