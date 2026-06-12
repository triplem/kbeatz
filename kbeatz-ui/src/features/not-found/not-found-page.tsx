import { type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

// Props interface declared for project consistency; component takes no props.
export type NotFoundPageProps = Record<string, never>

export function NotFoundPage(): ReactElement {
  const { t } = useTranslation()

  return (
    <div data-testid="not-found-page">
      <h1>{t('notFound.heading')}</h1>
      <Link to="/">{t('notFound.backToLibrary')}</Link>
    </div>
  )
}
