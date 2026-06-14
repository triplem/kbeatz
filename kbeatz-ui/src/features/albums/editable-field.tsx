import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { CancelledByUserError } from './cancelled-by-user-error'
import styles from './editable-field.module.css'

// Pencil edit icon (U+270E) - used as a visual affordance for click-to-edit fields
// Defined as a module constant to avoid i18next lint warnings on JSX string literals
const EDIT_ICON = '✎'

// Visually-hidden style for the edit input's <label>. The project ships no
// stylesheet (no .sr-only utility class exists), so the standard clip-rect
// pattern is applied inline. This keeps the label in the accessibility tree
// and clickable to focus the input, while removing it from the visual layout.
const VISUALLY_HIDDEN: React.CSSProperties = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  padding: 0,
  margin: '-1px',
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap',
  border: 0,
}

/**
 * Classify a tag-write error into a user-friendly message.
 *
 * - Network error (TypeError: Failed to fetch): "could not reach kbeatz-catalog"
 * - HTTP 500 or 503: "server error"
 * - AbortError / timeout: "request timed out"
 * - Other: generic "save failed"
 */
function classifyTagWriteError(err: unknown, t: TFunction): string {
  if (err instanceof TypeError && err.message.toLowerCase().includes('fetch')) {
    return t('editableField.saveFailedUnreachable')
  }
  if (err instanceof DOMException && err.name === 'AbortError') {
    return t('editableField.saveFailedTimeout')
  }
  // API client errors have a `status` property
  const apiErr = err as { status?: number }
  if (apiErr.status === 500 || apiErr.status === 503) {
    return t('editableField.saveFailedServer')
  }
  // InternalSentinelError means a sentinel onSave was called unexpectedly.
  // Map it to a generic user-facing message rather than exposing the developer string.
  if (err instanceof Error && err.name === 'InternalSentinelError') {
    return t('editableField.saveFailed')
  }
  if (err instanceof Error) return err.message
  return t('editableField.saveFailed')
}

interface EditableFieldProps {
  readonly label: string
  readonly value: string | undefined
  readonly fieldName: string
  readonly onSave: (field: string, value: string) => Promise<void>
  readonly testIdPrefix?: string
  /** When true, the field is in read-only display mode and cannot enter edit mode.
   *  Used to disable all fields while another field's PATCH is in flight. */
  readonly disabled?: boolean
  /** Optional ID of an element that describes the editing scope (e.g. "all N files").
   *  Used by the input's aria-describedby. */
  readonly scopeDescribedBy?: string
  /** Optional formatted value shown in display mode. When omitted, `value` is shown.
   *  The edit input always uses the raw `value` so the tag is not corrupted on save. */
  readonly displayValue?: string
  /**
   * When provided, Tab and Enter commit the current value as a pending dirty change
   * by calling onCommit instead of onSave. The field exits edit mode immediately
   * without firing a network request. The parent collects dirty fields and batch-saves
   * them when the user clicks Save.
   *
   * When absent, Enter calls onSave directly (original per-field save behaviour,
   * used for track-level fields).
   */
  readonly onCommit?: (field: string, value: string) => void
}

/**
 * EditableField - click-to-edit inline text input for a single Vorbis Comment field.
 *
 * Accessibility (WCAG AA):
 * - Display button has aria-label describing both the field name and current value.
 * - Input has a programmatically associated, visually-hidden <label htmlFor>;
 *   optionally aria-describedby for scope notice.
 * - Escape key cancels edit and returns focus to the display button.
 * - After save completes (or is cancelled), focus returns to the display button.
 * - Pencil icon is aria-hidden (the aria-label already conveys edit affordance).
 *
 * Behaviour:
 * - Click on value text - input appears pre-filled with current value
 * - Enter (no onCommit) - calls onSave; triggers confirmation dialog before the PATCH is fired
 * - Enter/Tab (with onCommit) - commits value as a pending dirty change; no network request;
 *   parent collects dirty changes and batch-saves on Save button click
 * - Blur (click away) - silently cancels edit, restores original value; no dialog, no API call
 * - Escape - cancels edit, restores original value; no API call made; focus returns to button
 * - On save error - rolls back to pre-edit value and sets error message
 */
