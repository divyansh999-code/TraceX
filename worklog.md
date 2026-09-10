# TraceX — Social Intelligence & Information Flow Analytics (SIH 2026 · PS 26152)

High-fidelity interactive frontend prototype. Dark "Signal Intelligence Console"
aesthetic. NO real backend — all data from the deterministic mock layer.

## Project status

- Next.js 16 App Router, TypeScript, Tailwind CSS 4, shadcn/ui, recharts,
  lucide-react, framer-motion, d3-force (custom SVG force graph).
- Dev server: `bun run dev` on port 3000 (already running, logs in dev.log).
- Single user route: `/` (src/app/page.tsx → TraceXApp).
- Theme: next-themes, class strategy, DARK default. Fonts: Newsreader
  (display, `font-display`), IBM Plex Sans (body), JetBrains Mono (data).

## Foundation (Task 2 — COMPLETE)

### Files
- `src/app/globals.css` — design tokens. Colors via CSS vars: `--primary`
  (#E8823A amber), signal-green #3EAF7C, signal-red #D9564F, signal-amber
  #D9A441, signal-cyan #5FA1C4, signal-violet #A78BFA. Surfaces: bg #0A0E14,
  card #12161F, elevated/popover #171C27, border #232838. Tailwind classes:
  `text-signal-green`, `bg-signal-red/10`, `text-primary`, etc. Utilities:
  `.taxonomy` (uppercase 11px label), `.tnum`, `.edge-flow`, `.pulse-dot`.
- `src/lib/mock/*` — deterministic data layer (seeded RNG):
  - `index.ts` public API: `getVolumeSeries(filters)`, `getKpis(filters)`,
    `getTopicSeries(topic, filters)`, `effectiveTopics(filters)`,
    `getEmotions(filters)`, `getTopicSentimentTable(filters)`,
    `getSentimentShifts(filters)`, `getClaims(filters)`, `getNetwork(filters)`,
    `getInfluencers(filters, n)`, `getPropagation(topicId)`, `getBots(filters)`,
    `getAlerts()`, `getSamplePosts(topicId)`, `getTopicById(id)`,
    `DEMOGRAPHICS`, `LANGUAGES`, `TOPICS`, `NOW`.
  - `types.ts` — ALL shared types (Filters, Topic, VolumePoint, Kpis, Claim,
    IntelligenceAlert, NetNode/NetEdge, BotAccount/BotCluster, …).
- `src/lib/app-state.tsx` — `AppProvider` + `useApp()`:
  `filters` (+setPlatform/setRange/setCustomDays/toggleLanguage/setQuery),
  `screen`, `go(screen, {topicId})`, `selectedTopicId`, `refreshKey`.
- `src/lib/fmt.ts` — fmtCompact, fmtFull, fmtNet, fmtSigned, relTime,
  fmtClockIST, fmtDateIST, riskTone, sentimentTone.

### Shared components (`src/components/tracex/common/`)
- `primitives.tsx`: `Panel` (title/sub/icon/right/dense/scroll), `Taxonomy`,
  `MonoTag`, `Badge tone={green|amber|red|cyan|orange|violet|slate|neutral}`,
  `SeverityDot`, `Delta` (value,invert), `ScoreBar` (0–1 risk bar),
  `Legend`, `LiveDot`, `Chip`, `MetricRow`.
- `KpiCard.tsx`, `Sparkline.tsx` (SVG), `TraceXLogo.tsx` (`TraceXMark`),
  `ScreenHeader.tsx` (kicker/title/description/right),
  `ChartBits.tsx` (`CHART` palette const, `useChartTheme()`, `ChartTooltip`,
  `GRID`, `AXIS`), `Skeletons.tsx` (`useRefresh(dep)` → 280ms skeleton flash
  on filter change; `useNow()`; `KpiRowSkeleton`, `PanelSkeleton`,
  `ChartSkeleton`, `TableSkeleton`, `ScreenSkeleton`).
- Shell: `shell/Sidebar.tsx`, `shell/TopBar.tsx` (platform segmented, range
  24h/7d/30d/custom, search, language chips, theme toggle, IST clock),
  `shell/StatusBar.tsx` (footer, mt-auto), `shell/BootSplash.tsx`.
- `screens/OverviewScreen.tsx` — COMPLETE (KPI row, stacked
  sentiment-composition area chart + baseline + spike markers, live alert
  feed w/ auto-prepend, trending narratives table, network preview,
  module pipeline strip).
- `TraceXApp.tsx` — shell + screen router (framer-motion transitions).
  Mobile: horizontal module switcher under TopBar (md:hidden).

### Conventions (MANDATORY for all screens)
1. `"use client"` at top. Export `export function <Name>Screen()`.
2. `const { filters, go } = useApp();` + `const ready = useRefresh("<id>");`
   — render `ScreenSkeleton`-style composition while `!ready`.
3. Wrap content in `<div className="space-y-4 animate-in fade-in duration-300">`
   with `ScreenHeader kicker="MODULE 0X // NAME" title=… description=…`.
4. Use `Panel`, `Badge`, `ScoreBar`, `Delta`, `Legend`, `Sparkline`,
   `KpiCard` — do NOT restyle from scratch. Charts: recharts +
   `CHART` colors + `useChartTheme()` for grid/ticks + `ChartTooltip`.
5. Numbers: `fmtCompact`/`fmtNet` etc. from `@/lib/fmt`; mono + `tnum`.
6. All data via `@/lib/mock` getters with `useMemo(() => get…(filters), [filters])`.
7. shadcn/ui from `@/components/ui/*` for buttons/tabs/dialog/sheet/table/etc.
8. Recharts XAxis for time series: `dataKey="t" type="number"
   domain={["dataMin","dataMax"]}` + tickFormatter via point.label
   (see OverviewScreen for copy-paste pattern).
9. NO blue/indigo accents. NO rounded-full pills (4–6px radius only).
   NO gradients on UI chrome (chart area fills at low alpha are OK).
10. Layout: `grid grid-cols-1 xl:grid-cols-12 gap-4` rows of Panels.

## Task queue
- 2: foundation (DONE)
- 3-a: TrendsScreen + SentimentScreen (agent, in progress)
- 3-b: DemographicsScreen + BotScreen (agent, in progress)
- 3-c: NetworkScreen + ForceGraph (agent, in progress)
- 3-d: MisinfoScreen + AlertsScreen (+ ReportModal, rule builder) (agent, in progress)
- 4: wiring, lint, agent-browser verification, fixes (main)
- 5: final QA + cron job (main)

---
Task ID: 2
Agent: main
Task: TraceX foundation — theme, mock data layer, app state, shared components, shell, Overview screen

Work Log:
- Installed d3-force + @types/d3-force.
- Wrote globals.css Signal Intelligence theme (dark default, light secondary).
- layout.tsx: Newsreader/IBM Plex Sans/JetBrains Mono, next-themes dark default, sonner toaster.
- Built deterministic mock layer (rng, content, series, network, index) — 16 topics, claims with spread timelines, alerts pool, 90-node network w/ communities & propagation, bot clusters/scatter.
- app-state.tsx context (filters + nav + refreshKey).
- Shared components: primitives, KpiCard, Sparkline, TraceXLogo, ChartBits, Skeletons, ScreenHeader.
- Shell: Sidebar, TopBar (filters), StatusBar, BootSplash; TraceXApp router w/ framer-motion.
- OverviewScreen: KPIs, sentiment-composition area chart, live alert feed, trending table, network preview, module pipeline strip.
- Stubs for screens 02–08 (agents will overwrite).
- Lint clean; GET / 200.

Stage Summary:
- Foundation + Overview complete and verified compiling.
- Agents: overwrite stub files ONLY for your assigned screens; follow Conventions above; do not touch shared files except additive changes if strictly necessary (report them in your worklog entry).

---
Task ID: 3-a
Agent: frontend agent (Trends + Sentiment)
Task: Implemented Screen 02 Trend Explorer + Screen 03 Sentiment & Emotion

Work Log:
- Read worklog, OverviewScreen reference, primitives/ChartBits/Skeletons/KpiCard/ScreenHeader/Sparkline, app-state, mock layer (index/series/content/types), fmt helpers.
- TrendsScreen.tsx (full rewrite): topic chip selector (10 chips + "+N more" Select, sorted by change24h, active = selectedTopicId ?? top-changer); ComposedChart "Narrative velocity" (orange gradient area total + dashed cyan baseline Line + amber ReferenceDot spike markers + ChartTooltip w/ spike badge) with stats strip (peak / avg-vs-baseline / spikes flagged); Emerging narratives panel (Flame, Delta, gloss, risk ScoreBar, Sparkline, "spike −Nd" note, click → drill-down); Tracked keywords table (search Input, velocity icons Flame/TrendingUp/Minus/TrendingDown, category Badge, filter-aware volume, Delta, X/TG mini stacked bar, risk ScoreBar, row click → drill-down); right-side drill-down Sheet (420px, MetricRow telemetry incl. LANGUAGES native labels, sample posts w/ platform + bot-flagged badges + engagement + bot-P ScoreBar, platform-split PieChart donut w/ centered fmtCompact total, velocity mini AreaChart, related-narrative chips that hot-swap the sheet); empty state (SearchX + reset filter bank). Sheet opens via local sheetOpen state (useState initializer + selectTopic handler) — no setState-in-effect (lint rule react-hooks/set-state-in-effect).
- SentimentScreen.tsx (full rewrite): 4 KpiCards (net sentiment w/ sentimentTone, dominant emotion from getEmotions max, negative share computed from getVolumeSeries halves w/ pp delta, shift count); stacked AreaChart "Sentiment composition over time" (green/slate/red gradients, stackId s, amber dashed ReferenceLine at getSentimentShifts times, shift badge in tooltip); RadarChart emotion mix (violet, PolarGrid/PolarAngleAxis themed) + per-emotion Delta rows; shift alert callouts (from→to fmtNet colored, ArrowUp/DownRight, windowLabel mono, note, pp Delta); topic comparison panel (side-by-side net cards + table with shadcn Checkbox selection, max-5 with sonner toast, mini pos/neu/neg stacked bars, fmtNet Badges, shift Delta suffix ""); default selection = first 3 by volume, survives filter changes via validity filtering.
- useRefresh("trends"/"sentiment") skeleton gating (PanelSkeleton / KpiRowSkeleton compositions) on every filter change.
- `bun run lint` → 1 error (react-hooks/set-state-in-effect on the sheet-open effect) → refactored to event-handler + lazy-initializer state; re-lint clean.
- agent-browser session t3a: verified Trends (all 4 sections, 16 chips + "+6 more" select, chart axes/stats, 5 emerging rows, 16-row table), drill-down sheet open/related-topic swap/close, keyword search ("farmer" → 1/16), 30D range switch (spikes flagged = 3, day labels); verified Sentiment (4 KPIs, composition chart, radar + emotion rows, 2 shift alerts, comparison strip/table), checkbox deselect (3→2 cards), 5-topic cap toast. No console errors from my code. Screenshots: /tmp/t3a-trends.png, /tmp/t3a-sentiment.png.
- Environment incident (not my code): shared dev server on :3000 died mid-verification (concurrent agents' compile load / resource exhaustion — EADDRINUSE fights, fork/thread failures, one Turbopack ChunkLoadError full-reload). Server was restarted (by another agent/orchestrator); re-verified both screens after recovery with zero console errors.

Stage Summary:
- Files written: src/components/tracex/screens/TrendsScreen.tsx, src/components/tracex/screens/SentimentScreen.tsx (stubs fully replaced; no other files touched).
- Verification: eslint clean (0 errors/warnings); browser checks on both screens incl. drill-down sheet, search, range/filter re-query, compare-limit toast — no console errors attributable to these screens.
- Known shared friction (NOT introduced by me, out of my file scope): `bunx tsc --noEmit` flags the recharts `content={(props) => <ChartTooltip {...props} …/>}` spread in OverviewScreen (reference), MisinfoScreen, AlertsScreen AND my two screens — ChartBits' `TooltipEntry` doesn't accept recharts `Payload<ValueType, NameType>[]` (name can be number). A one-line widen of `name?: string | number` in ChartBits.tsx TooltipEntry would clear this project-wide, but that file is shared and off-limits for 3-a. Dev server serves fine (SWC); lint gate passes.
- API gaps noticed: (1) no true per-topic 24h volume getter — sheet computes it via getTopicSeries with range overridden to "24h"; (2) spike flags only exist for day-bucketed ranges (30d/custom) or 24h hourly — 7d (3h buckets) shows 0 spikes by design of series.ts; (3) getEmotions ignores search query (rng over platform/range/languages only) so the dominant-emotion KPI doesn't respond to search; (4) Sheet/AlertType 'sentiment-shift' events carry no topicId, so shift callouts stay "aggregate feed".

---
Task ID: 3-a (verification & fix pass)
Agent: frontend agent (Trends + Sentiment)
Task: Re-verified Screens 02/03 end-to-end; fixed Radix Select controlled/uncontrolled warning in TrendsScreen

Work Log:
- Re-read worklog + all reference files (OverviewScreen, primitives, ChartBits, Skeletons, KpiCard, ScreenHeader, Sparkline, app-state, mock index/series/types, fmt); confirmed both screen implementations are complete and API-consistent (effectiveTopics `{topic,weight}` shape, SamplePost/SentimentShiftEvent/TopicSentimentRow fields, fmtScore, resetFilters all used correctly).
- `bun run lint` → clean (0 errors/warnings).
- agent-browser session t3a on :3000: Trends — verified topic chips (10 + "+6 more" Select), velocity chart + stats strip, 5 emerging rows with `spike −Nd` notes, 16-row keyword table, drill-down sheet (telemetry incl. native language labels, platform-split donut, velocity mini chart, sample posts w/ BOT-FLAGGED badge + bot-P bars, related-narrative chips). Related-chip hot-swap verified (किसान आंदोलन → monsoon session parliament), sheet close restores default topic. Keyword search "farmer" → 1/16 rows. 30D range re-query → spikes flagged 3.
- Sentiment — verified 4 KPIs, composition chart w/ shift ReferenceLines, emotion radar + delta rows, 2 shift alert callouts (from→to fmtNet), comparison strip; checkbox deselect 3→2, re-select to 5, 6th topic blocked with "Comparison limit reached" toast.
- Found + fixed 1 console warning in MY file: the "+N more" Select in TrendsScreen flipped between controlled/uncontrolled when activeId crossed the top-10/more boundary (value undefined ↔ topic id). Fix: always-controlled value with `"__none__"` sentinel + manually rendered trigger text (replaces SelectValue placeholder); removed unused SelectValue import. Re-verified in browser — warning gone, dropdown selection still opens the sheet, closing restores "+6 more" with no warnings.
- Final state: lint clean; `bunx tsc --noEmit` shows only the pre-existing shared ChartBits `TooltipEntry.name: string` incompatibility (affects reference OverviewScreen identically — off-limits shared file, documented above); browser console clean on both screens. Screenshots: /tmp/t3a-trends.png, /tmp/t3a-sentiment.png. Session closed.

Stage Summary:
- Files changed: src/components/tracex/screens/TrendsScreen.tsx (Select controlled-value fix, ~20 lines). No other files touched.
- Verification: eslint 0/0; agent-browser both screens incl. drill-down sheet, search, range re-query, compare cap toast — zero console errors/warnings after fix.
- API gaps: unchanged from entry above (no per-topic 24h getter; spikes only for day-bucketed ranges; getEmotions ignores query; shift events lack topicId).

---
Task ID: 4
Agent: main (orchestrator)
Task: Wire-up verification, QA fixes, full end-to-end agent-browser validation

Work Log:
- All 8 screens were implemented by the agent batch (3-a/3-b/3-c/3-d) despite tool-call timeouts; verified file completeness (6,200+ lines across 9 screen files + ForceGraph + ReportModal).
- Fixed shared typing: ChartBits TooltipEntry widened (name/value union types) clearing recharts tooltip content friction project-wide.
- Fixed series.ts getKpis sum helper typing (keyof VolumePoint) — tsc --noEmit now zero errors in app code (only pre-existing scaffold examples/skills noise remains).
- Full agent-browser QA pass: boot splash → Overview; navigated all 8 modules — zero console errors anywhere.
- Golden paths verified: platform toggle changes table data (ALL 5.5M → X 4.4M → TG 1.0M for #GaganyaanLaunch); trend drill-down Sheet (telemetry, platform donut, Hindi sample posts with BOT-FLAGGED badges, related-narrative hot-swap); network node click → Account inspector; propagation trace (किसान आंदोलन) → 8 animated .edge-flow edges + cascade stats (reach/latency/depth); misinfo claim dossier (fact-check cross-refs, bot correlation bars, cross-platform propagation chart + event timeline with BOTS % badges); report modal (auto key findings, Export PDF/Copy actions); alert Acknowledge updates row status; community filter chips; zoom/pan/drag controls present.
- VLM design review: Overview 9/10, Network propagation 9/10, Misinfo dossier 9/10, light mode + bots screen "professional and complete".
- Footer verified: sticks at 0px gap on tall viewports (1600×2600), pushes naturally on overflow.
- Theme toggle verified (light mode renders cleanly). Tablet 1024px layout verified.
- Lint clean; dev.log all 200s, no runtime errors.

Stage Summary:
- TraceX prototype COMPLETE: all 8 screens interactive with filter-aware mock data, drill-downs, modals, force-graph, propagation tracing.
- Remaining nice-to-haves (deferred): per-topic 24h volume getter, spike flags for 7d 3h buckets, getEmotions query sensitivity, shift-event topicId tagging.

---
Task ID: 5
Agent: main (orchestrator)
Task: Final handover documentation + recurring QA cron

Work Log:
- Documented full architecture, conventions, verification evidence, and next-phase recommendations.
- Created recurring 15-min webDevReview cron job for autonomous QA/iteration.

Stage Summary:
- Project ready for hackathon demo. See "Current project status" section above.

---
Task ID: 6 (webDevReview round 1)
Agent: main (orchestrator, cron-triggered)
Task: QA sweep + new features (⌘K palette, watchlist, hotkeys) + API gap fixes + styling polish

Work Log:
- QA sweep across all 8 screens via agent-browser: zero console errors; golden paths re-verified.
- NEW FEATURE: CommandPalette (src/components/tracex/shell/CommandPalette.tsx) — ⌘K/Ctrl+K opens cmdk dialog: 8 modules, 16 narratives (with volume + watchlist stars), 8 claims (risk-coloured), 6 influencers (PR scores), filter-bank actions (platform X/TG/All, language toggles, reset, report, theme). Footer kbd-hint strip. Trigger button in TopBar; romanized topic ids added to search values for Devanagari matching.
- NEW FEATURE: Narrative watchlist — app-state gained watchlist[] + toggleWatchlist/isWatched (defaults: kisan-andolan, isro-mission). Sidebar WATCHLIST section (risk dot, label, live sparkline, volume, click → trends drill-down). Star toggle column in Trends keyword table + star button in drill-down sheet header (stopPropagation; bidirectional sync verified).
- NEW FEATURE: Keyboard shortcuts — 1–8 switch modules (input-guarded); hotkey hint row in sidebar.
- API FIXES (src/lib/mock/series.ts): (1) spike injection now covers 7d 3h-buckets (bucketed spikeHour mapping + tuned thresholds 1.55/2.1) — Trends 7D now shows "3 vs baseline"; (2) getEmotions responds to search query (matched narratives' risk/negative lean tilts Opposition/Anger/Anxiety) + platform tilt; (3) getSentimentShifts attributes each flip to the topic with the largest velocity-weighted swing (topic labels verified in browser).
- STYLING POLISH: Overview zero-spike state now muted "none · nominal" (was amber); alert feed rows carry full-detail title tooltips; XAxis minTickGap adaptive (30d=24, 7d=36); KpiCard hover adds tonal lift (bg-accent/50 + stronger border); OverviewScreen gained cn import; ChartBits TooltipEntry widened earlier (name/value unions) — tsc clean app-wide.
- Verification: lint 0/0; tsc --noEmit 0 app errors; browser: palette open/filter/Enter → Trends + sheet opens; star toggle on/off synced with sidebar count; hotkeys 1–8 navigate; 7d spikes = 3; shift panel topic-attributed; VLM confirms watchlist + ⌘K render with no defects.

Stage Summary:
- All features working, console clean after fresh reload (earlier errors were stale HMR buffers).
- Nice-to-haves for next round: persist watchlist to localStorage; palette action to jump directly to claim dossier selection; romanized alias search for Hindi claim text; sparkline in ModuleStrip clickable to respective screens.

---
Task ID: 7 (webDevReview round 2)
Agent: main (orchestrator, cron-triggered)
Task: Full QA sweep + feature round: session persistence, deep-linking, alert bell, hotkey help, CSV export, corpus heat calendar, clickable pipeline strip, styling polish

Work Log:
- Read worklog; assessed project state: dev server healthy (all 200s), lint 0/0, tsc 0 app errors.
- agent-browser QA sweep BEFORE changes: all 8 screens render (hotkey nav), palette open/filter/romanized-search ("kisan" → किसान आंदोलन), watchlist sidebar sync, report modal open/close, platform filter data change (ALL 52M / X 38M / TG 14M / restore 52M), theme toggle both directions, trends drill-down sheet, network node click → account inspector. ZERO console errors → project judged stable → feature round prioritized.
- NEW: Session persistence + URL hash deep-linking (src/lib/app-state.tsx rewrite):
  - localStorage key `tracex.console.v1` stores {filters, watchlist}; validated + merged with defaults on load (corrupt-store safe, SSR-guarded via module-level `typeof window` check — no hydration mismatch since BootSplash gates first paint).
  - `#/screen`, `#/trends/topic-id`, `#/misinfo/claim:CLM-XXXX` hash format; write-only effect (replaceState — no history spam, no setState in effect so lint-clean); hash overrides stored position on load.
  - `selectedClaimId` added to global bus; `go()` accepts `{topicId?, claimId?}`.
- NEW: Palette claim entries now jump straight to the dossier (go("misinfo", {claimId})) — MisinfoScreen selection moved from local useState to app-state (alias vars keep the rest of the file untouched).
- NEW: CSV export (src/lib/csv.ts — downloadCsv + csvStamp, RFC-style escaping, Blob + objectURL):
  - Trends keyword table toolbar "CSV" button (8 columns incl. velocity/risk/x-share/watched).
  - Alerts history panel "CSV" button (severity/type/topic/timestamp/status/detail).
  - Both fire sonner toasts with row counts.
- NEW: AlertsBell (src/components/tracex/shell/AlertsBell.tsx) — TopBar bell with red unread badge (New + critical/high count), popover feed (10 most recent, severity dots, type badges, relTime), row click → implicated module via linkScreen, "Mark all read" + "Triage console →" footer. Opening the popover marks visible alerts read.
- NEW: HotkeyHelp (src/components/tracex/shell/HotkeyHelp.tsx) — "?" (or Shift+/) opens a shortcuts dialog: Console / Module switching (1–8) / Analyst gestures groups, built on new Kbd primitives.
- NEW: Kbd primitives (src/components/tracex/common/Kbd.tsx) — KbdKey key-caps (border-b-2 inset shadow, mono), Kbd rows, HintStrip for StatusBar (⌘K palette · 1–8 modules · ? shortcuts).
- NEW: HeatCalendar (src/components/tracex/common/HeatCalendar.tsx) — 30-day corpus intensity strip on Overview ("Corpus intensity" panel between KPI row and main chart): cyan color-mix opacity scale by daily volume vs window max, red ring + corner dot on spike days, hover readout (date · posts · SPIKE), avg/anomaly footer, click a day → setRange("30d") + go("trends") + toast. Always queries 30d context regardless of active range, respects filter bank.
- NEW: ModuleStrip pipeline cards are now buttons — each navigates to its module (Ingestion→overview, Demographics→demographics, Sentiment→sentiment, Trend Detection→trends, Bot Detection→bots, Network→network, Misinformation→misinfo, Fusion→overview); hover shows primary border + ArrowUpRight affordance, icon tints primary.
- STYLING: globals.css — visible :focus-visible ring (ring color 75%), native number-input spinners removed, recharts active-dot cyan drop-shadow glow, panel hover border lift (section.bg-card), prefers-reduced-motion guards (kills pulse-dot/edge-flow/scanline + all animations). StatusBar version → v0.10.0, kbd HintStrip added.
- VERIFICATION (all via agent-browser, fresh reloads):
  - Reload with `#/misinfo/claim:CLM-2041` → misinfo + UPI dossier restored. localStorage snapshot verified (filters range=30d carried over, watchlist 2 defaults).
  - Watchlist star toggle → localStorage update; reload → #KollywoodRelease still in sidebar (then unstarred to restore defaults).
  - Palette "convenience fee" → Enter → misinfo dossier CLM-2041 + hash `#/misinfo/claim:CLM-2041`.
  - Bell: popover 12 rows, badge "3", row click navigates + closes.
  - Heat calendar: 30 cells dark AND light; day click (06 Sept, 12,86,987 posts en-IN formatted) → trends + 30D range active.
  - ModuleStrip: Bot Detection card → bots screen. "?" → help dialog (38 lines) → Esc closes.
  - CSV buttons on both screens → "exported" toasts.
  - Full 8-screen regression sweep: all OK, zero console errors. Light mode verified with all new features.
  - Final: lint 0/0, tsc --noEmit 0 app errors, dev.log all 200s.

Stage Summary:
- TraceX v0.10.0: 8 new features + polish layer on a stable base. Console state now survives refresh and is deep-link shareable (`#/misinfo/claim:CLM-2041`) — strong hackathon demo properties.
- Files added: src/lib/csv.ts, src/components/tracex/shell/AlertsBell.tsx, src/components/tracex/shell/HotkeyHelp.tsx, src/components/tracex/common/Kbd.tsx, src/components/tracex/common/HeatCalendar.tsx.
- Files changed: src/lib/app-state.tsx (persistence/hash/claimId), MisinfoScreen (app-state selection), CommandPalette (claim jump), TrendsScreen + AlertsScreen (CSV buttons), OverviewScreen (heat panel + clickable strip), TopBar (bell), StatusBar (hints + version), TraceXApp (HotkeyHelp mount), globals.css (focus/motion/panel polish).
- Remaining ideas for next round: browser back/forward hashchange sync (currently replaceState only); heat calendar keyboard arrow navigation; CSV export on more tables (bots, influencers); claim auto-scroll highlight when opened via palette; per-topic heat calendar in drill-down sheet; sound/flash option on critical alerts (SOC vibe).

---
Task ID: 8 (webDevReview round 3)
Agent: main (orchestrator, cron-triggered)
Task: QA sweep + v0.11 feature round — history-aware navigation, global report modal, CSV exports, claim focus flash, per-topic heat strip, audio cue, dynamic title, styling polish

Work Log:
- Read worklog; assessed state: dev server healthy (200s), lint 0/0, tsc 0 app errors.
- Pre-change QA sweep (agent-browser, session tracex-qa8): all 8 screens render via hotkeys with ZERO console errors/warnings; verified network node click → account inspector, trends drill-down sheet, palette search (romanized "kisan" → किसान आंदोलन), report modal from Alerts button, bell popover, platform filter data change (52M → 38M), deep-link persistence on reload.
- BUG FOUND + FIXED — back/forward navigation: go() used replaceState only, so browser Back EXITED the app entirely and bfcache restore garbled the dev page (h1=null). Fix in app-state.tsx: first hash write normalises URL via replaceState; every later go() PUSHES a history entry; new popstate listener restores {screen, topicId, claimId} from the target hash (bare/foreign hash normalised to #/overview BEFORE setState so the write-effect never re-pushes). Verified: trends → network → Back (trends ✓) → Back (overview ✓) → Forward (trends ✓); page never garbles.
- FEATURE — global ReportModal: added reportOpen/setReportOpen to app-state; modal now mounted ONCE at shell level (TraceXApp Console); AlertsScreen local state + mount removed (ReportsPanel button → global setReportOpen); ⌘K palette "Generate intelligence report" now opens the modal DIRECTLY over any screen (was: navigate-to-alerts + toast). Verified from trends screen: palette → modal opens, URL unchanged.
- FEATURE — CSV exports extended: BotScreen "Export watchlist" is now a REAL download (tracex-flagged-accounts-*.csv, 11 columns incl. botProb/age/dupPct/timing/cluster, respects current sort+platform scope, 12-row toast); NetworkScreen influencer board gains "CSV" button (rank/handle/platform/community/pagerank/followers/reach/botProb, 8-row toast).
- FEATURE — claim focus flash (MisinfoScreen): claim rows carry data-claim-id; effect on selectedClaimId does scrollIntoView(smooth, nearest) + .claim-flash outline-pulse animation (new CSS keyframes in globals.css, reduced-motion guarded, re-triggerable via reflow trick). Verified: palette jump → claim selected; list click on new claim → FLASHING ✓ in-viewport ✓.
- FEATURE — per-topic 30-day intensity strip in trends drill-down sheet: TopicDrill computes getTopicSeries(topic, {...filters, range:"30d"}) → HeatDay[]; HeatCalendar gained additive `compact` prop (size-2.5 cells, no legend, truncated readout — fits 420px sheet); strip renders between Telemetry and Platform split with "N spikes" counter. Verified: 30 cells, "3 spikes", heat-in-sheet ✓.
- FEATURE — critical-alert audio cue (SOC vibe): new src/lib/alert-cue.ts module singleton — WebAudio two-tone chirp (880→660Hz, ~160ms, gain 0.07), localStorage persistence (tracex.audio.v1), CustomEvent bus (tracex:alert-cue); TopBar volume toggle (Volume2/VolumeX, aria-pressed, primary-tinted armed state, "armed" toast + sample chirp on enable — the click gesture unlocks the AudioContext); OverviewScreen LiveAlertFeed dispatches on high/critical template arrivals; shell-level AlertCueListener in TraceXApp binds the event. Verified: toggle on → localStorage "on" + toast; dispatch no errors; restored to off.
- FEATURE — dynamic document title: "Module · TraceX" (e.g. "Bot Detection · TraceX"), updates per screen via DocumentTitle effect in TraceXApp. Verified across screen switches.
- STYLING POLISH (globals.css): .claim-flash keyframes (inset primary rail + expanding ring + 14% bg tint, 1.6s ease-out); tbody tr background transition (120ms); sheet/dialog overlay backdrop-filter blur(2px) saturate(0.9); claim-flash added to reduced-motion kill-list; StatusBar version → v0.11.0; HotkeyHelp gains "←/→ Browser Back / Forward — walk console history" entry; tracex-root wrapper class added to Console root div.
- VERIFICATION (agent-browser, fresh session tracex-qa9-final): fresh reload + all 8 screens hotkey sweep — ZERO console errors; deep-link #/misinfo/claim:CLM-2041 restores screen + selection + 2-item watchlist from localStorage; light mode toggle clean; sheet heat strip screenshot; VLM design review — drill-down sheet 8.5/10 (heat strip "highly effective data-dense visualization"), light mode 9/10 (no defects).
- Final gates: bun run lint 0/0; bunx tsc --noEmit 0 app errors (only pre-existing examples/skills scaffold noise); dev.log all 200s.

Stage Summary:
- TraceX v0.11.0: 7 features + 1 real bug fix (back/forward history) on the stable v0.10 base. Console now behaves like a real multi-screen app under browser navigation.
- Files added: src/lib/alert-cue.ts.
- Files changed: src/lib/app-state.tsx (pushState/popstate/reportOpen), TraceXApp.tsx (shell mounts: ReportModal, AlertCueListener, DocumentTitle, tracex-root), CommandPalette.tsx (direct modal open), AlertsScreen.tsx (global report state), TopBar.tsx (audio toggle), OverviewScreen.tsx (cue dispatch), MisinfoScreen.tsx (data-claim-id + flash effect), TrendsScreen.tsx (sheet heat strip), BotScreen.tsx + NetworkScreen.tsx (CSV exports), HeatCalendar.tsx (compact prop — additive), HotkeyHelp.tsx (history hint), StatusBar.tsx (version), globals.css (claim-flash + polish).
- Remaining ideas for next round: heat calendar keyboard arrow navigation; CSV export on misinfo claims list + demographics tables; title unread-count suffix (needs lifted bell read-state); audio cue on screens other than Overview (feed timer currently Overview-scoped); per-bucket tooltip on compact heat cells; VLM minor notes (telemetry value right-alignment, Languages→heat strip spacing).

---
Task ID: 9 (webDevReview round 4)
Agent: main (orchestrator, cron-triggered)
Task: QA sweep + complete the interrupted v0.12 round — live-alert bus wiring (bell + Overview feed + tab title), palette saved-views, analyst notebook, heat-calendar keyboard nav, CSV exports, styling polish

Work Log:
- Read worklog; assessed state: dev server healthy, lint 0/0, tsc 0 app errors.
- DISCOVERY: a previous (undocumented) v0.12 round was interrupted mid-flight — app-state.tsx + live-feed.ts + TopBar saved-views UI existed, but ZERO UI consumed the new alert bus; overview still ran its own duplicate 22s timer (double audio-cue dispatch); ClaimNotebook/palette-views/title-suffix were designed in state but never rendered.
- Pre-change QA sweep (agent-browser): all 8 screens render via hotkeys, ZERO console errors; platform filter data change, trends drill-down sheet, palette "kisan" → किसान आंदोलन, deep-link #/misinfo/claim:CLM-2041 restore, saved-view save/apply/delete all verified working.
- FIX (real bug) — duplicate live-feed timers: OverviewScreen LiveAlertFeed had its OWN 22s interval + dispatchAlertCue while the shell singleton (started in AppProvider) also fired — double chirps + two alert streams. Migrated LiveAlertFeed to consume `alertsFeed` from useApp() (removed local timer/cue/imports); rows keyed by alert id get a `feed-arrival` slide-in + signal-tint animation; relTime now ticks via useNow(15s).
- FIX — AlertsBell: was local getAlerts + local readIds (live alerts never appeared; read-state unshared). Rewired to global `alertsFeed`/`alertUnread`/`markAlertsRead`; badge keyed by count → `bell-pop` scale animation on each increment; popover rows also animate in.
- FEATURE — document title unread suffix: "(N) Mission Control · TraceX" via DocumentTitle effect on alertUnread; opening the bell or Mark-all-read clears it (verified in browser).
- FEATURE — CommandPalette "Saved views — filter-bank presets" group: Bookmark icon + name + platform/range/screen summary + active marker; Enter applies via applyView + toast. The TopBar "Reachable from ⌘K" promise is now true (verified end-to-end).
- FEATURE — analyst notebook (MisinfoScreen): ClaimNotebook component (keyed remount per claim — lint-clean, no setState-in-effect), debounced 500ms autosave + blur/save-now, "saving…/draft/synced" indicator, saved-X-ago, 2000-char counter; persisted in tracex.console.v1 (verified across reload + per-claim isolation CLM-2044 ↔ CLM-2071); NotebookPen badge on claims-list rows with notes; analyst_note column in claims CSV.
- FEATURE — heat calendar keyboard navigation: roving tabindex (cursor starts on most recent day), ←/→ walk, Home/End jump, Enter selects; readout updates as the cursor moves; cursor ring only appears after keyboard interaction (VLM flagged the always-on ring as a "rendering glitch") and is outline-only in compact mode; footer gains "←/→ walk days" hint; HotkeyHelp documents the gestures.
- FEATURE — CSV exports: MisinfoScreen claims list (11 columns incl. analyst_note, respects risk/status filters, toast with row count) + DemographicsScreen cohort tables (dimension/label/share/volume across states·languages·ages·interests).
- STYLING POLISH (VLM round 1: 8.5/7.5 → round 2: 9.2/10): KpiCard header items-center (icon/title alignment), HeatCalendar space-y-2.5 + interaction-gated cursor, sheet velocity chart faint horizontal gridlines, drill-down Languages row now wraps right-aligned (was shrink-0 overflow), sheet heat-strip "←/→ to walk" hint, StatusBar → v0.12.0, .feed-arrival/.bell-pop keyframes (reduced-motion guarded).
- VERIFICATION (agent-browser, fresh sessions): live bus end-to-end — tick arrives → Overview feed first row (anim) + bell badge + title suffix; exactly 3 arrivals in 3×22s ticks (single timer, no duplicates); bell open clears badge + title suffix; palette view save→search→Enter apply→delete; notebook type→persist→isolate→restore; heat cells focus→arrows→Home→Enter navigates to trends; both CSV buttons toast; light mode clean; back/forward history walk (trends↔misinfo); 8-screen hotkey regression — zero console errors/warnings.
- INFRA incident: dev server died twice mid-round (concurrent lint+tsc+browser load; silent kill, no EADDRINUSE in log). `nohup`/`setsid+disown` launches also died when the bash session ended; stable relaunch achieved via `(setsid bun run dev >> dev.log 2>&1 < /dev/null &)` detached-subshell form — survived across sessions, HTTP 200 stable.
- Final gates: bun run lint 0/0; bunx tsc --noEmit 0 app errors; dev.log all 200s.

Stage Summary:
- TraceX v0.12.0: the interrupted round is now COMPLETE and fully wired — one live-alert singleton drives the Overview feed, the bell badge, the tab-title unread count and the audio cue on every screen; saved views are palette-reachable; analysts can annotate claims persistently; the heat calendar is fully keyboard-operable; 2 more CSV exports.
- Files changed: OverviewScreen.tsx (bus migration), AlertsBell.tsx (rewrite to global bus), CommandPalette.tsx (views group), MisinfoScreen.tsx (notebook + badge + CSV), DemographicsScreen.tsx (cohort CSV), TrendsScreen.tsx (languages row + gridlines + hints), TraceXApp.tsx (title suffix), StatusBar.tsx (v0.12.0), HotkeyHelp.tsx (entries), HeatCalendar.tsx (keyboard nav + cursor gating), KpiCard.tsx (header centering), globals.css (feed-arrival + bell-pop keyframes, reduced-motion list).
- Remaining ideas for next round: languages-row +N overflow chip for <1400px; velocity-chart edge-label padding; unify "positive" green tones (NET tag vs KPI value); scroll-into-view for the palette-jumped claim could also flash the notebook; audio cue de-dupe guard if a second feed source is ever added.

---
Task ID: 10 (webDevReview round 5)
Agent: main (orchestrator, cron-triggered)
Task: QA sweep + v0.13 feature round — temporal replay time machine, guided tour, methodology briefing, chart/comprehension fixes, styling polish

Work Log:
- Read worklog; assessed state: dev server healthy (all 200s), lint 0/0, tsc 0 app errors.
- Pre-change QA sweep (agent-browser): all 8 screens via hotkeys — ZERO console errors; deep-link #/misinfo/claim:CLM-2041 restore; palette "kisan" → किसान आंदोलन → trends sheet; network node click → inspector; platform filter data change (heat avg 13,15,416 → 9,69,626/day); live alert bus (title "(3)"); light mode clean.
- BUG FOUND + FIXED — "anomalyes" pluralization typo in HeatCalendar footer (0/2+ produced "anomalyes"): now "1 anomaly" / "N anomalies".
- BUG FOUND + FIXED — Overview legend promised a dashed cyan Baseline that was never rendered: `Line` children are silently dropped inside recharts `AreaChart`. Switched to `ComposedChart` — baseline Line now renders, plus the new ghost + playhead lines.
- LINT FIX — the first timer implementation wrote a ref during render (react-hooks/refs): refactored to a self-rescheduling setTimeout with cursorIdx as dependency (all setState inside the async tick).
- NEW FEATURE 1 — Time machine (temporal replay, Overview):
  - New `common/TimeMachine.tsx`: transport controls (play/pause, rewind-to-start), layered scrub track (base + primary fill + amber spike ticks + playhead thumb + live-edge dot) with an invisible native range on top for drag + keyboard a11y (aria-valuetext per step), LIVE/go-live badge, mono readout (`label · step N/M · cum · % vol`).
  - OverviewScreen: ~14s adaptive sweep (stepMs scales to series length), auto-return to LIVE at the live edge; AS-OF derivations — posts proportional to arrived volume, avg sentiment weighted over the slice, active narratives = share ≥ 12% arrived, high-risk alerts = hot alerts with t ≤ playhead (live feed excluded during replay); chart slices the stacked sentiment at the playhead with a dimmed ghost line of the still-upcoming window (null-padded data) + orange playhead hairline; stats strip/spikes computed from the as-of view; trending table filters to emerged narratives, re-sorts by as-of growth rate, volume × share, sparklines truncated; KPI footnotes switch to "as of {label}"; ScreenHeader gains a replay badge; heat calendar dims future days (new `activeT` prop on HeatCalendar).
- NEW FEATURE 2 — Guided tour (`shell/GuidedTour.tsx`, 7 steps): spotlight overlay via box-shadow scrim cut-out (pulsing primary ring), tooltip card with step counter, progress dots, directional caret (cardAbove state drives caret edge), Back/Next/Skip + keyboard (Esc/←/→/Enter); auto-starts once per browser (localStorage `tracex.tour.v1`, gated 700ms post-boot via async callback — lint-clean); relaunchable via palette entry + HotkeyHelp footer button (CustomEvent `tracex:tour-start`); steps targeting Overview artefacts auto-navigate (gotoStep calls go first); missing targets auto-skip after 650ms; module hotkeys 1–8 muted during tour (body.tour-active guard in ModuleHotkeys).
- NEW FEATURE 3 — Methodology & data provenance dialog (`modals/MethodologyDialog.tsx`, global `methodologyOpen` state in app-state): 4 sections — 5-stage processing pipeline, the four intelligence questions (WHAT/WHO/WHERE/HOW grid with module refs), scoring reference (risk bands with ScoreBars, bot signals, sentiment scale), privacy guarantees (k≥50, no profiling, cohorts, demo transparency). Opened from palette ("Methodology & data provenance") + HotkeyHelp footer.
- STYLING POLISH: HeatCalendar typo; baseline line actually rendering (legend/visual mismatch fixed); Trends drill-down languages row → first three inline + "+N" chip with full-list tooltip (VLM nit from v0.12); CHART.green == --signal-green verified unified at token level (VLM nit confirmed non-issue); globals.css additions — tour spotlight pulse, tour card entrance (+ centered-card fade variant), tm-thumb breathing keyframes — ALL reduced-motion guarded; StatusBar → v0.13.0; HotkeyHelp gains replay-gesture entry + relauncher buttons.
- VERIFICATION (agent-browser, fresh sessions): 8-screen hotkey sweep zero console errors; tour auto-start → walk all 7 steps → Finish writes flag + body-class cleanup → relaunch via palette from Network screen auto-navigates to overview; Esc skip works; caret renders on spotlight steps; methodology dialog opens via palette with all 4 sections; replay — play (as-of KPIs 8.5M/22% at step 8/56 + replay badge + readout) → full sweep auto-returns LIVE → manual scrub step 26 = 19M cum/49% vol + ghost line + Upcoming legend + playhead ReferenceLine + heat dimming → go-live restores; ComposedChart fix verified in DOM (2 Lines + 1 ReferenceLine + 3 Areas); light mode verified; scrubber fits panel bounds; VLM design review attempted — service 401 in this environment (unavailable, DOM assertions used instead).
- Final gates: bun run lint 0/0; bunx tsc --noEmit 0 app errors; dev.log all 200s.

Stage Summary:
- TraceX v0.13.0: the Overview now has a demo-defining "rewind the corpus" replay scrubber (charts, KPIs, trending table and heat strip all time-sync to the playhead), first-visit users get a spotlight guided tour, and judges/analysts can open a methodology briefing from anywhere. One comprehension bug (missing baseline) and one typo fixed.
- Files added: src/components/tracex/common/TimeMachine.tsx, src/components/tracex/shell/GuidedTour.tsx, src/components/tracex/modals/MethodologyDialog.tsx.
- Files changed: OverviewScreen.tsx (replay state + as-of derivations + ComposedChart + ghost/playhead + data-tour anchors), HeatCalendar.tsx (typo + activeT prop), TrendsScreen.tsx (languages +N chip), app-state.tsx (methodologyOpen), TraceXApp.tsx (mounts + tour hotkey guard), CommandPalette.tsx (2 actions), HotkeyHelp.tsx (footer relaunchers + replay entry), TopBar.tsx (data-tour filter-bank wrapper), Sidebar.tsx (module-rail/watchlist anchors), StatusBar.tsx (v0.13.0), globals.css (tour/thumb keyframes + reduced-motion).
- Remaining ideas for next round: replay speed control (0.5×/2×) + keyboard arrows on the scrubber could seek while playing; tour could highlight the scrubber itself as a step; methodology dialog could deep-link to the modules it references; VLM review unavailable this round — rerun visual QA when service returns; palette "tour" keyword didn't match single word (value string is "guided tour" — consider adding bare "tour" token).

---
Task ID: 10 (addendum)
Agent: main (orchestrator)
Task: Command palette strict token filter (post-round fix)

Work Log:
- Discovered during verification: cmdk's default loose fuzzy matching made searching "tour" highlight the "UPI 16B transactions" narrative (scattered character matches across long values) — the tour action ranked last despite an exact value prefix.
- FIX: added an optional `filter` passthrough to the shared shadcn CommandDialog (additive prop, only CommandPalette consumes it) and a strict token-based filter in the palette: every whitespace-separated query token must occur as a substring of the item value; whole-phrase (+50) and leading-token (+100) matches rank higher; non-matching items drop out entirely.
- Verified: "tour" → only "Replay the guided console tour" (selected); "guided tour", "methodology" → their actions; "kisan" → किसान आंदोलन; "convenience" → UPI claim; "gaganyaan" → narrative + claim. All golden searches intact.
- Gates: lint 0/0; tsc 0 app errors.

Stage Summary:
- Palette precision materially improved for the demo (type a word, get the thing) with zero regressions on romanized narrative search. Files changed: src/components/ui/command.tsx (additive filter prop), src/components/tracex/shell/CommandPalette.tsx (tokenFilter + value prefix "tour").
