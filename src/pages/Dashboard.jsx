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
import StatusBadge from '../components/StatusBadge'
import { useTheme } from '../contexts/ThemeContext'
import { useProfile } from '../contexts/ProfileContext'
import { formatCurrency, formatDate } from '../lib/format'
import { IMAGES } from '../lib/images'
import { InvoiceIcon, WalletIcon, ClockIcon, TrendingUpIcon, CalendarIcon } from '../components/icons'

const monthKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

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
  const [appliedCustomRange, setAppliedCustomRange] = useState(() => {
    const today = new Date()
    const y = today.getFullYear()
    const m = String(today.getMonth() + 1).padStart(2, '0')
    const d = String(today.getDate()).padStart(2, '0')
    return {
      start: `${y}-${m}-01`,
      end: `${y}-${m}-${d}`,
    }
  })
  const [draftCustomRange, setDraftCustomRange] = useState(() => ({
    start: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01`,
    end: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`,
  }))

  const handleDropdownChange = (newVal) => {
    if (newVal === 'custom') {
      if (filterType !== 'custom') {
        setPreviousFilterType(filterType)
      }
      setDraftCustomRange({ ...appliedCustomRange })
      setFilterType('custom')
    } else {
      setFilterType(newVal)
      setPreviousFilterType(newVal)
    }
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

  const formatLocalYMD = (d) => {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }

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
  }, [filterType, appliedCustomRange])

  const isDateInFilter = useMemo(() => {
    const today = new Date()
    const todayStr = formatLocalYMD(today)

    // Current week: Monday to Sunday
    const day = today.getDay()
    const diffToMonday = day === 0 ? -6 : 1 - day
    const monday = new Date(today)
    monday.setDate(today.getDate() + diffToMonday)
    const sunday = new Date(monday)
    sunday.setDate(monday.getDate() + 6)
    const weekStart = formatLocalYMD(monday)
    const weekEnd = formatLocalYMD(sunday)

    // Current month
    const y = today.getFullYear()
    const m = today.getMonth()
    const monthStart = `${y}-${String(m + 1).padStart(2, '0')}-01`
    const lastDayOfMonth = new Date(y, m + 1, 0).getDate()
    const monthEnd = `${y}-${String(m + 1).padStart(2, '0')}-${String(lastDayOfMonth).padStart(2, '0')}`

    // Current year
    const yearStart = `${y}-01-01`
    const yearEnd = `${y}-12-31`

    return (dateStr) => {
      if (!dateStr) return false
      const d = dateStr.slice(0, 10)

      if (filterType === 'all') return true
      if (filterType === 'today') return d === todayStr
      if (filterType === 'this_week') return d >= weekStart && d <= weekEnd
      if (filterType === 'this_month') return d >= monthStart && d <= monthEnd
      if (filterType === 'this_year') return d >= yearStart && d <= yearEnd
      if (filterType === 'custom') {
        const { start, end } = appliedCustomRange
        if (start && d < start) return false
        if (end && d > end) return false
        return true
      }
      // If a specific YYYY-MM is selected
      return dateStr.slice(0, 7) === filterType
    }
  }, [filterType, appliedCustomRange])

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

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Summary</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Overview of financial metrics for <span className="font-semibold text-brand-600 dark:text-brand-400">{activeRangeLabel}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <select
            className="input max-w-[200px]"
            value={filterType}
            onChange={(e) => handleDropdownChange(e.target.value)}
          >
            <option value="today">Today</option>
            <option value="this_week">This Week</option>
            <option value="this_month">This Month</option>
            <option value="this_year">This Year</option>
            <option value="all">All time</option>
            <option value="custom">Custom Range</option>
            {availablePeriods.length > 0 && (
              <optgroup label="Monthly Archives">
                {availablePeriods.map((k) => (
                  <option key={k} value={k}>
                    {periodLabel(k)}
                  </option>
                ))}
              </optgroup>
            )}
          </select>

          {filterType === 'custom' && (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-1.5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
              <span className="flex items-center text-gray-400">
                <CalendarIcon width={16} height={16} />
              </span>
              <label className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300">
                <span className="font-semibold text-gray-500 dark:text-gray-400">From</span>
                <input
                  type="date"
                  className="rounded-lg border border-gray-300 bg-gray-50 px-2 py-1 text-xs text-gray-800 transition focus:border-brand-500 focus:bg-white focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                  value={draftCustomRange.start}
                  onChange={(e) => setDraftCustomRange((r) => ({ ...r, start: e.target.value }))}
                />
              </label>
              <span className="text-xs font-medium text-gray-400">to</span>
              <label className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300">
                <span className="font-semibold text-gray-500 dark:text-gray-400">To</span>
                <input
                  type="date"
                  className="rounded-lg border border-gray-300 bg-gray-50 px-2 py-1 text-xs text-gray-800 transition focus:border-brand-500 focus:bg-white focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                  value={draftCustomRange.end}
                  onChange={(e) => setDraftCustomRange((r) => ({ ...r, end: e.target.value }))}
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
