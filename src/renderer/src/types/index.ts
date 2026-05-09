export type AccountType = 'envelope' | 'offset' | 'savings' | 'mortgage'

export const ACCOUNT_TYPE_OPTIONS: { value: AccountType; label: string; hint: string }[] = [
  { value: 'envelope', label: 'Envelope', hint: 'Money saves here weekly, then transfers out' },
  { value: 'offset', label: 'Offset', hint: 'Bills debit here; balance reduces mortgage interest' },
  { value: 'savings', label: 'Savings', hint: 'Long-term holding (sweeps welcome)' },
  { value: 'mortgage', label: 'Mortgage', hint: 'The loan itself' },
]

export interface Account {
  id: number
  name: string
  color: string
  weekly_target: number
  buffer_percent: number
  sort_order: number
  type: AccountType
  buffer_target?: number
  sweep_amount?: number
  sweep_to_account_id?: number
  created_at: string
}

export interface AccountInput {
  name: string
  color: string
  weekly_target: number
  buffer_percent: number
  sort_order?: number
  type?: AccountType
  buffer_target?: number
  sweep_amount?: number
  sweep_to_account_id?: number
}

export interface IncomeSource {
  id: number
  person_name: string
  amount: number
  frequency: 'weekly' | 'fortnightly' | 'monthly' | 'annual'
  payday_reference?: string
  created_at: string
}

export interface IncomeSourceInput {
  person_name: string
  amount: number
  frequency: 'weekly' | 'fortnightly' | 'monthly' | 'annual'
  payday_reference?: string
}

export interface Expense {
  id: number
  name: string
  amount: number
  allocation_amount?: number
  weekly_extra?: number
  frequency: 'weekly' | 'fortnightly' | 'monthly' | 'quarterly' | 'annual'
  due_day?: number
  account_id?: number
  save_account_id?: number
  debit_account_id?: number
  account_name?: string
  account_color?: string
  save_account_name?: string
  save_account_color?: string
  debit_account_name?: string
  debit_account_color?: string
  category: string
  created_at: string
}

export interface ExpenseInput {
  name: string
  amount: number
  allocation_amount?: number
  weekly_extra?: number
  frequency: 'weekly' | 'fortnightly' | 'monthly' | 'quarterly' | 'annual'
  due_day?: number
  account_id?: number
  save_account_id?: number
  debit_account_id?: number
  category: string
}

export interface BalanceLog {
  id: number
  account_id: number
  account_name?: string
  account_color?: string
  balance: number
  notes?: string
  logged_at: string
  weekly_target?: number
  buffer_percent?: number
}

export interface BalanceLogInput {
  account_id: number
  balance: number
  notes?: string
}

export interface WeeklyAllocation {
  id: number
  week_start: string
  account_id: number
  account_name?: string
  account_color?: string
  planned_amount: number
  actual_amount?: number
  buffer_amount: number
  funded: number
}

export interface WeeklyAllocationInput {
  week_start: string
  account_id: number
  planned_amount: number
  buffer_amount: number
  actual_amount?: number
}

export interface Goal {
  id: number
  name: string
  target_amount: number
  saved_amount: number
  deadline?: string
  priority: 'want' | 'need'
  status: 'active' | 'paused' | 'completed'
  weekly_contribution: number
  approach?: 'aggressive' | 'comfortable' | 'steady'
  created_at: string
}

export interface GoalInput {
  name: string
  target_amount: number
  deadline?: string
  priority: 'want' | 'need'
  weekly_contribution?: number
  approach?: 'aggressive' | 'comfortable' | 'steady'
}

export interface GoalSnapshot {
  id: number
  goal_id: number
  saved_amount: number
  snapshot_date: string
}

export interface GoalSnapshotInput {
  goal_id: number
  saved_amount: number
}

