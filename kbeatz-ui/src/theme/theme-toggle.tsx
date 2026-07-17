import { useTranslation } from 'react-i18next'
import { IconButton } from '@astryxdesign/core/IconButton'
import { Icon } from '@astryxdesign/core/Icon'
import { Moon, Sun } from 'lucide-react'
import { useColorScheme } from './app-theme-provider'

/**
 * App-bar control to toggle light/dark. Uses an accessible label (not a
 * placeholder) describing the action that will happen on click.
 *
 * Drives the shared color-scheme context (AppThemeProvider), which updates both
 * the Astryx `<Theme mode>` and the <html> attribute so the result is always a
 * deterministic explicit choice.
 */
export function ThemeToggle() {
  const { t } = useTranslation()
  const { colorScheme, toggle } = useColorScheme()

  const isDark = colorScheme === 'dark'
  const label = isDark ? t('themeToggle.toLight') : t('themeToggle.toDark')

  return (
    <IconButton
      variant="ghost"
      label={label}
      tooltip={label}
      onClick={toggle}
      icon={<Icon icon={isDark ? Sun : Moon} />}
    />
  )
}
