# Rede Product Copy Baseline — 产品文案基底

> **状态:** Canonical / living copy baseline
> **最后更新:** 2026-07-18（每周教练复盘双语文案已落地并完成本地 Simulator 验收；生产购买仍关闭）
> **适用范围:** 产品定位、v0 / 原型生成、App Store 文案、onboarding、paywall、UI microcopy、空状态、错误、通知、双语 locale
> **权威边界:** 本文定义 Rede 如何说话,视觉品牌与原型画面方向以 `docs/REDE_PRODUCT_DESIGN_LANGUAGE.md` 为准。本文不授权任何新功能、网络、云、HealthKit 范围、医疗判断或 source-of-truth 变更。功能与架构边界以 `docs/REDE_MASTER_TECHNICAL_ARCHITECTURE.md` 和 `docs/REDE_iOS_SYSTEM_LOGIC.md` 为准。

---

## 0. 这份文档要解决什么

Rede 的文案不能只是"正确标签"。它必须让用户一眼明白:这个 App 不是又一个训练日志,也不是黑箱 AI 私教,而是一个把训练判断说清楚的力量训练系统。

因此,本文不是字符串字典。它定义 Rede 的产品声音、语言资产、商业表达边界和双语写作方式。以后写 v0 prompt、App Store 文案、onboarding、paywall、UI 文案或英文 locale,先按本文判断一句话是否像 Rede,再决定具体字符串。

Rede 的声音:

> 像一个冷静、懂训练的人站在旁边:先给判断,再给理由;训练中不废话,只说下一步。

---

## 1. 核心语言资产

### 1.1 品牌主张

| 用途 | 中文 | English |
|---|---|---|
| 主标语 | **先判断,再带练。** | **Plan the lift. Show the reason.** |
| 解释句 | 不是训练日志,也不是黑箱教练。Rede 给出今天的动作、重量和理由。 | Not another logbook. Not a black-box coach. Rede gives you the lift, the load, and the reason. |
| 产品一句话 | 打开就知道今天练什么、上多少、为什么这么安排。 | Open the app and know what to lift, how much, and why it changed. |
| 商业化一句话 | Rede Coach 只增加 1.8 之后的新教练工具　1.8 的训练、记录和数据能力继续免费 | Rede Coach only adds new coaching tools built after 1.8. Rede 1.8 training, logging, and data tools stay free |

### 1.2 语言锚点

Rede 每个关键文案都应落在四个锚点之一:

1. **判断**:今天练不练,练什么,是否需要调整。
2. **带练**:下一组做什么,用多少重量,休多久。
3. **证据**:为什么这样安排,哪些记录支撑这个判断。
4. **控制权**:用户可以采纳、跳过、替换、降级、撤销。

如果一句文案不属于这四类,它大概率是装饰、废话或 dashboard 噪音。

---

## 2. 不是声音指南,是产品性格

### 2.1 Rede 的性格

| 特质 | 写法 | 不写成 |
|---|---|---|
| 冷静 | 今天可以练。推力 A 保留,肩上推举降级。 | 今天状态超棒,让我们燃起来! |
| 有判断 | 这周卧推动作还在进步,不用换计划。 | 根据智能分析,系统为你优化了计划。 |
| 可解释 | 肩部不适出现 2 次,今天避开高风险推举。 | AI 判断今天不适合高强度。 |
| 尊重用户 | 采纳 / 暂不处理 / 换动作 | 系统已为你安排最佳方案。 |
| 商业化但克制 | Rede Coach 只增加已明确列出的新教练能力 | 解锁你的全部潜能。 |

### 2.2 一句话原则

**少写"你会变得怎样",多写"现在该做什么,依据是什么"。**

力量训练用户不缺情绪鼓励,缺的是可执行判断:

- 今天练不练?
- 哪个训练日?
- 哪个动作先做?
- 上多少?
- 为什么降强度?
- 这周到底有没有进步?
- 计划改了什么,能不能撤回?

文案要服务这些问题,不是给产品贴"智能、专业、个性化"标签。

---

## 3. 中文与英文不是互译

### 3.1 写作顺序

每条关键文案先写"意图",再分别写中文和英文。

错误流程:

> 写中文 → 翻成英文 → 修几个词

正确流程:

> 场景意图 → 中文原生稿 → 英文原生稿 → 检查两边是否传达同一个产品判断

