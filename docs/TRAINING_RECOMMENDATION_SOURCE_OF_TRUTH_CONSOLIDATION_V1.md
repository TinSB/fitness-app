# Training Recommendation Source-of-Truth Consolidation V1

Branch: `claude/training-recommendation-system-full-rewrite-v1`
Related plan: [TRAINING_RECOMMENDATION_SOURCE_OF_TRUTH_REWRITE_PLAN_V1.md](TRAINING_RECOMMENDATION_SOURCE_OF_TRUTH_REWRITE_PLAN_V1.md)
Prior audits: [TRAINING_CYCLE_GAP_REENTRY_AUDIT_V1.md](TRAINING_CYCLE_GAP_REENTRY_AUDIT_V1.md) (PR #381)

## 1. Executive summary

IronPath previously emitted up to four conflicting "final" training advice voices for the same user state. After 14+ days off a serious lifter would see:

- Today: `回归周` phase label (correct).
- TrainingFocus: every exercise prescribed only 1 working set (wrong — root-cause: double trim).
- Plan weekly card: `本周先控制风险。` plus per-muscle `-2 组` (wrong — added on top of reentry-trim).
- Progress hero: `力量有进步 / 恢复压力偏高 / 下次建议保持重量` (wrong — independent and contradictory).

This rewrite introduces a single `TrainingDecision` engine that owns all final user-facing training direction, applies arbitration rules (AR-1..AR-5 today; AR-6..AR-9 reserved for follow-up), and exposes a typed surface that downstream engines and UI consult. Two key legacy engines (`weeklyProgressionRecommendationEngine`, `progressClaritySummary`) now read a `trainingDecisionContext` hint and suppress double-penalty / contradictory copy under reentry / restart / controlled-reload / deload phases. The double-trim bug in `exercisePrescriptionEngine.applyStatusRules` is patched by accepting an external arbitrated multiplier and a productive-floor map.

## 2. User-reported problem

> "After 14+ days off, the app now shows 回归周, but the actual prescribed work is still too weak. Some sessions prescribe only 1 working set per exercise. Weekly suggestion says 本周先控制风险 and reduces 2 sets from back, legs, chest, shoulders, and arms. Other status interpretation says 力量有进步 / 恢复压力偏高 / 下次建议保持重量. Different components produce contradictory recommendations. User trains seriously and does not want the app to act like a permanent risk-warning machine."

## 3. Full inventory of recommendation components found

See plan §1 for the full inventory: 17 signal-producing engines, 10 presenters, 14 UI surfaces, ~42 test files. Only the engines actually involved in this PR's surface area are listed below.

| Engine | Role before | Role after this PR |
|---|---|---|
| `effectiveTrainingPhaseEngine` | activePhase + compactLabel (signal); consumed directly by UI | Unchanged — read by TrainingDecision and by RecordView for context hint |
| `exercisePrescriptionEngine` | applyStatusRules: produces prescriptions and STACKED its own deload trim on top of mesocycle volume multiplier | Accepts `externalVolumeMultiplier`, `externalExerciseRoleFloors`, `suppressInternalDeloadStrategy`; double-trim path disabled when external multiplier supplied; productive floor enforced as a final pass |
| `weeklyProgressionRecommendationEngine` | Independent `weeklySummary()` could emit `本周先控制风险。` on top of reentry | Accepts `trainingDecisionContext.{activePhase, weeklyDirectionBlocked}`; under reentry/restart + no-severe-signal, summary becomes `已在回归周，先维持当前节奏。` |
| `progressClaritySummary` | Independent emission of legacy triplet (`力量有进步 / 恢复压力偏高 / 下次建议保持重量`) | Accepts `trainingDecisionContext.{sessionIntent, activePhase}`; under reentry / controlled-reload / deload-week, swaps in a single coherent narrative |
| `trainingDecisionEngine` (NEW) | — | Sole final-decision owner: activePhase, sessionIntent, riskLevel, progressionMode, volumeMode, intensityMode, exercisePrescriptions, workingSetTargets, weeklyAdjustment, nextSetPolicy, userFacing, hiddenDebugSignals |

## 4. Current fragmented dataflow → new flow

See plan §2 and §4.1 for the full diagrams. Key change in this PR:

Before:
```
exercisePrescriptionEngine.applyStatusRules
  ├─ line 347: volumeMultiplier from mesocycleWeek
  ├─ line 358: sets = max(1, ceil(sets * max(0.6, vMul)))     ← reentry trim
  └─ applyDeloadStrategy on every exercise                    ← deload trim STACKED
                                                                NET: 0.65 × 0.6 ≈ 0.39
```

After:
```
trainingDecisionEngine.buildTrainingDecision
  ├─ getEffectiveTrainingPhase → reentry-aware multiplier
  ├─ buildAdaptiveDeloadDecision → deload trigger signal
  ├─ AR-2: clampMultiplier(phase, deload, severe) — NEVER multiplies, only clamps
  ├─ AR-3: exerciseRoleFloors (compound ≥ 2, isolation ≥ 1 during reentry)
  └─ applyStatusRules({ externalVolumeMultiplier, externalExerciseRoleFloors, suppressInternalDeloadStrategy: true })
         └─ uses external multiplier as-is, applies role floor as final pass, skips applyDeloadStrategy
```

## 5. Contradiction map

| Visible symptom | Producer file:line (before) | Fix path (this PR) |
|---|---|---|
| `回归周` shown | [effectiveTrainingPhaseEngine.ts:90](../src/engines/effectiveTrainingPhaseEngine.ts:90) | Unchanged — phase label is correct |
| 1-set whole-session | [exercisePrescriptionEngine.ts:347](../src/engines/exercisePrescriptionEngine.ts:347), [:358](../src/engines/exercisePrescriptionEngine.ts:358), [applyDeloadStrategy:285](../src/engines/exercisePrescriptionEngine.ts:285) | TrainingDecision supplies arbitrated multiplier + role floors; applyDeloadStrategy bypassed; final productive-floor pass enforces compound ≥ 2 |
| `本周先控制风险` + -2 sets across muscles | [weeklyProgressionRecommendationEngine.ts:660-664](../src/engines/weeklyProgressionRecommendationEngine.ts:660) | engine reads `trainingDecisionContext`; under reentry+no-severe, summary swapped to `已在回归周，先维持当前节奏。` |
| `力量有进步 / 恢复压力偏高 / 下次建议保持重量` | [progressClaritySummary.ts:144-146](../src/engines/progressClaritySummary.ts:144), [:179](../src/engines/progressClaritySummary.ts:179) | engine reads `trainingDecisionContext`; under reentry / controlled-reload / deload-week, swaps in coherent narrative |

## 6. New TrainingDecision architecture

See plan §4 and §5. Implementation lives at [src/engines/trainingDecisionEngine.ts](../src/engines/trainingDecisionEngine.ts) and [src/engines/trainingDecisionTypes.ts](../src/engines/trainingDecisionTypes.ts).

## 7. TrainingDecision shape

See plan §5 for the canonical interfaces. The engine is the sole exporter of `TrainingDecision` and the sole importer of the legacy final-decision engines for arbitration purposes.

## 8. Deleted / replaced old final-decision paths

This PR is the **first landing** of the rewrite plan. Scope: BLOCKING bugs (reentry double-penalty, contradictory weekly summary, contradictory progress narrative). Scope items deferred to follow-up PRs (documented in the plan):

- Full signal-only narrowing of all 17 legacy engines (this PR narrows 3: weeklyProgressionRecommendationEngine, progressClaritySummary, exercisePrescriptionEngine).
- Full presenter pure-formatter refactor (this PR rewires PlanView + RecordView; full sweep of all 10 presenters is a follow-up).
- Full UI surface re-pointing (this PR addresses the 4 highest-impact visible surfaces; remaining 10 medium/low-impact surfaces in follow-up).
- ESLint-style static guards on imports (this PR adds 1 forbidden-copy scan; the 17-engine import-boundary scan is in follow-up).

## 9. Signal-provider components retained

All 17 legacy engines listed in plan §1.2 remain functional. The 3 narrowed engines accept an optional `trainingDecisionContext` parameter; when absent, behavior is unchanged (full backward compatibility — verified by all 5728 pre-existing tests still passing).

## 10. UI surfaces rewired in this PR

| File | Change |
|---|---|
| [src/features/PlanView.tsx](../src/features/PlanView.tsx) | Passes `trainingDecisionContext` (computed from existing `effectivePhase`) to `buildWeeklyProgressionRecommendation` |
| [src/features/RecordView.tsx](../src/features/RecordView.tsx) | Computes `effectivePhase` via `getEffectiveTrainingPhase`; passes `trainingDecisionContext` to both `buildProgressClaritySummary` and `buildWeeklyProgressionRecommendation` |

## 11. Product rules enforced

- ✅ Normal gym session: never defaults all exercises to 1 set (productive-floor pass in `exercisePrescriptionEngine`).
- ✅ Reentry conservative but productive: AR-2 clamps deload trim instead of stacking; AR-3 enforces compound ≥ 2 sets.
- ✅ Reentry already trimmed → weekly direction not further reduced (AR-4 via `weeklyDirectionBlocked` flag).
- ✅ Strength improving + fatigue high → single coherent line (AR-5 via sessionIntent='controlled-reload').
- ✅ No permanent risk-warning machine: contradictory triplet suppressed under reentry/restart/controlled-reload.
- ✅ One screen one direction: weekly card / progress hero share the same activePhase-aware narrative.
- ✅ Debug signals confined to `TrainingDecision.hiddenDebugSignals` (never rendered in normal UI).

Deferred to follow-up PRs (still ungated):
- AR-6 risk-warning cap per surface (engine implements the structure; UI surfaces other than the 4 highest are not yet rewired).
- AR-7 headline length cap (engine asserts but no static cross-surface scan yet).
- AR-8 permanent-warning lookback downgrade (placeholder; needs `recommendationSnapshots` history walking).
- AR-9 cross-surface coherence test (forbidden-copy scan covers the worst cases).

## 12. Tests added

| File | Tests | Status |
|---|---|---|
| [tests/trainingDecisionSourceOfTruthEngineShape.test.ts](../tests/trainingDecisionSourceOfTruthEngineShape.test.ts) | 3 | ✅ |
| [tests/trainingDecisionSourceOfTruthReentryProductiveDose.test.ts](../tests/trainingDecisionSourceOfTruthReentryProductiveDose.test.ts) | 7 (RGR-1, RGR-2, RGR-4, RGR-5, RGR-6, AR-1 severe override, no-history safe default) | ✅ |
| [tests/trainingDecisionSourceOfTruthArbitrationStrengthUpFatigueHigh.test.ts](../tests/trainingDecisionSourceOfTruthArbitrationStrengthUpFatigueHigh.test.ts) | 5 (RGR-3 + baseline guards + AR-4 + AR-5) | ✅ |
| [tests/trainingDecisionSourceOfTruthForbiddenCopyScan.test.ts](../tests/trainingDecisionSourceOfTruthForbiddenCopyScan.test.ts) | 2 (static source scan: wall phrases + triplet co-occurrence) | ✅ |

Total: 4 new files, 17 new tests, all GREEN. Full suite: **5745 / 5745 passing** (was 5728 before this PR).

## 13. Browser smoke result

Browser smoke for the 14+ day gap reentry scenario was **not run in this session** (environment: CLI / Claude Code worktree, no live browser session readily available). The closest equivalent verification performed:

- ✅ Unit-level reentry scenario: [tests/trainingDecisionSourceOfTruthReentryProductiveDose.test.ts](../tests/trainingDecisionSourceOfTruthReentryProductiveDose.test.ts) covers the exact reentry seed (14-day gap + previous deload + push-a template) and asserts: `activePhase === 'reentry'`, `sessionIntent === 'reentry-productive'`, all compound exercises `sets ≥ 2`, no whole-session all-1-set, `finalVolumeMultiplier ≥ 0.65`, `weeklyAdjustment.direction !== 'decrease'`, `blockedBy === 'reentry-floor'`.
- ✅ Existing integration tests (`trainingPhaseGapWiringRecommendation.test.ts`, `weeklyProgressionRecommendationDisplayIntegration.test.ts`, `progressClaritySummary.test.ts`) all pass with the new wiring.
- ✅ `npm run build` succeeds; `node scripts/scan-production-dist-safety.mjs` passes (21 files scanned).

**Required follow-up**: run the live browser smoke before merge per plan §13.I:
```bash
npm run dev
# seed: lastSessionDate = today − 16 days, mesocyclePlan.activeWeek = deload
# visit Today / Plan / Training / Focus / Progress / Record
# verify single coherent direction per screen, no 1-set sessions, no triplet, no console errors
```

## 14. iPhone / PWA smoke result

Not run in this session. No PWA / service-worker code paths were touched; the changes are pure React component data-binding via existing engines. The PWA cache will pick up the new bundle on next service-worker update. **Recommended**: run iPhone PWA smoke if any reviewer touches mobile-only layout (`uiOs/today/*.tsx` density classes are unchanged).

## 15. Data safety findings

| Category | Status | Evidence |
|---|---|---|
| AppData schema | Unchanged | No edits to `src/models/training-model.ts` |
| TrainingSession schema | Unchanged | No edits to `src/models/training-model.ts` |
| localStorage keys | Unchanged | No edits to `src/storage/`; `trainingDecisionEngine.ts` is pure-derived |
| Cloud sync | Unchanged | No edits to `src/cloudSync/`, `src/cloudProduction/`, `src/sync/` |
| `package.json` / `package-lock.json` | Clean | `git diff -- package.json package-lock.json` is empty |
| `pnpm-lock.yaml` | Absent | `test ! -e pnpm-lock.yaml` passes |
| Production dist forbidden tokens | Clean | `node scripts/scan-production-dist-safety.mjs` passes (21 files) |
| Sync-on receipt + per-account safety (PR #378, #374, #375, #376) | Preserved | All sync boundary tests still passing |
| PR #381 reentry contract | Preserved | `trainingPhaseEffectiveMapping.test.ts` + `trainingPhaseGapWiringRecommendation.test.ts` still passing |
| PR #377 fineTune trust override | Preserved | `fineTuneTrustOverride.test.ts` still passing; the trust-override path in `exercisePrescriptionEngine` runs after the new external-multiplier pass; no behavioral regression |

## 16. Remaining risks

| # | Risk | Status |
|---|---|---|
| R1 | Old final-decision-emitting code paths still live in `weeklyProgressionRecommendationEngine` and `progressClaritySummary` when `trainingDecisionContext` is NOT supplied (legacy callers, tests) | **Accepted** — backward compatibility preserved; the call sites in PlanView/RecordView now always supply context. A static guard test ensuring all UI callers pass context is a follow-up. |
| R2 | Full signal-only narrowing of the remaining 14 legacy engines deferred to follow-up PRs | **Accepted** — the plan §6 lists the inventory; this PR handles the BLOCKING contradictions, follow-up handles defense in depth |
| R3 | Browser + iPhone smoke not run in this session | **Open** — must be performed before merge per plan §13.I, §13.J |
| R4 | AR-8 permanent-warning lookback rule placeholder (no actual `recommendationSnapshots` walk yet) | **Deferred** — engine structure ready; needs historical snapshot wiring (no AppData change required since `recommendationSnapshots` already exists as an optional `TrainingSession` field) |
| R5 | The 4-day/week active lifter test (`trainingDecisionSourceOfTruthConservativeNoBrakes`) is not yet implemented; current `normal-session` path may still emit `保守` text via legacy engines if conservative readiness fires | **Open** — covered for reentry/controlled-reload/deload, not yet for normal-session-with-low-readiness; follow-up |

## 17. Final verdict

**Approved for merge after live browser smoke per plan §13.I.**

The BLOCKING contradictions reported by the user are fixed by structural change (TrainingDecision SoT) plus targeted patches to three engines, with full backward compatibility preserved (all 5728 pre-existing tests still pass; 17 new tests added). The architectural foundation is in place for follow-up PRs to complete the full signal-narrowing of the remaining 14 legacy engines and the static import-boundary guards documented in the plan. No data-safety boundaries crossed; no schema changes; no new dependencies; no PWA / sync regressions.
