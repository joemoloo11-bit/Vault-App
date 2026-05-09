import { useState, useEffect } from 'react'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@renderer/components/ui/card'
import { formatCurrency } from '@renderer/lib/utils'
import { toWeeklyAmount, ACCOUNT_COLORS } from '@renderer/types'
import type { IncomeSource, Expense, BalanceLog, Account } from '@renderer/types'
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns'

type TimeRange = '3m' | '6m' | '12m'

const CHART_COLORS = ['#14B8A6', '#6366F1', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#3B82F6', '#EF4444']

const tooltipStyle = {
  backgroundColor: '#161B22',
  border: '1px solid #21262D',
  borderRadius: '8px',
  color: '#F0F6FC',
  fontSize: '12px',
}

export default function Charts() {
  const [tab, setTab] = useState<'overview' | 'accounts' | 'breakdown' | 'cashflow'>('overview')
  const [range, setRange] = useState<TimeRange>('6m')
  const [income, setIncome] = useState<IncomeSource[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [allLogs, setAllLogs] = useState<BalanceLog[]>([])

  useEffect(() => {
    async function load() {
      const [inc, exp, acc, logs] = await Promise.all([
        window.api.income.getAll(),
        window.api.expenses.getAll(),
        window.api.accounts.getAll(),
        window.api.balances.getAll(),
      ])
      setIncome(inc)
      setExpenses(exp)
      setAccounts(acc)
      setAllLogs(logs)
    }
    load()
  }, [])

  const weeklyIncome = income.reduce((sum, s) => sum + toWeeklyAmount(s.amount, s.frequency), 0)
  const weeklyExpenses = expenses.reduce((sum, e) => sum + toWeeklyAmount(e.amount, e.frequency), 0)
  const monthlyIncome = weeklyIncome * 4.33
  const monthlyExpenses = weeklyExpenses * 4.33

  // Monthly overview data (simulated from static income/expenses)
  const monthCount = range === '3m' ? 3 : range === '6m' ? 6 : 12
  const overviewData = Array.from({ length: monthCount }, (_, i) => {
    const d = subMonths(new Date(), monthCount - 1 - i)
    return {
      month: format(d, 'MMM'),
      income: monthlyIncome,
      expenses: monthlyExpenses,
      cashflow: monthlyIncome - monthlyExpenses,
    }
  })

  // Category breakdown
  const categoryTotals = expenses.reduce((acc, exp) => {
    const weekly = toWeeklyAmount(exp.amount, exp.frequency)
    acc[exp.category] = (acc[exp.category] || 0) + weekly
    return acc
  }, {} as Record<string, number>)

  const pieData = Object.entries(categoryTotals)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)

  // Account balance history
  const accountLogData = accounts.map(acc => {
    const logs = allLogs
      .filter(l => l.account_id === acc.id)
      .sort((a, b) => new Date(a.logged_at).getTime() - new Date(b.logged_at).getTime())
      .slice(-20)
      .map(l => ({
        date: format(new Date(l.logged_at), 'd MMM'),
        balance: l.balance,
      }))
    return { account: acc, logs }
  }).filter(d => d.logs.length > 0)

  const tabs = [
    { key: 'overview', label: 'Income vs Expenses' },
    { key: 'accounts', label: 'Account Balances' },
    { key: 'breakdown', label: 'Spending Breakdown' },
    { key: 'cashflow', label: 'Cashflow Trend' },
  ] as const

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">Charts & Reports</h1>
          <p className="text-sm text-text-secondary mt-1">Visualise your financial health over time.</p>
        </div>
        <div className="flex gap-1 bg-surface rounded-lg p-1 border border-border">
          {(['3m', '6m', '12m'] as TimeRange[]).map(r => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                range === r ? 'bg-accent text-white' : 'text-text-secondary hover:text-text-primary hover:bg-surface-hover'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Tab strip */}
      <div className="flex gap-1 overflow-x-auto bg-surface rounded-lg p-1 border border-border">
        {tabs.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-3 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-all ${
              tab === key ? 'bg-accent text-white' : 'text-text-secondary hover:text-text-primary hover:bg-surface-hover'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Income vs Expenses */}
      {tab === 'overview' && (
        <Card>
          <CardHeader><CardTitle>Monthly Income vs Expenses</CardTitle></CardHeader>
          <CardContent>
            {income.length === 0 && expenses.length === 0 ? (
              <EmptyChart text="Add income and expenses in Budget Setup to see this chart." />
            ) : (
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={overviewData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#21262D" vertical={false} />
                  <XAxis dataKey="month" tick={{ fill: '#8B949E', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#8B949E', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => formatCurrency(v)} />
                  <Legend wrapperStyle={{ fontSize: 12, color: '#8B949E' }} />
                  <Bar dataKey="income" name="Income" fill="#10B981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expenses" name="Expenses" fill="#F59E0B" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      )}

      {/* Account Balances */}
      {tab === 'accounts' && (
        <div className="space-y-4">
          {accountLogData.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center">
                <EmptyChart text="Log account balances in the Account Tracker to see history here." />
              </CardContent>
            </Card>
          ) : (
            accountLogData.map(({ account, logs }) => (
              <Card key={account.id}>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: account.color }} />
                    <CardTitle>{account.name}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={logs} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#21262D" vertical={false} />
                      <XAxis dataKey="date" tick={{ fill: '#8B949E', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: '#8B949E', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v/1000).toFixed(1)}k`} />
                      <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => formatCurrency(v)} />
                      <Line type="monotone" dataKey="balance" stroke={account.color} strokeWidth={2} dot={{ fill: account.color, r: 3 }} activeDot={{ r: 5 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Spending Breakdown */}
      {tab === 'breakdown' && (
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardHeader><CardTitle>By Category (weekly)</CardTitle></CardHeader>
            <CardContent>
              {pieData.length === 0 ? (
                <EmptyChart text="Add expenses in Budget Setup to see this chart." />
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={70}
                      outerRadius={110}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {pieData.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => formatCurrency(v)} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Category Breakdown</CardTitle></CardHeader>
            <CardContent>
              {pieData.length === 0 ? (
                <EmptyChart text="No expenses yet." />
              ) : (
                <div className="space-y-3 mt-2">
                  {pieData.map((item, i) => (
                    <div key={item.name} className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                        <span className="text-sm text-text-secondary truncate">{item.name}</span>
                      </div>
                      <span className="text-sm font-medium text-text-primary flex-shrink-0">{formatCurrency(item.value)}<span className="text-text-muted text-[10px]">/wk</span></span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Cashflow Trend */}
      {tab === 'cashflow' && (
        <Card>
          <CardHeader><CardTitle>Free Cashflow Trend (projected)</CardTitle></CardHeader>
          <CardContent>
            {income.length === 0 ? (
              <EmptyChart text="Add income and expenses to see your cashflow trend." />
            ) : (
              <ResponsiveContainer width="100%" height={320}>
                <LineChart data={overviewData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#21262D" vertical={false} />
                  <XAxis dataKey="month" tick={{ fill: '#8B949E', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#8B949E', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v/1000).toFixed(1)}k`} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => formatCurrency(v)} />
                  <Line type="monotone" dataKey="cashflow" name="Free Cashflow" stroke="#14B8A6" strokeWidth={2.5} dot={{ fill: '#14B8A6', r: 3 }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function EmptyChart({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <p className="text-sm text-text-muted">{text}</p>
    </div>
  )
}