export function EditableField({
  label,
  value,
  fieldName,
  onSave,
  testIdPrefix = '',
  disabled = false,
  scopeDescribedBy,
  displayValue,
  onCommit,
}: EditableFieldProps) {
  const { t } = useTranslation()
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState(value ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showHint, setShowHint] = useState(false)
  /**
   * Tracks the last value committed via Tab/Enter in dirty mode. When set, this
   * value is shown in display mode instead of the server-authoritative `value` prop,
   * so the user sees their pending edit reflected immediately without waiting for the
   * batch Save to complete. Cleared when `value` prop changes from the outside (e.g.
   * after the batch save refreshes the album).
   */
  const [committedValue, setCommittedValue] = useState<string | undefined>(undefined)
  const inputRef = useRef<HTMLInputElement>(null)
  const displayButtonRef = useRef<HTMLButtonElement>(null)
  const hintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  /**
   * Set to true when commitDirty() fires so that the blur event that follows
   * immediately after Tab does not trigger cancelEditing() (which would show the
   * "changes discarded" hint even though the change was committed as dirty).
   * Reset to false in cancelEditing() and commitDirty() after use.
   */
  const skipNextCancelRef = useRef(false)

  // Keep editValue in sync when value prop changes externally (e.g. after parent refreshes).
  useEffect(() => {
    if (!editing) {
      setEditValue(value ?? '')
    }
  }, [value, editing])

  // Clear committedValue only when the server-authoritative value prop changes (e.g. after a
  // successful batch save refreshes the album data). This must NOT fire when `editing` changes,
  // otherwise Tab-committing a dirty value would clear the committed display immediately.
  useEffect(() => {
    setCommittedValue(undefined)
  }, [value])

  const startEditing = useCallback(() => {
    setEditing(true)
    // If a dirty value has been committed, pre-fill the input with that pending value
    // so the user continues editing from where they left off.
    setEditValue(committedValue ?? value ?? '')
    setError(null)
    setShowHint(false)
    if (hintTimerRef.current !== null) {
      clearTimeout(hintTimerRef.current)
      hintTimerRef.current = null
    }
  }, [value, committedValue])

  const cancelEditing = useCallback(() => {
    // If commitDirty() already handled this blur (e.g. Tab keydown followed by blur),
    // skip the cancel logic to avoid showing a spurious "changes discarded" hint.
    if (skipNextCancelRef.current) {
      skipNextCancelRef.current = false
      return
    }
    // Show hint when the user blurs away with a changed value (Tab / click-away).
    // This tells them Enter is required to commit, since blur silently discards changes.
    const hasUnsavedChange = editValue.trim() !== (value ?? '')
    setEditing(false)
    setEditValue(value ?? '')
    setError(null)
    if (hasUnsavedChange) {
      setShowHint(true)
      if (hintTimerRef.current !== null) clearTimeout(hintTimerRef.current)
      hintTimerRef.current = setTimeout(() => {
        setShowHint(false)
        hintTimerRef.current = null
      }, 2000)
    }
    // Return focus to the display button so keyboard users can continue navigating
    setTimeout(() => { displayButtonRef.current?.focus() }, 0)
  }, [value, editValue])

  /**
   * Commits the current edit value as a dirty (pending) change without firing a network request.
   * Called when onCommit is provided and Tab or Enter is pressed.
   * The committed value is shown in display mode until the batch Save clears it.
   *
   * @param restoreFocus - When true (Enter key), focus returns to the display button.
   *   When false (Tab key), focus is left to the browser so Tab moves to the next field.
   */
  const commitDirty = useCallback((restoreFocus: boolean) => {
    if (!editing) return
    const newValue = editValue.trim()
    // Signal to cancelEditing (triggered by the blur that follows Tab) to skip its logic.
    skipNextCancelRef.current = true
    // Call onCommit regardless of whether the value changed - the parent de-duplicates.
    onCommit?.(fieldName, newValue)
    setCommittedValue(newValue)
    setEditing(false)
    setError(null)
    if (restoreFocus) {
      // Enter: return focus to the display button so the user stays on the same field.
      setTimeout(() => { displayButtonRef.current?.focus() }, 0)
    }
    // Tab: do not steal focus - the browser moves it to the next focusable element.
  }, [editing, editValue, fieldName, onCommit])

  const commitEdit = useCallback(async () => {
    if (!editing || saving) return
    const newValue = editValue.trim()
    const originalValue = value ?? ''

    // No change - just cancel
    if (newValue === originalValue) {
      setEditing(false)
      setTimeout(() => { displayButtonRef.current?.focus() }, 0)
      return
    }

    setSaving(true)
    try {
      await onSave(fieldName, newValue)
      setEditing(false)
      setError(null)
      // Return focus to the display button after successful save
      setTimeout(() => { displayButtonRef.current?.focus() }, 0)
    } catch (err) {
      // Rollback to original value
      setEditValue(originalValue)
      setEditing(false)
      // CancelledByUserError means the user dismissed the confirmation dialog -
      // do not show an error; the field silently returns to display mode.
      if (err instanceof CancelledByUserError) {
        setError(null)
      } else {
        setError(classifyTagWriteError(err, t))
      }
      // Return focus to the display button even on error
      setTimeout(() => { displayButtonRef.current?.focus() }, 0)
    } finally {
      setSaving(false)
    }
  }, [editing, saving, editValue, value, fieldName, onSave, t])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        if (onCommit !== undefined) {
          // Dirty-commit mode: capture the value as pending; no network request yet.
          // restoreFocus=true so focus returns to this field's display button.
          commitDirty(true)
        } else {
          void commitEdit()
        }
      } else if (e.key === 'Tab') {
        if (onCommit !== undefined) {
          // Tab commits the value as dirty and lets the browser move focus naturally.
          // Do NOT call e.preventDefault() so focus moves to the next field.
          // restoreFocus=false so we don't interfere with browser Tab navigation.
          commitDirty(false)
        }
        // When onCommit is absent, Tab behaves as normal (blur fires -> cancelEditing).
      } else if (e.key === 'Escape') {
        e.preventDefault()
        cancelEditing()
      }
    },
    [commitEdit, commitDirty, cancelEditing, onCommit],
  )

  // Blur silently cancels the edit without opening the confirmation dialog.
  // Only Enter (explicit commit intent) should trigger the save/confirmation flow.
  // Guard: when saving is true the confirm dialog just stole focus - do not cancel.
  const handleBlur = useCallback(() => {
    if (!saving) cancelEditing()
  }, [cancelEditing, saving])

  // Focus input when entering edit mode
  useEffect(() => {
    if (editing) {
      inputRef.current?.focus()
    }
  }, [editing])

  // Clean up the hint auto-dismiss timer on unmount
  useEffect(() => {
    return () => {
      if (hintTimerRef.current !== null) clearTimeout(hintTimerRef.current)
    }
  }, [])

  const prefix = testIdPrefix ? `${testIdPrefix}-` : ''
  const errorId = error !== null ? `${prefix}error-${fieldName.toLowerCase()}` : undefined
  const inputId = `${prefix}input-${fieldName.toLowerCase()}`

  return (
    <div className={styles.editableField} data-testid={`${prefix}field-${fieldName.toLowerCase()}`}>
      <dt className={styles.fieldLabel}>{label}</dt>
      <dd className={styles.fieldValue}>
        {editing ? (
          <>
            {/* Programmatically associated label. Visually hidden because the
                surrounding <dt> already shows the field name; the label exists
                so screen readers announce the input and clicking it focuses the
                field (WCAG 1.3.1 / 3.3.2). */}
            <label htmlFor={inputId} style={VISUALLY_HIDDEN}>
              {t('editableField.editLabel', { label })}
            </label>
            <input
              ref={inputRef}
              id={inputId}
              type="text"
              value={editValue}
              onChange={(e) => { setEditValue(e.target.value) }}
              onKeyDown={handleKeyDown}
              onBlur={handleBlur}
              disabled={saving}
              aria-describedby={scopeDescribedBy}
              aria-busy={saving}
              data-testid={inputId}
              className={styles.editInput}
            />
          </>
        ) : (
          <button
            ref={displayButtonRef}
            type="button"
            onClick={disabled ? undefined : startEditing}
            aria-label={value
              ? t('editableField.editWithValue', { label, value })
              : t('editableField.editEmpty', { label })}
            aria-describedby={errorId}
            data-testid={`${prefix}value-${fieldName.toLowerCase()}`}
            className={styles.displayButton}
            title={disabled ? undefined : t('editableField.clickToEdit', { label })}
            disabled={disabled}
            aria-disabled={disabled}
          >
            {(committedValue ?? displayValue ?? value) ?? <span className={styles.emptyValue}>{t('common.empty')}</span>}
            {/* Pencil affordance - hidden from screen readers since aria-label already describes the action */}
            <span className={styles.editIcon} aria-hidden="true">{EDIT_ICON}</span>
          </button>
        )}
        {error !== null && (
          <p
            role="alert"
            id={errorId}
            className={styles.errorMessage}
            data-testid={`${prefix}error-${fieldName.toLowerCase()}`}
          >
            {error}
          </p>
        )}
        {showHint && (
          <p
            className={styles.hint}
            aria-live="polite"
            data-testid={`${prefix}hint-${fieldName.toLowerCase()}`}
          >
            {t('editableField.hint')}
          </p>
        )}
      </dd>
    </div>
  )
}
