# Rede iOS — 系统逻辑全景

> **活文档 · 系统逻辑主文档**。本文定义 Rede 干净重写的产品、系统逻辑和工程合同。干净 iOS 实现(`ios/Rede` + 7 个干净包)已是活跃实现并 shipping 到 M6;已退役的旧 IronPath/PWA 代码仅作参考。架构边界、source-of-truth、平台权限和禁用系统以 `docs/REDE_MASTER_TECHNICAL_ARCHITECTURE.md` 为最高契约。

## 0. 干净重写基线

Rede 的目标实现是 native iOS SwiftUI app。旧 Web/PWA、Node/Vite、浏览器测试、旧 Supabase/Vercel 实现候选、TypeScript 源和 `RedeCloudSync` stub 已删除,不得恢复成仓库 runtime。

iOS 原生账号、云同步、CRDT/watchOS 的已拍板方向保留在 `docs/REDE_REBUILD_00_IRONRULES_AND_CLOUD.md` 与 `docs/CLOUD_DECISIONS_ARCHIVE.md`。这些是未来原生架构输入,不是第一版干净实现 runtime。

干净重写只以这些材料为真源:

- `docs/REDE_MASTER_TECHNICAL_ARCHITECTURE.md`
- `docs/REDE_iOS_SYSTEM_LOGIC.md`
- `docs/DOCS_MANIFEST.md`
- `docs/REDE_PRODUCT_COPY_BASELINE.md`
- `docs/REDE_PRODUCT_DESIGN_LANGUAGE.md`
- `COMMERCIALIZATION_ROADMAP.md`

legacy/reference inventory 处置状态(2026-06-09 M1-0 起):

- **旧包退役 + 干净重建**:9 个旧 IronPath/PWA 时代 Swift 包(`RedeDomain`、`RedeDataHealth`、`RedePersistence`、`RedeHealthKit`、`RedeTrainingDecision`、`RedeBackup`、`RedeUIKit`、`RedeLocalSnapshot`、`RedeNotifications`)于 M1-0 整体移出编译面,旧实现参考走 git 历史(tag `legacy-parity-final`),其 PWA parity golden 测试随旧包退役。**随后 5 个名字以干净包重建并现役**(M1-1 起,带全新测试):`RedeDomain`、`RedeDataHealth`、`RedePersistence`、`RedeTrainingDecision`、`RedeLocalSnapshot`——它们是 §6/§8 描述的"已实现"引擎的承载包,当前在 `ios/packages/` 中、在 CI 测试面内(连同一直在树的 `RedeWidgetShared`、`RedeL10n`,共 7 个)。**未重建、当前不存在**的 4 个:`RedeHealthKit`、`RedeBackup`、`RedeUIKit`、`RedeNotifications`(目标包名,待未来 amend 后才创建)。
- **仍在树内的 legacy/参考材料**:`ios/packages/RedeL10n` 内的 legacy Terms/Formatters parity 文件(与 M0-3 新代码并存,待后续 slice 清退)、`ios/RedeWidget`(旧 widget,仅参考)、`ios/ParityFixtures`(冻结参考输入;RedeL10n parity 测试仍在消费,并保留为未来老数据迁移的验收素材——是否做迁移为待定产品决策,新模型按开门设计:open-bag + 沿用 legacy 字段词汇表)。`ios/Rede` 自 M0-1 起已是 clean shell,不再属于 legacy。
- **通用规则不变**:legacy 材料可以帮助理解曾经的命名、测试和局部算法,但不得作为“已完成实现”的证明,也不得被整包搬运。任何复用都必须进入明确 rewrite slice,先审查输入输出、source-of-truth 和测试合同。

## 1. 铁律

1. **核心纯净**：SwiftUI app 层只做渲染与 IO seam 接线；业务逻辑在 Swift packages。
2. **数据必净化**：raw AppData 永不进训练引擎；目标读路径必须先经 DataHealth clean view / clean input。
3. **唯一写闸**：canonical AppData 改动必须经明确的 gated writer,backup → atomic save → honest failure。`CanonicalSessionWriter` 可作参考命名,不是必须逐行继承的旧实现。
4. **单一权威本地源**：目标权威源是本地 JSON AppData；LocalSnapshot、Widget、HealthKit export、UI view model 都不是真相。
5. **Swift-only 干净实现**：干净重写不得引入 Web runtime、Node runtime、cloud sync、account auth、remote API、browser storage 或 browser tests。
6. **未来平台需另批**：watchOS、WatchConnectivity、CRDT、remote sync、account/auth、cloud backup、subscription entitlement infrastructure 必须基于已拍板决策另走 Master-approved implementation slice。

## 2. 商业化信息架构

底部 tab 目标只保留高频、能形成训练闭环的页面：

| Tab | 页面使命 | 新实现规则 |
|---|---|---|
| 今日 | 告诉用户今天该不该练、练什么、从哪里开始 | 不做 dashboard；只回答今日决策和入口。 |
| 训练 | 只承载专注训练 | 没有完整训练页、训练浏览页或训练 dashboard。 |
| 进展 | 证明训练有没有效果 | 合并历史、PR/e1RM、训练量、日历和数据可信度。 |
| 计划 | 管未来几周怎么练 | 展示周期、周计划、调整建议和可回滚计划决策。 |

Profile / Settings 是低频入口，不占底部 tab。它拥有个人资料、单位、筛查、HealthKit 权限、数据导出/备份和订阅表面。账号或同步控制不进入第一版干净实现,未来实现必须走原生云/账号决策链路。

## 3. 新实现目标与旧代码边界

| 模块 | 干净重写目标 |
|---|---|
| SwiftUI app | 新建薄 app 层,只渲染 state、接 IO seam,不承载业务判断。旧 `ios/Rede` 仅作参考。 |
| Widget | 第一版可选;若实现,只能是只读 readiness snapshot。旧 widget 不能证明目标已完成。 |
| Packages | 按目标 package boundary 重建纯逻辑。旧 packages 的符号名和测试可参考,不得默认继承旧结构。 |
| AppData | `RedeDomain.AppData` 语义保持本地 JSON canonical source of truth。具体类型可重写,但必须保留 open-bag preserving 和 schema honesty。 |
| Write path | 统一 gated writer,具备验证、backup、atomic save、honest failure。旧 `CanonicalSessionWriter` 可作合同参考。 |
| Training | 专注训练是训练中唯一一等页面;不恢复完整训练 dashboard。 |
| Today | 读 canonical AppData,经 DataHealth 和 TrainingDecision 渲染今日状态。 |
| Progress / Settings / Plan | 直接实现目标职责,不继承旧 History/Profile transitional IA。 |
| HealthKit | 体重导入、训练历史导入、native workout export,均在 `RedeHealthKit` 边界内。 |
| Notifications | 本地 rest timer 和 weekly training reminder;不做 remote push。 |
| Test fixtures | 建立干净 rewrite fixtures/goldens。旧 `ios/ParityFixtures` 可作参考输入,不得锁死新实现。 |

## 4. 目标 Package 分工

| Package | 责任 |
|---|---|
| `RedeDomain` | AppData / domain model / open-bag preserving values。 |
| `RedeDataHealth` | clean view、repair、runtime guards。 |
| `RedeTrainingDecision` | readiness、scheduler、progression、coach actions、insights。 |
| `RedePersistence` | local JSON store 和 canonical write orchestration。 |
| `RedeLocalSnapshot` | Focus/session projection 派生快照；不得触碰 canonical AppData。 |
| `RedeHealthKit` | 已批准 HealthKit adapters。 |
| `RedeNotifications` | 本地通知 policy + adapter。 |
| `RedeWidgetShared` | widget snapshot model + read-only App Group handoff。 |
| `RedeL10n` | 术语与格式化。 |
| `RedeBackup` | 未来可选包;不因旧 placeholder 授权真实备份系统。 |
| `RedeUIKit` | 未来可选共享 UI 包;不因旧 placeholder 授权共享 UI framework 迁移。 |

第一版干净实现没有 active cloud/sync package。任何同步、云、账号或远程服务实现都必须从原生决策文档出发,经 Master-approved implementation slice 落地。

## 5. 写入合同

目标 canonical AppData 写入只允许通过明确的 gated writer。旧 `CanonicalSessionWriter` 是参考合同名,不是旧代码继承要求。

已批准的用户/外部事实写入类别：

- 完成训练 append。
- HealthKit body weight sample append。
- HealthKit imported workout sample append 到 display-only derived storage。
- Profile scalar edit。
- Unit setting edit。
- Screening list edit。
- Program config scalar edit。
- History set correction。
- Saved-session exercise replacement。
- Coach-action dismiss intent。

写入必须满足：

- 不 fake success。
- 不覆盖 unreadable user data。
- 写前 DataHealth gate。
- 写前 backup。
- atomic save。
- 不把 engine output 写回真相。
- 不新增第二条 store。

## 6. Engine 输入

训练决策、计划调整、进展分析必须从 clean data 或 typed clean input 进入。

禁止：

- raw AppData 直接进 engine。
- UI 派生状态写回 AppData。
- HealthKit/import/widget/local snapshot 直接影响训练建议。
- placeholder package 偷偷实现业务逻辑。

第一版 HealthKit 数据只用于展示、Progress/data quality 和本地导入/导出边界。若未来要影响 Today/Scheduler 的建议,必须新增 Master-approved engine-input slice。

### 6.0 今日裁决引擎（TodayVerdict · M2-1 已实现）

**入口合同**：引擎唯一入口是 `CleanTrainingDecisionInput`（init 私有,只能经 `make(from: CleanAppDataView, todayISO:)` 铸造——raw AppData 在类型系统上进不了引擎）；「今天」由调用方注入,引擎无 clock、无 IO、输出永不写回 AppData。输入面按 PRD 开放决策 #2 拍板（2026-06-09）：仅已记录训练历史（负荷/间隔/上次表现）+ 计划结构；主观自报（酸痛/疲劳/睡眠）放 FF。

**输出合同**：四态 `TodayCall`（train 练 / light 轻 / rest 休 / deload 减载）+ typed 主理由 `VerdictReason` + 可观察事实 `VerdictSignal`。引擎不产任何用户文案——理由是结构化 code,由 UI 层经 RedeL10n 双语模板渲染成「信号 + 影响 + 决策」句（FR-T3 禁词约束因此结构化成立）。

**瀑布仲裁（先命中先裁决,顺序即合同）**：

| 序 | 条件 | 裁决 | 产品理由 |
|---|---|---|---|
| 1 | 今天已有完成训练 | rest | 不重复消耗 |
| 2 | 零训练历史 | train | 校准期,不伪造 readiness 分数 |
| 3 | 距上次训练 ≥14 天 | light | 回归保底,先轻后重 |
| 4 | 21 天窗口训练日 ≥3×周计划频次且最长间隔 ≤2 天 | deload | 结构性超量;**优先级高于规则 5**——连练数周需要的是减载周,不只是歇一天 |
| 5 | 连续 ≥3 天训练 | rest | 短窗口恢复 |
| 6 | 近 7 天训练日 ≥ 周计划频次 | light | 本周量已到 |
| 7 | 昨日（gap≤1）训练 RIR 均值 ≤0.5 | light | 上次练到力竭,降一档 |
| 8 | 兜底 | train | 常规推进 |

周计划频次取值链：`program.daysPerWeek` → `profile.weeklyTrainingDays` → 默认 6（宽松,避免无计划时规则 6 误触发）。无 RIR 数据时规则 7 不触发（不猜）。未来日期/非法格式的 session 不参与 recency 计算。

