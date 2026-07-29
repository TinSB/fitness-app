# 交接件：计划调整第二招（增频提案）+ 撤销栈（FR-PL3/PL4）

> 日期：2026-07-29 ｜ 来源：开发路径盘点第二档，owner 拍板
> 性质：**引擎提案维度扩展 + canonical 数据契约变更**（单条记录 → 栈）
> 执行：Codex（专家档 gpt-5.6-sol + ultra）｜验收：Claude 主会话（多 lens + 对抗核验）

## 范围裁定（为什么只做这两件——如实，不硬凑维度）

PRD 说 FR-PL3 应有「强度/动作选择/周期结构」多维度。**本批只做「增频提案」+「撤销栈」**，其余维度明确不做，理由：

- **动作选择维度** ❌ = FR-T5 教练卡已有（换动作建议），再做就是重复机制
- **容量维度** ❌ = 自动均衡 FR-PL5 已有（owner 拍板「不要建议直接自动改」），再做就是打架
- **强度停滞维度** ⏸ = 停滞阈值需要真实用户数据校准，商店 1.8 上线 9 天，现在定阈值是拍脑袋
- **周期结构维度** ⏸ = 与既有 mesocycle 机制（calibrate/build/overreach/deload）深度耦合，需单独立项
- **增频提案** ✅ = 降频的**对称缺失**：用户实际每周练 5 天、计划写 3 天，周判断会过早说「已达标」、补量口径全偏——数据同源（同一 adherence 中位数机制）、零新依赖、诚实可做

## 现场事实（已核实，勿重查）

| 位置 | 现状 |
|---|---|
| `PlanAdjustmentEngine.swift:14` | `Kind` 只有一个 `case reduceFrequency`；`frequencyProposal()` 按依从中位数出降频提案 |
| `AppData.swift:75` | `planAdjustment: PlanAdjustmentRecord?` ——**单条记录**（撤销只能一次的根源） |
| `SessionStore.rollbackPlanAdjustment` :867 | 单步回滚，走 `CanonicalSessionWriter.rollbackPlanAdjustment()` + 写闸 |
| 采纳/暂不/撤销交互 | 计划页调整卡已有完整 idiom（FR-T5 同款采纳/暂不 + 撤销行） |
| 周判断消费 | `daysPerWeek` 驱动周计划判断（trainedDaysThisWeek vs planned）、补量卡、自动均衡预算——**开工先盘全消费点**，回执列出 |

## 裁定 A：增频提案（FR-PL3 第二招）

### A1 信号（写死，不许自调）

最近 **4 个完整 ISO 周**（不含进行中本周）的**实际训练天数中位数 ≥ 计划 daysPerWeek + 1** → 出增频提案「把每周计划调到 X 天」（X = 中位数，钳制 2...6，与 onboarding 同界）。

- 与降频**互斥**：同一时刻最多一个频率提案（两个信号同时成立在数学上不可能，但代码要有守卫）
- 已有降频提案的抑制/降频机制（按周抑制等）**完全复用**，不新造节流

### A2 采纳行为（保守边界，写死）

**只改 `daysPerWeek` 数字**——影响周判断口径、补量、均衡预算。

- ⛔ **不动 splitType、不动日序**——用户 3 天全身练成 5 天，采纳后分化还是全身（想换分化有自由编排 FR-PL7③，那是他的决定）
- 提案理由句要如实只说「调整每周目标」，不承诺换分化
- 采纳走既有写闸路径 + 记录进撤销栈（裁定 B）

### A3 文案（走基线 §4 句型，零说教）

理由句结构 = 信号 + 决策：「最近四周你每周练 X 天　计划是 Y 天」+ 采纳动作「把计划调到 X 天」。中英原生、精确断言。**禁**：表扬（「坚持得很好」）、劝告、感叹号。

## 裁定 B：撤销栈（FR-PL4）

