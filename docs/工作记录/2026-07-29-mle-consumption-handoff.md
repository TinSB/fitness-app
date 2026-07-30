# 交接件：MLE 消费面批（第三档全量）——升级反馈 + 升级/均衡分享卡 + 里程碑事后分享 + widget 等级

> 日期：2026-07-29 ｜ 来源：开发路径盘点第三档「东西做出来了，但没接到用户能看见的地方」，owner 拍板「先做第三批」（同时拍板：本地导入取消，后续大方向=云端账号，本批不涉及）
> 性质：**MLE 已有引擎的消费面接线**（一处加性数据契约 + 三个新分享卡面 + widget 加性字段）
> 执行：Codex（专家档 gpt-5.6-sol + ultra）｜验收：Claude 主会话（多 lens + 对抗核验）
> 分支：`codex/0729-mle-consumption`（基线最新 origin/main `3ca6c3f`）

## 为什么

MLE 批次 A+B 把肌群等级做完了，但用户升级时**毫无感知**：练完升级没有任何反馈、最有传播性的「升级卡/均衡改善卡」没做、进展页里程碑点不动、widget 不显示等级。本批把已经算出来的价值接到用户能看见的地方。这也是将来值得付费的方向——但本批全部 Free Core。

## 现场事实（已核实，勿重查）

| 环节 | 现状 |
|---|---|
| 升级检测引擎 | `MuscleProfileAssembler.breakthroughs`（`RedeLocalSnapshot/MuscleProfileAssembler.swift:97-123`）**已实现**：产 `LevelBreakthrough`（kind `.muscleLevel` fromLevel/toLevel + `.trainingTier`），有单测；枚举 `LevelBreakthroughKind` 已含 `balanceMilestone`/`consistencyMilestone` 种子。**app 层零消费**（仅 `ProgressModel.swift:213` 一句注释） |
| ⚠️ 核心陷阱 | `MuscleLevelMemory`（`muscle-level-memory.json`，schema v1，未知版本拒读）是**覆盖式**：`ProgressModel.loadOutcome` 读 memory 算 breakthrough 后立即覆盖写（:217→:241-244）。`loadOutcomeAsync` 有 **4 个调用点**（ProgressTab:88 / TodayTab:863、912 / TrainTab:1125 待机块）——**谁先跑谁吃掉升级事件**，第二次读就是空数组 |
| 等级纯函数性 | `currentLevel` 是 sessions 纯函数（`previousLevels` 只喂 peak/breakthroughs 不进 currentLevel）；mle-v2 常量锚死在 `MuscleLevelTypes.swift:287-329` + 两处 golden，**改常量必须 bump modelVersion——本批禁止** |
| 分享卡管线 | `ShareSnapshot.Content` 三卡（workoutSummary/personalRecord/muscleLevel）；新增卡型必须同步 5 处 exhaustive switch（`ShareSnapshot` 枚举 + `SharePrivacyFilter` 入口 + `ShareCardModel.make` + `ShareCardView.content` + `ShareCardPreviewView.tabTitle`），漏了不编译。卡视图纯数据驱动（不读 environment）→ `ImageRenderer` 3x 离屏（360×450 逻辑）。隐私靠类型层结构性缺失 + Mirror 禁字段哨兵（`ShareSnapshotTests.swift` 三卡各一个） |
| 升级/均衡卡规格 | **早已写好**：系统逻辑 §9.2 卡表 :1313/:1315（Level Up 卡=`Back Lv.8 -> Lv.9`+升级原因摘要+近期一致性；Balance 卡=均衡度变化+补足方向，「不显示低等级羞辱式文案」）；:1012-1017 Level Up 五条触发条件（confidence≥medium 等）。当年推后原因=「等真实数据节奏」，现在就是兑现时刻 |
| 均衡卡缺口 | `MuscleLevelMemory` 没存 previous balanceScore（仅 levels/peaks/tierRaw/priorityMuscles）——唯一真正的引擎缺口，加性字段可解（`priorityMuscles` 就是 schema v1 加性 optional 先例） |
| 里程碑区 | `ProgressTabView.milestonesSection`（:847-886）**真点不动**（全页唯一纯静态列表；`historySection:902` 有 Button 先例）。数据 `StrengthMilestone`：只有 `achievedThreshold`(Int)+`unitLabel`+`isEstimated`，**没有 reps、kg/lb 双梯禁互转** |
| 里程碑归卡裁定史 | §6.5.12「milestoneBadge V1 不进卡，里程碑面归 PR 卡」——但 PR 卡要 reps，硬塞=编数据。见裁定 C |
| 事后分享先例 | 进展页 Development 块「分享发展画像」（ProgressTabView:713-751）：按钮 + `static func ...ShareSnapshot(from:)` 现算 + 复用同一 preview sheet——里程碑区照抄此形态 |
| widget | 快照 strict Codable + `acceptedSchemaVersions=[1]`，**bump=旧 widget 拒读整份**；`locale` 字段是「optional 加性不 bump」先例；**`rows: [ReadinessWidgetRow]` 通道已存在但写入侧恒传 `[]`**（SessionStore:185）——加等级可零类型改动。唯一写点 `SessionStore.refreshWidgetSnapshot`(:162)，`muscle-level-memory.json` 不在 App Group（app 侧读文件塞进快照即可） |
| 一次性提示先例 | What's New：namespaced 键存「上次见过的版本」非 Bool + 回执协议注入假 store 可测（`AppUpdateRuntime.swift:126-156`）；判定下沉纯包、副作用留壳（`ReviewPromptPolicy` 先例） |
| 文案红线 | Copy Baseline §3.5 三铁律（不要句号/砍鸡汤/保持分量）+ §5.3「Progress 不是庆功墙」+ §7.3 不羞辱；`MuscleLevelCopyTests:46/61` 有无句号/禁词扫描先例；**`ShareCardCopyTests` 目前没有红线扫描（缺口，本批补）** |
| FR-PL5 澄清 | 弱肌群=自动 +1 组，**提案式已被 owner 明确否决**（「不要建议直接自动改」「不要小字」）。`SYSTEM_LOGIC.md:1457` 仍把「FR-PL5 提案式」列批次 C 候选=腐烂条目，本批顺手清理 |
| 文档漂移待修 | FR-SH2 状态串「两卡 Mirror 哨兵」（实际已三卡，本批后五卡）；FR-PR9 与 FR-SH3 循环引用（SH3 说见 PR9，PR9 说见 §5.8） |