**阈值地位**：14 天/21 天/连续 3 天/RIR 0.5/默认 6 是 MVP 起步值,非经验校准结果;由 RedeTrainingDecision 的 goldens 锁定——调阈值 = 调产品行为,必须显式改 golden 留痕,待 TestFlight 真实反馈后校准。

### 6.0.1 今日处方引擎（TodayPrescription · M2-2 已实现）

**入口合同**：吃 `CleanTrainingDecisionInput` + M2-1 的 `TodayVerdict`（处方不重复判断练不练）；rest 裁决 → 无处方。纯函数、无 clock/IO、输出永不写回 AppData。

**输出合同**：`TodayPrescription{dayCode, exercises[], dayReasons[]}`；每动作 `{exerciseId, sets, restSeconds, rep 区间, targetReps, targetWeightKg(kg 口径), targetRir(增肌默认 2；力量目标复合主项 1，见 §6.0.1a), previousWeightKg, previousTopReps, nextProjectedWeightKg, change(start/increase/hold/ease), reason}`。全 typed 零文案：dayCode/reason code 是 RedeL10n 模板挂点；**lb 换算归渲染层（FR-SE1），但渲染层不是裸换算——必须把每个可配重量吸附到「器械×当前单位」真实梯子的最近格再显示（见 `REDE_EXERCISE_CONTENT_SYSTEM` §8 LoadGrid 显示吸附契约）；禁止 ×2.2046 直转。**previous→target→change 三元组同时喂 Receipt Change 行、训练页 why 行与 Rail。**里程摘要（wave-12，owner 拍板 B）**：今日页 Receipt Change 行只渲染**头牌动作**（exercises.first）；非头牌动作的**转折性 `reason`**（bandCeilingReached 换带 / bodyweightCeilingReached 加配重 / assistedGraduated 毕业 / bodyweightPlusDegraded 回退）另由今日页**里程摘要**扫全表单列于头牌行下方（配件类如弹力带永远排不到首位，否则其里程提示被吞）；只列转折性 reason、不列普通进阶（高信号），复用同一 `changeLine(for:)` 文案，纯文本不占卡预算。

**生成规则（FR-ON3：不锁死硬编码模板，可重算）**：日计划 = 槽位规则 × catalog（`ExerciseCatalog.minimal` 现已解码整本 `exercises.json` 目录，当前 121 条（wave-14，catalogVersion wave-14）、随内容 wave 增长；开放决策 #1 已拍板）按 (rank,id) 升序取第一个未用且匹配（pattern + 可选 kind/equipment）；槽位无法匹配时记 `slotUnfilled` 留痕，不静默。轮转 = 完成 session 数对 split 日序列取模（见 §6.0.1a）。

### 6.0.1a 分化模板系统（天数→模式→日序列 · 循证频率映射，2026-06-16 owner 拍板）

> 目标契约：每肌群尽量 **2×/周**（Schoenfeld 频率 meta：容量等值下 2× 优于 1×；RP 容量地标 10-20 组/肌群·周）。`OnboardingPlanInit.template(for:)` 按天数选 `splitType`，`TodayPrescriptionEngine.daySequence(splitType:)` 把 splitType 映成**日序列**（轮转长度=序列长，`dayCode = 序列[已练场数 % 序列长]`）。

| 天数 | splitType | 日序列 | 每肌群频率 |
|---|---|---|---|
| 2-3 | `full-body` | full-a / full-b / full-c（三均衡变式轮换，每日覆盖全身） | 主要肌群 2-3×、臂/小腿较少 |
| 4 | `upper-lower` | upper / lower | 2× |
| 5 | `ppl-ul` | push-a / pull-a / legs-a / upper / lower（**复用现有槽位**，腿 2×） | 上肢 2×、腿 2× |
| 6 | `push-pull-legs` | push-a / pull-a / legs-a / **push-b / pull-b / legs-b** | 全肌群 2× |

- **A/B 区分（6 天）**：A 日 = 强度/自由重量主项；B 日 = 容量/变式（换器械·角度·握法）。B 日靠槽位 `equipment`/`kind` 约束 + **`preferredId` 点名**选到与 A 不同的动作（推B 补垂直推；拉B 点名宽握下拉 + 俯身支撑划船 + lat 孤立；腿B 哈克蹲 + 点名硬拉 + 保加利亚）；器械受限时优雅软化。
- **点名主项（`Slot.preferredId`，2026-06-16）**：模板可指定具体动作 id（突破「同 pattern 取 rank 最小」限制，如硬拉 vs RDL、宽握 vs 高位下拉）。选材优先级：**sticky（用户上次换的）> preferredId（模板点名）> rank 最小默认**；点名须通过候选过滤（器械白名单/未弃用/可处方），否则优雅回退 rank（器械受限不会卡空）。
- **全身 A/B/C（2-3 天）**：每变式 6-7 槽覆盖 股四/后链/胸/背/肩 全身一遍，三变式靠 pattern 顺序+equipment 换不同主项（A 深蹲+平板+下拉 / B 哈克蹲+上斜+杠铃划船 / C 腿举+哑铃平板+坐姿划船+小腿）。**频率口径（审查 M-1 校正）**：主要肌群（腿/胸/背/肩）每日命中 → 2-3×/周；**小肌群（二头/三头/小腿）以复合间接 + 单变式直接为主（约 1× 直接）**——6-7 槽全身日的合理取舍，非每肌群都 2×。
- **力量/增肌两套（primaryGoal）**：默认增肌（§6.0.1 渐进口径不变）；`primaryGoal=strength` 时 `strengthShaped` 只重塑**显式复合主项**（kind=="compound"）→ 3-6 次 / RIR 1 / 休息 ≥180s（孤立与二级保持增肌区间——「重主项+增肌辅助」结构，循证可接受）。
- **sticky（粘住上次换的动作）当前为 pattern 全局**：同 pattern 跨 A/B 且换入动作满足两天约束时会跨日粘住；新用户无换动作时 A/B 由槽位约束天然区分。dayCode 级精确化需会话存 dayCode 真值（templateId），留作后续。
- 日名（dayCode→双语）：`RedeL10n.trainingDayName`（A 日/upper/lower 复用 legacy parity map；新 push-b/pull-b/legs-b/full-a/b/c 就近映射，不污染 parity-locked `Formatters.templateNameMap`）。

**最小渐进（goldens 锁定）**：双重渐进三分支，RIR 一律取 **min 口径**（最差一组；任何一组打到力竭就不加重——安全优先于抗噪，2026-06-09 审查后显式拍板）——全组打满 repMax 且 min RIR ≥1.0(含 1.0；无 RIR 数据视为有余力) → +2.5kg、次数重置 repMin；上次力竭(min RIR≤0.5) 或最高组未到 repMin → −2.5kg；否则持平冲 repMax。加重无上限（有意为之）。裁决调制在渐进后：light ×0.9；deload ×0.8 且组数 −1(下限 2)。**重量按「器械×用户单位」真实梯子取整**（§8 LoadGrid：公斤自由重量 2.5kg 等距、磅哑铃分段 2.5/5/10lb 梯子等），下限一档；**调制后若取整弹回原重量且原重量 > 一档，强制下调一格**（轻练/减载必须真减，小重量动作不得被取整吃掉）。**重量口径**：哑铃/单边动作 = 单只哑铃重量；杠铃 = 总杠重（含杆）；plate-loaded = 配重片读数；cable = 配重栈读数（美国习惯，引擎内部按手上有效推进）——**渲染层据此口径吸附梯子最近格显示，非裸换算**（§8 显示吸附契约）。

**catalog limitation（§6.1 红线如实声明）**：MVP catalog 缺肌群贡献权重与禁忌提示——肌群级高置信分析（肌群等级/瓶颈识别）在补齐前不得基于本 catalog 产出；双语展示名归 RedeL10n。组形（top/backoff）归 M3-1 后续学习层；restSeconds 已在 M3-1 落地（slot 生成参数）。

### 6.0.2 逐组处方与下一组建议（M3-1 已实现 · §6.3 的确定性最小子集）

**逐组序列**：`SessionSetPlanner.expand(TodayPrescription) → SessionSetPlan`，MVP 组形 = straight sets（每组同重同次同 RIR 目标 + 动作级 restSeconds）；组形学习（ascending/top-backoff/wave、SetExecutionModel）与热身生成按 §6.3 后置。确定性展开，固定场景测试锁定。

**下一组建议**：`NextSetEngine.recommend(plan, completed[]) → NextSetRecommendation?`。原则 = 尊重 session 内执行事实：上一组实际重量是下一组基线（用户第一组完成 85 → 第二组建议继续 85；完全按计划执行 → 保持计划形状）。安全瀑布（先命中先裁决）：疼痛上报 → safety flag + −2.5kg；上组 RIR ≤0.5 → −2.5kg；上组次数 < 区间下限 → −2.5kg；否则延续基线。减重下限 2.5kg；无 RIR 数据不猜不触发力竭规则；全部计划组完成 → nil。输出全 typed（reason/safety code），文案归 RedeL10n。

**跳过/替换/收尾模型**：`SetSkipReason`（equipmentBusy/painDiscomfort/fatigue/timeShort/other）、`SessionEndReason`（completedAll/timeUp/fatigue/pain/other）——rawValue 即留痕 code；`ExerciseReplacementEngine.candidates(for:)` = catalog 同替代族按声明顺序排除自身（FR-TR6 地基）。这些是引擎输入事实，M3-3 已经唯一写闸落盘：`CompletedSessionBuilder` 只记录用户事实（实际组/跳过/替换审计/收尾原因，engine 输出不落盘），写前 gate 的真实现为 `RedeDataHealth.CanonicalWriteValidation`（clean 视图不丢 session + 新 session 必须通过净化）。

### 6.1 动作库、模板生成与动作事实权威

训练计划不能依赖一组锁死的默认模板。Rede 的训练内容必须拆成三层:

| 层 | 权威职责 | 不允许 |
|---|---|---|
| Exercise Catalog | 动作事实:动作名、movement pattern、主/次肌群贡献、器械类型、可替代关系、技术风险、训练目的标签 | 把 UI 文案、模板默认值或用户历史当作动作事实来源 |
| Template Generator | 根据目标、频率、器械、经验、恢复、肌群等级和用户偏好生成训练结构 | 硬编码一组永远不变的默认训练计划 |
| Session Prescription | 在训练中根据当天执行表现、器械可用性和安全信号生成下一组建议 | 把一次训练中的临时推荐写成长期事实 |

动作库目标:

- 覆盖美国商业健身房常见动作:barbell、dumbbell、cable、plate-loaded machine、selectorized machine、bodyweight、assisted machine、band、kettlebell。
- 每个动作必须有稳定 `exerciseId`、本地化展示名、movement pattern、primary/secondary muscle contribution、equipment requirement、substitution group、contraindication hint 和 evidence/confidence tag。
- 动作事实由 curated catalog 和版本化 migration 管理。LLM 可以帮助生成候选解释或缺口清单,但不得成为动作事实的最终来源。
- catalog 缺失贡献权重时,引擎必须输出 limitation,不能猜肌群或把动作强行归类。
- UI 默认只展示用户需要的训练信息;完整动作元数据只在详情/调试/专业解释里出现。

模板生成目标:

- `TemplateGenerator` 消费 clean profile、训练目标、每周可练天数、可用器械、训练历史、肌群等级、support allocation 和 safety/recovery 语义。
- 默认是 balanced development,不是固定 push/pull/legs 常量表。push/pull/legs、upper/lower、full-body、specialization 都是生成策略,不是唯一真相。
- 新用户冷启动只问最少问题:目标、每周训练天数、可用健身房/器械、训练背景。其余通过训练日志、跳过记录、替换记录和完成质量学习。
- 生成器必须可解释:每个训练日为什么有这些 movement pattern,每个动作为什么出现,每个替代动作为什么合理。
- 生成结果是计划建议或 program config,需要用户确认后才进入 canonical AppData。未确认的 engine output 不写回真相。

