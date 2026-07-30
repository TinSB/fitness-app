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

> **后续 owner 立法解释（取代红线 2 的逐字面理解，原文保留作开工历史）**：这里的“引擎零改动”意图是**无拆分历史的用户可见引擎行为不变**，不是禁止为 occurrence 事实补语义解读代码。owner 后续明确授权 sticky replacement-chain 代表与疼痛同 id sets 聚合；轮转、verdict、自动均衡、相对力量、周口径和进阶阈值仍严格零改动。最终裁定见本文件末尾。

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
5. 门禁 exit 0；规格写回：系统逻辑 §5 / §6.0.1 / §6.0.2 / §6.1（occurrence 与换动作落盘语义）、写入合同、PRD FR-TR6 / FR-TR7 状态注、CHANGELOG/DEV_LOG；TestFlight 清单补验法。

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

- **分支与 commit**：`codex/0730-swap-orphan`，基线 `origin/main@b91a615`。提交链按发生顺序为：`76708fd` 交接件；`f181281` 原始孤儿化 RED；`c33a86a` 拆分落盘；`ff4a77b` 第一次停线；`0893fdb` occurrence 消费 RED；`ab16e9d` 第一版窄兼容；`bd69587` 阶段性规格回写；`0757ab2` 1 MAJOR + 4 MINOR RED；`2a94bf7` 零事实中转 RED；`89fb087` 第二次停线；`74a2fd7` 多跳/skip-only RED；`6fb16fd` 第三次停线；`58419f1` findings 候选 GREEN；`0fa53d8` removed-terminal 身份泄漏 RED；`96067f6` 第四次停线；`a74b142` 最终 owner 口径断言；`cc7fed4` 链溶解与精确 Undo；`9f4e632` 普通移除旧 Undo 探针；`8bbc842` 已取消链复活的有效 RED；`1706e81` occurrence 生命周期 GREEN；规格与最终回执由本次收尾提交承载。每次提交前均检查 `git status`，只用明确 pathspec 暂存；未使用 `git add -A`。
- **拆分落盘**：`TrainFlowState` 按事件发生顺序维护内部 exercise fact segments，完成、跳过和 `painFlag` 永远留在发生时的 id；`CompletedSessionBuilder` 按 segment occurrence 顺序组装历史，不再按最终 plan 聚合。换前旧动作与换后新动作分别进入 `exercises[]`；open-bag `originalExerciseId` / `actualExerciseId` / `replacementRole`（`original` / `actual`）及 `replacementLinks[]` 标记可唯一配对的替换边。已有事实后的 split 上下文可跨任意零事实 hop，把 sealed 根直接连到最终有事实 terminal；中转动作不造元素。A→B→A 的真实三段仍按顺序落盘；只有同 id 真正出现多个落盘 occurrence 时，record/set id 才加 `-occurrence-N`。
- **剩余量守恒与 UI**：有事实换动作时，新动作剩余组数为 `max(1, 原计划组数 − 已完成/已跳过数)`，组索引从 1 重排；existing external / assisted / bodyweight 重量变换原样复用。动作 slot 与「动作 N/M」不变；`overallSetTotal` 把已封存旧 occurrence 事实计入分母，避免进度凭空跳动。2/3 换得到新动作 1/1；正常 3/3 已进入 resting/summary，replacement guard 会拒绝，`max(1)` 只是防脏 draft / 未来组合的防御下限，不冒充可达用户行为。
- **draft 恢复与换序/移除组合**：draft 格式、版本与 source of truth 未变，仍只编码 typed events；重放会重建相同 segments、直接 root→terminal link、总量和仅事件派生的同 id 生命周期代次。换后把 terminal 通过 FR-TR14「现在练」移后再练，split 上下文仍在真实 occurrence 出现时消费；零事实中转只传递上下文，不生成中间元素。移除 pending terminal 会同步摘下 pending 与 sealed-root link；只有原 removal 的精确 LIFO Undo 可恢复，普通同 id add/replacement 新生命周期会永久令旧 Undo fail-closed。
- **golden 与消费边界**：独立零事实换动作继续只落替代动作，不新增 `replacementRole`，既有单 hop / 多 hop 字节 fixture 保持；完全不换动作路径同样保持 origin-main frozen bytes。完成+跳过混合、疼痛归属、A→B→A、多跳、skip-only actual、重复 id、最低 1 组、draft 编码恢复、移除/撤销与进度守恒均有直接测试。sticky 从第一版裸 `reversed()` 改为原序 replacement-chain 代表：链终点 actual 占链首位置，非链/加练代表自身，再取 pattern 第一代表；这才同时满足换动作记忆与旧同 pattern 加练的“第一个”语义。疼痛恢复聚合同场同 id sets；rowStatuses 只读当前 occurrence；Rail 过滤空 occurrence；练完动作数与进展柱按非空 sets 的唯一 id 聚合。单 occurrence 完整 `TodayPrescription` 对象及 sorted JSON 编码等价。既有历史未迁移、未清洗；schema、版本、`Package.swift`、`project.pbxproj` 均未改；轮转、verdict、自动均衡、相对力量、周口径、进阶阈值及「只换这次 / 以后都换」范围语义均未动。
- **测试与 gate**：聚焦 occurrence 集成 12/12；最终 `RedeTrainingDecision` 490/490（其中 `TrainFlowReducerTests` 29/29）。仓库根权威 `.claude/quality-gate.cmd` exit `0`，10 个 Swift 包全过，App 宿主 58/58（`SessionStoreDraftTests` 37、`AppUpdateRuntimeTests` 13、`StoreKitEntitlementsTests` 8），通用 Simulator `BUILD SUCCEEDED`，尾部为 `TEST SUCCEEDED` / `QUALITY GATE: PASS`。独立复审确认原 P2 已关闭且没有新的 P0–P2。SwiftPM 仍有既有 fixture resource 声明 warning，不影响测试结果。
- **阶段性真实 Simulator / canonical（证明事实拆分核心）**：在隔离的 `Rede SwapOrphan 20260730`（iPhone 17 Pro / iOS 26.5）安装当时分支 build，以最小 canonical 配置开训。平板卧推完成 2/3 后经「更多 → 换一个动作 → 哑铃卧推」，AX 实读为「动作 1/6 · 第 1/1 组」。强制终止 App 后重开，今日页出现「继续进行中的训练？上次训练没有完成，已完成的组都还在」；当时 build 会重新派生替代动作热身，人工跳过后仍为哑铃卧推 1/1。完成保存后，进展历史详情显示平板卧推第 1、2 组及哑铃卧推第 1 组；canonical 最新完成场实读为 `bench-press:2:[1,2]:original` 与 `db-bench-press:1:[1]:actual`，布尔断言命令 exit `0`、输出 `true`。**热身重开这一阶段行为已被后续 owner 裁定取代**：最终 fact-bearing split 不得重开热身，现由多跳 reducer/draft/App-hosted 回归和最终 gate 锁定；仍待 N15 真机复验，不能拿本张早期实拍冒充最终热身验收。
- **实拍**：`.ai-tmp/swap-orphan/2026-07-30-swaporphan-after-swap-first-set.png`（MD5 `51493bf0d51a33c054738fc85c0034e6`）记录换后哑铃卧推第 1/1 组；`.ai-tmp/swap-orphan/2026-07-30-swaporphan-history-both-exercises.png`（MD5 `3ab67b181f881a33a0d980a86cd96f80`）记录历史里平板卧推 2 组与哑铃卧推 1 组。
- **规格写回**：已同步 `docs/REDE_iOS_SYSTEM_LOGIC.md` §5 / §6.0.1 / §6.0.2 / §6.0.3 / §6.1、`docs/REDE_PRD.md` FR-TR6 / FR-TR7 / FR-TR14、`CHANGELOG.md`、`DEV_LOG.md`，并扩充 TestFlight N15 多跳、skip-only、移除/撤销与 same-id ad-hoc 真机复验法；Master 边界与写入路径没有改变，所以未改 Master。
- **未尽事项**：五次停线均已按 owner 裁定闭合，本地 GO 已恢复；TestFlight N15 恢复进入发布验收但尚未在 TestFlight 真机打勾。数据质量提示在同场同 id 多 occurrence 时可能出现重复“第 1 组”定位文案，过滤、计数和引擎结果正确且当前没有逐组修正入口，不构成本批阻断。未 push、未开 PR。

