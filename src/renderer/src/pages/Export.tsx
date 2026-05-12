import { useState } from 'react'
import { Download, FileSpreadsheet, FileText, Check } from 'lucide-react'
import { Card, CardContent } from '@renderer/components/ui/card'
import { Button } from '@renderer/components/ui/button'
import { formatCurrency, getCurrentWeekStart, getWeekLabel } from '@renderer/lib/utils'
import { toWeeklyAmount, computeWeeklyCashflow } from '@renderer/types'
import type { Account, IncomeSource, Expense, Goal, BalanceLog } from '@renderer/types'

export default function Export() {
  const [excelLoading, setExcelLoading] = useState(false)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [excelDone, setExcelDone] = useState(false)
  const [pdfDone, setPdfDone] = useState(false)

  async function exportExcel() {
    setExcelLoading(true)
    try {
      const XLSX = await import('xlsx')
      const [income, accounts, expenses, goals, latestLogs] = await Promise.all([
        window.api.income.getAll(),
        window.api.accounts.getAll(),
        window.api.expenses.getAll(),
        window.api.goals.getAll(),
        window.api.balances.getLatest(),
      ])

      // Use single source of truth for cashflow math — handles per_pay,
      // allocation_amount, weekly_extra, percentage allocations, goals.
      const cf = computeWeeklyCashflow(expenses as Expense[], income as IncomeSource[], goals as Goal[])
      const weeklyIncome = cf.weeklyIncome
      const weeklyExpenses = cf.totalAllocations
      const freeCashflow = cf.freeCashflow

      const wb = XLSX.utils.book_new()

      // Budget Summary sheet
      const summary = [
        ['VAULT — Budget Summary', ''],
        ['Week of', getWeekLabel(getCurrentWeekStart())],
        ['', ''],
        ['INCOME', ''],
        ...(income as IncomeSource[]).map(i => [i.person_name, i.amount]),
        ['', ''],
        ['Weekly Income Total', weeklyIncome],
        ['', ''],
        ['EXPENSES (weekly equivalents — uses allocation amounts + per-pay attribution)', ''],
        ...(expenses as Expense[]).map(e => [e.name, cf.effective[e.id] ?? 0]),
        ['', ''],
        ['Weekly Allocations Total', weeklyExpenses],
        ['Goal Contributions Total', cf.goalContributions],
        ['Free Cashflow', freeCashflow],
      ]
      const wsSummary = XLSX.utils.aoa_to_sheet(summary)
      XLSX.utils.book_append_sheet(wb, wsSummary, 'Budget Summary')

      // Accounts sheet — bills assigned per account = bills that DEBIT from this account
      // (with fallback to save_account_id, then legacy account_id)
      const accountRows = [
        ['Account', 'Type', 'Weekly Target', 'Buffer %', 'Latest Balance', 'Weekly Bills (debit from here)', 'Status'],
        ...(accounts as Account[]).map(acc => {
          const log = (latestLogs as BalanceLog[]).find(l => l.account_id === acc.id)
          const weeklyBills = (expenses as Expense[])
            .filter(e => (e.debit_account_id ?? e.save_account_id ?? e.account_id) === acc.id)
            .reduce((sum, e) => sum + (cf.effective[e.id] ?? 0), 0)
          const status = acc.type === 'envelope' ? 'Envelope (transit)'
            : !log ? 'No data'
            : weeklyBills === 0 ? 'Covered'
            : (log.balance / (weeklyBills * 4.33)) >= 1 ? 'Covered'
            : (log.balance / (weeklyBills * 4.33)) >= 0.5 ? 'At Risk'
            : 'Shortfall'
          return [acc.name, acc.type ?? 'envelope', acc.weekly_target, acc.buffer_percent, log?.balance ?? '', weeklyBills, status]
        }),
      ]
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(accountRows), 'Accounts')

      // Expenses sheet — weekly equiv now uses cf.effective (handles per_pay,
      // allocation_amount, weekly_extra, percentage allocations)
      const expenseRows = [
        ['Expense', 'Amount', 'Frequency', 'Allocation', 'Weekly Buffer', 'Due Day', 'Save Account', 'Debit Account', 'Funded by', 'Category', 'Weekly Equiv ($)'],
        ...(expenses as Expense[]).map(e => [
          e.name,
          e.is_percentage ? `${e.percentage_value}% ${e.percentage_basis}` : e.amount,
          e.frequency,
          e.allocation_amount ?? '',
          e.weekly_extra ?? '',
          e.due_day ?? '',
          e.save_account_name ?? e.account_name ?? '',
          e.debit_account_name ?? '',
          e.funded_by_person_name ?? 'Shared',
          e.category,
          cf.effective[e.id] ?? 0,
        ]),
      ]
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(expenseRows), 'Expenses')

      // Goals sheet
      const goalRows = [
        ['Goal', 'Target', 'Saved', 'Remaining', 'Progress %', 'Weekly Contribution', 'Approach', 'Status'],
        ...(goals as Goal[]).map(g => [
          g.name, g.target_amount, g.saved_amount,
          g.target_amount - g.saved_amount,
          ((g.saved_amount / g.target_amount) * 100).toFixed(1) + '%',
          g.weekly_contribution, g.approach ?? '', g.status
        ]),
      ]
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(goalRows), 'Goals')

      XLSX.writeFile(wb, `Vault-Budget-${getCurrentWeekStart()}.xlsx`)
      setExcelDone(true)
      setTimeout(() => setExcelDone(false), 3000)
    } finally {
      setExcelLoading(false)
    }
  }

  async function exportPDF() {
    setPdfLoading(true)
    try {
      const { jsPDF } = await import('jspdf')
      const [income, accounts, expenses, goals, latestLogs] = await Promise.all([
        window.api.income.getAll(),
        window.api.accounts.getAll(),
        window.api.expenses.getAll(),
        window.api.goals.getAll(),
        window.api.balances.getLatest(),
      ])

      // Same single source of truth as the Excel export and the in-app pages.
      const cf = computeWeeklyCashflow(expenses as Expense[], income as IncomeSource[], goals as Goal[])
      const weeklyIncome = cf.weeklyIncome
      const weeklyExpenses = cf.totalAllocations
      const freeCashflow = cf.freeCashflow

      const doc = new jsPDF()
      const primaryColor: [number, number, number] = [20, 184, 166] // teal
      const darkBg: [number, number, number] = [13, 17, 23]
      const textColor: [number, number, number] = [240, 246, 252]
      const mutedColor: [number, number, number] = [139, 148, 158]

      // Header
      doc.setFillColor(...darkBg)
      doc.rect(0, 0, 210, 40, 'F')
      doc.setTextColor(...primaryColor)
      doc.setFontSize(22)
      doc.setFont('helvetica', 'bold')
      doc.text('VAULT', 15, 20)
      doc.setTextColor(...textColor)
      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      doc.text('Budget Report', 15, 28)
      doc.text(getWeekLabel(getCurrentWeekStart()), 15, 35)

      let y = 55

      // Summary section
      doc.setTextColor(...primaryColor)
      doc.setFontSize(12)
      doc.setFont('helvetica', 'bold')
      doc.text('WEEKLY SUMMARY', 15, y)
      y += 8

      const summaryItems = [
        { label: 'Weekly Income', value: formatCurrency(weeklyIncome), color: [16, 185, 129] as [number,number,number] },
        { label: 'Weekly Expenses', value: formatCurrency(weeklyExpenses), color: [245, 158, 11] as [number,number,number] },
        { label: 'Free Cashflow', value: formatCurrency(freeCashflow), color: freeCashflow >= 0 ? [16, 185, 129] : [239, 68, 68] as [number,number,number] },
      ]

      summaryItems.forEach(item => {
        doc.setTextColor(...mutedColor)
        doc.setFontSize(9)
        doc.setFont('helvetica', 'normal')
        doc.text(item.label, 15, y)
        doc.setTextColor(...item.color)
        doc.setFontSize(11)
        doc.setFont('helvetica', 'bold')
        doc.text(item.value, 80, y)
        y += 9
      })

      y += 10

      // Accounts
      if ((accounts as Account[]).length > 0) {
        doc.setTextColor(...primaryColor)
        doc.setFontSize(12)
        doc.setFont('helvetica', 'bold')
        doc.text('ACCOUNTS', 15, y)
        y += 8

        ;(accounts as Account[]).forEach(acc => {
          const log = (latestLogs as BalanceLog[]).find(l => l.account_id === acc.id)
          doc.setTextColor(...textColor)
          doc.setFontSize(9)
          doc.setFont('helvetica', 'normal')
          doc.text(acc.name, 15, y)
          doc.setTextColor(...mutedColor)
          doc.text(log ? formatCurrency(log.balance) : 'No balance', 80, y)
          doc.text(`Target: ${formatCurrency(acc.weekly_target)}/wk`, 130, y)
          y += 7
          if (y > 260) { doc.addPage(); y = 20 }
        })
        y += 8
      }

      // Goals
      if ((goals as Goal[]).filter(g => g.status === 'active').length > 0) {
        doc.setTextColor(...primaryColor)
        doc.setFontSize(12)
        doc.setFont('helvetica', 'bold')
        doc.text('ACTIVE GOALS', 15, y)
        y += 8

        ;(goals as Goal[]).filter(g => g.status === 'active').forEach(goal => {
          const pct = Math.min(100, (goal.saved_amount / goal.target_amount) * 100)
          doc.setTextColor(...textColor)
          doc.setFontSize(9)
          doc.setFont('helvetica', 'normal')
          doc.text(goal.name, 15, y)
          doc.setTextColor(...mutedColor)
          doc.text(`${formatCurrency(goal.saved_amount)} / ${formatCurrency(goal.target_amount)} (${pct.toFixed(0)}%)`, 80, y)
          y += 7
          if (y > 260) { doc.addPage(); y = 20 }
        })
      }

      // Footer
      doc.setTextColor(...mutedColor)
      doc.setFontSize(8)
      doc.text(`Generated by Vault · ${new Date().toLocaleDateString('en-AU')}`, 15, 285)

      doc.save(`Vault-Report-${getCurrentWeekStart()}.pdf`)
      setPdfDone(true)
      setTimeout(() => setPdfDone(false), 3000)
    } finally {
      setPdfLoading(false)
    }
  }

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold text-text-primary">Export</h1>
        <p className="text-sm text-text-secondary mt-1">Download your budget data as a spreadsheet or a styled PDF report.</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card glow>
          <CardContent className="pt-8 pb-8 flex flex-col items-center text-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-success/10 border border-success/30 flex items-center justify-center">
              <FileSpreadsheet size={26} className="text-success" />
            </div>
            <div>
              <p className="text-base font-semibold text-text-primary">Excel Spreadsheet</p>
              <p className="text-xs text-text-secondary mt-1 max-w-[200px]">
                4 sheets: Budget Summary, Accounts, Expenses, Goals. Easy to filter and analyse.
              </p>
            </div>
            <Button
              onClick={exportExcel}
              disabled={excelLoading}
              variant={excelDone ? 'success' : 'default'}
              className="gap-2"
            >
              {excelLoading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : excelDone ? (
                <><Check size={15} /> Downloaded!</>
              ) : (
                <><Download size={15} /> Export to Excel</>
              )}
            </Button>
          </CardContent>
        </Card>

        <Card glow>
          <CardContent className="pt-8 pb-8 flex flex-col items-center text-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-danger/10 border border-danger/30 flex items-center justify-center">
              <FileText size={26} className="text-danger" />
            </div>
            <div>
              <p className="text-base font-semibold text-text-primary">PDF Report</p>
              <p className="text-xs text-text-secondary mt-1 max-w-[200px]">
                Styled one-page summary with your weekly numbers, account status, and active goals.
              </p>
            </div>
            <Button
              onClick={exportPDF}
              disabled={pdfLoading}
              variant={pdfDone ? 'success' : 'outline'}
              className="gap-2"
            >
              {pdfLoading ? (
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : pdfDone ? (
                <><Check size={15} /> Downloaded!</>
              ) : (
                <><Download size={15} /> Export to PDF</>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-5 pb-5">
          <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">What gets exported</p>
          <div className="grid grid-cols-2 gap-x-8 gap-y-2">
            {[
              'All income sources',
              'Weekly totals & free cashflow',
              'All accounts with current balances',
              'Account health status',
              'Full expense list with weekly equivalents',
              'All active, paused & completed goals',
            ].map(item => (
              <div key={item} className="flex items-center gap-2 text-xs text-text-secondary">
                <div className="w-1.5 h-1.5 rounded-full bg-accent flex-shrink-0" />
                {item}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
