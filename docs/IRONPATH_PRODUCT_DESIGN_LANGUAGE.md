# IronPath Product Design Language — 产品设计语言

> **状态:** Canonical / living design-language baseline
> **最后更新:** 2026-06-07
> **适用范围:** 产品视觉品牌、App UI 方向、landing page、widget、App Store 截图、v0 / 原型生成、设计 QA
> **权威边界:** 本文只定义 IronPath 应该长什么样、给人什么感觉、哪些视觉方向不能用。它不授权新功能、网络、云、账号、HealthKit 范围、订阅基础设施、source-of-truth 变更或任何 Swift package 边界变化。功能与架构边界以 `docs/IRONPATH_MASTER_TECHNICAL_ARCHITECTURE.md` 和 `docs/IRONPATH_iOS_SYSTEM_LOGIC.md` 为准。文案语气以 `docs/IRONPATH_PRODUCT_COPY_BASELINE.md` 为准。

---

## 0. 设计判断

IronPath 不应该像"AI 健身助手",也不应该像"训练数据仪表盘"。

它应该像一个冷静、精密、可信的力量训练工具:打开后先给训练判断,训练中只带用户完成下一组,训练后留下能看懂的依据。

品牌核心:

| 层级 | 中文 | English |
|---|---|---|
| 产品主张 | **先判断,再带练。** | **Plan the lift. Show the reason.** |
| 视觉主调 | **锻铁灰 + 铁火线** | **Forged Graphite + Emberline** |
| 产品气质 | 冷静、硬朗、克制、有依据 | Calm, forged, precise, evidence-led |
| 反面气质 | AI 炫技、健身鸡血、数据大屏、补剂广告 | AI gloss, gym hype, command center, supplement ad |

`Emberline` 是 IronPath 的品牌线索:一条很克制的熔铁色路径,指向今天的训练判断、当前这一组、下一次计划调整。橙色不是背景,不是情绪,不是"燃起来";它只表示 **下一步**。

### 0.1 主调拍板

| 候选方向 | 品牌识别 | 日用舒适 | 商业可信 | 避开 AI 味 | IA 一致 | 总分 |
|---|---:|---:|---:|---:|---:|---:|
| 精密训练指挥台 | 5 | 2 | 3 | 2 | 2 | 14 |
| Apple 式健康轻量感 | 2 | 5 | 4 | 4 | 4 | 19 |
| 锻铁训练仪器 | 5 | 4 | 4 | 5 | 5 | 23 |
| 训练日志 + 图表 | 2 | 3 | 2 | 3 | 2 | 12 |

结论:采用 **锻铁训练仪器**。它保留强品牌记忆点,但不把 App 做成 command center。它适合美国力量训练用户,也能承载付费价值:不是"AI 很聪明",而是"每次训练判断都有依据"。

---

## 1. 品牌原则

### 1.1 判断先于展示

每个高频页面先给结论,再给数据。

正确:

- 今天可以练。推力 A 保留,强度略降。
- 下一组:185 lb x 5,RIR 2。
- 本周背部训练量偏低,下次补一组拉力。

错误:

- 先铺满 readiness、fatigue、volume、recovery 等模块。
- 先展示多张图表,再让用户自己判断。
- 用"智能分析中"制造黑箱感。

### 1.2 品牌来自训练物,不是科技装饰

IronPath 的视觉来源是力量训练现场里的真实物件:

- 铸铁片。
- 杠铃刻线。
- 粉笔痕。
- 训练日志的勾线。
- 逐组记录。
- 计划周期里的路径。

不要从这些东西取表面纹理,要取它们的秩序感:重量、线、刻度、完成、回退、再推进。

### 1.3 橙色只表示下一步

熔铁橙 / Ember 只能用于:

- 当前建议。
- 当前组。
- 主操作。
- 计划路径中的下一步。
- 被采纳的调整。

不能用于:

- 大面积背景。
- 每个图标。
- 每张卡片边框。
- 成功/恢复/风险状态。
- 装饰性 glow。

### 1.4 用户保留控制权

设计里必须一直能看见用户选择:

