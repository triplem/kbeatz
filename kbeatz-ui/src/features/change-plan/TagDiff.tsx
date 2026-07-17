import { useTranslation } from 'react-i18next'
import { Text } from '@astryxdesign/core/Text'
import type { TagChange } from '../../api/generated'

interface TagDiffProps {
  /** The per-field tag changes for one release. May be empty. */
  readonly changes: ReadonlyArray<TagChange>
}

const cellStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '4px 8px',
  borderBottom: '1px solid var(--color-border)',
  verticalAlign: 'top',
}

/** Render a value cell, showing an accessible placeholder when the value is empty. */
function ValueCell({ value, testId }: { readonly value: string | null | undefined; readonly testId: string }) {
  const { t } = useTranslation()
  const isEmpty = value === null || value === undefined || value === ''
  return (
    <td data-testid={testId} style={cellStyle}>
      {isEmpty ? (
        <span aria-label={t('changePlan.emptyAriaLabel')} style={{ color: 'var(--color-text-disabled)' }}>
          {t('changePlan.empty')}
        </span>
      ) : (
        value
      )}
    </td>
  )
}

/**
 * TagDiff - a per-field "current -> proposed" table for one release.
 *
 * Empty current/proposed values render an accessible "(empty)" placeholder so a
 * field being set or cleared is unambiguous. When there are no changes the
 * component renders nothing (the parent decides what to show instead).
 */
export function TagDiff({ changes }: TagDiffProps) {
  const { t } = useTranslation()

  if (changes.length === 0) {
    return null
  }

  return (
    <table
      data-testid="tag-diff-table"
      aria-label={t('changePlan.tagChangesLabel')}
      style={{ borderCollapse: 'collapse', width: '100%' }}
    >
      <thead>
        <tr>
          <th scope="col" style={cellStyle}>
            <Text type="label">{t('changePlan.field')}</Text>
          </th>
          <th scope="col" style={cellStyle}>
            <Text type="label">{t('changePlan.currentValue')}</Text>
          </th>
          <th scope="col" style={cellStyle}>
            <Text type="label">{t('changePlan.proposedValue')}</Text>
          </th>
        </tr>
      </thead>
      <tbody>
        {changes.map((change, index) => (
          <tr
            key={`${change.targetPath}:${change.field}:${index}`}
            data-testid={`tag-diff-row-${change.field}`}
          >
            <th scope="row" style={cellStyle}>
              {change.field}
            </th>
            <ValueCell value={change.currentValue} testId={`tag-diff-current-${change.field}`} />
            <ValueCell value={change.proposedValue} testId={`tag-diff-proposed-${change.field}`} />
          </tr>
        ))}
      </tbody>
    </table>
  )
}
