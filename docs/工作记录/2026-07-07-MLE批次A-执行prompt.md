# 2026-07-07 MLE 批次 A（数据 + 引擎）· 执行 Prompt（交接件）

> 来源：2026-07-07 四 lane 多 agent 调研（证据见 EVIDENCE_LEDGER.md「MLE 前置调研」16 条）+ owner 拍板「按推荐自己来」。
> 拍板结论：①贡献权重 = fractional 二档（主肌群 1.0 / 次肌群 0.5，MLE-SCI-1/CMP-3 双锚点）；②肌群归并按建议表（forearm 排除不硬塞）；③参照系 = 相对自身进步 + 契约 milestone 绝对锚（无体重/性别问卷，不抄外部标准表，MLE-MDL-1/2）；④分两批——本批 = 数据前置 + 纯引擎（全程包内可单测），批次 B（Development 块 UI / FR-PL5 提案 / MLE 分享卡）等 build 14 真机验收后另立交接件。
> 真源：系统逻辑 §6.5（契约拍板到公式与起点值，本批按契约实现、只补 6 处留白）；PRD FR-PR6。

---

## 总控指令

沿用标准批次纪律（独立分支/PR、失败测试先行、全量门禁、独立 code-reviewer、auto-merge 限门禁绿+审查无 MAJOR、DEV_LOG/规格写回收口统一）。本批特有：

- **纯引擎批**：零 UI 改动、零 canonical 写路径（§6.5.12 禁写回 currentLevel/confidence 等）、Development 块「不上」封印（ProgressTabView.swift:11）**本批不解除**——解除属批次 B。
- **契约优先**：类型名/字段名/枚举值以系统逻辑 §6.5.2-6.5.4 为准；实现偏离契约处必须在 PR 写明判定依据并列入收口规格写回。
- **全部常量集中**：任何窗口/阈值/权重/曲线锚点必须进 `MuscleLevelModelConfig` 带 `modelVersion`（§6.5.6 拍板），禁散落魔法数字。
- **LLM 红线**：等级估计必须本地可审计模型复算（§6.5.14），任何切片不得引入 LLM 判定。
- 触碰 exercises.json（D2）按内容批次纪律：catalogVersion 递增 + golden 快照更新 + 目录结构测试全绿。

## Tasks（顺序执行，D1/D2 可先行）

### D1: 肌群归并映射表（17→10）
- **scope**：RedeTrainingDecision 新增 `MuscleGroupID` 10 值枚举（chest/back/quads/hamstrings/glutes/shoulders/biceps/triceps/calves/core，§6.5.3:539-550 契约值）+ `MuscleGroupMapping` 纯映射：目录 17 值 primaryMuscle + 13 值 secondaryMuscles 全部落位。拍板归属：`shoulder/side-delt/rear-delt/front-delt→shoulders`；`traps→back`；`upper-back→back`；`lower-back→core`；`adductors→quads`；`forearm→nil（excluded，如实排除不硬塞）`。
- **tests**：失败先行——30 值（17 primary + 13 secondary 取值集）全量映射断言 + excluded 语义 + 未知值防御（nil 不崩）。
- **规格写回**：映射表全文落系统逻辑 §6.5 新小节（收口）。

### D2: 核查并补齐 60 动作 secondaryMuscles
- **scope**：先解码 exercises.json 列出 60 条空 secondary 动作并**分类**——孤立动作（侧平举/腕弯举类）空=正确保持；复合动作空=遗漏需补。遗漏项按解剖学惯例补名单（参照目录内同 movementPattern 既有动作的 secondary 口径，保持族内一致）；产出对照表（动作/判定/补充值/依据）供审查。**不加贡献权重字段**（fractional 权重在引擎层按 primary/secondary 位置赋值，目录零 schema 变更）。
- **tests**：目录既有结构测试全绿；新增「同 pattern 族 secondary 口径一致性」抽样断言；catalogVersion 递增。
- **验收**：对照表随 PR；审查员逐条核解剖学合理性。

### MLE-0: 类型骨架 + MuscleLevelModelConfig
- **scope**：契约 §6.5.3 输出类型族落 **RedeLocalSnapshot**（与 ProgressSnapshot/milestone 同包，输入走 snapshot 层的拍板一致）：MuscleGroupID 用 D1 的（跨包 re-export 或迁移位置执行时定，避免双定义）、MuscleLevelTrend、MuscleLevelEstimate、MuscleDevelopmentProfile、TrainingTier（6 值）、LevelBreakthrough 等；`MuscleLevelModelConfig` 集中全部 V1 常量（recentWindow 6 周/baselineWindow 24 周/校准 3 次或 8 组/medium 6 次 18 组/high 12 次 36 组——§6.5.6 起点值照录）+ `modelVersion = "mle-v1"`。
- **tests**：类型可编码等价（Equatable/Sendable）+ Config 常量锚句（防散落）。

