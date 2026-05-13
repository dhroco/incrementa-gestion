import { useEffect, useMemo } from 'react'
import { useShell } from './useShell'

function breadcrumbKey(segments) {
  if (!Array.isArray(segments) || segments.length === 0) return ''
  return JSON.stringify(
    segments.map((s) => ({
      label: typeof s?.label === 'string' ? s.label : '',
      to: typeof s?.to === 'string' && s.to.trim().length ? s.to : null
    }))
  )
}

/**
 * Registers ordered breadcrumb segments for the shell subheader (cleared on unmount).
 * Pass `null` or `[]` to leave breadcrumb empty. Callers SHOULD memoize the `segments` array
 * when building it inline to avoid redundant effect runs.
 *
 * @param {Array<{ label: string, to?: string | null }> | null | undefined} segments
 */
export function useSubHeaderBreadcrumb(segments) {
  const { setSubHeaderBreadcrumb } = useShell()
  const key = useMemo(() => breadcrumbKey(segments), [segments])

  useEffect(() => {
    if (!key) {
      setSubHeaderBreadcrumb(null)
      return () => setSubHeaderBreadcrumb(null)
    }
    setSubHeaderBreadcrumb(Array.isArray(segments) ? segments : null)
    return () => setSubHeaderBreadcrumb(null)
  }, [key, segments, setSubHeaderBreadcrumb])
}