## 回报段（第一次阶段性 GO；后续验收已再次停线并取代此结论，2026-07-30）

- **当时阶段结论：GO；非最终结论。** 实施方先按原红线停止；owner 随后批准方案一“窄下游兼容批”，明确立法意图为“用户可见引擎行为不变”：事实继续按发生时动作归属，消费端按语义聚合，不得扭曲 canonical 去迁就旧的一场一元素假设。后续 1 MAJOR + 4 MINOR 验收证明本段实现口径仍不完整，最终结论见文件末尾。
- **跨层 RED 真实成立。** 在 `c33a86a` 的生产行为上新增 `OccurrenceCompatibilityIntegrationTests`，完整经过 `TrainFlowState → CompletedSessionBuilder → AppData → CleanAppDataViewBuilder → CleanTrainingDecisionInput → TodayPrescriptionEngine.plan()`。`swift test --filter OccurrenceCompatibilityIntegrationTests` exit `1`：sticky 场景实际 `bench-press`、期望 `db-bench-press`；疼痛场景实际 `62.5 / increase / nil`、期望 `60 / hold / painDiscomfort`。同批单 occurrence 完整处方等价测试已先行通过。RED 以 `0893fdb` 独立提交。
- **P1-1 的第一版关闭后来被撤销。** 当时 `lastActualByPattern` 只把场内遍历改为 reverse，确实让最短 `[旧动作, 新动作]` 用例转绿；但它会让同 pattern 临时加练偷 sticky 槽位，不满足旧“第一个”语义。最终实现已撤掉裸 `reversed()`，改为“原序配链、链终点占链首、非链代表自身、取 pattern 第一代表”，见最终回报段。
- **P1-2 已关闭。** `painDiscomfortIsActive` 的状态机、四场窗口、阈值和恢复地板均未改；只把正常完成输入改为同场 filter 同 id 后 flatMap 全部 sets，再要求聚合非空且无任何 `painFlag`。A（带 pain）→B→A（无 pain）不再提前清保守态，集成回归转绿。
- **兼容边界扫描的阶段性判断后来被证伪。** 当时扫描覆盖 `lastPerformance`、临时加动作借重、Today“上次”、verdict RIR、DataHealth、DataQuality、Progress/MLE/分享卡，并误判没有第三个 occurrence 冲突；后续定向验收实际发现 rowStatuses、Rail、完成动作计数、进展柱、零事实中转、skip-only terminal 和 removed-terminal 生命周期缺口。该误判不再作为放行依据。
- **当时 GREEN 与发布状态仅是中间快照。** 聚焦兼容测试 3/3、`RedeTrainingDecision` 476/476、App 宿主 54/54 与当时 gate PASS 后，N15 曾阶段性恢复；随后停线使这些数字失去最终放行地位。最终 490/490、58/58 与权威 gate 见文件末尾。
- **安全与 Git**：没有迁移、清洗或重写任何既有历史；schema、版本、package manifest、`project.pbxproj`、轮转、verdict、自动均衡、相对力量、周口径均未改。提交前均检查 status，明确 pathspec 暂存，未用 `git add -A`；未 push、未开 PR。