### 3.2 中文风格

中文要像一个成熟训练 App,不是客服、不是翻译腔、不是公众号。

优先:

- 短句。
- 动词开头。
- 具体训练词。
- 说结论,不绕铺垫。
- 可用少量中文节奏感,但不押口号。

示例:

- `今天可以练。推力 A 保留,强度略降。`
- `先做卧推。目标 3 组,每组 5 次。`
- `肩部不适出现 2 次,今天避开高风险推举。`
- `这周训练量偏低,下周补一组背部拉力。`

避免:

- `您`
- `为您`
- `即可`
- `贴心`
- `智能`
- `全方位`
- `开启旅程`
- `释放潜能`
- `打造专属方案`

### 3.3 English style

English should sound native to a US strength-training product: plain, concrete, slightly dry, and useful in the gym.

Prefer:

- Short declarative sentences.
- Familiar lifting words.
- Specific training decisions.
- User control.
- No wellness fluff.

Examples:

- `You can train today. Push A stays, with pressing volume capped.`
- `Bench first. 3 sets of 5.`
- `Shoulder discomfort showed up twice this week, so overhead work is scaled back.`
- `Back volume is low this week. Add one pull set next session.`

Avoid:

- `fitness journey`
- `unlock your potential`
- `crush it`
- `beast mode`
- `train smarter`
- `AI-powered personal trainer`
- `personalized just for you`
- `ultimate workout tracker`
- `seamless experience`

### 3.4 UI 微文案规约 (2026-06-08，去句号扩展 2026-06-15)

- **无句号（全语态，2026-06-15 扩展）:** 不止 UI 标签 / 按钮——**所有中文文案一律不收句号**，含判断句 / 理由句 / 收据句 / 空态 / 免责 / 隐私。原来用句号断开的两拍，改用**全角空格留白**（`今天可以练　首次训练，重量从轻`），不回退到句号、破折号或中点堆叠；句内顿号 / 逗号按需保留。问号 / 感叹号不在此限（疑问句保留 `？`）。
- **英文同源不同形:** 英文按本语言习惯——**行尾不收句点**（对标 Apple：`Train today` 而非 `Train today.`）；两个独立句之间可保留单个句点并正常大写第二句（`Train today. First session, starting light`）；**禁** em-dash 挂解释性补语（`Eased from 60 — last set hit failure` → `Eased from 60, last set hit failure`），但短同位语标签的 em-dash 可留（`5 days a week — built for strength`）。
- **双语原生（重申 §3.1，落到 UI）:** 中英各按本语言习惯写、不互译。中文不加字距、不用 `您` 类敬语；英文可用大写 + letterspacing 的仪表标签（overline）。同一意图、两种母语表达。
- **置信度不显示（决定）:** 数据可信度 / 置信度是**引擎内部量，不作 UI 读数显示**（取消「置信度高 / 中等」一类标签）。它通过**行为**表达：低可信 → 判断更保守、计划改动更小、新用户走「正在校准」；可落地的数据缺口（如缺 RIR）折进**它发生的地方**（训练时提示补记），不在 Progress 挂置信度标签。未来若新增的 Rede Coach 能力涉及此价值，只能表述具体行为，不出现「置信度」字样；现有数据质量提醒仍属于 Free Core。
- **周口径措辞（2026-07-04，审查修复批次拍板）:** 文案里的「周」必须与数据口径一字不差——① 数据是**滚动 7 天**（现存实例：dataHasFindings 的「近期」类措辞）双语写「近 7 天 / in the past 7 days」，禁写「本周 / this week」；② 数据是 **ISO 日历周**（weekStartISO 聚合、周一/周四提醒、补量按周抑制、**引擎 trainedDaysThisWeek——2026-07-15 周口径迁移后今日页周计划判断/补量卡/分段条全线属此类**）才可写「本周 / this week」，且训练计数单位=**天**；③ **进行中的日历周**不得与完整上周下对比结论——只报中性「本周至今 / so far this week」，周收口（下周一）恢复对比；④ **滚动排期分块**（PlanWeekProjection 从下一场起按每周场数分块）用顺序词「接下来 / 再往后 · Coming up / After that」，禁用日历周字面。①③④现存滚动/进行周口径文案有 RedeL10n 防回潮测试锁定；今日页周计划口径已迁日历周（②），由正向断言锁定（文案必须含「本周/week」+ 单位=天）。
- **腐烂承诺禁令（2026-07-06，M2 拍板）:** 空态 / 兜底 / 占位文案**禁止**「还在路上 / 将在后续版本加入 / on its way / later version」类未来承诺——功能上线后没人记得回头改，1.0 用户看到的就是假话（planEmpty 实证：FR-PL2/3/4 全上线后占位文案仍说「后续版本」）。兜底文案只写**当下如实状态 + 下一步**（「还没有训练计划　先从今日页开始」）。planEmptyHeadline/Note、planScheduleNote 已有防回潮断言锁定（testPlanEmptyCopyIsHonest）。

