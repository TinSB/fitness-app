# 交接件：疼痛信号接线（FR-TR7 后半）+ 伤病筛查（FR-SE7）

> 日期：2026-07-27 ｜ 来源：主会话开发路径盘点「第一档：说了但没做到的」，owner 拍板先修这两条
> 性质：**引擎语义变更**（疼痛/伤病信号首次进入处方决策）+ 新设置面 + **医疗边界红线**
> 执行：Codex（专家档 gpt-5.6-sol + ultra）｜验收：Claude 主会话（多 lens + 对抗核验）

## 为什么做这两条

**用户告诉了系统，系统装作在听。** 这比没这功能更伤信任：

- 训练中跳过动作可选原因「不适/疼痛」，记录**确实落盘**了——但引擎读不到，等于写进去没人看。PRD 把 FR-TR7 标成 MVP 已交付，实际只做了登记那一半。
- `injuryFlags` 字段孤零零存在，**没有任何入口能填**，引擎也不消费。

Rede 的立身之本是「每个建议都有理由、可解释」。收了用户输入却不兑现，是产品原则问题。

## 现场事实（已核实，勿重查）

| 环节 | 现状 |
|---|---|
| 训练中登记 | `SetSkipReason.painDiscomfort` 已存在（`SessionIntentModels.swift:9`）；跳过组/跳过动作两条路径都带 reason |
| 落盘 | `CompletedSessionBuilder.swift:65-82` 写 `storage["skippedSets"]`（含 setIndex + reason）与 `storage["skippedExercises"]`（含 exerciseId + reason）——**数据是全的** |
| **断点①** | `CleanTrainingSession`（`CleanAppDataView.swift:35-45`）**只有 id / date / exercises**，跳过记录没进 clean 层 |
| **断点②** | `CleanTrainingDecisionInput`（:17-21）只有 sessions / profile / program / todayISO，没有任何疼痛面 |
| 伤病字段 | `UserProfile.injuryFlags`（`UserProfile.swift:20`）是个读 storage 的 computed getter，**全仓无写入、无消费**；`CleanProfile`（:48-57）也没有这个字段 |
| 引擎进阶决策 | 在 `TodayPrescriptionEngine`（负荷/进阶计算），本批要在此接入"暂停进阶"；写闸四方法与 `performGatedMutation` 已存在，profile 写入走既有路径 |

## 裁定 A：疼痛信号 → 暂停进阶（**不是**自动换动作）

### A1 信号定义（写死，不许自行改阈值）

对每个 `exerciseId` 统计：**最近 4 场已完成训练**中，被以 `painDiscomfort` 原因跳过（整动作跳过 **或** 该动作有任一组跳过）的**场次数**。

- **≥ 2 场** → 该动作进入「保守态」
- 1 场 → 不触发（可能是器械不合适/当天状态，不是模式）
- 窗口只看最近 4 场：三个月前的一次不适不该永久压着用户

### A2 保守态的行为（**只做这一件**）

**该动作暂停进阶——保持上次重量，不涨。** 其余一切不变：动作还在计划里、组数次数不变、用户照常可以练、可以照常手动改重量。

**明确不做**（防止 Codex 扩大解释）：
- ❌ 不自动替换成别的动作（用户会困惑「我的动作怎么没了」；换不换是用户的决定，FR-TR6 已有入口）
- ❌ 不把动作从计划里删掉
- ❌ 不改 RIR / 不改组数 / 不减训练量
- ❌ 不弹任何提示、警告、确认框

### A3 理由句（用户能看见的唯一变化）

在该动作的处方行/依据里给一句**中性事实**：
「上次这个动作报过不适，这次先不加重」/ 英文原生对应句。

- 走 `RedeL10n` + 精确断言测试
- **医疗红线**：不诊断、不写「你受伤了」、不写「为了保护你」、不保证防伤、不写「建议休息」
- 不加「持续不适请咨询专业人士」——训练页底部已有常驻免责句，不重复

### A4 恢复条件

用户再正常完成该动作 **1 次**（无 painDiscomfort 跳过）→ 立即退出保守态，恢复正常进阶。不搞衰减曲线，简单可预期。

## 裁定 B：伤病筛查（FR-SE7）

### B1 入口

设置页「训练背景」区新增一行「**身体状况**」（沿用铭牌行 idiom：行内显示当前值或 `—`，点进去多选 sheet）。

