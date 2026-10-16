import { useEffect, useRef } from 'react'
import { useBlocker } from 'react-router-dom'
import { useConfirm } from '../contexts/ConfirmContext'

// Warns before leaving a form with unsaved changes (both in-app nav and tab close).
// Returns release() — call it right before an intentional navigation (e.g. after save).
export function useUnsavedGuard(dirty) {
  const confirm = useConfirm()
  const bypassRef = useRef(false)

  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      !bypassRef.current && dirty && currentLocation.pathname !== nextLocation.pathname
  )

  useEffect(() => {
    if (blocker.state === 'blocked') {
      confirm({
        title: 'Discard changes?',
        message: 'You have unsaved changes that will be lost.',
        confirmText: 'Discard',
        cancelText: 'Keep editing',
      }).then((ok) => (ok ? blocker.proceed() : blocker.reset()))
    }
  }, [blocker, confirm])

  useEffect(() => {
    const handler = (e) => {
      if (!dirty || bypassRef.current) return
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])

  return () => {
    bypassRef.current = true
  }
}