目标工程边界:

```swift
public struct ExerciseCatalogSnapshot: Equatable, Sendable {
    public let catalogVersion: String
    public let exercises: [ExerciseCatalogEntry]
    public let substitutionGroups: [ExerciseSubstitutionGroup]
    public let contributionModelVersion: String
}

public struct TemplateGenerationInput: Equatable, Sendable {
    public let cleanProfile: CleanProfileSummary
    public let trainingGoal: TrainingGoal
    public let weeklyAvailability: WeeklyAvailability
    public let equipmentContext: EquipmentContextSnapshot
    public let muscleDevelopment: MuscleDevelopmentProfile?
    public let supportContext: SupportAllocationContext?
    public let recentExecution: RecentExecutionSummary
}

public struct TemplateGenerationOutput: Equatable, Sendable {
    public let proposedPlan: ProposedProgramTemplate
    public let rationale: [TemplateDecisionReason]
    public let limitations: [TemplateGenerationLimitation]
    public let modelVersion: String
}
```

验收要求:

- 没有动作贡献时不生成高置信肌群建议。
- 没有器械时不推荐必须器械动作,除非同时给出替代。
- 用户连续替换某动作后,下一轮生成应降低该动作优先级,但不能在安全必要时永久删除同类 movement pattern。
- 默认模板不得只靠一个硬编码数组;必须能从 catalog + generator 输入重算。

### 6.2 器械组件库与负重校准

美国健身房的器械差异是训练准确性的核心问题之一。Rede 不把“机器上显示的重量”直接等同于可跨健身房比较的真实负荷。

器械分类:

| 类型 | 示例 | 负重策略 |
|---|---|---|
| Free weight | barbell、dumbbell、kettlebell | 重量可跨地点比较,仍需单位和杠铃/哑铃语义。 |
| Plate-loaded machine | Hammer Strength chest press 等挂片器械 | 片重可知,但机器杠杆和起始阻力不同;可用于本机趋势,跨型号比较降权。 |
| Selectorized machine | 插销配重片器械 | 每档实际重量、起始阻力和 pulley ratio 差异大;未校准前不得跨品牌/型号比较。 |
| Cable stack | cable row、lat pulldown 等 | pulley ratio 与 stack 标注可能不同;按 machine profile 控制置信度。 |
| Assisted machine | assisted pull-up/dip | 辅助重量方向相反,必须独立建模,不得当作普通加重动作。 |

用户体验原则:

- 用户不需要手动配置整个健身房。默认流程是选择或确认健身房,系统加载本地/已批准的 `GymEquipmentPack`;找不到时只在用户第一次使用具体机器时询问最低必要信息。
- 选择健身房只能服务训练推荐和负重校准;不得默认写入分享卡,不得暴露精确位置。
- 对美国主流连锁健身房和常见品牌,可以维护 curated pack:品牌、器械类别、常见型号、重量档位、单位、plate/cable/selectorized 特征和置信等级。
- pack 的来源必须可审计:官方器械资料、用户确认、人工审核或已批准的数据流程。LLM 可以帮助识别品牌/型号候选,但最终必须由用户确认或权威资料确认。
- 没有 pack 时,系统仍然可用:训练记录照常保存,推荐使用保守负重和本机趋势,跨器械比较降权。

目标工程边界:

```swift
public struct GymEquipmentPack: Equatable, Sendable {
    public let gymId: String?
    public let displayName: String
    public let source: EquipmentPackSource
    public let confidence: EstimateConfidence
    public let machines: [MachineProfile]
    public let freeWeights: [FreeWeightProfile]
    public let updatedAtIso: String
}

public struct MachineProfile: Equatable, Sendable {
    public let machineId: String
    public let brand: String?
    public let model: String?
    public let movementPattern: MovementPattern
    public let loadType: MachineLoadType
    public let displayedIncrements: [Double]
    public let unit: UnitSystem
    public let comparability: LoadComparability
}

public struct EquipmentCalibrationSnapshot: Equatable, Sendable {
    public let activeGymId: String?
    public let machineProfiles: [MachineProfile]
    public let userConfirmedMappings: [ExerciseMachineMapping]
    public let unknownMachinePolicy: UnknownMachinePolicy
}
```

校准规则:

- free weight 可作为强度和 milestone 的高置信输入。
- plate-loaded machine 可记录绝对片重,但跨型号只给中/低置信比较。
- selectorized / cable 未校准时只用于同机器趋势和训练中递进,不用于跨器械 milestone。
- machine chest press 的 100kg 不触发 barbell bench 100kg milestone;只能触发 machine-local milestone,且必须标明机器语境。
- 用户换健身房或换型号后,历史负重不丢失,但比较置信度重新计算。

### 6.3 训练中处方、组形学习与热身

训练中推荐不是固定递增、固定递减或固定同重量。系统推荐一个起点,用户执行后,后续正式组和热身组都要根据 session 内事实动态更新。

正式组逻辑:

- `SessionPrescriptionEngine` 读取今日处方、最近表现、当前动作、已完成组、RIR、reps、跳过/疼痛/替换事实和器械校准。
- 如果推荐 80 lb x 6 @ RIR 2,用户第一组完成 85 lb 并记录,第二组建议必须重新计算:可能继续 85、微调到 82.5/80、上调、下调或保留,取决于完成质量、目标 RIR、历史掉速、用户 set-shape 偏好和安全边界。
- 如果用户完全按推荐执行且没有额外输入,系统默认保持计划处方形状;只有在已完成组、休息、RIR 或历史模型给出足够信号时才自动调整。
- 用户喜欢 ascending、descending、wave、straight sets 或 top-set/back-off,都由 `SetExecutionModel` 从历史执行中学习,不是硬编码偏好。
- 偏好只能改变处方形状,不能覆盖安全、疼痛、目标 RIR、训练块目标和 data quality。

目标工程边界:

```swift
public struct InSessionPrescriptionInput: Equatable, Sendable {
    public let plannedExercise: ExercisePrescription
    public let completedSets: [CompletedSetObservation]
    public let currentReadiness: ReadinessDecision
    public let equipmentCalibration: EquipmentCalibrationSnapshot?
    public let setExecutionProfile: SetExecutionProfile?
    public let supportContext: SupportAllocationContext?
}

public struct SetExecutionProfile: Equatable, Sendable {
    public let preferredShape: SetShapePreference
    public let fatigueDropModel: FatigueDropModel
    public let loadAdjustmentStep: LoadAdjustmentStep
    public let confidence: EstimateConfidence
}

public struct NextSetRecommendation: Equatable, Sendable {
    public let targetLoad: LoadPrescription
    public let targetReps: ClosedRange<Int>
    public let targetRir: ClosedRange<Int>
    public let restSeconds: Int
    public let rationale: [PrescriptionReason]
    public let safetyFlags: [PrescriptionSafetyFlag]
}
```

热身组逻辑:

- 热身组由 working set、动作风险、历史表现、用户经验、器械类型和当天状态生成。
- 新用户、重 compound lift、高强度 top set、长时间未练动作时,热身更保守;熟练用户、轻孤立动作、低风险动作时,热身更短。
- 用户跳过热身不等于系统永久取消热身。系统记录 tolerance 和 friction,逐步减少不必要热身,但在高风险场景仍保留最小安全 warm-up。
- 热身组也学习个人偏好:有人喜欢多级 ramp,有人只需要一两组。学习结果必须带 confidence,不得用一次跳过直接重写长期策略。

验收要求:

- ascending / descending / straight / wave 都有 fixture。
- 用户第一组超推荐完成时,下一组 recommendation 根据 RIR/完成质量动态变化。
- 第三组大幅掉速用户会学到更保守后段策略;多组稳定用户不会被强行降重。
- 热身跳过多次只降低 friction,不取消安全必要热身。
- unknown selectorized machine 不产生高置信跨器械进步结论。

### 6.4 纠偏、主训练、功能性分配自动化

Rede 保留纠偏、主训练、功能性三类训练状态,但不能让用户在 onboarding 里回答大量偏好问题。系统必须通过行为学习和安全边界动态分配。

定义:

| 状态 | 作用 | 默认商业逻辑 |
|---|---|---|
| 主训练 | 肌肥大/力量进步的主体刺激 | 用户最愿意做,必须保持低摩擦和高完成感。 |
| 纠偏 | 解决疼痛、动作受限、左右差、技术风险或长期失衡 | 只在有明确证据时出现,短、具体、可跳过。 |
| 功能性 | 维持关节活动度、核心稳定、心肺/运动能力和长期可练性 | 用少量高价值动作服务长期训练,不喧宾夺主。 |

自动化规则:

- 首次使用默认 balanced allocation,但主训练占主要时间。
- 系统记录 planned/completed/skipped/edited/replaced/reason/safetyLock,形成 `SupportAllocationContext`。
- 用户连续跳过纠偏或功能性,系统学习到“低偏好/高摩擦”,下一轮减少频率、压缩时长、换更贴近主训练的替代动作,而不是简单永久删除。
- 如果跳过发生在明确 pain/safety/technique 风险下,安全权重高于偏好,系统保留最小纠偏剂量并解释原因。
- 如果用户长期只做主训练且无安全风险,计划可以更偏主训练;但 Progress / Plan 必须提示长期覆盖缺口和可能影响,让用户可选择 balanced、performance-first 或 minimum-support。
- 问用户的问题必须延后到有证据时:例如“你连续 4 次跳过肩部预备,要把它压缩成 2 分钟版本吗?”而不是 onboarding 里问一堆偏好。

目标工程边界:

```swift
public struct SupportAllocationContext: Equatable, Sendable {
    public let windowStartIso: String
    public let windowEndIso: String
    public let mainTraining: SupportLaneStats
    public let corrective: SupportLaneStats
    public let functional: SupportLaneStats
    public let inferredPreference: SupportPreferenceProfile
    public let safetyLocks: [SupportSafetyLock]
}

public struct SupportAllocationDecision: Equatable, Sendable {
    public let nextAllocation: SupportLaneAllocation
    public let userChoice: SupportUserChoice?
    public let rationale: [SupportDecisionReason]
    public let mustKeepReasons: [SupportSafetyReason]
}
```

决策优先级:

1. Safety lock、疼痛和明确技术风险。
2. 用户明确目标和训练时间。
3. 历史完成/跳过/替换行为。
4. balanced development 默认目标。
5. 商业化体验:少问、少打断、解释清楚、允许用户覆盖。

禁止:

- 因为用户跳过一次纠偏/功能性,以后就只推荐主训练。
- 把纠偏/功能性做成冗长 checklist。
- 用羞辱式文案说用户“不均衡”“很弱”。
- 在训练中弹出长问卷。
- 把 safety 必要动作藏到付费墙后。

### 6.5 肌群发展等级模型

Rede 保留用户可理解、可分享、可用于训练决策的肌群等级系统。等级不是用户手填标签,不是绝对力量排行榜,也不是 LLM 主观判断;等级由 `RedeTrainingDecision` 内的本地纯函数派生模型估计,服务 Progress、Plan、CoachAction 和 Share / Growth System。

等级系统的工程目标:

