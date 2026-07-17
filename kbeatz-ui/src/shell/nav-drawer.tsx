import { type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation } from 'react-router-dom'
import { MobileNav } from '@astryxdesign/core/MobileNav'
import { SideNavItem } from '@astryxdesign/core/SideNav'
import { isPathActive, NAV_ITEMS } from './nav-items'

/**
 * Mobile navigation drawer (Astryx MobileNav).
 *
 * Rendered in AppShell's `mobileNav` slot, it opens/closes from the
 * MobileNavToggle in the top bar via AppShell context - no local open state.
 * MobileNav provides the WCAG-required focus trap, Escape to close, and
 * backdrop dismissal. On desktop it is hidden and navigation is handled by the
 * inline TopNav links.
 */
export function AppMobileNav(): ReactElement {
  const { t } = useTranslation()
  const { pathname } = useLocation()

  return (
    <MobileNav header={t('app.title')}>
      {NAV_ITEMS.map((item) => (
        <SideNavItem
          key={item.to}
          label={t(item.labelKey)}
          href={item.to}
          isSelected={isPathActive(pathname, item.to, item.end)}
        />
      ))}
    </MobileNav>
  )
}
