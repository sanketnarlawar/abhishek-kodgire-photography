import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import PageHeader from '../components/PageHeader'
import EmptyState from '../components/EmptyState'
import StatusBadge from '../components/StatusBadge'
import Pagination from '../components/Pagination'
import PhotographerAssignModal from '../components/PhotographerAssignModal'
import { TableSkeleton } from '../components/Loaders'
import { useToast } from '../contexts/ToastContext'
import { useConfirm } from '../contexts/ConfirmContext'
import { useSortPaginate } from '../lib/useSortPaginate'
import { assignmentProgress } from '../lib/eventServices'
import { PlusIcon, TrashIcon, QuoteIcon, EditIcon, UserIcon, ArrowUpDownIcon } from '../components/icons'
import { formatCurrency, formatDate, formatTime, quotationName, normalizeQuotationStatus } from '../lib/format'

const receivedOf = (q) => (q.details?.payments || []).reduce((s, p) => s + (Number(p.amount) || 0), 0)

const balanceOf = (q) => Math.max(0, (Number(q.total) || 0) - receivedOf(q))

// Draft quotations can't take payments; approved ones move Unpaid → Partially Paid → Paid.
const PAYMENT_STATUSES = ['Draft', 'Unpaid', 'Partially Paid', 'Paid']

const paymentStatusOf = (q) => {
  if (normalizeQuotationStatus(q.status) !== 'Approved') return 'Draft'
  const received = receivedOf(q)
  if (received <= 0) return 'Unpaid'
  return received >= (Number(q.total) || 0) ? 'Paid' : 'Partially Paid'
}

