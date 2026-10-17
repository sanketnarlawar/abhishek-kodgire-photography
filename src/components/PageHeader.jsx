import { Link } from 'react-router-dom'
import { ArrowLeftIcon } from './icons'

export default function PageHeader({ title, subtitle, action, backTo, onBack }) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        {backTo && (
          <Link
            to={backTo}
            title="Back"
            aria-label="Back"
            className="group flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 shadow-sm transition hover:border-gray-300 hover:bg-gray-100 hover:text-gray-900 active:scale-95 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:border-gray-600 dark:hover:bg-gray-700 dark:hover:text-white"
          >
            <ArrowLeftIcon width={18} height={18} className="transition-transform group-hover:-translate-x-0.5" />
          </Link>
        )}
        {onBack && !backTo && (
          <button
            type="button"
            onClick={onBack}
            title="Back"
            aria-label="Back"
            className="group flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 shadow-sm transition hover:border-gray-300 hover:bg-gray-100 hover:text-gray-900 active:scale-95 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:border-gray-600 dark:hover:bg-gray-700 dark:hover:text-white"
          >
            <ArrowLeftIcon width={18} height={18} className="transition-transform group-hover:-translate-x-0.5" />
          </button>
        )}
        <div>
          <h1 className="text-2xl font-bold">{title}</h1>
          {subtitle && <p className="text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  )
}