## 回报段（历史：验收 findings 定向闭合时再次停线；已由最终回报取代，2026-07-30）

- **当时结论：NO-GO，N15 暂停进入发布验收；非最终状态。** owner 对 1 MAJOR + 4 MINOR 的定向裁定已完成聚焦实现；替换链、瞬态重置、当前 occurrence 行状态、Today「上次」回退、完成动作计数与进展柱聚合的既定用例均已转 GREEN，三个相关包在新增停线复现前分别为 DataHealth 61/61、TrainingDecision 479/479、LocalSnapshot 238/238。但独立审查发现一个未在裁定用例中的合法连续替换序列，命中 owner 写死的“若 `replacementLinks` 数据不足以稳定归组 → 停下回报”。因此未提交 GREEN 实现、未跑最终权威门禁、未把旧 GO/门禁数字改写成新完成事实。
- **停线 RED 已核实并独立提交。** 新回归 `testFactBearingSwapFollowedByZeroFactSwapKeepsChainTerminalAndWarmupGate` 走完整 `TrainFlowState → CompletedSessionBuilder → AppData → CleanAppDataViewBuilder → CleanTrainingDecisionInput → TodayPrescriptionEngine.plan()`：卧推 A 完成 1 组 → 换哑铃卧推 B → B 尚无任何事实立即换史密斯卧推 C → C 完成 1 组。`swift test --filter OccurrenceCompatibilityIntegrationTests.testFactBearingSwapFollowedByZeroFactSwapKeepsChainTerminalAndWarmupGate` exit `1`、1 项测试 2 个断言失败：C 实际重新进入热身（期望不重开）；下一场 horizontal-press sticky 实际为 `bench-press`，期望链终点 `smith-bench-press`。RED 锁 commit：`2a94bf7`。
- **数据为什么不够。** 第一次有事实替换后，A occurrence 保存 `A→B / original`，B 的 pending split 等待它首次产生事实时补 `A→B / actual`。B 尚无事实便再换 C 时，`replaceCurrentExercise` 会移除 B 的 pending split；B 不落 occurrence，C 只继承零事实路径既有的 `B→C` original/actual 两字段且没有 role。最终 canonical 是 `[A, C]`：既没有 B occurrence，也没有把 `A→B` 与 `B→C` 串起来的稳定 `replacementLinks`。消费端无法仅凭当前 occurrence 配对规则可靠证明 A 与 C 是同一条链；同时 `splitsFacts` 丢失令热身门误以为 C 前面没有正式事实。
- **未自行扩大裁定。** 一条审查意见认为同一 occurrence 内 done→skip 应显示 `[done, skipped, active]`；owner 本轮已明确写死 `rowStatuses` 使用 `skippedInCurrentExercise` 且“跳过恒在头部”，所以实施方不采纳该相反语义，也不把它列为阻断。真正阻断仅为连续零事实替换的链数据与热身继承。
- **待 owner 裁定。** 是否授权把“已有 slot 事实”的 split 上下文跨越一个或多个零事实替换继续传递，直到最终实际产生事实的动作，并让该最终 occurrence 获得足以稳定重建完整替换链的 link，同时保持独立的零事实换动作历史逐字节不变？若不授权该传播，请明确连续零事实再次换动作应被禁止，或 sticky/热身应采用何种其它产品语义。裁定前不继续改 reducer/builder/DataHealth/engine，不更新发布 GO。
- **工作树与安全边界。** 前五项 findings 的候选 GREEN 实现仍留在工作树、未提交；新 RED 已单独提交。既有历史未迁移未清洗，schema、版本、package manifest、`project.pbxproj` 均未改；未 push、未开 PR。

