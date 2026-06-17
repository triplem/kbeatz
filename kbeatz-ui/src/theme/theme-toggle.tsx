import { useTranslation } from 'react-i18next'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import DarkModeIcon from '@mui/icons-material/DarkMode'
import LightModeIcon from '@mui/icons-material/LightMode'
import { useColorScheme } from './color-scheme-context'

/**
 * App-bar control to toggle light/dark. Uses an accessible label (not a
 * placeholder) describing the action that will happen on click.
 */
export function ThemeToggle() {
  const { t } = useTranslation()
  const { colorScheme, toggleColorScheme } = useColorScheme()

  const isDark = colorScheme === 'dark'
  const label = isDark ? t('themeToggle.toLight') : t('themeToggle.toDark')

  return (
    <Tooltip title={label}>
      <IconButton
        onClick={toggleColorScheme}
        aria-label={label}
        color="inherit"
        size="large"
      >
        {isDark ? <LightModeIcon /> : <DarkModeIcon />}
      </IconButton>
    </Tooltip>
  )
}
