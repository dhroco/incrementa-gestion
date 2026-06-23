import { useCallback, useEffect, useRef, useState } from 'react'
import { useBlocker } from 'react-router'
import { UnsavedChangesDialog } from '../components/UnsavedChangesDialog'

/**
 * Blocks in-app navigation and tab close when the form has unsaved changes.
 * @param {{
 *   isDirty: boolean,
 *   onSave: () => Promise<boolean> | boolean,
 *   enabled?: boolean,
 *   title?: string,
 *   message?: string,
 * }} options
 */
export function useUnsavedChangesGuard({
  isDirty,
  onSave,
  enabled = true,
  title,
  message,
}) {
  const bypassBlockRef = useRef(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const shouldBlock = useCallback(
    ({ currentLocation, nextLocation }) => {
      if (bypassBlockRef.current || !enabled || !isDirty) return false
      return currentLocation.pathname !== nextLocation.pathname
    },
    [enabled, isDirty]
  )

  const blocker = useBlocker(shouldBlock)

  useEffect(() => {
    if (blocker.state === 'blocked') {
      setDialogOpen(true)
    }
  }, [blocker.state])

  useEffect(() => {
    if (!enabled || !isDirty) return undefined
    function onBeforeUnload(e) {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [enabled, isDirty])

  const releaseBlocker = useCallback(() => {
    bypassBlockRef.current = true
    setDialogOpen(false)
    if (blocker.state === 'blocked') {
      blocker.proceed()
    }
    queueMicrotask(() => {
      bypassBlockRef.current = false
    })
  }, [blocker])

  const onStay = useCallback(() => {
    setDialogOpen(false)
    if (blocker.state === 'blocked') {
      blocker.reset()
    }
  }, [blocker])

  const onDiscard = useCallback(() => {
    releaseBlocker()
  }, [releaseBlocker])

  const onSaveAndLeave = useCallback(async () => {
    setSaving(true)
    try {
      const ok = await onSave()
      if (!ok) {
        setDialogOpen(false)
        if (blocker.state === 'blocked') {
          blocker.reset()
        }
        return
      }
      releaseBlocker()
    } finally {
      setSaving(false)
    }
  }, [blocker, onSave, releaseBlocker])

  const dialog =
    dialogOpen && enabled ? (
      <UnsavedChangesDialog
        open={dialogOpen}
        title={title}
        message={message}
        saving={saving}
        onStay={onStay}
        onDiscard={onDiscard}
        onSave={() => void onSaveAndLeave()}
      />
    ) : null

  return { dialog, releaseBlocker }
}
