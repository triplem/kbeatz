/**
 * Minimal structured logger for frontend use.
 *
 * Writes JSON-formatted log entries to console.error so they appear in browser
 * DevTools and are captured by any observability tooling that intercepts console output.
 *
 * Usage:
 *   logger.error({ err: error.message, albumId }, 'batch_save_failed')
 */
export const logger = {
  error: (ctx: object, msg: string): void => {
    console.error(JSON.stringify({ level: 'error', ...ctx, msg }))
  },
}