const getValue = (q, key) => {
  switch (key) {
    case 'balance':
      return balanceOf(q)
    case 'quotation_number':
      return quotationName(q, q.client).toLowerCase()
    case 'client':
      return (q.client?.name || '').toLowerCase()
    case 'event_type':
      return (q.event_type || '').toLowerCase()
    case 'issue_date':
      return `${q.issue_date || ''}|${q.created_at || ''}`
    case 'event_date':
      return q.event_date || ''
    case 'total':
      return Number(q.total) || 0
    case 'status':
      return paymentStatusOf(q)
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

export default function Quotations() {
  const { notify } = useToast()
  const confirm = useConfirm()
  const [quotations, setQuotations] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [photographers, setPhotographers] = useState([])
  const [assignFor, setAssignFor] = useState(null)

  const load = () => {
    setLoading(true)
    supabase
      .from('quotations')
      .select('*, client:clients(name)')
      .order('issue_date', { ascending: false })
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setQuotations(data || [])
        setLoading(false)
      })
    supabase
      .from('photographers')
      .select('*')
      .order('name')
      .then(({ data }) => setPhotographers(data || []))
  }

  useEffect(() => {
    load()
  }, [])

  const remove = async (q) => {
    const ok = await confirm({
      title: 'Delete quotation?',
      message: `${quotationName(q, q.client)} will be permanently removed.`,
      confirmText: 'Delete',
    })
    if (!ok) return
    await supabase.from('quotations').delete().eq('id', q.id)
    notify('Quotation deleted')
    load()
  }

  const handleAssigned = ({ quotationId, details, photographers: nextPhotographers }) => {
    setQuotations((list) => list.map((q) => (q.id === quotationId ? { ...q, details } : q)))
    setPhotographers(nextPhotographers)
    setAssignFor(null)
  }

  const filtered = useMemo(
    () =>
      quotations.filter((q) => {
        const matchesStatus = statusFilter === 'All' || paymentStatusOf(q) === statusFilter
        const haystack = `${q.quotation_number} ${q.client?.name || ''} ${q.event_type || ''}`.toLowerCase()
        return matchesStatus && haystack.includes(search.toLowerCase())
      }),
    [quotations, search, statusFilter]
  )

  const table = useSortPaginate(filtered, { initialKey: 'issue_date', initialDir: 'desc', pageSize: 10, getValue })

  return (
    <div>
      <PageHeader
        title="Quotations"
        subtitle="Build quotes and convert accepted ones into invoices"
        action={
          <Link to="/quotations/new" className="btn-primary">
            <PlusIcon /> New Quotation
          </Link>
        }
      />

      <div className="mb-4 flex flex-wrap gap-3">
        <input
          className="input max-w-sm"
          placeholder="Search by number, client, event…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className="input max-w-[180px]" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option>All</option>
          {PAYMENT_STATUSES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <TableSkeleton cols={9} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={QuoteIcon}
          title={search || statusFilter !== 'All' ? 'No matching quotations' : 'No quotations yet'}
          description={
            search || statusFilter !== 'All'
              ? 'Try changing your search or status filter.'
              : 'Build a quote for a client and convert it into an invoice once accepted.'
          }
          action={
            !(search || statusFilter !== 'All') && (
              <Link to="/quotations/new" className="btn-primary">
                <PlusIcon /> New Quotation
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
                  <SortableTh label="Quotation" sortKey="quotation_number" state={table} onSort={table.toggleSort} />
                  <SortableTh label="Client" sortKey="client" state={table} onSort={table.toggleSort} />
                  <SortableTh label="Event" sortKey="event_type" state={table} onSort={table.toggleSort} />
                  <SortableTh label="Quotation Generated Date" sortKey="issue_date" state={table} onSort={table.toggleSort} />
                  <SortableTh label="Event Date" sortKey="event_date" state={table} onSort={table.toggleSort} />
                  <SortableTh label="Total" sortKey="total" state={table} onSort={table.toggleSort} className="text-right" />
                  <SortableTh label="Balance" sortKey="balance" state={table} onSort={table.toggleSort} className="text-right" />
                  <SortableTh label="Payment Status" sortKey="status" state={table} onSort={table.toggleSort} />
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {table.pageRows.map((q) => (
                  <tr key={q.id} className="row-hover bg-white dark:bg-gray-900/40">
                    <td className="px-4 py-3 font-medium">
                      <Link to={`/quotations/${q.id}`} className="text-brand-600 hover:underline">
                        {quotationName(q, q.client)}
                      </Link>
                      <div className="text-xs font-normal text-gray-400">{q.quotation_number}</div>
                    </td>
                    <td className="px-4 py-3">{q.client?.name || '-'}</td>
                    <td className="px-4 py-3">{q.event_type || '-'}</td>
                    <td className="px-4 py-3">
                      <div>{formatDate(q.issue_date)}</div>
                      {q.created_at && <div className="text-xs text-gray-400 dark:text-gray-500">{formatTime(q.created_at)}</div>}
                    </td>
                    <td className="px-4 py-3">{formatDate(q.event_date)}</td>
                    <td className="px-4 py-3 text-right font-medium">{formatCurrency(q.total)}</td>
                    <td
                      className={`px-4 py-3 text-right font-medium ${
                        balanceOf(q) > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'
                      }`}
                    >
                      {formatCurrency(balanceOf(q))}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={paymentStatusOf(q)} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-3">
                        <Link
                          to={`/quotations/${q.id}/edit`}
                          className="text-gray-400 hover:text-brand-600"
                          title="Edit"
                          aria-label="Edit quotation"
                        >
                          <EditIcon width={16} height={16} />
                        </Link>
                        {(() => {
                          const { assigned, total } = assignmentProgress(q)
                          const tone =
                            total > 0 && assigned === total
                              ? 'text-green-600'
                              : assigned > 0
                                ? 'text-amber-500'
                                : 'text-gray-400 hover:text-brand-600'
                          return (
                            <button
                              onClick={() => setAssignFor(q)}
                              className={tone}
                              title={`Assign photographers (${assigned} of ${total} assigned)`}
                              aria-label="Assign photographers"
                            >
                              <UserIcon width={16} height={16} />
                            </button>
                          )
                        })()}
                        <button onClick={() => remove(q)} className="text-gray-400 hover:text-red-600" title="Delete" aria-label="Delete quotation">
                          <TrashIcon width={16} height={16} />
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

      <PhotographerAssignModal
        open={Boolean(assignFor)}
        quotation={assignFor}
        photographers={photographers}
        onClose={() => setAssignFor(null)}
        onSaved={handleAssigned}
      />
    </div>
  )
}