### B1 数据（open-bag 加性，不改 schema）

- 新增 canonical 数组 `planAdjustmentHistory: [PlanAdjustmentRecord]`（记录含 before/after，沿用现有 record 结构）
- **读侧真源 = history**；**兼容**：history 缺失且旧 `planAdjustment` 有值 → 读时视作单元素栈（**不迁移写回**，读时合成）
- **写侧：停写旧字段**（本地 App 无降级场景；双写会造双真源漂移）。采纳 → append；栈上限 **20**，超出丢最旧
- 写闸新增/改造方法走既有 `performGatedMutation`（备份/校验/原子/诚实报错）

### B2 撤销行为

- 撤销 = pop 栈顶，恢复该条记录的 before 值；可连续撤（逐层）
- UI：现有「撤销」行语义不变（每按一次撤一层）；**不加**「还可撤 N 层」类小字；栈空时撤销入口消失（现状语义）
- 撤到某层时若中间 daysPerWeek 被用户从别处改过（如设置页改天数）→ **该层撤销仍恢复记录的 before 值**（简单可预期，不做三方合并）；这条语义写进规格

## 裁定 C：红线

1. **不动**：FR-T5 教练卡、自动均衡 FR-PL5、mesocycle 周期化、自由编排 FR-PL7、回归协议、每周循环、订阅面。
2. 提案保持**建议式**（采纳/暂不），不自动改——与现有降频一致；这与自动均衡的「自动式」是两条已拍板的不同姿态，勿混。
3. **golden 零回归**：无新信号（依从正常）用户，引擎输出与提案面逐字节等价现状——沿用 pain 批的 fixture 逐字节比对方式。
4. 阈值写死（A1），不许实现时「顺手调优」。
5. schema 不变（open-bag 加性）；版本号不动。
6. 文案零说教零表扬（owner 纲领）。

## 验收标准（owner 大白话）

1. 我计划 3 天但连续四周实际练 5 天 → 计划页出现「把计划调到 5 天」的建议，采纳后周判断按 5 天算
2. 我连续采纳了降频、又采纳了增频 → 撤销一次回到降频后的状态，再撤销一次回到最初——**能一层层撤**
3. 依从正常的用户（练得和计划差不多）→ 什么提案都不出现，一切照旧
4. 采纳增频后我的分化/训练日构成**一点没变**，只是「本周练够没」的账按新目标算
5. 没有表扬、没有说教、没有弹窗

## 验证与证据

1. **测试先红后绿**：增频信号边界（中位数 = planned / planned+1）、4 完整周窗口（进行中周不计）、钳制 2...6、与降频互斥守卫、栈 append/pop/上限 20、旧单字段兼容读、停写旧字段、逐层撤销恢复 before 值、golden 零回归。
2. **模拟器实拍**（装前真 build、前台确认 Rede、md5 互异）：①增频提案卡 ②采纳后周判断跟随 ③连续两次采纳后逐层撤销。PNG 前缀 `2026-07-29-planadj-`。若模拟器受阻，如实报告，不伪造。
3. **canonical 实证**：采纳后读 history 数组实际内容；两层撤销后栈归空、daysPerWeek 回原值。
4. 仓库根 `.claude/quality-gate.cmd` exit 0（freeze-once 两冻结点）。
5. **规格写回**：PRD FR-PL3（如实写明已做维度与明确不做的维度及理由）+ FR-PL4（栈语义 + 交互不变）；系统逻辑（信号定义/互斥/栈契约/兼容读/停写旧字段/撤销恢复语义）；文案基线（新串）；CHANGELOG / DEV_LOG。
6. 新 L10n 串精确断言。
7. **开工第一步**：盘 `daysPerWeek` 与 `planAdjustment` 的全部消费点/读取方，列进回执——采纳增频后每个消费面的行为变化要如实列出（哪些变、哪些不变）。

## Git 纪律

