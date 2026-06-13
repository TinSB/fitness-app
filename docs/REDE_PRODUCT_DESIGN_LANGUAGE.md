# Rede Product Design Language — 产品设计语言

> **状态:** Canonical / living design-language baseline
> **最后更新:** 2026-06-08（视觉执行决定见 §11：dark 为主 + 暖锻铁 locked tokens；结构 / IA / 组件 / 文案不变）
> **适用范围:** 产品视觉品牌、App UI 方向、landing page、widget、App Store 截图、v0 / 原型生成、设计 QA
> **权威边界:** 本文只定义 Rede 应该长什么样、给人什么感觉、哪些视觉方向不能用。它不授权新功能、网络、云、账号、HealthKit 范围、订阅基础设施、source-of-truth 变更或任何 Swift package 边界变化。功能与架构边界以 `docs/REDE_MASTER_TECHNICAL_ARCHITECTURE.md` 和 `docs/REDE_iOS_SYSTEM_LOGIC.md` 为准。文案语气以 `docs/REDE_PRODUCT_COPY_BASELINE.md` 为准。

---

## 品牌 (Brand) — 名称 · Wordmark · 命名体系

> **新增 2026-06-08:** 产品正式定名 **Rede**（原 IronPath，因商标/域名占用更名）。视觉装置（Forged Graphite + Emberline + Engrave + Instrument numerals）与名字**无关**，全部承接，不因改名重做。

| 项 | 定 |
|---|---|
| **品牌名** | **Rede** — 4 字母，短、好记、好念 |
| **描述词（永远成对）** | **Rede — Strength Coach**（App Store 副标题 / 首屏 / 广告永远带）。原因："Rede" 是全球常用词（德语=演讲、葡萄牙语=网络），裸用有歧义；**永远配描述词**消歧并点明品类 |
| **Tagline** | **Training decisions, explained.**（承接产品主张 *Plan the lift. Show the reason.*） |
| **产品线命名** | **Rede Training**（力量，本 App）· **Rede Nutrition**（饮食，原 *Larder*，降为内部代号）。共享 Rede 母品牌与底座，各自品牌色/气质 |

**Wordmark:** `REDE` 全大写，暖白（`text/primary`），走 uppercase label 字距规则（见 §4）；一条 **Emberline** 作"下一步"线索——竖线起笔 / 下划线 / 或穿过末字母 `E`，锻铁面（Forged surface）承托。wordmark 只用品牌色，不渐变、不发光、不描边。

**禁用:** 不写 "Rede App"（撞第三方 RedeApp）；英文广告/落地页**不脱描述词裸投**（避德/葡歧义）；不医疗化、不 AI hype（沿用 copy baseline §3.4 / §7 红线）。

---

## 0. 设计判断

Rede 不应该像"AI 健身助手",也不应该像"训练数据仪表盘"。

它应该像一个冷静、精密、可信的力量训练工具:打开后先给训练判断,训练中只带用户完成下一组,训练后留下能看懂的依据。

品牌核心:

| 层级 | 中文 | English |
|---|---|---|
| 产品主张 | **先判断,再带练。** | **Plan the lift. Show the reason.** |
| 视觉主调 | **锻铁灰 + 铁火线** | **Forged Graphite + Emberline** |
| 产品气质 | 冷静、硬朗、克制、有依据 | Calm, forged, precise, evidence-led |
| 反面气质 | AI 炫技、健身鸡血、数据大屏、补剂广告 | AI gloss, gym hype, command center, supplement ad |

`Emberline` 是 Rede 的品牌线索:一条很克制的熔铁色路径,指向今天的训练判断、当前这一组、下一次计划调整。橙色不是背景,不是情绪,不是"燃起来";它只表示 **下一步**。

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

Rede 的视觉来源是力量训练现场里的真实物件:

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

Rede 不能让用户感觉"系统已经决定了"。它给出判断,但用户做最终动作。

---

## 2. 视觉资产

### 2.1 Emberline

Emberline 是 Rede 最重要的品牌图形。

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

Decision Receipt 是 Rede 的差异化组件:每个建议都能留下简短依据。

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

Rede 可以使用卡片,但不能堆卡片。

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

> **2026-06-08 决定（owner，见 §11）：App 主模式 ＝ 深色暖锻铁，不再以「浅色为一等公民」。** 深色承载品牌张力与日常 UI；浅色仍是受支持的次级 theme（token 已双模备好，随时可加）。下列浅色原则在做浅色 theme 时仍适用。

