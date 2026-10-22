import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts'
import { supabase } from '../lib/supabase'
import { PageLoader } from '../components/Loaders'
import CountUp from '../components/CountUp'
import DateField from '../components/DateField'
import StatusBadge from '../components/StatusBadge'
import { useTheme } from '../contexts/ThemeContext'
import { useProfile } from '../contexts/ProfileContext'
import { formatCurrency, formatDate } from '../lib/format'
import { IMAGES } from '../lib/images'
import { InvoiceIcon, WalletIcon, ClockIcon, TrendingUpIcon, CalendarIcon } from '../components/icons'

const monthKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const formatLocalYMD = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)

const QUICK_FILTERS = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'this_week', label: 'This week' },
  { key: 'this_month', label: 'This month' },
  { key: 'this_year', label: 'This year' },
  { key: 'all', label: 'All time' },
]

// Inclusive { start, end } (YYYY-MM-DD) for relative filters; null for all / custom / day / month keys.
function getPresetRange(type) {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const y = today.getFullYear()
  const m = today.getMonth()
  let start
  let end = today

  switch (type) {
    case 'today':
      start = today
      break
    case 'yesterday':
      start = end = addDays(today, -1)
      break
    case 'this_week': {
      // Monday to Sunday
      const diffToMonday = today.getDay() === 0 ? -6 : 1 - today.getDay()
      start = addDays(today, diffToMonday)
      end = addDays(start, 6)
      break
    }
    case 'this_month':
      start = new Date(y, m, 1)
      end = new Date(y, m + 1, 0)
      break
    case 'this_year':
      start = new Date(y, 0, 1)
      end = new Date(y, 11, 31)
      break
    default:
      return null
  }
  return { start: formatLocalYMD(start), end: formatLocalYMD(end) }
}

const TONES = {
  indigo: {
    card: 'bg-gradient-to-br from-brand-50 to-white dark:from-gray-800 dark:to-gray-800',
    badge: 'bg-brand-100 text-brand-600 dark:bg-brand-600/20 dark:text-brand-400',
    value: 'text-brand-700 dark:text-brand-400',
  },
  green: {
    card: 'bg-gradient-to-br from-green-50 to-white dark:from-gray-800 dark:to-gray-800',
    badge: 'bg-green-100 text-green-600 dark:bg-green-600/20 dark:text-green-400',
    value: 'text-green-700 dark:text-green-400',
  },
  amber: {
    card: 'bg-gradient-to-br from-amber-50 to-white dark:from-gray-800 dark:to-gray-800',
    badge: 'bg-amber-100 text-amber-600 dark:bg-amber-600/20 dark:text-amber-400',
    value: 'text-amber-700 dark:text-amber-400',
  },
  rose: {
    card: 'bg-gradient-to-br from-rose-50 to-white dark:from-gray-800 dark:to-gray-800',
    badge: 'bg-rose-100 text-rose-600 dark:bg-rose-600/20 dark:text-rose-400',
    value: 'text-rose-700 dark:text-rose-400',
  },
}

