import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import RowsEditor from '../components/RowsEditor'
import SelectWithOther from '../components/SelectWithOther'
import ClientFormModal from '../components/ClientFormModal'
import CustomerCombobox from '../components/CustomerCombobox'
import ItemCombobox from '../components/ItemCombobox'
import { PageLoader } from '../components/Loaders'
import { ArrowLeftIcon, PlusIcon, TrashIcon } from '../components/icons'
import { useToast } from '../contexts/ToastContext'
import { useUnsavedGuard } from '../lib/useUnsavedGuard'
import {
  EVENT_TYPES,
  QUOTATION_STATUSES,
  PAYMENT_MODES,
  DELIVERY_STATUSES,
  DEFAULT_DELIVERY_WORKFLOW,
  DELIVERY_WORKFLOW_OPTIONS,
  amountInWords,
} from '../lib/format'

const today = () => new Date().toISOString().slice(0, 10)

const DEFAULT_SERVICES = [
  'Traditional Photography',
  'Traditional Videography',
  'Candid Photography',
  'Cinematography',
  'Drone Coverage',
]

const emptyService = () => ({ description: '' })

// Case-insensitive de-dupe that keeps the first spelling.
const uniqueNames = (names) => {
  const seen = new Set()
  return names.filter((n) => {
    const key = n.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

const SCHEDULE_COLUMNS = [
  { key: 'date', label: 'Date', type: 'date', width: 'w-40' },
  { key: 'event', label: 'Event', placeholder: 'e.g. Wedding' },
  { key: 'coverage', label: 'Coverage', placeholder: 'e.g. Photography & Videography' },
  { key: 'location', label: 'Location', placeholder: 'e.g. Mangal Karyalay' },
]

const PAYMENT_TYPES = ['Advance', 'Part Payment', 'Final Payment']

const PAYMENT_COLUMNS = [
  { key: 'date', label: 'Date', type: 'date', width: 'w-40' },
  { key: 'mode', label: 'Mode', type: 'select', options: PAYMENT_MODES, width: 'w-40' },
  { key: 'amount', label: 'Amount (₹)', type: 'amount', width: 'w-36' },
  { key: 'type', label: 'Payment Type', type: 'select', options: PAYMENT_TYPES, blank: true, blankLabel: 'Select type', width: 'w-40' },
]

const CLIENT_STATUSES = ['Pending', 'Delivered']

const deliveryColumns = (workflowOptions) => [
  { key: 'workflow', label: 'Workflow', type: 'combo', options: workflowOptions, placeholder: 'Select or type a step' },
  { key: 'status', label: 'Status', type: 'select', options: DELIVERY_STATUSES, width: 'w-52' },
  { key: 'link', label: 'Link / Reference', placeholder: 'https://…' },
  { key: 'client_status', label: 'Client Status', type: 'select', options: CLIENT_STATUSES, blank: true, width: 'w-36' },
]

const DEFAULT_TERMS = [
  'Album designing will begin after full payment is completed.',
  'Album printing will start only after customer approval of the album design.',
  'Delivery timelines may vary depending on the event schedule and customer approvals.',
  'Any additional work or extra album pages will be charged separately.',
  'Original files/raw data will not be provided unless agreed in writing.',
  'NT Album per sheet ₹200 size 12 x 36',
  'NT album cover pad matt ₹1000',
].join('\n')

const splitLines = (text) =>
  (text || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)

const standardWorkflow = () =>
  DEFAULT_DELIVERY_WORKFLOW.map((workflow) => ({ workflow, status: 'Pending', link: '', client_status: 'Pending' }))

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
  const [customerName, setCustomerName] = useState('')
  const [packages, setPackages] = useState([])
  const [selectedPackage, setSelectedPackage] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [clientModalOpen, setClientModalOpen] = useState(false)
  const [savedServices, setSavedServices] = useState([])
  const [savedWorkflows, setSavedWorkflows] = useState([])

  const baselineRef = useRef(null)
  const [dirty, setDirty] = useState(false)
  const releaseGuard = useUnsavedGuard(dirty)

  const [form, setForm] = useState({
    quotation_number: '',
    client_id: '',
    phone: '',
    billing_address: '',
    event_type: 'Wedding',
    event_date: '',
    issue_date: today(),
    items: [emptyService(), emptyService(), emptyService()],
    total: '',
    notes: '',
    status: 'Draft',
    package_title: '',
    deliverables: '',
    schedule: [],
    payments: [],
    delivery: [],
  })

  useEffect(() => {
    const init = async () => {
      const [{ data: clientData }, { data: pkgData }, { data: profile }] = await Promise.all([
        supabase.from('clients').select('*').order('name'),
        supabase.from('packages').select('*').order('name'),
        supabase.from('business_profile').select('quotation_prefix').limit(1).maybeSingle(),
      ])
      setClients(clientData || [])
      setPackages(pkgData || [])
      const prefix = profile?.quotation_prefix || 'QT'

      if (isEdit) {
        const { data } = await supabase.from('quotations').select('*').eq('id', id).single()
        if (data) {
          const clientObj = (clientData || []).find((c) => c.id === data.client_id)
          setCustomerName(clientObj?.name || '')
          const details = data.details || {}
          setForm({
            quotation_number: data.quotation_number,
            client_id: data.client_id || '',
            phone: details.phone || clientObj?.phone || '',
            billing_address: details.billing_address || clientObj?.address || '',
            event_type: data.event_type || 'Wedding',
            event_date: data.event_date || '',
            issue_date: data.issue_date || today(),
            items: [
              ...(data.items || []).map((it) => ({ description: it.description || '' })),
              ...Array(Math.max(0, 3 - (data.items || []).length)).fill(null).map(emptyService),
            ],
            total: data.total || '',
            notes: data.notes || '',
            status: data.status || 'Draft',
            package_title: details.package_title || '',
            deliverables: (details.deliverables || []).join('\n'),
            schedule: details.schedule || [],
            payments: (details.payments || []).map((p) => ({
              ...p,
              type: p.type || (p.advance ? 'Advance' : ''),
            })),
            delivery: details.delivery || [],
          })
        }
      } else {
        const number = await generateNumber(prefix)
        setForm((f) => ({ ...f, quotation_number: number, notes: DEFAULT_TERMS, delivery: standardWorkflow() }))
      }
      // Services and workflow steps typed on earlier quotations become dropdown suggestions.
      supabase
        .from('quotations')
        .select('details, items')
        .order('created_at', { ascending: false })
        .limit(200)
        .then(({ data }) => {
          setSavedWorkflows(
            (data || []).flatMap((q) => (q.details?.delivery || []).map((d) => d.workflow?.trim()).filter(Boolean))
          )
          setSavedServices(
            (data || []).flatMap((q) => (q.items || []).map((it) => it.description?.trim()).filter(Boolean))
          )
        })
      setLoading(false)
    }
    init()
  }, [id, isEdit])

  const total = Number(form.total) || 0

  const workflowOptions = useMemo(
    () => uniqueNames([...DELIVERY_WORKFLOW_OPTIONS, ...savedWorkflows]),
    [savedWorkflows]
  )
  const serviceOptions = useMemo(() => uniqueNames([...DEFAULT_SERVICES, ...savedServices]), [savedServices])
  useEffect(() => {
    if (!loading && baselineRef.current === null) baselineRef.current = JSON.stringify(form)
  }, [loading, form])
  useEffect(() => {
    if (baselineRef.current !== null) setDirty(JSON.stringify(form) !== baselineRef.current)
  }, [form])

  const handleBack = () => {
    if (window.history.state && window.history.state.idx > 0) navigate(-1)
    else navigate('/quotations')
  }

  const handleClientSelect = (client) => {
    setCustomerName(client.name || '')
    setForm((f) => ({
      ...f,
      client_id: client.id,
      phone: client.phone || f.phone,
      billing_address: client.address || f.billing_address,
    }))
  }

  const handleNameChange = (name, forceNew = false) => {
    setCustomerName(name)
    const matched =
      !forceNew && name.trim()
        ? clients.find((c) => c.name?.trim().toLowerCase() === name.trim().toLowerCase())
        : null
    setForm((f) => ({
      ...f,
      client_id: matched ? matched.id : '',
      phone: matched ? matched.phone || f.phone : f.phone,
      billing_address: matched ? matched.address || f.billing_address : f.billing_address,
    }))
  }

  const handleClearCustomer = () => {
    setCustomerName('')
    setForm((f) => ({ ...f, client_id: '', phone: '', billing_address: '' }))
  }

  const updateService = (index, description) =>
    setForm((f) => ({ ...f, items: f.items.map((row, i) => (i === index ? { description } : row)) }))

  const addRow = () => setForm((f) => ({ ...f, items: [...f.items, emptyService()] }))

  const removeRow = (index) =>
    setForm((f) => ({
      ...f,
      items: f.items.length <= 1 ? [emptyService()] : f.items.filter((_, i) => i !== index),
    }))

  const addPackage = () => {
    const pkg = packages.find((p) => p.id === selectedPackage)
    if (!pkg) return
    const added = (pkg.items || []).map((it) => ({ description: it.description || '' })).filter((it) => it.description)
    setForm((f) => ({
      ...f,
      event_type: pkg.event_type || f.event_type,
      items: [...f.items.filter((it) => it.description.trim()), ...added, emptyService()],
    }))
    setSelectedPackage('')
  }

  const save = async (e) => {
    e.preventDefault()
    const trimmed = customerName.trim()
    const phone = form.phone.trim()
    const effectiveName = trimmed || phone
    if (!form.client_id && !effectiveName) {
      notify('Please enter a Customer / Party name or phone number.', 'error')
      return
    }
    const activeItems = form.items
      .map((it) => ({ description: it.description.trim() }))
      .filter((it) => it.description)
    if (activeItems.length === 0) {
      notify('Add at least one service.', 'error')
      return
    }
    if (total <= 0) {
      notify('Enter the total package amount.', 'error')
      return
    }
    setSaving(true)
    try {
      let finalClientId = form.client_id
      if (!finalClientId && effectiveName) {
        const existing = clients.find(
          (c) =>
            c.name?.trim().toLowerCase() === effectiveName.toLowerCase() ||
            (!trimmed && phone && (c.phone || '').replace(/\D/g, '') === phone.replace(/\D/g, ''))
        )
        if (existing) {
          finalClientId = existing.id
        } else {
          const { data: newClient, error: clientErr } = await supabase
            .from('clients')
            .insert({
              name: effectiveName,
              phone: phone || null,
              address: form.billing_address.trim() || null,
            })
            .select()
            .single()
          if (clientErr) throw new Error(`Could not add customer: ${clientErr.message}`)
          finalClientId = newClient.id
          setClients((prev) => [...prev, newClient])
        }
      }

      const earliestScheduled = form.schedule
        .map((r) => r.date)
        .filter(Boolean)
        .sort()[0]

      const payload = {
        quotation_number: form.quotation_number,
        client_id: finalClientId,
        event_type: form.event_type,
        event_date: form.event_date || earliestScheduled || null,
        issue_date: form.issue_date,
        items: activeItems,
        discount: 0,
        subtotal: total,
        total,
        notes: form.notes,
        status: form.status,
        details: {
          phone: phone || null,
          billing_address: form.billing_address.trim() || null,
          package_title: form.package_title.trim(),
          deliverables: splitLines(form.deliverables),
          schedule: form.schedule.filter((r) => r.date || r.event?.trim() || r.coverage?.trim() || r.location?.trim()),
          payments: form.payments
            .filter((r) => Number(r.amount) > 0)
            .map((r) => ({ ...r, amount: Number(r.amount) })),
          delivery: form.delivery.filter((r) => r.workflow?.trim()),
        },
      }
      const { error } = isEdit
        ? await supabase.from('quotations').update(payload).eq('id', id)
        : await supabase.from('quotations').insert(payload)
      if (error) {
        const missingColumn = error.code === 'PGRST204' || /details/.test(error.message || '')
        throw new Error(
          missingColumn
            ? 'Run supabase/migrations/006_add_quotation_details.sql in the Supabase SQL Editor, then save again.'
            : error.message
        )
      }

      setDirty(false)
      baselineRef.current = JSON.stringify(form)
      releaseGuard()
      setSaving(false)
      notify(isEdit ? 'Quotation updated' : 'Quotation created')
      navigate('/quotations')
    } catch (err) {
      notify(err.message || 'Error saving quotation', 'error')
      setSaving(false)
    }
  }

  if (loading) return <PageLoader />

  return (
    <div className="mx-auto w-full max-w-7xl font-sans text-gray-800 dark:text-gray-100">
      {clients.length === 0 && (
        <div className="card mb-4 text-sm text-amber-700 dark:text-amber-300">
          You have no clients yet. Type a name or phone number below and one will be created when you save.
        </div>
      )}

      <form onSubmit={save} className="space-y-4">
        {/* Top bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 pb-3 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleBack}
              aria-label="Back to Quotations"
              title="Back to Quotations"
              className="group flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 shadow-sm transition hover:border-gray-300 hover:bg-gray-100 hover:text-gray-900 active:scale-95 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:border-gray-600 dark:hover:bg-gray-700 dark:hover:text-white"
            >
              <ArrowLeftIcon width={18} height={18} className="transition-transform group-hover:-translate-x-0.5" />
            </button>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">Quotation</h1>
              <span className="rounded bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
                {isEdit ? 'Edit Quotation' : 'New Quotation'}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="font-medium text-gray-500">Quotation Number</span>
              <input
                type="text"
                value={form.quotation_number}
                onChange={(e) => setForm({ ...form, quotation_number: e.target.value })}
                className="h-8 w-28 rounded border border-gray-300 bg-white px-2 font-medium text-gray-800 shadow-sm focus:border-brand-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-medium text-gray-500">Quotation Date</span>
              <input
                type="date"
                value={form.issue_date}
                onChange={(e) => setForm({ ...form, issue_date: e.target.value })}
                className="h-8 rounded border border-gray-300 bg-white px-2 font-medium text-gray-800 shadow-sm focus:border-brand-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              />
            </div>
          </div>
        </div>

        {/* Customer / party */}
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
            <div className="space-y-3 lg:col-span-6">
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label className="text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300">
                    Customer / Party <span className="text-red-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setClientModalOpen(true)}
                    className="text-xs font-medium text-brand-600 hover:underline dark:text-brand-400"
                  >
                    + Add Party (Details)
                  </button>
                </div>
                <CustomerCombobox
                  clients={clients}
                  selectedClientId={form.client_id}
                  customerName={customerName}
                  onSelectClient={handleClientSelect}
                  onNameChange={handleNameChange}
                  onClear={handleClearCustomer}
                  onPhoneInput={(phone) => setForm((f) => ({ ...f, phone }))}
                  placeholder="Search party or type new name..."
                />
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300">
                  Billing Address
                </label>
                <textarea
                  rows={2}
                  placeholder="Enter customer address..."
                  value={form.billing_address}
                  onChange={(e) => setForm({ ...form, billing_address: e.target.value })}
                  className="mt-1 w-full rounded border border-gray-300 bg-white p-2.5 text-sm text-gray-800 placeholder-gray-400 shadow-sm focus:border-brand-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                />
              </div>
            </div>

            <div className="lg:col-span-6">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300">
                    Phone No.
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 9876543210"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="mt-1 w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 shadow-sm focus:border-brand-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300">
                    Event Type
                  </label>
                  <div className="mt-1">
                    <SelectWithOther
                      options={EVENT_TYPES}
                      value={form.event_type}
                      onChange={(v) => setForm({ ...form, event_type: v })}
                      placeholder="Enter event type"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300">
                    Event Date
                  </label>
                  <input
                    type="date"
                    value={form.event_date}
                    onChange={(e) => setForm({ ...form, event_date: e.target.value })}
                    className="mt-1 w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 shadow-sm focus:border-brand-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Items table */}
        <div className="overflow-hidden rounded-lg border border-gray-300 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-gray-300 bg-gray-100 text-gray-600 dark:border-gray-700 dark:bg-gray-700 dark:text-gray-300">
                <tr>
                  <th className="w-12 border-r border-gray-300 px-3 py-2.5 text-center font-bold dark:border-gray-600">#</th>
                  <th className="border-r border-gray-300 px-3 py-2.5 font-bold dark:border-gray-600">SERVICES</th>
                  <th className="w-10 px-2 py-2.5 text-center" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {form.items.map((row, idx) => (
                  <tr key={idx} className="transition-colors hover:bg-gray-50/50 dark:hover:bg-gray-700/30">
                    <td className="border-r border-gray-200 px-2 py-1.5 text-center font-medium text-gray-500 dark:border-gray-700">
                      {idx + 1}
                    </td>
                    <td className="relative border-r border-gray-200 px-2 py-1.5 dark:border-gray-700">
                      <ItemCombobox
                        value={row.description}
                        onChange={(val) => updateService(idx, val)}
                        itemsList={serviceOptions.map((name) => ({ name }))}
                        placeholder="Select or type a service"
                        listTitle="Saved Services"
                        matchTitle="Matching Services"
                        newBadge="New service"
                        limit={30}
                      />
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      <button
                        type="button"
                        onClick={() => removeRow(idx)}
                        title="Delete row"
                        className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-red-600 dark:hover:bg-gray-700 dark:hover:text-red-400"
                      >
                        <TrashIcon width={16} height={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center gap-3 border-t border-gray-200 bg-white p-2.5 dark:border-gray-700 dark:bg-gray-800">
            <button
              type="button"
              onClick={addRow}
              className="flex items-center gap-1 rounded border border-blue-400 bg-blue-50/50 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-blue-600 shadow-sm transition hover:bg-blue-100 dark:border-blue-500/50 dark:bg-blue-900/20 dark:text-blue-400"
            >
              <PlusIcon width={14} height={14} /> ADD SERVICE
            </button>
            {packages.length > 0 && (
              <div className="ml-auto flex items-center gap-2">
                <select
                  value={selectedPackage}
                  onChange={(e) => setSelectedPackage(e.target.value)}
                  className="rounded border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-800 shadow-sm focus:border-brand-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                >
                  <option value="">Quick add from package…</option>
                  {packages.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <button type="button" onClick={addPackage} disabled={!selectedPackage} className="btn-secondary py-1.5 text-xs">
                  Add
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div>
            <label className="label">Deliverables</label>
            <textarea
              rows={5}
              className="input"
              placeholder={'One per line, e.g.\nCinematic reels – 2–3 Minutes\nAll data soft copy\n20+20 sheets (12 x 24) – 2 albums'}
              value={form.deliverables}
              onChange={(e) => setForm({ ...form, deliverables: e.target.value })}
            />
          </div>
        </div>

        <div className="card space-y-3">
          <h3 className="text-sm font-semibold">Event Schedule</h3>
          <RowsEditor
            rows={form.schedule}
            columns={SCHEDULE_COLUMNS}
            onChange={(schedule) => setForm({ ...form, schedule })}
            emptyRow={() => ({ date: '', event: '', coverage: '', location: '' })}
            addLabel="Add event"
            emptyText="No events added yet."
          />
        </div>

        <div className="card space-y-3">
          <h3 className="text-sm font-semibold">Payment Details</h3>
          <p className="-mt-2 text-xs text-gray-400">Record each amount received from the customer, e.g. an Advance first, then Part or Final payments. Shown in the PDF with a payment summary.</p>
          <RowsEditor
            rows={form.payments}
            columns={PAYMENT_COLUMNS}
            onChange={(payments) => setForm({ ...form, payments })}
            emptyRow={() => ({ date: today(), mode: 'UPI', amount: '', type: '' })}
            addLabel="Add payment"
            emptyText="No payments recorded."
          />
        </div>

        <div className="card space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Project Delivery Status</h3>
            <button
              type="button"
              className="text-xs font-medium text-brand-600 hover:underline dark:text-brand-400"
              onClick={() =>
                setForm((f) => {
                  const have = new Set(f.delivery.map((d) => d.workflow.trim().toLowerCase()))
                  const missing = standardWorkflow().filter((d) => !have.has(d.workflow.toLowerCase()))
                  return { ...f, delivery: [...f.delivery, ...missing] }
                })
              }
            >
              Add standard workflow
            </button>
          </div>
          <RowsEditor
            rows={form.delivery}
            columns={deliveryColumns(workflowOptions)}
            onChange={(delivery) => setForm({ ...form, delivery })}
            emptyRow={() => ({ workflow: '', status: 'Pending', link: '', client_status: 'Pending' })}
            addLabel="Add step"
            emptyText="No delivery steps added."
          />
        </div>

        {/* Bottom: terms, status and totals */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <div className="rounded-lg border border-gray-300 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800 lg:col-span-4">
            <label className="text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300">
              Terms & Conditions
            </label>
            <textarea
              rows={7}
              placeholder="One term per line"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="mt-2 w-full rounded border border-gray-300 bg-gray-50 p-2.5 text-xs leading-relaxed text-gray-700 shadow-inner focus:border-brand-500 focus:bg-white focus:outline-none dark:border-gray-600 dark:bg-gray-900/50 dark:text-gray-200"
            />
          </div>

          <div className="space-y-3 rounded-lg border border-gray-300 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800 lg:col-span-4">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300">
                Status
              </label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="mt-1 w-full rounded border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-800 shadow-sm focus:border-brand-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              >
                {QUOTATION_STATUSES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300">
                PDF Cover Title
              </label>
              <input
                type="text"
                placeholder={`${form.event_type || 'Event'} Photography`}
                value={form.package_title}
                onChange={(e) => setForm({ ...form, package_title: e.target.value })}
                className="mt-1 w-full rounded border border-gray-300 bg-white px-2.5 py-1.5 text-xs text-gray-800 shadow-sm focus:border-brand-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              />
              <p className="mt-1 text-xs text-gray-400">
                Shown as "QUOTATION FOR …" on the cover page. Leave blank to use the event type.
              </p>
            </div>
          </div>

          <div className="flex flex-col justify-between rounded-lg border border-gray-300 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800 lg:col-span-4">
            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-gray-600 dark:text-gray-300">Total Package Amount (₹)</span>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="0"
                  value={form.total}
                  onChange={(e) => {
                    const val = e.target.value
                    if (val === '' || /^\d*\.?\d*$/.test(val)) setForm({ ...form, total: val })
                  }}
                  className="h-9 w-36 rounded border border-gray-300 bg-white px-2 text-right text-base font-bold text-gray-900 shadow-sm focus:border-brand-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                />
              </div>
              {total > 0 && <p className="text-right text-[11px] text-gray-500">{amountInWords(total)}</p>}
            </div>

            <div className="mt-4 flex items-center justify-end gap-3 border-t border-gray-200 pt-3 dark:border-gray-700">
              <Link to="/quotations" className="text-xs font-semibold text-gray-600 hover:underline dark:text-gray-300">
                Cancel
              </Link>
              <button
                type="submit"
                disabled={saving}
                className="rounded bg-blue-600 px-5 py-2 text-xs font-bold uppercase tracking-wider text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-60"
              >
                {saving ? 'Saving…' : 'Save Quotation'}
              </button>
            </div>
          </div>
        </div>
      </form>

      <ClientFormModal
        open={clientModalOpen}
        onClose={() => setClientModalOpen(false)}
        onSaved={(client) => {
          if (!client) return
          setClients((list) =>
            [...list, client].sort((a, b) => a.name.localeCompare(b.name))
          )
          setCustomerName(client.name || '')
          setForm((f) => ({
            ...f,
            client_id: client.id,
            phone: client.phone || f.phone,
            billing_address: client.address || f.billing_address,
          }))
        }}
      />
    </div>
  )
}
