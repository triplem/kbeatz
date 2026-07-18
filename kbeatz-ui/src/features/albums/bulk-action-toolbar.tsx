import { useTranslation } from 'react-i18next'
import { Button } from '@astryxdesign/core/Button'
import { Text } from '@astryxdesign/core/Text'

interface BulkActionToolbarProps {
  /** Number of currently selected albums. */
  readonly selectedCount: number
  /** Start a directory-reorganize (RELAYOUT) change plan for the selection. */
  readonly onReorganize: () => void
  /** Clear the current selection. */
  readonly onClear: () => void
}

/**
 * BulkActionToolbar - actions for the currently selected albums.
 *
 * Shown only when at least one album is selected. Offers "Reorganize
 * directories" (a RELAYOUT change plan) and a clear-selection control. Rendered
 * as a labelled toolbar with a polite live count for screen readers.
 */
export function BulkActionToolbar({
  selectedCount,
  onReorganize,
  onClear,
}: BulkActionToolbarProps) {
  const { t } = useTranslation()

  return (
    <div
      role="toolbar"
      aria-label={t('albumSelection.toolbarLabel')}
      data-testid="bulk-action-toolbar"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        flexWrap: 'wrap',
        padding: 12,
        marginBottom: 8,
        borderRadius: 'var(--radius-element, 8px)',
        background: 'var(--color-background-muted, rgba(128, 128, 128, 0.12))',
      }}
    >
      <p
        role="status"
        aria-live="polite"
        data-testid="bulk-selected-count"
        style={{ margin: 0 }}
      >
        <Text weight="semibold">
          {t('albumSelection.selectedCount', { count: selectedCount })}
        </Text>
      </p>
      <div style={{ flexGrow: 1 }} />
      <Button
        type="button"
        variant="primary"
        onClick={onReorganize}
        data-testid="bulk-reorganize-button"
        label={t('albumSelection.reorganize')}
      />
      <Button
        type="button"
        variant="secondary"
        onClick={onClear}
        data-testid="bulk-clear-button"
        label={t('albumSelection.clear')}
      />
    </div>
  )
}