## 裁定 A：升级事件留存 + 练完态反馈（本批唯一数据契约变更）

### A1 留存语义（解决「被吃掉」）

`MuscleLevelMemory` 新增**加性 optional 字段** `pendingBreakthroughs`（沿 `priorityMuscles` 先例，schema 仍 v1，未知版本拒读纪律不动）：

- 任何 `loadOutcome` 计算出非空 breakthroughs 时，**append 进 pending**（按 `muscle+kind+toLevel/toTier+achievedAtIso` 去重；上限 20，超限丢最旧）。
- 这样 4 个调用点谁先跑都只是「第一个记录者」，不再是「消费者」——升级事实持久化，不会被训练页待机加载吃掉。
- **重叠调用也必须安全（2026-07-30 owner 第二次裁定）：**app 进程内完整的 memory `load → advance/reconcile → save` 必须进入同一串行事务（actor 或锁）；atomic replace 只负责文件完整性，不能代替读改写串行化。widget 保持只读。用 barrier 双 writer 测试证明 pending 与较新的 B2 candidate/reference 均不丢。
- 不新建文件、不进 canonical app-data、不进 App Group。

### A2 反馈面 = 今日页练完态总结块，一行事实

- `TodayTabView` 练完态总结块（该路径已拿到完整 ProgressModel）渲染**当天**（`achievedAtIso == 今天`）的 pending 升级事件：一行观察式事实——中文样式「背部 Lv.8 → Lv.9」，多肌群同天升级合并展示（最多列 2 个，更多折叠为「等 N 处」）。tierUp 同格式（如「进阶 → 中阶」用现有 tier 文案）。
- 该行自带分享入口（chevron 形态沿 Development 块先例）→ 打开分享预览，含本批新增的升级卡。
- **事实与分享资格拆开（2026-07-30 owner 第二次裁定）：**当天 pending 升级事实无论分享资格如何都如实显示。低置信或其它 B1 门槛不通过时，渲染为纯事实行——无 chevron、无分享图标、不可点，a11y 只读纯文本；通过 B1 事件时资格的事实行才保留分享入口。诚实事实面不因传播质量门槛而消失。
- **过天即不再渲染**（练完态块本来只存在于当天）；pending 里的旧事件留着不清（上限自然滚动）——**不需要已读回执**，天然一次性。
- ❌ 不弹窗、不加 badge、不做庆祝动画、不在进展页加横幅（等级本身在 Development 块可见）。
- 措辞 Apple 风格观察式（owner 文案品味基准）：只有事实，无表扬词、无感叹号、无句号。

