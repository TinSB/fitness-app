# IronPath Diet Companion — 设计系统 (Design Language v1.0)

> 2026-06-03 · 产品设计团队 + 前端 UI 工程师联合定义
> 理论根基：Apple HIG / iOS 26 Liquid Glass · Material Design 3（语义颜色 + tonal elevation）· Stripe / Linear / Airbnb 的 token 思维
> 气质：暖色调 · 明暗双主题 · 编辑式克制 · ED 友好（结构性去刺激）

**总纲**：高级感来自**系统的克制**，不是更多照片/玻璃/动效——靠语义化 token + 严格层级纪律 + 把"健康类必须克制"做成结构。

---

## 1. 设计原则（7 条）

| # | 原则 | 来源逻辑 | 兑现 |
|---|---|---|---|
| P1 | 内容先行，控件退让 | Apple HIG Deference；Liquid Glass 让控件漂浮于内容上 | 数据/食材是主角；Tab Bar/浮钮走玻璃退到背景层 |
| P2 | 层级靠"色调+深度"，不堆描边 | Material 3 tonal elevation | 4 级 surface 色，卡片靠 tone 浮起，分割线极轻 |
| P3 | 语义角色而非散列 hex | M3 颜色角色 + Stripe/Linear token | 全 App 无裸 hex；明暗=同一组角色两份映射 |
| P4 | 一个模块化字阶，呼应 Dynamic Type | Apple Text Styles + 模块比例 | 8 级语义字阶映射 iOS Text Style，主数字不超大化 |
| P5 | 8pt 栅格 + 节奏语义 | Airbnb/Linear token taste 注解 | 间距阶梯全 8 倍数，每档带使用意图 |
| P6 | 克制是系统约束，不是页面妥协 | 健康红线 + ED 友好 | 调色板**物理不含失败红**；无 streak 组件；暂停+支持是常驻系统层 |
| P7 | 数据"被陈述"，不"被庆祝" | 由 P6 派生 | 主数字中性不放大；动效只做值平移；ED 态整页收数字 |

P1–P5 是"怎么高级"，P6–P7 是"怎么安全地高级"。顶级系统的高级感本就来自减法纪律，与 ED 友好同向。

---

## 2. Design Tokens

### 2.1 颜色（三层架构）
`① 原始色板 primitive`（暖中性 + 品牌色梯度，永不被组件直接引用）→ `② 语义角色 semantic`（组件只认这层）→ `③ 主题映射 theme map`（light/dark 两份）。

核心语义角色：`surface/base · raised · raisedHigh · sunken`（4 级容器，靠 tone 抬升）；`material/glass`；`onSurface/primary · secondary · tertiary`；`separator`；`accent/brand`（沉静青绿）；`accent/warm`（珊瑚橙，仅装饰/能量）；`positive`（**= 品牌青绿，不另设成功绿**）；`warning`（**全 App 唯一一种琥珀**，必叠图标区分语义）；`info/calm`（安全语境柔和蓝灰）；`data/macro A–D`（宏量分类色 紫/蓝/金/绿）。

**纪律**：① 调色板内不存在"失败红"（破坏性系统操作用中性深色+文案）。② `positive` 复用品牌色，不引入第二种绿（避免奖惩二元）。③ `warning` 全 App 一种琥珀，必叠形状区分"库存少 vs 营养超容差"。④ 暗色不用纯黑、亮色不用纯白（暖偏移降眩光，去临床感）。⑤ 抬升=surface 色调上移+极轻阴影，不是加粗描边；一屏最多 3 层 surface。

### 2.2 字阶（模块化，SF Pro / rounded，数字 tabular-nums）
`display 32 / title 26–28 / headline 19–20 / bodyEmphasis 15 semibold / body 15 / callout 13 / caption 12 / overline 11 caps`。每级映射 iOS Text Style 继承 Dynamic Type（至 AX5）。**主数字 title 级 Bold 但不超大化**；单位永远小于并弱于数值；大字号重排不截断（环内数字可降级为环下堆叠）。

