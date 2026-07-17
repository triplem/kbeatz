import { useTranslation } from 'react-i18next'
import { Heading } from '@astryxdesign/core/Heading'
import { Text } from '@astryxdesign/core/Text'
import { Token } from '@astryxdesign/core/Token'
import type { ReleaseChangeSet } from '../../api/generated'
import { ConflictBadge } from './ConflictBadge'
import { MoveDiff } from './MoveDiff'
import { TagDiff } from './TagDiff'

interface ReleaseRowProps {
  /** The change set for a single release. */
  readonly release: ReleaseChangeSet
}

/**
 * ReleaseRow - the full planned change set for one release: its directory move,
 * its tag diff, and any conflicts. A release with conflicts is marked as
 * "will be skipped" because the apply step leaves conflicted releases untouched.
 *
 * Rendered as a list item so a plan is a semantic list of releases.
 */
export function ReleaseRow({ release }: ReleaseRowProps) {
  const { t } = useTranslation()
  const willSkip = release.hasConflicts
  const hasTagChanges = release.tagChanges.length > 0

  return (
    <li
      data-testid={`release-row-${release.albumId}`}
      style={{
        listStyle: 'none',
        border: `1px solid ${willSkip ? 'var(--color-error, #d6336c)' : 'var(--color-border)'}`,
        borderRadius: 'var(--radius-element, 8px)',
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <Heading level={4}>{t('changePlan.releaseHeading', { albumId: release.albumId })}</Heading>
        {willSkip && (
          <Token
            label={t('changePlan.willBeSkipped')}
            color="orange"
            size="sm"
            data-testid={`release-skip-${release.albumId}`}
          />
        )}
      </div>

      <MoveDiff move={release.directoryMove} />

      {hasTagChanges ? (
        <TagDiff changes={release.tagChanges} />
      ) : (
        <p data-testid={`release-no-tag-changes-${release.albumId}`} style={{ margin: 0 }}>
          <Text type="supporting">{t('changePlan.noTagChanges')}</Text>
        </p>
      )}

      {release.conflicts.length > 0 && (
        <ul
          data-testid={`release-conflicts-${release.albumId}`}
          style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4 }}
        >
          {release.conflicts.map((conflict, index) => (
            <li key={`${conflict.type}:${index}`}>
              <ConflictBadge conflict={conflict} />
            </li>
          ))}
        </ul>
      )}
    </li>
  )
}
