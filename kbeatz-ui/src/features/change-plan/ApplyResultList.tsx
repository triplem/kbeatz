import { useTranslation } from 'react-i18next'
import { Text } from '@astryxdesign/core/Text'
import { Token } from '@astryxdesign/core/Token'
import type { ApplyChangePlanResult, ReleaseApplyOutcome } from '../../api/generated'

interface ApplyResultListProps {
  /** The aggregate result of applying a change plan. */
  readonly result: ApplyChangePlanResult
}

type TokenColor = 'green' | 'orange' | 'red'

const OUTCOME_COLOR: Record<ReleaseApplyOutcome, TokenColor> = {
  APPLIED: 'green',
  SKIPPED: 'orange',
  FAILED: 'red',
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
    <div data-testid="apply-result" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <p role="status" aria-live="polite" data-testid="apply-result-summary" style={{ margin: 0 }}>
        <Text>
          {t('changePlan.applySummary', {
            applied: result.appliedCount,
            skipped: result.skippedCount,
            failed: result.failedCount,
          })}
        </Text>
      </p>

      <ul
        aria-label={t('changePlan.applyResultsLabel')}
        data-testid="apply-result-releases"
        style={{ margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}
      >
        {result.releases.map((release) => (
          <li
            key={release.albumId}
            data-testid={`apply-result-row-${release.albumId}`}
            style={{ listStyle: 'none', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}
          >
            <Token
              label={t(`changePlan.outcome.${release.outcome}`)}
              color={OUTCOME_COLOR[release.outcome]}
              size="sm"
              data-testid={`apply-outcome-${release.albumId}`}
            />
            <Text type="supporting" weight="semibold">
              {release.albumId}
            </Text>
            {release.message !== null && release.message !== undefined && release.message !== '' && (
              <Text type="supporting">{release.message}</Text>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
