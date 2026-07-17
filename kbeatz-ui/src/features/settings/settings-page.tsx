import { type ReactElement, useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Divider } from '@astryxdesign/core/Divider'
import { Heading } from '@astryxdesign/core/Heading'
import { Text } from '@astryxdesign/core/Text'
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
import { DirectoryLayoutSettings } from './directory-layout-settings'

// No props; declared for project consistency with react-patterns explicit typing.
export type SettingsPageProps = Record<string, never>

interface SettingRowProps {
  readonly label: string
  readonly description: string
  readonly control: ReactElement
}

function SettingRow({ label, description, control }: SettingRowProps): ReactElement {
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        padding: '8px 0',
      }}
    >
      <div>
        <Heading level={2}>{label}</Heading>
        <Text type="supporting">{description}</Text>
      </div>
      {control}
    </div>
  )
}

/**
 * Settings page.
 *
 * Consolidates the user preferences: default album sort (field + direction),
 * interface language, colour theme, and the directory-layout settings. Each
 * control reuses the existing feature component. Sort preference is persisted to
 * localStorage here (same helpers the album list uses).
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
    <div style={{ maxWidth: 900, margin: '0 auto', padding: 24 }} data-testid="settings-page">
      <div style={{ marginBottom: 24 }}>
        <Heading level={1}>{t('settings.heading')}</Heading>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
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
        <Divider />
        <SettingRow
          label={t('settings.languageLabel')}
          description={t('settings.languageDescription')}
          control={<LanguageToggle />}
        />
        <Divider />
        <SettingRow
          label={t('settings.themeLabel')}
          description={t('settings.themeDescription')}
          control={<ThemeToggle />}
        />
        <Divider />
        <DirectoryLayoutSettings />
      </div>
    </div>
  )
}
