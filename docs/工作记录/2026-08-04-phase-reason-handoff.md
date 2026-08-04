# 交接件：计划性周期化补依据行（S2）

> 日期：2026-08-04 ｜ 来源：真实用户反馈「侧平举以前 2 组，现在突然 4 组，有点搞」；owner 拍板 S2 也做
> 性质：**纯可解释性补全**——不改任何组数/重量逻辑，只把已经在发生的事说出来
> 执行：Codex（主控档 gpt-5.6-terra + xhigh）｜验收：Claude 主会话
> 分支：`codex/0804-phase-reason`（基线最新 origin/main `7a24498`）

## 为什么（根因已核实）

用户看到同一动作组数 2 → 4，是两个机制叠加：
- 上一场是**上肢日**（侧平举基础 3 组），且正处**计划性减载周** → `max(2, 3−1)` = **2 组**
- 这一场是**推日**（基础 4 组），已出减载周 → **4 组**

其中「不同训练日基础组数不同」是**正确的编排**（推日是肩的主场给 4 组，上肢日要兼顾更多部位给 3 组），**有意不动**。

真正的缺口是：**计划性周期化对用户完全静默**。`dayReasons` 组装处（`TodayPrescriptionEngine` :586-699）已有 6 条依据，但**没有任何一条关于 mesocycle phase**：
- `verdictDeloadReduced` 是**反应式**减载（verdict 层，连续负荷过高的兜底）
- 而**计划性** 4 周块的过载周（+1 组、RIR 压到 1）与减载周（−1 组、重量 ×0.85）在 :806-812 悄悄发生，**零依据**

用户在减量周被压了一组、重量打了 85 折，App 一个字都没说；出减量周后自然觉得是"翻倍"。

## 现场事实（已核实，勿重查）

| 环节 | 现状 |
|---|---|
| 依据枚举 | `DayPrescriptionReason`（`TodayPrescription.swift` :60-79）6 条：verdictLightReduced / verdictDeloadReduced / comebackCycleRestart / carriedOverFromLastWeek / slotUnfilled / musclePriorityBoosted |
| 组装处 | `TodayPrescriptionEngine` :586 起 `var dayReasons`；:680 自动均衡、:684-685 verdict、:689 回归、:696 顺延。**无 phase 项** |
| phase 调制 | :806-812 `if let phase, verdict.call == .train`：`weightMultiplier < 1.0` 才减重；`sets = max(2, sets + phase.setDelta)`；`rir = phase.rirTarget` |
| phase 表 | `MesocyclePhase.modulation`：calibrate(1.00/0/RIR3)、build(1.00/0/RIR2)、overreach(1.00/**+1**/RIR1)、deload(**0.85**/**−1**/RIR4) |
| 天然互斥（勿破坏） | phase 只在 `verdict.call == .train` 生效 → 与 verdictLight/DeloadReduced **互斥**；自动均衡条件含 `(phase?.setDelta ?? 0) == 0` → 与 phase 加减组 **互斥** |
| 文案先例 | `musclePriorityBoostedLine`（`TodayEngineCopy.swift` :163）：「\(names)正在补足　今天多安排了组数」——**只进「查看依据」抽屉、无常驻小字**，两拍全角空格、无句号 |
| 依据可见性 | 今日页「查看依据」抽屉，默认折叠；截图钩子 `-expandTodayReason` |

## 裁定 A：新增两条 phase 依据（照抄既有先例）

1. `DayPrescriptionReason` 新增两个 case（与既有 verdictLight/DeloadReduced 同粒度，**不要合并成一个带参数的 case**）：
   - `.phaseOverreachAdded` —— 过载周（setDelta +1）
   - `.phaseDeloadReduced` —— 减载周（setDelta −1 且 weightMultiplier < 1.0）
2. **触发条件**：`verdict.call == .train` 且 phase 为 overreach / deload。**calibrate 与 build 不加**（setDelta 0、multiplier 1.0，没有可陈述的变化，加了就是废话）。
3. 组装位置：与既有 `.musclePriorityBoosted` / verdict 分支同段，顺序自定但要稳定可测。
4. **⛔ 一行调制逻辑都不许改**：组数、重量乘数、RIR 目标全部原样。本批只 append 依据。

