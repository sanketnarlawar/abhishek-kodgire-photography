import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { pdf } from '@react-pdf/renderer'
import { supabase } from '../lib/supabase'
import PageHeader from '../components/PageHeader'
import QuotationPDF from '../components/QuotationPDF'
import StatusBadge from '../components/StatusBadge'
import { PageLoader } from '../components/Loaders'
import { useToast } from '../contexts/ToastContext'
import { useConfirm } from '../contexts/ConfirmContext'
import { quotationName } from '../lib/format'

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
  const [busy, setBusy] = useState(false)

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

  const fileName = `${quotationName(quotation, quotation?.client)}.pdf`

  const downloadPdf = () => {
    if (!pdfBlob) return
    const a = document.createElement('a')
    a.href = pdfUrl
    a.download = fileName
    a.click()
    notify('PDF downloaded')
  }

  const shareWhatsApp = async () => {
    if (!pdfBlob) return
    setBusy(true)
    try {
      const file = new File([pdfBlob], fileName, { type: 'application/pdf' })
      if (!navigator.canShare?.({ files: [file] })) {
        notify('This browser cannot share files. Try Chrome or Edge.', 'error')
        return
      }
      await navigator.share({ files: [file] })
    } catch (err) {
      if (err.name !== 'AbortError') notify(err.message || 'Could not share the quotation PDF', 'error')
    } finally {
      setBusy(false)
    }
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
        subtitle={<StatusBadge status={quotation.status} />}
        action={
          <div className="flex flex-wrap gap-2">
            <Link to={`/quotations/${id}/edit`} className="btn-secondary">
              Edit
            </Link>
            <button onClick={downloadPdf} disabled={!pdfBlob} className="btn-secondary">
              {pdfBlob ? 'Download PDF' : 'Preparing PDF…'}
            </button>
            <button onClick={shareWhatsApp} disabled={busy || !pdfBlob} className="btn-secondary">
              Send on WhatsApp
            </button>
            <button onClick={() => navigate(`/invoices/new?fromQuotation=${id}`)} className="btn-secondary">
              Convert to Invoice
            </button>
            <button onClick={remove} className="btn-danger">
              Delete
            </button>
          </div>
        }
      />

      <div className="card max-w-4xl p-2">
        {pdfError ? (
          <p className="p-6 text-center text-sm text-red-600">{pdfError}</p>
        ) : pdfUrl && pdfBlob ? (
          <iframe title="Quotation preview" src={`${pdfUrl}#toolbar=0&navpanes=0&view=FitH`} className="h-[80vh] w-full rounded" />
        ) : (
          <p className="p-6 text-center text-sm text-gray-500">Preparing PDF preview…</p>
        )}
      </div>
    </div>
  )
}
