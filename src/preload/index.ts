import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

contextBridge.exposeInMainWorld('electron', electronAPI)

contextBridge.exposeInMainWorld('api', {
  // Window controls
  window: {
    minimize: () => ipcRenderer.send('window:minimize'),
    maximize: () => ipcRenderer.send('window:maximize'),
    close: () => ipcRenderer.send('window:close'),
  },

  // Accounts
  accounts: {
    getAll: () => ipcRenderer.invoke('accounts:getAll'),
    save: (data: unknown) => ipcRenderer.invoke('accounts:save', data),
    update: (id: number, data: unknown) => ipcRenderer.invoke('accounts:update', id, data),
    delete: (id: number) => ipcRenderer.invoke('accounts:delete', id),
  },

  // Income Sources
  income: {
    getAll: () => ipcRenderer.invoke('income:getAll'),
    save: (data: unknown) => ipcRenderer.invoke('income:save', data),
    update: (id: number, data: unknown) => ipcRenderer.invoke('income:update', id, data),
    delete: (id: number) => ipcRenderer.invoke('income:delete', id),
  },

  // Expenses
  expenses: {
    getAll: () => ipcRenderer.invoke('expenses:getAll'),
    save: (data: unknown) => ipcRenderer.invoke('expenses:save', data),
    update: (id: number, data: unknown) => ipcRenderer.invoke('expenses:update', id, data),
    delete: (id: number) => ipcRenderer.invoke('expenses:delete', id),
  },

  // Balance Logs
  balances: {
    getAll: (accountId?: number) => ipcRenderer.invoke('balances:getAll', accountId),
    getLatest: () => ipcRenderer.invoke('balances:getLatest'),
    save: (data: unknown) => ipcRenderer.invoke('balances:save', data),
  },

  // Weekly Allocations
  allocations: {
    getWeek: (weekStart: string) => ipcRenderer.invoke('allocations:getWeek', weekStart),
    upsert: (data: unknown) => ipcRenderer.invoke('allocations:upsert', data),
    setFunded: (id: number, funded: boolean) => ipcRenderer.invoke('allocations:setFunded', id, funded),
  },

  // Goals
  goals: {
    getAll: () => ipcRenderer.invoke('goals:getAll'),
    save: (data: unknown) => ipcRenderer.invoke('goals:save', data),
    update: (id: number, data: unknown) => ipcRenderer.invoke('goals:update', id, data),
    delete: (id: number) => ipcRenderer.invoke('goals:delete', id),
    saveSnapshot: (data: unknown) => ipcRenderer.invoke('goals:saveSnapshot', data),
    getSnapshots: (goalId: number) => ipcRenderer.invoke('goals:getSnapshots', goalId),
  },

  // Test Runs
  tests: {
    getAll: () => ipcRenderer.invoke('tests:getAll'),
    save: (data: unknown) => ipcRenderer.invoke('tests:save', data),
    update: (id: number, data: unknown) => ipcRenderer.invoke('tests:update', id, data),
    delete: (id: number) => ipcRenderer.invoke('tests:delete', id),
  },

  // Updates
  updates: {
    check: (folderPath: string) => ipcRenderer.invoke('app:checkForUpdates', folderPath),
    install: (exePath: string) => ipcRenderer.invoke('app:installUpdate', exePath),
  },

  // Debug
  debug: {
    getInfo: () => ipcRenderer.invoke('debug:getInfo'),
    getTableCounts: () => ipcRenderer.invoke('debug:getTableCounts'),
    getTableRows: (table: string) => ipcRenderer.invoke('debug:getTableRows', table),
    saveLog: (text: string) => ipcRenderer.invoke('debug:saveLog', text),
  },
})
