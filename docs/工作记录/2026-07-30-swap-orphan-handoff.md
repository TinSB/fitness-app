# 交接件：换动作中途已完成组孤儿化核实与修复（FR-TR6 落盘完整性）

> 日期：2026-07-30 ｜ 来源：FR-TR14 S2 批验收（#720）reducer lens 范围外发现，owner 点芯片立项
> 性质：**先核实后修复**——main 既有疑点，可能证实（数据丢失级缺陷）也可能证伪
> 执行：Codex（专家档 gpt-5.6-sol + ultra）｜验收：Claude 主会话
> 分支：`codex/0730-swap-orphan`（基线最新 origin/main `b91a615`，含刚合并的 #720）

## 疑点原文（验收 agent 的观察，未经复现确认）

`TrainFlowState.replaceCurrentExercise` 没有「当前动作无已完成事实」守卫；`CompletedSessionBuilder` 按 `exercisePlan.exerciseId` 关联 observations。动作内已记组后换动作 → plan 里旧 id 被新 id 替换 → 旧 id 的 observations 可能在落盘时成为孤儿（用户练了的组消失在历史里）。

## 第一步：复现核实（必须先做，结论决定后续）

写复现测试：已完成 2 组（旧动作 id 下 logSet ×2）→ `replaceExercise` → 完成/结束会话 → 检查落盘 storage：
- 旧动作的 2 组 observations 落在哪（旧 id 元素？新 id 元素？丢失？）；
- `completedInCurrentExercise` 计数与新动作组进度的关系（换后显示第几组）；
- skippedSets 的 finalId 映射（:69）在此场景的行为；
- 同时检查「换动作 → 已有事实」在 UI 上是否真实可达（more sheet 换动作行的可达性）。

**若证伪**（事实完整落盘、归属正确）：停止，不改代码；把核实结论与测试（转为回归锁）写回本文件与系统逻辑对应段，作为「已核实无缺陷」记录。

## 若证实——裁定：拆分落盘（不禁止换动作）

不选「禁止已有事实时换动作」：练到第 2 组器械被占/疼痛正是换动作的真实场景（FR-TR6 用户故事原文），禁掉伤用户。裁定细则：

1. **事实按发生时的动作归属**：换动作时已有完成/跳过组 → 旧动作以其已发生事实落盘为独立 exercises 元素（observations、skips、painFlag 全随旧 id 如实落盘）；新动作为独立元素从第 1 组开始。
2. **剩余量守恒**：新动作组数 = 原计划组数 − 旧动作已完成/已跳过组数，下限 1 组；目标重量沿既有 replace 重算语义（external 沿用/assisted 重置/自重归 0）。
3. **replacements 审计关系保留**（originalExerciseId → actualExerciseId），供 FR-TR6 收据句与统计追溯；拆分后的两个元素如何标注关系由你定（open-bag，不 bump schema），回执写明。
4. **UI**：进度「动作 N/M」不变（同一 slot）；组指示从新动作第 1 组起。零弹窗零说教。
5. **下游诚实**：旧动作的完成组进统计/MLE/引擎 lastPerformance 一切照常（真实事实）；疼痛信号窗口按各自动作 id 判定不混淆。
6. **零事实换动作路径行为不变**（现行为即正确），golden 锁定。

## 红线

1. ⛔ 已落盘历史不迁移不清洗（修复只影响新落盘）。
2. ⛔ 处方引擎、轮转、verdict、疼痛保守态判定逻辑零改动（它们消费落盘事实，事实变完整是修复的目的而非引擎语义变更）。
3. ⛔ 不 bump schema；落盘只加 open-bag 字段（若需标注拆分关系）。
4. ⛔ FR-TR6 只换这次/以后都换 的范围语义不动；draft 恢复必须覆盖「换前已有事实」场景（杀进程重开归属依旧正确）。
5. 版本号不动；不 push、不开 PR。

## 验收标准（owner 大白话）

1. 卧推练了 2 组，器械被占换成哑铃卧推 → 练完看历史：卧推 2 组在、哑铃卧推的组也在，谁都没丢
2. 换完的动作从第 1 组开始，总量不凭空多也不凭空少
3. 一组没练就换动作 → 和以前一模一样
4. 换动作后强杀 App 重开 → 两边的组都还在

## 验证与证据

1. 复现测试（RED 证实或直接 GREEN 证伪）→ 若证实：拆分落盘 TDD、剩余量守恒边界（2/3 换、3/3 完成后换不可达?、跳过+完成混合）、draft 恢复、疼痛/skip 归属。
2. golden 零回归：零事实换动作 + 不换动作路径落盘逐字节等价现状（origin/main 冻结基线）。
3. canonical 实证：模拟器实走「2 组后换动作」落盘实读。
4. 实拍（前缀 `2026-07-30-swaporphan-`）：换后动作卡（第 1 组起）+ 历史里两个动作各自的组。
5. 门禁 exit 0；规格写回：系统逻辑 §6.1（换动作落盘语义）、写入合同、PRD FR-TR6 状态注、CHANGELOG/DEV_LOG；TestFlight 清单补验法。

