import { type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import { Link as RouterLink, NavLink } from 'react-router-dom'
import { useColorScheme } from '@mui/material/styles'
import MuiAppBar from '@mui/material/AppBar'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Toolbar from '@mui/material/Toolbar'
import MenuIcon from '@mui/icons-material/Menu'
import logoFull from '../assets/kbeatz-logo-transparent.svg'
import logoFullDark from '../assets/kbeatz-logo-dark.svg'
import { LanguageToggle } from '../features/language/language-toggle'
import { ThemeToggle } from '../theme'
import { NAV_ITEMS } from './nav-items'

export interface AppTopBarProps {
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
 * Hosts the brand logo (links home), the hamburger menu (xs/sm only,
 * toggles the temporary drawer), desktop nav links (md+, between logo and
 * right-hand controls), and the discoverable global controls (theme toggle
 * + language).
 *
 * The logo variant (light vs dark) follows the active MUI colour scheme so
 * it switches immediately when the user toggles the theme, rather than
 * relying on `prefers-color-scheme` which only tracks the OS preference.
 *
 * At md+ the bar spans the full viewport width (no permanent drawer offset).
 * Desktop nav links are wrapped in a `<nav>` landmark so keyboard users can
 * navigate directly to the primary navigation region (WCAG 2.4.1).
 */
export function AppTopBar({ onMenuClick, mobileOpen, drawerId }: AppTopBarProps): ReactElement {
  const { t } = useTranslation()
  const { colorScheme } = useColorScheme()

  return (
    <MuiAppBar
      position="fixed"
      color="inherit"
      elevation={0}
      sx={{
        bgcolor: 'background.paper',
        borderBottom: 1,
        borderColor: 'divider',
        zIndex: (theme) => theme.zIndex.drawer + 1,
      }}
    >
      <Toolbar>
        <Box
          component={RouterLink}
          to="/"
          aria-label={t('app.title')}
          sx={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}
        >
          <Box
            component="img"
            src={colorScheme === 'dark' ? logoFullDark : logoFull}
            alt=""
            sx={{ height: 32, width: 'auto', display: 'block' }}
          />
        </Box>
        <IconButton
          color="inherit"
          aria-label={t('nav.openMenu')}
          aria-expanded={mobileOpen}
          aria-controls={drawerId}
          size="large"
          onClick={onMenuClick}
          sx={{ ml: 1, display: { md: 'none' } }}
        >
          <MenuIcon />
        </IconButton>
        {/* Desktop nav links - visible at md+; hamburger drawer handles xs/sm */}
        <Box
          component="nav"
          aria-label={t('nav.primaryLabel')}
          sx={{ display: { xs: 'none', md: 'flex' }, gap: 1, ml: 2 }}
        >
          {NAV_ITEMS.map((item) => (
            <Button
              key={item.to}
              component={NavLink}
              to={item.to}
              end={item.end}
              color="inherit"
              sx={{
                minHeight: 44,
                minWidth: 44,
                '&.active': {
                  fontWeight: 700,
                  textDecoration: 'underline',
                },
              }}
            >
              {t(item.labelKey)}
            </Button>
          ))}
        </Box>
        <Box sx={{ flexGrow: 1 }} />
        <ThemeToggle />
        <LanguageToggle />
      </Toolbar>
    </MuiAppBar>
  )
}
