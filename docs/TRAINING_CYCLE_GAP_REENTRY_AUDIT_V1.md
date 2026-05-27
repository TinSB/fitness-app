# Training Cycle Gap Auto Re-entry State Machine V1 — Audit

## 1. Executive summary

用户停训 14+ 天后，IronPath 仍把"减量周"作为 active 状态展示并按减量周输出训练推荐。
本次改动新建一个**纯运行时派生**的 `effectiveTrainingPhaseEngine`，把"用户当前实际处于的训练阶段"
从计划本身的 `mesocyclePlan.weeks[i].phase` 中解耦出来。

UX 采用 **automation-first**：系统自动计算并直接应用 `activePhase`，
UI 只显示一个紧凑标签（例：`回归周`、`重新开始`）；不显示"原计划阶段 vs 当前建议"对照、
不显示长说明、不需要手动 apply 按钮。

修复**不触及** AppData / localStorage / cloud sync / history / schemaVersion。

## 2. User-reported bug

- 14+ 天没训练，回来后 Today / Plan / 推荐链路仍然把上一个 mesocycle 周（"减量周"）当作 active 状态。
- 推荐引擎按减量周的训练量倍率推荐，不符合长间隔后应保守恢复的预期。
- 用户期望：app 自动识别长间隔，直接把当前阶段切换到合适的 re-entry 状态，无需手动操作。

## 3. Root cause

`getCurrentMesocycleWeek(mesocyclePlan)` 仅按 `mesocyclePlan.startDate` 线性算当前周序号，
**完全不感知"距离上次训练的天数"**。所有 UI（[TodayView](src/features/TodayView.tsx)、
[PlanView](src/features/PlanView.tsx)、[ProgressView](src/features/ProgressView.tsx)）
与推荐引擎（[supportPlanEngine](src/engines/supportPlanEngine.ts)、
[exercisePrescriptionEngine](src/engines/exercisePrescriptionEngine.ts)）都直接消费
`mesocycleWeek.phase`，于是停训前停在"减量周"的用户在长 gap 后看到的仍是减量周。

## 4. Whether the old time/gap state machine existed

存在但未 wire 到 phase 选择。

[src/engines/trainingLapseEngine.ts:423](src/engines/trainingLapseEngine.ts:423) 的
`buildTrainingLapseSignal` 实现了完整的 5-stage gap 状态机
（`fresh / normal / lapsed / long_lapsed / dormant`）+ 半衰期保留率 + 旋转提示。
但它只用于"减衰 / 旋转重置 / 校准重置"等内部信号，**不参与**当前阶段的选择/展示。

## 5. Whether it was wired into app surfaces

没有。本次新建 `effectiveTrainingPhaseEngine` 后，把以下 surface 改为消费派生的 `effectiveWeek` + `activePhase`：

- [src/features/TodayView.tsx](src/features/TodayView.tsx)
- [src/features/PlanView.tsx](src/features/PlanView.tsx)
- [src/features/ProgressView.tsx](src/features/ProgressView.tsx)
- [src/presenters/planPresenter.ts](src/presenters/planPresenter.ts)
- [src/engines/supportPlanEngine.ts](src/engines/supportPlanEngine.ts)（`buildSupportPlan` + `buildWeeklyPrescription`）
- [src/engines/exercisePrescriptionEngine.ts](src/engines/exercisePrescriptionEngine.ts)（`applyStatusRules`）

## 6. Search terms used

仓库全文搜索覆盖：

```
基础周, 构建周, 过载周, 减量周
deload, base, build, overload, overreach, mesocycle, cycle, phase
weeklyPhase, cyclePhase, trainingPhase, planWeek, week, training week
calendar, lastWorkout, lastSession, lastTraining, daysSinceLastSession
readiness, detraining, re-entry, reentry, restart, state machine
recommendation, weeklySuggestion, focus, history, AppData, localStorage, cloudSync
getCurrentMesocycleWeek, trainingLapseEngine, lapseSignal, formatCyclePhase
effectivePhase, activePhase
```

工具：`rg` / `git grep`，范围 `src/`、`tests/`、`docs/`、`scripts/`。

## 7. Files inspected (non-exhaustive)

- `src/models/training-model.ts` — `CyclePhase = base | build | overload | deload`、`MesocyclePlan`、`MesocycleWeek`
- `src/engines/mesocycleEngine.ts` — `getCurrentMesocycleWeek`、`createMesocyclePlan`、`sanitizeMesocyclePlan`
- `src/engines/trainingLapseEngine.ts` — 已有 gap 状态机
- `src/i18n/terms.ts`、`src/i18n/formatters.ts` — phase 标签与格式化
- `src/features/TodayView.tsx` / `PlanView.tsx` / `ProgressView.tsx`
- `src/presenters/planPresenter.ts`
- `src/engines/supportPlanEngine.ts`、`src/engines/exercisePrescriptionEngine.ts`
- `src/engines/adaptiveFeedbackEngine.ts` — 自适应 deload 决策（已独立计算，无需改）
- `src/cloudProduction/*`、`src/storage/*` — 数据安全边界（无影响）

