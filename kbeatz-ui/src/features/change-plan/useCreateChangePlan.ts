import { useMutation } from '@tanstack/react-query'
import {
  ChangePlansService,
  type ChangePlan,
  type ChangePlanOperation,
} from '../../api/generated'

/** Variables for a dry-run change-plan request. */
export interface CreateChangePlanVariables {
  /** The operation the plan describes (RELAYOUT, DISCOGS_SYNC). */
  readonly operation: ChangePlanOperation
  /** One or more release (album) ids to include in the plan. */
  readonly albumIds: ReadonlyArray<string>
}

/** Object return shape of {@link useCreateChangePlan}. */
export interface UseCreateChangePlanResult {
  /** Trigger a dry-run plan computation; resolves with the stored plan. */
  readonly createPlan: (vars: CreateChangePlanVariables) => Promise<ChangePlan>
  /** The most recently computed plan, or undefined before the first call. */
  readonly plan: ChangePlan | undefined
  /** True while the plan request is in flight. */
  readonly isPending: boolean
  /** The error from the last failed request, or null. */
  readonly error: Error | null
  /** Reset the mutation back to its idle state (clears plan and error). */
  readonly reset: () => void
}

/**
 * Compute a consolidated dry-run change plan for one or many releases.
 *
 * This performs no disk writes: the returned plan only describes the directory
 * moves, tag changes, and conflicts that an apply step would perform. The plan
 * is stored server-side and can later be applied via {@link useApplyChangePlan}.
 *
 * No useEffect data fetching: the request is a user-initiated mutation, per
 * react-patterns.md.
 */
export function useCreateChangePlan(): UseCreateChangePlanResult {
  const mutation = useMutation<ChangePlan, Error, CreateChangePlanVariables>({
    mutationFn: ({ operation, albumIds }) =>
      ChangePlansService.createChangePlan({
        requestBody: { operation, albumIds: [...albumIds] },
      }),
  })

  return {
    createPlan: mutation.mutateAsync,
    plan: mutation.data,
    isPending: mutation.isPending,
    error: mutation.error,
    reset: mutation.reset,
  }
}
