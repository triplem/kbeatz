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
  /** Drawer width in pixels; shared with the AppBar offset so they align. */
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
 * Primary navigation drawer.
 *
 * Renders two MUI Drawer variants behind responsive `display` toggles so the
 * correct one is mounted per breakpoint without JS measurement:
 * - `temporary` (overlay + backdrop + focus trap) is shown at xs/sm.
 * - `permanent` (always-visible side rail) is shown at md and up.
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
      sx={{ width: { md: width }, flexShrink: { md: 0 } }}
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
      <Drawer
        variant="permanent"
        open
        sx={{
          display: { xs: 'none', md: 'block' },
          '& .MuiDrawer-paper': { boxSizing: 'border-box', width },
        }}
      >
        <Toolbar />
        <NavList onNavigate={() => undefined} />
      </Drawer>
    </Box>
  )
}