## 8. Multi-agent findings

- **Root Cause Agent**：UI / 推荐引擎都直接读 `getCurrentMesocycleWeek().phase`；`trainingLapseEngine` 已有 gap signal 但未 wire 进 phase 选择。
- **Architecture Impact Agent**：phase 字段的 owner 在 `mesocycleEngine` 与 `mesocyclePlan.weeks[]`；所有 consumer 集中在前述 6 个文件。
- **UI Integration Agent**：phase 文案集中在 `i18n/terms.ts:PHASE_LABELS`、`i18n/formatters.ts:formatCyclePhase`；显示位置在 TodayView / PlanView / ProgressView。
- **Data Safety Agent**：纯运行时派生方案可行，零 schema 改动，零 localStorage / cloud sync 影响。
- **Recommendation Engine Agent**：仅 `supportPlanEngine` 与 `exercisePrescriptionEngine` 直接消费 phase；`buildAdaptiveDeloadDecision` 已独立。
- **Regression Agent**：定义了 0-3 / 4-7 / 8-13 / 14+ / 28+ 天 gap + 无历史 + cloud restore + persistedPhase 各组合的回归矩阵。

## 9. New active phase rules

| gap | activePhase | overridden | effectiveWeek 参数 | UI |
|---|---|---|---|---|
| 0-3 天 | persisted | false | persistedWeek（reference 相同对象） | 显示原 phase |
| 4-7 天 | persisted | false | persistedWeek | 显示原 phase（内部 severity=mild） |
| 8-13 天 + overload/deload | `reentry` | true | `{ phase: 'base', volume: 0.75, bias: 'conservative' }` | 显示 `回归周` |
| 8-13 天 + base/build | persisted | false | persistedWeek（severity=reentry） | 显示原 phase |
| 14-27 天 | `reentry` | true | `{ phase: 'base', volume: 0.65, bias: 'conservative' }` | 显示 `回归周` |
| 28+ 天 | `restart` | true | `{ phase: 'base', volume: 0.5, bias: 'conservative' }` | 显示 `重新开始` |
| 无历史 | persisted | false | persistedWeek | safe default |

## 10. Automation-first behavior

- 系统直接计算并应用 `activePhase`，UI 只显示紧凑标签
- **不显示**：原计划阶段 / 当前建议 / 已停练约 X 天 / 长说明 / 手动 apply 按钮
- `compactLabel` 限制在 4 字以内：`基础周 / 构建周 / 过载周 / 减量周 / 回归周 / 重新开始`
- 推荐引擎自动消费 `effectiveWeek`：reentry/restart 时 `phase` 字段降为 `'base'`，下游进入保守路径
- `phaseForCompatibility` 字段供必须落到 4-phase CyclePhase 的下游字段（如 `ExercisePrescription.mesocyclePhase`）

## 11. Changed files

新增：
- `src/engines/effectiveTrainingPhaseEngine.ts`
- `tests/trainingPhaseEffectiveMapping.test.ts`
- `tests/trainingPhaseGapWiringRecommendation.test.ts`
- `docs/TRAINING_CYCLE_GAP_REENTRY_AUDIT_V1.md`（本文档）

修改：
- `src/i18n/terms.ts` — 增加 `EFFECTIVE_PHASE_DISPLAY_LABELS`
- `src/i18n/formatters.ts` — 增加 `formatEffectivePhase`
- `src/features/TodayView.tsx` — 显示用 `compactLabel`；移除原 advisory 横幅
- `src/features/PlanView.tsx` — 当前周/阶段卡片 + 时间线当前 cell 用 `compactLabel`；其他未来周保留原 plan
- `src/features/ProgressView.tsx` — `mesocycleWeek` 改为消费 `effectiveWeek`
- `src/presenters/planPresenter.ts` — `phaseLabel` 用 `compactLabel`
- `src/engines/supportPlanEngine.ts` — `buildSupportPlan` + `buildWeeklyPrescription` 内部用 `effectiveWeek`
- `src/engines/exercisePrescriptionEngine.ts` — `applyStatusRules` 内部用 `effectiveWeek`，文案换为紧凑 "回归周/重新开始"
- `tests/recommendationConsistency.test.ts` / `tests/recommendationDiffEngine.test.ts` — 把硬编码 history 日期改为相对今天的近期日期（避免无意触发 gap 派生，使测试聚焦于原意"跨肌群不泄漏"）

完全没动：
- AppData schema（`schemaVersion` 不变）
- `STORAGE_VERSION` 与 localStorage key
- cloud sync / parity check / backup / restore 链路
- TrainingSession history 数据
- `mesocyclePlan.weeks[].phase` 持久化值（persistedPhase 完全保留）

## 12. Tests added

