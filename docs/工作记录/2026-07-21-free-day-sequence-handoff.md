# 交接件：训练日构成自由编排（FR-PL7③）——用户想怎么排就怎么排

> 日期：2026-07-21 ｜ 来源：owner「用户是 5 天推拉腿之后还想推拉怎么办」+ 纲领纠正「**不理想但用户不会理解你的理想，他们只想贴合自己**」
> 性质：引擎公共接口语义放宽（守卫）+ 核心产品能力（用户控制权兑现）
> 执行：Codex（专家档 gpt-5.6-sol + ultra）｜验收：Claude 主会话（多 lens + 对抗核验）

## 一句话成果

5 天用户想要「推 A / 拉 A / 腿 A / 推 B / 拉 B」，能在日序编辑器里**直接排出来**——换类型、加天、删天，不需要靠改动作凑，不被说教。

## 现场事实（已核实，勿再花时间重查）

| 位置 | 现状 |
|---|---|
| `TodayPrescriptionEngine.daySequence(splitType:)` :78 | 硬映射：full→[full-a,b,c]｜ppl-ul(5天)→[push-a,pull-a,legs-a,upper,lower]｜ppl/push(6天)→[push-a,pull-a,legs-a,push-b,pull-b,legs-b]｜默认→[upper,lower] |
| `resolvedDaySequence(splitType:override:)` :116 | **守卫 = 严格排列**：`override.count == base.count && Set(override) == Set(base)` 才采用，否则回退默认。→ 只能重排，不能换成员/加减天。**本批放宽的就是这里** |
| `nextDayCode` :105 | `seq[completedSessionCount % seq.count]`——**按场次轮转，不按周对齐**（序列长度与每周天数天然解耦，5 天/周 + 6 元素序列 = 自动滚动） |
| `slots(dayCode:)` :254 | switch 认识 push-a/b、pull-a/b、legs-a/b、full-a/b/c、lower；**`default:` 静默兜底 upper** ← 2026-07-20「推 A 混拉类」疑点根源 |
| `PlanDaySequenceEditorView.swift` | 311 行；长按拖动重排 + VoiceOver 上下移动作；操作区已与日编辑器同构（全宽采纳/右上 ✕/恢复默认暂存化）；**当前不加撤销条**（理由：重排无删除动作） |
| `PlanDayEditUndoModel` / `PlanDayEditRules` | RedeTrainingDecision 内纯模型，日编辑器在用（撤销栈 12 测 + applyResolution 三分支），**日序编辑器已复用 applyResolution** |
| 数据 | `planCustomization.daySequence?: [dayCode]` 是 open-bag 顶层字段，**schema 不用改**；写闸 `applyCustomDaySequence / removeCustomDaySequence` 已存在 |
| 规格 | PRD FR-PL7（:168）、系统逻辑 §8.2 日序编辑器 UI 段（:1190）、§6.0.1 生成规则（:166）、FR-PL6/PL7 引擎 seam（:168 行附近「② 日序覆盖」） |

## 裁定 A：引擎守卫放宽（关键决定，本批核心）

`resolvedDaySequence` 守卫改为：

1. **显式合法白名单**——新增 `public static let knownDayCodes: Set<String>`，含全部 11 个：`push-a, push-b, pull-a, pull-b, legs-a, legs-b, upper, lower, full-a, full-b, full-c`。
   ⚠️ **红线**：白名单必须显式枚举，**不得依赖 `slots()` 的 `default:` 兜底**——未知 code 静默变上肢日正是 7-20 那次误判的根源。白名单与 `slots()` 的 case 集合必须有测试锁定同步（漏一个就是静默降级）。
