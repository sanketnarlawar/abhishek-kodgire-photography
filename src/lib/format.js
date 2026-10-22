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

export function formatTime(value) {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
}

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

function toWords(n) {
  n = Math.round(Number(n) || 0)
  if (n === 0) return 'Zero'
  if (n < 0) return `Minus ${toWords(-n)}`
  let w = ''
  if (n >= 10000000) { w += `${toWords(Math.floor(n / 10000000))} Crore `; n %= 10000000 }
  if (n >= 100000) { w += `${toWords(Math.floor(n / 100000))} Lakh `; n %= 100000 }
  if (n >= 1000) { w += `${toWords(Math.floor(n / 1000))} Thousand `; n %= 1000 }
  if (n >= 100) { w += `${toWords(Math.floor(n / 100))} Hundred `; n %= 100 }
  if (n >= 20) { w += `${TENS[Math.floor(n / 10)]} `; n %= 10 }
  if (n > 0) { w += `${ONES[n]} ` }
  return w.trim()
}

// Indian-system amount in words, e.g. "One Thousand Rupees only".
export function amountInWords(value) {
  const n = Number(value) || 0
  const rupees = Math.floor(n)
  const paise = Math.round((n - rupees) * 100)
  let w = `${toWords(rupees)} Rupees`
  if (paise > 0) w += ` and ${toWords(paise)} Paise`
  return `${w} only`
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
