import QRCode from 'qrcode'
import { pdf } from '@react-pdf/renderer'
import { supabase } from './supabase'
import InvoicePDF from '../components/InvoicePDF'
import { buildUpiUri, formatCurrency } from './format'

/**
 * Formats a phone number for WhatsApp Cloud API.
 * WhatsApp requires numbers in international format without '+', spaces, or dashes.
 * Example for India: '9876543210' -> '919876543210'.
 */
export function sanitizeWhatsAppPhone(phone) {
  if (!phone) return ''
  let cleaned = String(phone).replace(/\D/g, '')

  // Remove leading single zero if 11 digits (e.g. 09876543210 -> 9876543210)
  if (cleaned.length === 11 && cleaned.startsWith('0')) {
    cleaned = cleaned.substring(1)
  }

  // If 10 digits (standard Indian mobile number without country code), prepend 91
  if (cleaned.length === 10) {
    cleaned = `91${cleaned}`
  }

  return cleaned
}

/**
 * Converts a Blob to a pure Base64 string (without data URL prefix).
 */
function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const result = reader.result || ''
      const base64 = typeof result === 'string' ? result.split(',')[1] : ''
      resolve(base64)
    }
    reader.onerror = (err) => reject(err)
    reader.readAsDataURL(blob)
  })
}

/**
 * Generates the invoice PDF directly in the browser as a temporary in-memory Blob,
 * sends it to the Supabase Edge Function to deliver via WhatsApp Cloud API,
 * and discards the PDF blob immediately without saving to Supabase Storage.
 *
 * @param {Object} options
 * @param {Object} options.invoice - Invoice data (invoice_number, total, items, etc.)
 * @param {Object} options.client - Customer data (name, phone, etc.)
 * @param {Object} options.profile - Business profile (studio_name, upi_id, etc.)
 * @param {Array}  options.payments - Payment records for this invoice
 * @returns {Promise<{ success: boolean, messageId?: string, error?: string }>}
 */
export async function sendInvoicePdfViaWhatsApp({ invoice, client, profile = {}, payments = [] }) {
  if (!supabase) {
    return {
      success: false,
      error: 'Supabase client is not configured. Please check your .env settings.',
    }
  }

  const rawPhone = client?.phone || invoice?.phone || ''
  const formattedPhone = sanitizeWhatsAppPhone(rawPhone)

  if (!formattedPhone || formattedPhone.length < 10) {
    return {
      success: false,
      error: 'Customer phone number is missing or invalid for WhatsApp delivery.',
    }
  }

  try {
    // 1. Calculate balance & UPI QR if available
    const paid = (payments || []).reduce((s, p) => s + (Number(p.amount) || 0), 0)
    const balance = Math.max(0, (Number(invoice.total) || 0) - paid)

    let qrDataUrl = ''
    if (profile?.upi_id) {
      try {
        const upiUri = buildUpiUri({
          upiId: profile.upi_id,
          payeeName: profile.upi_payee_name || profile.studio_name,
          amount: balance || invoice.total,
          note: invoice.invoice_number,
        })
        if (upiUri) {
          qrDataUrl = await QRCode.toDataURL(upiUri, { width: 180, margin: 1 })
        }
      } catch {
        qrDataUrl = ''
      }
    }

    // 2. Generate PDF in browser memory
    let pdfBlob = await pdf(
      <InvoicePDF
        profile={profile}
        invoice={invoice}
        client={client}
        qrDataUrl={qrDataUrl}
        payments={payments}
      />
    ).toBlob()

    // 3. Convert Blob to base64
    const base64Data = await blobToBase64(pdfBlob)

    // Discard the blob reference from memory
    pdfBlob = null

    // 4. Construct payload for Supabase Edge Function
    const filename = `${invoice.invoice_number || 'Invoice'}.pdf`
    const customerName = client?.name || invoice?.billing_name || 'Customer'
    const studioName = profile?.studio_name || 'Photography Studio'

    const payload = {
      pdfBase64: base64Data,
      filename,
      recipientPhone: formattedPhone,
      recipientName: customerName,
      invoiceNumber: invoice.invoice_number,
      totalAmount: formatCurrency(invoice.total || 0),
      balanceDue: formatCurrency(balance),
      studioName,
    }

    // 5. Invoke Supabase Edge Function
    const { data, error } = await supabase.functions.invoke('send-whatsapp-invoice', {
      body: payload,
    })

    if (error) {
      // Supabase Edge Function invocation error
      return {
        success: false,
        error: error.message || 'Failed to invoke WhatsApp Edge Function.',
      }
    }

    if (!data?.success) {
      return {
        success: false,
        error: data?.error || 'WhatsApp Cloud API returned an unknown error.',
      }
    }

    return {
      success: true,
      messageId: data.messageId,
    }
  } catch (err) {
    return {
      success: false,
      error: err.message || 'An unexpected error occurred while sending WhatsApp invoice.',
    }
  }
}
