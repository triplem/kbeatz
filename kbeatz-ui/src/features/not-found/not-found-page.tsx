import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

export function NotFoundPage() {
  const { t } = useTranslation()

  return (
    <div data-testid="not-found-page">
      <h1>{t('notFound.heading')}</h1>
      <Link to="/">{t('notFound.backToLibrary')}</Link>
    </div>
  )
}