- 先 `git fetch`，从最新 `origin/main` 拉分支 `codex/0729-plan-adjustment`。
- commit 前重跑 `git status`（owner 有并行会话习惯）；`git add` 明确 pathspec，**禁用 `-A`**。
- 小步提交；**不 push、不开 PR**。

## 停止条件

- 同一问题修 3 次不过即停回报。
- 触红线、发现行为歧义、或需改本交接件任一裁定 → **立即停下回报，不自行改裁定**（前两批你在这点上都做得对，保持）。
- 盘点消费点时若发现「只改 daysPerWeek」会造成某个消费面出现明显荒谬行为（如均衡预算爆炸）→ 停下回报，附具体场景。

## 实施回执模板（收尾必填**回填本文件末尾**）

## 实施回执

- 分支与 commit 清单：
  - 分支 `codex/0729-plan-adjustment`，起点为最新 `origin/main` `e4a711c658f5bb2afe004e50ec5d2c40e5275f43`。
  - `149187143ff077ed58fbf27ef06668fa7eb2aa46` — `feat: add bidirectional plan adjustment history`：双向提案、双字段采纳、raw open-bag 撤销栈、UI/L10n、测试、golden 与全部 canonical 规格。
  - 本回执和 5 张 PNG 位于随后本地证据提交；回执不内嵌其自身 hash，避免自引用。未 push、未开 PR。

- 消费点盘点（开工先完成，未发现“只改 daysPerWeek”会造成荒谬行为；owner 已逐项接受以下全链条）：
  - canonical/clean 边界：`RedeDomain.ProgramTemplate.daysPerWeek`、`UserProfile.weeklyTrainingDays` 经 `RedeDataHealth` 分别按 clean `1...14` 投影；采纳在同一写闸把两处同步为新目标，撤销按各自 before 恢复。
  - 计划页：hero 的周天数、`PlanWeekProjection` 排期与提案 after 预览、训练日编辑影响统计都会按新周天数重算；splitType、默认/自定义日序和按完成场次轮转均不改。全身 3→5 的投影因此为 A/B/C/A/B。
  - 今日裁决：`TodayVerdictEngine` 优先读 program 天数（profile 仅 fallback）；本 ISO 周“已达计划”阈值随之变化，3→5 时同样练 3 天可由 light 回 train；21 天持续负荷门槛由 `3 × planned` 的 9 抬到 15。
  - 今日教练动作：`TodayModel` 从 verdict signals 把 planned/trained 天数送入 `CoachActionEngine`，补量差额与“还差 N 天”按新账本计算；采纳仍只改账，不替用户新增训练。
  - 今日处方：`TodayPrescriptionEngine` 的上周顺延说明读取 planned；verdict 变化还会决定既有 mesocycle 相位调制与 FR-PL5 自动均衡能否进入 train-only 门控。每场基础模板、周期公式及自动均衡每场合计 `+2` 上限不变。
  - Settings/Onboarding：Settings 展示的是 profile 周天数，因此采纳后与计划页恢复单一真相；计划调整本身不调用 `OnboardingPlanInit`。以后用户改器械/目标触发既有 `completeOnboarding` 时，仍按同步后的天数重算模板（包括 splitType），本批未特殊化该路径。
  - 迁移/通知：`SchemaMigrator` 仅在旧 schema up/down 时消费 5 天 PPL 条件，本批不 bump schema、不触发迁移、不改 split；`RedeNotifications` 只有未来按天数缩放的注释，没有现行数值消费。
  - 调整记录读取方：`AppData.planAdjustmentHistory` 是唯一 typed 读入口；`SessionStore` 只用最后有效层生成当前收据/同 kind 抑制，收据的“现在”读取当前 clean program；`CanonicalSessionWriter` 是唯一 append/pop 写方。旧 `.planAdjustment` 生产读取已清零，只保留 history 缺键时的兼容解码。

