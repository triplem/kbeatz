import { useTranslation } from 'react-i18next'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import type { ChangePlan } from '../../api/generated'
import { ReleaseRow } from './ReleaseRow'

interface ChangePlanReviewProps {
  /** The dry-run plan to review. */
  readonly plan: ChangePlan
}

/**
 * ChangePlanReview - presentational review of a consolidated dry-run change plan.
 *
 * Shows consolidated totals (moves, tag changes, conflicts) and, per release,
 * the directory move, the tag diff, and any conflicts. A release with conflicts
 * is flagged as "will be skipped" on apply. An empty plan (no moves and no tag
 * changes across all releases) renders a "no changes needed" message.
 *
 * Composition over flags: totals and each release are focused subcomponents
 * (ReleaseRow -> MoveDiff / TagDiff / ConflictBadge).
 *
 * Accessibility:
 * - The release set is a semantic list (<ul> of <li>).
 * - Conflicts are surfaced as an assertive alert summary plus per-release badges.
 */
export function ChangePlanReview({ plan }: ChangePlanReviewProps) {
  const { t } = useTranslation()

  const isEmpty =
    plan.totalMoves === 0 && plan.totalTagChanges === 0 && plan.releases.length === 0

  if (isEmpty) {
    return (
      <Typography
        component="p"
        color="text.secondary"
        data-testid="change-plan-empty"
        sx={{ m: 0 }}
      >
        {t('changePlan.noChangesNeeded')}
      </Typography>
    )
  }

  const hasNoChanges = plan.totalMoves === 0 && plan.totalTagChanges === 0

  return (
    <Box data-testid="change-plan-review" sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Stack
        direction="row"
        spacing={2}
        data-testid="change-plan-totals"
        sx={{ flexWrap: 'wrap' }}
      >
        <Typography variant="body2" component="p" sx={{ m: 0 }} data-testid="total-moves">
          {t('changePlan.totalMoves', { count: plan.totalMoves })}
        </Typography>
        <Typography variant="body2" component="p" sx={{ m: 0 }} data-testid="total-tag-changes">
          {t('changePlan.totalTagChanges', { count: plan.totalTagChanges })}
        </Typography>
        <Typography
          variant="body2"
          component="p"
          sx={{ m: 0, color: plan.totalConflicts > 0 ? 'error.main' : 'text.primary' }}
          data-testid="total-conflicts"
        >
          {t('changePlan.totalConflicts', { count: plan.totalConflicts })}
        </Typography>
      </Stack>

      {plan.hasConflicts && (
        <Alert severity="warning" role="alert" data-testid="change-plan-conflict-warning">
          {t('changePlan.conflictWarning')}
        </Alert>
      )}

      {hasNoChanges && (
        <Typography
          component="p"
          color="text.secondary"
          data-testid="change-plan-no-changes"
          sx={{ m: 0 }}
        >
          {t('changePlan.noChangesNeeded')}
        </Typography>
      )}

      <Box
        component="ul"
        aria-label={t('changePlan.releasesLabel')}
        data-testid="change-plan-releases"
        sx={{ m: 0, p: 0, display: 'flex', flexDirection: 'column', gap: 2 }}
      >
        {plan.releases.map((release) => (
          <ReleaseRow key={release.albumId} release={release} />
        ))}
      </Box>
    </Box>
  )
}
