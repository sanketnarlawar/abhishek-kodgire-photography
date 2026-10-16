export const EVENT_TYPES = [
  'Wedding',
  'Pre-Wedding',
  'Engagement',
  'Birthday',
  'Baby Shower',
  'Maternity',
  'Naming Ceremony',
  'Corporate Event',
  'Product Shoot',
  'Fashion Shoot',
  'Other',
]

export const INVOICE_STATUSES = ['Unpaid', 'Partially Paid', 'Paid', 'Overdue']

export const QUOTATION_STATUSES = ['Draft', 'Sent', 'Accepted', 'Rejected']

export const PAYMENT_MODES = ['UPI', 'Cash', 'Bank Transfer', 'Card', 'Cheque']

export const EXPENSE_CATEGORIES = [
  'Equipment',
  'Travel',
  'Editing',
  'Assistants',
  'Props',
  'Software',
  'Marketing',
  'Other',
]

export function formatCurrency(value) {
  const amount = Number(value) || 0
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(amount)
}

export function formatDate(value) {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

// Builds a UPI deep link / QR payload per the NPCI UPI spec.
export function buildUpiUri({ upiId, payeeName, amount, note }) {
  if (!upiId) return ''
  const params = new URLSearchParams({
    pa: upiId,
    pn: payeeName || 'Studio',
    cu: 'INR',
  })
  if (amount) params.set('am', Number(amount).toFixed(2))
  if (note) params.set('tn', note)
  return `upi://pay?${params.toString()}`
}

export function statusBadgeClass(status) {
  switch (status) {
    case 'Paid':
    case 'Accepted':
      return 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
    case 'Partially Paid':
    case 'Sent':
      return 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
    case 'Overdue':
    case 'Rejected':
      return 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
    default:
      return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
  }
}
