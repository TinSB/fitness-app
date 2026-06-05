# IronPath Diet Companion — UI/UX 设计规范 (v1.1)

> 版本 v1.1（UI 审计修订版）· 2026-06-03 · 状态：P0/P1 已修订
> 面向：交互原型构建 · 平台：iOS 原生 (iPhone, 竖屏, ~390pt) · 遵循 Apple HIG
> 语言：英文为主 + 中文 locale · 单位：默认 imperial (lb / ft-in / oz)
> 来源：`DIET_COMPANION_APP_V2_DESIGN.md` v2.1 · 配套 `DIET_COMPANION_COPY_DESIGN.md` v1.1

> **v1.1 修订（据 UI 审计）**：① 运动加回去庆祝化、ED 触发态全屏收起数字（防过度代偿）；② 门控可被改数据绕过 → 改数据必重判 + 节流；③ "暂停追踪"升级为全局常驻可达；④ VoiceOver 五项环改两层（概览+逐项可聚焦）；⑤ IA 调整：Plan 降为 Today 深度页、新增全局快速记录、用户可见标签统一走文案术语表；⑥ 档位 chip 始终带文字+图标；⑦ at-cap 规则与 Reduce Motion 覆盖运动加回。

---

## 0. 设计原则（贯穿全规范）

| 原则 | UI 含义 |
|---|---|
| 安全优先于目标达成 | 安全门控/ED 防护是**全屏阻断式**或**置顶持久卡**；**"暂停追踪+支持"在任何页面、任何状态都一步可达**（见 §1.4 安全可达层），视觉权重恒高于任何完成度/趋势元素 |
| 不靠猜，承认缺失 | "无数据""无解"是一等状态，有专属空/降级组件 |
| 范围而非单点 | 目标以**单值 + 可见容差带**呈现（如蛋白 96/128g，环上标出可接受带），达成口径**周平均**；单日波动用中性色，绝不用红色"失败"语义 |
| 反刚性 / 反执念 | 无 streak 焦虑；**Today 首屏默认只展开热量主环，四宏量默认收起可展开**；进度页弱化单日体重 |
| 食材非菜谱 | 推荐核心单元是"食材 + 克数"条目，全程不出现做法 |
| 安全态优先级最高 | ED 触发态/暂停态为**整页状态**：默认收起所有数字/环/加回，只留支持卡（见 §4） |

---

## 1. 信息架构 & 导航

### 1.1 Tab Bar（v1.1 调整为 4 Tab + 中央快速记录）

| # | Tab（内部代号） | 面向用户标签 | Symbol | 目的 |
|---|---|---|---|---|
| 1 | Today | **Today** | `house.fill` | 每日目标、按餐额度、运动加回（落地页） |
| 2 | Pantry | **Kitchen** | `refrigerator` | 库存：常备 vs 生鲜 + 档位 |
| — | (中央) | **Log** `+` | `plus.circle.fill` | **全局快速记录**（含 off-plan，解决记录入口分散） |
| 3 | Progress | **Progress** | `chart.xyaxis.line` | 体重趋势带、营养命中、校准、常驻暂停入口 |
| 4 | Settings | **Settings** | `gearshape` | 档案、目标、单位、同步、隐私 |

> **v1.1 关键变更**：原"Plan"独立 Tab **取消**，降为 Today 餐卡 push 的深度页「Today's picks」（消除 Today/Plan 心智横跳）；新增**中央全局 Log 入口**服务高频 off-plan；用户可见标签全部走文案术语表（Kitchen / Fresh items / Today's picks / Use these），内部代号（Pantry/Perishable/Adopt/Plan）不进 UI。

### 1.2 页面树

```
Onboarding (modal, 含门控)
 ├─ Welcome → Units → Body Profile → Safety Gates(门控) → Goal → Activity/HK → Pantry Seed → Plan Preview

Tab 1 Today
 ├─ Daily Header (热量主环展开 + 四宏量默认收起 + 运动加回中性胶囊)
 ├─ Meal Cards ×N → push「Today's picks」(推荐详情)
 └─ (安全可达层: 导航栏常驻支持入口)

Today's picks (push, 原 Plan)
 ├─ 食材+克数 list (含克数步进, raw 标注)
 ├─ [+ Add fruit / Add ingredient] [Regenerate] [Use these → 扣库存]
 ├─ 部分解 → 缺口购物清单
 └─ 不可行 → Infeasible 卡 (隐藏 Use these)

中央 Log (global sheet)
 ├─ 计划内 Quick Log / Off-Plan(Search/Photo/Estimate)

Tab 2 Kitchen
 ├─ Segment: Fresh items | Staples
 ├─ Item Row (档位 chip[文字+图标] / 保质期)
 ├─ Add Item (barcode / OCR 5-step / manual / preset / receipt)
 └─ Restock Review (30s)

Tab 3 Progress
 ├─ Weight Trend (7日均带) / Nutrition Hit-Rate / Calibration
 ├─ 常驻安静暂停入口 ("Tracking feeling like a lot? Take a break")
 └─ Safety/ED banners (条件)

Tab 4 Settings
 └─ Profile / Goal / Units / Sync / Day Boundary(04:00) / Privacy / Disclaimers / Pause+Support
```