### MLE-1: fractional 贡献聚合纯函数
- **scope**：`MuscleVolumeAggregator`：输入 statsRecords（SnapshotSessionRecord，与进度页同口径、可疑组已剔除）+ catalog + D1 映射 → 每肌群每 ISO 周 fractional 组数时序（primary 1.0/secondary 0.5/excluded 0）。周锚 WeekAnchor 复用。**RIR/technique/pain 不需要**（V1 双主轴不消费，规避契约输入断链——如实留痕）。
- **tests**：失败先行——复合动作分摊（卧推→chest 1.0 + triceps 0.5 + shoulders 0.5）/孤立无 secondary/forearm excluded/跨周切分/空历史。

### MLE-2: developmentScore + Lv 曲线 + 校准判定
- **scope**：双主轴计分（§6.5.7 八子分数结构保留，V1：exposure+performance 主权重、coverage+consistency 低权、其余四项恒 0 留位）——
  - **exposure**：近窗（6 周）每周 fractional 组数经 Pelland 效率分档折算有效量（1-10 组全效/11-18 组 ×0.7/≥19 组 ×0.5，MLE-SCI-2）累积；
  - **performance**：该肌群 linked 动作（primary 关联）e1RM 相对个人基线窗（24 周）的进步率 + milestone levelFloor 绝对锚（MLE-4 供给；MLE-4 未合并前接口留 stub）；
  - **score→Lv.1-20**：增量线性递增曲线（二次阈值形，MLE-MDL-3），锚点进 Config 待真实数据手调；
  - **校准判定**：每肌群独立解锁（≥3 次训练或 ≥8 有效组，契约起点值）；未解锁 = calibrating 态不出等级（MLE-MDL-4 行业模板）。
- **tests**：失败先行——效率分档折算边界（10/11/18/19 组）/进步率正负/解锁三态（0 场/2 场/3 场）/曲线单调 + Lv 边界（1 与 20 封顶）/子分数权重锚句。

### MLE-3: 趋势 / peakLevel / balanceScore / TrainingTier
- **scope**：trend（rising/holding/declining，近窗 vs 基线窗对比、阈值进 Config）；peakLevel 单调不降（§6.5.4）；**balanceScore 拍板公式**（契约留白）：已解锁肌群等级的变异系数反向映射 0-100（全均衡=100），未解锁肌群不参与、少于 3 个解锁肌群不出 balanceScore（nil 如实）；TrainingTier 按 §6.5.4:688-695 已拍板映射表实现（calibrating 兜底）。
- **tests**：失败先行——trend 三态/peak 单调回归/balance 极端（全同级=100、离散、<3 解锁=nil）/tier 表逐行 + calibrating 兜底。

### MLE-4: milestone catalog 契约版扩展
- **scope**：扩 RedeLocalSnapshot 既有 StrengthMilestoneCatalog：补 §6.5.5:712-724 拍板的九里程碑（Bench 60/80/100/120/140、Squat 140、Deadlift 180、OHP 60、Weighted Pull-up +20kg）+ linkedMuscles（用 MuscleGroupID）+ levelFloor + tierCandidate 字段；既有 FR-PR7 行为（4-lift 简化梯、kg/lb 双梯禁互转、估算严格高于实测才出、进度页里程碑区）**逐字不回归**——契约版字段为增量，消费方（MLE-2 performance 锚）新增不改旧。
- **tests**：失败先行——九里程碑档位/linked 映射/levelFloor 语义；既有 milestone 测试全绿（回归兜底）。

## 收口清单
1. 七 PR 全合并（或如实报告停点）。
2. 规格写回：系统逻辑 §6.5 补「已实现状态头 + 6 处留白的拍板值」（D1 映射表全文、V1 子分数权重、Lv 曲线锚点、balanceScore 公式、tier 实现口径、forearm 排除决策）；PRD FR-PR6 状态更新（引擎层 ✅ / UI 层批次 B）；EVIDENCE_LEDGER 支持决策栏回填。
3. DEV_LOG 批次战报；批次 B 交接件另立（UI/提案/分享卡，等 build 14 真机验收吸收反馈后）。