## 回报段（历史：方案一获批后的第三形态停线；已由最终回报取代，2026-07-30）

- **当时状态：方案一已收到但尚未落实现，仍为 NO-GO；非最终状态。** owner 已批准 split 上下文跨任意数量的零事实中转 hop 传递；只读设计确认可把 sealed 根 occurrence 与当前终点折叠成一条直接、对称、唯一的 root→terminal link，typed events 保留中转操作，builder 不生成 B/C 元素，独立全零事实路径继续原字节。多跳与 draft RED 已补齐，独立全零事实多跳 frozen JSON 当前即为 GREEN。
- **发现并证实第三形态：最终 actual 只有跳过组。** 最短复现为 A 完成 1 组 → A→B → B 只执行一次 `skipSet` → 提前结束。reducer 把 skip 计入当前 occurrence 事实并为 B 建立 `.actual(A,B)` link；但 `CompletedSessionBuilder` 的保留条件只接受“有 observations”或“skip-only 且带 original role”，因此把 skip-only actual B 整段丢掉。定向跨层测试 `testReplacementTerminalWithOnlySkippedSetStillCarriesActualChainEndpoint` exit `1`：完成场动作实际仅 `[bench-press]`，期望 `[bench-press, db-bench-press]`，actual 端点无法 unwrap。若直接实施多跳传播，A 侧仍会形成悬空 link，消费端无法唯一配对。
- **RED 证据提交。** `74a2fd7` 新增：A→(B)→(C)→D 多跳唯一端点与 sticky RED（1 项 8 个失败）、同序列 draft 重放 RED（1 项 5 个失败）、skip-only actual 端点 RED（1 项 2 个失败），以及独立全零事实 A→B→C terminal-only 完整 JSON 字节 golden（1/1 GREEN）。上一轮 A→(B)→C 停线 RED 仍为 `2a94bf7`。
- **待 owner 精确补充裁定。** 本项目既有定义把完成组与跳过组都计为 slot fact。是否批准：只要最终替代动作产生至少一个 `skipSet`，就允许 builder 保留一个 **sets 为空但有真实顶层 skippedSets 归属**的 actual occurrence，用与 sealed 根端完全一致、role 相反的直接 link 配对；这不是为零事实中转动作造元素，B 是有跳过事实的真实终点。普通无 replacement 的 skip-only 历史与纯零事实替换字节均不改。若不批准，请明确 skip-only 终点不参与 sticky，并说明 sealed 根 link 应如何避免悬空。
- **停线纪律。** 未自行修改 `PendingSegmentReplacement` 或 builder 保留条件；五项 findings 候选 GREEN 仍未提交，最终 gate、规格回写和 N15 GO 均未继续。未迁移历史、未改 schema/版本/manifest/工程文件，未 push、未开 PR。

