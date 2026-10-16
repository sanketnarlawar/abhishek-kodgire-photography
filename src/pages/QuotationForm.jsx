import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import PageHeader from '../components/PageHeader'
import LineItemsEditor from '../components/LineItemsEditor'
import SelectWithOther from '../components/SelectWithOther'
import ClientFormModal from '../components/ClientFormModal'
import { PageLoader } from '../components/Loaders'
import { useToast } from '../contexts/ToastContext'
import { useUnsavedGuard } from '../lib/useUnsavedGuard'
import { EVENT_TYPES, QUOTATION_STATUSES, formatCurrency } from '../lib/format'

const today = () => new Date().toISOString().slice(0, 10)

async function generateNumber(prefix) {
  const year = new Date().getFullYear()
  const { count } = await supabase
    .from('quotations')
    .select('*', { count: 'exact', head: true })
    .like('quotation_number', `${prefix}-${year}-%`)
  const next = String((count || 0) + 1).padStart(3, '0')
  return `${prefix}-${year}-${next}`
}

export default function QuotationForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEdit = Boolean(id)
  const { notify } = useToast()

  const [clients, setClients] = useState([])
  const [packages, setPackages] = useState([])
  const [selectedPackage, setSelectedPackage] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [clientModalOpen, setClientModalOpen] = useState(false)

  const baselineRef = useRef(null)
  const [dirty, setDirty] = useState(false)
  const releaseGuard = useUnsavedGuard(dirty)

  const [form, setForm] = useState({
    quotation_number: '',
    client_id: '',
    event_type: 'Wedding',
    event_date: '',
    issue_date: today(),
    valid_until: '',
    items: [],
    discount: 0,
    notes: '',
    status: 'Draft',
  })

  useEffect(() => {
    const init = async () => {
      const [{ data: clientData }, { data: pkgData }, { data: profile }] = await Promise.all([
        supabase.from('clients').select('id, name').order('name'),
        supabase.from('packages').select('*').order('name'),
        supabase.from('business_profile').select('quotation_prefix').limit(1).maybeSingle(),
      ])
      setClients(clientData || [])
      setPackages(pkgData || [])
      const prefix = profile?.quotation_prefix || 'QT'

      if (isEdit) {
        const { data } = await supabase.from('quotations').select('*').eq('id', id).single()
        if (data) {
          setForm({
            quotation_number: data.quotation_number,
            client_id: data.client_id || '',
            event_type: data.event_type || 'Wedding',
            event_date: data.event_date || '',
            issue_date: data.issue_date || today(),
            valid_until: data.valid_until || '',
            items: data.items || [],
            discount: data.discount || 0,
            notes: data.notes || '',
            status: data.status || 'Draft',
          })
        }
      } else {
        const number = await generateNumber(prefix)
        setForm((f) => ({ ...f, quotation_number: number }))
      }
      setLoading(false)
    }
    init()
  }, [id, isEdit])

  const subtotal = useMemo(
    () => form.items.reduce((sum, it) => sum + (Number(it.quantity) || 0) * (Number(it.rate) || 0), 0),
    [form.items]
  )
  const total = Math.max(0, subtotal - (Number(form.discount) || 0))

  useEffect(() => {
    if (!loading && baselineRef.current === null) baselineRef.current = JSON.stringify(form)
  }, [loading, form])
  useEffect(() => {
    if (baselineRef.current !== null) setDirty(JSON.stringify(form) !== baselineRef.current)
  }, [form])

  const addPackage = () => {
    const pkg = packages.find((p) => p.id === selectedPackage)
    if (!pkg) return
    setForm((f) => ({
      ...f,
      event_type: pkg.event_type || f.event_type,
      items: [...f.items, ...(pkg.items || [])],
    }))
    setSelectedPackage('')
  }

  const save = async (e) => {
    e.preventDefault()
    if (!form.client_id) {
      notify('Please select a client.', 'error')
      return
    }
    if (form.items.filter((it) => it.description.trim() && Number(it.rate) > 0).length === 0) {
      notify('Add at least one service with a rate.', 'error')
      return
    }
    setSaving(true)
    const payload = {
      quotation_number: form.quotation_number,
      client_id: form.client_id,
      event_type: form.event_type,
      event_date: form.event_date || null,
      issue_date: form.issue_date,
      valid_until: form.valid_until || null,
      items: form.items,
      discount: Number(form.discount) || 0,
      subtotal,
      total,
      notes: form.notes,
      status: form.status,
    }
    if (isEdit) {
      await supabase.from('quotations').update(payload).eq('id', id)
    } else {
      await supabase.from('quotations').insert(payload)
    }
    setDirty(false)
    baselineRef.current = JSON.stringify(form)
    releaseGuard()
    setSaving(false)
    notify(isEdit ? 'Quotation updated' : 'Quotation created')
    navigate('/quotations')
  }

  if (loading) return <PageLoader />

  return (
    <div className="max-w-3xl">
      <PageHeader
        title={isEdit ? 'Edit Quotation' : 'New Quotation'}
        subtitle={form.quotation_number}
        action={
          <Link to="/quotations" className="btn-secondary">
            Cancel
          </Link>
        }
      />

      {clients.length === 0 && (
        <div className="card mb-4 text-sm text-amber-700 dark:text-amber-300">
          You have no clients yet. <Link to="/clients" className="font-medium underline">Add a client</Link> first.
        </div>
      )}

      <form onSubmit={save} className="space-y-5">
        <div className="card space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Client *</label>
              <div className="flex gap-2">
                <select
                  required
                  className="input"
                  value={form.client_id}
                  onChange={(e) => setForm({ ...form, client_id: e.target.value })}
                >
                  <option value="">Select client…</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <button type="button" onClick={() => setClientModalOpen(true)} className="btn-secondary shrink-0">
                  + New
                </button>
              </div>
            </div>
            <div>
              <label className="label">Event Type</label>
              <SelectWithOther
                options={EVENT_TYPES}
                value={form.event_type}
                onChange={(v) => setForm({ ...form, event_type: v })}
                placeholder="Enter event type"
                required
              />
            </div>
            <div>
              <label className="label">Event Date</label>
              <input
                type="date"
                className="input"
                value={form.event_date}
                onChange={(e) => setForm({ ...form, event_date: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Valid Until</label>
              <input
                type="date"
                className="input"
                value={form.valid_until}
                onChange={(e) => setForm({ ...form, valid_until: e.target.value })}
              />
            </div>
          </div>
        </div>

        <div className="card space-y-4">
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex-1">
              <label className="label">Quick add from package</label>
              <select
                className="input"
                value={selectedPackage}
                onChange={(e) => setSelectedPackage(e.target.value)}
              >
                <option value="">Choose a package…</option>
                {packages.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({formatCurrency(p.default_price)})
                  </option>
                ))}
              </select>
            </div>
            <button type="button" onClick={addPackage} disabled={!selectedPackage} className="btn-secondary">
              Add to quotation
            </button>
          </div>

          <LineItemsEditor items={form.items} onChange={(items) => setForm({ ...form, items })} />
        </div>

        <div className="card">
          <div className="ml-auto max-w-xs space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Subtotal</span>
              <span className="font-medium">{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-500">Discount</span>
              <input
                type="number"
                min="0"
                className="input w-28 text-right"
                value={form.discount}
                onChange={(e) => setForm({ ...form, discount: Number(e.target.value) })}
              />
            </div>
            <div className="flex justify-between border-t border-gray-200 pt-2 text-base font-bold dark:border-gray-700">
              <span>Total</span>
              <span>{formatCurrency(total)}</span>
            </div>
          </div>
        </div>

        <div className="card grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Status</label>
            <select
              className="input"
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
            >
              {QUOTATION_STATUSES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Notes</label>
            <textarea
              rows={2}
              className="input"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Link to="/quotations" className="btn-secondary">
            Cancel
          </Link>
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? 'Saving…' : 'Save Quotation'}
          </button>
        </div>
      </form>

      <ClientFormModal
        open={clientModalOpen}
        onClose={() => setClientModalOpen(false)}
        onSaved={(client) => {
          if (!client) return
          setClients((list) =>
            [...list, { id: client.id, name: client.name }].sort((a, b) => a.name.localeCompare(b.name))
          )
          setForm((f) => ({ ...f, client_id: client.id }))
        }}
      />
    </div>
  )
}
