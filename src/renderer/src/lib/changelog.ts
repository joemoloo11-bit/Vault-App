export interface ReleaseNote {
  version: string
  date: string
  title: string
  highlights: string[]
}

// Most recent release first
export const CHANGELOG: ReleaseNote[] = [
  {
    version: '1.9.1',
    date: '2026-05-09',
    title: 'Tracker Visual Cleanup',
    highlights: [
      'Envelope accounts no longer show "Shortfall" when balance is $0. Envelopes drain to $0 between transfers — that\'s healthy, not an alarm. They now show a neutral "Envelope" badge instead.',
      'Sparkline only shows when there are 4+ balance logs (was 2+). Two-point lines looked like glitches.',
      'Note: proper envelope state tracking (filled / moved / waiting) requires recording transfer events, which lands in v1.10.0 Weekly Move rebuild.',
    ],
  },
  {
    version: '1.9.0',
    date: '2026-05-09',
    title: 'Account Depth — Balance History & Projection',
    highlights: [
      'Tracker account cards now show an inline balance sparkline — last 12 logs as a small line graph in the account\'s colour. Click it (or "View balance history") to open the full view.',
      'New Balance History dialog: full-size line chart with all your logged balances + a dashed projection line for the next 4 weeks (calculated from weekly target minus assigned bills).',
      'Three-stat summary on the history dialog: latest balance, projected balance in 4 weeks, and net per week.',
      'List of every balance log with delete button — fix typos or remove bad entries; chart and projection update automatically.',
    ],
  },
  {
    version: '1.8.1',
    date: '2026-05-09',
    title: 'Allocation $0 Fix',
    highlights: [
      'Fixed: Weekly Allocation showed every account at $0 even when expenses were assigned. Cause was missed in v1.7.0 — the filter still used the old account_id field instead of the new save_account_id.',
      'Same fix applied to Dashboard\'s account health checks and Cushion Score, which were also under-counting bills per account.',
      'Catalogued as BUG-012 to prevent the same miss next time we add a new schema column.',
    ],
  },
  {
    version: '1.8.0',
    date: '2026-05-09',
    title: 'Forward Planning',
    highlights: [
      'New "This Week" panel on the Dashboard — prioritised action list pulling together pay arrivals, allocation status, bills due in the next 7 days, and ready-to-move sweeps. Click items to jump to the relevant page.',
      'New 8-week pay calendar — visual strip showing whose pay lands in each upcoming week. Lean weeks (pay arriving but less than your average weekly expenses) are flagged in amber.',
      'Both panels only appear once you\'ve set payday reference dates on your income sources.',
    ],
  },
  {
    version: '1.7.2',
    date: '2026-05-09',
    title: 'Update Detection Fix',
    highlights: [
      'Fixed: app failed to detect new GitHub releases because GitHub renames the .exe filename during upload (spaces become dots). The asset matcher now accepts both "Vault Setup X.X.X.exe" and "Vault.Setup.X.X.X.exe" variants.',
      'Verified end-to-end: GitHub Actions builds the installer, attaches it to the release, app finds and installs it.',
    ],
  },
  {
    version: '1.7.1',
    date: '2026-05-09',
    title: 'Pipeline Fix',
    highlights: [
      'Fixed the GitHub Actions release pipeline — electron-builder was trying to auto-publish on tagged commits and failing without a GH_TOKEN. Workflow now passes --publish never so softprops/action-gh-release handles the upload cleanly.',
      'No app changes — this release exists to verify the automated build/publish flow works end-to-end.',
    ],
  },
  {
    version: '1.7.0',
    date: '2026-05-09',
    title: 'Money Flow in Action',
    highlights: [
      'Tracker now shows each account\'s type (envelope / offset / savings / mortgage) right next to the name',
      'Sweep readiness on the Tracker — when an account exceeds buffer + sweep amount, a teal pill appears showing the move ready to make ("Sweep $200 → Savings")',
      'Bill rows on Tracker show debit routing when the bill exits a different account than where it accumulates ("→ Bank 2 Bills")',
      'New Sweep Alerts panel on the Dashboard — lists every account currently above its buffer threshold with the exact amount to move and where',
      'Tracker now groups bills by save_account_id (where money lands), with fallback to legacy account_id for older data',
    ],
  },
  {
    version: '1.6.0',
    date: '2026-05-09',
    title: 'GitHub-Powered Updates',
    highlights: [
      'Updates now pull from GitHub releases instead of a local folder. Whenever a new version ships, "Check for updates" finds it from anywhere — no more pointing at a release folder.',
      'One-time GitHub token setup: paste a fine-grained Personal Access Token in the update dialog (read-only access to the Vault-App repo). Stored encrypted on your machine only.',
      'Automated release pipeline: pushing a version tag to GitHub now triggers a workflow that builds the Windows installer and publishes it as a GitHub release automatically. No more manual uploads.',
      'Removed the local folder path input — token-based check replaces it entirely.',
    ],
  },
  {
    version: '1.5.0',
    date: '2026-05-09',
    title: 'Money Flow Architecture',
    highlights: [
      'Each expense now has TWO account fields: "Saves to" (envelope where money accumulates) and "Debits from" (where the bill actually exits). Leave Debits from blank if it\'s the same account.',
      'Account types — envelope, offset, savings, mortgage. Set on each account so Vault knows what role it plays in your money flow.',
      'Sweep rules on accounts — set a buffer target ("always keep $1,000") and a sweep amount ("move $200 when over $1,200"). Vault flags the move; you do the transfer manually.',
      'Existing data is preserved: any expense that had an account assigned automatically becomes its "Saves to" account. Nothing breaks.',
      'Display only for now — Tracker, Weekly Allocation, and Dashboard still show single-account view. Routing-aware analysis comes in v1.5.1.',
    ],
  },
  {
    version: '1.4.4',
    date: '2026-05-09',
    title: 'Tracker Crash Fix + Set Initial Balances',
    highlights: [
      'Fixed: Tracker page no longer goes black on click — was a missing Select import in the Shortfall Simulator that crashed the entire page (BUG-010)',
      'Set initial balance when creating an account in Budget Setup → Accounts. Also works when editing — logs a new balance entry. No need to jump to Tracker just to set a starting balance',
    ],
  },
  {
    version: '1.4.3',
    date: '2026-05-09',
    title: 'Logo Refinement',
    highlights: [
      'Refined the V mark — bold rounded letterform (matching the original) on the new dark surface with teal gradient. Sharp without being shouty.',
      'Updated the in-app logos (sidebar header, title bar, welcome screen) to match the new app icon — no more old gradient logos hanging around inside a freshly-skinned app',
    ],
  },
  {
    version: '1.4.2',
    date: '2026-05-09',
    title: 'Icon Redesign & Updater Fix',
    highlights: [
      'Redesigned app icon — dark surface with a sharp geometric V in accent teal, matching the app\'s premium aesthetic instead of fighting it',
      'Fixed the in-app updater: "Install" now actually launches the new installer reliably (was using shell.openPath which failed silently; now uses a detached child process)',
      'Install errors are now surfaced in the dialog instead of leaving you stuck on "Launching installer…"',
    ],
  },
  {
    version: '1.4.1',
    date: '2026-05-09',
    title: 'App Icon & Patch Notes',
    highlights: [
      'New custom Vault icon (V on a teal-to-indigo gradient) — no more default Electron icon in the taskbar',
      'Click the version number in the sidebar to see this changelog',
      'Income cards now show your real pay (e.g. $3,600 fortnightly) with the weekly equivalent as a subtle hint, not the other way around',
    ],
  },
  {
    version: '1.4.0',
    date: '2026-05-09',
    title: 'Payday Awareness',
    highlights: [
      'Set a reference payday date on each income source to unlock new features',
      'Dashboard shows a payday countdown for each person ("3 days · Thu 14 May")',
      'Weekly Allocation highlights pay weeks with a banner showing whose pay is arriving',
      'Per-bill weekly buffer field — save extra $/wk on top of allocations to build cushions faster',
      'Annual income frequency option (for once-a-year pays like bonuses)',
    ],
  },
  {
    version: '1.3.0',
    date: '2026-05-08',
    title: 'Polish & Quality',
    highlights: [
      'Quick balance log — update all account balances in one dialog instead of one at a time',
      'Toast notifications for save, update, and delete actions',
      'Confirmation dialogs before destructive actions (delete account, expense, goal)',
      'Tabular numbers across the app for cleaner column alignment',
      'Coloured top borders on dashboard metric cards',
      'Account cards now use a coloured left edge instead of a small pill',
      'Sidebar nav: "Accounts" renamed to "Tracker"',
      'Bug fix: Cushion Score now uses real per-account expense totals (was always near-zero)',
      'Bug fix: Dashboard health threshold aligned with Tracker (months-based)',
      'Bug fix: Removed duplicate toWeeklyAmount in AccountTracker',
    ],
  },
  {
    version: '1.2.1',
    date: '2026-05-07',
    title: 'Dialog Animation Fix',
    highlights: [
      'Fixed dialog snap/lag — dialogs now fade in smoothly from centre instead of bouncing from the corner',
    ],
  },
  {
    version: '1.2.0',
    date: '2026-05-07',
    title: 'In-App Update Checker',
    highlights: [
      'Sidebar "Check for updates" button — point Vault at your release folder, it finds and installs newer versions automatically',
    ],
  },
  {
    version: '1.1.0',
    date: '2026-05-06',
    title: 'Months Ahead Tracking',
    highlights: [
      'Account Tracker shows per-bill "months ahead" coverage based on actual allocations',
      'Established versioning policy — minor bump for features, patch for fixes',
    ],
  },
  {
    version: '1.0.0',
    date: '2026-05-05',
    title: 'First Release',
    highlights: [
      'Dashboard with Cushion Score, account health, bills due soon, active goals',
      'Budget Setup: income, accounts, expenses with allocation amounts',
      'Weekly Allocation page for moving money into purpose accounts',
      'Account Tracker with balance logs',
      'Goals with weekly contributions and progress snapshots',
      'Charts page',
      'Excel and PDF export',
      'Local SQLite database — your data never leaves the machine',
    ],
  },
]
