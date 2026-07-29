# 交接件：「跳过这个动作」补原因选择（FR-TR7 配套，疼痛信号第二入口）

> 日期：2026-07-29 ｜ 来源：疼痛批（#716）验收发现的产品缺口，owner 点芯片立项
> 性质：训练页 UI 交互补全（落盘/引擎/清洗全部已就绪，**只补 UI 入口**）
> 执行：Codex（主控档 gpt-5.6-terra + high）｜验收：Claude 主会话
> ⚠️ **并行批次**：主工作树正在跑 FR-PL3/PL4（引擎+计划页）。本批在独立 worktree，**只许改**：`ios/Rede/TrainTabView.swift`、必要时 RedeL10n 新串及其测试、PRD FR-TR7 段、系统逻辑对应段、TestFlight 验收清单、CHANGELOG/DEV_LOG、证据 PNG。**严禁碰**引擎包（RedeTrainingDecision/RedeDataHealth）、计划页、SessionStore。

## 为什么

用户最自然的操作「直接跳过整个动作」现在**不问原因、一律记 `.other`**——疼痛信号（最近 4 场 ≥2 场因痛跳过 → 暂停进阶）只能靠「跳过这一组 → 不适/疼痛」触发。#716 验收把这条定为 MAJOR，当批只改了文档如实说明，本批补交互本体。

## 现场事实（已核实）

| 位置 | 现状 |
|---|---|
| `TrainTabView.swift` moreSheet（~1300） | 「跳过这一组」Overline + 四码原因行（`["equipmentBusy","painDiscomfort","fatigue","timeShort"]` → `sheetActionRow(s.skipReasonLabel(code)) { skipSet(code) }`）；EngraveDivider 后是「跳过这个动作」单行直发 `skipExercise()` 和「换动作」行 |
| `skipExercise()`（~1743） | 固定 `apply(.skipExercise(.other))`，无原因 |
| 下游 | `TrainFlowState.skipExercise(reason:)` 本就收 `SetSkipReason`；落盘 `skippedExercises[].reason` 已支持；clean 投影与引擎判定已就绪（#716）——**零下游改动** |
| 两步先例 | 今日页换天练（FR-TR12）「同一 sheet 内分两步」pattern（`pendingDayOverride` 驱动步骤切换，不叠 sheet） |

## 裁定（写死）

1. **交互 = 同一 sheet 内两步**（FR-TR12 先例，不叠 sheet 不弹新窗）：点「跳过这个动作」→ sheet 内容原地切换为 Overline「跳过这个动作」+ **同样四码原因行**（复用 `s.skipReasonLabel`）→ 选中即 `skipExercise(reason:)` 并关 sheet。
2. **四码，不加第五项**：与跳过组完全一致（equipmentBusy / painDiscomfort / fatigue / timeShort）。不提供「不想说」——四码里 timeShort/fatigue 已覆盖低摩擦出口；`.other` 保留为旧数据兼容值，新记录不再产生。
3. **返回路径**：两步态下 sheet 的下滑关闭 = 取消（不跳过）；若一步态有「取消/收起」既有 idiom 则沿用，没有就不加。
4. 文案：Overline 直接复用既有 `s.skipExerciseAction` 串（「跳过这个动作」）；四码复用 `skipReasonLabel`。**预期零新串**；若实现中确需新串（如返回行），走 RedeL10n + 精确断言。
5. 触感/动画：与跳过组行为完全一致，不新增。
6. a11y：两步切换后 VoiceOver 能读到四个原因行（对照跳过组的既有处理）。

## 红线

- ⛔ 不碰引擎包、SessionStore、计划页（并行批次 + 下游已就绪）。
- ⛔ 不改跳过组的既有交互。
- ⛔ 医疗边界与零说教纪律照旧（本批预期零新文案，若有新串同样约束）。
- 版本号不动。

## 文档写回（把 #716 的临时说明改回如实）

1. PRD FR-TR7：删「当前只有跳过组能携带疼痛原因，整动作跳过一律记 other」的临时说明，改为两条路径均可携带原因。
2. 系统逻辑对应段：同上修正。
3. TestFlight 验收清单：疼痛信号的「正确验法」补充整动作跳过路径（两条路都能验）。
4. CHANGELOG / DEV_LOG 各一条。

