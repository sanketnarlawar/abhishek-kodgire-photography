import { createContext, useCallback, useContext, useRef, useState } from 'react'

const ConfirmContext = createContext({ confirm: async () => false })

export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null)
  const resolver = useRef(null)

  const confirm = useCallback((options) => {
    setState({
      title: options.title || 'Are you sure?',
      message: options.message || '',
      confirmText: options.confirmText || 'Confirm',
      cancelText: options.cancelText || 'Cancel',
      danger: options.danger ?? true,
    })
    return new Promise((resolve) => {
      resolver.current = resolve
    })
  }, [])

  const close = (result) => {
    resolver.current?.(result)
    resolver.current = null
    setState(null)
  }

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {state && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 p-4 animate-fade-in">
          <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl animate-pop-in dark:bg-gray-800">
            <h3 className="text-lg font-semibold">{state.title}</h3>
            {state.message && (
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{state.message}</p>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => close(false)} className="btn-secondary">
                {state.cancelText}
              </button>
              <button
                onClick={() => close(true)}
                className={state.danger ? 'btn-danger' : 'btn-primary'}
              >
                {state.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  )
}

export const useConfirm = () => useContext(ConfirmContext).confirm