### 3.5 去 AI 味三铁律 (2026-06-15，owner 拍板)

Rede 的嗓音 = **冷、准、短、有分量**——像刻在器械上的字，不是教练在旁边唠。书面、克制（不口语随便、不网感）。写完一句，按这三条自检：

1. **不要句号**（见 §3.4）：终止句号全去，句间留白。
2. **砍 AI 四病:**
   - **破折号挂补语**：AI 爱用 `——` / `—` 把一句安慰或解释挂在事实后面（`只决定起始重量——之后跟着你的真实记录走`）。改：事实说完就停，或拆成第二个**事实**短拍（不是安慰）。
   - **鸡汤 / 自我说明**：`恢复也是训练的一部分` / `这里会出现对比` / `干得漂亮` 一类——删掉，或只留事实。成功反馈只确认事实（§4.3）。
   - **过度对仗**：太工整的排比 = 机器造。让相邻句长短不一。
   - **完备癖**：不必每个选项都配副注、每屏都加解释。能不说的就不说。
3. **保持分量**：去 AI ≠ 变随便。删词后若读着轻飘（`以后加` / `压着点` / `找回手感`），换回有重量的书面词（`后续版本加入` / `重量从轻` / `收工`）。

> **反例锚点**（owner 否决过的"太随意"版本，勿回头）：`歇了 7 天，今天轻点，先找回手感` / `冲增肌排的` / `导出功能还没做，以后加`。正解是冷静有分量，不是口语化。
> **落地真源:** 具体串以 `RedeL10n` 实际代码为准（TodayEngineCopy / OnboardingCopy / ProgressEngineCopy / TrainEngineCopy / RedeStrings），并有金句回归测试锁定。

---

## 4. Rede 的四种句型

> **标点更新 (2026-06-15):** 下列例句沿用旧排版、仍带句号；它们示意的是**句型结构**（判断 / 理由 / 带练 / 收据），不是最终标点。实装时按 §3.4 去句号、句间留白，并按 §3.5 三铁律自检。

### 4.1 判断句

判断句回答"现在该怎么练"。它是 Today、Plan 和未来新增教练能力的表达核心；现有判断句属于 Free Core，不能原样搬进 paywall 当作付费权益。

结构:

> 结论 + 训练对象 + 调整幅度

中文:

- `今天可以练。推力 A 保留,强度略降。`
- `今天适合降载。主动作保留,辅助量减半。`
- `今天不建议硬顶。改做低强度拉力和下肢辅助。`

English:

- `You can train today. Push A stays, with intensity slightly down.`
- `Deload today. Keep the main lift, cut accessory volume in half.`
- `Do not force a heavy day. Switch to lower-intensity pulls and lower-body accessories.`

规则:

- 不写"系统认为"。
- 不写"AI 判断"。
- 不写"最佳"。
- 不写"安全"保证。

### 4.2 理由句

理由句回答"为什么"。它是 Rede 的差异化资产,但不能写成长解释。

结构:

> 信号 + 影响 + 训练决策

中文:

- `肩部不适出现 2 次,所以今天避开高风险推举。`
- `上次卧推完成度高,今天保留原重量,先看第 1 组速度。`
- `本周背部训练量偏低,下次训练补一组拉力。`

English:

- `Shoulder discomfort showed up twice, so high-risk pressing is out today.`
- `Your last bench session was clean. Keep the load and watch the first set.`
- `Back volume is low this week. Add one pull set next session.`

规则:

- 用"信号"而不是"魔法"。
- 用"影响"而不是"算法"。
- 用"建议"而不是"命令"。

### 4.3 带练句

带练句出现在训练中。它不解释系统,只让用户少点几下、少想一点。

结构:

> 动作 + 目标 + 下一步

