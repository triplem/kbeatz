/**
 * Single source of truth for the primary navigation destinations.
 *
 * `labelKey` is an i18n key resolved at render time so the drawer stays
 * localised. `end` marks routes that must match exactly (the index route),
 * matching react-router's NavLink `end` semantics.
 */
export interface NavItem {
  readonly to: string
  readonly labelKey: string
  readonly icon: 'albums' | 'library' | 'settings'
  readonly end: boolean
}

export const NAV_ITEMS: readonly NavItem[] = [
  { to: '/', labelKey: 'nav.albums', icon: 'albums', end: true },
  { to: '/library', labelKey: 'nav.library', icon: 'library', end: false },
  { to: '/settings', labelKey: 'nav.settings', icon: 'settings', end: false },
]

/**
 * Whether a nav item matches the current pathname. `end` items (the index
 * route) must match exactly; others also match nested descendant paths,
 * mirroring react-router's NavLink `end` semantics.
 */
export function isPathActive(pathname: string, to: string, end: boolean): boolean {
  if (end) {
    return pathname === to
  }
  return pathname === to || pathname.startsWith(`${to}/`)
}
