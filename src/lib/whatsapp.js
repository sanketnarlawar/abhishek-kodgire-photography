import { formatCurrency, formatDate } from './format'

// Returns a wa.me chat URL with the invoice summary prefilled, or null if the phone is unusable.
export function buildInvoiceWhatsAppUrl({
  phone,
  clientName,
  studioName,
  upiId,
  invoiceNumber,
  issueDate,
  items = [],
  discount = 0,
  total = 0,
  paid = 0,
}) {
  let digits = String(phone || '').replace(/\D/g, '')
  if (digits.length === 10) digits = `91${digits}`
  if (digits.length < 11) return null

  const balance = Math.max(0, total - paid)
  const lines = [
    clientName ? `Hello ${clientName},` : 'Hello,',
    `Invoice ${invoiceNumber} from ${studioName || 'our studio'}`,
    `Date: ${formatDate(issueDate)}`,
    '',
    ...items.map((it) => {
      const amount = it.amount ?? (it.quantity || 0) * (it.rate || 0)
      return `• ${it.description} x${it.quantity} = ${formatCurrency(amount)}`
    }),
    '',
    ...(discount > 0 ? [`Discount: -${formatCurrency(discount)}`] : []),
    `Total: ${formatCurrency(total)}`,
    ...(paid > 0 ? [`Paid: ${formatCurrency(paid)}`, `Balance: ${formatCurrency(balance)}`] : []),
    ...(balance > 0 && upiId ? ['', `Pay via UPI: ${upiId}`] : []),
    '',
    'Thank you!',
  ]

  return `https://wa.me/${digits}?text=${encodeURIComponent(lines.join('\n'))}`
}
