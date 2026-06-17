import { type ReactElement, useCallback, useState } from 'react'
import { Outlet } from 'react-router-dom'
import Box from '@mui/material/Box'
import Toolbar from '@mui/material/Toolbar'
import { AppTopBar } from './app-bar'
import { NavDrawer } from './nav-drawer'
import { ScanProgress } from '../features/library/scan-progress'

const DRAWER_WIDTH = 240
const MOBILE_DRAWER_ID = 'app-mobile-drawer'

/**
 * Top-level application shell: fixed App Bar + responsive navigation Drawer +
 * routed content region. This component owns ONLY layout and the
 * mobile-drawer open/closed state - no business logic lives here. Routed
 * pages render through <Outlet />.
 *
 * Responsive behaviour (AC1 / AC8):
 * - Drawer is a temporary overlay at xs/sm, permanent at md+ (handled inside
 *   NavDrawer via MUI `display` breakpoints).
 * - The content region offsets by the drawer width at md+ so there is no
 *   horizontal scroll and content never sits under the permanent drawer.
 */
export function AppShell(): ReactElement {
  const [mobileOpen, setMobileOpen] = useState(false)

  const handleDrawerToggle = useCallback(() => {
    setMobileOpen((open) => !open)
  }, [])

  const handleDrawerClose = useCallback(() => {
    setMobileOpen(false)
  }, [])

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <AppTopBar
        drawerWidth={DRAWER_WIDTH}
        onMenuClick={handleDrawerToggle}
        mobileOpen={mobileOpen}
        drawerId={MOBILE_DRAWER_ID}
      />
      <NavDrawer
        width={DRAWER_WIDTH}
        mobileOpen={mobileOpen}
        onClose={handleDrawerClose}
        mobileDrawerId={MOBILE_DRAWER_ID}
      />
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          minWidth: 0,
          width: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
        }}
      >
        {/* Spacer matching the fixed AppBar height so content is not hidden beneath it. */}
        <Toolbar />
        <ScanProgress />
        <Outlet />
      </Box>
    </Box>
  )
}