中文:

- `卧推。3 组 x 5 次。`
- `下一组:185 lb x 5,RIR 2。`
- `休息 2 分钟。`
- `完成本组`

English:

- `Bench press. 3 x 5.`
- `Next set: 185 lb x 5, RIR 2.`
- `Rest 2 min.`
- `Log set`

规则:

- Train 里不要写品牌宣言。
- 不用"恭喜"、"太棒了"堆反馈。
- 成功反馈只确认事实: `已记录` / `Logged`。

### 4.4 收据句

收据句回答"刚才发生了什么,是否可撤销"。它用于完成训练、采纳计划、改动作、数据修复。

结构:

> 已完成的动作 + 影响范围 + 撤销/查看入口

中文:

- `已保存训练记录。3 个动作有逐组数据。`
- `已套用计划调整。只影响下周训练。`
- `已换成哑铃划船。本次记录会归到替代动作。`

English:

- `Workout saved. 3 exercises include set-by-set data.`
- `Plan adjustment applied. It only changes next week.`
- `Swapped to dumbbell row. This session will be logged under the replacement.`

规则:

- 不夸用户。
- 不制造不可逆错觉。
- 涉及 source-of-truth 或 HealthKit 时必须说清范围。

---

## 5. 页面级声音

### 5.1 Today: 每天的判断入口

Today 不应像 dashboard。它要像训练前 30 秒的判断。

首屏应写:

1. 今天是否训练。
2. 训练日是什么。
3. 有什么调整。

**练完态当日总结（FR-T6，2026-07-05 拍板；K3/K4 推广 2026-07-16）**：「今天已练完」态下加当日总结块，双语基线——区头「今天这场 / Today's session」、总量标签「总量 / Volume」（数值千分位 + 单位）、meta 行「N 动作 · N 组 · 时长档」（复用分享卡 stat 标签同词）、PR 徽章复用「刷新纪录 / New PR」、分享入口「分享这场训练 / Share this workout」。休息日/回归日同块显示最近一场，区头「上一场 · 7月14日 / Last session · Jul 14」（日期 = 场次真实日期）。总结块下「下一场　全身 B · 6 个动作 / Next session…」预告行；练完态「本周练 N 天 · 合计 X kg」（单位=天，ISO 周，与分段条同账）。**去空虚化第一批其余基线（2026-07-16）**：训练 tab 待机「今天这场 / 上次 · 7月13日　全身 C · 3,450 kg · 9 组」；计划页「动作库 · 165 个动作」「上次 · 7月12日」「已练 5 周 · 14 天」。全部无句号；数据缺失整块/整行不显示，不写占位假话。
4. 为什么。
5. 从哪里开始。

示例:

中文:

> 今天可以练。推力 A 保留,肩上推举降级。
>
> 肩部不适出现 2 次,所以今天把高风险推举换成更稳的替代动作。

English:

> You can train today. Push A stays, overhead work is scaled back.
>
> Shoulder discomfort showed up twice, so high-risk pressing is replaced today.

Today 禁止:

- 堆连续打卡、PR、肌群热图等不会改变今天训练的统计。
- 用"状态很好"这类泛泛情绪词。
- 把 HealthKit 数据包装成医学判断。

### 5.2 Train: 训练中只说下一步

Train 是最克制的页面。用户在器械旁,手上可能有汗,注意力在下一组。

可写:

- `下一组:185 lb x 5,RIR 2`
- `休息 90 秒`
- `换动作`
- `疼痛或不适`
- `完成训练`

**教学提示一次性策略（2026-07-05 拍板）**：「点重量可调整　之后的建议随之更新」是教学文案不是状态信息——只在「没用过快改入口 且 累计完成 < 3 场」时显示，任一条件破即永久消失；说明书不驻留界面。「按计划目标开始」是状态行（完成组后变为「上组接近力竭，从 X 回调」等），不适用此策略。

不要写:

- `我们正在根据你的训练数据持续优化体验`
- `专注当下,成就更强的自己`
- `AI 已为你规划最佳下一组`

### 5.3 Progress: 训练成果的证据页

Progress 不是庆功墙,也不是 BI。它要告诉用户训练是否有效。**数据可信度由系统内部把关,不作 UI 读数显示（见 §3.4）。**

示例:

中文:

> 卧推趋势仍在上升。过去 4 次训练里,估算 1RM 提高 5 lb。

