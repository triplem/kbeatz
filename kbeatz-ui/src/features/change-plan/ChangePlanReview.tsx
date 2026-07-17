import { useTranslation } from 'react-i18next'
import { Banner } from '@astryxdesign/core/Banner'
import { Text } from '@astryxdesign/core/Text'
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
 * - Conflicts are surfaced as a warning banner summary plus per-release badges.
 */
export function ChangePlanReview({ plan }: ChangePlanReviewProps) {
  const { t } = useTranslation()

  const isEmpty =
    plan.totalMoves === 0 && plan.totalTagChanges === 0 && plan.releases.length === 0

  if (isEmpty) {
    return (
      <p data-testid="change-plan-empty" style={{ margin: 0 }}>
        <Text type="supporting">{t('changePlan.noChangesNeeded')}</Text>
      </p>
    )
  }

  const hasNoChanges = plan.totalMoves === 0 && plan.totalTagChanges === 0

  return (
    <div data-testid="change-plan-review" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div
        data-testid="change-plan-totals"
        style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}
      >
        <p style={{ margin: 0 }} data-testid="total-moves">
          <Text type="supporting">{t('changePlan.totalMoves', { count: plan.totalMoves })}</Text>
        </p>
        <p style={{ margin: 0 }} data-testid="total-tag-changes">
          <Text type="supporting">
            {t('changePlan.totalTagChanges', { count: plan.totalTagChanges })}
          </Text>
        </p>
        <p
          style={{ margin: 0, color: plan.totalConflicts > 0 ? 'var(--color-error, #d6336c)' : undefined }}
          data-testid="total-conflicts"
        >
          {t('changePlan.totalConflicts', { count: plan.totalConflicts })}
        </p>
      </div>

      {plan.hasConflicts && (
        <div data-testid="change-plan-conflict-warning">
          <Banner status="warning" title={t('changePlan.conflictWarning')} />
        </div>
      )}

      {hasNoChanges && (
        <p data-testid="change-plan-no-changes" style={{ margin: 0 }}>
          <Text type="supporting">{t('changePlan.noChangesNeeded')}</Text>
        </p>
      )}

      <ul
        aria-label={t('changePlan.releasesLabel')}
        data-testid="change-plan-releases"
        style={{ margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 16 }}
      >
        {plan.releases.map((release) => (
          <ReleaseRow key={release.albumId} release={release} />
        ))}
      </ul>
    </div>
  )
}
