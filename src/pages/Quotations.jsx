import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import PageHeader from '../components/PageHeader'
import EmptyState from '../components/EmptyState'
import StatusBadge from '../components/StatusBadge'
import Pagination from '../components/Pagination'
import { TableSkeleton } from '../components/Loaders'
import { useToast } from '../contexts/ToastContext'
import { useConfirm } from '../contexts/ConfirmContext'
import { useSortPaginate } from '../lib/useSortPaginate'
import { PlusIcon, TrashIcon, QuoteIcon, CopyIcon, ArrowUpDownIcon } from '../components/icons'
import { formatCurrency, formatDate, quotationName, QUOTATION_STATUSES } from '../lib/format'

const getValue = (q, key) => {
  switch (key) {
    case 'quotation_number':
      return quotationName(q, q.client).toLowerCase()
    case 'client':
      return (q.client?.name || '').toLowerCase()
    case 'event_type':
      return (q.event_type || '').toLowerCase()
    case 'issue_date':
      return q.issue_date || ''
    case 'event_date':
      return q.event_date || ''
    case 'total':
      return Number(q.total) || 0
    case 'status':
      return q.status || ''
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
  const navigate = useNavigate()

  const load = () => {
    setLoading(true)
    supabase
      .from('quotations')
      .select('*, client:clients(name)')
      .order('issue_date', { ascending: false })
      .then(({ data }) => {
        setQuotations(data || [])
        setLoading(false)
      })
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

  const duplicate = async (q) => {
    const year = new Date().getFullYear()
    const { data: profile } = await supabase.from('business_profile').select('quotation_prefix').limit(1).maybeSingle()
    const prefix = profile?.quotation_prefix || 'QT'
    const { count } = await supabase
      .from('quotations')
      .select('*', { count: 'exact', head: true })
      .like('quotation_number', `${prefix}-${year}-%`)
    const number = `${prefix}-${year}-${String((count || 0) + 1).padStart(3, '0')}`
    const { data } = await supabase
      .from('quotations')
      .insert({
        quotation_number: number,
        client_id: q.client_id,
        event_type: q.event_type,
        event_date: q.event_date,
        issue_date: new Date().toISOString().slice(0, 10),
        items: q.items,
        discount: q.discount,
        subtotal: q.subtotal,
        total: q.total,
        notes: q.notes,
        status: 'Draft',
        details: q.details || {},
      })
      .select('id')
      .single()
    notify('Quotation duplicated')
    if (data?.id) navigate(`/quotations/${data.id}/edit`)
  }

  const filtered = useMemo(
    () =>
      quotations.filter((q) => {
        const matchesStatus = statusFilter === 'All' || q.status === statusFilter
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
          {QUOTATION_STATUSES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <TableSkeleton cols={8} />
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
                  <SortableTh label="Status" sortKey="status" state={table} onSort={table.toggleSort} />
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
                    <td className="px-4 py-3">{formatDate(q.issue_date)}</td>
                    <td className="px-4 py-3">{formatDate(q.event_date)}</td>
                    <td className="px-4 py-3 text-right font-medium">{formatCurrency(q.total)}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={q.status} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-3">
                        <Link to={`/quotations/${q.id}`} className="text-sm font-medium text-brand-600 hover:underline">
                          View
                        </Link>
                        <Link to={`/quotations/${q.id}/edit`} className="text-sm font-medium text-brand-600 hover:underline">
                          Edit
                        </Link>
                        <button
                          onClick={() => navigate(`/invoices/new?fromQuotation=${q.id}`)}
                          className="text-sm font-medium text-green-600 hover:underline"
                        >
                          Convert
                        </button>
                        <button onClick={() => duplicate(q)} className="text-gray-400 hover:text-brand-600" title="Duplicate">
                          <CopyIcon width={16} height={16} />
                        </button>
                        <button onClick={() => remove(q)} className="text-gray-400 hover:text-red-600" title="Delete">
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
    </div>
  )
}
