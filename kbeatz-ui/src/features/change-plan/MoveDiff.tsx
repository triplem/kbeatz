import { useTranslation } from 'react-i18next'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import type { DirectoryMove } from '../../api/generated'

interface MoveDiffProps {
  /** The planned move, or null/undefined when the directory is already in place. */
  readonly move: DirectoryMove | null | undefined
}

/**
 * MoveDiff - renders a single release's directory relocation as a "from -> to"
 * pair, or an "already in place" note when no move is planned.
 *
 * Merged source directories (when several folders collapse into one target) are
 * listed below the primary source path.
 */
export function MoveDiff({ move }: MoveDiffProps) {
  const { t } = useTranslation()

  if (!move) {
    return (
      <Typography
        variant="body2"
        color="text.secondary"
        component="p"
        data-testid="move-diff-none"
        sx={{ m: 0 }}
      >
        {t('changePlan.alreadyInPlace')}
      </Typography>
    )
  }

  return (
    <Box data-testid="move-diff" sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
      <Typography variant="body2" component="p" sx={{ m: 0, wordBreak: 'break-all' }}>
        <Box component="span" sx={{ color: 'text.secondary' }}>
          {t('changePlan.moveFrom')}:{' '}
        </Box>
        <Box component="span" data-testid="move-from">{move.fromPath}</Box>
      </Typography>
      <Typography variant="body2" component="p" sx={{ m: 0, wordBreak: 'break-all' }}>
        <Box component="span" sx={{ color: 'text.secondary' }}>
          {t('changePlan.moveTo')}:{' '}
        </Box>
        <Box component="span" data-testid="move-to" sx={{ fontWeight: 600 }}>{move.toPath}</Box>
      </Typography>
      {move.mergedFromPaths.length > 0 && (
        <Box component="ul" data-testid="move-merged" sx={{ m: 0, mt: 0.5, pl: 3 }}>
          <Typography
            variant="caption"
            color="text.secondary"
            component="li"
            sx={{ listStyle: 'none', ml: -2 }}
          >
            {t('changePlan.mergedFrom')}:
          </Typography>
          {move.mergedFromPaths.map((path) => (
            <Typography
              key={path}
              variant="caption"
              color="text.secondary"
              component="li"
              sx={{ wordBreak: 'break-all' }}
            >
              {path}
            </Typography>
          ))}
        </Box>
      )}
    </Box>
  )
}
