import { type ReactElement, useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Outlet } from 'react-router-dom'
import Box from '@mui/material/Box'
import Link from '@mui/material/Link'
import Toolbar from '@mui/material/Toolbar'
import { AppTopBar } from './app-bar'
import { NavDrawer } from './nav-drawer'
import { ScanProgress } from '../features/library/scan-progress'

const DRAWER_WIDTH = 240
const MOBILE_DRAWER_ID = 'app-mobile-drawer'
const MAIN_CONTENT_ID = 'main-content'

/**
 * Top-level application shell: fixed App Bar + mobile navigation Drawer +
 * routed content region. This component owns ONLY layout and the
 * mobile-drawer open/closed state - no business logic lives here. Routed
 * pages render through <Outlet />.
 *
 * Responsive behaviour:
 * - Desktop (md+): no permanent sidebar; main content spans full viewport
 *   width; primary nav links are in the AppBar.
 * - Mobile (xs/sm): hamburger button in AppBar toggles a temporary overlay
 *   drawer (handled inside NavDrawer).
 */
export function AppShell(): ReactElement {
  const { t } = useTranslation()
  const [mobileOpen, setMobileOpen] = useState(false)

  const handleDrawerToggle = useCallback(() => {
    setMobileOpen((open) => !open)
  }, [])

  const handleDrawerClose = useCallback(() => {
    setMobileOpen(false)
  }, [])

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      {/*
        Skip link (WCAG 2.4.1 Bypass Blocks). Visually hidden until focused, it
        lets keyboard users jump past the App Bar and navigation drawer straight
        to the routed content region.
      */}
      <Link
        href={`#${MAIN_CONTENT_ID}`}
        data-testid="skip-to-content"
        sx={{
          position: 'absolute',
          left: 8,
          top: 8,
          zIndex: (theme) => theme.zIndex.tooltip + 1,
          px: 2,
          py: 1,
          borderRadius: 1,
          bgcolor: 'background.paper',
          color: 'primary.main',
          boxShadow: 3,
          // Hidden off-screen until it receives keyboard focus.
          transform: 'translateY(-200%)',
          '&:focus, &:focus-visible': {
            transform: 'translateY(0)',
          },
        }}
      >
        {t('app.skipToContent')}
      </Link>
      <AppTopBar
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
        id={MAIN_CONTENT_ID}
        tabIndex={-1}
        sx={{
          flexGrow: 1,
          minWidth: 0,
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
