import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import PageHeader from '../components/PageHeader'
import EmptyState from '../components/EmptyState'
import StatusBadge from '../components/StatusBadge'
import Modal from '../components/Modal'
import DateField from '../components/DateField'
import { TableSkeleton } from '../components/Loaders'
import { useToast } from '../contexts/ToastContext'
import { useConfirm } from '../contexts/ConfirmContext'
import { useSortPaginate } from '../lib/useSortPaginate'
import { downloadCsv } from '../lib/csv'
import { PlusIcon, InvoiceIcon, WalletIcon, TrashIcon, ArrowUpDownIcon, CalendarIcon } from '../components/icons'
import { formatCurrency, formatDate, formatTime, INVOICE_STATUSES } from '../lib/format'

const today = () => new Date().toISOString().slice(0, 10)
const PAYMENT_MODES = ['Cash', 'Online / UPI', 'Cheque', 'Bank Transfer', 'Card']
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const formatLocalYMD = (d) => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const getValue = (inv, key) => {
  switch (key) {
    case 'client':
      return (inv.client?.name || '').toLowerCase()
    case 'phone':
      return inv.client?.phone || ''
    case 'issue_date': {
      const datePart = inv.issue_date || (inv.created_at ? inv.created_at.slice(0, 10) : '')
      if (!datePart) return inv.created_at ? new Date(inv.created_at).getTime() : 0
      if (inv.created_at) {
        const d = new Date(inv.created_at)
        if (!isNaN(d.getTime())) {
          const hh = String(d.getHours()).padStart(2, '0')
          const mm = String(d.getMinutes()).padStart(2, '0')
          const ss = String(d.getSeconds()).padStart(2, '0')
          const ms = String(d.getMilliseconds()).padStart(3, '0')
          return `${datePart}T${hh}:${mm}:${ss}.${ms}`
        }
      }
      return `${datePart}T00:00:00.000`
    }
    case 'total':
      return Number(inv.total) || 0
    case 'paid_amount':
      return Number(inv.paid_amount) || 0
    case 'balance':
      return Number(inv.balance) || 0
    case 'status':
      return inv.status || ''
    default:
      return ''
  }
}

function SortableTh({ label, sortKey, state, onSort, className = '' }) {
  const active = state.sortKey === sortKey
  return (
    <th className={`px-4 py-3 font-medium ${className}`}>
      <button onClick={() => onSort(sortKey)} className="inline-flex items-center gap-1 hover:text-brand-600">
        {label}
        <ArrowUpDownIcon width={13} height={13} className={active ? 'text-brand-600' : 'text-gray-300'} />
      </button>
    </th>
  )
}

