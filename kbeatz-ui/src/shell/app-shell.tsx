import { type ReactElement } from 'react'
import { Outlet } from 'react-router-dom'
import { AppShell as AstryxAppShell } from '@astryxdesign/core/AppShell'
import { AppTopNav } from './app-bar'
import { AppMobileNav } from './nav-drawer'
import { ScanProgress } from '../features/library/scan-progress'

/**
 * Top-level application shell: Astryx AppShell provides the fixed top
 * navigation, the responsive mobile-nav drawer, the skip-to-content link, and
 * the routed `<main>` region automatically. This component only wires the
 * navigation slots and renders the routed content through <Outlet />; no
 * business logic lives here.
 *
 * `height="auto"` keeps the page on the window scroll (grows with content,
 * sticky nav) rather than AppShell's default independent scroll containers, so
 * the existing window-based scroll restoration (useScrollRestoration) keeps
 * working. `contentPadding={0}` because each page manages its own padding.
 */
export function AppShell(): ReactElement {
  return (
    <AstryxAppShell
      height="auto"
      contentPadding={0}
      topNav={<AppTopNav />}
      mobileNav={<AppMobileNav />}
    >
      <ScanProgress />
      <Outlet />
    </AstryxAppShell>
  )
}