- 给用户一个清晰成长符号: 胸部 Lv.10、背部 Lv.8、腿部 Lv.15。
- 把旧的 beginner / intermediate / advanced 训练水平并入同一等级系统,不保留第二套平行判断。
- 把卧推 100kg / 225lb 等公认重量突破纳入等级突破和级别晋升,形成可解释、可分享的 milestone。
- 给训练引擎一个可解释的均衡发展信号: 哪些肌群补足、维持、减少或恢复受限。
- 给分享系统一个强传播资产: level up、均衡度改善、PR/e1RM 置信提升。
- 保持 source-of-truth 纯净: 等级永远可重算,不写回 canonical AppData。

#### 6.5.1 模块边界

等级系统属于 `RedeTrainingDecision`,不是新 package、不是 persistence 层、不是 app view model 逻辑。

目标文件/符号边界:

| 层 | 目标职责 |
|---|---|
| `RedeDomain` | 承载 canonical AppData、`TrainingSession`、`TrainingSetLog`、`EstimateConfidence` 等基础值。除非未来需要持久化用户目标偏好,否则不新增等级 truth 字段。旧符号名仅作参考。 |
| `RedeDataHealth` | 生成 `CleanAppDataView` / clean projections,保证 raw AppData 不进等级模型。 |
| `RedeTrainingDecision` | 实现 `MuscleLevelEstimator`、`MuscleDevelopmentProfileBuilder`、`TrainingTierProjector`、`StrengthMilestoneCatalog`、`MuscleLevelProjection`、`MuscleLevelShareProjection` 等纯派生 API。 |
| SwiftUI app | 只读取 projection 渲染 Progress / Plan / Share Card,不自己计算等级。 |
| Persistence | 不保存等级结果;若保存用户目标偏好,必须走 `CanonicalSessionWriter` 已批准的 profile/program scalar edit 或新增明确写入类别。 |

禁止:

- raw AppData 直接进入等级模型。
- 把 `currentLevel`、`peakLevel`、`levelPoints`、`confidence` 写入 canonical AppData。
- app 层用 UI 状态、分享次数、外部社交反馈反向修改等级。
- 用 HealthKit 原始数据、体重、疼痛/伤病数据直接提高等级。
- 为等级系统引入网络、账号、云、SQLite/CoreData/SwiftData 或第三方 ML runtime。
- 继续维护一套独立于 `MuscleDevelopmentProfile` 的 beginner / intermediate / advanced 训练水平模型。

#### 6.5.2 输入合同

等级模型只接受 clean / typed 输入。目标输入形态:

```swift
public struct MuscleLevelEstimatorInput: Equatable, Sendable {
    public let cleanHistory: [TrainingSession]
    public let cleanProgramTemplates: [TrainingTemplate]
    public let cleanProgramGoal: ProgramGoalContext?
    public let userGoalPreference: MusclePriorityPreference?
    public let selfReportedTrainingBackground: TrainingTierPrior?
    public let exerciseCatalog: ExerciseCatalogSnapshot
    public let equipmentCalibration: EquipmentCalibrationSnapshot?
    public let supportContext: SupportAllocationContext?
    public let strengthMilestoneCatalog: StrengthMilestoneCatalog
    public let nowIso: String
    public let modelVersion: String
}
```

输入来源:

- `cleanHistory`: DataHealth clean view 里的 completed / valid training history。
- `TrainingSetLog`: 使用 `weight` / `actualWeightKg`、`reps`、`rir`、`techniqueQuality`、`painFlag`、`completionStatus`、`done`、`completedAt`。
- `ExercisePrescription`: 使用 `id`、`exerciseId`、`actualExerciseId`、`originalExerciseId`、`recordExerciseId` 和 sets/warmup/planned sets。
- `ExerciseCatalogSnapshot`: 提供 exercise identity、movement pattern、primary muscle、secondary muscle、muscle contribution weights、equipment tags 和 substitution family。
- `EquipmentCalibrationSnapshot`: 只用于提高或降低负重可比性的置信度,不得把未校准机器重量当作跨器械真值。
- `SupportAllocationContext`: 提供纠偏/功能性/主训练完成、跳过和安全锁信号,用于解释训练覆盖和用户耐受度。
- `MusclePriorityPreference`: 用户目标偏好,只能影响目标权重,不能手动改等级。
- `selfReportedTrainingBackground`: 用户在 onboarding/profile 里选择的训练背景,只能作为冷启动 prior,真实训练记录足够后必须被模型证据覆盖。
- `strengthMilestoneCatalog`: 公认动作重量突破目录,例如卧推 100kg / 225lb、深蹲 140kg / 315lb、硬拉 180kg / 405lb;目录用于 milestone 和 level floor,不是外部权威排名。

缺少关键输入时必须降级:

- 没有动作肌群贡献表: 只输出 `insufficientCatalog` limitation,不得估计该动作贡献。
- 没有足够历史: 输出 calibration 状态,显示“正在校准”,不得硬给高置信等级。
- 器械未校准: 允许使用 reps/RIR/完成趋势,但负重强度贡献降权。
- 疼痛/不适/技术差: 优先降低训练决策 aggressiveness,不得为了升级继续加量。

#### 6.5.3 输出合同

等级输出是 read-only projection。目标类型:

```swift
public enum MuscleGroupID: String, CaseIterable, Sendable {
    case chest
    case back
    case quads
    case hamstrings
    case glutes
    case shoulders
    case biceps
    case triceps
    case calves
    case core
}

public enum MuscleLevelTrend: String, Sendable {
    case rising
    case stable
    case declining
    case detraining
    case calibrating
}

public enum MuscleDevelopmentDecision: String, Sendable {
    case prioritize
    case maintain
    case reduce
    case recover
    case insufficientData
}

public enum TrainingTier: String, Sendable {
    case calibrating
    case beginner
    case novicePlus
    case intermediate
    case advanced
    case elite
}

public enum LevelBreakthroughKind: String, Sendable {
    case muscleLevel
    case trainingTier
    case strengthMilestone
    case balanceMilestone
    case consistencyMilestone
}

public struct StrengthMilestoneAchievement: Equatable, Sendable {
    public let milestoneId: String
    public let exerciseId: String
    public let displayName: String
    public let thresholdKg: Double
    public let thresholdLb: Double?
    public let achievedBy: StrengthMilestoneAchievementMethod
    public let sourceSetId: String?
    public let achievedAtIso: String
    public let linkedMuscleIds: [MuscleGroupID]
    public let levelFloor: Int?
    public let tierFloor: TrainingTier?
    public let confidence: EstimateConfidence
}

public enum StrengthMilestoneAchievementMethod: String, Sendable {
    case actualCompletedSet
    case estimatedOneRepMax
}

public struct LevelBreakthrough: Equatable, Sendable {
    public let kind: LevelBreakthroughKind
    public let targetId: String
    public let fromLevel: Int?
    public let toLevel: Int?
    public let fromTier: TrainingTier?
    public let toTier: TrainingTier?
    public let evidence: [MuscleLevelEvidence]
    public let achievedAtIso: String
}

public struct MuscleLevelEstimate: Equatable, Sendable {
    public let muscleId: MuscleGroupID
    public let currentLevel: Int
    public let peakLevel: Int
    public let levelProgress: Double
    public let trend: MuscleLevelTrend
    public let confidence: EstimateConfidence
    public let decision: MuscleDevelopmentDecision
    public let score: MuscleLevelScoreBreakdown
    public let evidence: [MuscleLevelEvidence]
    public let limitations: [MuscleLevelLimitation]
}

public struct MuscleDevelopmentProfile: Equatable, Sendable {
    public let estimates: [MuscleLevelEstimate]
    public let overallTier: TrainingTier
    public let balanceScore: Double
    public let strongestMuscleIds: [MuscleGroupID]
    public let priorityMuscleIds: [MuscleGroupID]
    public let strengthMilestones: [StrengthMilestoneAchievement]
    public let breakthroughs: [LevelBreakthrough]
    public let generatedAtIso: String
    public let modelVersion: String
}
```

输出语义:

- `currentLevel`: 当前发展等级,用于 Progress / Plan / CoachAction。
- `peakLevel`: 历史最高等级,用于成就和分享;单日状态差不得降低 peak。
- `levelProgress`: 到下一级的进度,范围 `0...1`;不得显示为医学或体型诊断。
- `trend`: 最近趋势,必须经过平滑,不能因一次训练表现波动立即改变。
- `confidence`: 复用 `EstimateConfidence` 的 low / medium / high 语义。
- `decision`: 给计划引擎的动作语义,不是 UI 文案。
- `evidence`: 至少说明主要依据,例如“最近 6 周拉类有效组不足”“卧推 e1RM 置信提升”“腿部训练量高且恢复稳定”。
- `limitations`: 说明为什么不确定,例如历史不足、器械未校准、动作库缺肌群权重、疼痛信号存在。
- `overallTier`: 旧 beginner / intermediate / advanced 的替代输出,由肌群等级、训练一致性、关键动作 milestone、数据质量和安全限制共同推导。
- `strengthMilestones`: 已确认或高置信估算的公认重量突破;actual set 和 e1RM 估算必须明确区分。
- `breakthroughs`: 本次 projection 识别到的等级/级别突破,供 Progress、CoachAction 和 Share Card 使用。

#### 6.5.4 等级尺度

用户可见等级采用整数等级:

- V1 使用 `Lv.1...Lv.20` 作为主展示尺度。
- `TrainingTier` 使用 `calibrating / beginner / novicePlus / intermediate / advanced / elite`。产品文案可以显示为“校准中 / 初级 / 进阶初期 / 中级 / 高级 / 精英”,但它必须来自等级系统,不再来自独立的旧 `AutoTrainingLevel`。
- 同一用户身上的不同肌群可以并排显示,但解释必须写清: 这是“个人肌群发展画像”,不是跨人、跨性别、跨体重、跨器械的绝对排名。
- 高级用户达到上限后,后续可通过 tier / prestige 扩展,但不得在 V1 先做复杂体系。

内部计算使用 `levelPoints` / `developmentScore`:

- `developmentScore`: `0...100` 的模型分数,不直接暴露给普通用户。
- `currentLevel`: 由 `developmentScore` 经每肌群校准阈值映射。
- `levelProgress`: 当前分数到下一等级阈值的比例。
- `peakLevel`: 由历史已确认 `currentLevel` 派生;没有持久化前可在 projection 内从历史窗口重算,未来若要做长期成就账本必须先定义独立写入合同。
- `overallTier`: 由多个肌群等级、训练一致性、关键动作 milestone、balanceScore、confidence 和 safety limitation 推导;不能由用户 profile 的 trainingLevel 直接决定。

等级降级规则:

- 单次训练差、单周少练、一次跳过,不得直接降级。
- 连续 detraining、训练覆盖长期缺失、恢复/疼痛长期限制,可以让 `currentLevel` 下降或进入 `declining` / `detraining`。
- `peakLevel` 不随下降而消失,用于保护用户成就感和分享资产。

旧训练水平模型合并规则:

- 旧 `TrainingLevelEngine.AutoTrainingLevel` / `TrainingLevelAssessment` 不再作为独立产品模型演进。干净重写直接实现 `TrainingTierProjector` 语义;只有在 review slice 证明必要时,才做 compatibility adapter。
- Profile 里的 `trainingLevel` 只能作为用户自报训练背景,用于冷启动 prior 和初始文案;当 clean history 足够时,真实训练记录、肌群等级和 milestone 证据覆盖 self-report。
- 旧模型里的 feature gate,例如 beginner 时保守推荐、advanced exercise selection、recommendation confidence,必须改读 `TrainingTier` + `confidence` + `safety/recovery` 组合语义,不得继续散落比较 raw string。
- UI 只能展示一个等级系统: 肌群 Lv + overall tier + milestone。不得同时出现“系统判定中级”和另一套不相关的“胸 Lv.10 / 背 Lv.8”解释。