### A3 首次解锁不产 breakthrough 的既有不对称**保持**（批次 B 有意裁定，不翻案）。

## 裁定 B：升级卡 + 均衡改善卡（FR-SH1 收官两卡）

### B1 升级卡（Level Up Card）

- 新 `ShareSnapshot.Content` case（5 处 exhaustive switch 同步 + Mirror 禁字段哨兵 + 隐私结构性缺失）。
- 内容照 §9.2 :1313 契约：肌群名 + `Lv.8 → Lv.9` + 近期一致性事实行（用已有可导出的中性事实，如近 4 周训练天数/该肌群有效组数——**不得出现置信度读数**）。
- 触发照 §1012-1017 五条：confidence ≥ medium（低置信升级不出卡）、非单次异常（上游已排可疑组，测试锁定）、无 safety/recovery limitation 时才用庆祝式排版（本批文案全部事实式，此条自然满足）。
- **资格锁定时点（2026-07-30 owner 第二次裁定）：**confidence / safety / recovery 全部门槛以突破事件被**首次 append** 时的 profile 为准，落盘后不随消费时 profile 漂移。持久化事件时的原始事实而非 `isEligible` 布尔，资格由纯函数推导并锁测试；优先给 `LevelBreakthrough` 增 additive optional 事实字段，若 Codable 兼容性不干净才可回退为 `MuscleLevelMemory` 内按 pending 去重键索引的并行 map，并在回执说明。旧文件缺资格事实只显示事实行、不出卡（保守）。
- 入口：A2 升级行的分享入口；进展页 Development 块既有「分享发展画像」预览在**当天有 pending 升级**时追加升级卡页（segmented Picker 已支持多卡）。

### B2 均衡改善卡（Balance Improvement Card）

- `MuscleLevelMemory` 保持 schema v1，只加 additive optional：raw `balanceScore` reference、reference contributor IDs / 等级 / confidence 事实、candidate 分数与独立观察 session 指纹（已完成场次数或最新场 id）。旧文件缺键时只播种 reference，不产事件、不写 candidate。
- **Reference 语义（2026-07-30 owner 修订裁定）：**只在两类时点变动：(a) `balanceMilestone` 事件确认触发时 `reference := 当前值`；(b) 当前 raw balanceScore 低于 reference 时 `reference := 当前值`（trough 跟踪，回落即下调）。无事件的上升途中绝不覆盖 reference，因此 `+4、+4、+4` 渐进改善可累计；一次 `+10` 尖峰不得立即发卡。
- **两次独立观察确认：**首次满足全部门槛只写 candidate；下一次已完成场次数严格增加（或最新场 id 已变化）的观察仍满足，才产 `balanceMilestone` breakthrough 进入同一 pending 管道并重置 reference；不满足则清 candidate。四个 `loadOutcome` 对同一份数据的重复读取不算第二次观察。
- **Confidence 门槛：**reference 建立侧与确认观察侧均要求 contributor confidence **中位数 ≥ medium**（与 tier 同一惯例）；用于方向门槛的每个「在涨的低侧肌群」自身 confidence 还必须 ≥ medium。不得改成全体 contributor 最低 confidence ≥ medium，避免低置信附属肌群令卡实际不可达。
- **Contributor 可比性：**新旧 contributor 集合不同（含新解锁）时本次不可比：不产事件、不写 candidate，reference 重置为当前值，作为新口径起点。
- **方向门槛：**至少一个在 reference 时低于 contributor 中位等级的肌群，当前等级较 reference 上升、当前 trend 为 `rising`，且自身 confidence ≥ medium；若分数上升仅由强侧回落造成则拒绝。卡面「补足方向」只取这些在涨低侧肌群，多个时按涨幅降序最多列 1–2 个。
- **锁定阈值：**使用与展示 `balanceScore` 同源的全部已解锁肌群口径，以未取整 `Double` 判定 raw delta `>= 10.0`；不得另造第二套分数真相。两次独立观察确认负责过滤一次尖峰。
- 卡内容照 §9.2 :1315：均衡度变化 + 补足方向（哪个肌群在涨），**禁羞辱**：不点名「最弱」，只说改善事实。
- 入口与升级卡一致（当天有事件时预览追加该卡页）。