## 回报段（历史：skip-only 裁定落实现后的第四次停线；已由最终回报取代，2026-07-30）

- **当时结论：NO-GO，N15 再次暂停；非最终状态。** owner 对 skip-only actual 的补充裁定已落实在候选 GREEN `58419f1`：split 上下文可跨任意零事实中转折叠为 sealed root → 最终 actual；最终 actual 若产生 `skipSet`，会以 `sets=[]`、真实顶层 skip 归属和反向 `.actual` link 落盘；普通 skip-only 与纯零事实替换字节保持不变。该提交同时闭合 sticky 链代表、瞬态重置、occurrence 行状态、Today「上次」、完成动作计数与进展柱等已裁定 findings。提交前聚焦 occurrence 集成回归 8/8、三个相关包 484/484 + 61/61 + 238/238、定向 App 回归均为 GREEN；但这些是发现本段阻断前的候选证据，不冒充最终门禁。
- **独立审查发现并由实施方复现的新合法组合。** 最短序列：A=`bench-press` 完成 1 组 → A→B=`db-bench-press` → 把未来动作 X「现在练」到当前（B 因而成为尚无事实的未来动作）→ 通过 FR-TR14 移除未来 B → 再把同 id 的 B 作为临时加练加入并移到当前。`deferredSegmentReplacements` 只按 `exerciseId` 保存，移除 B 时没有摘下其 split pending；新加的 ad-hoc B 因 id 相同，错误消费了旧 A→B 上下文。FR-TR14 临时加练因此冒充 FR-TR6 替换链终点，命中 owner 的“再发现链数据不足的第三形态即停”红线。
- **跨层 RED 已独立提交。** `testRemovedReplacementTerminalCannotLeakItsChainIntoReaddedAdHocOccurrence` 同时走 reducer、draft JSON 编码/重放、builder、DataHealth clean 与下一场 `TodayPrescriptionEngine.plan()`；`swift test --filter OccurrenceCompatibilityIntegrationTests.testRemovedReplacementTerminalCannotLeakItsChainIntoReaddedAdHocOccurrence` exit `1`，1 项测试 5 个失败：直接状态和 draft 重放都错误关闭 B 的热身；B canonical 实际写出 `replacementRole="actual"`（期望 ad-hoc 无 role/link）；clean B 的 replacement links 非空；下一场 horizontal-press 实际 sticky 为 `db-bench-press`，期望仍为链首事实动作 `bench-press`。RED 锁 commit：`0fa53d8`。复现前第一次受限运行只因 SwiftPM/clang cache 无写权限停在 manifest，放开缓存后上述产品 RED 稳定复现；不是环境失败。
- **为什么不能自行补一行清字典。** 若 remove 只删 pending 而不处理 sealed A 上已有的 `.original(A,B)` link，会留下没有 actual 端的悬空链，违反 owner 已写死的“两端必须稳定唯一配对”。若以后执行精确 Undo/`.restore`，又需要恢复原 B 的 pending 与 A 侧 link；但同 id 的 `.addExercise` 明确是新 ad-hoc occurrence，不能获得该身份。这里需要 occurrence 生命周期裁定，不只是消费端兼容：移除是取消整条未完成替换链、暂存可恢复链，还是该 future terminal 根本不允许移除，会改变用户行为和 canonical 事实。
- **待 owner 精确裁定。** 请在以下口径中拍板：①移除携带 split pending 的 future terminal 时，暂时从 active chain 摘下 pending 和 sealed root link；只有同一个 `SessionExerciseRemoval.restoring` 精确撤销才原样恢复，普通同 id `addExercise` 永远是 ad-hoc；若不撤销就完成训练，A 按自身非链事实参与 sticky（建议口径）；②禁止移除携带 split pending 的 future terminal；或③给出其它能同时保证无悬空 link、精确 Undo、ad-hoc 不偷身份的语义。裁定前不修改 reducer/builder/DataHealth/engine，不把该 RED 转 GREEN。
- **门禁与 Git 纪律。** 因新增 RED 属真实 P1，未运行最终 `.claude/quality-gate.cmd`，未回写最终规格数字，未恢复 GO/N15。既有历史未迁移未清洗；schema、版本、package manifest、`project.pbxproj` 均未改。所有提交前均检查 `git status`，只用明确 pathspec 暂存，未用 `git add -A`；未 push、未开 PR。

