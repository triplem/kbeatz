import { useCallback, useMemo, useState } from 'react'

/** Object return shape of {@link useAlbumSelection}. */
export interface UseAlbumSelectionResult {
  /** The currently selected album ids, in insertion order. */
  readonly selectedIds: ReadonlyArray<string>
  /** The number of selected albums. */
  readonly selectedCount: number
  /** True when at least one album is selected. */
  readonly hasSelection: boolean
  /** Returns true when the given album id is selected. */
  readonly isSelected: (albumId: string) => boolean
  /** Toggle the selection state of a single album id. */
  readonly toggle: (albumId: string) => void
  /** Clear the entire selection. */
  readonly clear: () => void
}

/**
 * Local multi-select state for the album list.
 *
 * Selection is page-local component state (a Set of album ids) per
 * react-patterns.md: it is ephemeral UI state, not server state and not global
 * state, so it lives in the page and is not lifted into a store.
 */
export function useAlbumSelection(): UseAlbumSelectionResult {
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set())

  const toggle = useCallback((albumId: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(albumId)) {
        next.delete(albumId)
      } else {
        next.add(albumId)
      }
      return next
    })
  }, [])

  const clear = useCallback(() => {
    setSelected((prev) => (prev.size === 0 ? prev : new Set()))
  }, [])

  const isSelected = useCallback((albumId: string) => selected.has(albumId), [selected])

  const selectedIds = useMemo(() => [...selected], [selected])

  return {
    selectedIds,
    selectedCount: selected.size,
    hasSelection: selected.size > 0,
    isSelected,
    toggle,
    clear,
  }
}
