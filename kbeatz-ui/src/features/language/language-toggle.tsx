import { useTranslation } from 'react-i18next'

const SUPPORTED_LANGS = ['en', 'de'] as const
type SupportedLang = (typeof SUPPORTED_LANGS)[number]

function isSupportedLang(lng: string): lng is SupportedLang {
  return (SUPPORTED_LANGS as readonly string[]).includes(lng)
}

export function LanguageToggle() {
  const { t, i18n } = useTranslation()

  const currentLang = isSupportedLang(i18n.language) ? i18n.language : 'en'

  const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const selected = event.target.value
    if (isSupportedLang(selected)) {
      void i18n.changeLanguage(selected)
    }
  }

  return (
    <label className="language-toggle">
      <span className="visually-hidden">{t('languageToggle.ariaLabel')}</span>
      <select
        value={currentLang}
        onChange={handleChange}
        aria-label={t('languageToggle.ariaLabel')}
      >
        {SUPPORTED_LANGS.map((lng) => (
          <option key={lng} value={lng}>
            {t(`languageToggle.${lng}`)}
          </option>
        ))}
      </select>
    </label>
  )
}
