import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import ClientFormModal from '../components/ClientFormModal'
import CustomerCombobox from '../components/CustomerCombobox'
import { PageLoader } from '../components/Loaders'
import { useToast } from '../contexts/ToastContext'
import { useUnsavedGuard } from '../lib/useUnsavedGuard'
import { formatCurrency } from '../lib/format'
import { TrashIcon, PlusIcon, SettingsIcon, WhatsAppIcon, ArrowLeftIcon } from '../components/icons'
import ItemCombobox from '../components/ItemCombobox'
import { loadItemsLibrary, saveItemsToLibrary } from '../lib/itemService'
import { useProfile } from '../contexts/ProfileContext'

const today = () => new Date().toISOString().slice(0, 10)
const currentTime = () =>
  new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })

const UNIT_OPTIONS = ['Photo', 'NONE', 'PCS', 'SET', 'HRS', 'DAY', 'BOX', 'PKT']
const PAYMENT_TYPES = ['Cash', 'Online / UPI', 'Cheque', 'Bank Transfer', 'Card']
const COPY_OPTIONS = ['Original', 'Duplicate', 'Triplicate']

const DEFAULT_TERMS = `Terms and Conditions Apply
50% advance payment and 25% after your work then 10% after video delivery 5% After the PDF of the album is ready`

const emptyRow = (unit = 'NONE') => ({
  description: '',
  quantity: '',
  free_qty: '',
  unit: unit,
  rate: '',
  discount_percent: '',
  discount_amount: '',
  amount: '',
})

async function generateNumber(prefix) {
  const year = new Date().getFullYear()
  const like = `${prefix}-${year}-%`
  const { count } = await supabase
    .from('invoices')
    .select('*', { count: 'exact', head: true })
    .like('invoice_number', like)
  const next = String((count || 0) + 1).padStart(3, '0')
  return `${prefix}-${year}-${next}`
}

