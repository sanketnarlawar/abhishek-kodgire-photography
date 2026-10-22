import { useState, useRef, useEffect, useLayoutEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { formatCurrency } from '../lib/format'

/**
 * ItemCombobox
 * Autocomplete input for invoice/quotation line item description.
 * - Shows suggestions from saved database / catalog items with price and unit.
 * - Allows typing any custom item name.
 * - Auto-fills unit and rate when an existing item is selected.
 */
export default function ItemCombobox({
  value = '',
  onChange,
  onSelectItem,
  itemsList = [],
  placeholder = 'e.g. Soft copy Studio / Candid Photography',
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const wrapperRef = useRef(null)
  const inputRef = useRef(null)
  const dropdownRef = useRef(null)
  const [dropdownStyle, setDropdownStyle] = useState({})

  useLayoutEffect(() => {
    if (!isOpen) return

    const updatePosition = () => {
      const rect = inputRef.current.getBoundingClientRect()
      const viewportWidth = document.documentElement.clientWidth
      const viewportHeight = window.innerHeight
      const spaceBelow = Math.max(0, viewportHeight - rect.bottom - 8)
      const spaceAbove = Math.max(0, rect.top - 8)
      const openAbove = spaceBelow < 240 && spaceAbove > spaceBelow
      const width = Math.min(Math.max(rect.width, 320), viewportWidth - 16)

      setDropdownStyle({
        width,
        left: Math.max(8, Math.min(rect.left, viewportWidth - width - 8)),
        top: openAbove ? undefined : rect.bottom + 4,
        bottom: openAbove ? viewportHeight - rect.top + 4 : undefined,
        maxHeight: Math.min(240, openAbove ? spaceAbove : spaceBelow),
      })
    }

    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [isOpen])

  // Filter items matching typed query
  const query = (value || '').trim().toLowerCase()
  const filtered = useMemo(() => {
    if (!query) return itemsList.slice(0, 8)
    return itemsList
      .filter((it) => (it.name || '').toLowerCase().includes(query))
      .slice(0, 10)
  }, [itemsList, query])

  const exactMatch = useMemo(() => {
    if (!query) return null
    return itemsList.find((it) => (it.name || '').toLowerCase() === query)
  }, [itemsList, query])

  // Show "+ Add new item" when typed text doesn't exactly match an existing item
  const showAddNew = Boolean(query && !exactMatch)

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target) && !dropdownRef.current?.contains(e.target)) {
        setIsOpen(false)
        setHighlightedIndex(-1)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelect = (item) => {
    onChange(item.name)
    if (onSelectItem) {
      onSelectItem(item)
    }
    setIsOpen(false)
    setHighlightedIndex(-1)
  }

  const handleAddNew = () => {
    const newItem = {
      name: value.trim(),
      unit: 'Photo',
      rate: '',
    }
    handleSelect(newItem)
  }

  const handleKeyDown = (e) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setIsOpen(true)
        return
      }
      return
    }

    const totalOptions = (showAddNew ? 1 : 0) + filtered.length

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightedIndex((prev) => (prev + 1 < totalOptions ? prev + 1 : 0))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : totalOptions - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (highlightedIndex === 0 && showAddNew) {
        handleAddNew()
      } else {
        const itemIdx = showAddNew ? highlightedIndex - 1 : highlightedIndex
        if (itemIdx >= 0 && itemIdx < filtered.length) {
          handleSelect(filtered[itemIdx])
        } else if (value.trim()) {
          setIsOpen(false)
        }
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false)
      setHighlightedIndex(-1)
    }
  }

  return (
    <div ref={wrapperRef} className="relative w-full">
      <input
        ref={inputRef}
        type="text"
        placeholder={placeholder}
        value={value}
        autoComplete="off"
        onChange={(e) => {
          onChange(e.target.value)
          if (!isOpen) setIsOpen(true)
          setHighlightedIndex(0)
        }}
        onFocus={() => {
          setIsOpen(true)
          setHighlightedIndex(0)
        }}
        onKeyDown={handleKeyDown}
        className="w-full rounded border border-gray-200 bg-white px-2.5 py-1 text-sm font-medium text-gray-800 placeholder-gray-400 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
      />

      {isOpen && createPortal(
        <div ref={dropdownRef} style={dropdownStyle} className="fixed z-50 overflow-y-auto rounded-md border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-800">
          {/* Header */}
          <div className="border-b border-gray-100 bg-gray-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:border-gray-700 dark:bg-gray-900/50 dark:text-gray-400">
            {query ? 'Matching Items' : itemsList.length > 0 ? 'Saved Studio Items' : 'Item Suggestions'}
          </div>

          {/* Add New Option */}
          {showAddNew && (
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault()
                handleAddNew()
              }}
              className={`flex w-full items-center justify-between border-b border-gray-100 px-3 py-2 text-left text-xs transition-colors dark:border-gray-700 ${
                highlightedIndex === 0
                  ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300'
                  : 'bg-blue-50/30 text-blue-600 hover:bg-blue-50 dark:bg-blue-950/20 dark:text-blue-400 dark:hover:bg-blue-950/40'
              }`}
            >
              <div className="flex items-center gap-1.5 truncate">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-100 text-[11px] font-bold text-blue-700 dark:bg-blue-900 dark:text-blue-200">
                  +
                </span>
                <span className="truncate">
                  Add <strong className="font-semibold">"{value.trim()}"</strong>
                </span>
              </div>
              <span className="shrink-0 rounded bg-blue-100 px-1.5 py-0.5 text-[9px] font-medium text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
                New item
              </span>
            </button>
          )}

          {/* List of existing matching items */}
          {filtered.length > 0 ? (
            filtered.map((item, idx) => {
              const itemOptionIdx = showAddNew ? idx + 1 : idx
              const isSelected = highlightedIndex === itemOptionIdx

              return (
                <button
                  key={item.id || item.name}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault()
                    handleSelect(item)
                  }}
                  className={`flex w-full items-center justify-between px-3 py-2 text-left text-xs transition-colors ${
                    isSelected
                      ? 'bg-brand-50 text-brand-900 dark:bg-brand-950/50 dark:text-brand-200'
                      : 'text-gray-800 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-700/50'
                  }`}
                >
                  <div className="flex flex-col truncate pr-2">
                    <span className="truncate font-semibold text-gray-900 dark:text-gray-100">
                      {item.name}
                    </span>
                  </div>
                  {Number(item.rate) > 0 && (
                    <span className="shrink-0 font-mono text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(item.rate)}
                    </span>
                  )}
                </button>
              )
            })
          ) : !showAddNew ? (
            <div className="px-3 py-3 text-center text-xs text-gray-400">
              {itemsList.length === 0
                ? 'No items saved yet. Type a service name to add one.'
                : 'No matching items found'}
            </div>
          ) : null}
        </div>,
        document.body
      )}
    </div>
  )
}
