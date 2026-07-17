import { useTranslation } from 'react-i18next'
import { Button } from '@astryxdesign/core/Button'

const SUPPORTED_LANGS = ['en', 'de'] as const
type SupportedLang = (typeof SUPPORTED_LANGS)[number]

/**
 * The localStorage key used by i18next-browser-languagedetector to persist the
 * selected language. Exported so tests can assert on the same key without
 * duplicating the string literal.
 */
export const LANG_STORAGE_KEY = 'i18nextLng'

function isSupportedLang(lng: string): lng is SupportedLang {
  return (SUPPORTED_LANGS as readonly string[]).includes(lng)
}

/**
 * Interface-language selector (EN / DE).
 *
 * A labelled toolbar `group` of Astryx Buttons in exclusive mode: the active
 * language is the pressed button (aria-pressed). Selection switches i18next,
 * which persists the choice through the configured language-detector. Each
 * button carries the language's full name as its accessible label while showing
 * the short code visually.
 */
export function LanguageToggle() {
  const { t, i18n } = useTranslation()
  const currentLang: SupportedLang = isSupportedLang(i18n.language) ? i18n.language : 'en'

  const handleSelect = (next: SupportedLang): void => {
    if (next === currentLang) return
    void i18n.changeLanguage(next).then(() => {
      // Explicitly persist the selection so tests and environments where the
      // i18next-browser-languagedetector localStorage cache is unavailable still
      // see the correct value via the canonical key.
      try {
        window.localStorage.setItem(LANG_STORAGE_KEY, next)
      } catch {
        // Silently ignore - localStorage may be unavailable in some environments.
      }
    })
  }

  return (
    <div
      role="group"
      aria-label={t('languageToggle.ariaLabel')}
      style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}
    >
      {SUPPORTED_LANGS.map((lng) => (
        <Button
          key={lng}
          type="button"
          size="sm"
          variant={lng === currentLang ? 'primary' : 'ghost'}
          value={lng}
          aria-pressed={lng === currentLang}
          aria-label={t(`languageToggle.${lng}`)}
          onClick={() => handleSelect(lng)}
          label={lng.toUpperCase()}
        />
      ))}
    </div>
  )
}