English:

> Bench is still trending up. Estimated 1RM is up 5 lb over the last 4 sessions.

> 缺 RIR 等数据缺口折进 Train（记录时提示补记），不在 Progress 挂「置信度」标签；可信度只通过判断保守度与「正在校准」态表达。

Progress 禁止:

- "你正在变得更好"这种无证据鼓励。
- 用单一总分定义用户。
- 把 Apple Health 导入训练混成 canonical training。

### 5.4 Plan: 每周教练工作台

Plan 的文案必须体现未来性、可控性和可撤销。不要像配置页。

示例:

中文:

> 下周保留 3 天训练。推力日降低肩部压力,拉力日补一组背部训练量。
>
> 这次调整只影响下周,采纳后可撤销。

English:

> Next week stays at 3 training days. Push day lowers shoulder stress; pull day adds one back set.
>
> This only changes next week. You can undo it after applying.

Plan 禁止:

- `系统已优化你的长期计划`
- `完美周期化训练`
- 没有 Preview / Apply / Reject 的"建议"

### 5.5 Settings: 信任不是卖点词,是清楚

Settings 里不要营销。只说事实。

**常驻副文门禁（2026-07-18 owner 拍板）:** 自解释的设置项只显示分区、行标题、当前值或控件，不在其下常驻一行“解释这个界面”的 caption。`导出训练数据`、`Free Core` 和可点击的训练背景行已经足够清楚，因此不再附“数据保存在本机 / 可导出”“此版本所有功能均包含在 Free Core”“点任意一行修改”等小字。这个门禁只删除冗余常驻副文；真实错误、购买核对状态、保存结果等即时反馈必须保留。训练背景行继续向 VoiceOver 提供自解释的“字段名 + 当前值”，但不再追加“点任意一行修改 / Tap any row to change it”提示。

> **实现状态（2026-06-13）:** 下面的 Apple Health / HealthKit 文案是 **FF 目标表面，当前未实现**——代码里没有 HealthKit。已 ship 的 Settings 隐私串遵循「未上线不提」（HealthKit 实装时再加这段）。本段保留为 HealthKit slice 落地时的文案基线。已 ship 的设置文案以 `RedeL10n` 实际串为准。

示例（FF·HealthKit slice 落地时启用）:

中文:

> Apple 健康数据只在授权后读取。导入训练会标记为 Apple 健康来源,不会直接计入力量训练历史。

English:

> Apple Health data is read only after you allow access. Imported workouts are labeled as Apple Health and do not become strength-training history.

---

## 6. 商业化文案

### 6.1 付费价值的表达

`Rede Coach` 是订阅层的统一用户名称。它的核心不是"更多功能",而是未来新增的"更少猜测,更多依据"；**Rede 1.8 已经提供的训练、记录、判断/解释、计划、进展、数据质量、肌群等级、导出与现有分享能力继续免费**。任何 paywall 文案只能描述已经真实实现、且 PRD 预先标为 paid 的新增能力，不得把现有能力换个名字后收费。

首个具体 Paid Coach 功能 **每周教练复盘 / Weekly Coach Review（FR-SUB3）** 已完成 package、app 与 Simulator 本地验收。它只能按下列已批准结果表达；现有建议理由、自动计划更新、数据质量提醒和肌群等级仍不得进入权益列表。该功能完成不等于 production paywall 获准：在真实商品、政策地址、StoreKit 生命周期与 Sandbox/TestFlight 门禁通过前，production 页面仍不得显示权益卖点或打开购买。

### 6.1.1 每周教练复盘