### 1.3 四条主任务流
- **A Onboarding**：Welcome→Units→Body Profile→Safety Gates→[门控分支]→Goal→Activity/HK→Pantry Seed→Plan Preview→Today。
- **B 每日**：Today 纵览→点餐卡→push 推荐详情→Use these/吃→Log→运动数据日内刷新→晚间复盘。
- **C 记录**：计划内（餐卡→Quick Log→扣库存）/ off-plan（**中央 Log**→搜索/拍照/估份→重排剩余餐）。
- **D 加食材**：Kitchen→Add→{Barcode|OCR|Manual|Preset}→确认 raw/cooked+档位→入库。

### 1.4 安全可达层（v1.1 新增，落实原则表第 1 条）
定义一个**状态无关的统一支持可达约定**：
- 每个主页面导航栏提供一致的安静入口（措辞统一："Take a break"），**不依赖 ED 阈值触发**——最需要它的人不必等系统判定。
- Progress 页常驻非触发态入口；Settings 有完整 Pause+Support。
- 视觉权重恒定高于完成度/趋势元素；任何页面、是否触发，都能一步到达暂停与支持。

---

## 2. 关键页面清单与布局

### 2.1 Onboarding — Body Profile
Sex (segmented)、Birth date (wheel)、Height (ft+in/cm)、Weight (lb/kg)；单列 grouped list；单位后缀随单位制；输入即合理性校验（BMI<16 异常分支）。

### 2.2 Onboarding — Safety Gates（门控，最关键安全界面）
门控在采足判定数据后立即触发，全屏 sheet，不可滑走。

| 判定 | 触发 | 界面 | 出口 |
|---|---|---|---|
| 未成年(<18) | birthDate | 全屏友好说明 → 仅 general info → 禁用 cut/赤字 | 引导监护人+专业人士 |
| 孕期/哺乳 | 设问 | 命中→全屏说明→禁用 cut | 退出减脂；引导专业人士 |
| 异常低体重 | BMI<16 | 二次确认(中性)→锁定 cut(置灰+锁) | 减脂锁定；显示支持入口 |

视觉：中性背景+柔和符号，不用警示红/三角；文案中性不含数字；单一出口。
**v1.1 防绕过（P0）**：① 关键身体数据（生日/身高/体重）被修改 → **必定重跑全部门控判定**；② 短时间内反复修改触发门控的字段 → 节流 + 中性提示（不指控、但不放行赤字）；③ onboarding 后退修改命中门控字段 → 立即重新阻断。原型须把"改数据绕过"作为显式测试用例。

### 2.3 Onboarding — Goal & Pantry Seeding
Goal：三张大卡，门控锁定项置灰+锁标+原因，次入口「Sync from IronPath」。Pantry Seeding：上段 Staples 预设网格、下段 Fresh items 快录，空着也可继续。

### 2.4 Today / 每日计划（Tab 1 落地页）
1. **Daily Header（v1.1 默认收起）**：**默认只展开热量主环**（剩余/目标），下方四宏量(P/C/F/Fiber)**默认收起为一行小条，可点开展开**；降低首屏认知负荷与"盯数字"焦虑。每项单值+容差带；达成显中性"on track"。
2. **运动加回（v1.1 去庆祝化，P0-1）**：中性胶囊陈述（**去掉 flame 图标与增量高亮的庆祝感**）；动画只做"目标值平移"，不做增长/填充奖励式动效，且纳入 Reduce Motion 关闭清单；文案 "Movement is a bonus, not a requirement" 与加回说明**同等视觉层级**；**ED 触发态下完全不展示增量动画、不推送加回通知**。Sheet 内分解 `BMR + Activity(k=0.7) = Today's energy`，注明"只追加到剩余餐次"。
3. **按餐卡片 ×N**：餐名+kcal 区间+宏量 mini+状态徽标，点击 push「Today's picks」。
4. 导航栏右上：全局 Log `+`；安全可达层入口。

### 2.5 Today's picks（推荐详情，原 Plan，独特点①）
餐头(五项目标 mini+命中) → 食材列表按餐型模板分组(Protein/Carb/Vegetable/Fruit) 但**不写做法** → 每条 Ingredient Row(名称+克数 oz/g+贡献宏量，克数步进微调实时重算) → 偏差摘要(容差内中性/超容差琥珀，非红) → 加食材区(`+Add fruit` 受上限) → 底部 `Regenerate` + `Use these`。
**v1.1 组合态（P1-11）**：不可行态**隐藏 Use these**，主操作替换为"调整目标/加入购物清单/咨询专业人士"，不出配比；部分解态 `Use these` **仅扣实际入选食材**并提示缺口仍在。

