import { createElement } from 'react'
import { getLogoDataUrl } from './logoCache'

// Loaded on demand so @react-pdf/renderer stays out of the main bundle.
const loaders = {
  quotation: () => import('../components/QuotationPDF'),
  quotationInvoice: () => import('../components/QuotationInvoicePDF'),
  invoice: () => import('../components/InvoicePDF'),
}

const NOTO_KINDS = new Set(['quotation', 'quotationInvoice'])

export async function buildPdfBlob(kind, props) {
  const [{ pdf }, mod] = await Promise.all([import('@react-pdf/renderer'), loaders[kind]()])
  let { profile } = props
  if (kind === 'invoice' && profile?.logo_url) {
    profile = { ...profile, logo_url: await getLogoDataUrl(profile.logo_url) }
  }
  return pdf(createElement(mod.default, { ...props, profile })).toBlob()
}

// Warms the renderer, the document module and the fonts before the first build.
export async function preloadPdf(kind) {
  try {
    const [{ Font }] = await Promise.all([import('@react-pdf/renderer'), loaders[kind]()])
    if (NOTO_KINDS.has(kind)) {
      await Promise.all([
        Font.load({ fontFamily: 'NotoSans', fontWeight: 400 }),
        Font.load({ fontFamily: 'NotoSans', fontWeight: 700 }),
      ])
    }
  } catch {
    // Preload is best-effort; the real build reports its own errors.
  }
}
