import { useTranslation } from 'react-i18next'
import { Heading } from '@astryxdesign/core/Heading'
import { Text } from '@astryxdesign/core/Text'

interface AlbumCreditsSectionProps {
  readonly composer?: string | null
  readonly conductor?: string | null
  readonly ensemble?: string | null
}

interface CreditRowProps {
  /** Stable field key used for data-testid (not locale-dependent). */
  readonly fieldKey: string
  readonly label: string
  readonly value?: string | null
}

/**
 * Renders a single credit label-value row.
 * Returns null when value is absent (null, undefined, or empty string).
 */
function CreditRow({ fieldKey, label, value }: CreditRowProps) {
  if (value === undefined || value === null || value === '') return null
  return (
    <div
      style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}
      data-testid={`credit-row-${fieldKey}`}
    >
      <Text type="supporting" weight="medium">
        {label}:
      </Text>
      <Text type="supporting">{value}</Text>
    </div>
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
    <section
      aria-labelledby="album-credits-heading"
      aria-label={t('albumDetail.creditsSection')}
      data-testid="album-credits-section"
    >
      <div style={{ marginBottom: 8 }}>
        <Heading level={2} id="album-credits-heading">
          {t('albumDetail.creditsTitle')}
        </Heading>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <CreditRow fieldKey="composer" label={t('albumDetail.fields.composer')} value={composer} />
        <CreditRow fieldKey="conductor" label={t('albumDetail.fields.conductor')} value={conductor} />
        <CreditRow fieldKey="ensemble" label={t('albumDetail.fields.ensemble')} value={ensemble} />
      </div>
    </section>
  )
}