### 2.6 缺口购物清单（独特点⑤）
部分解摘要 → Shortfall 列表(缺口营养+建议食材组) → 每项 `+Add to pantry` 或勾选生成可分享清单。中性、解决导向。

### 2.7 Kitchen（库存，独特点②）
Segmented：Fresh items（默认，追踪）/ Staples（常备，不追踪）。Fresh 段按分类 section，每行=名称+**档位 chip（始终带文字标签 Plenty/Low/Almost out + 区分图标，不靠颜色，P1-10）**+可选保质期+可选克数。Restock Review 横幅(30s)。

### 2.8 加食材（条码/OCR/手动）
四入口；条码 VisionKit→命中 OFF/未命中转 OCR；**OCR 五步**(①识别 ②定位裁切 ③份量/单位/分数解析(可编辑) ④反推每100g ⑤**强制人工确认**)，任一步失败→手动回退；手动搜 USDA 快照→确认 raw/cooked→设档位；统一确认页。

### 2.9 记录（中央 Log）
计划内 Quick Log(预填采纳量可微调→扣库存)；Off-Plan(Search/Photo/Estimate portion，给手掌/拳头视觉参照，不写做法)→记录后"Remaining meals rebalanced"只动剩余餐。

### 2.10 Progress（反执念 + 常驻暂停）
1. Weight Trend：**7 日移动平均带为主体**，单日点弱化；Y 轴不夸张缩放；中性配色，无红色。
2. Nutrition Hit-Rate：周视图，五项落容差内比例。
3. Calibration Status；切目标显示 window reset。
4. **常驻安静暂停入口（v1.1，P0-4）**："Tracking feeling like a lot? Take a break"，不等阈值。
5. ED 横幅（条件，置顶）。

### 2.11 Settings
Profile/Goal/Units（改 goal/身体数据触发门控重判+校准提示）；Sync(冲突解决)；Day Boundary(04:00)；Privacy & Health Data；Disclaimers；**Pause Tracking + Support**。

---

## 3. 组件系统

| 组件 | 关键规格 |
|---|---|
| Meal Card | 圆角16；餐名+kcal 区间+宏量 mini+状态徽标 |
| 宏量环/进度 | 主环=热量(默认展开)；四宏量(默认收起)；单值+容差带；over 用琥珀非红 |
| 运动加回胶囊 | **中性陈述，无 flame/庆祝**；目标环仅平移动画(Reduce Motion 下关闭) |
| Ingredient Row | 名称+克数(oz/g)+贡献宏量；步进/展开；expiring/over-limit 标识 |
| 克数步进 | 步进±(粗)+长按滑块(细)；显示 oz 存 g；受上限钳制；**at-cap 视觉+VoiceOver 双提示** |
| 档位 Chip | 三态；**始终文字+图标**；不靠颜色 |
| Goal Card | 大卡；可置灰+锁(门控) |
| Safety Sheet | 全屏中性背景+柔和符号+资源主操作 |
| ED/Pause 全屏态 | 收起数字/环/加回，仅支持卡+暂停主操作+"仍要看数字"弱二次确认 |
| Shortfall Row | 缺口营养+建议食材+`+Add` |
| 状态块 | 空/错误/离线/无解/无数据 |
| OCR Step Indicator | 5 步进度+后退/手动回退 |
| 安全可达入口 | 各页导航栏一致安静入口 |

---

## 4. 状态机（v1.1 补全 ED 整页态/暂停态/onboarding 离线）

| 页面 | Loading | Empty | Error | Offline | 无解/特殊 | 安全态 |
|---|---|---|---|---|---|---|
| Today | 骨架 | 首次→"Generate plan" | 重试 | 本地快照+计划基线，加回标"waiting" | — | **ED 触发=整页态**：收起所有数字/环/加回，仅 ED 支持卡+暂停主操作+弱二次确认入口 |
| Today's picks | "Finding your best mix…" | 库存空→引导加食材 | 重试 | 本地食材库可用 | 部分解→Best-effort+缺口；不可行→Infeasible 卡(隐藏 Use these) | ED 态下弱化目标数字/可暂停 |
| Kitchen | 骨架 | "empty"+四入口 | 重试 | 离线全功能 | — | — |
| Add/OCR | spinner | — | 扫码失败→手动 | 条码需联网→提示手动 | OCR 失败→手动；USDA 未命中→兜底链 | 强制人工确认 |
| Progress | 骨架 | 数据不足→"Keep logging"(中性) | — | 读本地 | — | 常驻暂停入口；ED 横幅 |
| Onboarding | — | — | 输入校验内联 | **v1.1 补**：Pantry 搜索失败→回退手动；授权可跳过稍后设；首份计划用本地快照 | — | 三门控；改数据必重判 |
| **暂停态(全局)** | — | — | — | — | — | **v1.1 补**：主屏隐藏所有数字/环/餐卡数据，停止推荐与推送，仅"Resume tracking"+支持 |

