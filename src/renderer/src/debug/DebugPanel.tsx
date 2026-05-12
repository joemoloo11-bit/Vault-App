import { useState, useEffect, useRef } from 'react'
import { X, Trash2, Bug, Activity, Database, Info, Terminal, Circle, Download, Copy } from 'lucide-react'
import { format } from 'date-fns'
import { getEntries, clearEntries, subscribeToDebug, exportLogText, getSessionStart, getTotalCount, type DebugEntry, type LogLevel } from './debugStore'

type Tab = 'events' | 'errors' | 'data' | 'info' | 'active'

const levelConfig: Record<LogLevel, { color: string; bg: string }> = {
  error:   { color: 'text-danger',         bg: 'bg-danger/10' },
  warn:    { color: 'text-warning',        bg: 'bg-warning/10' },
  info:    { color: 'text-text-secondary', bg: '' },
  focus:   { color: 'text-accent',         bg: 'bg-accent/10' },
  blur:    { color: 'text-text-muted',     bg: '' },
  click:   { color: 'text-indigo-400',     bg: '' },
  input:   { color: 'text-sky-400',        bg: '' },
  keydown: { color: 'text-purple-400',     bg: '' },
  ipc:     { color: 'text-violet-400',     bg: '' },
  portal:  { color: 'text-orange-400',     bg: '' },
  nav:     { color: 'text-green-400',      bg: '' },
  render:  { color: 'text-text-secondary', bg: '' },
}

interface AppInfo {
  electronVersion: string
  nodeVersion: string
  chromeVersion: string
  platform: string
  dbPath: string
  dbSizeKb: number
  uptimeSeconds: number
  appVersion: string
}

interface TableCounts {
  [table: string]: number
}

interface DebugPanelProps {
  visible: boolean
  onClose: () => void
}