### 2.3 间距（8pt 栅格，带语义）
`3xs 2 / 2xs 4 / xs 8 / sm 12 / md 16(页面边距基准) / lg 24 / xl 32 / 2xl 48`。同组用 xs/sm，跨组用 lg/xl。留白是最有效的高级感来源，也服务 ED 友好。

### 2.4 圆角与层级
圆角阶梯 `xs 8 / sm 12 / md 16 / lg 20–22 / xl 24–28 / full`，**连续圆角(continuous)**，内圆角 ≤ 外圆角。
Elevation：`0 内容底` / `1 卡片(raised+极轻暖阴影)` / `2 浮层(raisedHigh+三层柔阴影)` / `glass 控件层`。**玻璃只用于导航/控件容器**，承载数字的卡片永远不透明；一屏一处主玻璃；Reduce Transparency 降级不透明。

### 2.5 动效
微交互 150–200ms / 过渡 250–350ms / 加回·达成 ≤400ms。标准 ease-out，可逆控件轻阻尼 spring（无过冲）。**数据动效只做值平移/淡入**，无奖励式增长、无庆祝粒子、无放大回弹。Reduce Motion 全降级即时。体重/超出/删除场景不给负向 haptic。

---

## 3. 通用食材视觉语言（核心 · 去照片依赖）

**问题**：具体菜品照片不通用（长尾/自建/条码食材无图）、不可控（破坏暖色统一）、不安全（高诱惑大图是 ED 触发源）。

**方案：三层分级（运行时决策树）**
1. **Tier 1 — 程序化大类视觉（默认，永远可用，100% 覆盖）**：每个食材归入大类（Protein/Grain/Vegetable/Fruit/Dairy·Fat/Pantry），头像 = `radius/md` 圆角 + 大类**语义底色**（12–18% 暖色）+ 统一线性图标（SF Symbols 体系，如 fish/egg/carrot/leaf）。零网络、零缺图、离线可用、随明暗适配、可无障碍。食材大类色与宏量分类色**同源**（看到紫调=蛋白类，用颜色编码信息）。
2. **Tier 2 — 受控插画（重点 ~50–80 食材）**：统一风格矢量插画（Template 渲染跟随明暗），用于欢迎/空状态/主角位；长尾回退 Tier 1。
3. **Tier 3 — 照片仅限"用户自拍餐食"**：off-plan 记录里用户自己拍的那一餐（个人凭证，非诱惑投喂）；系统从不用库存美食照片填充列表。

> 符号兜底（通用且高级）→ 插画点睛（受控稀缺）→ 照片仅用户私有记录。把"具体食物诱惑视觉"移出系统级界面，是 ED 友好与系统性高级感的同向选择。

---

## 4. 组件系统（只引用语义 token）

- **卡片**：surface/raised · radius/lg · elev/1 · 内边 md；不嵌玻璃。
- **列表行**：raised · radius/md；`[食材符号头像] [bodyEmphasis + callout] [数值/档位 chip]`；食材头像永远走 Tier 1。
- **Bento 瓦片**：2 列 gap sm；**尺寸编码重要性**（主指标占大格）；不透明 surface 不玻璃化。
- **玻璃材质**：仅 Tab Bar/浮钮/顶栏/浮层；Reduce Transparency 降级；一屏一处。
- **按钮**：Primary(accent/brand 实底, ≥50pt, 每屏≤1) / Secondary(sunken) / Tertiary(text) / Destructive(中性深底+文案, 非红)。触控 ≥44pt。
- **Chip**：档位三态**始终文字+区分图标**，颜色仅辅助；数值 chip 用 sunken + tabular-nums。
- **圆环（最敏感）**：轨道 sunken；进度弧 accent/brand（达成=同色不变绿）；超出转 warning 琥珀**止步不转红**；**容差带**=环上更淡同色弧标"可接受区间"（范围非单点）；中心数字 title 不超大；动效只值平移；Reduce Motion 即时；VoiceOver 去评价词。
- **安全可达层**：全局常驻"Take a break"，info/calm，**位置恒定、视觉权重恒高于完成度元素**（靠固定可达而非警报色）。
- **安全门控/ED 整页态**：surface/base + 柔和符号，**无红无三角**；整页收起所有数字/环/加回，只留支持卡 + 暂停 + 极弱"仍要看数字"入口。

