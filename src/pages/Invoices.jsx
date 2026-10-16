import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import PageHeader from '../components/PageHeader'
import EmptyState from '../components/EmptyState'
import StatusBadge from '../components/StatusBadge'
import Pagination from '../components/Pagination'
import Modal from '../components/Modal'
import { TableSkeleton } from '../components/Loaders'
import { useToast } from '../contexts/ToastContext'
import { useConfirm } from '../contexts/ConfirmContext'
import { useSortPaginate } from '../lib/useSortPaginate'
import { downloadCsv } from '../lib/csv'
import { PlusIcon, InvoiceIcon, WalletIcon, TrashIcon, ArrowUpDownIcon } from '../components/icons'
import { formatCurrency, formatDate, INVOICE_STATUSES } from '../lib/format'

const today = () => new Date().toISOString().slice(0, 10)
const PAYMENT_MODES = ['Cash', 'Online / UPI', 'Cheque', 'Bank Transfer', 'Card']

const getValue = (inv, key) => {
  switch (key) {
    case 'client':
      return (inv.client?.name || '').toLowerCase()
    case 'phone':
      return inv.client?.phone || ''
    case 'issue_date':
      return inv.issue_date || ''
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
        .order('issue_date', { ascending: false }),
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

  const filtered = useMemo(
    () =>
      invoices.filter((inv) => {
        const matchesStatus = statusFilter === 'All' || inv.status === statusFilter
        const haystack = `${inv.client?.name || ''} ${inv.client?.phone || ''} ${inv.invoice_number || ''}`.toLowerCase()
        return matchesStatus && haystack.includes(search.toLowerCase())
      }),
    [invoices, search, statusFilter]
  )

  const table = useSortPaginate(filtered, { initialKey: 'issue_date', initialDir: 'desc', pageSize: 10, getValue })

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

  const exportCsv = () => {
    const rows = filtered.map((i) => ({
      Client: i.client?.name || '',
      Phone: i.client?.phone || '',
      Date: i.issue_date || '',
      Total: i.total || 0,
      Paid: i.paid_amount || 0,
      Balance: i.balance || 0,
      Status: i.status || '',
    }))
    downloadCsv('invoices.csv', rows)
  }

  return (
    <div>
      <PageHeader
        title="Invoices"
        subtitle="Create, track and manage client invoices"
        action={
          <div className="flex gap-2">
            <button onClick={exportCsv} className="btn-secondary">
              Export CSV
            </button>
            <Link to="/invoices/new" className="btn-primary">
              <PlusIcon /> New Invoice
            </Link>
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap gap-3">
        <input
          className="input max-w-sm"
          placeholder="Search by client, phone, date…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className="input max-w-[180px]" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option>All</option>
          {INVOICE_STATUSES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <TableSkeleton cols={8} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={InvoiceIcon}
          title={search || statusFilter !== 'All' ? 'No matching invoices' : 'No invoices yet'}
          description={
            search || statusFilter !== 'All'
              ? 'Try changing your search or status filter.'
              : 'Create your first invoice for a client.'
          }
          action={
            !(search || statusFilter !== 'All') && (
              <Link to="/invoices/new" className="btn-primary">
                <PlusIcon /> New Invoice
              </Link>
            )
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
                  <SortableTh label="Date" sortKey="issue_date" state={table} onSort={table.toggleSort} />
                  <SortableTh label="Total Amount" sortKey="total" state={table} onSort={table.toggleSort} className="text-right" />
                  <SortableTh label="Paid Amount" sortKey="paid_amount" state={table} onSort={table.toggleSort} className="text-right" />
                  <SortableTh label="Remaining Balance" sortKey="balance" state={table} onSort={table.toggleSort} className="text-right" />
                  <SortableTh label="Status" sortKey="status" state={table} onSort={table.toggleSort} />
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {table.pageRows.map((inv) => (
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
                      {formatDate(inv.issue_date)}
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
          <Pagination page={table.page} totalPages={table.totalPages} total={table.total} onPage={table.setPage} />
        </>
      )}

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
