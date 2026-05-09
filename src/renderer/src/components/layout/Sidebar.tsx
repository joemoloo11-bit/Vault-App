import { NavLink, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import {
  LayoutDashboard,
  Settings2,
  CalendarDays,
  Wallet,
  Target,
  BarChart2,
  Download,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  ArrowUpCircle,
  Sparkles,
} from 'lucide-react'
import { CHANGELOG } from '@renderer/lib/changelog'
import { cn } from '@renderer/lib/utils'
import { Dialog, DialogContent, DialogClose } from '@renderer/components/ui/dialog'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'

type CheckResult =
  | { hasUpdate: false; currentVersion: string }
  | { hasUpdate: true; latestVersion: string; currentVersion: string; assetUrl: string; assetName: string }
  | { error: string }

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', description: 'Overview & health' },
  { to: '/setup', icon: Settings2, label: 'Budget Setup', description: 'Income & expenses' },
  { to: '/weekly', icon: CalendarDays, label: 'Weekly', description: 'Move money' },
  { to: '/tracker', icon: Wallet, label: 'Tracker', description: 'Balances & coverage' },
  { to: '/goals', icon: Target, label: 'Goals', description: 'Save for things' },
  { to: '/charts', icon: BarChart2, label: 'Charts', description: 'Trends over time' },
  { to: '/export', icon: Download, label: 'Export', description: 'Excel & PDF' },
]

