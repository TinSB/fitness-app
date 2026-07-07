# EVIDENCE_LEDGER

> 多 agent 调研证据账本（multi-agent-research-orchestrator 产出）。每条证据带 ID，供评分矩阵与后续审查回溯。

## 2026-07-07 · MLE 肌群发展等级 技术方案前置调研（4 lanes）

**决策问题**：MLE（肌群 Lv.1-20 + 趋势 + 均衡度 + 整体级别）用什么贡献权重模型与等级算法，才能诚实、可解释、维护成本可控、与现有引擎零冲突。

| Evidence ID | Lane | 核心发现 | 来源 | 等级 | 置信度 |
|---|---|---|---|---|---|
| MLE-INT-1 | 内部 | 系统逻辑 §6.5 契约完整（505 行）：输入/输出类型、e1RM=Epley、8 子分数框架、14 步 pipeline、窗口与置信阈值起点值（校准=3 次或 8 组）、milestone 分档、冷启动规则、MLE-0~8 九切片全部已拍板；runtime 零实现 | REDE_iOS_SYSTEM_LOGIC.md §6.5.1-6.5.14 | E4 | 高 |
| MLE-INT-2 | 内部 | 契约 6 处留白待拍板：8 子分数权重值、score→Lv20 阈值曲线、overallTier 组合逻辑、balanceScore 公式、目录 17 值肌群→契约 10 值 MuscleGroupID 映射表、自报背景冷启动 prior | 同上（对照逐节） | E4 | 高 |
| MLE-INT-3 | 内部 | 目录 165 动作：primaryMuscle 100%、secondaryMuscles 64%（60 条空）、贡献权重字段 0；肌群枚举 17 值细粒度 | exercises.json wave-18 实测解码 | E5 | 高 |
| MLE-INT-4 | 内部 | 可复用资产：per-exercise e1RM 趋势（ProgressSnapshot）、4-lift milestone catalog（简化版）、频率级肌群近似范式（PlanCustomizationImpact）、提案框架已预留 rebalanceMuscle 扩展位 | 代码 grep + 读取 | E5 | 高 |
| MLE-INT-5 | 内部 | 硬红线：「不给用户看编造数据」（ProgressTabView.swift:11）、LLM 不得判等级（§6.5.14）、置信度不显示走行为表达（Copy Baseline §3.4）、禁写回 canonical；snapshot 层无 RIR、canonical 无 technique/pain（契约输入部分断链） | 代码注释 + 契约 | E5 | 高 |
| MLE-SCI-1 | 科学 | fractional set counting（直接=1、间接=0.5）在三种计量口径中拟合最优（BF 9.48-54.84）；但 0.5 是约定非测量值，无公认逐动作系数表 | Pelland et al. 2025 Sports Medicine；Schoenfeld 2019 PMC6681288 | E4 | 中高 |
| MLE-SCI-2 | 科学 | 量-剂量分档：1-10 组/周全效、11-18 组≈70%、≥19 组≈50% 效率；最小有效≈4 fractional 组/周；力量 4-5 组/周即近饱和 | Pelland 2025（67 研究 meta-regression） | E4-E5 | 高 |
| MLE-SCI-3 | 科学 | 「每肌群 Lv.1-20」无科学标准——必然是产品自建复合启发式；训练日志无法反推肌肉围度；呈现只能标专有算法，不能标「科学验证的生理测量」 | Lane 2 跨问题交叉结论 | E4 | 高 |
| MLE-SCI-4 | 科学 | 力量水平分级两学派：绝对标准（众包分位：novice~20th/int~50th/adv~80th/elite~95th）vs 适应速率（Rippetoe）；众包分母偏「认真训练者」、标准偏严 | StrengthLevel/Barbell Medicine/Practical Programming | E1-E2 | 中 |
| MLE-CMP-1 | 竞品 | 热力图/人形图展示层几乎零差评；判断性功能（Fitbod 推荐）抱怨面远大于展示性功能（Hevy/Strong 纯计数无准确性抱怨） | Fitbod/Hevy/Strong 官方页 + 评测聚合 | E2 | 中 |
| MLE-CMP-2 | 竞品 | 冷启动不硬给等级是行业一致做法（SS 灰色肌群、Hevy 不上色）；公开方法论 + 承认局限换来信任口碑（SS「最现实的标准」）；参照系讲不清会触发「只是 intermediate」焦虑 | symmetricstrength.com/about 等 | E2 | 中 |
| MLE-CMP-3 | 竞品 | 次肌群分摊无行业公开精确权重；Hevy 博客建议 0.5 组口径（与 MLE-SCI-1 收敛）；SS 用公开映射表加权平均 | hevyapp.com/how-many-sets | E2 | 中 |
| MLE-MDL-1 | 建模 | 力量标准表许可：ExRx 需授权、StrengthLevel 无公开条款、唯一公有领域=OpenPowerlifting（仅三大项+竞技人群偏差）→ 抄外部表不可行，自建锚点（契约 milestone 表）许可干净 | exrx.net/Store/Other/Licensing 等 | E2 | 高 |
| MLE-MDL-2 | 建模 | 无体重/性别数据 → DOTS/Wilks/allometric 系数族整体失效；可引先例=人群先验→个人基线（WHOOP）；相对自身进步型等级无成文先例（自创需标假设） | powerlifting.sport/NSCA/WHOOP support | E2 | 高 |
| MLE-MDL-3 | 建模 | 等级曲线惯例=形状而非系数：前快后慢、增量受控（增量线性递增≈二次阈值）、前几级必须快速到手、最终手调；20 级具体级数无行业标准（假设） | gamedeveloper.com Luban 2018 | E2 | 中 |
| MLE-MDL-4 | 建模 | 冷启动行业模板：灰屏校准期（4 天-3 周）+ 最少样本门槛（FICO 双条件）+ 按维度逐个解锁出分（Fitbod 逐肌群）——与契约 minimumCalibration 同构 | FICO/WHOOP/Fitbit/Garmin 官方文档 | E2 | 高 |

**冲突与缺口**：① fractional 0.5「拟合最优」vs Schoenfeld 官方「建议按 1:1 计」——不矛盾（建模 vs 实践稳健），产品披露为约定即可；② Reddit 原帖被屏蔽，竞品口碑全为二手聚合；③ 力量类 App「每肌群最少 N 次出分」无公开数字，契约起点值（3 次/8 组）属自定假设待校准；④ 60 动作缺 secondaryMuscles、17→10 肌群映射表不存在——数据前置工作。

**支持的决策**：贡献权重选型（评分矩阵见 2026-07-07 会话报告 / MLE 批次交接件）；等级算法 V1 精简双主轴；冷启动照契约起点值。