---

## 5. iOS 小组件 (Widget)

**总原则**：受限画布"少即贵"——**绝不展示可盯的目标数字/缺口**，只做中性状态 + 一步入口。

| 组件 | 展示 | 克制手法 | 深链 |
|---|---|---|---|
| 锁屏 circular | 当日"在轨"完成度（Gauge，比例非数字） | 系统渲染去色，靠形状 | Today |
| 锁屏 rectangular | "On track · Lunch next"（**无敏感数字**） | 一行中性文案+1 symbol | Today |
| 锁屏 inline | "🍽 Lunch next" | 系统单行 | Today |
| 主屏 小 2×2 | 主环（中性，弱化中心数字）或 "Up next: Lunch" | 单焦点 + 留白 | 环→Today / picks→Picks |
| 主屏 中 4×2 | 左环 + 右 picks 摘要（含 expiring 提示） | 面积分区，不堆四宏量 | 分区各深链 |
| 主屏 大 4×4 | 今日餐次时间线 + 顶部中性状态 | overline + 列表行，仍不暴露目标/缺口 | 餐次→picks |

**统一禁止**：无 streak/连胜、无"还差 X 卡"、无红、无庆祝、无体重数字。**工程边界**：Widget 内**无玻璃/blur/滚动**，背景用轻暖渐变（高级靠留白+display 字+symbol）；锁屏渲染去色靠形状传达；刷新走 timeline 预算；内存上限**不能加载大图**（又一反对照片的理由）。**安全联动**：ED/暂停态下所有 Widget 立即降级为纯品牌字标 + "Resume in app"，停显环和数字（App Group 共享安全状态 + `reloadAllTimelines()`）。

---

## 6. 工程落地纪律（前端）

- 三层 token（primitive/semantic/component）；颜色全进 **Asset Catalog**（明暗双 appearance），UI 只认语义 token；间距/圆角/字阶收敛成枚举常量。
- 字体全走 **Text Style + Dynamic Type**（禁固定 px）；数字 `monospacedDigit()`；建 **AX5 快照测试**入 CI（Today/Picks/Kitchen/Progress）。
- **去固定高度**：含文字容器高度自适应；bento 在 AX1+ 从 2 列降 1 列。
- **对比度**：`onSurface/tertiary` 不做正文；两 appearance 均过 4.5:1；建对比度单测。
- 系统材质优先：tab bar 用系统 `TabView`（iOS 26 Liquid Glass）；`.glassEffect` 仅少量漂浮控件 + `#available(iOS 26)` fallback；列表 cell 用便宜 Material/纯色防掉帧；卡片 `continuous` 圆角 + hairline。
- 圆环 `Circle().trim()` + `AngularGradient`（端点圆头让 endAngle 跟随 progress 减色差缝），动画挂 `accessibilityReduceMotion`，能被安全态整体接管不渲染。
- 食材视觉：弃第三方图床直链；Tier 1 程序化大类（SF Symbol + 大类色）兜底，Tier 2 矢量插画，Tier 3 用户自拍 downsample 缓存。
- 安全状态单一可信源（App Group），App/Today/Widget/通知同时收数字——漏接管=安全事故非视觉 bug。

---

## 7. 开放问题
1. Tier 1 符号粒度：5 大类共用图标够不够，还是需"大类色+单食材字形"中间档（维护成本 vs 识别度）。
2. 暖近黑/暖米白在低光 + AX5 下是否仍稳过 4.5:1（需真机校 primitive 梯度）。
3. 容差带在小组件/锁屏小尺寸会否糊（需"小尺寸隐藏容差带"降级）。
4. Tier 2 插画投入边界（做多少个、内部还是外部、长尾跳变如何不突兀）。
5. 与 IronPath 主 App 的设计连续性（共享 primitive/语义层还是仅共享品牌色，是否抽共享设计系统）。
