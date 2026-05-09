import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, startOfWeek, addDays } from 'date-fns'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function formatCurrencyAccounting(amount: number): string {
  const abs = new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(amount))
  return amount < 0 ? `(${abs})` : abs
}

export function formatCurrencyCompact(amount: number): string {
  if (Math.abs(amount) >= 1000) {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(amount)
  }
  return formatCurrency(amount)
}

export function getCurrentWeekStart(): string {
  const monday = startOfWeek(new Date(), { weekStartsOn: 1 })
  return format(monday, 'yyyy-MM-dd')
}

export function getWeekLabel(weekStart: string): string {
  const start = new Date(weekStart + 'T00:00:00')
  const end = addDays(start, 6)
  return `${format(start, 'd MMM')} – ${format(end, 'd MMM yyyy')}`
}

export function getDaysUntil(dateStr: string): number {
  const target = new Date(dateStr + 'T00:00:00')
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

export function getDueDayLabel(dueDay: number): string {
  const suffixes = ['th', 'st', 'nd', 'rd']
  const v = dueDay % 100
  return dueDay + (suffixes[(v - 20) % 10] || suffixes[v] || suffixes[0])
}