整体级别推导原则:

| Tier | 语义 | 典型条件 |
|---|---|---|
| `calibrating` | 数据不足 | 历史不足、关键动作 identity 不稳定或 confidence low。 |
| `beginner` | 正在建立训练基础 | 多数核心肌群 Lv.1-Lv.5,训练频率/动作覆盖仍在稳定。 |
| `novicePlus` | 已能稳定执行基础训练 | 多数核心肌群 Lv.5-Lv.8,有基础一致性,但 milestone 或覆盖仍不足。 |
| `intermediate` | 可承受更明确的计划推进 | 多数核心肌群 Lv.8-Lv.12,至少一个关键动作族有中置信 milestone 或稳定 e1RM 进步。 |
| `advanced` | 可承受更复杂训练组织 | 多数核心肌群 Lv.12-Lv.16,多个动作族有高置信进步或重量突破,且 safety limitation 可控。 |
| `elite` | 极高训练发展水平 | Lv.16+ 肌群广泛存在,多个核心动作达到高阶 milestone,且长期一致性高。V1 只可作为展示,不得默认增加训练风险。 |

这些 level range 是 V1 起点,必须由 `MuscleLevelModelConfig` 集中管理。`overallTier` 必须可以被 balanceScore 和 safety/recovery 限制下调:例如卧推很强但背/腿长期缺口大,可显示“水平推已进入中级 milestone,整体仍在进阶初期”。

#### 6.5.5 公认重量里程碑与级别突破

重量 milestone 是等级系统的一等输入和分享资产,但不是万能强度标准。V1 里程碑只作为 product milestone / cultural milestone,用于“突破某级、进入某级别”的可解释事件;它不能替代完整肌群发展画像。

`StrengthMilestoneCatalog` 必须满足:

- 目录集中定义在 `RedeTrainingDecision`,带 `modelVersion`。
- 每个 milestone 绑定 canonical exercise、movement family、linked muscle ids、threshold kg/lb、achievement method、level floor、tier floor、confidence rule 和 display copy。
- kg/lb 都要支持;美国市场默认显示 lb。`Bench 100kg` 与 `225 lb Bench` 属于同一 milestone family 的地区化表达,不是精确单位互换;catalog 必须分别保存 metric threshold 和 imperial threshold。
- barbell milestone、dumbbell milestone、machine milestone 分开。机器动作只有在 gym equipment / machine calibration 足够时才能生成机器本地 milestone,不得冒充 barbell milestone。
- milestone 分为 `actualCompletedSet` 和 `estimatedOneRepMax`。用户真实完成 100kg 卧推才是“Bench 100kg hit”;e1RM 跨过 100kg 只能显示“estimated 100kg bench strength”。
- 疼痛、poor technique、异常数据、未完成 set、身份不稳定或单位不可信时,不得触发正式 milestone。

V1 起始 milestone 示例:

| Milestone | 适用动作 | linked muscles | level / tier 影响 |
|---|---|---|---|
| Bench 60kg / 135lb | `bench-press` actual set 或 high-confidence e1RM | chest、triceps、shoulders | 水平推基础突破,可给 chest/horizontal press Lv.4 floor。 |
| Bench 80kg / 185lb | `bench-press` actual set 或 high-confidence e1RM | chest、triceps、shoulders | 水平推进阶突破,可给 Lv.7 floor。 |
| Bench 100kg / 225lb | `bench-press` actual completed set 优先 | chest、triceps、shoulders | 水平推中级突破,可给 chest/horizontal press Lv.10 floor,并触发 `intermediate` tier candidate。 |
| Bench 120kg / 265lb | `bench-press` actual completed set 优先 | chest、triceps、shoulders | 高中级突破,可给 Lv.13 floor。 |
| Bench 140kg / 315lb | `bench-press` actual completed set 优先 | chest、triceps、shoulders | 高级突破,可给 Lv.16 floor,并触发 `advanced` tier candidate。 |
| Squat 140kg / 315lb | `squat` actual completed set 优先 | quads、glutes、hamstrings、core | 下肢中级突破,可给 lower-body Lv.11 floor。 |
| Deadlift 180kg / 405lb | `deadlift` actual completed set 优先 | hamstrings、glutes、back、core | 后链高级前置突破,可给 posterior-chain Lv.14 floor。 |
| Overhead Press 60kg / 135lb | `overhead-press` actual completed set 优先 | shoulders、triceps、core | 垂直推中级突破,可给 shoulders Lv.10 floor。 |
| Weighted Pull-up +20kg / +45lb | `weighted-pull-up` actual completed set 优先 | back、biceps、core | 拉类中级突破,可给 back Lv.11 floor。 |

里程碑影响规则:

- milestone 可以给相关肌群 / movement family 设置 level floor,但不能直接把所有相关肌群拉到同一级。
- milestone 可以触发 `TrainingTier` candidate,但 overall tier 必须同时看 balanceScore、训练一致性、数据质量和 safety limitation。
- 如果 milestone 和日常训练覆盖冲突,UI 必须解释为“力量突破已达成,但整体发展仍需补足”,不能强行美化。
- milestone 不替代体重相对强度。V1 不做复杂体重/性别/年龄排名;未来如引入相对强度或 public benchmark,必须是 optional reference,并写清隐私与公平性边界。

#### 6.5.6 计算 pipeline

`MuscleLevelEstimator` 的标准 pipeline:

1. **Build clean set events**: 从 clean history 展平 completed sets,解析 exercise identity、actual exercise、weight/reps/RIR、technique、pain、time。
2. **Attach exercise contribution**: 通过 `ExerciseCatalogSnapshot` 给每个 set 绑定 muscle contribution weights。
3. **Normalize load evidence**: 对 free weight、plate-loaded machine、selectorized machine 使用不同置信策略;未校准机器不参与跨器械强度比较,只参与本器械趋势。
4. **Detect strength milestones**: 从 actual completed set 和 high-confidence e1RM 中识别 `StrengthMilestoneAchievement`,区分真实完成和估算突破。
5. **Compute muscle exposure**: 按 muscle contribution 汇总 effective sets、weekly frequency、recent coverage、movement pattern coverage。
6. **Compute performance signal**: 复用 e1RM（Epley `w×(1+r/30)`,同 `SessionSummary`/`RedeLocalSnapshot.ProgressSnapshot`,无独立 `E1RMEngine` 类型）的概念,按动作族和肌群汇总可比强度趋势;RIR 缺失或技术差时降权。
7. **Compute progression signal**: 计算同肌群/同动作族在 recent window 和 baseline window 的趋势,避免只看单次 PR。
8. **Compute recovery/safety adjustment**: 疼痛、poor technique、support safety lock、长期跳过纠偏/功能性动作会降低 aggressiveness。
9. **Apply user goal weights**: 默认 balanced;用户选择专项目标时只调整目标 gap,不改事实分数。
10. **Apply milestone floors**: 对相关肌群 / movement family 应用 milestone level floor 和 tier candidate,但受 confidence、balance 和 safety 限制。
11. **Map score to level**: 每肌群独立阈值映射为 `currentLevel`、`levelProgress` 和 `trend`。
12. **Project overall tier**: 用 `TrainingTierProjector` 生成 `overallTier`,替代旧 `AutoTrainingLevel` 独立模型。
13. **Build decision semantics**: 输出 prioritize / maintain / reduce / recover / insufficientData。
14. **Build explanation**: 生成 evidence / limitation / user-facing summary,供 Progress、Plan、CoachAction、Share Card 使用。

初始窗口建议:

- `recentWindow`: 最近 6 周,用于趋势和当前计划建议。
- `baselineWindow`: 最近 24 周,用于个人基线和等级稳定性。
- `minimumCalibration`: 至少 3 次相关训练或 8 个有效工作组才允许显示 low-confidence level。
- `mediumConfidence`: 至少 6 次相关训练、18 个有效工作组、覆盖 2 个动作族。
- `highConfidence`: 至少 12 次相关训练、36 个有效工作组、覆盖 2 个以上动作族且关键动作 identity 稳定。

这些阈值是 V1 模型常量,必须集中定义、带 `modelVersion`,并由 fixtures 覆盖;不得散落在 UI 或多个 engine 文件里。

#### 6.5.7 分数构成

每个肌群的 `developmentScore` 由以下子分数组成:

| 子分数 | 作用 | 主要输入 | 工程要求 |
|---|---|---|---|
| `exposureScore` | 是否练够 | effective sets、训练频率、肌群贡献权重 | 动作贡献缺失时降置信,不得猜肌群。 |
| `performanceScore` | 是否具备可比强度 | e1RM、reps/RIR、同动作族表现 | 未校准机器只做本器械趋势,不跨器械比较。 |
| `milestoneScore` | 是否达到公认重量突破 | `StrengthMilestoneAchievement`、canonical lift identity、actual/e1RM method | milestone 只能影响相关肌群和 tier candidate,不能覆盖 safety 或 balance。 |
| `progressionScore` | 是否在进步 | recent vs baseline slope、PR/e1RM delta、完成质量 | 单次 PR 只能触发 evidence,不能独立决定等级。 |
| `coverageScore` | 是否练得全面 | movement pattern、primary/secondary muscle distribution | 胸/背/腿等肌群各自有覆盖规则。 |
| `consistencyScore` | 是否稳定训练 | 周频率、连续性、计划完成度 | 跳过记录影响趋势,但用户偏好不等于事实缺失。 |
| `recoveryPenalty` | 是否该降激进度 | painFlag、poor technique、support safety lock、恢复受限 | Safety/recovery 永远优先于升级。 |
| `goalAdjustment` | 是否符合当前目标 | balanced / specialization preference | 只改目标 gap,不改原始事实。 |

默认权重不写死在 UI。V1 可用规则模型,但必须满足:

- 所有权重集中在 `MuscleLevelModelConfig`。
- 输出带 score breakdown。
- 同一输入必须确定性输出同一等级。
- 不允许 NaN、无限值、负等级或空 muscle id。
- 模型变更必须递增 `modelVersion` 并更新 goldens。

#### 6.5.8 个体校准

每个用户、每个肌群必须独立校准:

- 胸、背、腿不能按绝对重量互相比较。
- 同一肌群内,barbell、dumbbell、plate-loaded、selectorized machine、bodyweight 也不能简单相加。
- 初期使用个人历史作为主要锚点;数据不足时只显示 calibrating / low confidence。
- 若未来引入外部 percentile 或 crowd benchmark,只能作为 optional reference,不得在无同意、无数据质量证明时参与核心训练决策。

个体差异要被显式建模:

- 肌耐力强的人: 多组表现下降小,trend / consistency 得分更稳定。
- 肌耐力弱的人: 后续组掉得多,但只要可重复且符合计划,不直接判差。
- 状态波动大的人: confidence 降低,计划调整更保守。
- 喜欢递增/递减/波浪组的人: 从 `SetExecutionModel` / set-shape learning 读取偏好,只影响同一训练中的处方形状,不直接提高肌群等级。

#### 6.5.9 冷启动和低数据状态

新用户不能被迫回答大量问题。等级系统冷启动策略:

1. 默认 balanced development。
2. Onboarding 最多只问训练目标和训练背景;训练背景只成为 `selfReportedTrainingBackground`,不再成为独立 training-level 真相。
3. 前 2-4 次训练以校准为主,展示“正在校准肌群等级”。
4. 有低置信结果时可显示等级,但必须带 confidence 和 limitation。
5. Progress 可以显示“数据还少,先用接下来几次训练提高判断准确度”。
6. Plan 在 low confidence 下只做轻微补足建议,不做大幅计划重排。
7. 用户自报高级但历史证据不足时,显示“按你的背景先保守校准”,不得直接开启高级训练决策。

