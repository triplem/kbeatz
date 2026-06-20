import { useTranslation } from 'react-i18next'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Box from '@mui/material/Box'
import type { TagChange } from '../../api/generated'

interface TagDiffProps {
  /** The per-field tag changes for one release. May be empty. */
  readonly changes: ReadonlyArray<TagChange>
}

/** Render a value cell, showing an accessible placeholder when the value is empty. */
function ValueCell({ value, testId }: { readonly value: string | null | undefined; readonly testId: string }) {
  const { t } = useTranslation()
  const isEmpty = value === null || value === undefined || value === ''
  return (
    <TableCell data-testid={testId}>
      {isEmpty ? (
        <Box component="span" aria-label={t('changePlan.emptyAriaLabel')} sx={{ color: 'text.disabled' }}>
          {t('changePlan.empty')}
        </Box>
      ) : (
        value
      )}
    </TableCell>
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
    <Table size="small" data-testid="tag-diff-table" aria-label={t('changePlan.tagChangesLabel')}>
      <TableHead>
        <TableRow>
          <TableCell component="th" scope="col">{t('changePlan.field')}</TableCell>
          <TableCell component="th" scope="col">{t('changePlan.currentValue')}</TableCell>
          <TableCell component="th" scope="col">{t('changePlan.proposedValue')}</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {changes.map((change, index) => (
          <TableRow
            key={`${change.targetPath}:${change.field}:${index}`}
            data-testid={`tag-diff-row-${change.field}`}
          >
            <TableCell component="th" scope="row">{change.field}</TableCell>
            <ValueCell value={change.currentValue} testId={`tag-diff-current-${change.field}`} />
            <ValueCell value={change.proposedValue} testId={`tag-diff-proposed-${change.field}`} />
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
