import { type ReactElement, useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Container from '@mui/material/Container'
import Divider from '@mui/material/Divider'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { SortPreference } from '../albums/sort-preference'
import {
  loadSortDirection,
  loadSortPreference,
  saveSortDirection,
  saveSortPreference,
  type SortDirection,
  type SortField,
} from '../albums/album-filters'
import { LanguageToggle } from '../language/language-toggle'
import { ThemeToggle } from '../../theme'

// No props; declared for project consistency with react-patterns explicit typing.
export type SettingsPageProps = Record<string, never>

interface SettingRowProps {
  readonly label: string
  readonly description: string
  readonly control: ReactElement
}

function SettingRow({ label, description, control }: SettingRowProps): ReactElement {
  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      spacing={2}
      sx={{ alignItems: { sm: 'center' }, justifyContent: 'space-between', py: 1 }}
    >
      <div>
        <Typography component="h2" variant="subtitle1" sx={{ fontWeight: 600 }}>
          {label}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {description}
        </Typography>
      </div>
      {control}
    </Stack>
  )
}

/**
 * Settings page.
 *
 * Consolidates the three user preferences required by AC5:
 * - default album sort preference (field + direction)
 * - interface language
 * - colour theme (light/dark)
 *
 * Each control reuses the existing feature component. Sort preference is
 * persisted to localStorage here (same helpers the album list uses) so the
 * chosen default applies to the next album-list visit.
 */
export function SettingsPage(): ReactElement {
  const { t } = useTranslation()

  const [sortBy, setSortBy] = useState<SortField>(() => loadSortPreference())
  const [sortDirection, setSortDirection] = useState<SortDirection>(() => loadSortDirection())

  const handleSortChange = useCallback((next: SortField) => {
    setSortBy(next)
    saveSortPreference(next)
  }, [])

  const handleDirectionChange = useCallback((next: SortDirection) => {
    setSortDirection(next)
    saveSortDirection(next)
  }, [])

  return (
    <Container maxWidth="md" sx={{ py: 3 }} data-testid="settings-page">
      <Typography variant="h1" sx={{ fontSize: '1.5rem', fontWeight: 600, mb: 3 }}>
        {t('settings.heading')}
      </Typography>
      <Stack divider={<Divider flexItem />} spacing={1}>
        <SettingRow
          label={t('settings.sortLabel')}
          description={t('settings.sortDescription')}
          control={
            <SortPreference
              value={sortBy}
              onChange={handleSortChange}
              direction={sortDirection}
              onDirectionChange={handleDirectionChange}
            />
          }
        />
        <SettingRow
          label={t('settings.languageLabel')}
          description={t('settings.languageDescription')}
          control={<LanguageToggle />}
        />
        <SettingRow
          label={t('settings.themeLabel')}
          description={t('settings.themeDescription')}
          control={<ThemeToggle />}
        />
      </Stack>
    </Container>
  )
}