- A 增频提案：
  - `WeeklyAdherence` 统一为同日去重训练天数，降频/增频都只取最近 4 个完整 ISO 周，排除进行中本周、首训前空周不补 0、中间空周计 0。
  - 最近四周整数中位数 `≤ planned−1` 出降频，`≥ planned+1` 出增频；目标钳 `2...6`，观测值保留未钳制事实；显式 XOR 与 no-op 守卫保证双向互斥。clean current 可为 `1...14`，因此 1→2、7→6 也能回到新目标范围。
  - UI 固定“提案在上、已采纳收据/撤销在下”；栈顶同 kind 抑制，不同 kind 可共存；“暂不”和撤销后的会话 snooze 按 kind 隔离。增频文案精确陈述四周事实，无表扬、说教、感叹号或负荷预告；中文频率单位统一为“天”。
  - RED→GREEN 覆盖：planned / planned+1 边界、仅最近四周、进行中周排除、同日多场去重、空周、2...6 钳制、互斥、current 1/7、不同 kind 共存、同 kind 抑制、per-kind snooze、精确中英串，以及 3→5 后 verdict 与 program/profile 同步且 split 不变。

- B 撤销栈：
  - canonical 新增 open-bag `planAdjustmentHistory`，每个新记录含 kind、program before/after、profile before/after；最多保留 20 个 raw 元素。新目标 after 必须同步且在 `2...6`，before 接受 clean `1...14` 或 profile 缺失快照。
  - history 键一旦存在即为读侧真源；仅在键完全缺失且旧 `planAdjustment` 有效时内存合成一层，不因读取迁移写回。legacy 兼容旧 writer 可产的 `1...14`（含 14→10），因没有 profile 快照只能明确按旧 program from/to 推定。所有真实采纳/撤销停写并清旧字段。
  - 写侧直接对 raw 数组 append，撤销从尾端只移除最后一个有效层；旧层未知字段、非对象/脏 sibling 原样保留，不做 decode→encode 清洗。无有效层或非数组 history 的撤销幂等且不 backup/save；采纳遇非数组 history、非对象 program/profile、脏 profile 天数、stale from、未知 kind、反向/no-op 或非法范围均在 backup/save 前 typed fail closed，原字节不动。
  - 实测与测试均走通 `reduce 5→2 → increase 2→5 → undo 回 2 → undo 回 5`；program/profile 每层同步恢复，history 由 2 层→1 层→空。另锁定 program/profile 原本不一致、profile before 缺失/14、被其他入口改过后的逐字段恢复、20 上限、legacy 撤销、脏栈不写回及 raw open-bag 保全。

- golden 零回归：
  - 从分支起点 `origin/main` `e4a711c658f5bb2afe004e50ec5d2c40e5275f43` 直接捕获旧共享 surface，而非在新实现上自生 expected。
  - 引擎 fixture：`plan-adjustment-normal-adherence.origin-main.input.json` / `.expected.json`；逐字节比较旧 proposal adapter surface。
  - App fixture：`plan-adjustment-normal-surface.origin-main.input.json` / `.expected.json`；逐字节比较旧版已有的 `proposal / activeTo / proposedWeekDays` 共享 surface。
  - 正常单场日、依从正常用户两组 byte golden 均通过；多场同日从“场次”纠正为“训练天”有独立预期变更测试，不冒充零回归。

- 规格写回：
  - `docs/REDE_MASTER_TECHNICAL_ARCHITECTURE.md`：仅改 §7 已批准 plan-frequency writer 条目，写入双字段同步、raw history、1...14/2...6、兼容与 fail-closed 契约；未顺手改其他章节。
  - `docs/REDE_iOS_SYSTEM_LOGIC.md` §8.1：四完整周训练天信号、双向互斥、全消费链、Settings 既有重算语义、raw 栈/legacy/LIFO/共存抑制与诚实文案。
  - `docs/REDE_PRD.md` FR-PL3/PL4：已做维度、明确不做维度、增频/撤销栈验收状态。
  - `docs/REDE_PRODUCT_COPY_BASELINE.md` §5.4：增频精确中英串、中文“天”、零说教与同屏规则。
  - `CHANGELOG.md` 2026-07-29、`DEV_LOG.md` 2026-07-29：行为变更、用户可见影响、验证与边界。

