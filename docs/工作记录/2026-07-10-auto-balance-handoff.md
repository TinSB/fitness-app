# 批次 E 交接件：自动均衡（FR-PL5 形态改判）

> 日期：2026-07-10 ｜ 状态：执行中
> owner 拍板（原话）：「**不要是建议直接自动改计划**」「**不要有那种小字也**」——
> FR-PL5 从「提案卡（预览→采纳→回滚）」改判为**自动式**：引擎发现弱肌群直接在
> 处方里多照顾，无卡片、无采纳流程、无解释小字。唯一痕迹在用户主动点开的
> 「查看依据」抽屉里一行。这与今日页「直接给处方不问要不要」的产品灵魂一致。
> **PRD FR-PL5 行须随本批写回**（验收标准从「预览→采纳」改为自动式）。

## 设计（2026-07-10 引擎探查已锚定 file:line，见探查记录）

1. **输入 seam**：`TodayPrescriptionEngine.plan(...)` 加 `priorityMuscles: Set<MuscleGroupID> = []`
   （引擎自己的枚举；默认空 = golden 零回归）。**不进 CleanTrainingDecisionInput**（它只吃
   canonical 投影，priority 是派生信号——沿 substitutions/customization 透传参数先例）。
   **引擎不 import RedeLocalSnapshot**（依赖方向红线：跨包传 rawValue，app 层翻译）。
2. **加量规则**：动作 primary 肌群 ∈ priorityMuscles → `sets += 1`。门控（全部满足才加）：
   - `verdict.call == .train`（deload/light/comeback 一律让位——deload 本身 sets-1，
     无脑加只会抵消回原值 = 假让位）
   - 周期化 phase 为空或 `setDelta == 0`（deload 周不加；overreach 周本身 +1 不再叠加）
   - **每场加量总额 cap +2 组**（跨肌群合计，按动作顺序取前二——防一天 3 个背动作全 +1）
3. **依据行**：`DayPrescriptionReason` 加 case（code `musclePriorityBoosted`）→ RedeL10n
   双语模板（「XX正在补足　今天多安排一组」风格，红线：无句号无破折号零羞辱）→
   TodayTabView「查看依据」渲染。**不在卡片/列表加任何常驻小字**。
4. **喂数（单一真源）**：`MuscleLevelMemory` 加 `priorityMuscles: [String]?`（可选，旧文件
   缺省 = 空，向后兼容零迁移）。ProgressModel 算完 profile 后把 `profile.priorityMuscleIds`
   （assembler 真 decision——**已排除 detraining/recover 肌群**）写进 memory；TodayModel
   读 memory 翻成引擎枚举喂 `plan(...)`。**不在今日页复算 MLE**（引擎决策单一真源教训；
   复制 60 行胶水违 YAGNI）。已知滞后：用户从不开进度页则名单不新鲜——弱肌群是周级
   慢变量，接受并记残留项。
5. **红线**：加量是**瞬时调制**（叠在 slot.sets 上）——**绝不写回 planCustomization**
   （customSlots 会把它当新常数 → 渐进漂移）；sets 渐进基线（lastPerformance）无组数
   字段，引擎自身无漂移（探查已证）。

## 验收（写成测试 + 实拍）

1. priorityMuscles 空 → 全量 golden 逐字节零回归。
2. 弱肱二（priority=[biceps]）拉日 → 弯举类动作组数 +1 + dayReason 带 musclePriorityBoosted。
3. deload verdict / light verdict / 周期 deload 周 → 不加量（让位）。
4. 一日多动作覆盖同弱肌群 → 合计最多 +2。
5. memory 无 priorityMuscles 字段（旧文件）→ 行为同空。
6. 实拍：种子弱肌群 → 今日页该动作组数可见 +1 + 「查看依据」一行。

## 禁区

- 不做提案卡/采纳/回滚 UI（owner 已否）；不加常驻小字。
- 不动频率提案（FR-PL3 降频卡维持现状，owner 未点名）。
- 不写 canonical；不改 mesocycle 结构；不做 session 总组数预算系统（只做加量侧 cap +2）。