用户可以手动选择目标:

- balanced。
- upper emphasis。
- lower emphasis。
- posterior-chain / glute emphasis。
- push / pull balance。
- specific weak-point focus。

这些目标只影响计划偏好和 gap target,不得作为等级事实写入。

#### 6.5.10 决策接入

等级模型的输出进入决策系统时必须经过语义层:

| 消费方 | 读取内容 | 不允许 |
|---|---|---|
| Progress | `currentLevel`、`peakLevel`、trend、confidence、evidence、limitations、balanceScore | 展示原始敏感数据或羞辱式弱项文案。 |
| PlanAdjustment | `decision`、priorityMuscleIds、recoverMuscleIds、goal gap | 只因 level 低就机械加训练量。 |
| Scheduler | 肌群优先级、恢复限制、覆盖缺口 | 忽略 safety lock 或 recovery signal。 |
| CoachAction | 可执行建议和解释,例如“本周多补 2-4 组水平拉” | 生成无法执行、不可回滚或强迫用户的建议。 |
| Share / Growth | 脱敏后的 Muscle Level / Level Up / Balance projection | 读取 raw AppData、HealthKit 原始值或私人 notes。 |
| Legacy consumers | 需要 beginner/intermediate/advanced 的保守度或高级功能 gate | 不得继续读取旧 `AutoTrainingLevel` raw string 作为平行真相。 |

优先级规则:

1. SafetyLock / pain / recovery risk 高于等级升级。
2. 用户目标偏好高于默认 balanced,但低于安全和数据质量。
3. Level gap 高但 confidence low 时,只做观察或轻微建议。
4. Level gap 高且 confidence medium/high 时,Plan 可以提出补足。
5. 强项 level 高不等于完全不练;Plan 只能降低维持量,不得让强项长期归零。
6. 用户连续拒绝某肌群补足建议时,系统降低打扰频率,但保留可解释提醒。
7. milestone 可以提升相关动作族的信心和 level floor,但不能绕过 SafetyLock / pain / poor technique。

#### 6.5.11 UI 和文案边界

用户可见表达:

- “胸部 Lv.10”
- “背部 Lv.8 · 正在补足”
- “腿部 Lv.15 · 维持即可”
- “整体级别: 中级”
- “卧推 100kg 突破 · 水平推进入 Lv.10”
- “整体均衡度 76”
- “本月背部升级 Lv.8 -> Lv.9”

必须同时提供解释入口:

- 为什么是这个等级。
- 置信度如何。
- 最近哪些训练影响了判断。
- 下一步建议是什么。
- 用户如何接受、忽略或调整目标。

禁止文案:

- “你的背很弱。”
- “你的腿过强所以不用练。”
- “等级低说明身材差。”
- “分享才能解锁训练建议。”
- “系统确定你有伤病/疾病。”
- “卧推 100kg 所以你全身都是高级。”

#### 6.5.12 与分享系统的连接

分享系统只消费脱敏 projection:

```swift
public struct MuscleLevelShareProjection: Equatable, Sendable {
    public let muscleId: MuscleGroupID
    public let displayLevel: Int
    public let levelProgress: Double?
    public let overallTierLabel: String?
    public let milestoneBadge: String?
    public let trendLabel: String
    public let confidenceLabel: String?
    public let safeEvidenceSummary: String
    public let generatedAtIso: String
}
```

分享卡默认可用:

- muscle name。
- level。
- overall tier。
- milestone badge,例如 `Bench 100kg` / `225 lb Bench`。
- trend。
- level-up delta。
- balance score。
- safe evidence summary。

分享卡默认禁用:

- 体重、HealthKit 原始数据、疼痛、伤病、失败组、RIR 明细、健身房位置、精确时间、私人 notes。

Level Up Card 触发条件:

- `currentLevel` 跨过新等级阈值。
- confidence 至少 medium,或用户明确允许 low-confidence 成就提示。
- 不是由单次异常数据造成。
- 没有 safety/recovery limitation 阻止庆祝式文案。
- milestone card 必须标明 actual 或 estimated,不得把 e1RM 估算写成真实完成。

#### 6.5.13 Rewrite Parity Slices

等级系统必须按可验收 rewrite slice 实现。每片先定义目标行为、输入输出、fixtures、Swift tests 和 UI 验收,再写 runtime;旧代码只作为参考,不作为完成证明。

| Slice | 内容 | 验收 |
|---|---|---|
| MLE-0 Contract | 本节工程合同、测试计划、fixtures 目录约定 | 文档通过 diff check,不改 runtime。 |
| MLE-1 Types + Pure Estimator | 在 `RedeTrainingDecision` 新增 public types、`MuscleLevelEstimator`、`MuscleLevelModelConfig`、`TrainingTier` | `swift test` 覆盖空历史、低/中/高置信、无 NaN、确定性输出。 |
| MLE-2 TrainingTier Unification | 实现 `TrainingTierProjector` / optional compatibility adapter,把 beginner / intermediate / advanced 并入肌群等级系统 | 不再有第二套用户可见 training level;所有消费者读 semantic capability。 |
| MLE-3 Exercise Contribution Snapshot | 将动作库肌群贡献、movement pattern、equipment tags 接成 typed snapshot | 缺贡献时输出 limitation,不猜测。 |
| MLE-4 Strength Milestone Catalog | 新增 `StrengthMilestoneCatalog`,覆盖卧推 100kg / 225lb 等 milestone | actual/e1RM 区分,机器不得冒充杠铃 milestone。 |
| MLE-5 Progress Projection | Progress read path 接入等级、整体级别、milestone、趋势、置信度、证据 | UI 只读,不写 AppData。 |
| MLE-6 Plan / CoachAction Integration | PlanAdjustment / CoachAction 读取 decision semantics | Safety/recovery 覆盖等级补足,用户拒绝可回滚。 |
| MLE-7 Share Projection | 生成 `MuscleLevelShareProjection`,接 `ShareSnapshot` | 分享 projection 不含禁用字段,milestone 标明 actual/estimated。 |
| MLE-8 Calibration Refinement | beta 数据后调整模型权重和阈值 | 递增 `modelVersion`,更新 goldens 和 changelog。 |

#### 6.5.14 测试要求

最低测试矩阵:

- cold start: 无历史时输出 calibrating / insufficientData。
- low confidence: 历史少但可显示 low-confidence level。
- balanced user: 多肌群训练均衡时不提出过度补弱。
- chest-strong/back-lagging: 推类多、拉类少时背部 prioritize,胸部 maintain。
- leg-strong-maintain: 腿部 level 高但仍保留维持量。
- pain/recovery override: 疼痛或 safety lock 时 decision 为 recover,不因低等级加量。
- machine calibration unknown: 机器重量参与本器械趋势,不参与跨器械强度比较。
- exercise catalog missing contribution: 输出 limitation,不得猜肌群。
- set-shape preference: 递增/递减组偏好不直接改变 level。
- detraining: 长期缺失训练后 currentLevel 可下降,peakLevel 保留。
- legacy merge: 旧 beginner/intermediate/advanced 不再产生第二套 UI;`overallTier` 是唯一输出。
- self-report override blocked: 用户自报 advanced 但训练历史不足时仍为 calibrating / low confidence。
- bench 100kg actual milestone: `bench-press` actual completed set 100kg 触发 `StrengthMilestoneAchievement`,给 chest/horizontal press Lv.10 floor 和 intermediate candidate。
- bench 100kg estimated milestone: e1RM 估算跨 100kg 时标记为 estimated,不得写成 actual hit。
- machine chest press blocked: 未校准 machine chest press 100kg 不触发 barbell bench milestone。
- imbalanced milestone: 卧推 100kg 但背/腿长期不足时,水平推可进 milestone,overallTier 不得强行 advanced。
- share privacy: `MuscleLevelShareProjection` 不含禁用字段。

验证命令(`RedeTrainingDecision` 是现役引擎包,M1-1 起重建,CI 每次运行):

```bash
cd ios/packages/RedeTrainingDecision
swift test
```

若等级模型影响 `PlanAdjustment`、`CoachAction` 或 app UI,还必须跑全 package 测试和 iOS build。

LLM 可用于解释、总结和生成自然语言提醒;不得由 LLM 单独判定肌群等级。等级估计必须能由本地可审计模型复算。

## 6.5 周期化引擎（Mesocycle · FR-PL2）

> **实现状态（2026-06-15）:** owner 拍板做此功能（4 周块 + 主动过载）。5 步 slice **全部已实现**——S1 纯相位计算（`MesocyclePhase.swift` + golden）、S2 接处方调制、S3 与反应式减载合并、**S4 schema 8→9 落库**（迁移于 `AppData.init(decoding:)` 先于 validate、纯加性、可逆 down、读不改盘）、**S5 计划页周期条**（4 周块·当前周 ember·相位角色；FR-PL1 关闭/空历史退诚实占位）。**默认 `enabled=false` = 零行为回归**（设置页「训练周期」开关已上，opt-in；owner 2026-06-15「继续」拍板启用——经写闸 `applyMesocyclePreference` 落 `mesocycle.enabled`，开后今日页处方吃相位、计划页显示周期条）。本节是**目标契约**；进度/证据看 DEV_LOG。

**模型（owner 选「最权威/最专业/最符合人体生理」拍板）。** 一个 mesocycle = **4 个 ISO 周累积块（3:1 load:deload）**，4 个周角色 校准 / 构建 / **过载（主动）** / 减载。选 4 周而非 6 周：4 周（3:1）是 Helms/RP/NSCA meta 证据最强的默认中周期，且计划减载落第 4 周正好领先反应式规则 4 的 21 天（=3 周）窗口约一周——计划在前主动减、反应在后兜底减，节律天然对齐（6 周块会让安全网频繁抢跑）。块长 `blockLengthWeeks` 存进数据（=4），未来改 6 周只改数据 + 加一张角色表，不改引擎契约。

**相位调制（与 light×0.9 / deload×0.8 同款，正交叠乘）。** 每周角色产一个 `PhaseModulation{weightMultiplier, setDelta, rirTarget}`，叠在 verdict 调制**之前**（同 2026-06-10 拍板的「冷启动先验×裁决正交叠乘」模式）：

| 周 | 角色 | weightMul | setDelta | rirTarget |
|---|---|---|---|---|
| 1 | 校准 calibrate | 1.00 | 0 | 2.5 |
| 2 | 构建 build | 1.00 | 0 | 2.0 |
| 3 | **过载 overreach** | 1.00 | **+1** | **1.0** |
| 4 | 减载 deload | **0.85** | **−1**（下限 2） | 3.5 |

过载主动（+1 组、RIR 压到 1 = 功能性过载），重量仍交给现有双重渐进自然涨（phase 不主动加重，把"假过载"风险压最低）；减载主动卸量。四类 loadType（external / bodyweight / band / assisted / bodyweight-plus）沿各自已有的 light/deload 反转分支，phase 减载只是多触发一次现有 deload 形态，零新方向逻辑。

**相位推进（按 ISO 周，纯函数）。** `phase(blockStartISO, todayISO, blockLengthWeeks)`：weeksElapsed = (今日日号 − 块起日号) / 7；weekInBlock = weeksElapsed % 4 → 查角色。日期非法 / today<blockStart → 安全降级校准（不抛错、不画假进度）。**相位永远从真数据现算，零写死计数器**（FR-PL1）。

