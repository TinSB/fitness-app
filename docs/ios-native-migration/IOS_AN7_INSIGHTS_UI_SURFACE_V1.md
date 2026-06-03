# iOS AN-7 — Insights UI surface (read-only) (V1)

Status: landed. Track: analytics/insights (AN-1…7). Kind: READ-ONLY UI wiring + pure presentation/orchestration — the CLOSURE slice that wires the AN-1…6 engine layer into the FIRST insights UI. NO engine logic change, NO golden change, NO write path. Binding contract: `docs/IRONPATH_MASTER_TECHNICAL_ARCHITECTURE.md` (§10 DataHealth chokepoint, §11 clean inputs / TrainingDecision boundary + SR-4 loose-params note, §15 thin app layer + honest states, §19.2 additive presentation, §27 milestone registry — AN-7 row).

## 1. Scope

AN-1…6 ported + parity-pinned the analytics/insights engine layer but, by design, wired it into NO UI. AN-7 is the first consumer: it adds a READ-ONLY **训练洞察** block to the 今日 surface (`TodayRootView`) that renders the six analytics outputs — **PR / 趋势 / 平台期 / 连续打卡 / 肌群平衡 / 智能摘要** — from the user's REAL on-device data.

Everything is read-only display. Nothing here writes a source of truth, touches `CanonicalSessionWriter` or any write path, mutates AppData, or changes an engine or a parity golden.

### Added
- `IronPathTrainingDecision/TrainingInsightsReadPath.swift` (NEW, SPM-auto-included) — the pure read path:
  - `InsightsAppDataLoadOutcome` (`.missing` / `.unreadable` / `.loaded(CleanAppDataView)`) — the loader's outcome, mirroring `TodayAppDataLoadOutcome`.
  - `TrainingInsightsState` (`.ready(TrainingInsightsSummary)` / `.empty` / `.unavailable`).
  - `resolveTrainingInsightsState(_:now:)` — pure resolver mirroring `resolveTodayReadinessState`: maps the outcome to a state, computing the summary only when a non-empty cleaned history is present.
  - `TrainingInsightsSummary` — pure presentation organizer (the `TodayReadinessSummary` analog): CALLs the AN-1…6 engines and formats `SurfaceRow`s + strings the thin SwiftUI layer renders verbatim.
- `ios/IronPath/TodayRootView.swift` (EDITED) — adds a thin `@MainActor TrainingInsightsModel` (the IO seam, mirroring `TodayRealDataModel`) and the read-only 训练洞察 SwiftUI block. No other app file changed.

### Out of scope (NOT changed)
- The AN-1…6 engines (consumed verbatim) and any of their goldens.
- Any write path / `CanonicalSessionWriter` / AppData mutation. The 计划 / 训练 / 我的 / 记录 surfaces.
- `project.pbxproj` / `Package.swift` / `package.json` / lockfiles / dependencies.

## 2. Reuse — no re-port, no engine change

Every analytics value is produced by an ALREADY-PORTED, parity-pinned engine; AN-7 only CALLs them and formats the result.

| Insights section | Reused Swift engine (track) |
| --- | --- |
| 连续打卡 | `TrainingStreakEngine.computeTrainingStreak` (AN-1) |
| 近期 PR | `RecentPRDeltaEngine.computeRecentPRDeltas` (AN-1) |
| 肌群平衡 | `WeeklyMuscleBalanceEngine.computeWeeklyMuscleBalance` (AN-1) |
| 趋势 | `AnalyticsDashboardEngine.buildExerciseTrend` / `.trendStatus` / `.coreTrendExercises` (AN-3) |
| 智能摘要 + 平台期 | `TrainingIntelligenceSummaryEngine.buildTrainingIntelligenceSummary` (AN-6, which internally runs AN-2 plateau + AN-4/5/5b leaves) |

