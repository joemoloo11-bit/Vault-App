export interface ReleaseNote {
  version: string
  date: string
  title: string
  highlights: string[]
}

// Most recent release first
export const CHANGELOG: ReleaseNote[] = [
  {
    version: '1.11.6',
    date: '2026-05-09',
    title: 'Pay Calendar Math Aligned',
    highlights: [
      'Dashboard Pay Calendar "Remaining" now uses the same alternating-pay model as Weekly Move. Previously it deducted ALL weekly allocations from every week\'s pay, which double-counted shared items. Now per pay event: attributed × pay period + shared × 1 week + goals × 1 week.',
      'Single source of truth: computePayEventContribution helper in types now drives both Weekly Move breakdowns and Pay Calendar remaining figures.',
    ],
  },
  {
    version: '1.11.5',
    date: '2026-05-09',
    title: 'Alternating-Pay Model + Per-Pay Frequency',
    highlights: [
      'Weekly Move math rebuilt to match your actual mental model: each pay event covers ONE WEEK of joint/shared expenses (since pays alternate — yours funds this week, your partner\'s funds next week).',
      'Previously the math split shared items by ÷ N payers across the full pay period; now it\'s just × 1 week per pay event. Cleaner and matches your "this week\'s bills" framing.',
      'Person-only items still cover the full pay period (e.g. Alex Gym from Alex\'s pay covers 2 weeks of gym).',
      'New "Per pay" frequency for expenses — for items charged once per pay cycle of a specific person. E.g. Alex Gym $148 "per pay" = $148 from each of Alex\'s pays. Requires Funded by to be set.',
      'All amounts flow through the same single source of truth (computeWeeklyCashflow) so Dashboard, Budget Setup, Tracker, and Weekly Move all stay in sync.',
    ],
  },
  {
    version: '1.11.4',
    date: '2026-05-09',
    title: 'Pay Breakdown Click-Through',
    highlights: [
      'Click any per-pay breakdown row on Weekly Move → opens a full item-by-item modal showing every single expense contributing to that pay event\'s deduction.',
      'Three sections in the modal: person-only expenses (full responsibility), joint expenses (with their share calculation), and goal contributions.',
      'Each line shows the original amount/frequency, weekly equivalent, and the exact dollars charged to this pay event. Sorted by largest contribution first.',
      'No more guessing where the "Transfers Planned" or "Remaining" numbers come from — every dollar is traceable to a named bill.',
    ],
  },
  {
    version: '1.11.3',
    date: '2026-05-09',
    title: 'Save Changes Fix + Weekly Move Math Reworked',
    highlights: [
      'Fixed: editing an expense and clicking "Save Changes" was crashing with "SQLite3 can only bind numbers, strings, bigints, buffers, and null" — the is_percentage boolean wasn\'t converted to 0/1 before the SQL UPDATE. Now converts properly.',
      'Weekly Move "Remaining" math rebuilt — now accounts for ALL expenses (transfers, accumulating envelopes, percentage allocations) plus goal contributions, not just the transfer routes.',
      'Per-pay attribution now flows through: Alex-only items only deduct from Alex\'s pay, James-only items only deduct from James\'s pay, shared items split evenly across all income sources.',
      'New per-pay breakdown shown inline on the Weekly Move page — for each person\'s pay event, you see the math step-by-step: Arriving − their attributed expenses × period − their share of joint × period ÷ payers − their share of goals = Remaining from this pay.',
      'When both pays arrive in the same week, a combined "Total remaining this week" line summarises.',
    ],
  },
  {
    version: '1.11.2',
    date: '2026-05-09',
    title: 'Crash Diagnostic — ErrorBoundary',
    highlights: [
      'Added a top-level ErrorBoundary. If any page crashes, instead of a blank screen you\'ll now see the error name, message, and stack trace — screenshot that and we can fix it immediately.',
      'Second-level ErrorBoundary inside the Layout so individual page crashes don\'t take down the whole shell (sidebar/title bar still render).',
      'No feature changes — this release exists purely to expose what\'s been causing the blank-screen issue on v1.11.x.',
    ],
  },
  {
    version: '1.11.1',
    date: '2026-05-09',
    title: 'Log Balances Dialog Fix',
    highlights: [
      'Log Balances dialog now scrolls properly — Save/Cancel buttons stay pinned to the bottom and are always reachable, no matter how many accounts you have.',
      'Accounts now display in a 2-column grid (single-column on narrow screens). Cuts the modal height in half.',
      'New footer counter: "X of Y filled" tells you at a glance how many accounts have balance entries before you hit Save.',
      'All dialogs are now viewport-bounded (max-height 90vh) — no more off-screen content for any modal.',
    ],
  },
  {
    version: '1.11.0',
    date: '2026-05-09',
    title: 'Percentage Allocations + Cashflow Clarity',
    highlights: [
      'New "% of pay" expense type. In the Expense form, toggle "Fixed amount" vs "% of pay" to set up a percentage-based allocation. Choose your basis: free cashflow (what\'s left after fixed bills + goals), combined weekly income, or a specific person\'s pay.',
      'Example: "5% of Alex\'s pay → Dog medical fund" — the app calculates the dollar amount automatically based on Alex\'s current pay rate.',
      'Single source of truth for cashflow math (computeWeeklyCashflow helper). Both Dashboard and Budget Setup now use the same numbers — no more inconsistencies. % expenses are calculated dynamically and roll up into the same totals.',
      'Free Cashflow card now shows the math explicitly: "$3,531 − $2,946 − $0 goals". No more guessing what the number means.',
      '"Weekly Expenses" renamed to "Weekly Allocations" — shows what\'s actually being put aside per week (allocation amounts + buffers + % expenses), with raw bill cost shown as a sub-note.',
      'Pay Calendar (8-week forecast) now shows per-week REMAINING cashflow under each week\'s pay. Green = positive, red = shortfall. Makes it obvious which upcoming weeks are tight.',
      'Expense cards display a teal "5% of Alex\'s pay" chip for percentage-based expenses instead of frequency/amount.',
    ],
  },
  {
    version: '1.10.4',
    date: '2026-05-09',
    title: 'Free Cashflow Alignment + Per-Week Pay Adjustments',
    highlights: [
      'Free Cashflow now matches between Dashboard and Budget Setup. Both use the same formula: income − weekly allocations (incl. buffers) − active goal contributions. Goal contributions are now subtracted on Budget Setup too (was missing before).',
      'Weekly Move: per-person pay amount is now editable for the current week. Pencil icon next to a name → enter the actual amount → save. Useful for shift workers with variable income. Adjustment is per-week-only; base amount in Budget Setup never changes.',
      'Overridden pays show a teal "adjusted from $X" chip + a reset arrow to revert to the base amount.',
      'New "Remaining" callout under the pay banner: shows Arriving / Transfers Planned / Remaining for the week, so you can see at a glance how much spending money is left after envelope transfers.',
    ],
  },
  {
    version: '1.10.3',
    date: '2026-05-09',
    title: 'Single-Person Funded Bills',
    highlights: [
      'Each expense now has a "Funded by" option in Budget Setup. Default is "Shared" — split between both pays.',
      'Pick "Alex only" or "James only" to attribute a bill to a single income source (e.g. Alex\'s gym membership comes out of Alex\'s pay only).',
      'Expense cards show a teal "Alex only" / "James only" chip when attributed, so you can see at a glance which bills belong to who.',
      'This sets up the foundation for v1.11.0 Pay Plan — the auto-split calculator will use these attributions to compute each person\'s envelope amounts correctly.',
    ],
  },
  {
    version: '1.10.2',
    date: '2026-05-09',
    title: 'Budget Setup Expenses Redesign',
    highlights: [
      'Search bar at the top — find any expense by name, category, or account in real time.',
      'Categories are now collapsible cards with a count and weekly $ total in the header. Largest category is expanded by default; others collapsed to cut the page short.',
      'Two-column compact grid inside expanded categories — halves the vertical scroll.',
      'Per-expense card shows weekly amount large on the right, full breakdown below (allocation, buffer, due day, routing chips).',
      'Edit/Delete buttons fade in on hover, less visual noise.',
    ],
  },
  {
    version: '1.10.1',
    date: '2026-05-09',
    title: 'Tracker UX Fix',
    highlights: [
      'Bills now appear under the account they actually DEBIT from (not the envelope they pass through). Pure transit envelopes — Bill Money, Mortgage Money etc — no longer show every bill with confusing "0d ahead" red flags. Coverage shows correctly under Bankwest Bills, Bankwest Mortgage, etc.',
      'Bills section is collapsed by default — click "X bills assigned" with the chevron to expand. No more endless scrolling past 19 bill rows per account.',
    ],
  },
  {
    version: '1.10.0',
    date: '2026-05-09',
    title: 'Weekly Move + Coverage Detail',
    highlights: [
      '"Weekly" page rebuilt as Weekly Move — organised around the actual transfer (envelope → debit account), not a flat list of accounts.',
      'Each transfer card shows: source envelope, destination, suggested amount, what bills are covered, current destination balance, and how much you\'ve already moved this week.',
      'Capture the ACTUAL dollar amount you moved (not a checkbox). Multiple transfers per route per week supported. Delete individual entries if you mistype.',
      'Pay-week banner now shows the real cash arriving this week (e.g. "James\'s pay arrives this week — $3,463"), not the weekly average.',
      '"Accumulating" section: envelopes that don\'t transfer to Bank 2 (groceries, dog medical, etc) — shown separately so they don\'t clutter the transfer ritual.',
      'Tracker has a $ / Weeks / Months toggle in the header — switch how coverage is displayed across all bills.',
      'Each bill now shows a "covered until DD MMM YYYY" date below the coverage badge so you can see exactly when each one runs out.',
    ],
  },
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
