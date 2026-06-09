# Rede Product Copy Baseline — 产品文案基底

> **状态:** Canonical / living copy baseline
> **最后更新:** 2026-06-07
> **适用范围:** 产品定位、v0 / 原型生成、App Store 文案、onboarding、paywall、UI microcopy、空状态、错误、通知、双语 locale
> **权威边界:** 本文定义 Rede 如何说话,视觉品牌与原型画面方向以 `docs/IRONPATH_PRODUCT_DESIGN_LANGUAGE.md` 为准。本文不授权任何新功能、网络、云、HealthKit 范围、医疗判断或 source-of-truth 变更。功能与架构边界以 `docs/IRONPATH_MASTER_TECHNICAL_ARCHITECTURE.md` 和 `docs/IRONPATH_iOS_SYSTEM_LOGIC.md` 为准。

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
| 商业化一句话 | Pro 不是多几张图表,而是每次建议背后的判断依据。 | Pro is not more charts. It is the reasoning behind each training call. |

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
| 商业化但克制 | Pro 展示建议依据、计划调整和数据质量提醒。 | 解锁你的全部潜能。 |

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

### 3.4 UI 微文案规约 (2026-06-08)

- **无句号:** UI 标签 / 标题 / 状态短语 / 按钮不收句号（对标 Apple / Things）。如 `今天可以练` / `Train today` / `查看依据` / `See why` / `开始训练`。短语态 UI 文案一律去句号；中文内部顿号 / 逗号按需保留，但不以句号收尾。
- **双语原生（重申 §3.1，落到 UI）:** 中英各按本语言习惯写、不互译。中文不加字距、不用 `您` 类敬语；英文可用大写 + letterspacing 的仪表标签（overline）。同一意图、两种母语表达。
- **置信度不显示（决定）:** 数据可信度 / 置信度是**引擎内部量，不作 UI 读数显示**（取消「置信度高 / 中等」一类标签）。它通过**行为**表达：低可信 → 判断更保守、计划改动更小、新用户走「正在校准」；可落地的数据缺口（如缺 RIR）折进**它发生的地方**（训练时提示补记），不在 Progress 挂置信度标签。Pro 相关价值改述为「在坏数据带偏计划前提醒你」，不出现「置信度」字样。

---

## 4. Rede 的四种句型

### 4.1 判断句

判断句回答"现在该怎么练"。它是 Today、Plan、paywall 价值展示的核心。

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

示例:

中文:

> Apple 健康数据只在授权后读取。导入训练会标记为 Apple 健康来源,不会直接计入力量训练历史。

English:

> Apple Health data is read only after you allow access. Imported workouts are labeled as Apple Health and do not become strength-training history.

---

## 6. 商业化文案

### 6.1 付费价值的表达

Rede Pro 的核心不是"更多功能",而是"更少猜测,更多依据"。

可用表达:

中文:

- `看见每次训练建议背后的理由。`
- `让计划根据记录更新,但每次改动都可预览。`
- `在数据不稳时先提醒,避免坏记录带偏判断。`

English:

- `See the reason behind each training recommendation.`
- `Keep the plan updated from your logs, with every change previewed first.`
- `Catch weak data before it drives bad training decisions.`

### 6.2 Paywall 框架

Paywall 必须具体,不要煽动。

推荐结构:

1. 一句价值:看到训练判断背后的理由。
2. 三个权益:readiness explanation / plan adjustment / data-quality flag（不写 confidence）。
3. 价格和试用说明:按 App Store 规则清楚写。
4. 恢复购买。

示例:

中文:

> Pro 展示每次建议的依据,持续更新下周计划,并在数据不稳时先提醒你。
>
> 试用结束后按 App Store 显示的价格续订。可随时取消。

English:

> Pro shows the reasoning behind each recommendation, keeps next week’s plan updated, and flags weak data before it affects training.
>
> After the trial, your subscription renews at the App Store price shown here. Cancel anytime.

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

以上是产品文案基线,不是法律意见、医学意见或用户访谈结论。进入 App Store 上架、paywall、隐私政策、HealthKit 权限和医疗边界相关文案前,仍需按当前产品事实和最新平台规则复核。