export default function DebugPanel({ visible, onClose }: DebugPanelProps) {
  const [tab, setTab] = useState<Tab>('events')
  const [entries, setEntries] = useState<DebugEntry[]>([])
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null)
  const [tableCounts, setTableCounts] = useState<TableCounts | null>(null)
  const [tableRows, setTableRows] = useState<{ table: string; rows: unknown[] } | null>(null)
  const [activeElement, setActiveElement] = useState<string>('none')
  const [filterLevel, setFilterLevel] = useState<LogLevel | 'all'>('all')
  const [paused, setPaused] = useState(false)
  const [copyLabel, setCopyLabel] = useState<'Copy' | 'Copied!'>('Copy')
  const [saveLabel, setSaveLabel] = useState<'Export' | 'Saved!' | 'Error'>('Export')
  const pausedRef = useRef(paused)
  pausedRef.current = paused

  async function handleExportLog() {
    const text = exportLogText()
    try {
      const path = await (window.api as any).debug.saveLog(text)
      setSaveLabel('Saved!')
      setTimeout(() => setSaveLabel('Export'), 2500)
      console.info(`Debug log saved to: ${path}`)
    } catch {
      setSaveLabel('Error')
      setTimeout(() => setSaveLabel('Export'), 2500)
    }
  }

  function handleCopyLog() {
    navigator.clipboard.writeText(exportLogText()).then(() => {
      setCopyLabel('Copied!')
      setTimeout(() => setCopyLabel('Copy'), 2500)
    })
  }

  useEffect(() => {
    const unsub = subscribeToDebug(() => {
      if (!pausedRef.current) setEntries([...getEntries()])
    })
    setEntries([...getEntries()])
    return unsub
  }, [])

  // Track active element live
  useEffect(() => {
    if (!visible) return
    const interval = setInterval(() => {
      const el = document.activeElement
      if (!el || el === document.body) {
        setActiveElement('document.body (nothing focused)')
        return
      }
      const tag = el.tagName.toLowerCase()
      const id = el.id ? `#${el.id}` : ''
      const role = el.getAttribute('role') ?? ''
      const ariaLabel = el.getAttribute('aria-label') ?? ''
      const dataState = el.getAttribute('data-state') ?? ''
      const text = el.textContent?.trim().slice(0, 60) ?? ''
      setActiveElement(`${tag}${id}${role ? ` [role="${role}"]` : ''}${dataState ? ` [data-state="${dataState}"]` : ''}${ariaLabel ? ` [aria-label="${ariaLabel}"]` : ''}${text ? ` "${text}"` : ''}`)
    }, 250)
    return () => clearInterval(interval)
  }, [visible])

  async function loadAppInfo() {
    try {
      const info = await (window.api as any).debug.getInfo() as AppInfo
      setAppInfo(info)
    } catch (e) {
      setAppInfo(null)
    }
  }

  async function loadTableCounts() {
    try {
      const counts = await (window.api as any).debug.getTableCounts() as TableCounts
      setTableCounts(counts)
    } catch (e) {
      setTableCounts(null)
    }
  }

  async function loadTableRows(table: string) {
    try {
      const rows = await (window.api as any).debug.getTableRows(table) as unknown[]
      setTableRows({ table, rows })
    } catch (e) {
      setTableRows(null)
    }
  }

  useEffect(() => {
    if (!visible) return
    if (tab === 'info') loadAppInfo()
    if (tab === 'data') loadTableCounts()
  }, [visible, tab])

  const filtered = entries.filter(e =>
    filterLevel === 'all' ? true : e.level === filterLevel
  )

  const errorCount = entries.filter(e => e.level === 'error').length

  if (!visible) return null

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-end justify-end pointer-events-none"
      style={{ fontFamily: '"JetBrains Mono", "Fira Code", "Consolas", monospace' }}
    >
      <div
        className="pointer-events-auto w-[600px] h-[80vh] flex flex-col shadow-2xl border border-border-subtle"
        style={{ background: '#0A0D12', borderRadius: '12px 0 0 12px', marginRight: 0 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0"
          style={{ background: '#111418' }}>
          <div className="flex items-center gap-2">
            <Bug size={14} className="text-accent" />
            <span className="text-xs font-semibold text-text-primary tracking-wider">VAULT DEBUG</span>
            <span className="text-[10px] text-text-muted">v1.10.4</span>
            {errorCount > 0 && (
              <span className="bg-danger text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                {errorCount} ERR
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPaused(p => !p)}
              className={`text-[10px] px-2 py-1 rounded border transition-colors ${
                paused ? 'border-warning text-warning' : 'border-border text-text-muted hover:border-border-subtle'
              }`}
            >
              {paused ? '⏸ PAUSED' : '▶ LIVE'}
            </button>
            <button onClick={onClose} className="text-text-muted hover:text-danger transition-colors p-1">
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Active element bar — always visible */}
        <div className="px-4 py-2 border-b border-border flex-shrink-0" style={{ background: '#0D1017' }}>
          <div className="flex items-center gap-2">
            <Circle size={7} className="text-accent flex-shrink-0 fill-accent" />
            <span className="text-[10px] text-text-muted uppercase tracking-wider mr-1">Active:</span>
            <span className="text-[10px] text-accent truncate">{activeElement}</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-0.5 px-3 py-2 border-b border-border flex-shrink-0" style={{ background: '#0D1017' }}>
          {([
            { key: 'events', label: 'Events', icon: Activity },
            { key: 'errors', label: `Errors${errorCount > 0 ? ` (${errorCount})` : ''}`, icon: Terminal },
            { key: 'active', label: 'Focus Log', icon: Activity },
            { key: 'data', label: 'Data', icon: Database },
            { key: 'info', label: 'App Info', icon: Info },
          ] as const).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-[11px] font-medium transition-colors ${
                tab === key
                  ? 'bg-accent/20 text-accent'
                  : 'text-text-muted hover:text-text-secondary hover:bg-surface-hover'
              } ${key === 'errors' && errorCount > 0 && tab !== 'errors' ? 'text-danger/70' : ''}`}
            >
              <Icon size={11} />
              {label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex flex-col">

          {/* Events / Errors / Focus Log tabs */}
          {(tab === 'events' || tab === 'errors' || tab === 'active') && (
            <>
              {/* Toolbar */}
              <div className="flex items-center justify-between px-3 py-1.5 border-b border-border flex-shrink-0" style={{ background: '#0D1017' }}>
                <div className="flex items-center gap-1 flex-wrap">
                  {(tab === 'events' ? ['all','error','warn','click','input','keydown','ipc','portal','info'] as const :
                    tab === 'errors' ? ['error','warn'] as const :
                    ['focus','blur','click'] as const).map(level => (
                    <button
                      key={level}
                      onClick={() => setFilterLevel(level === filterLevel ? 'all' : level)}
                      className={`text-[9px] px-2 py-0.5 rounded border transition-colors uppercase tracking-wider ${
                        filterLevel === level
                          ? 'border-accent bg-accent/20 text-accent'
                          : 'border-border text-text-muted hover:border-border-subtle'
                      }`}
                    >
                      {level}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => { clearEntries(filterLevel === 'all' ? undefined : filterLevel); setEntries([...getEntries()]) }}
                  className="flex items-center gap-1 text-[10px] text-text-muted hover:text-danger transition-colors"
                >
                  <Trash2 size={10} /> Clear
                </button>
              </div>

              {/* Log entries */}
              <div className="flex-1 overflow-y-auto">
                {filtered.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-[11px] text-text-muted">No entries yet.</p>
                  </div>
                ) : (
                  filtered
                    .filter(e => {
                      if (tab === 'errors') return e.level === 'error' || e.level === 'warn'
                      if (tab === 'active') return e.level === 'focus' || e.level === 'blur' || e.level === 'click'
                      return true
                    })
                    .map(entry => {
                      const lc = levelConfig[entry.level]
                      return (
                        <div key={entry.id} className={`flex gap-2 px-3 py-1.5 border-b border-border/40 hover:bg-white/5 ${lc.bg}`}>
                          <span className="text-[9px] text-text-muted flex-shrink-0 mt-0.5 tabular-nums">
                            {format(entry.timestamp, 'HH:mm:ss.SSS')}
                          </span>
                          <span className={`text-[9px] font-semibold uppercase flex-shrink-0 mt-0.5 w-10 ${lc.color}`}>
                            {entry.level}
                          </span>
                          <div className="min-w-0">
                            <p className={`text-[11px] break-all ${lc.color}`}>{entry.message}</p>
                            {entry.detail && (
                              <p className="text-[10px] text-text-muted break-all mt-0.5">{entry.detail}</p>
                            )}
                          </div>
                        </div>
                      )
                    })
                )}
              </div>
            </>
          )}

          {/* Data Inspector tab */}
          {tab === 'data' && (
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {tableCounts ? (
                <>
                  <p className="text-[10px] text-text-muted uppercase tracking-wider mb-3">Click a table to view rows</p>
                  {Object.entries(tableCounts).map(([table, count]) => (
                    <button
                      key={table}
                      onClick={() => loadTableRows(table)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded border text-left transition-colors ${
                        tableRows?.table === table
                          ? 'border-accent bg-accent/10'
                          : 'border-border hover:border-border-subtle hover:bg-white/5'
                      }`}
                    >
                      <span className="text-[11px] text-text-secondary font-mono">{table}</span>
                      <span className={`text-[11px] font-semibold ${count > 0 ? 'text-accent' : 'text-text-muted'}`}>
                        {count} row{count !== 1 ? 's' : ''}
                      </span>
                    </button>
                  ))}

                  {tableRows && (
                    <div className="mt-4">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-[10px] text-accent uppercase tracking-wider font-semibold">{tableRows.table}</p>
                        <button
                          onClick={() => setTableRows(null)}
                          className="text-[10px] text-text-muted hover:text-danger"
                        >
                          close ×
                        </button>
                      </div>
                      <div className="overflow-x-auto rounded border border-border">
                        {tableRows.rows.length === 0 ? (
                          <p className="text-[11px] text-text-muted p-3">Empty table</p>
                        ) : (
                          <table className="w-full text-[10px]">
                            <thead>
                              <tr className="border-b border-border" style={{ background: '#111418' }}>
                                {Object.keys(tableRows.rows[0] as object).map(col => (
                                  <th key={col} className="px-2 py-1.5 text-left text-text-muted font-semibold uppercase tracking-wider whitespace-nowrap">{col}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {tableRows.rows.map((row, i) => (
                                <tr key={i} className="border-b border-border/40 hover:bg-white/5">
                                  {Object.values(row as object).map((val, j) => (
                                    <td key={j} className="px-2 py-1.5 text-text-secondary font-mono whitespace-nowrap max-w-[200px] truncate">
                                      {val === null ? <span className="text-text-muted italic">null</span> : String(val)}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-[11px] text-text-muted">Loading...</p>
              )}
            </div>
          )}

          {/* App Info tab */}
          {tab === 'info' && (
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {appInfo ? (
                <>
                  <InfoSection title="Versions">
                    <InfoRow label="App" value={`v${appInfo.appVersion}`} accent />
                    <InfoRow label="Electron" value={appInfo.electronVersion} />
                    <InfoRow label="Node" value={appInfo.nodeVersion} />
                    <InfoRow label="Chrome" value={appInfo.chromeVersion} />
                    <InfoRow label="Platform" value={appInfo.platform} />
                  </InfoSection>
                  <InfoSection title="Database">
                    <InfoRow label="Path" value={appInfo.dbPath} mono small />
                    <InfoRow label="Size" value={`${appInfo.dbSizeKb.toFixed(1)} KB`} />
                    <InfoRow label="Uptime" value={`${Math.floor(appInfo.uptimeSeconds / 60)}m ${Math.floor(appInfo.uptimeSeconds % 60)}s`} />
                  </InfoSection>
                  <InfoSection title="Renderer">
                    <InfoRow label="URL" value={window.location.href} mono small />
                    <InfoRow label="User Agent" value={navigator.userAgent.split(' ').slice(-3).join(' ')} small />
                  </InfoSection>
                </>
              ) : (
                <p className="text-[11px] text-text-muted">Loading app info...</p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-3 py-2 border-t border-border flex-shrink-0 flex items-center justify-between gap-2"
          style={{ background: '#111418' }}>
          <span className="text-[9px] text-text-muted flex-shrink-0">
            {entries.length} shown · {getTotalCount()} total
          </span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleCopyLog}
              className="flex items-center gap-1 text-[10px] px-2 py-1 rounded border border-border text-text-muted hover:border-accent hover:text-accent transition-colors"
            >
              <Copy size={10} />
              {copyLabel}
            </button>
            <button
              onClick={handleExportLog}
              className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded border transition-colors ${
                saveLabel === 'Saved!' ? 'border-success text-success' :
                saveLabel === 'Error' ? 'border-danger text-danger' :
                'border-border text-text-muted hover:border-accent hover:text-accent'
              }`}
            >
              <Download size={10} />
              {saveLabel}
            </button>
            <button
              onClick={() => { clearEntries(); setEntries([]) }}
              className="flex items-center gap-1 text-[10px] px-2 py-1 rounded border border-border text-text-muted hover:border-danger hover:text-danger transition-colors"
            >
              <Trash2 size={10} />
              Clear
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function InfoSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[9px] text-accent uppercase tracking-widest font-semibold mb-2">{title}</p>
      <div className="space-y-1.5 border border-border rounded-lg p-3" style={{ background: '#0D1017' }}>
        {children}
      </div>
    </div>
  )
}

function InfoRow({ label, value, accent, mono, small }: {
  label: string; value: string; accent?: boolean; mono?: boolean; small?: boolean
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-[10px] text-text-muted w-20 flex-shrink-0">{label}</span>
      <span className={`break-all ${small ? 'text-[9px]' : 'text-[11px]'} ${mono ? 'font-mono' : ''} ${accent ? 'text-accent font-semibold' : 'text-text-secondary'}`}>
        {value}
      </span>
    </div>
  )
}