- 开始训练。
- 采纳调整。
- 暂不处理。
- 换动作。
- 降级。
- 撤销。
- 查看依据。

IronPath 不能让用户感觉"系统已经决定了"。它给出判断,但用户做最终动作。

---

## 2. 视觉资产

### 2.1 Emberline

Emberline 是 IronPath 最重要的品牌图形。

它是一条细、直、克制的熔铁色线,用来表示训练路径:

- Today:从今日判断指向"开始训练"。
- Train:标记当前组和下一组。
- Progress:连接上次、今天、下一次。
- Plan:标出计划调整会影响哪几天。
- Widget:只留下一个短线索,告诉用户今天的训练状态。

规则:

- 线条比面积更重要。
- 1 到 2 pt 足够。
- 不做霓虹光带。
- 不做复杂电路线。
- 不做 AI 粒子轨迹。

### 2.2 Load Plate

Load Plate 是重量数字的品牌容器,不是复杂仪表盘。

用途:

- 今日推荐重量。
- 当前组重量。
- PR / e1RM 变化。
- 计划调整里的 load change。

形态:

- 可以是圆形、短胶囊或紧凑数字块。
- 中心只放一个关键数字。
- 周围最多放 2 个辅助信号。
- 不做金融 dashboard 式多环仪表。

示例信息层级:

1. `185 lb`
2. `Bench press`
3. `3 x 5, RIR 2`
4. `Hold today. Last session was clean.`

### 2.3 Decision Receipt

Decision Receipt 是 IronPath 的差异化组件:每个建议都能留下简短依据。

结构:

| 行 | 内容 |
|---|---|
| Call | 今天的训练判断 |
| Signal | 使用了哪些训练信号 |
| Change | 具体调整了什么 |
| Control | 用户可以采纳、跳过、替换或撤销 |

设计要求:

- 默认收起,需要时展开。
- 不像系统日志。
- 不写算法名。
- 不把解释做成聊天气泡。

### 2.4 Progress Rail

Progress Rail 表示训练推进,不是普通折线图。

适合表达:

- 上次 -> 今天 -> 下次。
- 当前周期第几周。
- 计划哪里被调整。
- 哪些动作保持、增加、降级。

规则:

- 轨道少而清楚。
- 强调变化原因,不堆指标。
- 不做密集趋势面板。

### 2.5 Steel Cards

IronPath 可以使用卡片,但不能堆卡片。

卡片只用于承载一个明确判断:

- 今日训练判断。
- 当前动作。
- 本周进展。
- 一个计划调整。
- 一个数据可信度提示。

如果一个页面连续出现 5 张以上同权重卡片,说明信息架构错了。

---

## 3. 色彩系统

### 3.1 色彩角色

| Token | 用途 | 建议色 |
|---|---|---|
| Graphite 900 | 深色模式页面底 | `#111312` |
| Graphite 800 | 深色 surface | `#1B1E20` |
| Steel 600 | 次级文字 / 边框 | `#66707A` |
| Steel 300 | 浅色边界 | `#C8CDD2` |
| Chalk 50 | 浅色模式页面底 | `#F6F7F5` |
| Paper 0 | 浅色 surface | `#FFFFFF` |
| Ember 500 | 品牌线索 / 主操作 / 当前组 | `#E85D2A` |
| Ember 300 | 轻量强调 | `#F28A5C` |
| Recovery 500 | 恢复 / 可练 | `#2F7D5B` |
| Caution 500 | 注意 / 降载 | `#B7791F` |
| Risk 500 | 风险 / 疼痛 / 破坏性动作 | `#C2413A` |
| Trust 500 | 数据可信度 / 导入证据 | `#3267B7` |

### 3.2 使用比例

推荐单屏比例:

- 中性 surface:70 到 85%。
- 文字与结构线:10 到 20%。
- Ember:3 到 8%。
- 语义色:只在需要判断时出现。

如果一屏看起来是"黑橙主题",而不是"训练判断界面",就已经偏了。

### 3.3 深色与浅色

深色模式用于品牌张力,landing page 可以更强。

App 日常界面必须支持浅色模式,并且浅色模式不能像临时反色:

- 浅色底不是奶油色品牌页,而是训练工具的干净工作面。
- Ember 在浅色模式里更少、更准。
- Progress / Plan 这类阅读页面优先清晰,不要强行黑底。

---

## 4. 排版与形状

### 4.1 字体

默认使用系统字体:

- iOS:`SF Pro`
- Web / v0 原型:`Inter` 或系统 sans
- 数字:使用 tabular numbers

不要引入装饰字体、军事字体、机甲字体、仿金属字体。

### 4.2 字重

| 场景 | 字重 |
|---|---|
| 关键数字 | 700 |
| 页面标题 | 650 到 700 |
| 卡片标题 | 600 |
| 正文 | 400 到 500 |
| 标签 | 500 |

不要把整屏都做成粗体。力量感来自秩序,不是字体发狠。

### 4.3 字距

默认 letter spacing 为 `0`。

不要使用负字距来制造高级感。中文、英文、数字都必须在小屏上自然可读。

### 4.4 圆角

IronPath 的圆角要克制。

| 元素 | 圆角 |
|---|---:|
| 卡片 / row group | 8 pt |
| 小按钮 | 8 pt |
| icon button | 8 pt |
| badge / pill | capsule |
| iOS sheet / modal | 遵循平台默认 |

不要用 16 到 36 pt 的大圆角把产品做成玩具感或消费金融感。

---

## 5. 页面语言

### 5.1 今日

今日页只回答:

1. 今天练不练?
2. 练什么?
3. 为什么?
4. 从哪里开始?

设计结构:

- 顶部一个训练判断。
- 一个主操作:开始训练 / 查看计划调整。
- 一个 Decision Receipt,默认短。
- 一个小的 Progress Rail,只提示上次和下次。

不要:

- 大型 dashboard。
- 多个同权重图表。
- 推荐卡片瀑布流。
- 营销卡片。

### 5.2 训练

训练页只服务专注训练。

屏幕第一优先级:

1. 当前动作。
2. 当前组。
3. 重量 / reps / RIR。
4. Complete Set。
5. rest timer。
6. 快速换动作 / 降级 / 记录不适。

品牌表现要收敛:

- Emberline 标记当前组。
- Load Plate 显示当前重量。
- 解释只在用户打开时出现。
- 不写品牌口号。
- 不出现 landing page 式视觉。

### 5.3 进展

进展页证明训练有没有工作。

适合:

- PR / e1RM 变化。
- 训练量趋势。
- 周期完成度。
- 数据可信度。
- 重要动作的稳定进步。

不要:

- 把用户扔进数据分析后台。
- 用过多颜色显示每个指标。
- 把 Health / recovery 信号写成医疗判断。

### 5.4 计划

计划页显示未来训练结构和可回滚调整。

适合:

- 本周安排。
- 下周变化。
- 哪些动作保持。
- 哪些动作加量、降载、替换。
- 为什么调整。
- 采纳 / 暂不处理 / 撤销。

Plan 的核心组件是 Progress Rail + Decision Receipt,不是聊天 coach。

### 5.5 Settings / Profile

Settings 是低频入口,不进底部 tab。

视觉上更像系统设置:

- 清楚。
- 稳定。
- 少品牌色。
- 危险操作必须确认。

不要做空的账号/同步/cloud placeholder。当前 runtime 没有这些能力。

---

## 6. Landing Page 与 App Store

Landing page 可以比 App 更有品牌张力,但主张仍然不能 AI 化。

首屏必须让用户看见:

- IronPath 名字。
- 一句清楚主张:`Plan the lift. Show the reason.`
- 真实产品界面或可信 iPhone mockup。
- 今日训练判断、推荐重量、原因摘要。

可用方向:

- 深 graphite 背景。
- 一条 Emberline 穿过 hero。
- iPhone 中显示 Today 或 Train。
- 旁边最多 2 到 3 个证据片段。
- 视觉重点是"下一组更清楚",不是"系统很智能"。

不要:

- 机器人、脑图、sparkles、orb。
- 蓝紫 AI 渐变。
- 黑红健身房海报。
- 赤膊 bodybuilder stock photo。
- "AI-powered personal trainer"。
- "Unlock your potential"。
- "Crush your workout"。

