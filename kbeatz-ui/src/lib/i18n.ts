import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from '../locales/en.json'

void i18n.use(initReactI18next).init({
  lng: 'en',
  fallbackLng: 'en',
  resources: { en: { translation: en } },
  interpolation: { escapeValue: false },
})

/** Matches a bare year: "1978" */
const YEAR_ONLY_RE = /^\d{4}$/
/** Matches year-month: "1978-06" */
const YEAR_MONTH_RE = /^\d{4}-\d{2}$/
/** Matches a full ISO date or ISO datetime starting with YYYY-MM-DD */
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}/

/**
 * Format a date string using the browser locale.
 *
 * Detects the precision of the input and formats accordingly:
 * - Bare year "1978" -> returned as-is (no month/day artefacts)
 * - Year-month "1978-06" -> locale-formatted month+year (e.g. "June 1978")
 * - Full ISO date "1978-07-14" -> locale-formatted full date (e.g. "14 Jul 1978")
 * - Unrecognised pattern -> returned unchanged, no exception thrown
 */
export function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return ''
  const locale = (typeof navigator !== 'undefined' ? navigator.language : undefined) ?? i18n.language ?? 'en'
  try {
    // Bare year: "1978" - return as-is
    if (YEAR_ONLY_RE.test(dateStr)) return dateStr
    // Year-month: "1978-06"
    if (YEAR_MONTH_RE.test(dateStr)) {
      const d = new Date(`${dateStr}-01`)
      if (isNaN(d.getTime())) return dateStr
      return new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'long' }).format(d)
    }
    // Full ISO date or ISO datetime (must start with YYYY-MM-DD)
    if (ISO_DATE_RE.test(dateStr)) {
      const d = new Date(dateStr)
      if (isNaN(d.getTime())) return dateStr
      return new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'short', day: 'numeric' }).format(d)
    }
    // Unrecognised format - return raw string unchanged
    return dateStr
  } catch {
    return dateStr
  }
}

/**
 * Format a UTC ISO-8601 timestamp using the browser locale.
 * Only processes strings that look like ISO datetimes (starting with YYYY-MM-DD).
 * Falls back to the raw string for unrecognised input or parse failures.
 */
export function formatDateTime(dateStr: string | undefined): string {
  if (!dateStr) return ''
  if (!ISO_DATE_RE.test(dateStr)) return dateStr
  const locale = (typeof navigator !== 'undefined' ? navigator.language : undefined) ?? i18n.language ?? 'en'
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return dateStr
    return new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d)
  } catch {
    return dateStr
  }
}

export default i18n