## 验收标准（owner 大白话）

1. 训练中点「跳过这个动作」→ 出现和跳过组一样的四个原因；选「不适/疼痛」→ 动作被跳过
2. 连续两场这样做 → 下次这个动作不再自动加重（疼痛信号被真实触发）
3. 跳过组的老交互一点没变
4. 下滑关掉选择面 = 没跳过，一切照旧

## 验证与证据

1. **canonical 实证**（核心）：整动作跳过选「不适/疼痛」后，落盘 `skippedExercises[].reason == "painDiscomfort"`（读文件实证，不看 UI 猜）。
2. **模拟器实拍**（装前真 build、前台确认 Rede、md5 互异）：①两步态四码原因面 ②选疼痛后动作被跳过的训练页。PNG 前缀 `2026-07-29-skipreason-`。
3. 仓库根（worktree 根）`.claude/quality-gate.cmd` exit 0（一次冻结点即可，UI 小批）。
4. 若加了新串：RedeL10n 精确断言。

## Git 纪律

- 已在 worktree 分支 `codex/0729-skip-reason`（基线 origin/main e4a711c），直接开工。
- commit 前重跑 `git status`；`git add` 明确 pathspec，**禁用 `-A`**。
- **不 push、不开 PR**（主会话验收后统一走；注意主工作树另一批会先后合并，本批 PR 时由主会话处理 CHANGELOG/DEV_LOG 顺序冲突）。

## 停止条件

同一问题修 3 次不过即停；触红线或发现两步切换与既有 sheet 状态机冲突（如 showMoreSheet 的 onDismiss 竞态）→ 停下回报，不自行改裁定。

## 实施回执模板（收尾必填**回填本文件末尾**）

```
## 实施回执
- 分支与 commit 清单：[hash + 一句话]
- 交互实现：[两步切换实现点 + 状态机处理 + 与跳过组一致性确认]
- canonical 实证：[skippedExercises reason 实读值]
- 文档写回：[逐处]
- gate：[exit code + 尾部原文]
- 实拍：[文件名 + md5]
- 未尽事项：[如实列]
```

## 实施回执
- 分支与 commit 清单：`codex/0729-skip-reason`；`6f8114b` — 同一 sheet 的整动作跳过原因入口、文档写回与两张实拍。
- 交互实现：`TrainTabView.moreSheet` 用 `choosingExerciseSkipReason` 在既有 `showMoreSheet` 内原地切换；第二步复用跳过组相同四码与 `sheetActionRow`，选中转为既有 typed `.skipExercise(reason)`，`onDismiss` 仅复位局部状态，手势收起不写 skip；跳过组原入口和换动作行未改行为。
- canonical 实证：整动作路径选「不适/疼痛」后直接实读本机 app-data，`skippedExercises[].reason == "painDiscomfort"`。
- 文档写回：`docs/REDE_PRD.md` FR-TR7、`docs/REDE_iOS_SYSTEM_LOGIC.md` §6、`docs/工作记录/2026-07-10-testflight-acceptance-checklist.md` N9、`CHANGELOG.md`、`DEV_LOG.md` 均已更新；#716 的「整动作一律 other」仅保留为当时历史事实，不再表述为当前行为。
- gate：exit code `0`；尾部原文：`** TEST SUCCEEDED **` / `QUALITY GATE: PASS`。
- 实拍：`2026-07-29-skipreason-reasons.png`（md5 `4a289f13e0fdfd43018cfe1d4e59f70a`，同一 sheet 的四码原因面）；`2026-07-29-skipreason-skipped.png`（md5 `e4f72ffb419db62158cb922d7ea3a604`，选疼痛后当前动作已跳过）。装前真 `xcodebuild build` 成功，最终构建已安装并前台确认 Rede。
- 未尽事项：Computer Use 连接三次超时，未能额外以该工具录制 VoiceOver 朗读或下滑手势；实现复用既有原因行，且第二步关闭只复位状态、不 dispatch。未改引擎/SessionStore/计划页，未 push、未开 PR。