The 智能摘要 call passes only `(latestSession: history.first, history:)` (newest-first; see §4); every optional opaque param defaults to nil/empty, exactly as the AN-6 `Params` init allows. The engine then selects exercises and runs plateau detection itself — so 平台期 falls out of the same call (`plateauResults`), filtered to the IMPORTANT statuses (the engine's own `plateauIsImportant`: not `none`, not `insufficient_data`).

## 3. The read path is clean-view-derived (§10/§11)

The contract is the SR-4 precedent (§11): these analytics engines take their own loose params, NOT the branded `CleanTrainingDecisionInput`, but their input is still **derived from the DataHealth clean view, never raw AppData**.

```
canonical AppData  →  buildCleanAppDataView (the §10 chokepoint, app layer)
                   →  CleanAppDataView.cleanedHistory
                   →  resolveTrainingInsightsState  →  TrainingInsightsSummary
```

- `TrainingInsightsModel` (app layer) owns the ONLY IO: it opts the running app into the SAME sanctioned canonical store the write path uses (`JSONFileAppDataStore.applicationSupport()`), loads it READ-ONLY, and builds the clean view via `buildCleanAppDataView` — mirroring `TodayRealDataModel`. Raw AppData NEVER reaches an engine.
- The TrainingDecision package never constructs the clean view itself (the §11 boundary); the app layer does, and hands the resolver the `CleanAppDataView`.
- No write: a missing/absent file → `.missing`; an unreadable document is left UNTOUCHED on disk → `.unreadable`. The read path never overwrites.

## 4. History order bridge (the one non-obvious correctness point)

Canonical `AppData.history` is **OLDEST-FIRST** — `AppData.appendingHistorySession` appends to the end — so `cleanedHistory` is oldest-first too. The AN-1…6 analytics engines mirror the PWA (`src/engines/analytics.ts`) convention of a **NEWEST-FIRST** history:
- `buildWeeklyReport` does `history.slice(0, 8).reverse()` (takes the first 8 as the most recent, reverses to chronological);
- `trendStatus` reads `trend.slice(0, 2)` as the RECENT points;
- `selectExerciseIds` reads the first 3 analytics sessions as the recent ones.

This is verifiable in the committed goldens: `analytics/exercise-trend-cases-v1` case `progressing-and-slice-6` has `history[0].date = 2026-05-30` (the newest) and is labelled "progressing".

So the resolver reverses `cleanedHistory` to newest-first ONCE and feeds that single consistent view to every engine. Streak / recent-PR-delta / muscle-balance are timestamp-driven and order-robust; the reverse only changes trend + intelligence selection, but is applied uniformly. `latestSession` for the intelligence summary is therefore `recentFirst.first` (the most recent session).

## 5. Honest states (§15.4)

- No canonical file / first launch / no cleaned history → `.empty`. The block renders nothing: the readiness `content` above already shows the honest no-data state for the SAME store, so a second empty card would be redundant.
- Unreadable document → `.unavailable` (degrade, document untouched). Same rationale — the readiness degrade state covers it; the block renders nothing.
- A per-section gap inside a `.ready` summary (no in-window PR, no core-lift trend data, no important plateau) → an honest "数据不足" / "暂无" placeholder, never a fabricated value.

## 6. Zero `: Date`

The injected `now` (the model's `() -> Date`, off in previews/tests) drives BOTH the clean view's guard clock and the engines' `nowIso` (via a UTC ISO-8601 formatter, the same shape as the Today read path). No `new Date()` / `Date.now()` / `: Date` / `Calendar` on the read path; previews/tests pin state and never read disk.

## 7. Boundaries held

- **Source-of-truth impact: none.** Pure read-only display; no `CanonicalSessionWriter` / write-path touch; no AppData mutation (passes the central `iosArchitectureBoundaryStaticGuards` AppData-mutation ban + the shell import/network/JS-bridge bans).
- **Data-safety impact: none.** Unreadable documents are never overwritten.
- No analytics engine logic changed; **no golden touched** (zero parity drift).
- SPM-auto-included; **no `project.pbxproj` / `Package.swift` / `package.json` / lockfile / dependency** touch.

## 8. Verification

- `npx vitest run` — full suite incl. the iOS architecture static guards (AppData-mutation ban, shell bans, lockfile byte-identity).
- `swift test --package-path ios/packages/IronPathTrainingDecision` — analytics parity stays green (the new file adds no test-affecting behavior; engines + goldens unchanged).
- `xcodebuild … -scheme IronPath … build` — the app (incl. the new 训练洞察 block + previews) compiles.
- `git diff --diff-filter=MAD --name-only -- tests/fixtures/parity/golden/` is empty (zero golden drift).