2. **新守卫**：override 非空 + 长度 ≤ 14（两周量级护栏，防脏数据造巨型序列）+ **每个成员都在 `knownDayCodes` 内** → 采用；任一不满足 → 整体回退默认（**不做部分采纳**，保持既有优雅降级姿态）。
3. **允许重复成员**（如 `[push-a, pull-a, legs-a, push-a, pull-a]`）——用户自由优先；dayCode 只决定处方模板，重复不破坏任何既有语义。
4. **长度与 daysPerWeek 解耦**：序列长度不必等于每周训练天数（引擎本就按场次轮转）。规格写回时写明这点。
5. `isCustomized` 判定：override 合法 **且 ≠ 默认序**（沿用既有口径，勿改）。
6. **override=nil 逐字节等价现状**（golden 零回归，必须有测试证明）。

## 裁定 B：日序编辑器 UI（PlanDaySequenceEditorView）

在现有拖动重排基础上加三件：

1. **换类型**：每行加「换」按钮（与日编辑器的换动作按钮同 idiom）→ 选择器列全部合法训练日类型，用本地化名（`s.trainingDayName(code)`），按族分组呈现（推/拉/腿/上下/全身）；选中即替换该位置。
2. **加一天**：列表末尾「添加训练日」开放行（与日编辑器「添加动作」同 idiom，ember2）→ 同一选择器。上限 14。
3. **删一天**：行内移除按钮（与日编辑器移除同 idiom）；**至少保留 1 天**（剩 1 天时该按钮 disabled，不是隐藏）。
4. **加撤销条**（⚠️ **翻转上批裁定**）：上批「不加撤销条」的前提是「重排无删除动作」——本批引入删除，前提消失，故**必须加**，且**复用 `PlanDayEditUndoModel`**（不新造轮子）。行为与日编辑器一致：移除后出「已移除「训练日名」· 撤销」，逐步还原到原下标；换类型/拖动重排**不入栈**（同 swap 先例）；恢复默认/采纳/取消清栈。
5. 操作区（全宽采纳/右上 ✕/恢复默认）与触感（移除·撤销=light、恢复默认=medium、采纳=success）沿用现状与同一分档，**加的两个新动作**（换类型、添加）不加震（同日编辑器 add/swap 无震先例）。
6. 「下一个训练日将变为 X」预览随任何编辑实时跟随（既有能力，勿破坏）。

## 裁定 C：护栏姿态——**不教育用户**（owner 纲领，最高优先）

- 「改动影响」预览保持**中性事实句**（如「腿部每周 1 次」），**禁止**：警告色、说教句、劝阻文案、二次确认弹窗、任何「建议你…」。
- **不阻止**任何合法编排，哪怕肌群频率很低。
- 频率补偿由既有**自动均衡（FR-PL5）**在后台安静做（owner 已拍板「不要建议直接自动改」「不要小字」），本批不动它。
- 若现有影响预览对新场景（如某肌群 0 次）无话可说，输出**中性事实**或不显示，不得新增劝导语。

## 裁定 D：不动的东西（红线）

- `slots()` 的 `default:` 兜底行为本批**不改**（属另一议题，已在 7-20 调查报备）；本批只是**不再依赖它**。
- 轮转公式、`rotationOffset`、FR-TR12 换天练、回归协议、每周循环模式、`dayPlans`（动作自定义）语义——**一律不动**。
- schema 不变（daySequence 已是 open-bag）；写闸只走既有四方法。
- 版本号不动（1.9.1/27 已上传，本批进下个 bump）。
- 日编辑器（`PlanDayEditorView`）本批**不动**。

## 验收标准（owner 大白话）

1. 5 天用户进「调整训练日顺序」→ 把第 4、5 天换成推 B、拉 B → 采纳 → 今日页/计划页按「推拉腿推拉」走
2. 能加一天、能删一天（只剩一天时删不掉）
3. 删错了有撤销条，能一步步撤回
4. 腿练得少不会被弹警告或说教，也不会被拦住
5. 没自定义过的老用户，看到的和以前**一模一样**
6. 杀进程重开，自定义的日序还在

## 验证与证据（企业验收标准）

