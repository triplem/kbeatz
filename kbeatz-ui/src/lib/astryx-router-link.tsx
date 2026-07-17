import { forwardRef, type AnchorHTMLAttributes } from 'react'
import { Link as RouterLink } from 'react-router-dom'

type AstryxRouterLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  /** Astryx passes the destination as `href`; react-router expects `to`. */
  readonly href?: string
}

/**
 * Adapts Astryx's link contract (href + className + style + children) to
 * react-router's client-side `<Link to>`. Wire it once via `<LinkProvider
 * component={AstryxRouterLink}>` so every Astryx link (Link, TopNavItem,
 * SideNavItem, ...) navigates without a full page reload.
 */
export const AstryxRouterLink = forwardRef<HTMLAnchorElement, AstryxRouterLinkProps>(
  function AstryxRouterLink({ href, ...rest }, ref) {
    return <RouterLink ref={ref} to={href ?? '#'} {...rest} />
  },
)
