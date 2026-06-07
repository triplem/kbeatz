/**
 * Sentinel error thrown when a user-driven cancellation (e.g. dismissing a
 * confirmation dialog) aborts a pending save.
 *
 * EditableField inspects the caught error type to distinguish between real
 * save failures (show error toast) and deliberate user cancellations (silent
 * rollback, no error message shown).
 */
export class CancelledByUserError extends Error {
  constructor() {
    super('Cancelled by user')
    this.name = 'CancelledByUserError'
  }
}
