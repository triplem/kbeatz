import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { Text } from '@astryxdesign/core/Text'
import { Icon } from '@astryxdesign/core/Icon'
import { Pencil } from 'lucide-react'
import { CancelledByUserError } from './cancelled-by-user-error'

/** Screen-reader-only style (visually hidden but present in the a11y tree). */
const srOnly: CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
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
  /**
   * Markup variant for the label/value wrapper.
   *
   * - `'dl'` (default): renders the field as a `<dt>`/`<dd>` pair, valid only
   *   inside a `<dl>` (used by the album-tags definition list).
   * - `'cell'`: renders plain `<div>` wrappers with a visually-hidden label, for
   *   use inside a table cell where the column header already labels the field.
   *   Emitting `<dt>`/`<dd>` outside a `<dl>` is a WCAG 1.3.1 violation, so
   *   table-context fields must use this variant.
   */
  readonly variant?: 'dl' | 'cell'
}

/**
 * EditableField - click-to-edit inline text input for a single Vorbis Comment field.
 *
 * Rebuilt on Astryx tokens (styled native <button>/<input> + Text) so it is
 * theme-aware in both light and dark modes. Behaviour and accessibility are
 * unchanged from the previous implementation.
 *
 * Accessibility (WCAG AA):
 * - Display control is a <button> with an aria-label describing the field name
 *   and current value; it has a visible focus ring and a >=44px touch target.
 * - The edit input has a programmatically associated, visually-hidden <label htmlFor>;
 *   optionally aria-describedby for a scope notice.
 * - Escape key cancels edit and returns focus to the display button.
 * - After save completes (or is cancelled), focus returns to the display button.
 * - Pencil icon is aria-hidden (the aria-label already conveys edit affordance).
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
  variant = 'dl',
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

  // Sync editValue and clear committedValue when value/editing change externally.
  // During-render state adjustment avoids cascading renders from setState-in-effect.
  const [prevValue, setPrevValue] = useState(value)
  const [prevEditing, setPrevEditing] = useState(editing)
  if (prevValue !== value) {
    setPrevValue(value)
    setCommittedValue(undefined)
    if (!editing) {
      setEditValue(value ?? '')
    }
  }
  if (prevEditing !== editing) {
    setPrevEditing(editing)
    if (!editing) {
      setEditValue(value ?? '')
    }
  }

  const startEditing = useCallback(() => {
    setEditing(true)
    setEditValue(committedValue ?? value ?? '')
    setError(null)
    setShowHint(false)
    if (hintTimerRef.current !== null) {
      clearTimeout(hintTimerRef.current)
      hintTimerRef.current = null
    }
  }, [value, committedValue])

  const cancelEditing = useCallback(() => {
    if (skipNextCancelRef.current) {
      skipNextCancelRef.current = false
      return
    }
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
    setTimeout(() => { displayButtonRef.current?.focus() }, 0)
  }, [value, editValue])

  const commitDirty = useCallback((restoreFocus: boolean) => {
    if (!editing) return
    const newValue = editValue.trim()
    skipNextCancelRef.current = true
    onCommit?.(fieldName, newValue)
    setCommittedValue(newValue)
    setEditing(false)
    setError(null)
    if (restoreFocus) {
      setTimeout(() => { displayButtonRef.current?.focus() }, 0)
    }
  }, [editing, editValue, fieldName, onCommit])

  const commitEdit = useCallback(async () => {
    if (!editing || saving) return
    const newValue = editValue.trim()
    const originalValue = value ?? ''

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
      setTimeout(() => { displayButtonRef.current?.focus() }, 0)
    } catch (err) {
      setEditValue(originalValue)
      setEditing(false)
      if (err instanceof CancelledByUserError) {
        setError(null)
      } else {
        setError(classifyTagWriteError(err, t))
      }
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
          commitDirty(true)
        } else {
          void commitEdit()
        }
      } else if (e.key === 'Tab') {
        if (onCommit !== undefined) {
          commitDirty(false)
        }
      } else if (e.key === 'Escape') {
        e.preventDefault()
        cancelEditing()
      }
    },
    [commitEdit, commitDirty, cancelEditing, onCommit],
  )

  const handleBlur = useCallback(() => {
    if (!saving) cancelEditing()
  }, [cancelEditing, saving])

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus()
    }
  }, [editing])

  useEffect(() => {
    return () => {
      if (hintTimerRef.current !== null) clearTimeout(hintTimerRef.current)
    }
  }, [])

  const prefix = testIdPrefix ? `${testIdPrefix}-` : ''
  const errorId = error !== null ? `${prefix}error-${fieldName.toLowerCase()}` : undefined
  const inputId = `${prefix}input-${fieldName.toLowerCase()}`
  const resolvedDisplay = committedValue ?? displayValue ?? value

  const LabelTag = variant === 'dl' ? 'dt' : 'div'
  const ValueTag = variant === 'dl' ? 'dd' : 'div'

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(120px, 35%) 1fr',
        alignItems: 'baseline',
        columnGap: 16,
        rowGap: 4,
        padding: '4px 16px',
        borderBottom: '1px solid var(--color-border)',
      }}
      data-testid={`${prefix}field-${fieldName.toLowerCase()}`}
    >
      <LabelTag style={variant === 'dl' ? { margin: 0 } : srOnly}>
        {variant === 'dl' ? (
          <Text weight="medium" color="secondary">
            {label}
          </Text>
        ) : (
          label
        )}
      </LabelTag>
      <ValueTag style={{ margin: 0, minWidth: 0 }}>
        {editing ? (
          <>
            {/* Programmatically associated label, visually hidden because the
                surrounding <dt> already shows the field name. */}
            <label htmlFor={inputId} style={srOnly}>
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
              style={{
                width: '100%',
                padding: '4px 8px',
                border: '1px solid var(--color-accent, #6a4de8)',
                borderRadius: 'var(--radius-element, 8px)',
                background: 'var(--color-background-primary, #fff)',
                color: 'var(--color-text-primary)',
                fontSize: '1rem',
                fontFamily: 'inherit',
              }}
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
            title={disabled ? undefined : t('editableField.clickToEdit', { label })}
            disabled={disabled}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              minHeight: 44,
              maxWidth: '100%',
              padding: '2px 8px',
              borderRadius: 'var(--radius-element, 8px)',
              border: 'none',
              background: 'transparent',
              textAlign: 'left',
              justifyContent: 'flex-start',
              color: 'var(--color-text-primary)',
              fontSize: '1rem',
              fontFamily: 'inherit',
              cursor: disabled ? 'default' : 'pointer',
              opacity: disabled ? 0.6 : 1,
            }}
          >
            <span
              style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}
            >
              {resolvedDisplay !== undefined ? (
                resolvedDisplay
              ) : (
                <span style={{ color: 'var(--color-text-disabled)', fontStyle: 'italic' }}>
                  {t('common.empty')}
                </span>
              )}
            </span>
            {/* Pencil affordance - hidden from screen readers (aria-label describes the action) */}
            <span aria-hidden="true" style={{ flexShrink: 0, color: 'var(--color-text-disabled)' }}>
              <Icon icon={Pencil} size="xsm" color="disabled" />
            </span>
          </button>
        )}
        {error !== null && (
          <p
            role="alert"
            id={errorId}
            style={{ margin: '4px 0 0', color: 'var(--color-error, #d6336c)' }}
            data-testid={`${prefix}error-${fieldName.toLowerCase()}`}
          >
            <Text type="supporting">{error}</Text>
          </p>
        )}
        {showHint && (
          <p
            aria-live="polite"
            style={{ margin: '4px 0 0' }}
            data-testid={`${prefix}hint-${fieldName.toLowerCase()}`}
          >
            <Text type="supporting">{t('editableField.hint')}</Text>
          </p>
        )}
      </ValueTag>
    </div>
  )
}