深色模式用于品牌张力,landing page 可以更强。

浅色 theme（次级）原则:

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

Rede 的圆角要克制。

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

不要做空的账号/同步/cloud placeholder。第一版干净实现没有这些能力。

---

## 6. External Validation Website 与 App Store

External validation website 可以比 App 更有品牌张力,但主张仍然不能 AI 化。它用于验证英文定位、价格意向和创始用户招募,不属于本仓库 runtime,不得恢复旧 PWA/web app。

验证网站首屏必须让用户看见:

- Rede 名字。
- 一句清楚主张:`Plan the lift. Show the reason.`
- 可信 iPhone target mock,并避免使用旧污染 UI 截图暗示 clean rewrite 已完成。
- 今日训练判断、推荐重量、原因摘要。
- 透明 CTA:`Join founder beta` / `No charge today` / `Price-intent test`。

可用方向:

- 深 graphite 背景。
- 一条 Emberline 穿过 hero。
- iPhone 中显示 Today 或 Train。
- 旁边最多 2 到 3 个证据片段。
- 视觉重点是"下一组更清楚",不是"系统很智能"。

Launch / App Store 素材必须在 clean runtime 可真实演示后再制作。App Store 截图只能展示已实现能力,不得使用验证网站 mock 伪装成可下载产品界面。

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
Design a mobile-first iOS app concept for Rede.

Rede is a decision-led strength training app for lifters who train consistently and want structured progress without managing the program themselves.

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
- Keep cards to 12pt radius, buttons 10pt.
- Use system typography (SF Pro) and tabular numbers; letter-spacing 0 on body, ~2.2 on uppercase instrument labels.
- Dark mode is the primary app theme; light is a supported secondary theme, still restrained.

Core copy:
- Primary line: Plan the lift. Show the reason.
- Product sentence: Know what to lift, how much, and why it changed.
- Today example: You can train today. Push A stays, with pressing volume capped.
- Train example: Bench press. 3 x 5. Next set: 185 lb x 5, RIR 2.
```

---

## 10. 设计验收

一个 Rede 方向稿要过这 10 条:

1. 5 秒内能看懂今天是否该练。
2. 底部 tab 只有 Today / Train / Progress / Plan。
3. 第一屏有明确下一步,不是指标堆叠。
4. 没有 AI 主张、机器人、sparkles、蓝紫渐变。
5. Ember 只作为路径或当前动作,不是全屏主题色。
6. Train 页能直接完成当前组。
7. Progress 页证明训练效果,但不像数据后台。
8. Plan 页能看见调整原因和撤销控制。
9. Profile / Settings 不在底部 tab。
10. 文案像 `docs/REDE_PRODUCT_COPY_BASELINE.md`,不是机翻或营销套话。

如果一个设计看起来"更炫",但用户更难知道下一组怎么做,它就不是 Rede。

---

## 11. 视觉执行决定 (2026-06-08 · owner review)

创始人审完整套设计稿后拍板的视觉执行决定。**与前文冲突处以本节为准**；IA、命名组件、页面语言、文案、禁区均不变。详细品质层 / 构建规格另见 `docs/REDE_CRAFT_SPEC.md`（2026-06-11 转正登记，原 .ai-tmp 工作稿）。

### 11.1 主模式 ＝ 深色暖锻铁
App 主模式深色（见 §3.3 更新）。浅色为受支持的次级 theme，token 双模备好。

### 11.2 Locked tokens（深色主模式，覆盖 §3.1 的偏冷取值）
采用暖锻铁 craft skin：

| 角色 | locked |
|---|---|
| Base / Surface / Hairline | `#15130F` / `#1F1C17` / `#2A261F` |
| Text 主 / 次 / 三（chalk·steel） | `#ECE6D8` / `#C9C2B4` / `#9C9484` |
| Ember 500 / 300 | `#E1652B` / `#F0875A` |
| Recovery / Caution / Risk / Trust（仅判断时） | `#2F7D5B` / `#C79A3A` / `#C2413A` / `#3267B7` |

比例不变：中性 70–85% / 文字·线 10–20% / Ember 3–8% / 语义仅判断时。§3.1 的 Graphite / Steel / Chalk 仍是参考族与浅色 theme 取值。