选项用**大白话部位**，不用医学术语：膝盖 / 肩膀 / 下背 / 手肘 / 手腕 / 脚踝 / 颈部。可多选、可全不选。

sheet 内一句说明（**唯一允许的说明文字**）：「选了的部位，相关动作不会自动加重」——只讲行为，不讲医学。

### B2 数据

写既有 `injuryFlags: [String]`（open-bag，**不改 schema**），走既有写闸 `performGatedMutation` 路径；`CleanProfile` 增加该字段（builder 校验：只认白名单部位码，未知值丢弃并在 issues 留痕，同既有 equipmentScenario 先例）。

### B3 引擎消费（与 A2 同一个行为，不新造机制）

标记了某部位 → 该部位**高风险动作模式**的动作进入与 A2 **完全相同的保守态**（暂停进阶，其余不变）。

部位 → 动作模式映射（写死在引擎内，可测）：
- 膝盖 → squat / lunge / leg-extension 系
- 肩膀 → overhead-press / bench-press / lateral-raise 系
- 下背 → hip-hinge（硬拉/早安）/ bent-row / good-morning 系
- 手肘 → triceps-extension / curl 系
- 手腕 → front-rack / 直杆推举系
- 脚踝 → calf-raise / 深蹲系
- 颈部 → shrug / 颈后动作系

映射用**现有 pattern 字段**判定（`movementPattern`），不要新增目录字段。

理由句同 A3 口径，但文案区分来源：「你标记了肩膀，这个动作先不加重」。

## 裁定 C：红线（违反即返工）

1. **医疗边界**：全程不诊断、不治疗、不保证防伤、不建议就医之外的任何医学处置；文案只描述**系统行为**。
2. **golden 零回归**：无疼痛记录 + 无伤病标记时，引擎输出**逐字节等价现状**，必须有测试证明。
3. **不动**：FR-TR6 换动作、自动均衡 FR-PL5、轮转、回归协议、每周循环、自定义计划（FR-PL6/PL7）、订阅面。
4. **不新增 schema**：`injuryFlags` 是 open-bag 既有字段；跳过记录已在 storage 里，clean 层只是把它**读上来**。
5. 不弹窗、不加常驻小字、不做「建议你…」（owner 纲领：不教育用户）。
6. 版本号不动。

## 验收标准（owner 大白话）

1. 某个动作我连着两次因为疼跳过 → 下次它**不再自动加重**，处方行有一句「上次这个动作报过不适，这次先不加重」
2. 我正常做完一次这个动作 → 下次恢复正常加重
3. 设置 → 训练背景 → 身体状况，能勾「膝盖」；勾了之后深蹲这类动作不再自动加重，其余照旧
4. 没勾任何部位、也没报过疼的用户 → **App 行为和以前一模一样**
5. 全程没有弹窗、没有警告、没有说教，也没人告诉我「你受伤了」

## 验证与证据

1. **测试先红后绿**（引擎语义变更必须）：4 场窗口边界（第 4 场 vs 第 5 场）、1 次不触发 / 2 次触发、完成 1 次即恢复、跳过组 vs 跳过整动作两条路径、伤病部位→模式映射逐条、**golden 零回归**（无信号时逐字节等价）、clean 层脏数据（未知 reason / 未知部位码）丢弃留痕。
2. **模拟器实拍**（装前真 build、确认前台是 Rede）：①设置页身体状况行 + 多选 sheet ②勾了膝盖后深蹲处方行的理由句 ③疼痛两次后的处方行 ④恢复后正常加重。PNG 前缀 `2026-07-27-painsignal-`，**md5 必须互异**。
3. **canonical 实证**：勾选后读 `injuryFlags` 实际写入值；取消勾选后归空。
4. 仓库根 `.claude/quality-gate.cmd` exit 0（freeze-once 两冻结点）。
5. **规格写回**（引擎语义变更必须同批 grep 全部 canonical 文档）：PRD FR-TR7（状态从 MVP 改为如实描述两段能力）+ FR-SE7；系统逻辑（引擎输入新增信号面 + 保守态判定 + 部位映射表）；文案基线（新串 + 医疗边界红线）；CHANGELOG / DEV_LOG。
6. 新 L10n 串精确断言测试。

## Git 纪律

- 先 `git fetch`，从最新 `origin/main` 拉分支 `codex/0727-pain-injury-signal`。
- 每次 commit 前重跑 `git status`（owner 有并行会话习惯）；`git add` 用明确 pathspec，**禁用 `-A`**。
- 小步提交（clean 层 / 引擎 / 设置页 UI / 文档 可分）；**不 push、不开 PR**。