- gate：
  - 受影响四包全套：RedeTrainingDecision 445、RedeDomain 69、RedePersistence 103、RedeL10n 137，合计 `754/754`，0 failure。
  - 第一次有效 freeze（实现提交前）仓库根 `.claude/quality-gate.cmd`：exit `0`；10 个 SPM 包、ForgedCard 预算、真 `xcodebuild build`、App 白名单 `35/35`（其中 `SessionStoreDraftTests 14/14`）全绿。
  - 实现提交后，用 gate 产出的同源码 `Rede.app` 重新安装到 iPhone 17 Pro / iOS 26.5 Simulator，`simctl launch` 返回 Rede PID，临时屏幕截图目视确认前台是 Rede；未把临时图提交。
  - 尾部原文：
    `** TEST SUCCEEDED **`
    `Testing started`
    `QUALITY GATE: PASS`
  - 独立终审：`0 P0 / 0 P1 / 0 P2`；审查者独立复跑 Domain typed `12/12`、Persistence plan-adjustment `20/20`、Engine `13/13`，并目视核对 5 张流程图。唯一 P3 陈旧注释已删除，删除后已重新跑上述有效 freeze。
  - 第二次 freeze（本回执/PNG 提交前）仓库根 `.claude/quality-gate.cmd` 同样 exit `0`；10 个 SPM 包、预算、真 build 与 App `35/35` 全绿，尾部原文同上。

- 实拍与 canonical 实证：
  - `2026-07-29-planadj-01-reduce-proposal.png` — `45d3778e4c0914d0b0e8f8dfcb550f08`
  - `2026-07-29-planadj-02-increase-with-undo.png` — `219c87448fe78386a228b2e92b5d4006`
  - `2026-07-29-planadj-03-after-increase-today-train.png` — `98165aab64bcc75ff0d47753d302dc8b`
  - `2026-07-29-planadj-04-undo-one-back-to-reduced.png` — `078f82d9d84e8a1b0c31da20bd7e1568`
  - `2026-07-29-planadj-05-undo-two-history-empty.png` — `652286a0bc9f311635bc66c261f5ac7a`
  - 5 张均为真实 Rede 前台、`1206×2622` PNG，MD5 互异。流程依次证明降频提案、保留 reduce 收据时出现 increase、增频后今日按 5 天记账、撤一层回 2、再撤一层回 5 且入口消失。
  - Simulator canonical 真路径为 `Library/Application Support/RedeData/app-data.json`。实际读回：reduce 后 program/profile=`2/2` 且一层 reduce；保留该层注入四个完整周×5 天后出现 increase；采纳后=`5/5` 且两层；第一次撤销=`2/2` 且一层；第二次撤销=`5/5` 且 history 空。验收结束后已把测试前用户 canonical 按备份逐字节恢复并重新启动 Rede。

- 未尽事项 / 范围外疑点：
  - 本批范围内无已知 P0/P1/P2，验收项均关闭。
  - 强度停滞提案与周期结构提案继续后置；动作选择仍归 FR-T5，容量仍归 FR-PL5 自动式。未改 FR-T5、FR-PL5 算法、mesocycle、FR-PL7、回归/每周循环、订阅、schema、版本、Package.swift、`project.pbxproj` 或 `TrainTabView`。
  - legacy 记录的 profile before/after 是兼容推定，不是历史实测；规格与代码均明确保留该限制。
  - 未 push、未开 PR；最终分支只留两笔本地提交（实现 + 回执/截图）。