export const EXPENSE_CATEGORIES = [
  'Bills & Utilities',
  'Groceries',
  'Transport & Fuel',
  'Mortgage & Rent',
  'Insurance',
  'Subscriptions',
  'Healthcare',
  'Entertainment',
  'Council Rates',
  'Strata Fees',
  'Car Registration',
  'Professional Registration',
  'Savings',
  'Other',
] as const

export const ACCOUNT_COLORS = [
  '#14B8A6', // teal
  '#6366F1', // indigo
  '#8B5CF6', // violet
  '#EC4899', // pink
  '#F59E0B', // amber
  '#10B981', // emerald
  '#3B82F6', // blue
  '#EF4444', // red
  '#F97316', // orange
  '#84CC16', // lime
] as const

// Converts any expense frequency to a weekly equivalent amount
export function toWeeklyAmount(amount: number, frequency: string): number {
  switch (frequency) {
    case 'weekly': return amount
    case 'fortnightly': return amount / 2
    case 'monthly': return amount / 4.33
    case 'quarterly': return amount / 13
    case 'annual': return amount / 52
    default: return amount
  }
}

// Converts any income frequency to a weekly equivalent amount
export function toWeeklyIncome(amount: number, frequency: string): number {
  return toWeeklyAmount(amount, frequency)
}

// Given a known payday date and frequency, returns the next payday on or after `from`
export function getNextPayday(reference: string, frequency: string, from: Date = new Date()): Date {
  const ref = new Date(reference + 'T00:00:00')
  const base = new Date(from)
  base.setHours(0, 0, 0, 0)

  if (frequency === 'weekly' || frequency === 'fortnightly') {
    const periodDays = frequency === 'weekly' ? 7 : 14
    const diff = Math.floor((base.getTime() - ref.getTime()) / 86400000)
    if (diff < 0) return ref
    const next = new Date(ref)
    next.setDate(ref.getDate() + Math.floor(diff / periodDays) * periodDays)
    if (next.getTime() < base.getTime()) next.setDate(next.getDate() + periodDays)
    return next
  }
  if (frequency === 'monthly') {
    const next = new Date(base.getFullYear(), base.getMonth(), ref.getDate())
    if (next.getTime() < base.getTime()) next.setMonth(next.getMonth() + 1)
    return next
  }
  if (frequency === 'annual') {
    const next = new Date(base.getFullYear(), ref.getMonth(), ref.getDate())
    if (next.getTime() < base.getTime()) next.setFullYear(next.getFullYear() + 1)
    return next
  }
  return base
}

// Returns true if a payday falls within the 7-day window starting at weekStart (yyyy-MM-dd)
export function isPayWeek(reference: string, frequency: string, weekStart: string): boolean {
  const weekStartDate = new Date(weekStart + 'T00:00:00')
  const weekEndDate = new Date(weekStart + 'T00:00:00')
  weekEndDate.setDate(weekEndDate.getDate() + 7)
  const payday = getNextPayday(reference, frequency, weekStartDate)
  return payday >= weekStartDate && payday < weekEndDate
}

// Returns number of days until the next payday (0 = today)
export function daysUntilPayday(reference: string, frequency: string): number {
  const next = getNextPayday(reference, frequency)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.round((next.getTime() - today.getTime()) / 86400000)
}

// Returns every payday in the window [from, from + weeksAhead*7 days)
export function getUpcomingPaydays(reference: string, frequency: string, weeksAhead: number, from: Date = new Date()): Date[] {
  const start = new Date(from)
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setDate(end.getDate() + weeksAhead * 7)

  const dates: Date[] = []
  let cursor = new Date(start)
  for (let i = 0; i < 60 && cursor < end; i++) {
    const next = getNextPayday(reference, frequency, cursor)
    if (next >= end) break
    if (dates.length === 0 || next.getTime() !== dates[dates.length - 1].getTime()) {
      dates.push(new Date(next))
    }
    cursor = new Date(next.getTime() + 86400000) // advance one day past this payday
  }
  return dates
}