## 停止条件

- 同一问题修 3 次不过即停回报。
- 触红线、发现行为歧义、或需要改变本交接件任一裁定 → **立即停下回报，不自行改裁定**（上一批你在这点上做得对，保持）。

## 实施回执模板（收尾必填**回填本文件末尾**）

```
## 实施回执
- 分支与 commit 清单：[hash + 一句话]
- A 疼痛信号：[clean 层打通方式 + 4 场/2 次判定 + 保守态实现点 + 恢复条件 + 测试清单]
- B 伤病筛查：[设置页入口 + 写闸路径 + 部位映射实现 + canonical 实证]
- C 医疗边界：[逐条确认无诊断/无治疗/无防伤保证 + 新串全文]
- golden 零回归：[证明方式]
- 规格写回：[逐份文档逐节]
- gate：[exit code + 尾部原文]
- 实拍：[文件名 + md5]
- 未尽事项 / 范围外疑点：[如实列]
```

## 实施回执

- 分支与 commit 清单：分支 `codex/0727-pain-injury-signal`，基线 `origin/main@b634d2c885c6897fe563f69524270a61a8f437cb`；`af0eb8a feat: wire pain and injury progression holds`（clean input、处方引擎、写闸、设置 UI、L10n 与测试）；`docs: record pain and injury signal acceptance`（canonical 规格、日志、实拍与本回执；本文件不能自指所在 commit 的 hash，以该提交后的分支 HEAD 为准）。未 push、未开 PR。
- A 疼痛信号：DataHealth 从已完成场次的 `skippedSets` 与 `skippedExercises` 读取 `painDiscomfort`，同场同动作合并去重后投影为 `CleanTrainingSession.painDiscomfortExerciseIds`，未知/畸形 reason 丢弃并留 `sessionFieldIgnored`；处方只按日期与同日 canonical append 顺序取全局最近 4 场，某动作在至少 2 个不同场次命中才进入保守态。`TodayPrescriptionEngine` 只在原判定要走更难负荷进阶时把目标钳在该动作上次重量，动作、组数、次数、RIR、变轻/持平判定与手动改重均不变；激活后出现 1 场无 pain 跳过的正常完成即恢复。测试先红于缺失策略 API，最小实现后又以 `cable-pull-through` 被误排除、同日表现误取 20kg 而非 canonical 最后一场 40kg 两项 RED 暴露边界，修正后 `PainInjuryProgressionTests` 21/21、clean 投影与脏数据测试全绿；覆盖 1 次不触发、2 次触发、第 4/第 5 场窗口、跳过组/整动作、同场去重、完成一次恢复、pain 优先级、负荷方向与同日 append 顺序。
- B 伤病筛查：设置 → 训练背景新增「身体状况 / Body areas」铭牌行与多选 sheet，可选膝盖、肩膀、下背、手肘、手腕、脚踝、颈部，可全不选；唯一说明为「选了的部位，相关动作不会自动加重 / Exercises related to selected areas won't increase automatically」。保存经 `CanonicalSessionWriter.applyInjuryFlags` → 既有 `performGatedMutation` 的备份、校验、原子写入路径，成功后从 canonical 重读；未知码拒写，clean 读侧丢弃并留痕，清空显式写 `[]`。既有 `userProfile` 为 string 或 array 时先 RED 证明会被覆盖，现改为抛 `ScreeningWriteError.profileNotObject`，在备份/保存前 fail-closed 且原文件逐字节不变，`InjuryFlagsWriteTests` 3/3。映射集中在引擎包纯函数 `ProgressionPausePolicy.injuryFlag(_:matches:)`：膝盖=`squat-pattern/lunge/knee-extension/knee-flexion`；肩膀=`vertical-press/horizontal-press/lateral-raise/rear-delt`；手肘=`triceps-extension/curl`；脚踝=`calf-raise/squat-pattern`；手腕仅命中 barbell+`vertical-press/horizontal-press/curl`、ID 含 `front-squat` 或 push-up 类；下背命中 raw pattern `hinge` 全部、barbell/smith squat-pattern 与 ID 白名单可辨的无支撑俯身 horizontal-pull，并排除 `chest-supported/seated/machine/cable/leg-press/hack`；颈部命中 `shrug` 与 ID 含 `behind-neck`。每条规则均有正反例；无法由现有 ID 稳定判断时刻意不扩大命中。专用 Simulator canonical 实证：勾膝盖后 `userProfile.injuryFlags == ["knee"]`，取消后为 `[]`。
- C 医疗边界：确认没有诊断、治疗、防伤或无痛保证，没有「你受伤了 / You are injured」「为了保护你 / To protect you」，没有休息、就医、换动作建议，也没有新增弹窗或警告。处方新增全文仅为「上次这个动作报过不适，这次先不加重 / Discomfort was noted for this exercise last time, so it won't increase today」与参数化「你标记了肩膀，这个动作先不加重 / You marked your shoulder, so this exercise won't increase today」；设置说明仅为上一条所列行为句。`PainInjuryCopyTests` 3/3 精确断言中英文与禁词。
- golden 零回归：从本批 `origin/main` 基线捕获并提交 5 份完整处方 JSON（deload、first-exposure、legs-day、progression、pull-day），测试对无 pain、无 injury 输入的当前编码结果做完整 `Data` 逐字节比较，5/5 通过；新增可选字段无信号时省略，既有输出字节不变。
- 规格写回：`docs/REDE_PRD.md` 更新产品原则、FR-TR7 与 FR-SE7；`docs/REDE_iOS_SYSTEM_LOGIC.md` 更新 clean 输入、写闸 fail-closed、4 场窗口、同日 canonical 顺序、唯一暂停行为、恢复与完整窄映射；`docs/REDE_PRODUCT_COPY_BASELINE.md` 更新 §5.1、§5.5、§7.1 的中英文精确串与医疗红线；`CHANGELOG.md` 记录工程范围、修复与证据；`DEV_LOG.md` 记录用户可见里程碑、实拍与边界。规格 grep 对账未发现仍把本批描述为旧粗映射或“只登记不消费”的活文档漂移。
- gate：冻结点 1（最终源码、代码提交前）与冻结点 2（本回执内容冻结后、文档提交前）均在仓库根执行 `.claude/quality-gate.cmd`，exit 0；每次覆盖 10 个 Swift 包 1035 tests + app-hosted 29 tests，共 1064 tests，且 generic iOS Simulator build 成功。尾部原文均为 `** TEST SUCCEEDED **`、`Testing started`、`QUALITY GATE: PASS`。另在安装实拍前独立真跑 `xcodebuild -project ios/Rede.xcodeproj -scheme Rede -destination 'generic/platform=iOS Simulator' build`，结果 `** BUILD SUCCEEDED **`。
- 实拍：均为最终源码构建安装到专用 iPhone 17 Pro Simulator，截图前已确认 Simulator 窗口为 `Rede PainSignal Final 20260729` 且前台 App 为 Rede；5 张均为 1206×2622，md5 互异：`2026-07-27-painsignal-settings-row.png` = `c12b585bc69154ea8a327d7bcac716e2`；`2026-07-27-painsignal-injury-picker.png` = `8b0427006d33f6834aececd740e9a273`；`2026-07-27-painsignal-knee-squat.png` = `5e3f2b138d5fa9efbe345126394da3ad`；`2026-07-27-painsignal-pain-hold.png` = `47f3c0dd1b9d8d6540c53b1b4eb5dfa6`；`2026-07-27-painsignal-recovery.png` = `8f0af826243afae71b0d0de398478bcc`。画面分别证明设置行、多选与唯一说明、膝盖→深蹲 60kg 保持、两次 pain→卧推 60kg 保持、正常完成一次→卧推 62.5kg 恢复加重；专用临时 Simulator 验收后删除。
- 未尽事项 / 范围外疑点：catalog 的髋铰链 raw pattern 实际名为 `hinge`，实现按该现有事实精确匹配；当前 catalog 未发现 `behind-neck` ID，因此颈部现阶段实际只命中 shrug。手腕 push-up 与下背无支撑划船依赖批准的窄 ID 关键词，命名不规范的动作宁可暂不命中，不扩大为可能误伤的粗匹配；若未来 catalog 改名或新增变体，应以独立目录维护批次补正测试。FR-TR6 换动作、自动均衡、轮转、回归协议、每周循环、自定义计划、订阅、schema 与版本号均未改；版本保持 1.9.2 (28)。独立审查结论 0 P0 / 0 P1 / 0 P2。并行会话的未跟踪文件 `docs/工作记录/2026-07-29-safety-note-wave-handoff.md` 未读取、未修改、未暂存。
