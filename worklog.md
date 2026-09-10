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
