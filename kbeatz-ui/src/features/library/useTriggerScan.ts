import { useMutation } from '@tanstack/react-query'
import { LibraryService } from '../../api/generated'

export function useTriggerScan() {
  const mutation = useMutation({
    mutationFn: () => LibraryService.triggerLibraryScan(),
  })
  return {
    trigger: mutation.mutate,
    isPending: mutation.isPending,
    error: mutation.error,
  }
}
