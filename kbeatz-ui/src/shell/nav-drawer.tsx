import { type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import { NavLink } from 'react-router-dom'
import Box from '@mui/material/Box'
import Drawer from '@mui/material/Drawer'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import Toolbar from '@mui/material/Toolbar'
import LibraryMusicIcon from '@mui/icons-material/LibraryMusic'
import StorageIcon from '@mui/icons-material/Storage'
import SettingsIcon from '@mui/icons-material/Settings'
import { NAV_ITEMS, type NavItem } from './nav-items'

const ICONS: Record<NavItem['icon'], ReactElement> = {
  albums: <LibraryMusicIcon />,
  library: <StorageIcon />,
  settings: <SettingsIcon />,
}

export interface NavDrawerProps {
  /** Drawer width in pixels for the temporary overlay paper. */
  readonly width: number
  /** True when the temporary (mobile overlay) drawer is open. */
  readonly mobileOpen: boolean
  /** Close handler for the temporary drawer (backdrop click, link tap, Escape). */
  readonly onClose: () => void
  /** DOM id for the temporary drawer paper, referenced by the menu button's aria-controls. */
  readonly mobileDrawerId: string
}

interface NavListProps {
  readonly onNavigate: () => void
}

function NavList({ onNavigate }: NavListProps): ReactElement {
  const { t } = useTranslation()
  // Render as a real <ul> (List's default element) so the ListItem <li>s have a
  // valid list parent (WCAG 1.3.1). The navigation landmark + accessible name
  // are provided by the wrapping <Box component="nav"> in NavDrawer, so this
  // list must not also claim role="nav".
  return (
    <List>
      {NAV_ITEMS.map((item) => (
        <ListItem key={item.to} disablePadding>
          <ListItemButton
            component={NavLink}
            to={item.to}
            end={item.end}
            onClick={onNavigate}
            sx={{
              minHeight: 48,
              '&.active': {
                bgcolor: 'action.selected',
                fontWeight: 600,
              },
            }}
          >
            <ListItemIcon>{ICONS[item.icon]}</ListItemIcon>
            <ListItemText primary={t(item.labelKey)} />
          </ListItemButton>
        </ListItem>
      ))}
    </List>
  )
}

/**
 * Mobile navigation drawer (temporary overlay only).
 *
 * Renders a single MUI `temporary` Drawer variant - a modal overlay with
 * backdrop and focus trap at xs/sm breakpoints. On desktop (md+) navigation
 * is handled by AppBar links; this drawer is hidden via CSS.
 *
 * MUI's `temporary` Drawer provides the WCAG-required focus trap, Escape to
 * close, and backdrop dismissal out of the box.
 */
export function NavDrawer({
  width,
  mobileOpen,
  onClose,
  mobileDrawerId,
}: NavDrawerProps): ReactElement {
  const { t } = useTranslation()

  return (
    <Box
      component="nav"
      aria-label={t('nav.primaryLabel')}
    >
      <Drawer
        id={mobileDrawerId}
        variant="temporary"
        open={mobileOpen}
        onClose={onClose}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': { boxSizing: 'border-box', width },
        }}
      >
        <Toolbar />
        <NavList onNavigate={onClose} />
      </Drawer>
    </Box>
  )
}
