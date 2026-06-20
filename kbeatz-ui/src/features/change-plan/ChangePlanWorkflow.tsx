import { useCallback, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import type { ChangePlanOperation } from '../../api/generated'
import { LoadingState, ErrorState } from '../../components'
import { useCreateChangePlan } from './useCreateChangePlan'
import { useApplyChangePlan } from './useApplyChangePlan'
import { ChangePlanReview } from './ChangePlanReview'
import { ApplyResultList } from './ApplyResultList'

interface ChangePlanWorkflowProps {
  /** The operation to plan (RELAYOUT, DISCOGS_SYNC). */
  readonly operation: ChangePlanOperation
  /** The releases to include in the plan. Must contain at least one id. */
  readonly albumIds: ReadonlyArray<string>
  /**
   * Called when the workflow finishes: after a successful apply, after the user
   * cancels at the review step, or when they close the results view. The
   * boolean reports whether any change was applied (true after a successful
   * apply, false on cancel) so the caller can refresh or clear selection.
   */
  readonly onClose: (applied: boolean) => void
  /** Optional override for the confirm-apply button label. */
  readonly confirmLabel?: string
}

/**
 * ChangePlanWorkflow - orchestrates the dry-run -> review -> apply -> results
 * flow for a set of releases under a single operation.
 *
 * Flow:
 *  1. On mount it requests a dry-run plan (no disk writes) for the given ids.
 *  2. While the plan computes a loading state is shown; an error offers retry.
 *  3. The computed plan is shown via ChangePlanReview with Confirm / Cancel.
 *     Cancel writes nothing and closes.
 *  4. Confirm applies the plan; while applying a loading state is shown.
 *  5. The per-release results are shown with a Close action.
 *
 * The flow is driven by the two mutation states (plan + apply), so there is no
 * duplicated derived state machine. The initial plan request is the one place a
 * mount-time effect is appropriate: it is a user-initiated action (opening the
 * workflow) and there is no query key to express a "plan for this exact click".
 */
export function ChangePlanWorkflow({
  operation,
  albumIds,
  onClose,
  confirmLabel,
}: ChangePlanWorkflowProps) {
  const { t } = useTranslation()
  const { createPlan, plan, isPending: isPlanning, error: planError } = useCreateChangePlan()
  const { apply, result, isPending: isApplying, error: applyError } = useApplyChangePlan()

  // Stable key for the requested set so the plan is recomputed if the caller
  // remounts the workflow with a different selection.
  const requestKey = `${operation}|${[...albumIds].join(',')}`
  const requestedKeyRef = useRef<string | null>(null)

  const requestPlan = useCallback(() => {
    void createPlan({ operation, albumIds }).catch(() => {
      // Error is surfaced via planError; swallow the rejection here so it does
      // not bubble as an unhandled promise rejection.
    })
  }, [createPlan, operation, albumIds])

  useEffect(() => {
    if (requestedKeyRef.current === requestKey) {
      return
    }
    requestedKeyRef.current = requestKey
    requestPlan()
  }, [requestKey, requestPlan])

  const handleConfirm = useCallback(() => {
    if (!plan) return
    void apply(plan.id)
      .then(() => {
        onClose(true)
      })
      .catch(() => {
        // Error is surfaced via applyError.
      })
  }, [apply, plan, onClose])

  const handleCancel = useCallback(() => {
    onClose(false)
  }, [onClose])

  return (
    <Box data-testid="change-plan-workflow" sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {result !== undefined && (
        <>
          <ApplyResultList result={result} />
          <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
            <Button
              type="button"
              variant="contained"
              onClick={() => { onClose(true) }}
              data-testid="change-plan-results-close"
              sx={{ minHeight: 44 }}
            >
              {t('common.dismiss')}
            </Button>
          </Stack>
        </>
      )}

      {result === undefined && (
        <>
          {isPlanning && (
            <LoadingState message={t('changePlan.planning')} testId="change-plan-planning" />
          )}

          {!isPlanning && planError !== null && (
            <ErrorState
              message={t('changePlan.planError')}
              onRetry={requestPlan}
              retryLabel={t('common.retry')}
              testId="change-plan-plan-error"
            />
          )}

          {!isPlanning && planError === null && plan !== undefined && (
            <>
              <ChangePlanReview plan={plan} />

              {isApplying && (
                <LoadingState message={t('changePlan.applying')} testId="change-plan-applying" />
              )}

              {applyError !== null && !isApplying && (
                <ErrorState
                  message={t('changePlan.applyError')}
                  testId="change-plan-apply-error"
                />
              )}

              <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
                <Button
                  type="button"
                  variant="outlined"
                  color="inherit"
                  onClick={handleCancel}
                  disabled={isApplying}
                  data-testid="change-plan-cancel"
                  sx={{ minHeight: 44 }}
                >
                  {t('common.cancel')}
                </Button>
                <Button
                  type="button"
                  variant="contained"
                  onClick={handleConfirm}
                  disabled={isApplying}
                  aria-disabled={isApplying}
                  data-testid="change-plan-confirm"
                  sx={{ minHeight: 44 }}
                >
                  {confirmLabel ?? t('changePlan.confirmApply')}
                </Button>
              </Stack>
            </>
          )}
        </>
      )}
    </Box>
  )
}
