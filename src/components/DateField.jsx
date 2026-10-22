import { CalendarIcon } from './icons'

// Native date input hidden under a dd/mm/yyyy label: browsers render the native format by locale.
export default function DateField({ value, onChange, ariaLabel, placeholder = 'dd/mm/yyyy', className = '' }) {
  const [y, m, d] = value ? value.split('-') : []

  return (
    <span
      className={`relative inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-gray-50 px-2 py-1 text-xs text-gray-800 transition focus-within:border-brand-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 ${className}`}
    >
      <span className="tabular-nums">{value ? `${d}/${m}/${y}` : placeholder}</span>
      <CalendarIcon width={14} height={14} className="text-gray-400" />
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onClick={(e) => e.currentTarget.showPicker?.()}
        aria-label={ariaLabel}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
      />
    </span>
  )
}
