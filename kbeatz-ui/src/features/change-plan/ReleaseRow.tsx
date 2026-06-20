import { useTranslation } from 'react-i18next'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
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
    <Box
      component="li"
      data-testid={`release-row-${release.albumId}`}
      sx={{
        listStyle: 'none',
        border: 1,
        borderColor: willSkip ? 'error.main' : 'divider',
        borderRadius: 1,
        p: 2,
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
      }}
    >
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
        <Typography variant="subtitle2" component="h4" sx={{ m: 0 }}>
          {t('changePlan.releaseHeading', { albumId: release.albumId })}
        </Typography>
        {willSkip && (
          <Chip
            label={t('changePlan.willBeSkipped')}
            color="warning"
            size="small"
            data-testid={`release-skip-${release.albumId}`}
          />
        )}
      </Stack>

      <MoveDiff move={release.directoryMove} />

      {hasTagChanges ? (
        <TagDiff changes={release.tagChanges} />
      ) : (
        <Typography
          variant="body2"
          color="text.secondary"
          component="p"
          data-testid={`release-no-tag-changes-${release.albumId}`}
          sx={{ m: 0 }}
        >
          {t('changePlan.noTagChanges')}
        </Typography>
      )}

      {release.conflicts.length > 0 && (
        <Stack
          component="ul"
          spacing={0.5}
          data-testid={`release-conflicts-${release.albumId}`}
          sx={{ m: 0, p: 0, listStyle: 'none' }}
        >
          {release.conflicts.map((conflict, index) => (
            <Box component="li" key={`${conflict.type}:${index}`}>
              <ConflictBadge conflict={conflict} />
            </Box>
          ))}
        </Stack>
      )}
    </Box>
  )
}