| 位置 | 中文 | English | 红线 |
|---|---|---|---|
| 功能名 | 每周教练复盘 | Weekly Coach Review | 不写 AI Coach / 智能黑箱。 |
| 付费结果 | 一个判断　可核对的依据　一个下一步 | One call, evidence you can check, and one next step | 只在功能验收且购买 gate ready 后进入 StoreKit 页面价值面。 |
| 期次眉题 | Weekly Review / Week {ISO 周序号} | Weekly Review / Week {ISO week number} | 周序号与周范围必须来自同一 ISO 周；跨公历年时两端年份都显示。 |
| 本周判定标签 | 本周判定 / Coach Call | Coach Call | 只命名当前 typed verdict，不添加原因或建议。 |
| 数据优先展示标题 | 先核对，<br>再判断。 | Verify first.<br>Then read the trend. | 不在坏数据上输出正向趋势。 |
| 节奏展示标题 | 先接回，<br>训练节奏。 | Rebuild<br>your rhythm. | 不羞辱缺训，不宣称计划失败。 |
| 关键动作展示标题 | 关键动作，<br>向上。 / 稳定。 / 回落。 | Key lift,<br>moving up. / holding. / easing. | `回落 / easing` 不写“退步”；无真实差值时只显示可比趋势，不伪造数字。 |
| 校准展示标题 | 继续积累，<br>再判断。 | Keep building.<br>Then call the trend. | 可比场次不足时必须显式说不足。 |
| 主聚光事实 | 关键变化 / 数据核对 / 训练节奏 / 训练积累 | Movement / Data Check / Rhythm / Baseline | 每周只提升 1 条 typed fact；不得把推断包装成事实。 |
| 支撑依据 | 判断依据 / Evidence；最多 2 条 | Evidence; no more than 2 facts | 与主聚光事实不重复；总事实预算仍为 3 条。 |
| 下一步 | 下一步 / Next | Next | 页面只保留 1 个真实可达行动。 |
| 零训练主状态 | 上周没有训练记录 | No workouts were recorded last week | 不羞辱、不追问原因。 |
| 行动 | 查看今天安排 / 查看进展 / 核对训练数据 | View Today / View Progress / Review Training Data | 只导航，不写计划。 |

复盘页 V2 的信息预算固定为 `1 个主判断 + 1 条主聚光事实 + 最多 2 条支撑依据 + 1 个行动`。主聚光事实与支撑依据合计仍不超过 3 条，且不得重复。依据使用正文/清单字阶，不使用 caption 堆常驻说明；不显示“置信度”、算法名、因果语言、医学判断、计划完成率或“你退步了”。具体数字必须能回到 Free Core 的原始训练/进展事实对账。

### 6.2 Paywall 框架

Paywall 必须具体,不要煽动。

推荐结构:

1. 一句价值：这次新增的教练能力具体替用户减少什么判断负担。
2. 最多三个权益：只能列 PRD 已批准并已实现的 **1.8 之后新增能力**；不得列现有 readiness explanation / plan adjustment / data-quality / muscle level 等免费面。
3. 价格、试用、续订与资格：逐字依据 StoreKit 当前商品，不硬编码金额、试用天数或“最划算”。
4. `恢复购买` / `Restore Purchases` 与 `管理订阅` / `Manage Subscription`。
5. 可点击的 `隐私政策` / `Privacy Policy` 与 `使用条款` / `Terms of Use`；目标 URL 属于发布配置，提交前逐一打开核验。

不要在权益卡、行动按钮或页面底部追加“现有功能都在 Free Core”“数据都保存在本机”“随时导出”等常驻解释小字。需要展示的试用、续订、取消和政策信息只在 StoreKit/法律要求的位置按实际商品条件呈现；没有 StoreKit 返回的 trial/offer 就整句不显示，商品目录加载失败时不显示猜测价格。

### 6.2.1 订阅状态与恢复文案（已实现基础 runtime 合同）

当前 Settings 已使用本节的双语状态：Free Core、Rede Coach、核对中、未知、pending、恢复/管理与操作失败。`unknown` 的方案标题必须是“当前方案：暂时无法确认”，不能把无法验证的状态伪装成 Free Core。Settings 的“查看 Rede Coach”始终进入品牌页：gate 未就绪时只显示品牌名、当前方案与诚实状态，不写价值承诺、不列权益、不放禁用购买按钮，也不显示价格、试用、恢复、管理或政策链接。付费能力未达商业发布门禁与商品/政策配置异常使用不同状态文案。每周教练复盘已完成本地实现，但只有 paid capability、两个 StoreKit 商品和两条 HTTPS 政策地址同时通过 launch gate 后，页面才把这项真实权益填入 Apple 购买面。production 配置当前故意关闭购买控件。

预览页固定文案：

| 位置 | 中文 | English |
|---|---|---|
| 当前方案标签 | 当前方案 | Current plan |
| 状态眉题 | 准备中 | In development |
| 功能区占位 | 功能完成后再加入这里 | Features will be added here when they’re ready |
| 购买状态 | 订阅尚未开放 | Subscriptions aren’t open yet |
| 异常状态眉题 | 暂时不可用 | Temporarily unavailable |
| 异常状态标题 | 订阅选项暂时不可用 | Subscription options are temporarily unavailable |
| 异常状态保障 | Free Core 仍可使用 | Free Core remains available |