export default function Sidebar() {
  const location = useLocation()
  const [updateOpen, setUpdateOpen] = useState(false)
  const [changelogOpen, setChangelogOpen] = useState(false)
  const currentVersion = CHANGELOG[0]?.version ?? '1.0.0'
  const [hasToken, setHasToken] = useState<boolean | null>(null)
  const [tokenInput, setTokenInput] = useState('')
  const [savingToken, setSavingToken] = useState(false)
  const [checking, setChecking] = useState(false)
  const [installing, setInstalling] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [result, setResult] = useState<CheckResult | null>(null)

  useEffect(() => {
    if (updateOpen) {
      ;(window.api as any).updates.hasToken().then(setHasToken)
    }
  }, [updateOpen])

  async function handleSaveToken() {
    setSavingToken(true)
    try {
      const res = await (window.api as any).updates.setToken(tokenInput.trim())
      if (res?.success) {
        setHasToken(true)
        setTokenInput('')
      } else {
        setResult({ error: res?.error ?? 'Failed to save token.' })
      }
    } finally {
      setSavingToken(false)
    }
  }

  async function handleClearToken() {
    await (window.api as any).updates.setToken('')
    setHasToken(false)
    setResult(null)
  }

  async function handleCheck() {
    setChecking(true)
    setResult(null)
    try {
      const res = await (window.api as any).updates.check()
      setResult(res)
    } catch {
      setResult({ error: 'Failed to communicate with the app.' })
    } finally {
      setChecking(false)
    }
  }

  async function handleInstall(assetUrl: string, assetName: string) {
    setDownloading(true)
    setInstalling(true)
    try {
      const res = await (window.api as any).updates.install(assetUrl, assetName)
      if (res && res.success === false) {
        setResult({ error: res.error ?? 'Failed to launch installer.' })
        setInstalling(false)
        setDownloading(false)
      }
    } catch (err: any) {
      setResult({ error: err?.message ?? 'Failed to launch installer.' })
      setInstalling(false)
      setDownloading(false)
    }
  }

  return (
    <aside className="w-[220px] flex-shrink-0 flex flex-col bg-surface border-r border-border h-full">
      {/* Logo area */}
      <div className="px-5 py-6 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#0D1117] border border-accent/25 flex items-center justify-center flex-shrink-0">
            <span className="text-base font-black bg-gradient-to-b from-teal-300 to-teal-600 bg-clip-text text-transparent leading-none">V</span>
          </div>
          <div>
            <p className="text-sm font-semibold text-text-primary tracking-wide">Vault</p>
            <p className="text-[10px] text-text-muted">Household Budget</p>
          </div>
        </div>
      </div>

      <div className="h-px bg-border mx-4 flex-shrink-0" />

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map(({ to, icon: Icon, label, description }) => {
          const isActive = location.pathname === to
          return (
            <NavLink
              key={to}
              to={to}
              className={cn(
                'group flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 relative',
                isActive
                  ? 'bg-accent-muted text-accent'
                  : 'text-text-secondary hover:text-text-primary hover:bg-surface-hover'
              )}
            >
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-accent rounded-r-full" />
              )}
              <Icon
                size={17}
                className={cn(
                  'flex-shrink-0 transition-colors',
                  isActive ? 'text-accent' : 'text-text-muted group-hover:text-text-secondary'
                )}
              />
              <div className="min-w-0">
                <p className={cn('text-sm font-medium leading-none', isActive ? 'text-accent' : '')}>
                  {label}
                </p>
                <p className="text-[10px] text-text-muted mt-0.5 leading-none">{description}</p>
              </div>
            </NavLink>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 flex-shrink-0 border-t border-border space-y-2">
        <button
          onClick={() => setChangelogOpen(true)}
          className="w-full flex items-center justify-center gap-1.5 text-[10px] text-text-muted hover:text-accent transition-colors group"
        >
          <Sparkles size={10} className="group-hover:scale-125 transition-transform" />
          v{currentVersion} · What's new
        </button>
        <button
          onClick={() => { setUpdateOpen(true); setResult(null) }}
          className="w-full flex items-center justify-center gap-1.5 text-[10px] text-text-muted hover:text-accent transition-colors group"
        >
          <RefreshCw size={10} className="group-hover:rotate-180 transition-transform duration-500" />
          Check for updates
        </button>
      </div>

      <Dialog open={updateOpen} onOpenChange={setUpdateOpen}>
        <DialogContent title="Check for Updates" description="Vault checks GitHub for new releases. Set your access token below (one-time).">
          <div className="space-y-4">
            {hasToken === false && (
              <div className="rounded-lg border border-border bg-surface-2/40 p-3 space-y-3">
                <div>
                  <p className="text-sm font-medium text-text-primary">Connect to GitHub</p>
                  <p className="text-[11px] text-text-muted mt-1 leading-relaxed">
                    Generate a fine-grained Personal Access Token at <span className="text-accent">github.com/settings/tokens?type=beta</span> with read access to the <span className="text-accent">Vault-App</span> repo (Contents: read). Paste it below — stored encrypted on this machine only.
                  </p>
                </div>
                <Input
                  label="GitHub Personal Access Token"
                  type="password"
                  value={tokenInput}
                  onChange={e => setTokenInput(e.target.value)}
                  placeholder="github_pat_..."
                />
                <Button onClick={handleSaveToken} disabled={savingToken || !tokenInput.trim()} className="w-full">
                  {savingToken ? 'Saving…' : 'Save token'}
                </Button>
              </div>
            )}

            {hasToken === true && (
              <>
                <div className="flex items-center justify-between rounded-lg border border-success/30 bg-success/10 p-2.5">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-success" />
                    <p className="text-xs text-text-primary">GitHub token connected</p>
                  </div>
                  <button onClick={handleClearToken} className="text-[10px] text-text-muted hover:text-danger underline">
                    Clear
                  </button>
                </div>

                <Button onClick={handleCheck} disabled={checking} className="w-full">
                  {checking ? 'Checking GitHub…' : 'Check for Updates'}
                </Button>
              </>
            )}

            {result && (
              <div className={`rounded-lg p-4 border ${
                'error' in result ? 'bg-danger/10 border-danger/30' :
                result.hasUpdate ? 'bg-accent/10 border-accent/30' :
                'bg-success/10 border-success/30'
              }`}>
                {'error' in result ? (
                  <div className="flex items-start gap-2">
                    <AlertCircle size={16} className="text-danger flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-danger">{result.error}</p>
                  </div>
                ) : result.hasUpdate ? (
                  <div className="space-y-3">
                    <div className="flex items-start gap-2">
                      <ArrowUpCircle size={16} className="text-accent flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold text-text-primary">Update available</p>
                        <p className="text-xs text-text-secondary mt-0.5">
                          v{result.currentVersion} → <span className="text-accent font-semibold">v{result.latestVersion}</span>
                        </p>
                      </div>
                    </div>
                    <Button
                      onClick={() => handleInstall(result.assetUrl, result.assetName)}
                      disabled={installing}
                      className="w-full"
                    >
                      {downloading && installing ? 'Downloading & launching…' : installing ? 'Launching installer…' : `Install v${result.latestVersion}`}
                    </Button>
                    <p className="text-[10px] text-text-muted text-center">Vault will close automatically when the installer launches.</p>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-success flex-shrink-0" />
                    <p className="text-sm text-success font-medium">You're on the latest version (v{result.currentVersion})</p>
                  </div>
                )}
              </div>
            )}

            <DialogClose asChild>
              <Button variant="outline" className="w-full">Close</Button>
            </DialogClose>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={changelogOpen} onOpenChange={setChangelogOpen}>
        <DialogContent title="What's New in Vault" description="Release notes and patch history for every version." className="max-w-2xl">
          <div className="space-y-5 max-h-[60vh] overflow-y-auto pr-2">
            {CHANGELOG.map((release, idx) => (
              <div key={release.version} className={idx === 0 ? '' : 'pt-5 border-t border-border'}>
                <div className="flex items-baseline justify-between mb-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-base font-semibold text-text-primary">v{release.version}</span>
                    {idx === 0 && (
                      <span className="text-[10px] uppercase tracking-wider bg-accent/15 text-accent px-1.5 py-0.5 rounded font-medium">Current</span>
                    )}
                  </div>
                  <span className="text-[11px] text-text-muted">{release.date}</span>
                </div>
                <p className="text-sm text-accent mb-2">{release.title}</p>
                <ul className="space-y-1.5">
                  {release.highlights.map((h, i) => (
                    <li key={i} className="text-xs text-text-secondary flex gap-2">
                      <span className="text-accent flex-shrink-0">•</span>
                      <span>{h}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="pt-4">
            <DialogClose asChild>
              <Button variant="outline" className="w-full">Close</Button>
            </DialogClose>
          </div>
        </DialogContent>
      </Dialog>
    </aside>
  )
}