**块锚点（可从真历史重算，防腐烂）。** `blockStartISO` = 「最近一段连续训练序列」起点（从最新场往回，相邻 ≤ `restartGapDays`=10 即同块）；**停训 ≥10 天 → 软重置**锚到今日（疲劳已清，再算"过载周"是假的，诚实优先于连续性；与 verdict 的 longGapReentry≥14天→light 协同）。空历史 → nil（计划页退诚实占位）。

**与反应式减载共存（安全优先，S3 收口）。** 反应式规则 4（21 天高量 → deload 裁决）**一字不动、保留为安全网、永远优先**。计划式减载**不抢 TodayCall 四态、不产 deload 裁决**，只作 phase 调制层塑形重量/组数/RIR（call 仍如实反映恢复状态）。管线：先跑 verdict（不改）→ 再跑带 phase 的 prescribe。**合并规则（实现版，比 min/sum 更简更安全）：phase 仅 `verdict.call == .train` 时生效；verdict 非 train（light / deload / rest）时 phase 整体让位给反应式安全网**——从根上杜绝双重调制（0.85×0.80 之类砍过头），且 phase 的核心价值（在身体报警前主动减载）正是落在 train 态。block 周序照常推进（让位不停摆），故下个训练日仍落对相位。各 loadType 路径（external/bodyweight-plus 减外加负重；自重/弹力带按次数；assisted 反转）共用同一 `applyPhaseSetsRir`（组数/RIR），weightMultiplier 只在重量轴路径套（方向安全）。

**数据模型。** AppData 加顶层 `mesocycle{enabled, blockStartISO, blockLengthWeeks}`；**不存"当前第几周"**（永远现算）。schema 8→9 走 `schema-migration-guard`（迁移钩子**必须先于 validate**、纯加性、可逆 down-migrate、备份、dry-run、单独 PR 禁 auto-merge——这是唯一会静默毁数据的环节）。

**实现落点（2026-06-15·S4/S5 收口）。** 迁移落在 `AppData.init(decoding:)`——唯一反序列化边界，一处覆盖全 reader（store.load / 写闸 re-validate / 测试夹具）；`SchemaMigrator.migrate` 先于 `SchemaVersion.validate`（current=9）。8→9 = 抬版本 + 缺则补 `mesocycle{enabled:false, blockLengthWeeks:4}`（纯加性、幂等、不覆盖既有）；`downMigrate` 反向去 mesocycle、回落版本（9→8 单步可逆）。**读路径纯内存升级、不改磁盘**——磁盘 canonical 只由已备份的写闸改写，原始 v8 文件始终可从备份恢复（= 备份/dry-run 要件，已由「读不改盘」测试钉死）。无迁移路径的旧版本（schema-7 及更早）仍如实 `upgradeRequired`、不静默升级；未来版本仍 `futureIncompatible`。`blockStartISO` 落库但消费侧仍从真历史现算（防腐烂，FR-PL1）；`blockLengthWeeks` 由今日页处方与计划页周期条**读同一份 `appData.mesocycle` 配置**透传，保证两页相位永不分叉（审查 MAJOR-1：结构保证，非「都恰好是 4」的巧合）。

## 7. Train 页面规则

Train 只有专注训练态。必须服务于：

- 当前动作。
- 目标组次、重量、reps、RIR。
- Complete Set。
- 快速编辑 weight/reps/RIR。
- Rest timer。
- Next/previous exercise。
- Swap exercise。
- Pain / discomfort。
- Skip set / skip exercise。
- Finish workout。
- Resume active session。

不进入 Train：

- 长期分析。
- 计划编辑。
- 设置。
- 营销卡片。
- 大型动作浏览。
- 与训练中低摩擦无关的按钮。

### 7.1 休息倒计时运行时合同

休息倒计时的「时间流逝」归 **app 层**（沿用 §核心纯净：引擎无时钟）。`TrainFlowState` 只存 `restSeconds` 计划值；倒计时锚点是 `SessionStore.restCountdown: RestCountdown`。

- **锚点形态**：`RestCountdown`（`RedeTrainingDecision` 包内纯值类型，`now` 注入故可单测）以**绝对结束时刻**记时——运行中存 `endDate`、暂停时冻结 `pausedRemaining`；任一帧的剩余秒数由「`endDate − 当下 Date`」求出，而非逐秒自减计数。
- **归属契约（why，owner 2026-06-15 反馈修复）**：剩余秒数**不得**放进 `TrainTabView` 的 `@State`。`RootTabView` 用 `switch selection` 渲染各 tab，切页会销毁整棵视图树 → 视图 `@State` 归 0 → 回到训练页倒计时显示 `0:00` 并立即结束。锚点必须放在根级常驻的 `SessionStore`（跨切页、跨切应用存活），且按墙钟求剩余 → 离屏（切 tab 或切出应用）期间真实时间照常流逝。
- **生命周期**：进入 `resting`（仅 `logSet` 一条路）由 `SessionStore.apply` 起锚；`restFinished` / 落到 `summary` / 结束·放弃·新开会话清空；`resting→confirmEnd→resting`（结束确认弹层取消后继续训练）折返期间**不动**锚点，剩余随墙钟延续不重置。跨进程恢复（FR-TR9）若落在 `resting` 按计划秒数重新起算（不留旧 deadline）。
- **显示与收尾分离**：倒计时显示由 `runRestTimer` 这个 `.task` 循环每秒递增 `restTick` 触发按墙钟重算重绘（**不用 `TimelineView`**——其在「切出应用再回前台」时不保证恢复逐秒刷新，owner 2026-06-15 二次反馈）；同一 `.task` 兼任「到点自动进下一组」（先判后睡，回来若已到点立即收尾、不闪 `0:00`）。`.task` 的 id（`restTaskKey`）含 `scenePhase`：**回前台时 key 变 → task 重启**（等价于切 tab 重建视图的效果），保证既追平离屏期间流逝、又续走逐秒刷新；后台不空转（`scenePhase != .active` 直接返回）。`+30` / 暂停 / 继续经 `SessionStore.addRestTime` / `toggleRestPause` 改锚点。
- **进度条与倒计时同步（owner 2026-06-15 三次反馈）**：进度条比例 = `RestCountdown.fraction()` = `剩余 / totalSeconds`，与倒计时数字同源 → 满格起步、`0:00` 精确归零。`totalSeconds` 是「本段休息总时长」，`+30` 时**同步增长**（`begin` 设值、`add` 累加、`clear` 归零）——故 `+30` 后进度条不会因 `剩余 > 初始计划` 卡在满格，而是按新总时长继续平滑下降。分母**不得**用 `restSecondsPlanned`（固定值会在 `+30` 后被 `min(1,·)` 钳成满格、与倒计时脱钩）。

## 8. Progress / Plan / Settings 边界

Progress：

- 历史训练。
- PR/e1RM。
- 训练量。
- 肌群发展等级、趋势、置信度和证据摘要。
- 日历连续性。
- 数据可信度。
- HealthKit/imported workout 的 display-only 证据。
- 从 Progress 派生的隐私安全分享卡入口。

### 8.0 进展派生投影（ProgressSnapshot · M4-1 已实现）

- **包边界**：`RedeLocalSnapshot` 重生为 Foundation-only 独立包（Master §5：与 `RedeDomain`/canonical AppData 强制解耦，永不读写真相）。输入是包内自有值类型 `SnapshotSessionRecord`（id + 本地日 dateISO + 动作/组 + 时长），由 app 组合层把 DataHealth clean view 映射进来（M4-3 接线）。
- **输出**：`ProgressSnapshotBuilder.build(sessions:)` 纯函数 → 历史（新→旧：volume/组数/顶组/PR 动作/时长）+ 每动作 e1RM 趋势（旧→新点列 + latest/best）+ 周训练量（ISO 周·周一起始，吨位/组数/场次）。
- **口径锁定**（与已落盘实现对齐，改动须过架构门）：e1RM = Epley `w×(1+r/30)` 取每场顶组（重量优先、同重比次数，同 `SessionSummary`）；PR = 顶组重量**严格大于**全部更早历史同动作顶组，首练不发奖（M3 保守口径）；volume = Σ 重量×次数；周键由纯整数日期数学（Hinnant civil-days）从 dateISO 推导，无 Calendar/时区依赖——固定输入产出固定结果。
- **防御**：非法日期条目整体跳过（上游 clean view 已保证合法）；legacy 的 median-e1RM/置信度门控不在本合同（置信度属数据质量层，且 §3.4 禁做 UI 读数）。

### 8.0.1 数据质量信号（DataQualityReport · M4-2 已实现）

- **合同**：`RedeDataHealth.DataQualityReportBuilder.build(view:)` 纯函数，输出 typed 最小信号：① 净化丢弃统计（聚合 `DataHealthIssue` 按 场/动作/组/字段 四类计数）；② 可疑组静默标记（通过合法性安检但不合常理的数字）。
- **可疑规则**（MVP 起步值，测试锁定待校准）：组重 > 1.5×本人**更早场**同动作最好顶组（基准 ≥30kg 防小重量噪声；首练无基准不标；被标组不进基准，防错值污染参照线）；绝对天花板 >400kg；次数 >50。一组一理由，优先级 天花板 > 相对 > 次数。
- **红线（结构化满足）**：只标记不丢弃不改数据（clean view 原样，有测试）；输出零文案——「置信度」在结构上不存在（§3.4 行为表达）；缺 RIR 类数据缺口刻意不进报告（§3.4 折进 Train 补记，不挂 Progress）。UI 标记与修正入口归 M4-3。
- **消费合同（M4-3 已接线）**：进展页统计（趋势/PR/判断句/历史合计）**排除可疑组**——可信度的行为表达（§3.4 判断更保守）；可疑组仍在数据区如实列出、canonical 原样不动；修正入口随 M5 编辑类写入。
- **已知边界（审查确认，刻意接受）**：被标组不进基准 ⇒ 单场真实暴涨 >1.5× 后基准不演化、持续被标——视为诚实行为（渐进超负荷不触发；一场跳 50%+ 几乎总是记错/换器械/单位混淆，应持续提示直到经 M4-3 修正入口处理）；有测试锁定该行为，阈值待真实反馈校准。

Plan：

- 未来几周训练结构。
- 当前 program template/config。
- proposed changes。
- rollbackable plan decisions。
- 基于肌群发展等级的均衡发展建议:补足、维持、减少或暂不判断。
- 从已确认计划派生的计划/动作分享入口。

Settings：

- Profile。
- Units。
- Screening。
- HealthKit permissions。
- Data export/backup UI。
- Subscription surfaces。

Account/sync/cloud settings 不进入第一版干净实现,不得做成无能力的 UI placeholder。

## 9. Share / Growth System

分享系统是 Rede 的商业化增长回路,负责把训练成果、肌群等级、PR、均衡发展和可执行计划转化为用户愿意主动传播的隐私安全资产。它不是第一版社交网络,也不是公开排行榜。第一版干净实现的 S0 边界是本地生成分享卡、调用 iOS Share Sheet、附带通用 App Store / landing link;账号、云端个人页、公开 feed、归因链接、远程模板库和好友关系都属于后续 Master-approved implementation slice。

### 9.1 产品目标

分享系统必须同时服务四个目标:

- **用户成就感**: 用户能把一次训练、一次 PR、一次肌群升级或一段连续训练表达成好看、可信、不会尴尬的卡片。
- **产品差异化**: 分享内容必须体现 Rede 的智能训练价值,例如肌群等级、均衡度、计划调整和证据解释,不能只是普通 workout screenshot。
- **低成本获客**: 每张分享卡都要带清晰 Rede 品牌和通用下载/落地页入口,让外部平台流量能回流。
- **隐私可信**: 分享默认不暴露敏感训练事实,用户必须在预览页明确选择要公开的内容。