| 场景 | 中文 | English | 行为边界 |
|---|---|---|---|
| 加载商品 | 正在读取订阅选项… | Loading subscription options… | 不阻塞 Free Core。 |
| 商品暂不可用 | 现在无法读取订阅选项　Rede 1.8 Free Core 仍可使用 | Subscription options aren’t available right now. Rede 1.8 Free Core is still available | 提供“重试”，不显示硬编码价格。 |
| 购买 pending | 购买正在等待完成　状态确认后会自动更新 | Your purchase is pending. Access will update when it completes | 可覆盖 Ask to Buy、付款认证等 pending 原因；不假报成功，不催促重复购买。 |
| 用户取消 | 不弹错误；回到原页面 | No error; return to the previous screen | `userCancelled` 不是失败。 |
| 验证失败 | 无法验证这次购买　当前权限没有变化，请稍后重试 | We couldn’t verify this purchase. Your current access hasn’t changed. Try again later | 不把 unverified 当 paid，也不错误撤销既有权益。 |
| 恢复中 | 正在向 Apple 恢复购买… | Restoring purchases with Apple… | 仅显式点击后调用。 |
| 恢复成功 | 购买已恢复 | Purchases restored | 只在已验证 entitlement 刷新后显示。 |
| 未找到可恢复购买 | Apple 没有返回可恢复的订阅　请确认使用了原购买账户 | Apple didn’t return a subscription to restore. Check that you’re using the account that made the purchase | 不声称用户从未购买。 |
| 恢复失败 | 现在无法完成恢复　Rede 1.8 Free Core 仍可使用 | We couldn’t complete the restore right now. Rede 1.8 Free Core is still available | 提供重试；Free Core 不受影响。 |
| 当前方案未知 | 当前无法确认方案　Rede 1.8 Free Core 仍可使用 | We can’t confirm your current plan right now. Rede 1.8 Free Core is still available | 读取失败后的 error +“重试”；不得无限显示 loading，也不得把 `unknown` 显示成 Free Core。 |
| 当前为免费层 | 当前方案：Free Core | Current plan: Free Core | 中性，不制造损失厌恶。 |
| 当前为付费层 | 当前方案：Rede Coach | Current plan: Rede Coach | 只由已验证 current entitlement 驱动。 |
| 管理订阅 | 管理订阅 | Manage Subscription | 进入 Apple 管理面。 |
| 隐私政策 | 隐私政策 | Privacy Policy | 可点击并打开当前有效政策。 |
| 使用条款 | 使用条款 | Terms of Use | 可点击并打开当前有效条款。 |

禁止:

- `解锁全部潜能`
- `全面升级你的训练体验`
- `AI 私教`
- `最聪明的训练 App`
- `guaranteed progress`
- `unlock your full potential`

### 6.3 Website Paid-Intent Validation Copy

外部官网 / landing page 可以先验证价格和付费意向,但它不是仓库 runtime,也不是 App Store 购买页。验证文案必须透明:

- 可以展示真实价格假设和 plan options。
- CTA 可以测 `Start founder beta`、`Join the waitlist`、`Reserve early access`、`Notify me at this price`。
- 必须清楚说明 `not a purchase` / `no charge today` / `founder beta`。
- 只能承诺本文和系统逻辑中定义的目标价值,不得写成已经上线的能力。

English examples:

> Join the founder beta. No charge today.

> Tell us which plan you would choose. This is a price-intent test, not a purchase.

> Rede is being rebuilt as a clean native iOS app. Early users will be invited when the focused training loop is ready.

---

## 7. 风险红线

### 7.1 医疗与伤病

不要说:

- `预防受伤`
- `治疗疼痛`
- `诊断过度训练`
- `安全训练`
- `injury-proof`
- `pain-free`
- `doctor-grade recovery`

改成:

- `降低训练强度`
- `选择更保守的训练日`
- `出现疼痛时暂停、调整动作,或咨询专业人士`
- `lower-intensity option`
- `modify the movement`
- `consult a qualified professional`

### 7.2 保证结果

不要说:

