import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      window: {
        minimize: () => void
        maximize: () => void
        close: () => void
      }
      accounts: {
        getAll: () => Promise<Account[]>
        save: (data: AccountInput) => Promise<Account>
        update: (id: number, data: Partial<AccountInput>) => Promise<Account>
        delete: (id: number) => Promise<void>
      }
      income: {
        getAll: () => Promise<IncomeSource[]>
        save: (data: IncomeSoureInput) => Promise<IncomeSource>
        update: (id: number, data: Partial<IncomeSourceInput>) => Promise<IncomeSource>
        delete: (id: number) => Promise<void>
      }
      expenses: {
        getAll: () => Promise<Expense[]>
        save: (data: ExpenseInput) => Promise<Expense>
        update: (id: number, data: Partial<ExpenseInput>) => Promise<Expense>
        delete: (id: number) => Promise<void>
      }
      balances: {
        getAll: (accountId?: number) => Promise<BalanceLog[]>
        getLatest: () => Promise<BalanceLog[]>
        save: (data: BalanceLogInput) => Promise<BalanceLog>
      }
      allocations: {
        getWeek: (weekStart: string) => Promise<WeeklyAllocation[]>
        upsert: (data: WeeklyAllocationInput) => Promise<WeeklyAllocation>
        setFunded: (id: number, funded: boolean) => Promise<void>
      }
      goals: {
        getAll: () => Promise<Goal[]>
        save: (data: GoalInput) => Promise<Goal>
        update: (id: number, data: Partial<GoalInput>) => Promise<Goal>
        delete: (id: number) => Promise<void>
        saveSnapshot: (data: GoalSnapshotInput) => Promise<void>
        getSnapshots: (goalId: number) => Promise<GoalSnapshot[]>
      }
    }
  }
}