### 11.3 字体·形状例外（覆盖 §4.3 / §4.4）
- **仪表标签（overline / 小标签）用大写 + letter-spacing ~2.2**（instrument 风格）；**正文 / 判断句 / 文案仍 letter-spacing 0 + sentence case + 真实文案**——§4.3 主旨不变，仅标签例外。
- **卡片圆角 12px**（§4.4 的 8pt 上调；按钮 10、chip = capsule 不变）。
- 数字：SF Pro + tabular（§4.1 不变）。
- 材质：锻面颗粒 ~1.5% + 顶缘高光 ~8% alpha + 四角 registration（hero / 关键卡）。

### 11.4 确认项（与文档一致，重申）
- 底部 **4 tab：Today / Train / Progress / Plan**；Settings 顶部入口、非 tab。
- 命名组件 Load Plate / Decision Receipt（Call·Signal·Change·Control）/ Progress Rail / Steel Cards 必用。
- 肌群等级 `Lv.1–20` + 均衡度 + 趋势为 Progress 核心。**置信度 / 数据可信度仅引擎内部、不作 UI 读数显示（见 `REDE_PRODUCT_COPY_BASELINE.md` §3.4）。**
- 文案四锚点与禁区不变。
- 像素基准：**Today 像素终稿（2026-06-08）是其余屏的对齐基准。**

### 11.5 覆盖关系
本节覆盖：§3.1（暖 locked tokens）、§3.3（dark 为主）、§4.3（标签 letterspacing 例外）、§4.4（卡片 12px）。**§9 v0-prompt 三行（`8pt radius` / `letter spacing of 0` / `light mode first-class`）已就地更新为 12pt / 标签 letterspacing / dark-first。** 其余全部不变。

---

## 12. 整面板公理 (2026-06-11 · owner review)

创始人反馈「都是卡片式布局，感觉很 AI 而且不够高级」后，经全 app 容器盘点（19 项取证）拍板。**与前文冲突处以本节为准。**

### 12.1 公理

> **每屏 = 一块连续锻面。至多一张铭牌（ForgedCard / .forged）＝该屏唯一 hero；其余一切直接蚀刻在 base 上——分区靠 S2 刻线 + overline + 密度节奏，层级靠字阶 + 亮度，控件要么是工艺件（机加工凹槽 / 刻度轨站点）要么是文字级操作。通用圆角描边框，禁。**

「屏」按呈现单元计：tab 主屏、push 目标页、每张 sheet/overlay 各算一屏；互斥替换的双卡（如引导题卡⇄结果卡）算 1。

### 12.2 铭牌语义（卡 = 物件，不是布局容器）

卡片只允许是「可锻造的语义物件」：今日判断牌、训练仪表读数、设备铭牌（设置背景）、PR 成就牌（小结）、分享工件、引导题卡/结果卡、计划「今天」节点。顶缘高光 + registration 角标 + 颗粒为 **hero 铭牌专属身份**，不再是卡的通用皮。base 自身获得 ≤1% 全屏锻面颗粒（实体感，真机 25% 亮度校准后定值）。

### 12.3 弹层规范

sheet = 掀开的 base 锻面（`presentationBackground = base`，禁 surface/raised 整面底）+ grabber。动作列表 = 开放行（文字 + chevron + hairline），禁描边按钮堆；唯一主操作可用锻面主按钮（emb）。

### 12.4 开放行 affordance 三件套

无框可点元素必须带以下三者之一 + 命中区 ≥44pt + 整行 contentShape：① chevron（导航/展开）；② 钢色 tick 下标（选中态）；③ 数字/文字亮度跳档（站点/档位）。纯文字级操作仅限既有 .ghost / .rop / .ctrlop 类。

### 12.5 空态规范

空态是「道歉」不是「判断」，不配铭牌：headline + 一句注 + 锻面主按钮，开放式直落 base（三 tab 统一此语法）。

### 12.6 覆盖与预算

- 收紧 §2.5：「5 张以上＝IA 错」→ **每屏常驻铭牌至多 1 张**。
- 收紧品质层 S5：「一屏 ≤3 层 surface」→ **base + hero 铭牌 1 层 + 控件态（seg 凹槽/选中填充）**。
- 防回潮：质量门禁含每视图 ForgedCard 预算检查（`.claude/quality-gate.cmd`）。
