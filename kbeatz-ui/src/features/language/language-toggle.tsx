import { type MouseEvent } from 'react'
import { useTranslation } from 'react-i18next'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'

const SUPPORTED_LANGS = ['en', 'de'] as const
type SupportedLang = (typeof SUPPORTED_LANGS)[number]

/**
 * The localStorage key used by i18next-browser-languagedetector to persist the
 * selected language. Exported so tests can assert on the same key without
 * duplicating the string literal.
 */
export const LANG_STORAGE_KEY = 'i18nextLng'

/** WCAG 2.5.5 minimum touch-target size in px. */
const MIN_TOUCH_TARGET = 44

function isSupportedLang(lng: string): lng is SupportedLang {
  return (SUPPORTED_LANGS as readonly string[]).includes(lng)
}

/**
 * Interface-language selector (EN / DE).
 *
 * MUI ToggleButtonGroup in exclusive mode: the active language is the pressed
 * button. Selection switches i18next, which persists the choice through the
 * configured language-detector (unchanged behaviour). The group is labelled
 * for screen readers and each button carries the language's full name as its
 * accessible label while showing the short code visually.
 */
export function LanguageToggle() {
  const { t, i18n } = useTranslation()
  const currentLang: SupportedLang = isSupportedLang(i18n.language) ? i18n.language : 'en'

  const handleChange = (_event: MouseEvent<HTMLElement>, next: SupportedLang | null): void => {
    // Exclusive groups emit null when the active button is re-clicked; keep the
    // current language selected rather than deselecting everything.
    if (next === null || next === currentLang) return
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
    <ToggleButtonGroup
      value={currentLang}
      exclusive
      onChange={handleChange}
      aria-label={t('languageToggle.ariaLabel')}
      size="small"
      color="primary"
      sx={{ ml: 'auto' }}
    >
      {SUPPORTED_LANGS.map((lng) => (
        <ToggleButton
          key={lng}
          value={lng}
          aria-label={t(`languageToggle.${lng}`)}
          sx={{
            minWidth: MIN_TOUCH_TARGET,
            minHeight: MIN_TOUCH_TARGET,
            fontWeight: 600,
          }}
        >
          {lng.toUpperCase()}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  )
}