function StatCard({ label, value, icon: Icon, tone = 'indigo' }) {
  const t = TONES[tone]
  return (
    <div className={`card flex items-center gap-4 ${t.card}`}>
      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${t.badge}`}>
        <Icon width={24} height={24} />
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm text-gray-500 dark:text-gray-400">{label}</p>
        <p className={`mt-0.5 text-2xl font-bold ${t.value}`}>
          <CountUp value={value} format={formatCurrency} />
        </p>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const { theme } = useTheme()
  const { profile } = useProfile()
  const [invoices, setInvoices] = useState([])
  const [payments, setPayments] = useState([])
  const [expenses, setExpenses] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [filterType, setFilterType] = useState('today')
  const [previousFilterType, setPreviousFilterType] = useState('today')
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
      if (filterType !== 'custom') {
        setPreviousFilterType(filterType)
        const todayStr = formatLocalYMD(new Date())
        const todayRange = { start: todayStr, end: todayStr }
        setAppliedCustomRange(todayRange)
        setDraftCustomRange(todayRange)
      }
      setFilterType('custom')
    } else {
      setFilterType(newVal)
      setPreviousFilterType(newVal)
    }
  }

  const handlePickDay = (value) => {
    if (!value) return
    setSelectedDay(value)
    handleDropdownChange('day')
  }

  const handleApplyCustom = () => {
    setAppliedCustomRange({ ...draftCustomRange })
    setPreviousFilterType('custom')
  }

  const handleCancelCustom = () => {
    setDraftCustomRange({ ...appliedCustomRange })
    if (previousFilterType && previousFilterType !== 'custom') {
      setFilterType(previousFilterType)
    } else {
      setFilterType('today')
      setPreviousFilterType('today')
    }
  }

  useEffect(() => {
    const load = async () => {
      const [inv, pay, exp] = await Promise.all([
        supabase.from('invoices').select('*, client:clients(name)').order('issue_date', { ascending: false }),
        supabase.from('payments').select('amount, payment_date, invoice_id'),
        supabase.from('expenses').select('amount, expense_date'),
      ])
      setInvoices(inv.data || [])
      setPayments(pay.data || [])
      setExpenses(exp.data || [])
      setLoading(false)
    }
    load()
  }, [])

  // Months that have any activity, newest first
  const availablePeriods = useMemo(() => {
    const keys = new Set()
    invoices.forEach((i) => i.issue_date && keys.add(i.issue_date.slice(0, 7)))
    payments.forEach((p) => p.payment_date && keys.add(p.payment_date.slice(0, 7)))
    expenses.forEach((e) => e.expense_date && keys.add(e.expense_date.slice(0, 7)))
    return [...keys].sort().reverse()
  }, [invoices, payments, expenses])

  const periodLabel = (key) => {
    if (key === 'all') return 'All time'
    if (!key.includes('-')) return key
    const [y, m] = key.split('-')
    return `${MONTH_NAMES[Number(m) - 1]} ${y}`
  }

  const activeRangeLabel = useMemo(() => {
    const today = new Date()
    const y = today.getFullYear()
    const m = today.getMonth()

    switch (filterType) {
      case 'today':
        return 'Today'
      case 'yesterday':
        return 'Yesterday'
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
        return periodLabel(filterType)
    }
  }, [filterType, appliedCustomRange, selectedDay])

  // Concrete dates behind a relative preset, shown next to the label.
  const presetRangeText = useMemo(() => {
    const r = getPresetRange(filterType)
    if (!r || filterType === 'all' || r.start === r.end) return ''
    return `${formatDate(r.start)} – ${formatDate(r.end)}`
  }, [filterType])

  const isDateInFilter = useMemo(() => {
    let range = getPresetRange(filterType)
    if (filterType === 'custom') range = appliedCustomRange
    if (filterType === 'day') range = { start: selectedDay, end: selectedDay }

    return (dateStr) => {
      if (!dateStr) return false
      const d = dateStr.slice(0, 10)

      if (filterType === 'all') return true
      if (range) {
        const { start, end } = range
        if (start && d < start) return false
        if (end && d > end) return false
        return true
      }
      // A specific YYYY-MM is selected
      return dateStr.slice(0, 7) === filterType
    }
  }, [filterType, appliedCustomRange, selectedDay])

  const stats = useMemo(() => {
    const periodInvoices = invoices.filter((i) => isDateInFilter(i.issue_date))
    const invoiced = periodInvoices.reduce((s, i) => s + (Number(i.total) || 0), 0)
    const received = payments
      .filter((p) => isDateInFilter(p.payment_date))
      .reduce((s, p) => s + (Number(p.amount) || 0), 0)
    const expensesTotal = expenses
      .filter((e) => isDateInFilter(e.expense_date))
      .reduce((s, e) => s + (Number(e.amount) || 0), 0)

    // Pending = unpaid balance on invoices issued within the selected period.
    const paidByInvoice = {}
    payments.forEach((p) => {
      if (!p.invoice_id) return
      paidByInvoice[p.invoice_id] = (paidByInvoice[p.invoice_id] || 0) + (Number(p.amount) || 0)
    })
    const pending = periodInvoices.reduce(
      (s, i) => s + Math.max(0, (Number(i.total) || 0) - (paidByInvoice[i.id] || 0)),
      0
    )

    return {
      invoiced,
      received,
      expensesTotal,
      profit: received - expensesTotal,
      pending,
    }
  }, [invoices, payments, expenses, isDateInFilter])

  const availableYears = useMemo(() => {
    const years = new Set([new Date().getFullYear()])
    payments.forEach((p) => p.payment_date && years.add(new Date(p.payment_date).getFullYear()))
    expenses.forEach((e) => e.expense_date && years.add(new Date(e.expense_date).getFullYear()))
    return [...years].sort((a, b) => b - a)
  }, [payments, expenses])

  const chartData = useMemo(() => {
    const months = MONTH_NAMES.map((label) => ({ label, income: 0, expenses: 0 }))
    payments.forEach((p) => {
      if (!p.payment_date) return
      const d = new Date(p.payment_date)
      if (d.getFullYear() === selectedYear) months[d.getMonth()].income += Number(p.amount) || 0
    })
    expenses.forEach((e) => {
      if (!e.expense_date) return
      const d = new Date(e.expense_date)
      if (d.getFullYear() === selectedYear) months[d.getMonth()].expenses += Number(e.amount) || 0
    })
    return months
  }, [payments, expenses, selectedYear])

  const yearTotals = useMemo(
    () => ({
      income: chartData.reduce((s, m) => s + m.income, 0),
      expenses: chartData.reduce((s, m) => s + m.expenses, 0),
    }),
    [chartData]
  )

  const recent = invoices.slice(0, 5)

  if (loading) return <PageLoader />

  return (
    <div>
      <div className="relative mb-6 overflow-hidden rounded-2xl shadow-sm">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${IMAGES.dashboardBanner})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-brand-800/90 via-brand-700/80 to-brand-500/60" />
        <div className="relative flex items-center gap-4 p-6 sm:p-8">
          {profile?.logo_url && (
            <img
              src={profile.logo_url}
              alt="Logo"
              className="h-16 w-16 rounded-xl bg-white/90 object-contain p-1 shadow"
            />
          )}
          <div>
            <h1 className="text-2xl font-bold text-white sm:text-3xl">
              {profile?.studio_name || 'Dashboard'}
            </h1>
            <p className="mt-1 text-sm text-white/80">
              {profile?.studio_name ? 'Your studio at a glance' : 'Set up your studio in Business Profile'}
            </p>
          </div>
        </div>
      </div>

      <div className="mb-4 space-y-3">
        <div>
          <h2 className="text-lg font-semibold">Summary</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Overview of financial metrics for <span className="font-semibold text-brand-600 dark:text-brand-400">{activeRangeLabel}</span>
            {presetRangeText && <span> · {presetRangeText}</span>}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {QUICK_FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => handleDropdownChange(f.key)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition active:scale-95 ${
                filterType === f.key
                  ? 'border-brand-600 bg-brand-600 text-white shadow-sm'
                  : 'border-gray-200 bg-white text-gray-600 hover:border-brand-300 hover:text-brand-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:border-brand-500'
              }`}
            >
              {f.label}
            </button>
          ))}

          <label
            className={`flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition ${
              filterType === 'day'
                ? 'border-brand-600 bg-brand-600 text-white shadow-sm'
                : 'border-gray-200 bg-white text-gray-600 hover:border-brand-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:border-brand-500'
            }`}
          >
            <CalendarIcon width={14} height={14} />
            <span>Pick a date</span>
            <DateField
              value={filterType === 'day' ? selectedDay : ''}
              onChange={handlePickDay}
              ariaLabel="Pick a single date"
              className="!py-0.5"
            />
          </label>

          <button
            type="button"
            onClick={() => handleDropdownChange('custom')}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition active:scale-95 ${
              filterType === 'custom'
                ? 'border-brand-600 bg-brand-600 text-white shadow-sm'
                : 'border-gray-200 bg-white text-gray-600 hover:border-brand-300 hover:text-brand-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:border-brand-500'
            }`}
          >
            <CalendarIcon width={14} height={14} />
            Custom range
          </button>

          {availablePeriods.length > 0 && (
            <select
              aria-label="Pick a month"
              className="input max-w-[150px] !rounded-full !py-1.5 !text-xs"
              value={availablePeriods.includes(filterType) ? filterType : ''}
              onChange={(e) => e.target.value && handleDropdownChange(e.target.value)}
            >
              <option value="">Pick a month…</option>
              {availablePeriods.map((k) => (
                <option key={k} value={k}>
                  {periodLabel(k)}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2.5 empty:hidden">
          {filterType === 'custom' && (
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
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={`Invoiced · ${activeRangeLabel}`} value={stats.invoiced} icon={InvoiceIcon} tone="indigo" />
        <StatCard label={`Received · ${activeRangeLabel}`} value={stats.received} icon={WalletIcon} tone="green" />
        <StatCard label="Pending payments" value={stats.pending} icon={ClockIcon} tone="amber" />
        <StatCard label={`Profit · ${activeRangeLabel}`} value={stats.profit} icon={TrendingUpIcon} tone={stats.profit < 0 ? 'rose' : 'green'} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="card lg:col-span-2">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold">Monthly Income &amp; Expenses — {selectedYear}</h3>
              <p className="text-xs text-gray-500">
                Income {formatCurrency(yearTotals.income)} · Expenses {formatCurrency(yearTotals.expenses)} · Profit{' '}
                {formatCurrency(yearTotals.income - yearTotals.expenses)}
              </p>
            </div>
            <select
              className="input max-w-[120px]"
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
            >
              {availableYears.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
          <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#374151' : '#e5e7eb'} />
                <XAxis dataKey="label" stroke={theme === 'dark' ? '#9ca3af' : '#6b7280'} fontSize={12} />
                <YAxis stroke={theme === 'dark' ? '#9ca3af' : '#6b7280'} fontSize={12} />
                <Tooltip
                  formatter={(v) => formatCurrency(v)}
                  contentStyle={{
                    background: theme === 'dark' ? '#1f2937' : '#fff',
                    border: '1px solid #e5e7eb',
                    borderRadius: 8,
                  }}
                />
                <Legend />
                <Bar dataKey="income" name="Income" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expenses" name="Expenses" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-semibold">Recent Invoices</h3>
            <Link to="/invoices" className="text-sm font-medium text-brand-600 hover:underline">
              View all
            </Link>
          </div>
          {recent.length === 0 ? (
            <p className="text-sm text-gray-500">No invoices yet.</p>
          ) : (
            <ul className="space-y-3">
              {recent.map((inv) => (
                <li key={inv.id} className="flex items-center justify-between">
                  <div>
                    <Link to={`/invoices/${inv.id}`} className="font-medium text-brand-600 hover:underline">
                      {inv.invoice_number}
                    </Link>
                    <p className="text-xs text-gray-500">
                      {inv.client?.name || '-'} · {formatDate(inv.issue_date)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">{formatCurrency(inv.total)}</p>
                    <StatusBadge status={inv.status} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
