import { statusBadgeClass } from '../lib/format'

// Status pill with a colored dot for quick scanning.
export default function StatusBadge({ status }) {
  return (
    <span className={`badge gap-1.5 ${statusBadgeClass(status)}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
      {status}
    </span>
  )
}
