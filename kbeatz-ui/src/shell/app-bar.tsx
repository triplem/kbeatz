import { type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation } from 'react-router-dom'
import { TopNav, TopNavItem } from '@astryxdesign/core/TopNav'
import { MobileNavToggle } from '@astryxdesign/core/MobileNav'
import { HStack } from '@astryxdesign/core/HStack'
import { Link } from '@astryxdesign/core/Link'
import logoFull from '../assets/kbeatz-logo-transparent.svg'
import logoFullDark from '../assets/kbeatz-logo-dark.svg'
import { LanguageToggle } from '../features/language/language-toggle'
import { ThemeToggle, useColorScheme } from '../theme'
import { isPathActive, NAV_ITEMS } from './nav-items'

/**
 * Top application bar (Astryx TopNav).
 *
 * Hosts the brand logo (links home), the hamburger MobileNavToggle (xs/sm only,
 * auto-hidden above the mobile breakpoint and opening the AppShell mobile-nav
 * drawer via context), desktop nav links (md+, hidden below the mobile
 * breakpoint), and the global controls (theme + language toggles).
 *
 * The logo variant (light vs dark) follows the active color scheme so it
 * switches immediately when the user toggles the theme, rather than tracking
 * only the OS preference.
 */
export function AppTopNav(): ReactElement {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  const { colorScheme } = useColorScheme()

  return (
    <TopNav
      label={t('nav.primaryLabel')}
      heading={
        <Link href="/" label={t('app.title')}>
          <img
            src={colorScheme === 'dark' ? logoFullDark : logoFull}
            alt=""
            height={32}
            style={{ display: 'block', width: 'auto' }}
          />
        </Link>
      }
      startContent={
        <>
          <MobileNavToggle label={t('nav.openMenu')} />
          {/* Desktop-only inline links; the drawer handles xs/sm. */}
          <div className="kbeatz-desktop-only">
            <HStack gap={0.5} align="center">
              {NAV_ITEMS.map((item) => (
                <TopNavItem
                  key={item.to}
                  label={t(item.labelKey)}
                  href={item.to}
                  isSelected={isPathActive(pathname, item.to, item.end)}
                />
              ))}
            </HStack>
          </div>
        </>
      }
      endContent={
        <HStack gap={0.5} align="center">
          <ThemeToggle />
          <LanguageToggle />
        </HStack>
      }
    />
  )
}
