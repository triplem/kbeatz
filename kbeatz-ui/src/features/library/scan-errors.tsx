import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@astryxdesign/core/Button'
import { IconButton } from '@astryxdesign/core/IconButton'
import { Icon } from '@astryxdesign/core/Icon'
import { Text } from '@astryxdesign/core/Text'
import { X } from 'lucide-react'
import type { ScanErrorEntry } from '../../api/generated'

interface ScanErrorsProps {
  readonly errors: ReadonlyArray<ScanErrorEntry>
  readonly totalErrors: number
  /**
   * Called when the user triggers a new scan so that the error banner can
   * reset itself. Pass the scan-trigger callback from the parent.
   */
  readonly onDismiss?: () => void
}

/**
 * ScanErrors - banner shown after a scan completes with per-album errors.
 *
 * An error-toned `role="alert"` panel carrying the summary, an expand/collapse
 * toggle that reveals the individual error entries, and a dismiss action. Each
 * entry surfaces the album directory, the failure reason and a remediation
 * suggestion so operators get actionable context (graceful degradation: a
 * per-album failure does not fail the scan).
 *
 * Accessibility: the panel carries role="alert"; the toggle exposes
 * aria-expanded/aria-controls; the dismiss button is labelled.
 */
export function ScanErrors({ errors, totalErrors, onDismiss }: ScanErrorsProps) {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const listId = useId()

  if (dismissed || totalErrors === 0) {
    return null
  }

  const overflowCount = totalErrors - errors.length

  function handleDismiss() {
    setDismissed(true)
    onDismiss?.()
  }

  return (
    <div
      role="alert"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 8,
        padding: 16,
        borderRadius: 'var(--radius-element, 8px)',
        border: '1px solid var(--color-error, #d6336c)',
        background: 'var(--color-error-muted, rgba(214, 51, 108, 0.08))',
        position: 'relative',
      }}
    >
      <div style={{ position: 'absolute', top: 4, insetInlineEnd: 4 }}>
        <IconButton
          variant="ghost"
          size="sm"
          label={t('scanErrors.dismiss')}
          onClick={handleDismiss}
          icon={<Icon icon={X} />}
        />
      </div>
      <Text weight="semibold">{t('scanErrors.summary', { count: totalErrors })}</Text>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={() => { setExpanded((prev) => !prev) }}
        aria-expanded={expanded}
        aria-controls={listId}
        label={expanded ? t('scanErrors.hideDetails') : t('scanErrors.showDetails')}
      />

      {expanded && (
        <ul
          id={listId}
          aria-label={t('scanErrors.errorListLabel')}
          style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}
        >
          {errors.map((entry) => (
            <li key={entry.albumDir} style={{ display: 'block' }}>
              <Text as="span" display="block">{entry.albumDir}</Text>
              <span style={{ display: 'block' }}>
                <Text type="supporting">{entry.reason}</Text>
              </span>
              <span style={{ display: 'block' }}>
                <Text type="supporting">{t('scanErrors.entrySuggestion', { suggestion: entry.suggestion })}</Text>
              </span>
            </li>
          ))}
          {overflowCount > 0 && (
            <li>
              <Text type="supporting">{t('scanErrors.andMore', { count: overflowCount })}</Text>
            </li>
          )}
        </ul>
      )}
    </div>
  )
}
