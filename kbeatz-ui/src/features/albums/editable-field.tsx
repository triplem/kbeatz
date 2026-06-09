import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CancelledByUserError } from './cancelled-by-user-error'

// Pencil edit icon (U+270E) - used as a visual affordance for click-to-edit fields
// Defined as a module constant to avoid i18next lint warnings on JSX string literals
const EDIT_ICON = '✎'

interface EditableFieldProps {
  readonly label: string
  readonly value: string | undefined
  readonly fieldName: string
  readonly onSave: (field: string, value: string) => Promise<void>
  readonly testIdPrefix?: string
}

/**
 * EditableField - click-to-edit inline text input for a single Vorbis Comment field.
 *
 * Behaviour:
 * - Click on value text - input appears pre-filled with current value
 * - Enter - calls onSave; triggers confirmation dialog before the PATCH is fired
 * - Blur (click away) - silently cancels edit, restores original value; no dialog, no API call
 * - Escape - cancels edit, restores original value; no API call made
 * - On save error - rolls back to pre-edit value and sets error message
 */
export function EditableField({
  label,
  value,
  fieldName,
  onSave,
  testIdPrefix = '',
}: EditableFieldProps) {
  const { t } = useTranslation()
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState(value ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

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
  }, [value])

  const commitEdit = useCallback(async () => {
    if (!editing || saving) return
    const newValue = editValue.trim()
    const originalValue = value ?? ''

    // No change - just cancel
    if (newValue === originalValue) {
      setEditing(false)
      return
    }

    setSaving(true)
    try {
      await onSave(fieldName, newValue)
      setEditing(false)
      setError(null)
    } catch (err) {
      // Rollback to original value
      setEditValue(originalValue)
      setEditing(false)
      // CancelledByUserError means the user dismissed the confirmation dialog -
      // do not show an error; the field silently returns to display mode.
      if (err instanceof CancelledByUserError) {
        setError(null)
      } else {
        setError(err instanceof Error ? err.message : t('editableField.saveFailed'))
      }
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

  return (
    <div className="editable-field" data-testid={`${prefix}field-${fieldName.toLowerCase()}`}>
      <dt className="editable-field__label">{label}</dt>
      <dd className="editable-field__value">
        {editing ? (
          <input
            ref={inputRef}
            type="text"
            value={editValue}
            onChange={(e) => { setEditValue(e.target.value) }}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            disabled={saving}
            aria-label={t('editableField.editLabel', { label })}
            data-testid={`${prefix}input-${fieldName.toLowerCase()}`}
            className="editable-field__input"
          />
        ) : (
          <button
            type="button"
            onClick={startEditing}
            aria-label={value
              ? t('editableField.editWithValue', { label, value })
              : t('editableField.editEmpty', { label })}
            data-testid={`${prefix}value-${fieldName.toLowerCase()}`}
            className="editable-field__display"
            title={t('editableField.clickToEdit', { label })}
          >
            {value ?? <span className="editable-field__empty">{t('common.empty')}</span>}
            {/* Pencil affordance - hidden from screen readers since aria-label already describes the action */}
            <span className="editable-field__edit-icon" aria-hidden="true">{EDIT_ICON}</span>
          </button>
        )}
        {error !== null && (
          <p role="alert" className="editable-field__error" data-testid={`${prefix}error-${fieldName.toLowerCase()}`}>
            {error}
          </p>
        )}
      </dd>
    </div>
  )
}