## 回报段（第五次停线 owner 裁定落实现后的最终收口，2026-07-30）

- **最终结论：GO；TestFlight N15 恢复进入发布验收。** owner 批准方案一：移除尚无事实的 pending terminal 时，同时摘下 pending 与 sealed-root link，链无终点即溶解；不禁止移除，也不让普通同 id 重加继承链身份。该裁定、此前四次 occurrence 裁定及最后一次独立审查 P2 均已落实并验证。N15 仍未在 TestFlight 真机执行，清单保持未勾选。
- **第五次裁定的 canonical 结果。** A 已有完成或跳过事实、A→(B)→C 后把 future C 移除：C pending 消失，A 侧 original link 同步摘下，落盘没有悬空边；A 的 sealed 元素仍以普通事实 occurrence 保留。若 A 只有 `skipSet`，`isSealed` 与 replacement link 解耦后仍以 `sets=[]` 和真实顶层 skip 归属保留，不会因链溶解被 builder 丢弃。下一场 sticky 按第一代表取 A，符合“这个 slot 最后真正做过的是 A”。
- **精确 Undo 与同 id 新生命周期。** 同一个 `SessionExerciseRemoval.restoring` 在 LIFO、快照、同 id 数量、pending 空位和 occurrence 生命周期代次均匹配时，原样恢复 terminal、pending 与 A 侧 link。普通同 id `addExercise` 永远是新 ad-hoc；成功 add 或以后以同 id 开始的新 replacement 会推进仅内存/replay 派生的 generation，使旧 Undo 永久失效。即使新 occurrence 随后换成别的动作或离开 plan，旧 Undo 也不能复活已取消链。draft 不保存第二份身份表，只靠原 typed events 确定性重放同一 generation 与结果。
- **为什么 sticky 从 `reversed()` 改为链语义。** 裸反序只能修最短 A→B，却会让同 pattern 临时加练占掉 FR-TR6 sticky 槽位，破坏旧无拆分历史的“第一个”行为。最终 `lastActualByPattern` 按原 occurrence 顺序扫描：用 clean `replacementRole` / `replacementLinks` FIFO 配对 replacement 边，完整链以终点 actual id 代表并保留链首排序位置，非链元素代表自身，再取 pattern 第一代表。测试分别锁住旧同 pattern 双动作加练、A→B、A→B→A、A→(B)→C/D 与 removed-terminal chain dissolution。
- **五次停线与 owner 裁定闭环。**
    1. `ff4a77b`：拆分实现触及“引擎判定逻辑零改动”红线后停止；owner 解释立法意图并授权 occurrence 消费兼容，`0893fdb` RED 后由 `ab16e9d` 首轮转绿。
    2. `0757ab2`：owner 对 1 MAJOR + 4 MINOR 写死 replacement-chain sticky、瞬态重置、当前 occurrence 行状态、Rail 过滤与计数/Progress 聚合；第一版裸 `reversed()` 被撤销，findings 候选最终并入 `58419f1`。
    3. `2a94bf7` / `89fb087`：闭合 findings 时暴露 fact-bearing split 经零事实中转丢链、重开热身；owner 批准 split 上下文跨任意 hop 传递，且独立全零事实历史保持字节不变。
    4. `74a2fd7` / `6fb16fd`：多跳设计继续暴露 skip-only actual 会被 builder 丢弃；owner 批准真实跳过终点以 `sets=[]` + 顶层 skip + actual link 保留，`58419f1` 一并转绿。
    5. `0fa53d8` / `96067f6`：移除 pending terminal 后同 id ad-hoc 偷取旧链；owner 批准本段方案一，`a74b142` 锁定无悬空、精确 Undo、同 id 重加不偷身份，`cc7fed4` 首轮转绿。随后独立审查发现普通 remove→同 id add，以及“新 B 后来换成 C/离开 plan”，仍可能让旧 Undo 穿透当前 plan；这是第五轮“仅精确 Undo”尚未落实完整，不是第六次扩大裁定。`9f4e632` 的第一版普通移除探针因 add payload 前置不合法，没有构成所声称的产品 RED；该前置在 `1706e81` 中修正并显式断言 add 已接受。真正暴露已取消链复活的是 `8bbc842`：1 项测试 2 个失败。`1706e81` 用 occurrence generation + remove 时同 id 数量冻结关闭。
