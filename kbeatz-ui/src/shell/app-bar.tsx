import { type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import { Link as RouterLink } from 'react-router-dom'
import MuiAppBar from '@mui/material/AppBar'
import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import Toolbar from '@mui/material/Toolbar'
import MenuIcon from '@mui/icons-material/Menu'
import logoFull from '../assets/kbeatz-logo-transparent.svg'
import logoFullDark from '../assets/kbeatz-logo-dark.svg'
import { LanguageToggle } from '../features/language/language-toggle'
import { ThemeToggle } from '../theme'

export interface AppTopBarProps {
  /** Drawer width in px; the bar leaves room for the permanent drawer at md+. */
  readonly drawerWidth: number
  /** Opens the temporary (mobile) drawer. */
  readonly onMenuClick: () => void
  /** Current open state of the temporary drawer (drives aria-expanded). */
  readonly mobileOpen: boolean
  /** DOM id of the temporary drawer, referenced by aria-controls. */
  readonly drawerId: string
}

/**
 * Top application bar.
 *
 * Hosts the hamburger menu (xs/sm only - it toggles the temporary drawer),
 * the brand logo (links home), and the discoverable global controls
 * (theme toggle + language). At md+ the bar is offset to sit beside the
 * permanent drawer.
 */
export function AppTopBar({
  drawerWidth,
  onMenuClick,
  mobileOpen,
  drawerId,
}: AppTopBarProps): ReactElement {
  const { t } = useTranslation()

  return (
    <MuiAppBar
      position="fixed"
      color="default"
      enableColorOnDark
      sx={{
        width: { md: `calc(100% - ${drawerWidth}px)` },
        ml: { md: `${drawerWidth}px` },
        zIndex: (theme) => theme.zIndex.drawer + 1,
      }}
    >
      <Toolbar>
        <IconButton
          color="inherit"
          aria-label={t('nav.openMenu')}
          aria-expanded={mobileOpen}
          aria-controls={drawerId}
          edge="start"
          size="large"
          onClick={onMenuClick}
          sx={{ mr: 2, display: { md: 'none' } }}
        >
          <MenuIcon />
        </IconButton>
        <Box
          component={RouterLink}
          to="/"
          aria-label={t('app.title')}
          sx={{ display: 'flex', alignItems: 'center', mr: 'auto', textDecoration: 'none' }}
        >
          <picture>
            <source srcSet={logoFullDark} media="(prefers-color-scheme: dark)" />
            <Box component="img" src={logoFull} alt="" sx={{ height: 32, width: 'auto', display: 'block' }} />
          </picture>
        </Box>
        <ThemeToggle />
        <LanguageToggle />
      </Toolbar>
    </MuiAppBar>
  )
}
