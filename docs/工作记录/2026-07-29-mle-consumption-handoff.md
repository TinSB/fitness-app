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
- 不新建文件、不进 canonical app-data、不进 App Group。

### A2 反馈面 = 今日页练完态总结块，一行事实

- `TodayTabView` 练完态总结块（该路径已拿到完整 ProgressModel）渲染**当天**（`achievedAtIso == 今天`）的 pending 升级事件：一行观察式事实——中文样式「背部 Lv.8 → Lv.9」，多肌群同天升级合并展示（最多列 2 个，更多折叠为「等 N 处」）。tierUp 同格式（如「进阶 → 中阶」用现有 tier 文案）。
- 该行自带分享入口（chevron 形态沿 Development 块先例）→ 打开分享预览，含本批新增的升级卡。
- **过天即不再渲染**（练完态块本来只存在于当天）；pending 里的旧事件留着不清（上限自然滚动）——**不需要已读回执**，天然一次性。
- ❌ 不弹窗、不加 badge、不做庆祝动画、不在进展页加横幅（等级本身在 Development 块可见）。
- 措辞 Apple 风格观察式（owner 文案品味基准）：只有事实，无表扬词、无感叹号、无句号。

### A3 首次解锁不产 breakthrough 的既有不对称**保持**（批次 B 有意裁定，不翻案）。

## 裁定 B：升级卡 + 均衡改善卡（FR-SH1 收官两卡）

### B1 升级卡（Level Up Card）

- 新 `ShareSnapshot.Content` case（5 处 exhaustive switch 同步 + Mirror 禁字段哨兵 + 隐私结构性缺失）。
- 内容照 §9.2 :1313 契约：肌群名 + `Lv.8 → Lv.9` + 近期一致性事实行（用已有可导出的中性事实，如近 4 周训练天数/该肌群有效组数——**不得出现置信度读数**）。
- 触发照 §1012-1017 五条：confidence ≥ medium（低置信升级不出卡）、非单次异常（上游已排可疑组，测试锁定）、无 safety/recovery limitation 时才用庆祝式排版（本批文案全部事实式，此条自然满足）。
- 入口：A2 升级行的分享入口；进展页 Development 块既有「分享发展画像」预览在**当天有 pending 升级**时追加升级卡页（segmented Picker 已支持多卡）。

### B2 均衡改善卡（Balance Improvement Card）

- `MuscleLevelMemory` 加性 optional 存 previous balanceScore（同 A1 一批实现）。
- 改善事件判定：新旧 balanceScore 对比，**阈值由你基于 balanceScore 实际刻度提出并在回执论证**，硬边界：必须能防单次波动（对比基线=上次持久化值）、双侧 confidence 门槛不低于 medium、判定为纯函数可测。产 `balanceMilestone` kind 的 breakthrough 进同一 pending 管道。
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
