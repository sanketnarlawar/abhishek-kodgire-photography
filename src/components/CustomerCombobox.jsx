import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { formatCurrency } from '../lib/format'

/**
 * CustomerCombobox
 * - Type a NAME  → search existing customers by name, or auto-create on save
 * - Type DIGITS  → reflected immediately in the Phone No. field; also shows
 *                  matching existing customers by their phone number so the
 *                  user can select one (with outstanding balance shown).
 */
export default function CustomerCombobox({
  clients = [],
  selectedClientId = '',
  customerName = '',       // parent-controlled name value
  phoneValue = '',         // parent-controlled phone value (to show in input when typing digits)
  onSelectClient,
  onNameChange,
  onClear,
  onPhoneInput,            // called when user types a phone number (digits only)
  clientBalance = 0,
  placeholder = 'Search party name or phone number...',
  required = true,
}) {
  // ── Local raw input state ─────────────────────────────────────────────────
  // We keep internal state so the input always shows EXACTLY what the user
  // typed, regardless of whether it's a name or phone number.
  const [rawInput, setRawInput] = useState(customerName || '')
  const [isOpen, setIsOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const wrapperRef = useRef(null)
  const inputRef = useRef(null)

  // Sync rawInput when parent resets / clears the value
  useEffect(() => {
    setRawInput(customerName || '')
  }, [customerName])

  // ── Phone detection ───────────────────────────────────────────────────────
  // A string is a "phone input" if it contains ONLY digit-type chars and has ≥1 digit
  const isPhoneInput = useMemo(() => {
    const val = rawInput.trim()
    if (!val) return false
    return /^[0-9+\-\s()]+$/.test(val) && /\d/.test(val)
  }, [rawInput])

  // ── Find currently selected client ────────────────────────────────────────
  const selectedClient = useMemo(
    () => clients.find((c) => c.id === selectedClientId) || null,
    [clients, selectedClientId]
  )

  // ── Filter dropdown suggestions ───────────────────────────────────────────
  const filteredClients = useMemo(() => {
    const query = rawInput.trim().toLowerCase()
    if (!query) return clients.slice(0, 10)

    if (isPhoneInput) {
      // Search by phone digits only
      const digits = query.replace(/\D/g, '')
      return clients
        .filter((c) => (c.phone || '').replace(/\D/g, '').includes(digits))
        .slice(0, 15)
    }
    // Search by name or phone
    return clients
      .filter((c) => {
        const nameMatch = c.name?.toLowerCase().includes(query)
        const phoneMatch = c.phone?.includes(query)
        return nameMatch || phoneMatch
      })
      .slice(0, 15)
  }, [clients, rawInput, isPhoneInput])

  // ── Exact name match (for "Add as new" logic) ─────────────────────────────
  const exactNameMatch = useMemo(() => {
    if (isPhoneInput) return null
    const query = rawInput.trim().toLowerCase()
    if (!query) return null
    return clients.find((c) => c.name?.trim().toLowerCase() === query)
  }, [clients, rawInput, isPhoneInput])

  // Show "Add as new" only when user has typed a name (not digits) and it doesn't exactly match
  const showAddNewOption = !isPhoneInput && rawInput.trim().length > 0 && !exactNameMatch

  // ── Outside click closes dropdown ─────────────────────────────────────────
  useEffect(() => {
    const handle = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleSelect = useCallback(
    (client) => {
      setRawInput(client.name || '')
      onSelectClient?.(client)
      setIsOpen(false)
      setHighlightedIndex(-1)
    },
    [onSelectClient]
  )

  const handleAddNew = useCallback(() => {
    onNameChange?.(rawInput.trim(), true)
    setIsOpen(false)
    setHighlightedIndex(-1)
  }, [rawInput, onNameChange])

  const handleInputChange = (e) => {
    const val = e.target.value
    setRawInput(val)
    setHighlightedIndex(-1)

    const trimmed = val.trim()
    if (!trimmed) {
      // Cleared → reset everything
      onClear?.()
      setIsOpen(false)
      return
    }

    const looksLikePhone = /^[0-9+\-\s()]+$/.test(trimmed) && /\d/.test(trimmed)

    if (looksLikePhone) {
      // Route to phone field
      onPhoneInput?.(val)
      setIsOpen(trimmed.length >= 1) // show dropdown from first digit to match existing customers
    } else {
      // Route to customer name
      onNameChange?.(val)
      setIsOpen(true)
    }
  }

  const handleClear = () => {
    setRawInput('')
    onClear?.()
    setIsOpen(false)
    inputRef.current?.focus()
  }

  const handleKeyDown = (e) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        setIsOpen(true)
        return
      }
    }

    const totalOptions = filteredClients.length + (showAddNewOption ? 1 : 0)

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightedIndex((prev) => (prev + 1 < totalOptions ? prev + 1 : 0))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightedIndex((prev) => (prev - 1 >= 0 ? prev - 1 : totalOptions - 1))
    } else if (e.key === 'Enter') {
      if (isOpen && highlightedIndex >= 0) {
        e.preventDefault()
        if (showAddNewOption && highlightedIndex === 0) {
          handleAddNew()
        } else {
          const clientIdx = showAddNewOption ? highlightedIndex - 1 : highlightedIndex
          if (filteredClients[clientIdx]) handleSelect(filteredClients[clientIdx])
        }
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false)
    }
  }

  // ── What to display in status bar ─────────────────────────────────────────
  const statusBar = () => {
    if (selectedClient) {
      return (
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-1.5 py-0.5 font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
            Existing Party
          </span>
          <span
            className={`font-semibold ${
              clientBalance > 0
                ? 'text-rose-600 dark:text-rose-400'
                : 'text-gray-500 dark:text-gray-400'
            }`}
          >
            BAL: {formatCurrency(clientBalance)}
          </span>
        </div>
      )
    }
    if (isPhoneInput && rawInput.trim()) {
      return (
        <div className="flex items-center gap-1.5">
          <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 font-medium text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
            📲 Reflecting in Phone No. field
            {filteredClients.length > 0 && (
              <span className="ml-1 text-amber-600 dark:text-amber-400">
                — {filteredClients.length} match{filteredClients.length > 1 ? 'es' : ''} found ↓
              </span>
            )}
          </span>
        </div>
      )
    }
    if (rawInput.trim()) {
      return (
        <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
          <span className="inline-flex items-center gap-1 rounded bg-blue-50 px-1.5 py-0.5 font-medium dark:bg-blue-950/40">
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Customer (auto-saves to database on save)
          </span>
        </div>
      )
    }
    return (
      <span className="text-gray-400 dark:text-gray-500">
        Type a name or phone number to search / create
      </span>
    )
  }

  return (
    <div ref={wrapperRef} className="relative w-full">
      {/* ── Input ─────────────────────────────────────────────────────────── */}
      <div className="relative flex items-center">
        <input
          ref={inputRef}
          type="text"
          required={required && !selectedClientId && !customerName.trim()}
          value={rawInput}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoComplete="off"
          className="w-full rounded border border-gray-300 bg-white py-2 pl-3 pr-16 text-sm text-gray-800 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
        />

        <div className="absolute right-2 flex items-center gap-1 text-gray-400">
          {rawInput && (
            <button
              type="button"
              onClick={handleClear}
              title="Clear"
              className="rounded p-1 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-200"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsOpen((p) => !p)}
            tabIndex={-1}
            className="rounded p-1 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-200"
          >
            <svg
              className={`h-4 w-4 transform transition-transform ${isOpen ? 'rotate-180' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── Status bar ────────────────────────────────────────────────────── */}
      <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-xs">
        {statusBar()}
      </div>

      {/* ── Dropdown ──────────────────────────────────────────────────────── */}
      {isOpen && (
        <div className="absolute z-50 mt-1 max-h-72 w-full overflow-y-auto rounded-md border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-800">

          {/* Add as New Customer (name mode only) */}
          {showAddNewOption && (
            <button
              type="button"
              onClick={handleAddNew}
              className={`flex w-full items-center justify-between border-b border-gray-100 px-3 py-2.5 text-left text-sm transition-colors dark:border-gray-700 ${
                highlightedIndex === 0
                  ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300'
                  : 'bg-blue-50/40 text-blue-600 hover:bg-blue-50 dark:bg-blue-950/20 dark:text-blue-400 dark:hover:bg-blue-950/40'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700 dark:bg-blue-900 dark:text-blue-200">
                  +
                </span>
                <div>
                  <span className="font-semibold">Add "{rawInput.trim()}"</span>
                  <span className="ml-1 text-xs text-gray-500 dark:text-gray-400">as new customer</span>
                </div>
              </div>
              <span className="rounded bg-blue-100/70 px-1.5 py-0.5 text-[10px] font-medium text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
                Auto-create
              </span>
            </button>
          )}

          {/* Phone search header */}
          {isPhoneInput && filteredClients.length > 0 && (
            <div className="border-b border-gray-100 bg-amber-50/60 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-amber-700 dark:border-gray-700 dark:bg-amber-950/20 dark:text-amber-400">
              📞 Customers matching this phone number
            </div>
          )}

          {/* Existing matching customers */}
          {filteredClients.length > 0 ? (
            <div className="py-1">
              {!isPhoneInput && (
                <div className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                  Existing Customers
                </div>
              )}
              {filteredClients.map((c, idx) => {
                const itemIndex = showAddNewOption ? idx + 1 : idx
                const isHighlighted = highlightedIndex === itemIndex
                const isSelected = c.id === selectedClientId

                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => handleSelect(c)}
                    className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm transition-colors ${
                      isSelected
                        ? 'bg-brand-50 font-medium text-brand-900 dark:bg-brand-950/40 dark:text-brand-200'
                        : isHighlighted
                        ? 'bg-gray-100 text-gray-900 dark:bg-gray-700 dark:text-gray-100'
                        : 'text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-700/60'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-medium">{c.name}</div>
                      {c.phone && (
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          📞 {c.phone}
                        </div>
                      )}
                    </div>
                    {/* Show outstanding balance if available */}
                    <div className="ml-2 shrink-0 text-right">
                      {c.address && (
                        <div className="max-w-[120px] truncate text-xs text-gray-400 dark:text-gray-500">
                          {c.address}
                        </div>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          ) : isPhoneInput ? (
            <div className="p-4 text-center text-sm text-gray-500 dark:text-gray-400">
              No customer with this phone number. The number will be saved to Phone No. field.
            </div>
          ) : !showAddNewOption ? (
            <div className="p-4 text-center text-sm text-gray-500 dark:text-gray-400">
              No matching customers. Type a name to add a new one.
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}