export default function InvoiceForm() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const fromQuotation = searchParams.get('fromQuotation')
  const navigate = useNavigate()
  const isEdit = Boolean(id)
  const { notify } = useToast()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [autoSendWhatsApp, setAutoSendWhatsApp] = useState(false)
  const [clientModalOpen, setClientModalOpen] = useState(false)
  const [clients, setClients] = useState([])
  const [clientBalance, setClientBalance] = useState(0)
  const [itemsList, setItemsList] = useState([])
  const { profile } = useProfile()

  // Attachments state
  const [attachedImageName, setAttachedImageName] = useState('')
  const [attachedDocName, setAttachedDocName] = useState('')
  const imageInputRef = useRef(null)
  const docInputRef = useRef(null)

  // Form State
  const [form, setForm] = useState({
    invoice_number: '',
    invoice_date: today(),
    invoice_time: currentTime(),
    client_id: '',
    billing_name: '',
    phone: '',
    billing_address: '',
    eway_bill_no: '',
    items: [emptyRow('Photo'), emptyRow('NONE'), emptyRow('NONE')],
    terms_title: 'Sale Invoice',
    terms_and_conditions: DEFAULT_TERMS,
    payment_type: 'Cash',
    no_of_copies: 'Original',
    description: '',
    discount: '',
    round_off: false,
    received_checked: false,
    received: 0,
  })

  const baselineRef = useRef(null)
  const [dirty, setDirty] = useState(false)
  const releaseGuard = useUnsavedGuard(dirty)

  const handleBack = () => {
    if (window.history.state && window.history.state.idx > 0) {
      navigate(-1)
    } else {
      navigate('/invoices')
    }
  }

  // ── Calculate Client Balance ──────────────────────────────────────────────
  const loadClientBalance = async (clientId) => {
    if (!clientId) {
      setClientBalance(0)
      return
    }
    try {
      const { data: invs } = await supabase
        .from('invoices')
        .select('id, total')
        .eq('client_id', clientId)
      if (!invs || invs.length === 0) {
        setClientBalance(0)
        return
      }
      const invIds = invs.map((i) => i.id)
      const { data: pays } = await supabase
        .from('payments')
        .select('amount')
        .in('invoice_id', invIds)
      const totalBilled = invs.reduce((sum, i) => sum + (Number(i.total) || 0), 0)
      const totalPaid = (pays || []).reduce((sum, p) => sum + (Number(p.amount) || 0), 0)
      setClientBalance(Math.max(0, totalBilled - totalPaid))
    } catch {
      setClientBalance(0)
    }
  }

  // ── Initialize Form ───────────────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      const [{ data: clientData }, { data: profile }] = await Promise.all([
        supabase.from('clients').select('*').order('name'),
        supabase.from('business_profile').select('invoice_prefix').limit(1).maybeSingle(),
      ])
      const clientList = clientData || []
      setClients(clientList)
      const prefix = profile?.invoice_prefix || 'INV'

      if (isEdit) {
        const { data } = await supabase.from('invoices').select('*').eq('id', id).single()
        if (data) {
          const clientObj = clientList.find((c) => c.id === data.client_id)
          // Format rows
          const rows = (data.items || []).map((it) => {
            const qty = it.quantity || 1
            const rate = it.rate || 0
            const amt = it.amount || (qty * rate)
            return {
              description: it.description || '',
              quantity: qty,
              free_qty: it.free_qty || '',
              unit: it.unit || 'Photo',
              rate: rate || '',
              discount_percent: it.discount_percent || '',
              discount_amount: it.discount_amount || '',
              amount: amt || '',
            }
          })
          while (rows.length < 3) {
            rows.push(emptyRow('NONE'))
          }

          // Fetch payments
          const { data: pays } = await supabase
            .from('payments')
            .select('*')
            .eq('invoice_id', id)
          const paidTotal = (pays || []).reduce((s, p) => s + (Number(p.amount) || 0), 0)
          const firstPay = (pays || [])[0]

          setForm({
            invoice_number: data.invoice_number || '',
            invoice_date: data.issue_date || today(),
            invoice_time: currentTime(),
            client_id: data.client_id || '',
            billing_name: clientObj?.name || '',
            phone: data.phone || clientObj?.phone || '',
            billing_address: clientObj?.address || '',
            eway_bill_no: '',
            items: rows,
            terms_title: 'Sale Invoice',
            terms_and_conditions: data.notes || DEFAULT_TERMS,
            payment_type: firstPay?.mode || 'Cash',
            no_of_copies: 'Original',
            description: firstPay?.note || '',
            discount: data.discount || '',
            round_off: false,
            received_checked: paidTotal > 0,
            received: paidTotal > 0 ? paidTotal : '',
          })
          if (data.client_id) {
            loadClientBalance(data.client_id)
          }
        }
      } else if (fromQuotation) {
        const { data: q } = await supabase.from('quotations').select('*').eq('id', fromQuotation).single()
        const number = await generateNumber(prefix)
        const clientObj = clientList.find((c) => c.id === q?.client_id)
        const rows = (q?.items || []).map((it) => {
          const qty = it.quantity || 1
          const rate = it.rate || 0
          return {
            description: it.description || '',
            quantity: qty,
            free_qty: '',
            unit: 'Photo',
            rate: rate || '',
            discount_percent: '',
            discount_amount: '',
            amount: qty * rate || '',
          }
        })
        while (rows.length < 3) {
          rows.push(emptyRow('NONE'))
        }
        setForm((f) => ({
          ...f,
          invoice_number: number,
          client_id: q?.client_id || '',
          billing_name: clientObj?.name || '',
          phone: clientObj?.phone || '',
          billing_address: clientObj?.address || '',
          items: rows,
          discount: q?.discount || '',
          terms_and_conditions: q?.notes || DEFAULT_TERMS,
        }))
        if (q?.client_id) loadClientBalance(q.client_id)
      } else {
        const number = await generateNumber(prefix)
        setForm((f) => ({ ...f, invoice_number: number }))
      }

      // Load saved items library from database and past invoices
      try {
        const savedItems = await loadItemsLibrary()
        setItemsList(savedItems)
      } catch (err) {
        console.error('Error loading items library:', err)
      }

      setLoading(false)
    }
    init()
  }, [id, fromQuotation, isEdit])

  // ── Dirty tracking ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!loading && baselineRef.current === null) baselineRef.current = JSON.stringify(form)
  }, [loading, form])
  useEffect(() => {
    if (baselineRef.current !== null) setDirty(JSON.stringify(form) !== baselineRef.current)
  }, [form])

  // ── Handle Client Change & Auto-Creation Support ───────────────────────────
  const handleClientSelect = (clientOrId) => {
    const selected =
      typeof clientOrId === 'object' && clientOrId !== null
        ? clientOrId
        : clients.find((c) => c.id === clientOrId)

    if (!selected) return

    setForm((prev) => ({
      ...prev,
      client_id: selected.id,
      billing_name: selected.name || '',
      phone: selected.phone || prev.phone || '',
      billing_address: selected.address || prev.billing_address || '',
    }))
    loadClientBalance(selected.id)
  }

  const handleCustomerNameChange = (name, forceNew = false) => {
    const matched =
      !forceNew && name.trim()
        ? clients.find((c) => c.name?.trim().toLowerCase() === name.trim().toLowerCase())
        : null

    setForm((prev) => ({
      ...prev,
      billing_name: name,
      client_id: matched ? matched.id : '',
      phone: matched ? matched.phone || prev.phone : prev.phone,
      billing_address: matched ? matched.address || prev.billing_address : prev.billing_address,
    }))

    if (matched) {
      loadClientBalance(matched.id)
    } else {
      setClientBalance(0)
    }
  }

  const handleClearCustomer = () => {
    setForm((prev) => ({
      ...prev,
      client_id: '',
      billing_name: '',
      phone: '',
      billing_address: '',
    }))
    setClientBalance(0)
  }

  // ── Row Updates & Dynamic Computations ────────────────────────────────────
  const updateRow = (index, field, value) => {
    setForm((prev) => {
      const nextItems = [...prev.items]
      const row = { ...nextItems[index], [field]: value }

      // If user types an item description and qty is not set, default qty to 1
      if (field === 'description' && value && (!row.quantity || Number(row.quantity) === 0)) {
        row.quantity = 1
      }

      if (field === 'amount') {
        // Direct editing of the AMOUNT field
        const amt = value === '' ? '' : Number(value)
        row.amount = amt

        if (amt !== '') {
          if (!row.quantity || Number(row.quantity) <= 0) {
            row.quantity = 1
          }
          const qty = Number(row.quantity) || 1
          const disc = Number(row.discount_amount) || 0
          // Auto-calculate Price/Unit
          row.rate = ((amt + disc) / qty).toFixed(2).replace(/\.00$/, '')
        }
      } else if (field === 'rate' || field === 'quantity') {
        // Auto-set qty to 1 if user enters rate without specifying qty
        if (field === 'rate' && value !== '' && (!row.quantity || Number(row.quantity) <= 0)) {
          row.quantity = 1
        }
        const qty = Number(row.quantity) || 0
        const rate = Number(row.rate) || 0
        const base = qty * rate

        let discAmt = Number(row.discount_amount) || 0
        if (Number(row.discount_percent) > 0) {
          discAmt = (base * Number(row.discount_percent)) / 100
          row.discount_amount = discAmt ? discAmt.toFixed(2).replace(/\.00$/, '') : ''
        }

        const computedAmt = Math.max(0, base - discAmt)
        row.amount = (qty > 0 || rate > 0) ? computedAmt : ''
      } else if (field === 'discount_percent') {
        const qty = Number(row.quantity) || 1
        const rate = Number(row.rate) || (Number(row.amount) || 0) / qty
        const base = qty * rate
        const pct = Number(value) || 0
        const discAmt = (base * pct) / 100
        row.discount_amount = discAmt ? discAmt.toFixed(2).replace(/\.00$/, '') : ''
        row.amount = Math.max(0, base - discAmt)
      } else if (field === 'discount_amount') {
        const qty = Number(row.quantity) || 1
        const rate = Number(row.rate) || (Number(row.amount) || 0) / qty
        const base = qty * rate
        const discAmt = Number(value) || 0
        row.discount_percent = base > 0 ? ((discAmt / base) * 100).toFixed(1).replace(/\.0$/, '') : ''
        row.amount = Math.max(0, base - discAmt)
      }

      nextItems[index] = row
      return { ...prev, items: nextItems }
    })
  }

  // ── Handle Item Selection from Library ────────────────────────────────────
  const handleSelectItem = (index, selectedItem) => {
    setForm((prev) => {
      const nextItems = [...prev.items]
      const row = { ...nextItems[index] }
      row.description = selectedItem.name
      if (selectedItem.unit) {
        row.unit = selectedItem.unit
      }
      if (Number(selectedItem.rate) > 0) {
        row.rate = selectedItem.rate
        if (!row.quantity || Number(row.quantity) <= 0) {
          row.quantity = 1
        }
        const qty = Number(row.quantity) || 1
        const rate = Number(selectedItem.rate) || 0
        const base = qty * rate
        let discAmt = Number(row.discount_amount) || 0
        if (Number(row.discount_percent) > 0) {
          discAmt = (base * Number(row.discount_percent)) / 100
          row.discount_amount = discAmt ? discAmt.toFixed(2).replace(/\.00$/, '') : ''
        }
        row.amount = Math.max(0, base - discAmt)
      }
      nextItems[index] = row
      return { ...prev, items: nextItems }
    })
  }

  const addRow = () => {
    setForm((prev) => ({
      ...prev,
      items: [...prev.items, emptyRow('NONE')],
    }))
  }

  const removeRow = (index) => {
    if (form.items.length <= 1) {
      setForm((prev) => ({ ...prev, items: [emptyRow('Photo')] }))
      return
    }
    setForm((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }))
  }

  // ── Totals Calculation ───────────────────────────────────────────────────
  const totalQty = useMemo(
    () => form.items.reduce((s, it) => s + (Number(it.quantity) || 0), 0),
    [form.items]
  )
  const totalFreeQty = useMemo(
    () => form.items.reduce((s, it) => s + (Number(it.free_qty) || 0), 0),
    [form.items]
  )
  const subtotal = useMemo(
    () => form.items.reduce((s, it) => s + (Number(it.amount) || 0), 0),
    [form.items]
  )
  const overallDiscount = Number(form.discount) || 0
  const rawTotal = Math.max(0, subtotal - overallDiscount)
  const finalTotal = form.round_off ? Math.round(rawTotal) : rawTotal

  const receivedAmount = form.received_checked
    ? Number(form.received) || 0
    : 0

  const balanceDue = Math.max(0, finalTotal - receivedAmount)

  // ── Save Invoice ─────────────────────────────────────────────────────────
  const handleSave = async (e) => {
    if (e) e.preventDefault()

    if (autoSendWhatsApp && !form.phone?.trim()) {
      notify('Please enter the customer phone number or uncheck Send PDF on WhatsApp.', 'error')
      return
    }

    // Use billing_name if set, otherwise fall back to phone (user typed only a phone number)
    const customerName = (form.billing_name || '').trim()
    const phoneAsName = (form.phone || '').trim()
    const effectiveName = customerName || phoneAsName

    if (!effectiveName && !form.client_id) {
      notify('Please enter a Customer / Party name or phone number.', 'error')
      return
    }

    const activeItems = form.items
      .filter((it) => it.description?.trim() || Number(it.rate) > 0 || Number(it.amount) > 0)
      .map((it) => {
        const qty = Number(it.quantity) || 1
        const amt = Number(it.amount) || 0
        const rate = Number(it.rate) || (amt > 0 ? amt / qty : 0)
        return {
          description: it.description?.trim() || 'Photo Service',
          quantity: qty,
          free_qty: Number(it.free_qty) || 0,
          unit: it.unit || 'Photo',
          rate: rate,
          discount_percent: Number(it.discount_percent) || 0,
          discount_amount: Number(it.discount_amount) || 0,
          amount: amt || qty * rate,
        }
      })

    if (activeItems.length === 0) {
      notify('Please enter at least one item description and amount/rate.', 'error')
      return
    }

    setSaving(true)
    try {
      let finalClientId = form.client_id

      // Auto-create client in database if not selected from existing list
      if (!finalClientId && effectiveName) {
        // A typed name matches by name only; phone matching applies when only a number was typed.
        const existing = clients.find(
          (c) =>
            c.name?.trim().toLowerCase() === effectiveName.toLowerCase() ||
            (!customerName &&
              phoneAsName &&
              (c.phone || '').replace(/\D/g, '') === phoneAsName.replace(/\D/g, ''))
        )
        if (existing) {
          finalClientId = existing.id
        } else {
          // Insert new party — when only phone typed, phone number becomes the name too
          const { data: newClient, error: clientErr } = await supabase
            .from('clients')
            .insert({
              name: effectiveName,
              phone: form.phone?.trim() || null,
              address: form.billing_address?.trim() || null,
            })
            .select()
            .single()

          if (clientErr) throw new Error(`Could not auto-add customer: ${clientErr.message}`)
          finalClientId = newClient.id
          setClients((prev) => [...prev, newClient])
        }
      }

      const derivedStatus =
        receivedAmount >= finalTotal && finalTotal > 0
          ? 'Paid'
          : receivedAmount > 0
            ? 'Partially Paid'
            : 'Unpaid'

      const payload = {
        invoice_number: form.invoice_number,
        client_id: finalClientId,
        phone: form.phone?.trim() || null,
        event_type: 'Sale',
        event_date: null,
        issue_date: form.invoice_date,
        items: activeItems,
        discount: overallDiscount,
        subtotal,
        total: finalTotal,
        notes: form.terms_and_conditions,
        status: derivedStatus,
      }

      let savedId = id
      if (isEdit) {
        const { data: payments, error: paymentsError } = await supabase
          .from('payments')
          .select('id, amount')
          .eq('invoice_id', id)
          .order('created_at', { ascending: false })
        if (paymentsError) throw paymentsError

        const savedReceived = (payments || []).reduce(
          (sum, payment) => sum + Math.round(Number(payment.amount) * 100),
          0
        )
        const difference = Math.round(receivedAmount * 100) - savedReceived

        if (difference > 0) {
          const { error: paymentError } = await supabase.from('payments').insert({
            invoice_id: id,
            amount: difference / 100,
            payment_date: form.invoice_date,
            mode: form.payment_type,
            note: form.description || 'Payment received while editing invoice',
            is_advance: false,
          })
          if (paymentError) throw paymentError
        } else if (difference < 0) {
          let remainingReduction = -difference
          for (const payment of payments || []) {
            if (remainingReduction <= 0) break
            const paymentAmount = Math.round(Number(payment.amount) * 100)
            const reduction = Math.min(paymentAmount, remainingReduction)
            const updatedAmount = paymentAmount - reduction
            const { error: paymentError } = updatedAmount > 0
              ? await supabase.from('payments').update({ amount: updatedAmount / 100 }).eq('id', payment.id)
              : await supabase.from('payments').delete().eq('id', payment.id)
            if (paymentError) throw paymentError
            remainingReduction -= reduction
          }
        }

        const { error } = await supabase.from('invoices').update(payload).eq('id', id)
        if (error) throw error
      } else {
        const { data, error } = await supabase.from('invoices').insert(payload).select('id').single()
        if (error) throw error
        savedId = data?.id

        if (savedId && receivedAmount > 0) {
          const { error: paymentError } = await supabase.from('payments').insert({
            invoice_id: savedId,
            amount: receivedAmount,
            payment_date: form.invoice_date,
            mode: form.payment_type,
            note: form.description || 'Payment received at creation',
            is_advance: true,
          })
          if (paymentError) throw paymentError
        }

        if (fromQuotation) {
          await supabase.from('quotations').update({ status: 'Accepted' }).eq('id', fromQuotation)
        }
      }

      setDirty(false)
      baselineRef.current = JSON.stringify(form)
      releaseGuard()

      // ── Auto-save items to database library for future use ─────────────────
      try {
        await saveItemsToLibrary(activeItems)
        loadItemsLibrary().then(setItemsList)
      } catch (e) {
        console.warn('Item library sync:', e)
      }

      notify(isEdit ? 'Invoice updated successfully!' : 'Sale invoice created successfully!')

      navigate(`/invoices/${savedId}`, { state: { sendWhatsApp: autoSendWhatsApp } })
    } catch (err) {
      notify(err.message || 'Error saving invoice', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <PageLoader />

  return (
    <div className="mx-auto w-full max-w-7xl font-sans text-gray-800 dark:text-gray-100">
      {/* ── TOP HEADER / APP BAR ────────────────────────────────────────── */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 pb-3 dark:border-gray-700">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleBack}
            aria-label="Back to Invoices"
            title="Back to Invoices"
            className="group flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 shadow-sm transition hover:border-gray-300 hover:bg-gray-100 hover:text-gray-900 active:scale-95 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:border-gray-600 dark:hover:bg-gray-700 dark:hover:text-white"
          >
            <ArrowLeftIcon width={18} height={18} className="transition-transform group-hover:-translate-x-0.5" />
          </button>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">Sale</h1>
            <span className="rounded bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
              {isEdit ? 'Edit Invoice' : 'New Invoice'}
            </span>
          </div>
        </div>

        {/* Invoice Number, Date, Time on Top Right */}
        <div className="flex flex-wrap items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-gray-500 font-medium">Invoice Number</span>
            <input
              type="text"
              value={form.invoice_number}
              onChange={(e) => setForm({ ...form, invoice_number: e.target.value })}
              className="h-8 w-28 rounded border border-gray-300 bg-white px-2 font-medium text-gray-800 shadow-sm focus:border-brand-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            />
            <button
              type="button"
              title="Refresh / Settings"
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            >
              <SettingsIcon width={16} height={16} />
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-gray-500 font-medium">Invoice Date</span>
            <input
              type="date"
              value={form.invoice_date}
              onChange={(e) => setForm({ ...form, invoice_date: e.target.value })}
              className="h-8 rounded border border-gray-300 bg-white px-2 font-medium text-gray-800 shadow-sm focus:border-brand-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-gray-500 font-medium">Time</span>
            <input
              type="text"
              value={form.invoice_time}
              onChange={(e) => setForm({ ...form, invoice_time: e.target.value })}
              className="h-8 w-24 rounded border border-gray-300 bg-white px-2 font-medium text-gray-800 shadow-sm focus:border-brand-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            />
          </div>
        </div>
      </div>

      {/* ── CUSTOMER / PARTY DETAILS SECTION ───────────────────────────── */}
      <div className="mb-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          {/* Customer & Billing Address (Left 6 cols) */}
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
                customerName={form.billing_name}
                onSelectClient={handleClientSelect}
                onNameChange={handleCustomerNameChange}
                onClear={handleClearCustomer}
                onPhoneInput={(phone) => setForm((prev) => ({ ...prev, phone }))}
                clientBalance={clientBalance}
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

          {/* Phone No & E-Way Bill No (Right 6 cols) */}
          <div className="space-y-3 lg:col-span-6">
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
                  E-Way Bill No.
                </label>
                <input
                  type="text"
                  placeholder="E-Way Bill No."
                  value={form.eway_bill_no}
                  onChange={(e) => setForm({ ...form, eway_bill_no: e.target.value })}
                  className="mt-1 w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 shadow-sm focus:border-brand-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                />
              </div>
            </div>

            <div className="rounded-md border border-dashed border-gray-200 bg-gray-50/70 p-3 text-xs text-gray-500 dark:border-gray-700 dark:bg-gray-800/40 dark:text-gray-400">
              <span className="font-semibold text-gray-700 dark:text-gray-300">💡 Easy Billing:</span> You don't need to add parties in advance. Just type their name and phone number above, and they will be saved to your database automatically when creating the invoice!
            </div>
          </div>
        </div>
      </div>

      {/* ── ITEMS TABLE SECTION ────────────────────────────────────────── */}
      <div className="mb-4 overflow-hidden rounded-lg border border-gray-300 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-gray-300 bg-gray-100 text-gray-600 dark:border-gray-700 dark:bg-gray-700 dark:text-gray-300">
              <tr>
                <th className="w-12 border-r border-gray-300 px-3 py-2.5 text-center font-bold dark:border-gray-600">#</th>
                <th className="min-w-[220px] border-r border-gray-300 px-3 py-2.5 font-bold dark:border-gray-600">ITEM</th>
                <th className="w-20 border-r border-gray-300 px-2 py-2.5 text-center font-bold dark:border-gray-600">QTY</th>
                <th className="w-20 border-r border-gray-300 px-2 py-2.5 text-center font-bold dark:border-gray-600">FREE QTY</th>
                <th className="w-28 border-r border-gray-300 px-2 py-2.5 font-bold dark:border-gray-600">UNIT</th>
                <th className="w-28 border-r border-gray-300 px-2 py-2.5 text-right font-bold dark:border-gray-600">PRICE/UNIT</th>
                <th className="w-40 border-r border-gray-300 px-2 py-2.5 text-center font-bold dark:border-gray-600">
                  <div className="border-b border-gray-300 pb-1 dark:border-gray-600">DISCOUNT</div>
                  <div className="grid grid-cols-2 pt-1 text-[11px] font-medium text-gray-500 dark:text-gray-400">
                    <span>%</span>
                    <span>AMOUNT</span>
                  </div>
                </th>
                <th className="w-28 border-r border-gray-300 px-3 py-2.5 text-right font-bold dark:border-gray-600">AMOUNT</th>
                <th className="w-10 px-2 py-2.5 text-center" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {form.items.map((row, idx) => (
                <tr key={idx} className="transition-colors hover:bg-gray-50/50 dark:hover:bg-gray-700/30">
                  {/* # */}
                  <td className="border-r border-gray-200 px-2 py-1.5 text-center font-medium text-gray-500 dark:border-gray-700">
                    {idx + 1}
                  </td>

                  {/* ITEM (with Autocomplete and Auto-Save to Database) */}
                  <td className="relative border-r border-gray-200 px-2 py-1.5 dark:border-gray-700">
                    <ItemCombobox
                      value={row.description}
                      onChange={(val) => updateRow(idx, 'description', val)}
                      onSelectItem={(item) => handleSelectItem(idx, item)}
                      itemsList={itemsList}
                      placeholder="e.g. Soft copy Studio / Candid Photography"
                    />
                  </td>

                  {/* QTY */}
                  <td className="border-r border-gray-200 px-1.5 py-1.5 text-center dark:border-gray-700">
                    <input
                      type="number"
                      min="0"
                      placeholder="1"
                      value={row.quantity}
                      onChange={(e) => updateRow(idx, 'quantity', e.target.value)}
                      className="w-full rounded border border-gray-200 bg-white px-1 py-1 text-center text-sm font-medium text-gray-800 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                    />
                  </td>

                  {/* FREE QTY */}
                  <td className="border-r border-gray-200 px-1.5 py-1.5 text-center dark:border-gray-700">
                    <input
                      type="number"
                      min="0"
                      placeholder="0"
                      value={row.free_qty}
                      onChange={(e) => updateRow(idx, 'free_qty', e.target.value)}
                      className="w-full rounded border border-gray-200 bg-white px-1 py-1 text-center text-sm text-gray-800 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                    />
                  </td>

                  {/* UNIT */}
                  <td className="border-r border-gray-200 px-1.5 py-1.5 dark:border-gray-700">
                    <select
                      value={row.unit}
                      onChange={(e) => updateRow(idx, 'unit', e.target.value)}
                      className="w-full rounded border border-gray-200 bg-white px-1.5 py-1 text-sm font-medium text-gray-800 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                    >
                      {UNIT_OPTIONS.map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </select>
                  </td>

                  {/* PRICE/UNIT */}
                  <td className="border-r border-gray-200 px-1.5 py-1.5 text-right dark:border-gray-700">
                    <input
                      type="number"
                      min="0"
                      placeholder="0"
                      value={row.rate}
                      onChange={(e) => updateRow(idx, 'rate', e.target.value)}
                      className="w-full rounded border border-gray-200 bg-white px-2 py-1 text-right text-sm font-medium text-gray-800 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                    />
                  </td>

                  {/* DISCOUNT (% & AMOUNT) */}
                  <td className="border-r border-gray-200 px-1.5 py-1.5 dark:border-gray-700">
                    <div className="grid grid-cols-2 gap-1">
                      <input
                        type="number"
                        min="0"
                        placeholder="%"
                        value={row.discount_percent}
                        onChange={(e) => updateRow(idx, 'discount_percent', e.target.value)}
                        className="w-full rounded border border-gray-200 bg-white px-1 py-1 text-center text-sm text-gray-800 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                      />
                      <input
                        type="number"
                        min="0"
                        placeholder="₹"
                        value={row.discount_amount}
                        onChange={(e) => updateRow(idx, 'discount_amount', e.target.value)}
                        className="w-full rounded border border-gray-200 bg-white px-1 py-1 text-right text-sm text-gray-800 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                      />
                    </div>
                  </td>

                  {/* AMOUNT (EDITABLE!) */}
                  <td className="border-r border-gray-200 px-1.5 py-1.5 text-right dark:border-gray-700">
                    <input
                      type="number"
                      min="0"
                      placeholder="0"
                      value={row.amount}
                      onChange={(e) => updateRow(idx, 'amount', e.target.value)}
                      className="w-full rounded border border-gray-200 bg-white px-2 py-1 text-right text-sm font-bold text-gray-900 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                    />
                  </td>

                  {/* DELETE */}
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

            {/* TOTAL FOOTER ROW */}
            <tfoot className="border-t-2 border-gray-300 bg-gray-100 font-bold text-gray-800 dark:border-gray-700 dark:bg-gray-750 dark:text-gray-100">
              <tr>
                <td colSpan={2} className="border-r border-gray-300 px-3 py-2.5 text-right uppercase tracking-wider dark:border-gray-600">
                  TOTAL
                </td>
                <td className="border-r border-gray-300 px-2 py-2.5 text-center dark:border-gray-600">
                  {totalQty || 0}
                </td>
                <td className="border-r border-gray-300 px-2 py-2.5 text-center dark:border-gray-600">
                  {totalFreeQty || 0}
                </td>
                <td className="border-r border-gray-300 px-2 py-2.5 dark:border-gray-600" />
                <td className="border-r border-gray-300 px-2 py-2.5 dark:border-gray-600" />
                <td className="border-r border-gray-300 px-2 py-2.5 dark:border-gray-600" />
                <td className="border-r border-gray-300 px-3 py-2.5 text-right text-sm font-extrabold text-brand-600 dark:border-gray-600 dark:text-brand-400">
                  {subtotal.toLocaleString('en-IN')}
                </td>
                <td className="px-2 py-2.5" />
              </tr>
            </tfoot>
          </table>
        </div>

        {/* ADD ROW BUTTON */}
        <div className="border-t border-gray-200 bg-white p-2.5 dark:border-gray-700 dark:bg-gray-800">
          <button
            type="button"
            onClick={addRow}
            className="flex items-center gap-1 rounded border border-blue-400 bg-blue-50/50 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-blue-600 shadow-sm transition hover:bg-blue-100 dark:border-blue-500/50 dark:bg-blue-900/20 dark:text-blue-400"
          >
            <PlusIcon width={14} height={14} /> ADD ROW
          </button>
        </div>
      </div>

      {/* ── BOTTOM SECTION: 3 COLUMNS ──────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* LEFT COLUMN: TERMS & CONDITIONS (4 cols) */}
        <div className="rounded-lg border border-gray-300 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800 lg:col-span-4">
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300">
                Terms & Conditions
              </label>
              <div className="mt-1">
                <select
                  value={form.terms_title}
                  onChange={(e) => setForm({ ...form, terms_title: e.target.value })}
                  className="w-full rounded border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-800 shadow-sm focus:border-brand-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                >
                  <option value="Sale Invoice">Sale Invoice</option>
                  <option value="Standard Terms">Standard Terms</option>
                  <option value="Photography Contract">Photography Contract</option>
                </select>
              </div>
            </div>

            <div>
              <textarea
                rows={5}
                value={form.terms_and_conditions}
                onChange={(e) => setForm({ ...form, terms_and_conditions: e.target.value })}
                className="w-full rounded border border-gray-300 bg-gray-50 p-2.5 text-xs leading-relaxed text-gray-700 shadow-inner focus:border-brand-500 focus:bg-white focus:outline-none dark:border-gray-600 dark:bg-gray-900/50 dark:text-gray-200"
              />
            </div>
          </div>
        </div>

        {/* MIDDLE COLUMN: PAYMENT TYPE & MEDIA (4 cols) */}
        <div className="space-y-3 rounded-lg border border-gray-300 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800 lg:col-span-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300">
                Payment Type
              </label>
              <select
                value={form.payment_type}
                onChange={(e) => setForm({ ...form, payment_type: e.target.value })}
                className="mt-1 w-full rounded border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-800 shadow-sm focus:border-brand-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              >
                {PAYMENT_TYPES.map((pt) => (
                  <option key={pt} value={pt}>
                    {pt}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300">
                No. of copies
              </label>
              <select
                value={form.no_of_copies}
                onChange={(e) => setForm({ ...form, no_of_copies: e.target.value })}
                className="mt-1 w-full rounded border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-800 shadow-sm focus:border-brand-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              >
                {COPY_OPTIONS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300">
              Description
            </label>
            <textarea
              rows={2}
              placeholder="e.g. 12 photo / studio booking note"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="mt-1 w-full rounded border border-gray-300 bg-white p-2 text-xs text-gray-800 shadow-sm focus:border-brand-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            />
          </div>

          {/* Attachment buttons */}
          <div className="flex flex-wrap gap-2 pt-1">
            <input
              type="file"
              accept="image/*"
              ref={imageInputRef}
              onChange={(e) => setAttachedImageName(e.target.files[0]?.name || '')}
              className="hidden"
            />
            <input
              type="file"
              accept=".pdf,.doc,.docx"
              ref={docInputRef}
              onChange={(e) => setAttachedDocName(e.target.files[0]?.name || '')}
              className="hidden"
            />

            <button
              type="button"
              onClick={() => imageInputRef.current?.click()}
              className="flex items-center gap-1.5 rounded border border-gray-300 bg-gray-50 px-2.5 py-1.5 text-xs font-semibold text-gray-700 shadow-sm transition hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
            >
              📷 {attachedImageName ? attachedImageName.slice(0, 12) + '…' : 'ADD IMAGE'}
            </button>

            <button
              type="button"
              onClick={() => docInputRef.current?.click()}
              className="flex items-center gap-1.5 rounded border border-gray-300 bg-gray-50 px-2.5 py-1.5 text-xs font-semibold text-gray-700 shadow-sm transition hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
            >
              📄 {attachedDocName ? attachedDocName.slice(0, 12) + '…' : 'ADD DOCUMENT'}
            </button>
          </div>
        </div>

        {/* RIGHT COLUMN: FINANCIAL TOTALS & RECEIVED PANEL (4 cols) */}
        <div className="flex flex-col justify-between rounded-lg border border-gray-300 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800 lg:col-span-4">
          <div className="space-y-2.5 text-xs">
            {/* Discount */}
            <div className="flex items-center justify-between">
              <span className="font-semibold text-gray-600 dark:text-gray-300">Discount</span>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={form.discount}
                  onChange={(e) => setForm({ ...form, discount: e.target.value })}
                  className="h-8 w-28 rounded border border-gray-300 bg-white px-2 text-right font-medium text-gray-800 shadow-sm focus:border-brand-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                />
              </div>
            </div>

            {/* Round off */}
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer font-semibold text-gray-600 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={form.round_off}
                  onChange={(e) => setForm({ ...form, round_off: e.target.checked })}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                Round off
              </label>
              <span className="font-medium text-gray-500">
                {form.round_off ? (finalTotal - rawTotal).toFixed(2) : '0.00'}
              </span>
            </div>

            {/* Total */}
            <div className="flex items-center justify-between border-t border-gray-200 pt-2 text-sm font-bold dark:border-gray-700">
              <span className="text-gray-700 dark:text-gray-200">Total</span>
              <span className="text-base font-extrabold text-brand-600 dark:text-brand-400">
                {formatCurrency(finalTotal)}
              </span>
            </div>

            {/* Received */}
            <div className="flex items-center justify-between border-t border-gray-200 pt-2 dark:border-gray-700">
              <label className="flex items-center gap-2 cursor-pointer font-semibold text-gray-700 dark:text-gray-200">
                <input
                  type="checkbox"
                  checked={form.received_checked}
                  onChange={(e) => {
                    const checked = e.target.checked
                    setForm({
                      ...form,
                      received_checked: checked,
                      received: 0,
                    })
                  }}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                Received
              </label>
              <input
                type="number"
                min="0"
                max={finalTotal}
                disabled={!form.received_checked}
                placeholder="0"
                value={form.received_checked ? (form.received ?? 0) : ''}
                onChange={(e) => setForm({ ...form, received: e.target.value })}
                className="h-8 w-28 rounded border border-gray-300 bg-white px-2 text-right font-medium text-gray-800 shadow-sm disabled:bg-gray-100 disabled:text-gray-400 focus:border-brand-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:disabled:bg-gray-700/50"
              />
            </div>

            {/* Balance */}
            <div className="flex items-center justify-between border-t border-gray-200 pt-2 text-sm font-bold dark:border-gray-700">
              <span className="text-gray-700 dark:text-gray-200">Balance</span>
              <span className={balanceDue > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}>
                {formatCurrency(balanceDue)}
              </span>
            </div>
          </div>

          {/* ACTION BUTTONS (WhatsApp Auto-Send & Save) */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 pt-3 dark:border-gray-700">
            {/* WhatsApp Auto-Send Toggle */}
            <label
              className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold border transition cursor-pointer select-none ${
                autoSendWhatsApp && form.phone?.trim()
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-600 shadow-sm'
                  : 'border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400'
              }`}
              title={
                form.phone?.trim()
                  ? `After saving, you can send the invoice PDF to ${form.phone} from your WhatsApp`
                  : 'Enter a customer phone number above to send WhatsApp PDF'
              }
            >
              <input
                type="checkbox"
                checked={autoSendWhatsApp}
                onChange={(e) => setAutoSendWhatsApp(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
              />
              <WhatsAppIcon width={16} height={16} className={autoSendWhatsApp && form.phone?.trim() ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400'} />
              <span>
                Send PDF on WhatsApp
                {form.phone?.trim() ? (
                  <span className="font-mono text-[11px] font-bold ml-1 text-emerald-700 dark:text-emerald-300">
                    ({form.phone.trim()})
                  </span>
                ) : (
                  <span className="text-[10px] text-gray-400 ml-1">(Enter phone above)</span>
                )}
              </span>
            </label>

            <div className="flex items-center gap-2">
              <Link
                to="/invoices"
                className="rounded px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                Cancel
              </Link>

              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-1.5 rounded-md bg-blue-600 px-6 py-2 text-xs font-bold uppercase tracking-wider text-white shadow-md transition hover:bg-blue-700 active:scale-95 disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save Invoice'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── CLIENT MODAL ──────────────────────────────────────────────── */}
      <ClientFormModal
        open={clientModalOpen}
        onClose={() => setClientModalOpen(false)}
        onSaved={(newClient) => {
          if (!newClient) return
          setClients((list) =>
            [...list, newClient].sort((a, b) => a.name.localeCompare(b.name))
          )
          handleClientSelect(newClient)
        }}
      />
    </div>
  )
}