## Git 纪律

`git fetch` 后从 `origin/main` 拉 `codex/0730-swap-orphan`；commit 前 `git status`；明确 pathspec 禁 `-A`；核实/修复/文档分步提交。

## 停止条件

- **证伪即停**（如实回报，转回归锁）。
- 拆分落盘与 CompletedSessionBuilder/clean 层/统计任何既有对账冲突、或发现「以后都换」范围语义被牵动 → 停下回报，不自行改裁定。
- 同一问题修 3 次不过即停。

## 实施回执模板（收尾必填回填本文件末尾）

```
## 核实结论
- [证实/证伪 + 复现测试输出关键行]
## 实施回执（若证实）
- 分支与 commit 清单 / 拆分落盘实现 / 剩余量守恒 / draft 恢复 / golden / 规格写回 / gate / 实拍 / 未尽事项
```

## 核实结论

- **证实。** 在生产代码未改时先运行 `cd ios/packages/RedeTrainingDecision && swift test --filter CompletedSessionBuilderTests.testMidExerciseReplacement`，exit `1`，2 项测试出现 10 个断言失败：换后期望 `1/1`、实际仍为 `3/3`；完成历史期望动作 id 为 `[bench-press, db-bench-press]`、实际只有 `[db-bench-press]`；旧卧推元素无法 unwrap；完成+跳过混合场景的 skip 实际被记到 `db-bench-press`，期望 `bench-press`。因此不是证伪路径，复现锁先以 `f181281` 独立提交。
- UI 可达性也证实：正式组 `activeSet` 完成两组并结束休息后，「更多」仍提供「换一个动作」，可以直接从平板卧推换成哑铃卧推；不是只有测试能构造的状态。
- 根因是 `replaceCurrentExercise` 把同一 slot 的最终 plan id 原地替换，而旧 `CompletedSessionBuilder` 只遍历最终 `plan.exercises` 再按 id 找 observations / skips；换前事实因此从最终 plan 失联，skip 还会被重映射到替代动作。既有 canonical writer 只是忠实 append builder 结果，不是根因。

## 实施回执（若证实）

- **分支与 commit**：`codex/0730-swap-orphan`，基线 `origin/main@b91a615`；交接件 `76708fd`，RED 回归锁 `f181281`，核心修复 `c33a86a`，规格与本回执由本次收尾提交承载。提交前均检查 `git status`，只用明确 pathspec 暂存；未使用 `git add -A`。
- **拆分落盘**：`TrainFlowState` 按事件发生顺序维护内部 exercise fact segments，完成、跳过和 `painFlag` 永远留在发生时的 id；`CompletedSessionBuilder` 按 segment occurrence 顺序组装历史，不再按最终 plan 聚合。换前旧动作与换后新动作分别进入 `exercises[]`；open-bag `originalExerciseId` / `actualExerciseId` / `replacementRole`（`original` / `actual`）标记两边，同一中间 occurrence 同时承接两次替换时用 `replacementLinks[]` 保全入/出两条关系。A→B→A 以三段顺序落盘；只有同 id 真正出现多个落盘 occurrence 时，record/set id 才加 `-occurrence-N`。
- **剩余量守恒与 UI**：有事实换动作时，新动作剩余组数为 `max(1, 原计划组数 − 已完成/已跳过数)`，组索引从 1 重排；existing external / assisted / bodyweight 重量变换原样复用。动作 slot 与「动作 N/M」不变；`overallSetTotal` 把已封存旧 occurrence 事实计入分母，避免进度凭空跳动。2/3 换得到新动作 1/1；3/3 后换按裁定最低仍给 1 组。
- **draft 恢复与换序组合**：draft 格式、版本与 source of truth 未变，仍只编码 typed events；重放会重建相同 segments、替换关系与总量。另加回归覆盖换后把该动作通过 FR-TR14「现在练」移后再练，延迟替换上下文仍会在实际 occurrence 出现时消费；连续零事实替换会清掉陈旧中间上下文。
- **golden 与边界**：零事实换动作继续只落替代动作，不新增 `replacementRole`，既有字节 fixture 保持；完全不换动作路径同样保持 origin-main frozen bytes。完成+跳过混合、疼痛归属、A→B→A、重复 id、最低 1 组、draft 编码恢复与进度守恒均有直接测试。既有历史未迁移、未清洗；schema、版本、`Package.swift`、`project.pbxproj` 均未改，处方引擎、轮转、verdict、自动进阶、疼痛保守态及「只换这次 / 以后都换」范围语义零改动。
- **测试与 gate**：修复后的 `RedeTrainingDecision` 为 473/473；仓库根权威 `.claude/quality-gate.cmd` exit `0`，10 个 Swift 包合计 1,140/1,140，App 宿主 54/54（`SessionStoreDraftTests` 33、`AppUpdateRuntimeTests` 13、`StoreKitEntitlementsTests` 8），通用 Simulator `BUILD SUCCEEDED`，尾部为 `TEST SUCCEEDED` / `QUALITY GATE: PASS`。`git diff --check` 与 `git diff --check origin/main` 均 exit `0`；retired Web 扫描确认没有根 `package.json`、Vite 配置或 Web `src/` runtime。
- **真实 Simulator / canonical**：在隔离的 `Rede SwapOrphan 20260730`（iPhone 17 Pro / iOS 26.5）安装本分支 build，以最小 canonical 配置开训。平板卧推完成 2/3 后经「更多 → 换一个动作 → 哑铃卧推」，AX 实读为「动作 1/6 · 第 1/1 组」。强制终止 App 后重开，今日页出现「继续进行中的训练？上次训练没有完成，已完成的组都还在」；继续并跳过重新派生的替代动作热身后，仍为哑铃卧推 1/1。完成保存后，进展历史详情显示平板卧推第 1、2 组及哑铃卧推第 1 组。canonical 最新完成场实读为 `bench-press:2:[1,2]:original` 与 `db-bench-press:1:[1]:actual`，布尔断言命令 exit `0`、输出 `true`。
- **实拍**：`.ai-tmp/swap-orphan/2026-07-30-swaporphan-after-swap-first-set.png`（MD5 `51493bf0d51a33c054738fc85c0034e6`）记录换后哑铃卧推第 1/1 组；`.ai-tmp/swap-orphan/2026-07-30-swaporphan-history-both-exercises.png`（MD5 `3ab67b181f881a33a0d980a86cd96f80`）记录历史里平板卧推 2 组与哑铃卧推 1 组。
- **规格写回**：已同步 `docs/REDE_iOS_SYSTEM_LOGIC.md` §5 / §6.0.2 / §6.1、`docs/REDE_PRD.md` FR-TR6、`CHANGELOG.md`、`DEV_LOG.md`，并在 TestFlight 清单新增 N15 真机复验法；Master 边界与写入路径没有改变，所以未改 Master。
- **未尽事项**：本批专用 Simulator 已完成代码可验证的 UI、强杀恢复、历史与 canonical 验收，但独立终审随后触发下述两项 P1 红线；因此本回执只证明 orphan 修复局部行为成立，不构成可交付结论。未 push、未开 PR。

