import { type MouseEvent } from 'react'
import { useTranslation } from 'react-i18next'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'

const SUPPORTED_LANGS = ['en', 'de'] as const
type SupportedLang = (typeof SUPPORTED_LANGS)[number]

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
    void i18n.changeLanguage(next)
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
