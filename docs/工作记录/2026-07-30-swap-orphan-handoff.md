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