1. **纯模型/引擎测试先红后绿**：白名单与 `slots()` case 集合同步锁、非法 code 回退、超长回退、空回退、重复成员采用、长度≠daysPerWeek 采用、override=nil 等价现状（golden）、`isCustomized` 边界。
2. **模拟器实拍**（装前必真 `xcodebuild build`；截图前确认前台是 Rede；钩子传 **canonical dayCode**）：换类型选择器、换成推拉腿推拉后的序列、加天、删天+撤销条、采纳后计划页/今日页跟随。PNG 前缀 `2026-07-21-freeseq-` 存 `docs/工作记录/`。**证据图必须互不相同（md5 查重）**——端态像素重合会产生字节级同文件，中间态才有独立证明力（前两批教训）。
3. **canonical 实证**：采纳后读 `planCustomization.daySequence` 实际写入值；恢复默认+采纳后归 null。
4. **每 commit 仓库根 `.claude/quality-gate.cmd` exit 0**（freeze-once：代码冻结点一次 + 文档冻结点一次）。
5. **规格写回**（改引擎语义必须同批 grep 全部 canonical 文档写回——本仓铁律）：PRD FR-PL7（③ 新增能力 + 行为变更标注）、系统逻辑 §8.2 日序编辑器 UI 段 + FR-PL6/PL7 引擎 seam 的「② 日序覆盖」段（守卫语义变了）+ §6.0.1 生成规则（序列长度与每周天数解耦）、设计语言（§12.3 编辑类 sheet 操作区通例已存在，看是否需补选择器 idiom）、文案基线（新串）。
6. 新 L10n 串走精确断言测试。

## Git 纪律

- 从最新 `origin/main` 拉分支 `codex/0721-free-day-sequence`（先 `git fetch`）。
- owner 有并行会话习惯：每次 commit 前重跑 `git status` 确认无他人改动混入；`git add` 用明确 pathspec，**禁用 `-A`**。
- 小步提交（引擎/UI/文档可分）；**不 push、不开 PR**（主会话验收后统一走）。

## 停止条件

- 同一问题修 3 次不过即停并回报。
- 触红线、发现行为歧义、或需要改变本交接件裁定 → 立即停下回报，不自行改裁定。

## 实施回执模板（收尾必填**回填本文件末尾**）

```
## 实施回执
- 分支与 commit 清单：[hash + 一句话]
- A 引擎守卫：[白名单实现 + 新守卫逻辑 + 测试清单（含 golden 等价证明）]
- B 编辑器 UI：[换类型/加/删/撤销条 四项确认 + 实拍文件名]
- C 护栏姿态：[影响预览如何处理低频场景 + 确认零说教]
- 规格写回：[逐份文档逐节]
- gate：[exit code + 尾部原文]
- 未尽事项 / 范围外疑点：[如实列]
```

## 实施回执

