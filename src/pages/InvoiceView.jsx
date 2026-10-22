import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom'
import QRCode from 'qrcode'
import { pdf } from '@react-pdf/renderer'
import { supabase } from '../lib/supabase'
import PageHeader from '../components/PageHeader'
import Modal from '../components/Modal'
import UpiQr from '../components/UpiQr'
import InvoicePDF from '../components/InvoicePDF'
import StatusBadge from '../components/StatusBadge'
import { PageLoader } from '../components/Loaders'
import { useToast } from '../contexts/ToastContext'
import { useConfirm } from '../contexts/ConfirmContext'
import { TrashIcon } from '../components/icons'
import { buildInvoiceWhatsAppUrl } from '../lib/whatsapp'
import {
  formatCurrency,
  formatDate,
  formatTime,
  buildUpiUri,
  INVOICE_STATUSES,
  PAYMENT_MODES,
} from '../lib/format'

const today = () => new Date().toISOString().slice(0, 10)

export default function InvoiceView() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { notify } = useToast()
  const confirm = useConfirm()
  const [showWhatsAppPrompt, setShowWhatsAppPrompt] = useState(Boolean(location.state?.sendWhatsApp))
  const [invoice, setInvoice] = useState(null)
  const [client, setClient] = useState(null)
  const [profile, setProfile] = useState(null)
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [payModalOpen, setPayModalOpen] = useState(false)
  const [payForm, setPayForm] = useState({ amount: 0, payment_date: today(), mode: 'UPI', note: '' })
  const [downloading, setDownloading] = useState(false)
  const [pdfBlob, setPdfBlob] = useState(null)

  const load = async () => {
    const { data: inv } = await supabase
      .from('invoices')
      .select('*, client:clients(*)')
      .eq('id', id)
      .single()
    if (!inv) {
      setLoading(false)
      return
    }
    setInvoice(inv)
    setClient(inv.client)
    const [{ data: prof }, { data: pays }] = await Promise.all([
      supabase.from('business_profile').select('*').limit(1).maybeSingle(),
      supabase.from('payments').select('*').eq('invoice_id', id).order('payment_date'),
    ])
    setProfile(prof || {})
    setPayments(pays || [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [id])

  // Clear the hand-off flag so a refresh doesn't show the prompt again.
  useEffect(() => {
    if (location.state?.sendWhatsApp) navigate(location.pathname, { replace: true, state: null })
  }, [])

  const paid = useMemo(
    () => payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0),
    [payments]
  )
  const balance = invoice ? Math.max(0, (invoice.total || 0) - paid) : 0

  const upiUri = invoice && profile
    ? buildUpiUri({
      upiId: profile.upi_id,
      payeeName: profile.upi_payee_name || profile.studio_name,
      amount: balance || invoice.total,
      note: invoice.invoice_number,
    })
    : ''

  const syncStatus = async (nextPaid) => {
    let status = 'Unpaid'
    if (nextPaid >= (invoice.total || 0) && invoice.total > 0) status = 'Paid'
    else if (nextPaid > 0) status = 'Partially Paid'
    if (status !== invoice.status) {
      await supabase.from('invoices').update({ status }).eq('id', id)
      setInvoice((inv) => ({ ...inv, status }))
    }
  }

  const addPayment = async (e) => {
    e.preventDefault()
    const amount = Number(payForm.amount) || 0
    if (amount <= 0) return
    await supabase.from('payments').insert({ ...payForm, amount, invoice_id: id })
    setPayModalOpen(false)
    setPayForm({ amount: 0, payment_date: today(), mode: 'UPI', note: '' })
    await syncStatus(paid + amount)
    const { data: pays } = await supabase.from('payments').select('*').eq('invoice_id', id).order('payment_date')
    setPayments(pays || [])
    notify('Payment recorded')
  }

  const removePayment = async (p) => {
    const ok = await confirm({
      title: 'Delete payment?',
      message: `${formatCurrency(p.amount)} payment will be removed.`,
      confirmText: 'Delete',
    })
    if (!ok) return
    await supabase.from('payments').delete().eq('id', p.id)
    await syncStatus(paid - (Number(p.amount) || 0))
    setPayments((list) => list.filter((x) => x.id !== p.id))
    notify('Payment deleted')
  }

  const setStatus = async (status) => {
    // Marking Paid records a payment for the outstanding balance so the
    // dashboard "Received" and reports stay accurate.
    if (status === 'Paid' && balance > 0) {
      await supabase.from('payments').insert({
        invoice_id: id,
        amount: balance,
        payment_date: today(),
        mode: 'Cash',
        note: 'Marked as paid',
      })
      const { data: pays } = await supabase.from('payments').select('*').eq('invoice_id', id).order('payment_date')
      setPayments(pays || [])
    }
    await supabase.from('invoices').update({ status }).eq('id', id)
    setInvoice((inv) => ({ ...inv, status }))
    notify(`Status set to ${status}`)
  }

  const deleteInvoice = async () => {
    const ok = await confirm({
      title: 'Delete invoice?',
      message: `${invoice.invoice_number} and its payments will be permanently deleted.`,
      confirmText: 'Delete',
    })
    if (!ok) return
    await supabase.from('payments').delete().eq('invoice_id', id)
    await supabase.from('invoices').delete().eq('id', id)
    notify('Invoice deleted')
    navigate('/invoices')
  }

  const buildPdfBlob = async () => {
    let qrDataUrl = ''
    if (upiUri) {
      try {
        qrDataUrl = await QRCode.toDataURL(upiUri, { width: 180, margin: 1 })
      } catch {
        qrDataUrl = ''
      }
    }
    return pdf(
      <InvoicePDF profile={profile} invoice={invoice} client={client} qrDataUrl={qrDataUrl} payments={payments} />
    ).toBlob()
  }

  const saveBlob = (blob) => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${invoice.invoice_number}.pdf`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Built ahead of the click: browsers only allow the share sheet shortly after a click.
  useEffect(() => {
    if (!invoice || !profile) return
    let cancelled = false
    setPdfBlob(null)
    buildPdfBlob()
      .then((blob) => {
        if (!cancelled) setPdfBlob(blob)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [invoice, client, profile, payments, upiUri])

  const downloadPdf = async () => {
    setDownloading(true)
    try {
      saveBlob(await buildPdfBlob())
      notify('PDF downloaded')
    } finally {
      setDownloading(false)
    }
  }

  const shareWhatsApp = async () => {
    setShowWhatsAppPrompt(false)
    setDownloading(true)

    try {
      const blob = pdfBlob || (await buildPdfBlob())
      const file = new File([blob], `${invoice.invoice_number}.pdf`, { type: 'application/pdf' })

      if (!navigator.canShare?.({ files: [file] })) {
        notify('This browser cannot share files. Try Chrome or Edge.', 'error')
        return
      }
      await navigator.share({ files: [file] })
    } catch (err) {
      if (err.name !== 'AbortError') notify(err.message || 'Could not share the invoice PDF', 'error')
    } finally {
      setDownloading(false)
    }
  }

  // wa.me opens a chat with any number, saved in contacts or not.
  const sendWhatsAppText = () => {
    const url = buildInvoiceWhatsAppUrl({
      phone: invoice.phone || client?.phone,
      profile,
      client: { ...client, phone: invoice.phone || client?.phone },
      invoice,
      paid,
      paymentMode: payments[payments.length - 1]?.mode,
    })
    if (!url) {
      notify('Add a valid customer phone number first.', 'error')
      return
    }
    window.open(url, '_blank', 'noopener')
  }

  if (loading) return <PageLoader />
  if (!invoice) return <div className="card text-center text-gray-500">Invoice not found.</div>

  return (
    <div>
      <PageHeader
        backTo="/invoices"
        title={invoice.invoice_number}
        subtitle={<StatusBadge status={invoice.status} />}
        action={
          <div className="flex flex-wrap gap-2">
            <Link to={`/invoices/${id}/edit`} className="btn-secondary">
              Edit
            </Link>
            <button onClick={downloadPdf} disabled={downloading} className="btn-secondary">
              {downloading ? 'Preparing…' : 'Download PDF'}
            </button>
            <button onClick={shareWhatsApp} disabled={downloading || !pdfBlob} className="btn-secondary">
              {pdfBlob ? 'Send on WhatsApp' : 'Preparing PDF…'}
            </button>
            <button onClick={sendWhatsAppText} className="btn-secondary">
              WhatsApp Message
            </button>
            <button onClick={deleteInvoice} className="btn-danger">
              Delete
            </button>
          </div>
        }
      />


      {showWhatsAppPrompt && (
        <div className="mb-4 flex max-w-3xl flex-wrap items-center justify-between gap-3 rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200">
          <span>Invoice saved. Send it to {client?.name || 'the customer'} on WhatsApp?</span>
          <div className="flex gap-2">
            <button onClick={shareWhatsApp} disabled={downloading || !pdfBlob} className="btn-primary">
              {pdfBlob ? 'Send on WhatsApp' : 'Preparing PDF…'}
            </button>
            <button onClick={() => setShowWhatsAppPrompt(false)} className="btn-secondary">
              Not now
            </button>
          </div>
        </div>
      )}

      <div className="max-w-3xl">
        <div className="card">
          <div className="flex items-start justify-between border-b border-gray-200 pb-4 dark:border-gray-700">
            <div className="flex items-center gap-3">
              {profile?.logo_url && (
                <img src={profile.logo_url} alt="Logo" className="h-14 w-14 object-contain" />
              )}
              <div>
                <h2 className="text-lg font-bold">{profile?.studio_name || 'Your Studio Name'}</h2>
                {profile?.address && <p className="text-xs text-gray-500">{profile.address}</p>}
                {profile?.phone && <p className="text-xs text-gray-500">Ph: {profile.phone}</p>}
              </div>
            </div>
            <div className="text-right">
              <p className="text-xl font-bold text-brand-600">INVOICE</p>
              <p className="text-sm font-medium">{invoice.invoice_number}</p>
              <p className="text-xs text-gray-500">Date: {formatDate(invoice.issue_date)}</p>
              {invoice.created_at && (
                <p className="text-xs text-gray-500">Time: {formatTime(invoice.created_at)}</p>
              )}
            </div>
          </div>

          <div className="flex justify-between py-4">
            <div>
              <p className="text-xs font-semibold uppercase text-gray-400">Bill To</p>
              <p className="font-medium">{client?.name}</p>
              {client?.phone && <p className="text-sm text-gray-500">{client.phone}</p>}
              {client?.address && <p className="text-sm text-gray-500">{client.address}</p>}
            </div>
            <div className="text-right">
              <p className="text-xs font-semibold uppercase text-gray-400">Event</p>
              <p className="font-medium">{invoice.event_type}</p>
              <p className="text-sm text-gray-500">Event Date: {formatDate(invoice.event_date)}</p>
            </div>
          </div>

          <table className="w-full text-sm">
            <thead className="border-y border-gray-200 text-left dark:border-gray-700">
              <tr>
                <th className="py-2">Service</th>
                <th className="py-2 text-center">Qty</th>
                <th className="py-2 text-right">Rate</th>
                <th className="py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {(invoice.items || []).map((it, i) => (
                <tr key={i} className="border-b border-gray-100 dark:border-gray-700/50">
                  <td className="py-2">{it.description}</td>
                  <td className="py-2 text-center">{it.quantity}</td>
                  <td className="py-2 text-right">{formatCurrency(it.rate)}</td>
                  <td className="py-2 text-right">{formatCurrency((it.quantity || 0) * (it.rate || 0))}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="ml-auto mt-4 max-w-xs space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Subtotal</span>
              <span>{formatCurrency(invoice.subtotal)}</span>
            </div>
            {invoice.discount > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-500">Discount</span>
                <span>- {formatCurrency(invoice.discount)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-gray-200 pt-1 text-base font-bold dark:border-gray-700">
              <span>Total</span>
              <span>{formatCurrency(invoice.total)}</span>
            </div>
            {paid > 0 && (
              <>
                <div className="flex justify-between text-green-600">
                  <span>Paid</span>
                  <span>{formatCurrency(paid)}</span>
                </div>
                <div className="flex justify-between font-semibold">
                  <span>Balance</span>
                  <span>{formatCurrency(balance)}</span>
                </div>
              </>
            )}
          </div>

          {(profile?.terms || invoice.notes) && (
            <div className="mt-4 border-t border-gray-200 pt-3 text-sm dark:border-gray-700">
              <p className="font-semibold text-gray-900 dark:text-gray-100">Terms & Conditions</p>
              <p className="mt-1 whitespace-pre-line text-xs leading-relaxed text-gray-500 dark:text-gray-400">
                {profile?.terms || invoice.notes}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
