import { useTranslation } from 'react-i18next'
import styles from './language-toggle.module.css'

const SUPPORTED_LANGS = ['en', 'de'] as const
type SupportedLang = (typeof SUPPORTED_LANGS)[number]

function isSupportedLang(lng: string): lng is SupportedLang {
  return (SUPPORTED_LANGS as readonly string[]).includes(lng)
}

export function LanguageToggle() {
  const { t, i18n } = useTranslation()
  const currentLang = isSupportedLang(i18n.language) ? i18n.language : 'en'

  return (
    <div className={styles.toggle} role="group" aria-label={t('languageToggle.ariaLabel')}>
      {SUPPORTED_LANGS.map((lng) => (
        <button
          key={lng}
          type="button"
          className={`${styles.langButton} ${currentLang === lng ? styles.active : ''}`}
          onClick={() => { void i18n.changeLanguage(lng) }}
          aria-pressed={currentLang === lng}
          aria-label={t(`languageToggle.${lng}`)}
        >
          {lng.toUpperCase()}
        </button>
      ))}
    </div>
  )
}
