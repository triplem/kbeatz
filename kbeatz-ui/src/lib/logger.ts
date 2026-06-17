/**
 * Minimal structured logger for frontend use.
 *
 * Writes JSON-formatted log entries to the console (console.warn for `warn`,
 * console.error for `error`) so they appear in browser DevTools and are captured
 * by any observability tooling that intercepts console output.
 *
 * Observability sink (opt-in, off by default):
 *   When the `VITE_LOG_SINK_URL` env var is set, each warn/error entry is also
 *   POSTed to that endpoint as JSON. This is OPT-IN: for the trusted-LAN
 *   deployment the var is unset and only console output happens (no mandatory
 *   third-party SaaS dependency). The sink is strictly fire-and-forget: any
 *   failure (network error, missing fetch, rejected promise) is swallowed and
 *   never throws or blocks the caller.
 *
 * PII discipline: callers pass `err.message` plus minimal context only - never
 * raw tokens, secrets, or full request bodies. The sink URL itself comes from
 * the environment, never hard-coded.
 *
 * Usage:
 *   logger.warn({ albumId }, 'cover_art_missing')
 *   logger.error({ err: error.message, albumId }, 'batch_save_failed')
 */

type LogLevel = 'warn' | 'error'

interface LogEntry {
  level: LogLevel
  msg: string
  [key: string]: unknown
}

/**
 * Resolve the optional observability sink endpoint from the build-time env.
 * Returns undefined (the default) when unset, leaving the logger console-only.
 */
function sinkUrl(): string | undefined {
  const url = import.meta.env.VITE_LOG_SINK_URL
  return typeof url === 'string' && url.length > 0 ? url : undefined
}

/**
 * Forward a log entry to the observability sink when configured. No-op when the
 * sink URL is unset. Fire-and-forget: failures are caught and discarded so the
 * sink can never throw into or break the calling code path.
 */
function forwardToSink(entry: LogEntry): void {
  const url = sinkUrl()
  if (url === undefined) {
    return
  }
  if (typeof fetch !== 'function') {
    return
  }
  try {
    void fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
      keepalive: true,
    }).catch(() => {
      // Swallow: the sink is best-effort and must never disrupt the app.
    })
  } catch {
    // Swallow synchronous throws (e.g. a stubbed fetch that throws).
  }
}

function emit(level: LogLevel, ctx: object, msg: string): void {
  const entry: LogEntry = { level, ...ctx, msg }
  const serialized = JSON.stringify(entry)
  if (level === 'error') {
    console.error(serialized)
  } else {
    console.warn(serialized)
  }
  forwardToSink(entry)
}

export const logger = {
  warn: (ctx: object, msg: string): void => {
    emit('warn', ctx, msg)
  },
  error: (ctx: object, msg: string): void => {
    emit('error', ctx, msg)
  },
}