- **其余五项 findings 已闭合。** 换动作会重置 `painReportedForCurrentSet`、`warmupPointer`、`isHolding`，未落组的疼痛预登记作废，Hold 不跨动作；`splitsFacts` 继续阻止有事实替换经零事实中转后重开热身。`rowStatuses` 只用当前 occurrence 的头部 skip 前缀；Rail 先过滤同 id 聚合 sets 为空的场；`TodayCompletedDigest.exerciseCount` 按非空 sets 的唯一 id 计数；Progress session 柱按 id 聚合并归一 PR。疼痛恢复要求同场同 id 聚合 sets 非空且全部无 `painFlag`。
- **最终 GREEN 证据。** occurrence 跨层集成 12/12；`RedeTrainingDecision` 490/490（`TrainFlowReducerTests` 29/29）。仓库根 `bash .claude/quality-gate.cmd` exit `0`：10 个 Swift 包全部通过，通用 Simulator `BUILD SUCCEEDED`，App 宿主 58/58（`SessionStoreDraftTests` 37、`AppUpdateRuntimeTests` 13、`StoreKitEntitlementsTests` 8），尾部 `TEST SUCCEEDED` / `QUALITY GATE: PASS`。独立 reviewer 复查 `1706e81` 后确认原 P2 已关闭，未发现新的 P0–P2。既有 SwiftPM fixture resource warning 仍是非阻断提示。
- **边界与交付状态。** 既有历史不迁移、不清洗；schema、版本、draft 版本、`Package.swift`、`project.pbxproj` 均未改。轮转、verdict、自动均衡、相对力量、周口径、进阶阈值及「只换这次 / 以后都换」范围语义未动；用户可见处方行为对无拆分历史保持冻结等价。规格、PRD、CHANGELOG、DEV_LOG 与 N15 已按最终事实回写。提交前检查 `git status`，只用明确 pathspec 暂存，未使用 `git add -A`；未 push、未开 PR。
