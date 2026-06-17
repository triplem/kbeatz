import { type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import Box from '@mui/material/Box'
import Container from '@mui/material/Container'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
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
    <Container maxWidth="md" sx={{ py: 3 }}>
      <Typography variant="h1" sx={{ fontSize: '1.5rem', fontWeight: 600, mb: 2 }}>
        {t('library.heading')}
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        {t('library.description')}
      </Typography>
      <Stack spacing={2} sx={{ alignItems: 'flex-start' }}>
        <Box>
          <ScanButton />
        </Box>
      </Stack>
    </Container>
  )
}