### 9.2 可分享资产

| 资产 | 触发时机 | 默认内容 | 增长价值 | 隐私默认 |
|---|---|---|---|---|
| Workout Summary Card | 完成训练后 | 训练类型、完成动作数、总组数、训练时长区间、当日亮点 | 高频、低门槛、让用户形成分享习惯 | 隐藏健身房、精确时间、疼痛、notes、RIR 细节 |
| Muscle Level Card | Progress 中肌群等级稳定后 | 肌群 Lv、趋势、置信度、均衡度、下一步方向 | Rede 差异化最高,适合身份表达和复访 | 不显示原始重量和身体数据 |
| Level Up Card | 某肌群升级时 | `Back Lv.8 -> Lv.9`、升级原因摘要、近期训练一致性 | 强成就感,最适合 Story/Reels/短视频封面 | 不显示完整训练记录 |
| PR / e1RM Card | PR 或 e1RM 置信提升时 | 动作、PR/e1RM 摘要、进步幅度、置信度 | 美国力量训练用户容易理解 | 重量默认可见但可隐藏 |
| Balance Improvement Card | 推/拉、上下肢或肌群均衡度改善时 | 均衡度变化、补足方向、计划执行度 | 比单纯晒重量更专业,降低羞辱感 | 不显示低等级羞辱式文案 |
| Plan / Routine Card | 用户确认计划后 | 训练天数、目标、核心动作模式、适合人群 | 能带来导入和转化,是下一阶段增长资产 | 不包含用户历史表现和私人 notes |

### 9.3 ShareSnapshot 合同

`ShareSnapshot` 是分享系统的唯一输入合同。它是派生展示对象,不是 canonical AppData,不得写回真相。

`ShareSnapshot` 只能来自:

- DataHealth clean view。
- `RedeTrainingDecision` 派生的 Progress / Plan projection。
- `MuscleLevelEstimate` / `MuscleDevelopmentProfile` 的只读结果。
- completed session summary 的隐私过滤摘要。
- 用户确认后的 program / plan display projection。

`ShareSnapshot` 必须经过 `SharePrivacyFilter` 后才能渲染。默认允许字段:

- app brand / card type / generated date。
- workout category、动作模式、完成组数、训练时长区间。
- PR/e1RM 摘要和用户选择公开的重量单位。
- 肌群等级、趋势、置信度、均衡度和行动摘要。
- 计划目标、训练天数、动作模式和导入提示。
- 通用下载/落地页 URL。

默认禁止字段:

- 健身房位置、设备品牌/型号的可识别细节、精确训练时间。
- HealthKit 原始数据、体重、疼痛/不适、伤病筛查、私人 notes。
- RIR 明细、失败组细节、被跳过动作的负面原因。
- 用户联系方式、账号标识、设备标识。
- 任何可让外部平台反推出个人健康状态的敏感组合。

S0 分享实现不写 share event 到 canonical AppData。若未来需要本地分享历史、远程归因、referral、公开主页或社交互动,必须新增明确写入类别和 architecture gate。

### 9.4 用户流程

分享动作必须由用户主动触发:

1. 系统在完成训练、Progress 里程碑、肌群升级或计划确认后展示轻量分享入口。
2. 用户进入分享预览页,选择卡片类型、显示/隐藏字段、单位和视觉样式。
3. 系统本地生成图片或可分享 payload。
4. iOS Share Sheet 打开,用户自行选择 Instagram、TikTok、iMessage、WhatsApp、Reddit、Discord、AirDrop 或保存图片。
5. 分享后回到 Rede,系统可提示继续训练、查看计划或邀请朋友;S0 本地实现不承诺真实外部发布成功。

禁止:

- 自动发布。
- 默认公开。
- 在训练中打断 Focus 专注训练。
- 用羞辱、比较、恐吓文案刺激分享。
- 用分享作为访问核心训练记录的强制条件。

### 9.5 渠道策略

第一版优先外部平台传播,不自建社交网络。

| 渠道 | 分享形态 | 产品要求 |
|---|---|---|
| Instagram / TikTok | 竖版卡片、透明 overlay、短标题 | 视觉强、字少、能一眼看出等级/升级/PR。 |
| iMessage / WhatsApp | 图片 + 简短文字 + 下载链接 | 适合朋友/训练搭子转化,不依赖公开传播。 |
| Reddit / Discord | 图片 + 可复制文本摘要 | 适合健身社区,文案必须专业、可解释、避免营销味太重。 |
| AirDrop / Files | 图片或本地计划 payload | 适合线下健身房和朋友之间分享。 |

第一版只有通用下载/落地页 URL。per-user link、referral code、deferred deep link、share attribution、public profile 和 remote import link 都需要账号/云/analytics 架构批准。

### 9.6 分阶段实现

| 阶段 | 能力 | 架构边界 | 验收 |
|---|---|---|---|
| S0 Local Share Cards | 本地生成 Workout / Muscle Level / Level Up / PR / Balance 卡片,用 iOS Share Sheet 分享 | 不联网、不建账号、不写 canonical AppData、不做归因 | 用户完成训练或打开 Progress 后,能预览并分享隐私安全图片。 |
| S1 Importable Plan Payload | 从已确认计划生成脱敏 plan/routine payload,朋友可导入后按自己水平适配 | 只能使用脱敏计划结构;若通过远程链接传播,必须先过 Master gate | 接收者不需要看到原用户历史,也能生成自己的可执行计划。 |
| S2 Referral / Attribution | 分享链接、安装归因、landing conversion、referral reward | 需要 cloud/account/deep link/analytics gate | 能量化 share -> install -> first workout -> paid conversion。 |
| S3 Community Layer | 公开主页、好友、feed、挑战、评论、排行榜 | 需要账号、云同步、审核/举报、隐私和 moderation 体系 | 只有在 S0-S2 证明分享带来有效留存和付费后才进入。 |

### 9.7 商业化规则

- 基础分享卡不应重度 paywall,否则会压低传播。免费用户也应能分享带 Rede 品牌的核心训练/PR/等级卡。
- 付费权益可以包含更深的历史对比、长期趋势卡、高级肌群等级解释、计划导入适配和更丰富视觉样式,但不能移除必要隐私控制。
- 分享卡必须保留适度 Rede 品牌和下载入口;付费用户可以减少视觉水印强度,但不应完全切断增长回流。
- 分享系统的成功指标不是分享次数本身,而是外部触达后的 first workout、plan import、D7 retention 和 paid conversion。

### 9.8 指标与观测

S0 本地实现只能记录或估计本地行为;远程归因必须等 analytics / cloud gate。

S0 本地事件语义:

- `share_entry_shown`
- `share_preview_opened`
- `share_card_generated`
- `share_sheet_presented`
- `share_payload_exported`

S0 可用外部估计:

- landing page click 或 App Store product page click 的聚合趋势。
- beta 招募表单里用户自报来源。
- 用户访谈和社区反馈。

S2 以后才允许定义的归因事件:

- `shared_plan_imported`
- `first_workout_from_shared_plan`
- `share_referral_install`
- `share_referral_trial_started`
- `share_referral_paid`

S0 只要求本地可验证分享链路,不得为了归因引入账号、云端个人页、remote referral code 或跨 app tracking。S2 以后才允许把外部安装和付费归因纳入增长仪表盘。

### 9.9 合规与安全

分享系统默认把 Rede 定位在 fitness / training support,不得暗示医疗诊断、治疗或身体缺陷评估。任何使用 HealthKit、体重、疼痛、伤病、恢复或敏感身体数据的分享场景都必须默认关闭,且需要用户逐项选择公开。

不得把 HealthKit 或敏感健康数据用于广告定向、第三方营销或未披露 analytics。分享前必须有清楚预览,用户看见什么,外部平台就只得到什么。

### 9.10 非目标

第一版不做:

- 公开 feed。
- 好友关系和私信。
- 公开排行榜。
- 健身房/地区排名。
- 自动同步到 Strava / Hevy / Apple Fitness。
- 可公开访问的个人主页。
- 按分享次数解锁训练能力。
- 基于外部社交数据改变训练决策。

## 10. 干净重写缺口索引（实现状态）

> **状态图例**:✅ 已实现 · 🟡 部分实现 · ⬜ 未实现。已实现/部分项保留在此仅作回溯映射,完成程度真相以代码 + `docs/REDE_MVP_IMPLEMENTATION_PLAN.md` §9 为准。

| 缺口 | 实现状态 | 备注 / 剩余下一步 |
|---|---|---|
| 四 tab 商业化 IA | ✅ 已实现（M0-1） | Today / Train / Progress / Plan 已落地,Profile/Settings 为低频 sheet 非底部 tab。 |
| Progress 信息结构 | ✅ 已实现（M4-1/2/3） | 历史 + e1RM/PR 趋势 + 训练量 + 数据质量提示已 ship;肌群等级/可信度高级面仍未做。 |
| Focus 训练摩擦 | ✅ 已实现（M3-1/2/3 + M5-3） | 一屏完成训练、下一组建议、休息、跳过/替换/完成原因、刻度轨快改均已 ship。 |
| Exercise catalog | ✅ 已实现（内容 P0 + wave-1~8，目录 97 条） | 目录 JSON 化 + rank 匹配 + 覆盖矩阵 golden 已 ship;`TemplateGenerator`（肌群贡献权重生成）仍未做（FF）。 |
| Equipment 感知 / calibration | 🟡 部分（FR-EQ1 已实现 2026-06-11 + LoadGrid 档位） | 器械场景白名单过滤 + 真实档位已 ship;完整 `GymEquipmentPack`/`MachineProfile`/unknown-machine 校准仍未做。 |
| In-session prescription / warm-up | 🟡 部分（M3-1 已实现） | 逐组处方 + next-set recommendation 已 ship;warm-up generator、skip-learning 仍未做。 |
| Support allocation | ⬜ 未实现 | 先补 planned/completed/skipped/reason/safety lock 和 `SupportAllocationDecision`。 |
| Muscle level estimator | ⬜ 未实现 | 先按 MLE-1/MLE-2/MLE-4 做 `MuscleLevelEstimator`、`TrainingTierProjector` 和 `StrengthMilestoneCatalog`,再接 Progress / Plan / CoachAction / ShareProjection。 |
| Share / growth system | ⬜ 未实现（原型 05/06 已就绪） | 先做本地 `ShareSnapshot` + `SharePrivacyFilter` + iOS Share Sheet,不得引入账号、云或 feed。 |
| Backup/export | ⬜ 未实现 | 先做本地导出/备份 SPEC,再 amend architecture。 |
| Cloud/account/sync | ⬜ 未实现 | 先产出 Master-approved implementation slice,再写 runtime。 |
| watchOS/CRDT | ⬜ 未实现 | 先产出 Master-approved implementation slice,再写 runtime。 |

## 11. 验证

文档 / 规格变更:

```bash
git diff --check
```

干净 rewrite runtime 出现后,按 touched slice 运行最小真实验证。Swift package change:

```bash
cd ios/packages/<PackageName>
swift test
```

全 package 回归（与 `.github/workflows/rede-ci.yml` 的显式包清单保持同步）：

```bash
bash .claude/quality-gate.cmd
```

iOS app build:

```bash
xcodebuild \
  -project ios/Rede.xcodeproj \
  -scheme Rede \
  -destination 'generic/platform=iOS Simulator' \
  build
```

没有 Node/Vite/npm/Vitest 质量门禁。
