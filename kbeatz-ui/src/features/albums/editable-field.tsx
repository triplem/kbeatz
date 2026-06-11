import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { CancelledByUserError } from './cancelled-by-user-error'

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
 * - Enter - calls onSave; triggers confirmation dialog before the PATCH is fired
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
}: EditableFieldProps) {
  const { t } = useTranslation()
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState(value ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const displayButtonRef = useRef<HTMLButtonElement>(null)

  // Keep editValue in sync when value prop changes externally (e.g. after parent refreshes)
  useEffect(() => {
    if (!editing) {
      setEditValue(value ?? '')
    }
  }, [value, editing])

  const startEditing = useCallback(() => {
    setEditing(true)
    setEditValue(value ?? '')
    setError(null)
  }, [value])

  const cancelEditing = useCallback(() => {
    setEditing(false)
    setEditValue(value ?? '')
    setError(null)
    // Return focus to the display button so keyboard users can continue navigating
    setTimeout(() => { displayButtonRef.current?.focus() }, 0)
  }, [value])

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
        void commitEdit()
      } else if (e.key === 'Escape') {
        e.preventDefault()
        cancelEditing()
      }
    },
    [commitEdit, cancelEditing],
  )

  // Blur silently cancels the edit without opening the confirmation dialog.
  // Only Enter (explicit commit intent) should trigger the save/confirmation flow.
  const handleBlur = useCallback(() => {
    cancelEditing()
  }, [cancelEditing])

  // Focus input when entering edit mode
  useEffect(() => {
    if (editing) {
      inputRef.current?.focus()
    }
  }, [editing])

  const prefix = testIdPrefix ? `${testIdPrefix}-` : ''
  const errorId = error !== null ? `${prefix}error-${fieldName.toLowerCase()}` : undefined
  const inputId = `${prefix}input-${fieldName.toLowerCase()}`

  return (
    <div className="editable-field" data-testid={`${prefix}field-${fieldName.toLowerCase()}`}>
      <dt className="editable-field__label">{label}</dt>
      <dd className="editable-field__value">
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
              className="editable-field__input"
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
            className="editable-field__display"
            title={disabled ? undefined : t('editableField.clickToEdit', { label })}
            disabled={disabled}
            aria-disabled={disabled}
          >
            {(displayValue ?? value) ?? <span className="editable-field__empty">{t('common.empty')}</span>}
            {/* Pencil affordance - hidden from screen readers since aria-label already describes the action */}
            <span className="editable-field__edit-icon" aria-hidden="true">{EDIT_ICON}</span>
          </button>
        )}
        {error !== null && (
          <p
            role="alert"
            id={errorId}
            className="editable-field__error"
            data-testid={`${prefix}error-${fieldName.toLowerCase()}`}
          >
            {error}
          </p>
        )}
      </dd>
    </div>
  )
}
