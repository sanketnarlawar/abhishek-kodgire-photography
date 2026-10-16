import { createContext, useCallback, useContext, useState } from 'react'

const ToastContext = createContext({ notify: () => {} })

let idCounter = 0

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const remove = useCallback((id) => setToasts((list) => list.filter((t) => t.id !== id)), [])

  const notify = useCallback(
    (message, type = 'success', duration = 3000) => {
      const id = ++idCounter
      setToasts((list) => [...list, { id, message, type }])
      if (duration) setTimeout(() => remove(id), duration)
    },
    [remove]
  )

  return (
    <ToastContext.Provider value={{ notify }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-4 z-[100] flex flex-col items-center gap-2 px-4">
        {toasts.map((t) => (
          <div
            key={t.id}
            onClick={() => remove(t.id)}
            className={`pointer-events-auto flex w-full max-w-sm cursor-pointer items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium shadow-lg ring-1 transition animate-toast-in ${
              t.type === 'success'
                ? 'bg-green-600 text-white ring-green-700'
                : t.type === 'error'
                ? 'bg-red-600 text-white ring-red-700'
                : 'bg-gray-800 text-white ring-gray-900'
            }`}
          >
            <span className="text-base">
              {t.type === 'success' ? '✓' : t.type === 'error' ? '⚠' : 'ℹ'}
            </span>
            <span className="flex-1">{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export const useToast = () => useContext(ToastContext)