### B3 两卡均 Free Core，不挂任何 paywall/entitlement 判断（owner 纲领：订阅不开，分享是增长面）。§9.7 对应条目同批写明。

## 裁定 C：里程碑事后分享

- 里程碑行改为可点（`historySection` Button 先例，≥44pt），点击 → 分享预览。
- **新 `ShareSnapshot.Content` case `strengthMilestone`**（不复用 PersonalRecord：它要 reps，里程碑没有 reps，硬塞=编数据）。字段：exerciseId、achievedThreshold、unitLabel、isEstimated——与进展页行完全同源，**不做 kg/lb 互转**（双梯禁互转红线）。
- 卡面视觉归 PR 卡家族（同版式，值=「100 kg」，估算加既有中性微标）；§6.5.12「里程碑面归 PR 卡」同批更新为「归 PR 卡家族版式、独立数据 case」并写明理由（不编 reps）。
- 合并行（实测+估算同动作一行）点击时：预览里实测/估算**各一页卡**（估算页必带估算标注）；纯估算行只出估算卡。
- FR-PR9 写实自己的验收标准（切断与 FR-SH3 的循环引用）。

## 裁定 D：widget 显示等级

- **零类型改动**：复用现成空跑的 `rows` 通道（写入侧 `SessionStore.refreshWidgetSnapshot` 从 `muscle-level-memory.json` 读等级，写入至多 2 行——按等级降序取前 2 个肌群，`label=肌群名` `value=Lv.N`）。
- 门槛：tier 为 calibrating 或无等级数据时 rows 保持 `[]`（widget 与现状完全一致）。
- **不 bump schemaVersion**；等级数据滞后于最近一次 Progress/练完态加载属已知可接受（等级变化慢），系统逻辑注明。
- widget 端 `rows.prefix(2)` 渲染已存在，理论上零 widget 端改动；若排版需要微调，仅限该 widget 文件。

## 红线（违反即返工）

1. ⛔ **不动 mle-v2**：`MuscleLevelModelConfig.current` 任何常量、modelVersion、estimator 计分逻辑一律不碰（两处 golden 锚死）。
2. ⛔ `MuscleLevelMemory` 只加 optional 字段，schema 版本号不动，未知版本拒读纪律不动；旧文件（无新键）必须照常解码。
3. ⛔ widget `schemaVersion` 不 bump；快照新增内容只走既有 `rows`。
4. ⛔ 零弹窗、零 badge、零说教、零庆祝动画；所有新文案过 §3.5 三铁律 + §5.3 + §7.3（无句号、无破折号、无表扬词、无置信度读数、不羞辱、不点名最弱）。
5. ⛔ 新卡不挂 paywall；不碰订阅面、购买闸。
6. ⛔ 首次解锁不产 breakthrough 维持不变；`SessionShareSnapshotBuilder`（训练流内即时卡）不动。
7. ⛔ 不做批次 C 其余候选：pain-safety 喂 MLE、器械校准维、置信卡、identity 稳定维、exposure 窗口衰减（v3）——全部留案。
8. 版本号不动；**不 push、不开 PR**。

## 验收标准（owner 大白话）

