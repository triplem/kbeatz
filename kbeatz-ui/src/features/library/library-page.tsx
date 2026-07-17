import { type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import { PageSection } from '../../components'
import { ScanButton } from './scan-button'

// No props; declared for project consistency with react-patterns explicit typing.
export type LibraryPageProps = Record<string, never>

/**
 * Library management page.
 *
 * Consolidates the library scan trigger. Live scan progress is rendered
 * globally by the shell (ScanProgress banner) so it remains visible while the
 * user browses other routes; this page provides the explicit entry point to
 * start a scan.
 */
export function LibraryPage(): ReactElement {
  const { t } = useTranslation()

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: 24 }}>
      <PageSection
        title={t('library.heading')}
        description={t('library.description')}
        headingLevel="h1"
        testId="library-page"
      >
        <ScanButton />
      </PageSection>
    </div>
  )
}
