import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import PageHeader from '../components/PageHeader'
import Modal from '../components/Modal'
import SelectWithOther from '../components/SelectWithOther'
import EmptyState from '../components/EmptyState'
import { TableSkeleton } from '../components/Loaders'
import { useToast } from '../contexts/ToastContext'
import { useConfirm } from '../contexts/ConfirmContext'
import { PlusIcon, TrashIcon, ExpenseIcon, EditIcon, SearchIcon, PhoneIcon } from '../components/icons'
import { EXPENSE_CATEGORIES, formatCurrency, formatDate } from '../lib/format'

const today = () => new Date().toISOString().slice(0, 10)

// Keeps only digits and a single decimal point.
const cleanDecimal = (v) => v.replace(/[^\d.]/g, '').replace(/^(\d*\.\d*).*$/, '$1')

const emptyItemRow = () => ({
  item: '',
  quantity: 1,
  amount: '',
})

const PAYMENT_MODES = ['Cash', 'UPI', 'Cheque', 'NEFT', 'RTGS', 'IMPS', 'Bank Transfer', 'Debit / Credit Card', 'Net Banking']

const emptyForm = {
  expense_date: today(),
  category: 'Equipment',
  payment_mode: 'Cash',
  payment_ref: '',
  name: '',
  phone: '',
  address: '',
  items: [emptyItemRow()],
  transportation: '',
  other_charges: '',
  gst_charges: '',
  amount: 0,
  description: '',
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const monthKey = (dateStr) => (dateStr ? dateStr.slice(0, 7) : '')

function computeTotal(items, transport, other, gst) {
  const itemsTotal = (items || []).reduce((s, it) => s + (Number(it.amount) || 0), 0)
  const t = Number(transport) || 0
  const o = Number(other) || 0
  const g = Number(gst) || 0
  return Number((itemsTotal + t + o + g).toFixed(2))
}

function parseExpense(exp) {
  let meta = null
  if (exp.description && typeof exp.description === 'string' && exp.description.startsWith('__EXPENSE_META__:')) {
    try {
      meta = JSON.parse(exp.description.replace('__EXPENSE_META__:', ''))
    } catch {
      // ignore
    }
  }

  // Determine items array
  let items = []
  if (Array.isArray(exp.items) && exp.items.length > 0) {
    items = exp.items
  } else if (Array.isArray(meta?.items) && meta.items.length > 0) {
    items = meta.items
  } else if (exp.item || meta?.item) {
    items = [
      {
        item: exp.item || meta?.item || '',
        quantity: exp.quantity != null ? exp.quantity : (meta?.quantity != null ? meta.quantity : 1),
        amount: exp.amount != null ? exp.amount : '',
      },
    ]
  }

  const transport = exp.transportation != null ? exp.transportation : (meta?.transportation != null ? meta.transportation : '')
  const otherCharges = exp.other_charges != null ? exp.other_charges : (meta?.other_charges != null ? meta.other_charges : '')

  return {
    ...exp,
    name: exp.name || meta?.name || '',
    phone: exp.phone || exp.mobile_number || meta?.phone || meta?.mobile_number || '',
    address: exp.address || meta?.address || '',
    items: items,
    transportation: transport,
    other_charges: otherCharges,
    gst_charges: exp.gst_charges != null ? exp.gst_charges : (meta?.gst_charges != null ? meta.gst_charges : ''),
    payment_mode: exp.payment_mode || meta?.payment_mode || '',
    payment_ref: exp.payment_ref || meta?.payment_ref || '',
    description: meta ? (meta.description || '') : (exp.description || ''),
  }
}

export default function Expenses() {
  const { notify } = useToast()
  const confirm = useConfirm()
  const [expenses, setExpenses] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingExpense, setEditingExpense] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [period, setPeriod] = useState(() => new Date().toISOString().slice(0, 7))
  const [search, setSearch] = useState('')

  const load = async () => {
    setLoading(true)
    const { data } = await supabase.from('expenses').select('*').order('expense_date', { ascending: false })
    const parsed = (data || []).map(parseExpense)
    setExpenses(parsed)
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const handleOpenAdd = () => {
    setEditingExpense(null)
    setForm(emptyForm)
    setModalOpen(true)
  }

  const handleEdit = (exp) => {
    setEditingExpense(exp)
    const items = Array.isArray(exp.items) && exp.items.length > 0
      ? exp.items.map((it) => ({
          item: it.item || '',
          quantity: it.quantity != null ? it.quantity : 1,
          amount: it.amount != null ? it.amount : '',
        }))
      : [emptyItemRow()]

    const totalAmt = computeTotal(items, exp.transportation, exp.other_charges, exp.gst_charges)

    setForm({
      expense_date: exp.expense_date || today(),
      category: exp.category || 'Equipment',
      payment_mode: exp.payment_mode || 'Cash',
      payment_ref: exp.payment_ref || '',
      name: exp.name || '',
      phone: exp.phone || exp.mobile_number || '',
      address: exp.address || '',
      items,
      transportation: exp.transportation !== '' && exp.transportation != null ? exp.transportation : '',
      other_charges: exp.other_charges !== '' && exp.other_charges != null ? exp.other_charges : '',
      gst_charges: exp.gst_charges !== '' && exp.gst_charges != null ? exp.gst_charges : '',
      amount: totalAmt > 0 ? totalAmt : (exp.amount || 0),
      description: exp.description || '',
    })
    setModalOpen(true)
  }

  // Row operations for items in bill
  const handleItemChange = (index, field, value) => {
    setForm((prev) => {
      const nextItems = [...prev.items]
      nextItems[index] = { ...nextItems[index], [field]: value }
      const totalAmt = computeTotal(nextItems, prev.transportation, prev.other_charges, prev.gst_charges)
      return { ...prev, items: nextItems, amount: totalAmt }
    })
  }

  const addItemRow = () => {
    setForm((prev) => ({
      ...prev,
      items: [...prev.items, emptyItemRow()],
    }))
  }

  const removeItemRow = (index) => {
    setForm((prev) => {
      const nextItems = prev.items.filter((_, i) => i !== index)
      const rows = nextItems.length > 0 ? nextItems : [emptyItemRow()]
      const totalAmt = computeTotal(rows, prev.transportation, prev.other_charges, prev.gst_charges)
      return { ...prev, items: rows, amount: totalAmt }
    })
  }

  // Handle transportation or other charges changes
  const handleExtraChargeChange = (field, value) => {
    setForm((prev) => {
      const nextForm = { ...prev, [field]: value }
      const totalAmt = computeTotal(nextForm.items, nextForm.transportation, nextForm.other_charges, nextForm.gst_charges)
      return { ...nextForm, amount: totalAmt }
    })
  }

  const save = async (e) => {
    e.preventDefault()
    setSaving(true)

    // Filter valid rows
    const validItems = form.items.filter(
      (it) => (it.item && it.item.trim()) || Number(it.amount) > 0
    )

    const itemsPayload = validItems.map((it) => ({
      item: it.item?.trim() || '',
      quantity: it.quantity !== '' && !isNaN(Number(it.quantity)) ? Number(it.quantity) : 1,
      amount: Number(it.amount) || 0,
    }))

    const transportVal = form.transportation !== '' && !isNaN(Number(form.transportation)) ? Number(form.transportation) : 0
    const otherVal = form.other_charges !== '' && !isNaN(Number(form.other_charges)) ? Number(form.other_charges) : 0
    const gstVal = form.gst_charges !== '' && !isNaN(Number(form.gst_charges)) ? Number(form.gst_charges) : 0
    const finalAmount = computeTotal(itemsPayload, transportVal, otherVal, gstVal)

    const itemsSummary = itemsPayload.map((it) => it.item).filter(Boolean).join(', ') || null
    const totalQuantity = itemsPayload.reduce((s, it) => s + (Number(it.quantity) || 1), 0)

    const payload = {
      expense_date: form.expense_date || today(),
      category: form.category || 'Other',
      payment_mode: form.payment_mode || null,
      payment_ref: form.payment_ref?.trim() || null,
      name: form.name?.trim() || null,
      phone: form.phone?.trim() || null,
      address: form.address?.trim() || null,
      items: itemsPayload,
      item: itemsSummary,
      quantity: totalQuantity,
      transportation: transportVal,
      other_charges: otherVal,
      gst_charges: gstVal,
      description: form.description?.trim() || null,
      amount: finalAmount > 0 ? finalAmount : (Number(form.amount) || 0),
    }

    // Schema fallback if migrations have not been run in Supabase SQL editor yet
    const meta = {
      name: payload.name,
      phone: payload.phone,
      address: payload.address,
      items: payload.items,
      transportation: payload.transportation,
      other_charges: payload.other_charges,
      gst_charges: payload.gst_charges,
      payment_mode: payload.payment_mode,
      payment_ref: payload.payment_ref,
      description: payload.description,
    }
    const fallbackPayload = {
      expense_date: payload.expense_date,
      category: payload.category,
      amount: payload.amount,
      description: `__EXPENSE_META__:${JSON.stringify(meta)}`,
    }

    try {
      if (editingExpense) {
        let { error } = await supabase.from('expenses').update(payload).eq('id', editingExpense.id)
        if (error && (error.code === 'PGRST204' || error.message?.includes('does not exist'))) {
          const { error: err2 } = await supabase.from('expenses').update(fallbackPayload).eq('id', editingExpense.id)
          if (err2) throw err2
        } else if (error) {
          throw error
        }
        notify('Expense updated')
      } else {
        let { error } = await supabase.from('expenses').insert(payload)
        if (error && (error.code === 'PGRST204' || error.message?.includes('does not exist'))) {
          const { error: err2 } = await supabase.from('expenses').insert(fallbackPayload)
          if (err2) throw err2
        } else if (error) {
          throw error
        }
        notify('Expense added')
      }
      setModalOpen(false)
      setForm(emptyForm)
      setEditingExpense(null)
      load()
    } catch (err) {
      console.error('Failed to save expense:', err)
      notify(err.message || 'Failed to save expense', 'error')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (exp) => {
    const ok = await confirm({
      title: 'Delete expense?',
      message: 'This entry will be permanently removed.',
      confirmText: 'Delete',
    })
    if (!ok) return
    await supabase.from('expenses').delete().eq('id', exp.id)
    notify('Expense deleted')
    load()
  }

  // Months that have expenses, newest first, for the period selector.
  const availableMonths = useMemo(() => {
    const keys = new Set([new Date().toISOString().slice(0, 7)])
    expenses.forEach((e) => e.expense_date && keys.add(monthKey(e.expense_date)))
    return [...keys].sort().reverse()
  }, [expenses])

  const monthLabel = (key) => {
    const [y, m] = key.split('-')
    return `${MONTH_NAMES[Number(m) - 1]} ${y}`
  }

  const filtered = useMemo(() => {
    let list = period === 'all' ? expenses : expenses.filter((e) => monthKey(e.expense_date) === period)
    const q = search.trim().toLowerCase()
    if (q) {
      list = list.filter((e) => {
        const nameMatch = (e.name || '').toLowerCase().includes(q)
        const phoneMatch = (e.phone || '').toLowerCase().includes(q)
        const addressMatch = (e.address || '').toLowerCase().includes(q)
        const catMatch = (e.category || '').toLowerCase().includes(q) ||
          (e.payment_mode || '').toLowerCase().includes(q) ||
          (e.payment_ref || '').toLowerCase().includes(q)
        const descMatch = (e.description || '').toLowerCase().includes(q)
        const itemsMatch = Array.isArray(e.items) && e.items.some((it) => (it.item || '').toLowerCase().includes(q))
        return nameMatch || phoneMatch || addressMatch || catMatch || descMatch || itemsMatch
      })
    }
    return list
  }, [expenses, period, search])

  const total = useMemo(
    () => filtered.reduce((sum, e) => sum + (Number(e.amount) || 0), 0),
    [filtered]
  )

  const allTimeTotal = useMemo(
    () => expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0),
    [expenses]
  )

  // Per-category totals for the selected period.
  const byCategory = useMemo(() => {
    const map = {}
    filtered.forEach((e) => {
      const c = e.category || 'Other'
      map[c] = (map[c] || 0) + (Number(e.amount) || 0)
    })
    return Object.entries(map).sort((a, b) => b[1] - a[1])
  }, [filtered])

  // Items subtotal inside the form
  const itemsSubtotal = useMemo(
    () => form.items.reduce((s, it) => s + (Number(it.amount) || 0), 0),
    [form.items]
  )

  return (
    <div>
      <PageHeader
        title="Expenses"
        subtitle="Track business costs to measure profit"
        action={
          <button onClick={handleOpenAdd} className="btn-primary">
            <PlusIcon /> Add Expense
          </button>
        }
      />

      {/* Filter and Search Bar */}
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="label">Period</label>
            <select className="input max-w-[200px]" value={period} onChange={(e) => setPeriod(e.target.value)}>
              <option value="all">All time</option>
              {availableMonths.map((k) => (
                <option key={k} value={k}>
                  {monthLabel(k)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="w-full sm:w-auto">
          <label className="label">Search</label>
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
              <SearchIcon width={16} height={16} />
            </span>
            <input
              type="text"
              placeholder="Search party, item, mobile..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input pl-9 w-full sm:w-64"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-xs text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="card bg-gradient-to-br from-amber-50 to-white dark:from-gray-800 dark:to-gray-800">
          <span className="text-sm text-gray-500">
            {period === 'all' ? 'Total (all time)' : `Total — ${monthLabel(period)}`}
          </span>
          <span className="mt-1 block text-2xl font-bold text-amber-700 dark:text-amber-400">
            {formatCurrency(total)}
          </span>
        </div>
        <div className="card">
          <span className="text-sm text-gray-500">All-time expenses</span>
          <span className="mt-1 block text-2xl font-bold">{formatCurrency(allTimeTotal)}</span>
        </div>
        <div className="card">
          <span className="text-sm text-gray-500">Entries in period</span>
          <span className="mt-1 block text-2xl font-bold">{filtered.length}</span>
        </div>
      </div>

      {byCategory.length > 0 && (
        <div className="card mb-4">
          <h3 className="mb-3 text-sm font-semibold text-gray-600 dark:text-gray-300">
            By category {period !== 'all' && `· ${monthLabel(period)}`}
          </h3>
          <div className="flex flex-wrap gap-2">
            {byCategory.map(([cat, amt]) => (
              <span
                key={cat}
                className="badge bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200"
              >
                {cat}: {formatCurrency(amt)}
              </span>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <TableSkeleton cols={6} />
      ) : expenses.length === 0 ? (
        <EmptyState
          icon={ExpenseIcon}
          title="No expenses recorded"
          description="Track costs like equipment, vendor bills, and travel to measure your real profit."
          action={
            <button onClick={handleOpenAdd} className="btn-primary">
              <PlusIcon /> Add Expense
            </button>
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={ExpenseIcon}
          title="No expenses match your filter"
          description={search ? `No expenses matching "${search}". Clear search to view all.` : 'Pick a different month or choose “All time”.'}
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left dark:bg-gray-800">
              <tr>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Party / Vendor</th>
                <th className="px-4 py-3 font-medium">Items & Details</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 text-right font-medium">Total Bill Amount</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {filtered.map((e) => (
                <tr key={e.id} className="row-hover bg-white dark:bg-gray-900/40">
                  <td className="px-4 py-3 whitespace-nowrap text-gray-600 dark:text-gray-300">
                    {formatDate(e.expense_date)}
                  </td>
                  <td className="px-4 py-3">
                    {e.name ? (
                      <div>
                        <div className="font-semibold text-gray-900 dark:text-gray-100">{e.name}</div>
                        {e.phone && (
                          <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            <PhoneIcon width={12} height={12} />
                            <span>{e.phone}</span>
                          </div>
                        )}
                        {e.address && (
                          <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 truncate max-w-[200px]" title={e.address}>
                            {e.address}
                          </div>
                        )}
                      </div>
                    ) : e.phone ? (
                      <div className="flex items-center gap-1 text-xs text-gray-700 dark:text-gray-300">
                        <PhoneIcon width={12} height={12} />
                        <span>{e.phone}</span>
                      </div>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {Array.isArray(e.items) && e.items.length > 0 ? (
                      <div>
                        {e.items.length === 1 ? (
                          <div>
                            <div className="font-medium text-gray-800 dark:text-gray-200">
                              {e.items[0].item || 'Expense Item'}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                              Qty: {e.items[0].quantity || 1} · {formatCurrency(e.items[0].amount)}
                            </div>
                          </div>
                        ) : (
                          <div>
                            <div className="flex items-center gap-1.5 font-medium text-gray-800 dark:text-gray-200">
                              <span>{e.items[0].item || 'Item'}</span>
                              <span className="badge bg-brand-50 text-brand-700 dark:bg-brand-950/40 dark:text-brand-300 text-[11px] font-normal">
                                +{e.items.length - 1} more items
                              </span>
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                              {e.items.slice(0, 3).map((it, idx) => (
                                <span key={idx}>
                                  {it.item} (Qty: {it.quantity || 1})
                                </span>
                              ))}
                              {e.items.length > 3 && (
                                <span className="text-gray-400">+{e.items.length - 3} more</span>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Extra Charges breakdown tags */}
                        {(Number(e.transportation) > 0 || Number(e.other_charges) > 0 || Number(e.gst_charges) > 0) && (
                          <div className="mt-1 flex flex-wrap gap-1.5 text-[11px]">
                            {Number(e.gst_charges) > 0 && (
                              <span className="badge bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                                GST: +{formatCurrency(e.gst_charges)}
                              </span>
                            )}
                            {Number(e.transportation) > 0 && (
                              <span className="badge bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                                Transport: +{formatCurrency(e.transportation)}
                              </span>
                            )}
                            {Number(e.other_charges) > 0 && (
                              <span className="badge bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300">
                                Other: +{formatCurrency(e.other_charges)}
                              </span>
                            )}
                          </div>
                        )}

                        {e.description && (
                          <div className="text-xs text-gray-400 dark:text-gray-500 italic mt-0.5 truncate max-w-xs" title={e.description}>
                            {e.description}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div>
                        {e.description && (
                          <span className="text-gray-700 dark:text-gray-300">{e.description}</span>
                        )}
                        {(Number(e.transportation) > 0 || Number(e.other_charges) > 0) && (
                          <div className="mt-1 flex flex-wrap gap-1.5 text-[11px]">
                            {Number(e.transportation) > 0 && (
                              <span className="badge bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                                Transport: +{formatCurrency(e.transportation)}
                              </span>
                            )}
                            {Number(e.other_charges) > 0 && (
                              <span className="badge bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300">
                                Other: +{formatCurrency(e.other_charges)}
                              </span>
                            )}
                          </div>
                        )}
                        {!e.description && !e.transportation && !e.other_charges && (
                          <span className="text-gray-400">-</span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="badge bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                      {e.category}
                    </span>
                    {e.payment_mode && (
                      <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        {e.payment_mode}
                        {e.payment_ref ? ` · ${e.payment_ref}` : ''}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900 dark:text-gray-100 whitespace-nowrap">
                    {formatCurrency(e.amount)}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleEdit(e)}
                        className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-brand-600 dark:hover:bg-gray-800"
                        title="Edit expense"
                      >
                        <EditIcon width={16} height={16} />
                      </button>
                      <button
                        onClick={() => remove(e)}
                        className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30"
                        title="Delete expense"
                      >
                        <TrashIcon width={16} height={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add / Edit Expense Modal */}
      <Modal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false)
          setEditingExpense(null)
        }}
        title={editingExpense ? 'Edit Expense' : 'Add Expense'}
        size="lg"
      >
        <form onSubmit={save} className="space-y-4">
          {/* Top row: Date and Category */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Date *</label>
              <input
                type="date"
                required
                className="input"
                value={form.expense_date}
                onChange={(e) => setForm({ ...form, expense_date: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Category *</label>
              <SelectWithOther
                options={EXPENSE_CATEGORIES}
                value={form.category}
                onChange={(v) => setForm({ ...form, category: v })}
                placeholder="Enter category"
                required
              />
            </div>
            <div>
              <label className="label">Payment Mode</label>
              <select
                className="input"
                value={form.payment_mode}
                onChange={(e) => setForm({ ...form, payment_mode: e.target.value })}
              >
                {PAYMENT_MODES.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">UTR / Cheque No.</label>
              <input
                type="text"
                placeholder="e.g. UTR / transaction ID / cheque number"
                className="input"
                value={form.payment_ref}
                onChange={(e) => setForm({ ...form, payment_ref: e.target.value })}
              />
            </div>
          </div>

          {/* Party Details */}
          <div className="rounded-lg border border-gray-100 bg-gray-50/60 p-3.5 dark:border-gray-700/60 dark:bg-gray-800/40">
            <h4 className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Party / Vendor Details
            </h4>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="label">Name</label>
                <input
                  type="text"
                  placeholder="e.g. Rahul Sharma / Raj Store"
                  className="input"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Mobile / Phone Number</label>
                <input
                  type="tel"
                  placeholder="e.g. 9876543210"
                  className="input"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="label">Address</label>
                <input
                  type="text"
                  placeholder="e.g. Shop 4, Market Road, Pune"
                  className="input"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                />
              </div>
            </div>
          </div>

          {/* Multiple Bill Items (Quantity & Amount, No Rate) */}
          <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-3.5 dark:border-gray-700/60 dark:bg-gray-800/30">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-200">
                  Bill Items
                </h4>
                <p className="text-xs text-gray-400 mt-0.5">
                  Add multiple items from party bill with quantity and amount
                </p>
              </div>
              <button
                type="button"
                onClick={addItemRow}
                className="btn-secondary flex items-center gap-1.5 py-1 px-2.5 text-xs"
              >
                <PlusIcon width={14} height={14} /> Add Item
              </button>
            </div>

            {/* Column Headers for sm screens */}
            <div className="hidden grid-cols-12 gap-2 pb-1.5 text-xs font-medium text-gray-500 sm:grid px-1">
              <div className="col-span-6">Item Name / Description</div>
              <div className="col-span-2 text-center">Quantity</div>
              <div className="col-span-3 text-right">Amount (₹)</div>
              <div className="col-span-1"></div>
            </div>

            {/* Items Rows */}
            <div className="space-y-2">
              {form.items.map((row, idx) => (
                <div
                  key={idx}
                  className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-white p-2.5 sm:grid sm:grid-cols-12 sm:items-center sm:gap-2 sm:border-0 sm:bg-transparent sm:p-0 dark:border-gray-700 dark:bg-gray-800/60 sm:dark:bg-transparent"
                >
                  <div className="sm:col-span-6">
                    <label className="text-xs font-medium text-gray-500 sm:hidden">Item Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Memory Card, Stand, Paper..."
                      className="input text-sm"
                      value={row.item}
                      onChange={(e) => handleItemChange(idx, 'item', e.target.value)}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-xs font-medium text-gray-500 sm:hidden">Quantity</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="1"
                      className="input text-sm text-center"
                      value={row.quantity}
                      onChange={(e) => handleItemChange(idx, 'quantity', cleanDecimal(e.target.value))}
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <label className="text-xs font-medium text-gray-500 sm:hidden">Amount (₹)</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="0.00"
                      className="input text-sm text-right font-medium"
                      value={row.amount}
                      onChange={(e) => handleItemChange(idx, 'amount', cleanDecimal(e.target.value))}
                    />
                  </div>
                  <div className="flex justify-end sm:col-span-1 sm:justify-center">
                    <button
                      type="button"
                      onClick={() => removeItemRow(idx)}
                      disabled={form.items.length <= 1}
                      className="rounded p-1.5 text-gray-400 hover:text-red-500 disabled:opacity-20 transition"
                      title="Remove item"
                    >
                      <TrashIcon width={16} height={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-3 flex justify-start">
              <button
                type="button"
                onClick={addItemRow}
                className="text-xs font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400 flex items-center gap-1"
              >
                <PlusIcon width={14} height={14} /> Add another item
              </button>
            </div>
          </div>

          {/* Extra Expenses / Additional Charges Section */}
          <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-3.5 dark:border-gray-700/60 dark:bg-gray-800/30">
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-200">
              Extra Expenses / Additional Charges
            </h4>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="label">Transportation / Shipping (₹)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="0.00"
                  className="input font-medium"
                  value={form.transportation}
                  onChange={(e) => handleExtraChargeChange('transportation', cleanDecimal(e.target.value))}
                />
              </div>
              <div>
                <label className="label">Other Charges / Handling (₹)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="0.00"
                  className="input font-medium"
                  value={form.other_charges}
                  onChange={(e) => handleExtraChargeChange('other_charges', cleanDecimal(e.target.value))}
                />
              </div>
              <div>
                <label className="label">GST Charges (₹)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="0.00"
                  className="input font-medium"
                  value={form.gst_charges}
                  onChange={(e) => handleExtraChargeChange('gst_charges', cleanDecimal(e.target.value))}
                />
              </div>
            </div>

            {/* Bill Summary Calculation */}
            <div className="mt-3.5 rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800/80">
              <div className="space-y-1 text-xs text-gray-500 dark:text-gray-400">
                <div className="flex justify-between">
                  <span>Items Subtotal:</span>
                  <span className="font-medium text-gray-700 dark:text-gray-300">
                    {formatCurrency(itemsSubtotal)}
                  </span>
                </div>
                {Number(form.transportation) > 0 && (
                  <div className="flex justify-between text-blue-600 dark:text-blue-400">
                    <span>+ Transportation:</span>
                    <span className="font-medium">+{formatCurrency(form.transportation)}</span>
                  </div>
                )}
                {Number(form.other_charges) > 0 && (
                  <div className="flex justify-between text-purple-600 dark:text-purple-400">
                    <span>+ Other Charges:</span>
                    <span className="font-medium">+{formatCurrency(form.other_charges)}</span>
                  </div>
                )}
                {Number(form.gst_charges) > 0 && (
                  <div className="flex justify-between text-amber-600 dark:text-amber-400">
                    <span>+ GST Charges:</span>
                    <span className="font-medium">+{formatCurrency(form.gst_charges)}</span>
                  </div>
                )}
              </div>
              <div className="mt-2 flex items-center justify-between border-t border-gray-100 pt-2 dark:border-gray-700">
                <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  Total Bill Amount:
                </span>
                <span className="text-lg font-bold text-brand-600 dark:text-brand-400">
                  {formatCurrency(form.amount || 0)}
                </span>
              </div>
            </div>
          </div>

          {/* Description / Remarks */}
          <div>
            <label className="label">Notes / Description (Optional)</label>
            <textarea
              rows={2}
              placeholder="Additional notes, bill receipt number, or details..."
              className="input"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => {
                setModalOpen(false)
                setEditingExpense(null)
              }}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Saving…' : editingExpense ? 'Update Expense' : 'Save Expense'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