export default function Invoices() {
  const navigate = useNavigate()
  const { notify } = useToast()
  const confirm = useConfirm()
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [dateFilter, setDateFilter] = useState('today')
  const [previousDateFilter, setPreviousDateFilter] = useState('today')
  const [selectedDay, setSelectedDay] = useState('')
  const [appliedCustomRange, setAppliedCustomRange] = useState(() => {
    const todayStr = formatLocalYMD(new Date())
    return { start: todayStr, end: todayStr }
  })
  const [draftCustomRange, setDraftCustomRange] = useState(() => {
    const todayStr = formatLocalYMD(new Date())
    return { start: todayStr, end: todayStr }
  })

  const handleDropdownChange = (newVal) => {
    if (newVal === 'custom') {
      if (dateFilter !== 'custom') {
        setPreviousDateFilter(dateFilter)
        const todayStr = formatLocalYMD(new Date())
        const todayRange = { start: todayStr, end: todayStr }
        setAppliedCustomRange(todayRange)
        setDraftCustomRange(todayRange)
      }
      setDateFilter('custom')
    } else {
      setDateFilter(newVal)
      setPreviousDateFilter(newVal)
    }
  }

  const handlePickDay = (value) => {
    if (!value) return
    setSelectedDay(value)
    handleDropdownChange('day')
  }

  const handleApplyCustom = () => {
    setAppliedCustomRange({ ...draftCustomRange })
    setPreviousDateFilter('custom')
  }

  const handleCancelCustom = () => {
    setDraftCustomRange({ ...appliedCustomRange })
    if (previousDateFilter && previousDateFilter !== 'custom') {
      setDateFilter(previousDateFilter)
    } else {
      setDateFilter('today')
      setPreviousDateFilter('today')
    }
  }

  const [exportModalOpen, setExportModalOpen] = useState(false)
  const [exportRange, setExportRange] = useState({ start: '', end: '' })

  // Payment Modal state
  const [payModalOpen, setPayModalOpen] = useState(false)
  const [activeInv, setActiveInv] = useState(null)
  const [payForm, setPayForm] = useState({
    amount: '',
    payment_date: today(),
    mode: 'Cash',
    note: '',
  })
  const [savingPayment, setSavingPayment] = useState(false)

  const load = async () => {
    setLoading(true)
    const [{ data: invData }, { data: payData }] = await Promise.all([
      supabase
        .from('invoices')
        .select('*, client:clients(name, phone)')
        .order('issue_date', { ascending: false })
        .order('created_at', { ascending: false }),
      supabase.from('payments').select('invoice_id, amount'),
    ])

    const paidMap = {}
    ;(payData || []).forEach((p) => {
      paidMap[p.invoice_id] = (paidMap[p.invoice_id] || 0) + (Number(p.amount) || 0)
    })

    const enriched = (invData || []).map((inv) => {
      const paid = paidMap[inv.id] || 0
      const total = Number(inv.total) || 0
      const balance = Math.max(0, total - paid)
      return {
        ...inv,
        paid_amount: paid,
        balance,
      }
    })

    setInvoices(enriched)
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const periodLabel = (key) => {
    if (key === 'all') return 'All time'
    if (!key.includes('-')) return key
    const [y, m] = key.split('-')
    return `${MONTH_NAMES[Number(m) - 1]} ${y}`
  }

  const activeRangeLabel = useMemo(() => {
    const todayDate = new Date()
    const y = todayDate.getFullYear()
    const m = todayDate.getMonth()

    switch (dateFilter) {
      case 'today':
        return 'Today'
      case 'day':
        return formatDate(selectedDay)
      case 'this_week':
        return 'This Week'
      case 'this_month':
        return `This Month (${MONTH_NAMES[m]})`
      case 'this_year':
        return `This Year (${y})`
      case 'all':
        return 'All Time'
      case 'custom': {
        const { start, end } = appliedCustomRange
        if (start && end) return `${formatDate(start)} – ${formatDate(end)}`
        if (start) return `From ${formatDate(start)}`
        if (end) return `Until ${formatDate(end)}`
        return 'Custom Range'
      }
      default:
        return periodLabel(dateFilter)
    }
  }, [dateFilter, appliedCustomRange])

  const isDateInFilter = useMemo(() => {
    const todayDate = new Date()
    const todayStr = formatLocalYMD(todayDate)

    // Current week: Monday to Sunday
    const day = todayDate.getDay()
    const diffToMonday = day === 0 ? -6 : 1 - day
    const monday = new Date(todayDate)
    monday.setDate(todayDate.getDate() + diffToMonday)
    const sunday = new Date(monday)
    sunday.setDate(monday.getDate() + 6)
    const weekStart = formatLocalYMD(monday)
    const weekEnd = formatLocalYMD(sunday)

    // Current month
    const y = todayDate.getFullYear()
    const m = todayDate.getMonth()
    const monthStart = `${y}-${String(m + 1).padStart(2, '0')}-01`
    const lastDayOfMonth = new Date(y, m + 1, 0).getDate()
    const monthEnd = `${y}-${String(m + 1).padStart(2, '0')}-${String(lastDayOfMonth).padStart(2, '0')}`

    // Current year
    const yearStart = `${y}-01-01`
    const yearEnd = `${y}-12-31`

    return (dateStr) => {
      if (!dateStr) return false
      const d = dateStr.slice(0, 10)

      if (dateFilter === 'all') return true
      if (dateFilter === 'today') return d === todayStr
      if (dateFilter === 'day') return d === selectedDay
      if (dateFilter === 'this_week') return d >= weekStart && d <= weekEnd
      if (dateFilter === 'this_month') return d >= monthStart && d <= monthEnd
      if (dateFilter === 'this_year') return d >= yearStart && d <= yearEnd
      if (dateFilter === 'custom') {
        const { start, end } = appliedCustomRange
        if (start && d < start) return false
        if (end && d > end) return false
        return true
      }
      // If a specific YYYY-MM is selected
      return dateStr.slice(0, 7) === dateFilter
    }
  }, [dateFilter, appliedCustomRange, selectedDay])

  const filtered = useMemo(
    () =>
      invoices.filter((inv) => {
        const matchesStatus = statusFilter === 'All' || inv.status === statusFilter
        const matchesDate = isDateInFilter(inv.issue_date)
        const haystack = `${inv.client?.name || ''} ${inv.client?.phone || ''} ${inv.invoice_number || ''}`.toLowerCase()
        return matchesStatus && matchesDate && haystack.includes(search.toLowerCase())
      }),
    [invoices, search, statusFilter, isDateInFilter]
  )

  const table = useSortPaginate(filtered, { initialKey: 'issue_date', initialDir: 'desc', pageSize: 10, getValue })

  const totals = useMemo(() => {
    return table.sorted.reduce(
      (acc, inv) => {
        acc.total += Number(inv.total) || 0
        acc.paid += Number(inv.paid_amount) || 0
        acc.balance += Number(inv.balance) || 0
        return acc
      },
      { total: 0, paid: 0, balance: 0 }
    )
  }, [table.sorted])

  const openPaymentModal = (inv) => {
    setActiveInv(inv)
    setPayForm({
      amount: inv.balance > 0 ? inv.balance : '',
      payment_date: today(),
      mode: 'Cash',
      note: 'Balance payment',
    })
    setPayModalOpen(true)
  }

  const handleSavePayment = async (e) => {
    e.preventDefault()
    if (!activeInv) return
    const amt = Number(payForm.amount) || 0
    if (amt <= 0) {
      notify('Please enter a valid payment amount.', 'error')
      return
    }

    setSavingPayment(true)
    try {
      // 1. Insert payment into payments table
      const { error: payErr } = await supabase.from('payments').insert({
        invoice_id: activeInv.id,
        amount: amt,
        payment_date: payForm.payment_date,
        mode: payForm.mode,
        note: payForm.note || 'Payment recorded',
      })
      if (payErr) throw payErr

      // 2. Compute new total paid & status
      const newPaid = (activeInv.paid_amount || 0) + amt
      const newStatus =
        newPaid >= (Number(activeInv.total) || 0) && (Number(activeInv.total) || 0) > 0
          ? 'Paid'
          : 'Partially Paid'

      await supabase.from('invoices').update({ status: newStatus }).eq('id', activeInv.id)

      notify(`Payment of ${formatCurrency(amt)} recorded successfully!`)
      setPayModalOpen(false)
      load()
    } catch (err) {
      notify(err.message || 'Error recording payment', 'error')
    } finally {
      setSavingPayment(false)
    }
  }

  const exportCsv = (e) => {
    e.preventDefault()
    const { start, end } = exportRange
    if (!start || !end || start > end) {
      notify('Please select a valid start and end date.', 'error')
      return
    }

    const matchingInvoices = filtered.filter(
      (invoice) => invoice.issue_date >= start && invoice.issue_date <= end
    )
    if (matchingInvoices.length === 0) {
      notify('No invoices match this date range and the current filters.', 'error')
      return
    }

    const rows = matchingInvoices.map((i) => ({
      Client: i.client?.name || '',
      Phone: i.client?.phone || '',
      Date: i.issue_date || '',
      Time: formatTime(i.created_at) || '',
      Total: i.total || 0,
      Paid: i.paid_amount || 0,
      Balance: i.balance || 0,
      Status: i.status || '',
    }))
    downloadCsv(`invoices_${start}_to_${end}.csv`, rows)
    setExportModalOpen(false)
  }

  return (
    <div>
      <PageHeader
        title="Invoices"
        subtitle="Create, track and manage client invoices"
        action={
          <div className="flex gap-2">
            <button
              onClick={() => {
                setExportRange({ start: '', end: '' })
                setExportModalOpen(true)
              }}
              disabled={loading}
              className="btn-secondary"
            >
              Export CSV
            </button>
            <Link to="/invoices/new" className="btn-primary">
              <PlusIcon /> New Invoice
            </Link>
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          className="input max-w-sm"
          placeholder="Search by client, phone, invoice #…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="input max-w-[170px]"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="All">All Statuses</option>
          {INVOICE_STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        <div className="relative">
          <select
            className="input max-w-[180px]"
            value={dateFilter}
            onChange={(e) => handleDropdownChange(e.target.value)}
          >
            <option value="today">Today</option>
            <option value="this_week">This Week</option>
            <option value="this_month">This Month</option>
            <option value="this_year">This Year</option>
            <option value="all">All time</option>
            <option value="custom">Custom Range</option>
            {dateFilter === 'day' && (
              <option value="day" hidden>
                Single date
              </option>
            )}
          </select>
        </div>

        <DateField
          value={dateFilter === 'day' ? selectedDay : ''}
          onChange={handlePickDay}
          ariaLabel="Show invoices of a particular date"
          placeholder="Pick a date"
          className={`!rounded-lg !px-3 !py-2 text-sm ${
            dateFilter === 'day' ? '!border-brand-500 ring-1 ring-brand-500' : ''
          }`}
        />

        {dateFilter === 'custom' && (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-1.5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <span className="flex items-center text-gray-400">
              <CalendarIcon width={16} height={16} />
            </span>
            <label className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300">
              <span className="font-semibold text-gray-500 dark:text-gray-400">From</span>
              <DateField
                ariaLabel="From date"
                value={draftCustomRange.start}
                onChange={(v) => setDraftCustomRange((r) => ({ ...r, start: v }))}
              />
            </label>
            <span className="text-xs font-medium text-gray-400">to</span>
            <label className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300">
              <span className="font-semibold text-gray-500 dark:text-gray-400">To</span>
              <DateField
                ariaLabel="To date"
                value={draftCustomRange.end}
                onChange={(v) => setDraftCustomRange((r) => ({ ...r, end: v }))}
              />
            </label>

            <div className="flex items-center gap-1.5 border-l border-gray-200 pl-2 dark:border-gray-700">
              <button
                type="button"
                onClick={handleApplyCustom}
                className="rounded-lg bg-brand-600 px-2.5 py-1 text-xs font-semibold text-white shadow-sm transition hover:bg-brand-700 active:scale-95"
              >
                Apply
              </button>
              <button
                type="button"
                onClick={handleCancelCustom}
                className="rounded-lg border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-600 transition hover:bg-gray-50 active:scale-95 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {loading ? (
        <TableSkeleton cols={8} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={InvoiceIcon}
          title={search || statusFilter !== 'All' || dateFilter !== 'all' ? 'No matching invoices' : 'No invoices yet'}
          description={
            search || statusFilter !== 'All' || dateFilter !== 'all'
              ? `No invoices found for ${activeRangeLabel}${statusFilter !== 'All' ? ` with status "${statusFilter}"` : ''}. Try changing your filters.`
              : 'Create your first invoice for a client.'
          }
          action={
            <div className="flex flex-wrap items-center justify-center gap-2">
              {dateFilter !== 'all' && (
                <button
                  type="button"
                  onClick={() => {
                    setDateFilter('all')
                    setPreviousDateFilter('all')
                  }}
                  className="btn-secondary"
                >
                  View All Time
                </button>
              )}
              <Link to="/invoices/new" className="btn-primary">
                <PlusIcon /> New Invoice
              </Link>
            </div>
          }
        />
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left dark:bg-gray-800">
                <tr>
                  <SortableTh label="Client / Customer" sortKey="client" state={table} onSort={table.toggleSort} />
                  <SortableTh label="Phone No." sortKey="phone" state={table} onSort={table.toggleSort} />
                  <SortableTh label="Date & Time" sortKey="issue_date" state={table} onSort={table.toggleSort} />
                  <SortableTh label="Total Amount" sortKey="total" state={table} onSort={table.toggleSort} className="text-right" />
                  <SortableTh label="Paid Amount" sortKey="paid_amount" state={table} onSort={table.toggleSort} className="text-right" />
                  <SortableTh label="Remaining Balance" sortKey="balance" state={table} onSort={table.toggleSort} className="text-right" />
                  <SortableTh label="Status" sortKey="status" state={table} onSort={table.toggleSort} />
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {table.sorted.map((inv) => (
                  <tr key={inv.id} className="row-hover bg-white dark:bg-gray-900/40">
                    <td className="px-4 py-3">
                      <Link to={`/invoices/${inv.id}`} className="font-semibold text-brand-600 hover:underline">
                        {inv.client?.name || 'Customer'}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                      {inv.client?.phone || '-'}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                      <div className="font-medium text-gray-900 dark:text-gray-100">
                        {formatDate(inv.issue_date)}
                      </div>
                      {inv.created_at && (
                        <div className="text-xs text-gray-400 dark:text-gray-500">
                          {formatTime(inv.created_at)}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900 dark:text-gray-100">
                      {formatCurrency(inv.total)}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-green-600 dark:text-green-400">
                      {formatCurrency(inv.paid_amount)}
                    </td>
                    <td className="px-4 py-3 text-right font-bold">
                      <span className={inv.balance > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}>
                        {formatCurrency(inv.balance)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={inv.status} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-3">
                        {/* View Invoice */}
                        <Link
                          to={`/invoices/${inv.id}`}
                          className="text-gray-400 hover:text-brand-600 transition"
                          title="View Invoice"
                        >
                          <InvoiceIcon width={17} height={17} />
                        </Link>

                        {/* Payment Icon */}
                        <button
                          onClick={() => openPaymentModal(inv)}
                          className="text-gray-400 hover:text-green-600 transition"
                          title="Pay Pending Amount / Record Payment"
                        >
                          <WalletIcon width={17} height={17} />
                        </button>

                        {/* Delete Invoice */}
                        <button
                          onClick={async () => {
                            const ok = await confirm({
                              title: 'Delete invoice?',
                              message: `Invoice for ${inv.client?.name || 'this client'} and its payments will be deleted.`,
                              confirmText: 'Delete',
                            })
                            if (!ok) return
                            await supabase.from('payments').delete().eq('invoice_id', inv.id)
                            await supabase.from('invoices').delete().eq('id', inv.id)
                            notify('Invoice deleted')
                            load()
                          }}
                          className="text-gray-400 hover:text-red-600 transition"
                          title="Delete"
                        >
                          <TrashIcon width={17} height={17} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 px-2 pt-3 text-xs text-gray-500 dark:text-gray-400">
            <span>Showing all {table.total} {table.total === 1 ? 'invoice' : 'invoices'}</span>
            {table.total > 0 && (
              <div className="flex flex-wrap items-center gap-4 text-xs">
                <span>
                  Total: <strong className="font-bold text-gray-900 dark:text-gray-100">{formatCurrency(totals.total)}</strong>
                </span>
                <span>
                  Paid: <strong className="font-bold text-green-600 dark:text-green-400">{formatCurrency(totals.paid)}</strong>
                </span>
                <span>
                  Remaining: <strong className={`font-bold ${totals.balance > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>{formatCurrency(totals.balance)}</strong>
                </span>
              </div>
            )}
          </div>
        </>
      )}

      <Modal open={exportModalOpen} onClose={() => setExportModalOpen(false)} title="Export Invoices" size="sm">
        <form onSubmit={exportCsv} className="space-y-4 text-sm">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="min-w-0">
              <label htmlFor="export-start-date" className="mb-1 block font-medium">
                Invoice Date From
              </label>
              <input
                id="export-start-date"
                type="date"
                required
                max={exportRange.end || undefined}
                value={exportRange.start}
                onChange={(e) => setExportRange((range) => ({ ...range, start: e.target.value }))}
                className="input w-full min-w-0"
              />
            </div>
            <div className="min-w-0">
              <label htmlFor="export-end-date" className="mb-1 block font-medium">
                Invoice Date To
              </label>
              <input
                id="export-end-date"
                type="date"
                required
                min={exportRange.start || undefined}
                value={exportRange.end}
                onChange={(e) => setExportRange((range) => ({ ...range, end: e.target.value }))}
                className="input w-full min-w-0"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setExportModalOpen(false)} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              Export CSV
            </button>
          </div>
        </form>
      </Modal>

      {/* ── RECORD PAYMENT MODAL ────────────────────────────────────────── */}
      <Modal open={payModalOpen} onClose={() => setPayModalOpen(false)} title="Record Payment" size="sm">
        {activeInv && (
          <form onSubmit={handleSavePayment} className="space-y-4 text-sm">
            {/* Invoice & Balance Summary Card */}
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3.5 dark:border-gray-700 dark:bg-gray-800/80">
              <div className="mb-2 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                <span>
                  Client:{' '}
                  <strong className="font-semibold text-gray-800 dark:text-gray-100">
                    {activeInv.client?.name || 'Customer'}
                  </strong>
                </span>
                <span>
                  Total: <strong>{formatCurrency(activeInv.total)}</strong>
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 border-t border-gray-200 pt-2 dark:border-gray-700">
                <div>
                  <span className="text-xs text-gray-500 dark:text-gray-400">Already Paid</span>
                  <p className="text-base font-bold text-green-600 dark:text-green-400">
                    {formatCurrency(activeInv.paid_amount)}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-xs text-gray-500 dark:text-gray-400">Pending Balance</span>
                  <p className="text-base font-bold text-red-600 dark:text-red-400">
                    {formatCurrency(activeInv.balance)}
                  </p>
                </div>
              </div>
            </div>

            {activeInv.balance <= 0 && (
              <div className="rounded-lg bg-green-50 p-2.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-300">
                ✓ This invoice is already fully paid.
              </div>
            )}

            {/* Amount input */}
            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300">
                  Payment Amount (₹) <span className="text-red-500">*</span>
                </label>
                {activeInv.balance > 0 && Number(payForm.amount) !== activeInv.balance && (
                  <button
                    type="button"
                    onClick={() => setPayForm((f) => ({ ...f, amount: activeInv.balance }))}
                    className="text-xs font-semibold text-brand-600 hover:underline dark:text-brand-400"
                  >
                    Pay Full ({formatCurrency(activeInv.balance)})
                  </button>
                )}
              </div>
              <input
                type="number"
                min="1"
                required
                className="input text-base font-bold text-gray-900 dark:text-white"
                placeholder="Enter amount"
                value={payForm.amount}
                onChange={(e) => setPayForm((f) => ({ ...f, amount: e.target.value }))}
              />
            </div>

            {/* Payment Mode */}
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300">
                Payment Mode
              </label>
              <select
                className="input mt-1"
                value={payForm.mode}
                onChange={(e) => setPayForm((f) => ({ ...f, mode: e.target.value }))}
              >
                {PAYMENT_MODES.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            {/* Payment Date */}
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300">
                Payment Date
              </label>
              <input
                type="date"
                required
                className="input mt-1"
                value={payForm.payment_date}
                onChange={(e) => setPayForm((f) => ({ ...f, payment_date: e.target.value }))}
              />
            </div>

            {/* Payment Note */}
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300">
                Note / Description (Optional)
              </label>
              <input
                type="text"
                className="input mt-1"
                placeholder="e.g. Balance settlement, Google Pay, Cash"
                value={payForm.note}
                onChange={(e) => setPayForm((f) => ({ ...f, note: e.target.value }))}
              />
            </div>

            {/* Modal Actions */}
            <div className="flex justify-end gap-2 border-t border-gray-200 pt-3 dark:border-gray-700">
              <button
                type="button"
                onClick={() => setPayModalOpen(false)}
                className="btn-secondary text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingPayment || !payForm.amount || Number(payForm.amount) <= 0}
                className="btn-primary text-xs"
              >
                {savingPayment ? 'Saving…' : 'Record Payment'}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  )
}
