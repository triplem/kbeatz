import { useTranslation } from 'react-i18next'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import type { ApplyChangePlanResult, ReleaseApplyOutcome } from '../../api/generated'

interface ApplyResultListProps {
  /** The aggregate result of applying a change plan. */
  readonly result: ApplyChangePlanResult
}

const OUTCOME_COLOR: Record<ReleaseApplyOutcome, 'success' | 'warning' | 'error'> = {
  APPLIED: 'success',
  SKIPPED: 'warning',
  FAILED: 'error',
}

/**
 * ApplyResultList - per-release outcomes after a plan was applied, plus the
 * consolidated applied / skipped / failed counts.
 *
 * Rendered as a semantic list so the outcomes read as a single set.
 */
export function ApplyResultList({ result }: ApplyResultListProps) {
  const { t } = useTranslation()

  return (
    <Box data-testid="apply-result" sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Typography
        component="p"
        role="status"
        aria-live="polite"
        data-testid="apply-result-summary"
        sx={{ m: 0 }}
      >
        {t('changePlan.applySummary', {
          applied: result.appliedCount,
          skipped: result.skippedCount,
          failed: result.failedCount,
        })}
      </Typography>

      <Box
        component="ul"
        aria-label={t('changePlan.applyResultsLabel')}
        data-testid="apply-result-releases"
        sx={{ m: 0, p: 0, display: 'flex', flexDirection: 'column', gap: 1 }}
      >
        {result.releases.map((release) => (
          <Stack
            component="li"
            key={release.albumId}
            direction="row"
            spacing={1}
            data-testid={`apply-result-row-${release.albumId}`}
            sx={{ listStyle: 'none', alignItems: 'center', flexWrap: 'wrap' }}
          >
            <Chip
              label={t(`changePlan.outcome.${release.outcome}`)}
              color={OUTCOME_COLOR[release.outcome]}
              size="small"
              data-testid={`apply-outcome-${release.albumId}`}
            />
            <Typography variant="body2" component="span" sx={{ wordBreak: 'break-all' }}>
              {release.albumId}
            </Typography>
            {release.message !== null && release.message !== undefined && release.message !== '' && (
              <Typography variant="body2" color="text.secondary" component="span">
                {release.message}
              </Typography>
            )}
          </Stack>
        ))}
      </Box>
    </Box>
  )
}
