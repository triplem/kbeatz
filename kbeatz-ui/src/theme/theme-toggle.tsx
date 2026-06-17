import { useColorScheme } from '@mui/material/styles'
import { useTranslation } from 'react-i18next'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import DarkModeIcon from '@mui/icons-material/DarkMode'
import LightModeIcon from '@mui/icons-material/LightMode'

/**
 * App-bar control to toggle light/dark. Uses an accessible label (not a
 * placeholder) describing the action that will happen on click.
 *
 * Uses MUI's built-in `useColorScheme` so the toggle drives the same CSS
 * variable context that `ThemeProvider` injects. Clicking sets the mode to
 * the opposite of the current resolved `colorScheme` (not `mode`, which could
 * be 'system') so the result is always a deterministic explicit choice.
 */
export function ThemeToggle() {
  const { t } = useTranslation()
  const { colorScheme, setMode } = useColorScheme()

  const isDark = colorScheme === 'dark'
  const label = isDark ? t('themeToggle.toLight') : t('themeToggle.toDark')

  return (
    <Tooltip title={label}>
      <IconButton
        onClick={() => {
          // eslint-disable-next-line i18next/no-literal-string -- 'light'/'dark' are MUI API mode values, not UI strings
          setMode(isDark ? 'light' : 'dark')
        }}
        aria-label={label}
        color="inherit"
        size="large"
      >
        {isDark ? <LightModeIcon /> : <DarkModeIcon />}
      </IconButton>
    </Tooltip>
  )
}