---

## 7. Widget

Widget 只回答一个问题:

> 今天我该不该开始训练?

Small:

- 状态:Train / Hold / Deload。
- 一个训练日名称。
- 一个短原因。

Medium:

- 今日判断。
- 推荐起始动作。
- 一个简短信号。
- 进入 App 的动作。

Lock Screen:

- 只显示状态和入口。
- 不显示疼痛、体重、私人筛查、详细训练数据。

---

## 8. 文案与视觉的共同禁区

这些东西出现时,设计应直接打回:

- `AI-powered`
- `智能私教`
- `算法为你`
- `全方位优化`
- `个性化健身旅程`
- `释放潜能`
- `beast mode`
- `crush it`
- 机器人头像
- 聊天气泡作为主界面
- 蓝紫渐变
- 大面积橙色 glow
- 黑红肌肉海报
- 复杂 dashboard
- Profile 作为底部 tab
- Coach 作为底部 tab
- 同屏超过 5 张同权重卡片
- 没有明确下一步的首页

---

## 9. v0 / 原型生成提示

用于从 0 生成方向稿时,先用这段。不要引用当前旧 UI,不要让 v0 复刻外部草案里的五 tab 或 command center。

```text
Design a mobile-first iOS app concept for IronPath.

IronPath is a decision-led strength training app for serious beginner and intermediate lifters.

Brand direction:
- Visual theme: Forged Graphite + Emberline.
- The product should feel like a calibrated strength instrument guided by a calm coach.
- Use graphite, steel, chalk-white surfaces, and a restrained ember accent.
- Ember is a thin path or current-action marker, not a background color.
- Avoid blue-purple tech gradients, robots, sparkles, gym-bro red/black styling, bodybuilder stock photos, and motivational hype.

Information architecture:
- Bottom navigation has exactly four tabs: Today, Train, Progress, Plan.
- Settings/Profile is a low-frequency top-right entry, not a bottom tab.
- Today answers: should I train today, what should I train, why, and where do I start?
- Train is a focused workout-recording screen for the current exercise and current set.
- Progress proves whether training is working and whether the data is trustworthy.
- Plan shows future training structure, proposed changes, and rollback control.

Signature components:
- Emberline: a thin ember path marking the next training step.
- Load Plate: a compact weight-number module, never a complex gauge.
- Decision Receipt: a short explanation with Signal, Change, and Control.
- Progress Rail: a simple path from last session to today to next session.

UI rules:
- No admin dashboard.
- No dense card wall.
- No coach chat screen.
- No AI wording in headings or primary copy.
- Visible UI copy must not use: AI, smart, intelligent, algorithm, magic, assistant, chatbot, optimize, personalized journey.
- Use one clear primary action per screen.
- Keep cards to 8pt radius.
- Use system typography, tabular numbers, and letter spacing of 0.
- Make light mode first-class; dark mode can be stronger but still restrained.

Core copy:
- Primary line: Plan the lift. Show the reason.
- Product sentence: Know what to lift, how much, and why it changed.
- Today example: You can train today. Push A stays, with pressing volume capped.
- Train example: Bench press. 3 x 5. Next set: 185 lb x 5, RIR 2.
```

---

## 10. 设计验收

一个 IronPath 方向稿要过这 10 条:

1. 5 秒内能看懂今天是否该练。
2. 底部 tab 只有 Today / Train / Progress / Plan。
3. 第一屏有明确下一步,不是指标堆叠。
4. 没有 AI 主张、机器人、sparkles、蓝紫渐变。
5. Ember 只作为路径或当前动作,不是全屏主题色。
6. Train 页能直接完成当前组。
7. Progress 页证明训练效果,但不像数据后台。
8. Plan 页能看见调整原因和撤销控制。
9. Profile / Settings 不在底部 tab。
10. 文案像 `docs/IRONPATH_PRODUCT_COPY_BASELINE.md`,不是机翻或营销套话。

如果一个设计看起来"更炫",但用户更难知道下一组怎么做,它就不是 IronPath。