1. 练完一场某肌群升级 → 回今日页，练完态总结里有一行「背部 Lv.8 → Lv.9」；点它能分享一张升级卡
2. 先去训练页逛一圈再回今日页 → 那行**还在**（升级不会被吃掉）
3. 均衡改善后，分享预览里多一张均衡改善卡，只说改善、不羞辱
4. 进展页里程碑行点得动 → 出里程碑卡；估算档明确标「估算」
5. 桌面小组件多显示最高两个肌群的等级；校准期/新用户的小组件和以前一模一样
6. 没升级没改善的老用户：App 与 widget 行为与现状完全一致
7. 全程没有弹窗、没有「干得漂亮」式鸡汤

## 验证与证据

1. **测试先红后绿**：pending 留存（多读点竞态=第一读者 append 后第二读者不重复 append、去重键、20 上限）、旧 memory 文件（无新键）解码、当天/过天渲染边界、升级卡五条触发（confidence<medium 不出卡）、均衡阈值正反例、milestone 卡数据同源+禁互转、widget rows 门槛（calibrating→[]）、**新卡 Mirror 禁字段哨兵**、L10n 精确断言 + 为 ShareCardCopy 补无句号/禁词红线扫描（沿 MuscleLevelCopyTests 模式；只覆盖新串与能原样通过的既有串，不为过测试改旧文案）。
2. **零回归证明**：无升级/无改善/无里程碑数据时，练完态块、分享预览卡集、widget 快照 JSON 与现状一致（能 byte 比对的 byte 比对）。
3. **模拟器实拍**（装前真 build、前台确认 Rede、md5 互异）：①练完态升级行 ②升级卡预览 ③均衡卡预览 ④里程碑点击后的卡预览 ⑤widget 快照 JSON 实读（rows 出现等级）；widget 时间线实拍尽力而为，做不到如实说（真机项进 TestFlight 清单）。PNG 前缀 `2026-07-29-mleconsume-`。
4. **canonical/文件实证**：`muscle-level-memory.json` 实读（pending 追加、previous balanceScore 落盘、旧键全保留）。
5. 仓库根 `.claude/quality-gate.cmd` exit 0。
6. **规格写回**（同批）：PRD FR-SH1（🟡→✅ 五卡全）、FR-SH2（哨兵数）、FR-SH3（里程碑入口落地）、FR-PR9（写实验收标准）、FR-PR6（升级反馈接线）；系统逻辑 §6.5.12、§9.2 卡表（+milestone case、两卡转已实现）、§9.7（两卡 Free Core）、widget 段（rows 语义+滞后说明）、**:1457 批次 C 清单修正（删 FR-PL5 提案式废条，标注 pain-safety/校准维等仍留案）**；文案基线新串登记；TestFlight 清单新 N 项；CHANGELOG/DEV_LOG。

## Git 纪律

- `git fetch` 后从最新 `origin/main`（`3ca6c3f`）拉分支 `codex/0729-mle-consumption`。
- 每次 commit 前重跑 `git status`；`git add` 明确 pathspec，**禁用 `-A`**。
- 按切片小步提交（A 留存+反馈 / B 两卡 / C 里程碑 / D widget / 文档可分）；不 push、不开 PR。

## 停止条件

- 同一问题修 3 次不过即停回报。
- 触红线、发现行为歧义、balanceScore 刻度不支撑可靠阈值、或需要改变本交接件任一裁定 → **立即停下回报，不自行改裁定**（前三批你在这点上都做得对，保持）。

## 实施回执模板（收尾必填**回填本文件末尾**）

```
## 实施回执
- 分支与 commit 清单：[hash + 一句话]
- A 留存+反馈：[pending 字段设计 + 竞态处理 + 渲染边界 + 测试清单]
- B 两卡：[触发实现 + 均衡阈值论证 + 隐私哨兵 + 文案全文]
- C 里程碑：[case 设计 + 行交互 + 合并行处理]
- D widget：[写入实现 + 门槛 + 快照实读]
- 零回归证明：[方式与结果]
- 规格写回：[逐份逐节，含 :1457 清理]
- gate：[exit code + 尾部原文]
- 实拍：[文件名 + md5]
- 未尽事项 / 范围外疑点：[如实列]
```

## 停止回报（2026-07-29 · 实施前阈值裁定）