## 裁定 B：文案（Apple 观察式，零说教）

照 `musclePriorityBoostedLine` 口径：陈述事实、两拍全角空格、**无句号**、无感叹号、不解释训练学原理、不施压。

建议措辞（可微调，须过既有无句号/禁词红线扫描）：
- 过载周 zh「本周计划加量　今天多一组」／ en「Planned higher volume this week　One more set today」
- 减载周 zh「本周计划减量　今天少一组，重量也轻一些」／ en「Planned lighter week　One less set and lighter loads」

⛔ 不写「为了让你更好地恢复」「这是科学的周期化」这类说教；只说系统做了什么。

## 裁定 C：明确有意不做

- **不统一跨训练日的基础组数**（推日侧平举 4 组 / 上肢日 3 组保持）。理由写进规格：不同训练日的量本就该不同，统一是拿训练学正确性换表面一致性。
- **不为「今天是推日所以肩部量更大」加任何解释**——用户看到的是「推 A」和「上肢」两个不同的日子名，这不需要解释。
- **不加常驻小字**（同 musclePriorityBoosted 先例，只进「查看依据」抽屉）。

## 红线

1. ⛔ 引擎调制逻辑（组数/重量/RIR）零改动；只 append `dayReasons`。
2. ⛔ 不破坏既有互斥性：phase 依据不得与 verdictLight/DeloadReduced 同时出现，不得与 musclePriorityBoosted 同时出现（天然互斥，用测试锁死）。
3. ⛔ 不加目录字段、不 bump schema、不改 LoadGrid、不动版本号。
4. ⛔ 新串走 RedeL10n + 精确断言 + 无句号/禁词红线扫描；不加常驻小字。
5. ⛔ 不 push、不开 PR。

## 验收标准（owner 大白话）

1. 减量周那天点开「查看依据」→ 看到「本周计划减量　今天少一组，重量也轻一些」
2. 加量周那天 → 看到「本周计划加量　今天多一组」
3. 普通周（校准/构建）→ 不显示这类依据（不废话）
4. 今日页首屏不多任何常驻小字，行为一点没变
5. 同一天不会同时出现两条互相矛盾的量变说明

## 验证与证据

1. **测试先红后绿**：overreach 出 `.phaseOverreachAdded`、deload 出 `.phaseDeloadReduced`、calibrate/build 不出；verdict 为 light/deload 时 phase 依据不出现（互斥）；自动均衡与 phase 加组互斥；L10n 中英精确断言 + 无句号/禁词扫描。
2. **golden**：`dayReasons` 是 `TodayPrescription` 的一部分，**既有 golden fixture 可能因此变化**——若变，必须逐份列出并论证是「新增了本就该有的依据行」而非行为变更；若不变（如 deload fixture 走的是 verdict 层而非 phase 层），如实说明原因。
3. **模拟器实拍**（装前真 build、前台确认、md5 互异）：减量周与加量周各一张展开依据抽屉的图（`-expandTodayReason` 钩子现成）。PNG 前缀 `2026-08-04-phasereason-`。
4. 门禁 exit 0。
5. **规格写回**：系统逻辑依据枚举段（补两条 + 「有意不统一跨日组数」的理由）、PRD 对应 FR、文案基线新串、CHANGELOG/DEV_LOG、TestFlight 清单补验法。

## Git 纪律

`git fetch` 后从 `origin/main`（7a24498）拉 `codex/0804-phase-reason`；commit 前 `git status`；明确 pathspec 禁 `-A`。

## 停止条件

- 同一问题修 3 次不过即停。
- 触红线、发现互斥性其实不成立（能同时出现两条量变说明）、或 golden 变化规模超出「仅新增依据行」→ 停下回报，不自行改裁定。

## 实施回执模板（收尾必填回填本文件末尾）

```
## 实施回执
- 分支与 commit 清单
- 两条 case + 触发条件 + 互斥性测试
- 文案全文（中英）+ 红线扫描
- golden：变/不变 + 逐份论证
- gate / 实拍 / 规格写回 / 未尽事项
```
