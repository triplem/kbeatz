import { type ReactNode } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'

interface PageSectionProps {
  /** Section heading text. */
  readonly title: string
  /** Optional supporting description rendered below the heading. */
  readonly description?: string
  /**
   * Heading level for the rendered title element. Defaults to "h2".
   * Use this to keep a correct document outline when nesting sections.
   */
  readonly headingLevel?: 'h1' | 'h2' | 'h3' | 'h4'
  /** MUI Typography variant for the heading. Defaults to "h6". */
  readonly titleVariant?: 'h4' | 'h5' | 'h6' | 'subtitle1'
  /** Accessible label for the wrapping landmark. Falls back to `title`. */
  readonly ariaLabel?: string
  /** Optional test id forwarded to the section element. */
  readonly testId?: string
  /** Section content. */
  readonly children: ReactNode
}

/**
 * PageSection - a labelled content region with a heading and optional description.
 *
 * Renders a semantic `section` landmark (aria-labelled), a heading element at the
 * requested level, an optional description paragraph, and the supplied children.
 * Built on MUI Box/Typography so it is theme-aware in light and dark modes.
 *
 * Accessibility:
 * - The wrapping `section` carries an accessible name (aria-label).
 * - The heading uses a real heading element (h2/h3/h4) for a correct outline.
 */
export function PageSection({
  title,
  description,
  headingLevel = 'h2',
  titleVariant = 'h6',
  ariaLabel,
  testId,
  children,
}: PageSectionProps) {
  return (
    <Box
      component="section"
      aria-label={ariaLabel ?? title}
      data-testid={testId}
      sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}
    >
      <Typography variant={titleVariant} component={headingLevel} sx={{ m: 0 }}>
        {title}
      </Typography>
      {description !== undefined && (
        <Typography variant="body2" color="text.secondary" component="p" sx={{ m: 0 }}>
          {description}
        </Typography>
      )}
      {children}
    </Box>
  )
}
