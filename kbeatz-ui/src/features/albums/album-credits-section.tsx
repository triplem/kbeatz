import { useTranslation } from 'react-i18next'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'

interface AlbumCreditsSectionProps {
  readonly composer?: string | null
  readonly conductor?: string | null
  readonly ensemble?: string | null
}

interface CreditRowProps {
  readonly label: string
  readonly value?: string | null
}

/**
 * Renders a single credit label-value row.
 * Returns null when value is absent (null, undefined, or empty string).
 */
function CreditRow({ label, value }: CreditRowProps) {
  if (value === undefined || value === null || value === '') return null
  return (
    <Box
      sx={{ display: 'flex', gap: 1, alignItems: 'baseline' }}
      data-testid={`credit-row-${label.toLowerCase()}`}
    >
      <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500, flexShrink: 0 }}>
        {label}:
      </Typography>
      <Typography variant="body2">{value}</Typography>
    </Box>
  )
}

/**
 * AlbumCreditsSection - album-level composer, conductor, and ensemble credits.
 *
 * - Renders nothing when all three values are absent.
 * - Individual rows are omitted when their value is absent.
 * - The section is an accessible landmark (`<section>`) with an h2 heading
 *   and an aria-labelledby that ties the heading to the section.
 */
export function AlbumCreditsSection({ composer, conductor, ensemble }: AlbumCreditsSectionProps) {
  const { t } = useTranslation()

  const hasCredits =
    (composer !== undefined && composer !== null && composer !== '') ||
    (conductor !== undefined && conductor !== null && conductor !== '') ||
    (ensemble !== undefined && ensemble !== null && ensemble !== '')

  if (!hasCredits) return null

  return (
    <Box
      component="section"
      aria-labelledby="album-credits-heading"
      aria-label={t('albumDetail.creditsSection')}
      data-testid="album-credits-section"
    >
      <Typography id="album-credits-heading" variant="h6" component="h2" sx={{ mb: 1 }}>
        {t('albumDetail.creditsTitle')}
      </Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        <CreditRow label={t('albumDetail.fields.composer')} value={composer} />
        <CreditRow label={t('albumDetail.fields.conductor')} value={conductor} />
        <CreditRow label={t('albumDetail.fields.ensemble')} value={ensemble} />
      </Box>
    </Box>
  )
}
