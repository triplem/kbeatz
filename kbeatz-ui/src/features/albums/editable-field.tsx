import { useCallback, useEffect, useRef, useState } from 'react'
import { CancelledByUserError } from './cancelled-by-user-error'

interface EditableFieldProps {
  readonly label: string
  readonly value: string | undefined
  readonly fieldName: string
  readonly onSave: (field: string, value: string) => Promise<void>
  readonly testIdPrefix?: string
}

/**
 * EditableField — click-to-edit inline text input for a single Vorbis Comment field.
 *
 * Behaviour:
 * - Click on value text → input appears pre-filled with current value
 * - Enter or blur → calls onSave; optimistic update applied immediately
 * - Escape → cancels edit, restores original value; no API call made
 * - On save error → rolls back to pre-edit value and sets error message
 */
export function EditableField({
  label,
  value,
  fieldName,
  onSave,
  testIdPrefix = '',
}: EditableFieldProps) {
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

    // No change — just cancel
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
      // CancelledByUserError means the user dismissed the confirmation dialog —
      // do not show an error; the field silently returns to display mode.
      if (err instanceof CancelledByUserError) {
        setError(null)
      } else {
        setError(err instanceof Error ? err.message : 'Save failed')
      }
    } finally {
      setSaving(false)
    }
  }, [editing, saving, editValue, value, fieldName, onSave])

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

  const handleBlur = useCallback(() => {
    void commitEdit()
  }, [commitEdit])

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
            aria-label={`Edit ${label}`}
            data-testid={`${prefix}input-${fieldName.toLowerCase()}`}
            className="editable-field__input"
          />
        ) : (
          <button
            type="button"
            onClick={startEditing}
            aria-label={`Edit ${label}: ${value ?? '(empty)'}`}
            data-testid={`${prefix}value-${fieldName.toLowerCase()}`}
            className="editable-field__display"
          >
            {value ?? <span className="editable-field__empty">(empty — click to set)</span>}
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
