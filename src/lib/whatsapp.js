import { amountInWords, formatCurrency, formatTime } from './format'

const LINE = '━━━━━━━━━━━━━━━━━━━━'

// YYYY-MM-DD -> DD-MM-YYYY, same as the PDF.
const fmtDate = (value) => {
  const m = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/)
  return m ? `${m[3]}-${m[2]}-${m[1]}` : '-'
}

// Returns a wa.me chat URL with an invoice laid out like the PDF, or null if the phone is unusable.
export function buildInvoiceWhatsAppUrl({ phone, profile = {}, client = {}, invoice = {}, paid = 0, paymentMode }) {
  let digits = String(phone || '').replace(/\D/g, '')
  if (digits.length === 10) digits = `91${digits}`
  if (digits.length < 11) return null

  const items = invoice.items || []
  const subtotal = Number(invoice.subtotal) || 0
  const discount = Number(invoice.discount) || 0
  const total = Number(invoice.total) || 0
  const balance = Math.max(0, total - paid)
  const totalQty = items.reduce((s, it) => s + (Number(it.quantity) || 0), 0)
  const mode = paid > 0 ? paymentMode || 'Paid' : 'Payment Pending'
  const time = formatTime(invoice.created_at)
  const terms = profile.terms?.trim()

  const lines = [
    '*INVOICE*',
    LINE,
    `*${profile.studio_name || 'Studio'}*`,
    ...(profile.address ? [profile.address] : []),
    ...(profile.phone ? [`Phone no.: ${profile.phone}`] : []),
    ...(profile.email ? [`Email: ${profile.email}`] : []),
    LINE,
    '*Bill To*',
    client.name || '-',
    ...(client.phone ? [`Contact No.: ${client.phone}`] : []),
    ...(client.email ? [`Email: ${client.email}`] : []),
    ...(client.address ? [client.address] : []),
    '',
    '*Invoice Details*',
    `Invoice No.: ${invoice.invoice_number || '-'}`,
    `Date: ${fmtDate(invoice.issue_date)}`,
    ...(time ? [`Time: ${time}`] : []),
    ...(invoice.event_type && invoice.event_type !== 'Sale' ? [`Event: ${invoice.event_type}`] : []),
    ...(invoice.event_date ? [`Event Date: ${fmtDate(invoice.event_date)}`] : []),
    LINE,
    '*Items*',
    ...items.flatMap((it, i) => {
      const qty = Number(it.quantity) || 0
      const rate = Number(it.rate) || 0
      const amount = it.amount ?? qty * rate
      return [
        `${i + 1}. *${it.description || '-'}*`,
        `    ${qty} x ${formatCurrency(rate)} = ${formatCurrency(amount)}`,
      ]
    }),
    `Total Qty: ${totalQty}`,
    LINE,
    `Sub Total: ${formatCurrency(subtotal)}`,
    ...(discount > 0 ? [`Discount: -${formatCurrency(discount)}`] : []),
    `*Total: ${formatCurrency(total)}*`,
    `Received: ${formatCurrency(paid)}`,
    `Balance: ${formatCurrency(balance)}`,
    `Payment Mode: ${mode}`,
    '',
    '*Invoice Amount In Words*',
    amountInWords(total),
    ...(balance > 0 && profile.upi_id ? ['', `*Pay via UPI:* ${profile.upi_id}`] : []),
    ...(terms ? [LINE, terms] : []),
  ]

  return `https://wa.me/${digits}?text=${encodeURIComponent(lines.join('\n'))}`
}
