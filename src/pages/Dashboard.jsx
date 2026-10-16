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
import { InvoiceIcon, WalletIcon, ClockIcon, TrendingUpIcon } from '../components/icons'

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
  const [period, setPeriod] = useState(() => new Date().toISOString().slice(0, 7))

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

  // Months that have any activity, newest first, for the period selector.
  const availablePeriods = useMemo(() => {
    const keys = new Set([new Date().toISOString().slice(0, 7)])
    invoices.forEach((i) => i.issue_date && keys.add(i.issue_date.slice(0, 7)))
    payments.forEach((p) => p.payment_date && keys.add(p.payment_date.slice(0, 7)))
    expenses.forEach((e) => e.expense_date && keys.add(e.expense_date.slice(0, 7)))
    return [...keys].sort().reverse()
  }, [invoices, payments, expenses])

  const periodLabel = (key) => {
    if (key === 'all') return 'All time'
    const [y, m] = key.split('-')
    return `${MONTH_NAMES[Number(m) - 1]} ${y}`
  }

  const stats = useMemo(() => {
    const inPeriod = (dateStr) => dateStr && (period === 'all' || dateStr.slice(0, 7) === period)

    const periodInvoices = invoices.filter((i) => inPeriod(i.issue_date))
    const invoiced = periodInvoices.reduce((s, i) => s + (Number(i.total) || 0), 0)
    const received = payments
      .filter((p) => inPeriod(p.payment_date))
      .reduce((s, p) => s + (Number(p.amount) || 0), 0)
    const expensesTotal = expenses
      .filter((e) => inPeriod(e.expense_date))
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
  }, [invoices, payments, expenses, period])

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

      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Summary</h2>
        <select
          className="input max-w-[200px]"
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
        >
          <option value="all">All time</option>
          {availablePeriods.map((k) => (
            <option key={k} value={k}>
              {periodLabel(k)}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={`Invoiced · ${periodLabel(period)}`} value={stats.invoiced} icon={InvoiceIcon} tone="indigo" />
        <StatCard label={`Received · ${periodLabel(period)}`} value={stats.received} icon={WalletIcon} tone="green" />
        <StatCard label="Pending payments" value={stats.pending} icon={ClockIcon} tone="amber" />
        <StatCard label={`Profit · ${periodLabel(period)}`} value={stats.profit} icon={TrendingUpIcon} tone={stats.profit < 0 ? 'rose' : 'green'} />
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