- `tests/trainingPhaseEffectiveMapping.test.ts`（20 个测试）
  - 0-3/4-7/8-13/14-27/28+ 天 gap 全覆盖
  - 8-13 天 + overload/deload → reentry
  - 8-13 天 + base/build → 保持
  - 14+ 天 + 任意 persisted → reentry
  - 28+ 天 → restart
  - 无历史 / mesocyclePlan=null safe default
  - **automation-first 约束**：`compactLabel ≤ 4 字`、helper return 不含"原计划阶段"/"当前建议"/"已停练约 X 天"
  - `effectiveWeek` 引用稳定性（短 gap 时与 persistedWeek 同对象）
  - 数据安全（不变 mesocyclePlan、不变 history）
- `tests/trainingPhaseGapWiringRecommendation.test.ts`（10 个测试）
  - `applyStatusRules` 14d gap + deload → 不再标记为 active deload，文案换 "回归周"，无 advisory
  - `applyStatusRules` 28+d gap → "重新开始" 紧凑文案
  - `buildWeeklyPrescription` 14d gap → muscle target 下降，rationale 不含 "过载周/原计划阶段/已停练"
  - `buildSupportPlan` 14d gap + deload → 不触发 deload-trim
  - `buildPlanViewModel` 14d gap + deload → `phaseLabel` 含"回归周"不含"减量周"，整 vm 不含禁止文案
  - 短 gap 保持 persisted 行为
  - 无历史 safe default
  - 数据安全（AppData 不被 mutate）

## 13. Browser smoke result

dev 环境（Vite + Chrome via Claude Preview）种子：
- `mesocyclePlan.startDate = today - 22d`（落在 `weekIndex=3 = deload`）
- `history = [{ date: today - 14d }]`

Plan / "计划调整" 显示（screenshot 已保存）：
- 当前周：第 4 周
- 阶段：**回归周**（不再是减量周）
- 容量/强度：**65% / 保守**
- 周期时间线第 4 cell 自动显示 "回归周 · 65% · 保守"
- **没有任何**"当前建议 / 原计划阶段 / 已停练约 X 天"文字
- **没有**手动 apply / 确认按钮
- 推荐区："推 A 建议保守执行，不主动加量或冲重量"
- 无 console error

短 gap (2d) 对照：
- 阶段：**减量周**（按 persisted 保持）
- 无禁止文案、无回归周字样

## 14. iPhone / PWA smoke result

未单独跑 iPhone / PWA：本次改动只是字符串文案 + 数据派生层调整，
没有引入 PWA 专属逻辑、没有改 Service Worker、没有改 manifest，
所以 PWA 与 Web 共享同一份 React 组件树。

如果用户后续在 iPhone 上看到不一致，请回退该 PR，因为这意味着 PWA 在持久 cache 中
冷藏了旧的 mesocyclePlan 渲染产物 —— 但本次修复是纯派生的，重新加载页面或 update PWA
即可生效。

## 15. Data safety findings

- ✅ `AppData.mesocyclePlan` 不被修改（含 `weeks[i].phase`，即 persistedPhase）
- ✅ `AppData.history` 不被修改（无任何 splice / 覆盖）
- ✅ `STORAGE_VERSION` / `schemaVersion` 不变
- ✅ 无新增 localStorage key
- ✅ Cloud sync / parity check 字段范围不变（`buildAppDataSnapshotHash` 入参不变）
- ✅ Backup / restore / dry-run 不受影响
- ✅ 无敏感字段输出（token / env / service-role / cookie / 原 AppData）
- ✅ 无新增 SaaS / team / billing / admin / social 功能
- ✅ `pnpm-lock.yaml` 不存在；`package.json` / `package-lock.json` 无 diff

## 16. Remaining risks

- 当 `mesocyclePlan.startDate` 与 wall clock 时区抖动一天（极端情况），可能在 weekIndex 与 gapDays 上出现 ±1 day 偏差。当前 `parseDateMillis` 把 `YYYY-MM-DD` 锚定到 UTC 12:00，把误差压到 ≤12 小时 —— 不会在 14-day 阈值附近翻转。
- Cloud restore 一份 30 天前的 AppData，本地无 history 时，effectivePhase 仍按"无历史"safe default 处理。这是符合预期的（系统不知道用户在 cloud 期间是否训练过），但用户主观感受可能是 "我刚 restore 完为啥还是减量周"。后续可考虑在 cloud restore 完成时显示一次性 toast。
- `recommendationConsistency.test.ts` / `recommendationDiffEngine.test.ts` 把硬编码 history 日期改为相对今天 —— 维护测试时如果再硬编码 30+ 天前的日期，会被这个修复"间接影响"。已在测试注释中说明。

## 17. Final verdict

修复完成，所有验证通过：

- `npx tsc --noEmit` ✅
- `npm test` ✅ 1332 文件 / 5728 测试全部通过
- `npm run build` ✅
- `npm run api:dev:build` ✅
- `node scripts/scan-production-dist-safety.mjs` ✅ 21 files scanned, passed
- `git diff -- package.json package-lock.json yarn.lock pnpm-lock.yaml` ✅ 空
- `test ! -e pnpm-lock.yaml` ✅
- `git diff --check` ✅ 空
- 浏览器 smoke ✅
- automation-first 约束 ✅（UI 无 advisory 横幅，无原计划阶段/当前建议/已停练，无手动 apply）