- **状态：STOP，未进入 RED 测试或 runtime 实现。** 触发本交接件停止条件「balanceScore 刻度不支撑可靠阈值 / 行为歧义」。工作区在停止前仅有本交接件基线提交；未改 `mle-v2` 常量、`modelVersion`、memory/widget schema、订阅面或任何产品代码。
- **问题 1｜双侧 confidence 无法从现有 memory 证明。** `balanceScore` 使用全部已解锁肌群的 `curveLevel`，而 `tierRaw` 只受中位 confidence 约束；即使 tier 非 calibrating，仍可能有 low-confidence 肌群参与并改变 balance。当前 `MuscleLevelMemory` 不存上一观察的 balance confidence，不能满足「新旧双侧 confidence 均不低于 medium」。
- **问题 2｜分数上升不等于补足方向成立。** balance 可因高等级一侧回落而上升；只比较新旧分数会生成「均衡改善」，却没有任何「哪个肌群在涨」的事实，违反 B2 卡面契约。
- **问题 3｜覆盖式基线无法同时防尖峰和识别渐进改善。** 若每次都把 previous balanceScore 覆盖，`+4、+4、+4` 永远达不到阈值；一次 `+10` 尖峰却会立刻触发。仅靠「相对上次持久化值 + 一个数值阈值」不能可靠满足“防单次波动”。
- **问题 4｜contributors 变化时不可直接比较。** 新肌群解锁会改变 balance 的样本集合；若不锁新旧 contributor 集合相同，delta 混入了口径变化。
- **刻度实证。** `balanceScore = max(0, 1 - CV) × 100`，范围 `0...100`、事件判定应使用未取整 `Double`。当前公式下，三块 all-medium 的 `[6, 7, 7] → [7, 7, 7]` 单肌群一级变化约为 `+7.071`，所以 `5` 分不足以隔离常见一步变化；`10` 分可作保守候选，但单独使用仍挡不住多肌群同一观察跨级或一次尖峰。
- **建议的裁定修订（需 owner 明确批准后另开实施轮）。**
  1. 继续保持 schema v1，仅授权 additive optional：`balanceScore`、参与 balance 的最低 `balanceConfidenceRaw`、稳定 contributor IDs，以及独立的 reference/candidate 确认状态；旧文件缺键只播种，不产事件。
  2. 事件纯函数至少要求：新旧 contributor 集合相同；新旧最低 confidence 均 ≥ medium；原始分数 delta ≥ `10.0`；至少一个此前低侧或 priority 肌群 level 正向变化且当前 trend 为 `.rising`；只有强侧回落时拒绝。
  3. 推荐采用“两次独立观察确认”而不是一次越线即发：首次满足写 candidate，后续独立训练观察仍满足才产 `balanceMilestone`；回落则清 candidate。四个 `loadOutcome` 对同一份数据的重复读取不得算第二次观察。
  4. 明确 `+4、+4、+4` 是应累计到稳定 reference 后触发，还是按每次覆盖永不触发；这是产品行为裁定，实施方不代拍。
- **恢复条件。** owner 回写并批准上述 reference/candidate 语义（或明确接受较弱的一次越线语义及其误报风险）后，才可重新开始本批 RED→GREEN；其余 A/C/D 虽可独立实现，本轮按交接件“触停止条件即结束”纪律没有绕过 B2 继续。

### 停止解除（2026-07-30 · owner 裁定）

- owner 已逐条确认停止回报中的四项问题成立，并批准上方 B2 的 stable reference、两次独立观察、confidence 中位口径、contributor 集合重置、低侧上升方向门槛与 raw delta `>= 10.0`。
- 前次 STOP 保留为历史证据；本批自本记录起恢复 RED→GREEN。其余 A / B1 / C / D 裁定与全部红线不变；若实施证据表明 confidence 中位口径仍不足以支撑可靠判定，必须再次停止，不得静默降级或隐藏功能。

## 停止回报（2026-07-30 · 独立审查发现 A2 / B1 语义冲突）

