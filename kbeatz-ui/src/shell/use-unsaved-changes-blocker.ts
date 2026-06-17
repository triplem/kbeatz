import { useEffect } from 'react'
import { useBlocker, type Blocker } from 'react-router-dom'

/**
 * Router-aware unsaved-changes blocker.
 *
 * Wraps react-router's `useBlocker`, which intercepts BOTH in-app route
 * changes (link clicks, `navigate()`) AND browser back/forward navigations
 * within the data router. This is the single shell-level mechanism the
 * acceptance criteria require: the guard fires on react-router navigation and
 * on the browser back/forward buttons, not merely on in-component state.
 *
 * It additionally installs a `beforeunload` handler so a full page
 * reload / tab close while dirty also prompts the native browser warning.
 * `beforeunload` is the only way to guard a hard navigation away from the SPA;
 * react-router cannot intercept that.
 *
 * The returned `Blocker` exposes:
 * - `state`: 'unblocked' | 'blocked' | 'proceeding'
 * - `proceed()`: continue the blocked navigation (discard changes)
 * - `reset()`: cancel the blocked navigation (stay on the page)
 *
 * Callers render a confirmation dialog when `state === 'blocked'` and wire its
 * confirm/cancel actions to `proceed`/`reset`.
 */
export function useUnsavedChangesBlocker(hasUnsavedChanges: boolean): Blocker {
  const blocker = useBlocker(hasUnsavedChanges)

  useEffect(() => {
    if (!hasUnsavedChanges) {
      return
    }
    const handleBeforeUnload = (event: BeforeUnloadEvent): void => {
      event.preventDefault()
      // Legacy browsers require returnValue to be set to trigger the prompt.
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [hasUnsavedChanges])

  return blocker
}
