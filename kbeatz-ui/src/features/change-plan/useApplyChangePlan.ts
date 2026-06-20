import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ChangePlansService, type ApplyChangePlanResult } from '../../api/generated'

/** Object return shape of {@link useApplyChangePlan}. */
export interface UseApplyChangePlanResult {
  /** Apply the stored plan with the given id; resolves with per-release outcomes. */
  readonly apply: (planId: string) => Promise<ApplyChangePlanResult>
  /** The most recent apply result, or undefined before the first call. */
  readonly result: ApplyChangePlanResult | undefined
  /** True while the apply request is in flight. */
  readonly isPending: boolean
  /** The error from the last failed request, or null. */
  readonly error: Error | null
  /** Reset the mutation back to its idle state (clears result and error). */
  readonly reset: () => void
}

/**
 * Apply a previously computed change plan by id.
 *
 * This is the user's confirmation step: nothing is moved or written until this
 * runs. On success the album and scan-status queries are invalidated so the
 * browse views reflect the moved directories and rewritten tags immediately.
 *
 * Per-release problems are reported inside the result body (APPLIED / SKIPPED /
 * FAILED) rather than as request failures.
 */
export function useApplyChangePlan(): UseApplyChangePlanResult {
  const queryClient = useQueryClient()

  const mutation = useMutation<ApplyChangePlanResult, Error, string>({
    mutationFn: (planId) => ChangePlansService.applyChangePlan({ planId }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['albums'] })
      void queryClient.invalidateQueries({ queryKey: ['scan-status'] })
    },
  })

  return {
    apply: mutation.mutateAsync,
    result: mutation.data,
    isPending: mutation.isPending,
    error: mutation.error,
    reset: mutation.reset,
  }
}