- **状态：STOP。** A / B / C / D 正向实现与定向测试已经完成，独立 Simulator 也已证明“当天升级行 → 升级卡”的正向路径可见；但独立代码审查发现一项会改变用户结果的行为歧义，命中本交接件停止条件。发现后未继续修代码、写规格或跑最终 gate；本段是停止后的唯一仓库改动。
- **问题 1｜A2 当天事实与 B1 分享资格无法由现有契约同时表达。** A2 写死“当天 pending 升级事件”都渲染一行观察式事实，并且“该行自带分享入口”；B1 同时写死“confidence < medium 的升级不出卡”。现有 pending 只保存 `LevelBreakthrough`，没有事件发生时的 confidence / 分享资格事实。当前实现用**消费时** profile 的 confidence 同时决定事实行与卡：
  1. 事件发生时 low，当前仍 low：当天升级事实行也消失，违反 A2；
  2. 同一天后续独立训练令当前 confidence 升到 medium、但没有新升级：同一个旧事件会突然获准出卡，违反 B1 的事件时门槛。
- **问题 1 建议裁定（推荐）。** 把“事实可见”与“可分享”拆开：当天 pending 升级事实始终按 A2 显示；事件产生/首次 append 时锁定分享资格，之后不随消费时 profile 漂移。建议在 schema v1 内再授权一个 additive optional 的事件资格事实（可放 `MuscleLevelMemory` 的并行 eligibility map，按 pending 去重键索引；或明确批准给 `LevelBreakthrough` 增 optional 字段），旧文件缺资格事实只显示事实、不出卡。低置信行应显示为**不可点事实行、无分享图标与 chevron**；若 owner 坚持每条 A2 行都必须可点，则需明确改为“低置信升级连事实行也不显示”，并承认这会收窄 A2。
- **需同时写死的资格时点。** 请明确 B1 的 confidence / safety / recovery 门槛均以“突破事件被 append 时”的 profile 为准；否则同一 pending 事件会随当天后续观察反复变成可分享/不可分享。
- **问题 2｜当前写前合并仍不能承受真正重叠的四调用点写入。** `saveReconciling` 是无锁的 `load → merge → atomic replace`；atomic 只保证单次文件替换完整，不保证整个读改写事务原子。两个 writer 同时从同一旧文件起步时，后写者仍可覆盖先写者新增的 pending；旧 reader 的非 nil `balanceImprovementState` 也可覆盖盘上更新的 candidate/reference。这会重新出现“升级被吃掉”或让 B2 candidate 延后一场/重复确认。现有测试只覆盖“第一写已完成后第二写”，不是真并发。
- **问题 2 建议实现边界。** 不改变任何产品裁定，批准把 app 进程内完整的 memory `load → advance/reconcile → save` 放进同一串行事务（同一 actor 或锁；widget 仍只读，未发现第二写进程），并用 barrier 双 writer 测试证明 pending 与较新 B2 state 都不丢。若 owner 认为 A1 只要求顺序多读、明确不要求重叠调用安全，也请写明接受残余丢写风险；实施方不自行弱化“谁先跑都不会吃掉事件”的现有表述。
- **其余审查结果。** 未发现 `mle-v2` 常量 / `modelVersion`、memory/widget schemaVersion、paywall、`SessionShareSnapshotBuilder`、里程碑单位同源等红线被触碰。canonical docs、CHANGELOG / DEV_LOG、TestFlight 清单、最终 gate 与实施回执尚未收口，按 STOP 纪律不绕过上述歧义继续。
- **恢复条件。** owner 明确裁定：①低置信当天事实行是否显示、显示时是否可点；②分享资格的锁定时点与允许落盘的 additive optional 结构；③A1 是否要求重叠调用的串行事务。三项写回后，才恢复定向 RED → 修复 → GREEN、规格与实施回执收尾。

### 停止解除（2026-07-30 · owner 第二次裁定）

- owner 已批准：低置信升级事实仍显示但为不可点纯文本；B1 confidence / safety / recovery 资格在事件首次 append 时由原始事实锁定，旧文件缺事实不出卡；app 进程内完整 memory 读改写必须串行，并用 barrier 双 writer 测试证明 pending 与较新 B2 state 均不丢。
- 前次 STOP 保留为审查证据；本批自本记录起恢复定向 RED → 修复 → GREEN、规格写回、Simulator 直接验收与实施回执收口。其余裁定与全部红线不变。
