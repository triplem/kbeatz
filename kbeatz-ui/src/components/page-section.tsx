import { type ReactNode } from 'react'
import { Heading } from '@astryxdesign/core/Heading'
import { Text } from '@astryxdesign/core/Text'

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
  /**
   * Retained for source compatibility with callers; the Astryx Heading derives
   * its visual style from the semantic level, so this is no longer applied.
   */
  readonly titleVariant?: 'h4' | 'h5' | 'h6' | 'subtitle1'
  /** Accessible label for the wrapping landmark. Falls back to `title`. */
  readonly ariaLabel?: string
  /** Optional test id forwarded to the section element. */
  readonly testId?: string
  /** Section content. */
  readonly children: ReactNode
}

const HEADING_LEVEL: Record<NonNullable<PageSectionProps['headingLevel']>, 1 | 2 | 3 | 4> = {
  h1: 1,
  h2: 2,
  h3: 3,
  h4: 4,
}

/**
 * PageSection - a labelled content region with a heading and optional description.
 *
 * Renders a semantic `section` landmark (aria-labelled), an Astryx Heading at
 * the requested level, an optional description paragraph, and the children.
 *
 * Accessibility:
 * - The wrapping `section` carries an accessible name (aria-label).
 * - The heading uses a real heading element (h1-h4) for a correct outline.
 */
export function PageSection({
  title,
  description,
  headingLevel = 'h2',
  ariaLabel,
  testId,
  children,
}: PageSectionProps) {
  return (
    <section
      aria-label={ariaLabel ?? title}
      data-testid={testId}
      style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
    >
      <Heading level={HEADING_LEVEL[headingLevel]}>{title}</Heading>
      {description !== undefined && (
        <Text type="supporting">{description}</Text>
      )}
      {children}
    </section>
  )
}