- 分支与 commit 清单：`codex/0721-free-day-sequence`；`7320979 feat: allow free training day sequences`（引擎、编辑器、FR-TR12 展示兼容与测试）；文档、证据与本回执由本文件所在的收尾 commit `docs: record free day sequence delivery` 提交（commit 自引用，hash 以当前 `HEAD` 为准）。未 push、未开 PR。
- A 引擎守卫：`knownDayCodes` 显式枚举且只枚举 `push-a / push-b / pull-a / pull-b / legs-a / legs-b / upper / lower / full-a / full-b / full-c`；独立穷举 `SlotDayCode.allCases` 与白名单同步锁测试，未依赖 `slots()` 的 unknown→upper 既有兜底。override 仅在非空、长度 `1...14`、全员合法时整条采用；允许重复、换成员且长度与 `daysPerWeek` 解耦，空/超长/任一未知/原始 JSON 混入非字符串均整条回退默认，不做部分采纳。测试锁定 5 天「推拉腿推拉」、重复成员、1 与 14 边界、长度解耦、非法整体回退、每周投影、`isCustomized` 边界、白名单与 slots 同步；`override=nil` 以排序 JSON 字节 golden 证明输出逐字节等价现状。独立审查发现的 mixed-type 部分清洗 P1 已先红后绿修复，定向复审确认关闭且无新增 P0/P1/P2/P3。
- B 编辑器 UI：已完成逐行换类型、末尾加天、删到至少保留 1 天、复用 `PlanDayEditUndoModel` 的 LIFO 撤销条；重复 dayCode 使用 occurrence identity，换类型/添加/拖动不入撤销栈，恢复默认/采纳/取消清栈，14 天时添加禁用。装前真实 `xcodebuild build` 为 `BUILD SUCCEEDED`，截图前均确认前台为 Rede，自动化钩子传 canonical dayCode。实拍及 MD5：`2026-07-21-freeseq-01-type-picker.png`（`5173833b6b91ebc43a115356867e0096`）、`02-push-pull-legs-push-pull.png`（`8181a8871394c274dbce1ae85ebdec11`）、`03-added-full-body-day.png`（`3fa379ef00a6e4b2ac969390c4865944`）、`04-removed-with-undo.png`（`533dfa95a45086ba80c048568a013210`）、`05-applied-plan.png`（`6b90c2168343a5d7750830f0c3381a89`）、`06-relaunch-today.png`（`1bcddae399c12bbdda1b60c3eb40a3a7`）、`07-restored-default-plan.png`（`bc377a7ba8ee4f6250feca3a8ffbeea7`）、`08-undo-restored-and-reordered.png`（`77632f7e70b7b74055afded4f025c625`）；8 个 MD5 全异。canonical 实读采纳后为 `["push-a","pull-a","legs-a","push-b","pull-b"]`，杀进程重开今日页跟随；恢复默认并采纳后为 `null`。
- C 护栏姿态：自由日序的影响预览只保留「下一个训练日将变为 X」中性事实；低频、重复或缺少某日型时不显示警告色、不说教、不劝阻、不二次确认、不阻断合法采纳。FR-TR12 只按 owner 追加裁定改展示层：候选按 dayCode 去重保序并排除当前处方日，入口按去重后种类数 `> 1` 判断；重复候选与全同序列两条测试已锁定。`applyDayOverride`、`oneTimeDayOverride`、`rotationOffset` 消费/补偿、回归协议、每周循环、撤销路由、二选一语义与文案均未改。
- 规格写回：`docs/REDE_PRD.md` 写回 FR-PL7③、FR-PL6.1、FR-TR12 与非目标边界；`docs/REDE_iOS_SYSTEM_LOGIC.md` 写回 §6.0.1 生成规则、§6.0.1a FR-TR12、FR-PL6/PL7 engine seam、raw→clean fail-closed、§8.2 编辑器与中性护栏；`docs/REDE_PRODUCT_DESIGN_LANGUAGE.md` 写回 §12.3 分组类型选择器 idiom 与 §14.2 训练日移除触感；`docs/REDE_PRODUCT_COPY_BASELINE.md` §5.4 写回全部新中英文串及零说教红线；`CHANGELOG.md` 与 `DEV_LOG.md` 追加本批工程事实、用户可见结果、证据和边界。Master 与商业 Roadmap 经只读对账无冲突、无需改写。
- gate：代码冻结点与文档冻结点均在仓库根执行 `.claude/quality-gate.cmd`，均为 exit 0；两次尾部原文相同：

```text
** TEST SUCCEEDED **

Testing started
QUALITY GATE: PASS
```

- 未尽事项 / 范围外疑点：Simulator 已证明可见流程、canonical 写入、杀进程恢复与默认收敛；长按拖动的真手指手感和系统触感强弱仍留 TestFlight/实体设备复验。schema、版本号、`slots()` unknown 兜底、轮转公式、自动均衡、回归/每周循环、日编辑器均未改。无关未跟踪文件 `1` 与 `docs/工作记录/2026-07-21-exercise-content-wave-handoff.md` 未触碰、未纳入提交。
