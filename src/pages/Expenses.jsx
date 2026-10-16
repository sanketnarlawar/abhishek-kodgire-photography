import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import PageHeader from '../components/PageHeader'
import Modal from '../components/Modal'
import SelectWithOther from '../components/SelectWithOther'
import EmptyState from '../components/EmptyState'
import { TableSkeleton } from '../components/Loaders'
import { useToast } from '../contexts/ToastContext'
import { useConfirm } from '../contexts/ConfirmContext'
import { PlusIcon, TrashIcon, ExpenseIcon } from '../components/icons'
import { EXPENSE_CATEGORIES, formatCurrency, formatDate } from '../lib/format'

const today = () => new Date().toISOString().slice(0, 10)
const emptyForm = { expense_date: today(), category: 'Equipment', description: '', amount: 0 }
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const monthKey = (dateStr) => (dateStr ? dateStr.slice(0, 7) : '')

export default function Expenses() {
  const { notify } = useToast()
  const confirm = useConfirm()
  const [expenses, setExpenses] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [period, setPeriod] = useState(() => new Date().toISOString().slice(0, 7))

  const load = async () => {
    setLoading(true)
    const { data } = await supabase.from('expenses').select('*').order('expense_date', { ascending: false })
    setExpenses(data || [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const save = async (e) => {
    e.preventDefault()
    setSaving(true)
    await supabase.from('expenses').insert(form)
    setSaving(false)
    setModalOpen(false)
    setForm(emptyForm)
    notify('Expense added')
    load()
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

  const filtered = useMemo(
    () => (period === 'all' ? expenses : expenses.filter((e) => monthKey(e.expense_date) === period)),
    [expenses, period]
  )

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

  return (
    <div>
      <PageHeader
        title="Expenses"
        subtitle="Track business costs to measure profit"
        action={
          <button onClick={() => setModalOpen(true)} className="btn-primary">
            <PlusIcon /> Add Expense
          </button>
        }
      />

      <div className="mb-4 flex flex-wrap items-end gap-3">
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
        <TableSkeleton cols={4} />
      ) : expenses.length === 0 ? (
        <EmptyState
          icon={ExpenseIcon}
          title="No expenses recorded"
          description="Track costs like equipment, travel and editing to measure your real profit."
          action={
            <button onClick={() => setModalOpen(true)} className="btn-primary">
              <PlusIcon /> Add Expense
            </button>
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={ExpenseIcon}
          title="No expenses in this period"
          description="Pick a different month or choose “All time”."
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left dark:bg-gray-800">
              <tr>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium">Description</th>
                <th className="px-4 py-3 text-right font-medium">Amount</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {filtered.map((e) => (
                <tr key={e.id} className="row-hover bg-white dark:bg-gray-900/40">
                  <td className="px-4 py-3">{formatDate(e.expense_date)}</td>
                  <td className="px-4 py-3">
                    <span className="badge bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                      {e.category}
                    </span>
                  </td>
                  <td className="px-4 py-3">{e.description || '-'}</td>
                  <td className="px-4 py-3 text-right font-medium">{formatCurrency(e.amount)}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => remove(e)} className="text-gray-400 hover:text-red-600">
                      <TrashIcon />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add Expense">
        <form onSubmit={save} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Date</label>
              <input
                type="date"
                className="input"
                value={form.expense_date}
                onChange={(e) => setForm({ ...form, expense_date: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Category</label>
              <SelectWithOther
                options={EXPENSE_CATEGORIES}
                value={form.category}
                onChange={(v) => setForm({ ...form, category: v })}
                placeholder="Enter category"
                required
              />
            </div>
          </div>
          <div>
            <label className="label">Description</label>
            <input
              className="input"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Amount *</label>
            <input
              type="number"
              min="0"
              required
              className="input"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })}
            />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