状态文案守则：无解/不可行解决导向+中性，无"失败/超标"红屏；安全态柔和、不评判、不含可当目标的数字，主操作指向支持。

---

## 5. 视觉系统（token）

配色（语义 token，深色模式）：`accent/brand`(沉静青绿)；`macro/protein`紫、`carb`蓝、`fat`金、`fiber`绿；`energy/calorie`主色；档位 `plenty`中性绿/`low`琥珀/`almostOut`深琥珀+红边；`status/overTolerance`琥珀（**非红**）；`safety/gentle`柔和蓝灰。**统一全 App 琥珀语义层级，避免"库存少"与"营养超容差"同屏双关（P1-10）**；不靠纯色块区分（叠形状/符号）。
字体：Text Styles 支持至 AX5，主数字 Title1 加粗但不超大化。间距 4 基数(8/12/16/24)；圆角 16/12/10；触控 ≥44pt，主按钮 ≥50pt；运动加回过渡 ≤0.4s **且纳入 Reduce Motion 关闭**。
**单位 at-cap 规则（v1.1，P1-9）**：展示精度 0.5 oz；步进与 g 钳制对齐，步进永远落在合法 g 值；撞上限给 at-cap 视觉 + VoiceOver "Maximum for this item" + 极轻中性 haptic。

---

## 6. 无障碍

| 维度 | 规范 |
|---|---|
| Dynamic Type | Text Styles 至 AX5；大字号重排不截断 |
| **VoiceOver 五项环（v1.1 两层，P0-5）** | 容器层一句概览 summary（可选）+ **每个环作为独立可聚焦元素**各有简短 label/value/trait，支持逐项浏览；**措辞去掉评价性词**（"on track" 不进朗读） |
| VoiceOver Ingredient | `"Chicken breast, 6 ounces, 38 grams protein. Adjustable."`；at-cap 朗读 "Maximum for this item" |
| VoiceOver 档位 | `"Spinach, level: low. Double-tap to change."` |
| VoiceOver 安全门控 | 焦点即朗读标题+说明；trait=button；不用恐慌音效 |
| 对比度 | 文本 ≥4.5:1，大字 ≥3:1；状态不单靠颜色 |
| 触控目标 | ≥44pt；步进 +/− 足够大 |
| Reduce Motion | 关闭环增长/趋势带**及运动加回过渡**，改即时/淡入 |
| Haptics | 采纳/扣库存轻 haptic；at-cap 极轻中性；**避免体重/超标场景负向 haptic** |

---

## 7. 建议优先做成可交互原型的关键页面

| 优先级 | 页面 | 理由 |
|---|---|---|
| P0-1 | Today（默认收起 + 中性运动加回） | 主屏与心智锚点；验证反执念默认形态与去庆祝化加回 |
| P0-2 | Today's picks + 克数调整 | 最大差异点"食材+克数"；步进实时重算+Use these 扣库存闭环 |
| P0-3 | Onboarding 门控分支（含改数据重判） | 安全红线；三分支文案/出口/防绕过必须走查 |
| P0-4 | Kitchen + 档位（文字+图标 chip） | 依从性命门；常备/生鲜+三档是否够轻 |
| P1-5 | 无解→缺口购物清单 | 失败优雅降级试金石 |
| P1-6 | ED 触发态/暂停态整屏 | 验证"收起数字+暂停可达"是否真正保护到位 |

> 若只做 4 个：取 P0-1 ~ P0-4。

---

## 8. UI 层面遗漏补充（v1.1）

1. **系统级安全可达层**：已定义 §1.4，所有页面一致入口。
2. **切单位/切目标进行中的全局重算反馈态**：定义过渡 loading + 历史数据回溯展示规则（待细化）。
3. **HealthKit/IronPath 授权被拒后的"无 Watch 用户"端到端 UI**：运动加回胶囊长期形态、不反复劝授权、纯手动模式完整首屏（待补成体系）。
4. **暂停态主屏**：已定义 §4 暂停态行——全部数字/环/餐卡数据隐藏，停推荐与推送。

## 9. 仍待解决（转原型阶段验证）
- Today 信息密度（默认收起后仍需真机验证）。
- 运动加回"替换非叠加"心智正确性（动画+文案联合走查，防过度代偿）。
- 安全门控/ED 卡的误触发体验与频率。
- 单位 at-cap 边界手感。
