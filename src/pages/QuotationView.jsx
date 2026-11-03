import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { pdf } from '@react-pdf/renderer'
import { supabase } from '../lib/supabase'
import PageHeader from '../components/PageHeader'
import QuotationPDF from '../components/QuotationPDF'
import QuotationInvoicePDF, { quotationInvoiceName } from '../components/QuotationInvoicePDF'
import StatusBadge from '../components/StatusBadge'
import { PageLoader } from '../components/Loaders'
import Modal from '../components/Modal'
import DateField from '../components/DateField'
import { TrashIcon } from '../components/icons'
import { useToast } from '../contexts/ToastContext'
import { useConfirm } from '../contexts/ConfirmContext'
import {
  quotationName,
  formatCurrency,
  formatDate,
  normalizeQuotationStatus,
  PAYMENT_MODES,
  QUOTATION_PAYMENT_TYPES,
  QUOTATION_STATUSES,
} from '../lib/format'

const today = () => new Date().toISOString().slice(0, 10)

export default function QuotationView() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { notify } = useToast()
  const confirm = useConfirm()
  const [quotation, setQuotation] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [pdfBlob, setPdfBlob] = useState(null)
  const [pdfUrl, setPdfUrl] = useState('')
  const [pdfError, setPdfError] = useState('')
  const [invBlob, setInvBlob] = useState(null)
  const [invUrl, setInvUrl] = useState('')
  const [previewDoc, setPreviewDoc] = useState('quotation')
  const [busy, setBusy] = useState(false)
  const [payModalOpen, setPayModalOpen] = useState(false)
  const [payForm, setPayForm] = useState({ amount: '', date: today(), mode: 'UPI', type: 'Advance' })
  const [savingPayment, setSavingPayment] = useState(false)

  const payments = quotation?.details?.payments || []
  const status = normalizeQuotationStatus(quotation?.status)
  const isApproved = status === 'Approved'
  const total = Number(quotation?.total) || 0
  const received = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0)
  const balance = Math.max(0, total - received)
  // Keep original indices so a row can be deleted after sorting by date.
  const sortedPayments = payments
    .map((p, index) => ({ ...p, index }))
    .sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')))

  useEffect(() => {
    const load = async () => {
      const [{ data: q }, { data: prof }] = await Promise.all([
        supabase.from('quotations').select('*, client:clients(*)').eq('id', id).single(),
        supabase.from('business_profile').select('*').limit(1).maybeSingle(),
      ])
      setQuotation(q || null)
      setProfile(prof || {})
      setLoading(false)
    }
    load()
  }, [id])

  // Built once the data is loaded; also feeds the preview and the share sheet.
  useEffect(() => {
    if (!quotation || !profile) return
    let cancelled = false
    let url = ''
    setPdfBlob(null)
    setPdfError('')
    pdf(<QuotationPDF profile={profile} quotation={quotation} client={quotation.client || {}} />)
      .toBlob()
      .then((blob) => {
        if (cancelled) return
        url = URL.createObjectURL(blob)
        setPdfBlob(blob)
        setPdfUrl(url)
      })
      .catch((err) => {
        console.error('Quotation PDF failed:', err)
        if (!cancelled) setPdfError('Could not build the PDF preview.')
      })
    return () => {
      cancelled = true
      if (url) URL.revokeObjectURL(url)
    }
  }, [quotation, profile])

  // The invoice is generated from the quotation once it is approved.
  useEffect(() => {
    if (!quotation || !profile || normalizeQuotationStatus(quotation.status) !== 'Approved') {
      setInvBlob(null)
      setInvUrl('')
      setPreviewDoc('quotation')
      return
    }
    let cancelled = false
    let url = ''
    setInvBlob(null)
    pdf(<QuotationInvoicePDF profile={profile} quotation={quotation} client={quotation.client || {}} />)
      .toBlob()
      .then((blob) => {
        if (cancelled) return
        url = URL.createObjectURL(blob)
        setInvBlob(blob)
        setInvUrl(url)
      })
      .catch((err) => console.error('Invoice PDF failed:', err))
    return () => {
      cancelled = true
      if (url) URL.revokeObjectURL(url)
    }
  }, [quotation, profile])

  const fileName = `${quotationName(quotation, quotation?.client)}.pdf`
  const invoiceFileName = `${quotationInvoiceName(quotation, profile, quotation?.client)}.pdf`

  const downloadPdf = () => {
    if (!pdfBlob) return
    const a = document.createElement('a')
    a.href = pdfUrl
    a.download = fileName
    a.click()
    notify('PDF downloaded')
  }

  const downloadInvoice = () => {
    if (!invBlob) return
    const a = document.createElement('a')
    a.href = invUrl
    a.download = invoiceFileName
    a.click()
    notify('Invoice downloaded')
  }

  const sharePdf = async (blob, name) => {
    if (!blob) return
    setBusy(true)
    try {
      const file = new File([blob], name, { type: 'application/pdf' })
      if (!navigator.canShare?.({ files: [file] })) {
        notify('This browser cannot share files. Try Chrome or Edge.', 'error')
        return
      }
      await navigator.share({ files: [file] })
    } catch (err) {
      if (err.name !== 'AbortError') notify(err.message || 'Could not share the PDF', 'error')
    } finally {
      setBusy(false)
    }
  }

  const savePayments = async (nextPayments) => {
    const details = { ...(quotation.details || {}), payments: nextPayments }
    const { error } = await supabase.from('quotations').update({ details }).eq('id', id)
    if (error) {
      notify(error.message || 'Could not save payment', 'error')
      return false
    }
    setQuotation((q) => ({ ...q, details }))
    return true
  }

  const changeStatus = async (next) => {
    if (next === status) return
    const { error } = await supabase.from('quotations').update({ status: next }).eq('id', id)
    if (error) {
      notify(error.message || 'Could not update status', 'error')
      return
    }
    setQuotation((q) => ({ ...q, status: next }))
    notify(`Quotation marked ${next}`)
  }

  const openPayModal = () => {
    if (!isApproved) {
      notify('Approve the quotation before recording payments', 'error')
      return
    }
    setPayForm({
      amount: balance || '',
      date: today(),
      mode: 'UPI',
      type: payments.length === 0 ? 'Advance' : 'Part Payment',
    })
    setPayModalOpen(true)
  }

  const addPayment = async (e) => {
    e.preventDefault()
    const amount = Number(payForm.amount) || 0
    if (amount <= 0) {
      notify('Enter an amount greater than 0', 'error')
      return
    }
    if (amount > balance) {
      notify(`Amount cannot be more than the balance (${formatCurrency(balance)})`, 'error')
      return
    }
    setSavingPayment(true)
    const ok = await savePayments([...payments, { date: payForm.date, mode: payForm.mode, amount, type: payForm.type }])
    setSavingPayment(false)
    if (ok) {
      setPayModalOpen(false)
      notify('Payment recorded')
    }
  }

  const removePayment = async (p) => {
    const ok = await confirm({
      title: 'Delete payment?',
      message: `${formatCurrency(p.amount)} payment will be removed.`,
      confirmText: 'Delete',
    })
    if (!ok) return
    if (await savePayments(payments.filter((_, i) => i !== p.index))) notify('Payment deleted')
  }

  const remove = async () => {
    const ok = await confirm({
      title: 'Delete quotation?',
      message: `${quotationName(quotation, quotation.client)} will be permanently removed.`,
      confirmText: 'Delete',
    })
    if (!ok) return
    await supabase.from('quotations').delete().eq('id', id)
    notify('Quotation deleted')
    navigate('/quotations')
  }

  if (loading) return <PageLoader />
  if (!quotation) return <div className="card text-center text-gray-500">Quotation not found.</div>

  return (
    <div>
      <PageHeader
        backTo="/quotations"
        title={quotationName(quotation, quotation.client)}
        subtitle={<StatusBadge status={status} />}
        action={
          <div className="flex w-full flex-wrap items-center gap-2">
            <div
              role="group"
              aria-label="Quotation status"
              className="inline-flex rounded-lg border border-gray-300 bg-white p-0.5 text-sm font-medium dark:border-gray-600 dark:bg-gray-800"
            >
              {QUOTATION_STATUSES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => changeStatus(s)}
                  aria-pressed={status === s}
                  className={`rounded-md px-3 py-1.5 transition ${
                    status === s
                      ? s === 'Approved'
                        ? 'bg-green-600 text-white shadow-sm'
                        : 'bg-gray-700 text-white shadow-sm dark:bg-gray-500'
                      : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
            <Link to={`/quotations/${id}/edit`} className="btn-secondary">
              Edit
            </Link>
            <button onClick={downloadPdf} disabled={!pdfBlob} className="btn-secondary">
              {pdfBlob ? 'Download Quotation' : 'Preparing PDF…'}
            </button>
            <button onClick={() => sharePdf(pdfBlob, fileName)} disabled={busy || !pdfBlob} className="btn-secondary">
              Send Quotation on WhatsApp
            </button>
            {isApproved && (
              <>
                <button onClick={downloadInvoice} disabled={!invBlob} className="btn-secondary">
                  {invBlob ? 'Download Invoice' : 'Preparing Invoice…'}
                </button>
                <button
                  onClick={() => sharePdf(invBlob, invoiceFileName)}
                  disabled={busy || !invBlob}
                  className="btn-secondary"
                >
                  Send Invoice on WhatsApp
                </button>
              </>
            )}
            <button onClick={remove} className="btn-danger">
              Delete
            </button>
          </div>
        }
      />

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="card max-w-4xl p-2">
          {isApproved && (
            <div className="mb-2 inline-flex rounded-lg border border-gray-300 p-0.5 text-sm font-medium dark:border-gray-600">
              {[
                ['quotation', 'Quotation'],
                ['invoice', 'Invoice'],
              ].map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setPreviewDoc(key)}
                  aria-pressed={previewDoc === key}
                  className={`rounded-md px-3 py-1 transition ${
                    previewDoc === key
                      ? 'bg-brand-600 text-white shadow-sm'
                      : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
          {pdfError ? (
            <p className="p-6 text-center text-sm text-red-600">{pdfError}</p>
          ) : previewDoc === 'invoice' && isApproved ? (
            invUrl && invBlob ? (
              <iframe title="Invoice preview" src={`${invUrl}#toolbar=0&navpanes=0&view=FitH`} className="h-[80vh] w-full rounded" />
            ) : (
              <p className="p-6 text-center text-sm text-gray-500">Preparing invoice preview…</p>
            )
          ) : pdfUrl && pdfBlob ? (
            <iframe title="Quotation preview" src={`${pdfUrl}#toolbar=0&navpanes=0&view=FitH`} className="h-[80vh] w-full rounded" />
          ) : (
            <p className="p-6 text-center text-sm text-gray-500">Preparing PDF preview…</p>
          )}
        </div>

        {/* Payments received */}
        <div className="card">
          <div className="flex items-center justify-between border-b border-gray-200 pb-3 dark:border-gray-700">
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Payments received</h3>
            <button onClick={openPayModal} disabled={!isApproved || balance <= 0} className="btn-primary">
              Record payment
            </button>
          </div>

          {!isApproved && (
            <p className="mt-3 rounded-lg bg-amber-50 p-2 text-xs text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
              Mark this quotation as Approved to start recording payments.
            </p>
          )}

          <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
            <div className="rounded-lg bg-gray-50 p-2 dark:bg-gray-700/50">
              <p className="text-gray-500">Total</p>
              <p className="font-semibold">{formatCurrency(total)}</p>
            </div>
            <div className="rounded-lg bg-green-50 p-2 dark:bg-green-900/20">
              <p className="text-gray-500">Received</p>
              <p className="font-semibold text-green-600">{formatCurrency(received)}</p>
            </div>
            <div className="rounded-lg bg-red-50 p-2 dark:bg-red-900/20">
              <p className="text-gray-500">Balance</p>
              <p className="font-semibold text-red-600">{formatCurrency(balance)}</p>
            </div>
          </div>

          {sortedPayments.length === 0 ? (
            <p className="py-4 text-center text-sm text-gray-400">No payments recorded yet.</p>
          ) : (
            <ul className="mt-3 divide-y divide-gray-100 dark:divide-gray-700/50">
              {sortedPayments.map((p) => (
                <li key={p.index} className="flex items-center justify-between gap-2 py-2 text-sm">
                  <div>
                    <p className="font-medium text-green-600">{formatCurrency(p.amount)}</p>
                    <p className="text-xs text-gray-500">
                      {formatDate(p.date)} · {p.mode || '—'}
                      {p.type ? ` · ${p.type}` : ''}
                    </p>
                  </div>
                  <button
                    onClick={() => removePayment(p)}
                    className="text-gray-400 hover:text-red-600"
                    title="Delete payment"
                  >
                    <TrashIcon width={16} height={16} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <Modal open={payModalOpen} onClose={() => setPayModalOpen(false)} title="Record payment" size="sm">
        <form onSubmit={addPayment} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">
              Amount (balance {formatCurrency(balance)})
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={payForm.amount}
              onChange={(e) => {
                const val = e.target.value
                if (val === '' || /^\d*\.?\d*$/.test(val)) setPayForm((f) => ({ ...f, amount: val }))
              }}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">Received on</label>
            <DateField
              value={payForm.date}
              onChange={(val) => setPayForm((f) => ({ ...f, date: val }))}
              ariaLabel="Payment date"
              className="w-full"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">Mode</label>
              <select
                value={payForm.mode}
                onChange={(e) => setPayForm((f) => ({ ...f, mode: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800"
              >
                {PAYMENT_MODES.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">Payment type</label>
              <select
                value={payForm.type}
                onChange={(e) => setPayForm((f) => ({ ...f, type: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800"
              >
                {QUOTATION_PAYMENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setPayModalOpen(false)} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={savingPayment} className="btn-primary">
              {savingPayment ? 'Saving…' : 'Save payment'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