## 回报段（触红线后停止，2026-07-30）

- **当前结论：NO-GO，已停止生产代码修改。** occurrence 拆分本身通过测试与真实落盘，但它与两个既有下游对 `session.exercises` 的单元素假设冲突。交接件明确规定“拆分落盘与 clean / 统计既有对账冲突即停”及“处方引擎、疼痛保守态判定逻辑零改动”；继续自行兼容会直接越过红线。
- **P1-1 — sticky 会粘回换前动作。** 新 builder 在 `CompletedSessionBuilder.swift:29-34` 按事实发生顺序落 `[bench-press, db-bench-press]`。`TodayPrescriptionEngine.lastActualByPattern` 在 `TodayPrescriptionEngine.swift:1199-1207` 先按最新场排序、再在场内正序遍历，并以该 movement pattern 的第一个 id 锁定结果。因此下一次同 pattern 处方会取 `bench-press`，而修复前该场只有 `db-bench-press`，sticky 会正确保留换入动作。局部 builder tests 与完整 gate 没有 builder → DataHealth clean → `plan()` 的跨层场景，所以未发现这项语义回归。
- **P1-2 — A→B→A 可能提前解除疼痛保守态。** DataHealth 在 `CleanAppDataViewBuilder.swift:121-169` 保序保留同 id 多 occurrence。`painDiscomfortIsActive` 在 `TodayPrescriptionEngine.swift:113-117` 用 `session.exercises.contains` 判断正常完成：同场只要任一 A occurrence 有组且无 `painFlag` 就返回 true。拆分后若一个 A occurrence 带 pain、另一个 A occurrence 无 pain，active 状态可能被当场清除；修复前同 id sets 聚合在一个 exercise 元素中，任一 painFlag 会阻止该场成为正常恢复。这改变了既有疼痛判定，正中红线。
- **需要 owner 新裁定后才能继续。** 必须明确授权其中一种边界：允许一个窄的下游兼容批（sticky 按场内最后 occurrence；疼痛恢复先按同场同 id 聚合全部 sets 再判断），并新增两条 builder → clean → plan RED 集成回归；或改订 occurrence 的 canonical 表示/顺序合同以保持现有消费者语义。当前实施方不选择方案、不改判定。
- **分支状态**：`f181281` RED 锁与 `c33a86a` 局部修复提交保留作复现和方案输入；它们不是合并建议。规格已标注 NO-GO，TestFlight N15 暂不进入发布验收。独立审查在确认这两项 P1 后按停止纪律终止，未声称对其余组合完成穷尽式放行。
