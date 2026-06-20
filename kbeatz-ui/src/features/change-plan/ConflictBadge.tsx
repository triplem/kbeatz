import { useTranslation } from 'react-i18next'
import Chip from '@mui/material/Chip'
import type { PlanConflict } from '../../api/generated'

interface ConflictBadgeProps {
  /** The conflict to render as a badge. */
  readonly conflict: PlanConflict
}

/**
 * ConflictBadge - a single conflict rendered as a small error chip with its
 * human-readable message. Conflicts cause a release to be skipped on apply.
 *
 * The conflict type is surfaced via a localized label; the message text comes
 * from the server and is shown as the chip's accessible title.
 */
export function ConflictBadge({ conflict }: ConflictBadgeProps) {
  const { t } = useTranslation()
  const typeLabel = t(`changePlan.conflictType.${conflict.type}`, {
    defaultValue: conflict.type,
  })

  return (
    <Chip
      label={`${typeLabel}: ${conflict.message}`}
      color="error"
      size="small"
      variant="outlined"
      data-testid={`conflict-badge-${conflict.type}`}
      title={conflict.message}
      sx={{ maxWidth: '100%', height: 'auto', '& .MuiChip-label': { whiteSpace: 'normal', py: 0.5 } }}
    />
  )
}