- `保证突破`
- `永不平台期`
- `每周变强`
- `guaranteed PRs`
- `never plateau`
- `perfect plan every time`

改成:

- `趋势停住时给出调整建议`
- `用训练记录看见进步是否成立`
- `suggested changes when progress slows`
- `track PRs and training trends`

### 7.3 身体羞辱与强迫追踪

不要说:

- `逆袭身材`
- `偷懒`
- `别断 streak`
- `燃掉负担`
- `no excuses`
- `earn your meal`
- `don’t break the streak`

改成:

- `保持训练节奏`
- `训练中断后,从下一次继续`
- `keep training visible`
- `pick up from the next workout`

### 7.4 隐私绝对化

不要说:

- `100% 私密`
- `永不离开手机`
- `HIPAA compliant`
- `anonymous data`

改成:

- `默认保存在本机`
- `未开启同步时保存在本机`
- `HealthKit access is permission-based`
- `sync only when enabled`

---

## 8. v0 / 原型生成指令

给 v0 或其它 UI 生成工具时,附上这段:

```text
Use Rede’s product-copy baseline.

Brand voice:
- Calm, specific, explainable strength coaching.
- Not a motivational fitness app.
- Not an AI assistant.
- Not a dashboard.

Core line:
- 中文: 先判断,再带练。
- English: Plan the lift. Show the reason.

Write every important screen through four beats:
1. Decision: can I train today, and what is the call?
2. Direction: what is the next set, load, rest, or action?
3. Evidence: what recent signal changed the plan?
4. Control: can the user apply, skip, swap, edit, or undo?

Chinese must be native Simplified Chinese. English must be native American English.
Do not translate sentence-by-sentence.
Do not use: AI-powered personal trainer, fitness journey, unlock your potential, crush it, beast mode, ultimate, guaranteed PRs, prevent injury, pain-free, 100% private.
```

---

## 9. 写作验收

写完一句文案后,用这 8 个问题判断:

1. 它是否回答了用户此刻最关心的训练问题?
2. 它是否有 Rede 的四个锚点之一:判断、带练、证据、控制权?
3. 它是否能删掉"智能、专业、个性化"还不损失意义?
4. 它是否像一个懂训练的人在说话,而不是营销页或 AI 助手?
5. 英文是否是美国力量训练用户会说的词,不是中式英语?
6. 中文是否像原生中文,不是英文句法套壳?
7. 它是否没有医疗、伤病、保证结果、身体羞辱或隐私绝对化风险?
8. 它是否没有把未来目标写成当前已实现能力?

如果一句话只能靠形容词成立,重写。
如果一句话不能改变用户下一步行动,删除或下沉。
如果一句话解释了算法但没有解释训练决策,重写。

---

## 10. 证据基线

本文基于 2026-06-07 的只读调研与量化判断:

- 美国力量训练用户更接受"know what to do / log fast / see progress / stay in control",反感 bloat、AI hype、trophy systems、强制社交和 paywall 干扰训练。
- 竞品文案大多落在 logging、program library 或 AI personalization。Rede 的空位是 explainable coaching: why this today, what changed, what to do next。
- Health & Fitness 订阅价值需要在首会话被看见,但 Rede 不应开屏硬推黑箱 AI。更合适的是 Free Core 记录 + contextual Paid Coach。
- FTC / Apple 对健康声称、HealthKit 数据、隐私和误导性营销有明确要求;文案必须保持 general fitness guidance,不碰 diagnosis / treatment / guarantee。
- 双语文案应按 locale 原生重写,共享意图而不是逐句翻译。

关键来源:

- RevenueCat State of Subscription Apps 2026
- Adapty State of In-App Subscriptions 2026
- JMIR app abandonment review
- Apple Human Interface Guidelines — Writing
- Apple App Store Review Guidelines
- FTC Health Products Compliance Guidance
- FTC mobile health app developer guidance
- Fitbod / Hevy / Strong / StrongLifts / JEFIT / Boostcamp public copy

`RevenueCat State of Subscription Apps 2026` 仅作为市场/文案研究来源，不授权接入 RevenueCat SDK；订阅 runtime 以 Master v3.2 的 StoreKit 2-only 首片为准。

以上是产品文案基线,不是法律意见、医学意见或用户访谈结论。进入 App Store 上架、paywall、隐私政策、HealthKit 权限和医疗边界相关文案前,仍需按当前产品事实和最新平台规则复核。
