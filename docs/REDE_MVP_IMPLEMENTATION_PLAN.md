# Rede MVP 实现计划（活文档）

> **定位**：这是 Rede「最小可上线训练闭环」的**实现执行层活文档**。它把 [`docs/REDE_iOS_SYSTEM_LOGIC.md`](REDE_iOS_SYSTEM_LOGIC.md) 的全景规格和 [`COMMERCIALIZATION_ROADMAP.md`](../COMMERCIALIZATION_ROADMAP.md) 的 P1 阶段，收敛成「做哪些、按什么顺序、做完什么算能让用户用上、怎么证明、怎么追踪进度」的可执行清单。
>
> **它不凌驾于谁**：架构边界以 [`docs/REDE_MASTER_TECHNICAL_ARCHITECTURE.md`](REDE_MASTER_TECHNICAL_ARCHITECTURE.md) 为最高契约，产品/系统逻辑以系统逻辑文档为准，商业节奏以 Roadmap 为准。**任何 slice 与 Master Architecture 冲突，必须停下并取得显式架构批准后才写代码。**

- **状态**：Active / 活文档（每完成一个 slice 必须回写 §9 进度表 + CHANGELOG）
- **生命周期**：**有界，完成即自清洁**。MVP 经用户确认全部完成后，本文档按 §11 终局流程「留痕 → 回收 → 解除登记 → 删除」，不长期留存。接棒文档 = [`REDE_PRD.md`](REDE_PRD.md)（已建，产品需求真源；其 §8 R0 = 本文档范围）+ 基于 PRD 与 MVP 完成度的开发规划（MVP 达成时另行登记，不复用本文件）。
- **版本**：1.0
- **创建**：2026-06-09
- **决策基线（本文档锁定）**：上线形态 = **TestFlight 免费先行**；功能边界 = **纯核心训练闭环**（今日决策 + 专注训练记录 + 进展反馈）；**语言 = 双语（中英），UI 文案双语 key 化、英文母语级非机翻**；文档形态 = 新建并登记。

---

## 0. 一句话目标

> 让真实 lifter 在 **TestFlight** 上装上 Rede，打开「今日」就知道今天该不该练、练什么；点进「训练」跟着逐组练完并记录；在「进展」看到自己的变化和数据是否可信。**完全免费，用来招募早期用户、获客、并验证核心价值。**

这一版**不收费、不联网、不要账号**——它是一台装在用户口袋里的本地训练教练，也是我们最快、最低成本的获客与验证工具。

---

## 1. MVP 成功定义（大白话验收 · 你能亲自核对）

第一版做到下面这些，就算「能让用户用上」：

1. 用户从 TestFlight 链接装上 App，首次打开能在 1 分钟内完成最小引导（填几项训练背景），不卡死、不白屏。
2. 打开「今日」，**5 秒内**看到一句明确结论：今天该练 / 该休 / 轻练，以及今天练什么（动作、组数、目标重量与次数）和「为什么」。
3. 点「开始今日训练」进入「专注训练」，能逐组打勾完成、看到休息倒计时、拿到下一组建议；中途能跳过或替换动作。
4. 训练完成后，这次记录**真的存下来了**——杀掉 App 再打开，记录还在，不丢。
5. 打开「进展」，能看到刚练完的这次、力量趋势（e1RM/PR）、训练量，以及一句「数据是否可信」的提示。
6. 全程没有要我注册、没有付费墙、没有任何网络请求失败的报错。
7. App 里有一个「反馈」入口，我能一键把意见发给团队。
8. 我能在「设置」里切换中文 / 英文，两种语言下界面文案都完整、自然，没有漏翻或机翻腔。

> 验证方式：§8 提供 TestFlight 装机后的傻瓜手动验收清单（对应上面 8 条）。能自动测的（引擎/持久化）走 `swift test`，App 行为走 Xcode 模拟器 + TestFlight 真机。

---

## 2. 范围边界（IN / OUT）

### ✅ MVP IN（第一版必须做）

| 面 | 内容 | 对应原型 |
|---|---|---|
| 今日决策 | 今日裁决（练/休/轻/减载）+ 今日处方（动作/组数/目标重量·次数）+「为什么」简述 + 进入训练入口 | [`rede-07-today-verdict.html`](rede-prototypes/rede-07-today-verdict.html) |
| 专注训练 | 一屏逐组完成、休息计时、下一组建议、跳过/替换/完成原因；完成写入 canonical AppData | [`rede-01-train-engine-led.html`](rede-prototypes/rede-01-train-engine-led.html) · [`rede-02-train-exercise-detail.html`](rede-prototypes/rede-02-train-exercise-detail.html) |
| 进展反馈 | 完成训练历史、PR/e1RM 趋势、训练量、数据质量提示 | [`rede-08-progress-review.html`](rede-prototypes/rede-08-progress-review.html) |
| 本地持久化 | 本地 JSON AppData + gated writer（backup→atomic save）+ DataHealth clean view | — |
| 最小冷启动 | 首次最小引导，训练背景仅作 cold-start prior | — |
| 双语（中英） | 全部用户可见文案中英双语、可切换；遵循 [`REDE_PRODUCT_COPY_BASELINE.md`](REDE_PRODUCT_COPY_BASELINE.md)，英文母语级非机翻 | — |
| TestFlight 上线就绪 | App 图标/启动屏、Info.plist、签名、本地优先隐私、健康免责、反馈入口、TestFlight 构建分发 | — |

### ⏸️ MVP OUT（明确后置，标注阶段，不在第一版关键路径）

| 后置项 | 为什么后置 | 何时做 |
|---|---|---|
| 「计划」全功能（写/调整/回滚） | 不在核心闭环；MVP 仅留**只读占位空状态**保住四 tab IA | fast-follow（见 §7） |
| 订阅 / 付费墙（StoreKit/RevenueCat） | 需先过 Master Architecture gate；TestFlight 免费先行不需要 | Roadmap P2 |
| 账号 / 云同步 / 远程网络 | Master Architecture 禁用系统，需架构修订 | Roadmap P2 + 架构 gate |
| 本地分享卡 / 增长流 | 获客增强项，非核心闭环 | fast-follow（原型 05/06 已就绪） |
| HealthKit 影响训练决策 | 第一版 HealthKit 只能展示/数据质量，进 engine 需 engine-input slice | Roadmap P3 |
| Widget / 推送提醒 | 留存增强，非「能用上」前置 | fast-follow（原型 03/04 已就绪） |
| 公开 App Store 上架（含 ASO/隐私营养标签全套/商店截图） | TestFlight 先行不需要全套过审 | 紧随 MVP（见 §7） |

> **红线**：以上 OUT 项里凡涉及网络、云、账号、StoreKit、CoreData/SwiftData/SQLite、WebView、watchOS、CRDT、远程推送的，一律先改 Master Architecture 再实现，MVP 阶段**不得偷接**。

---

## 3. 现状基线（诚实盘点 · 这是写这份文档的前提）

- **文档/规格层**：成熟。系统逻辑、架构契约、商业路线、设计语言、文案基线齐全。
- **clean runtime 实现**：≈ 近零起步。现有 `ios/packages/*`（含 `RedeTrainingDecision` 73 源/68 测试、`RedeDomain` 50/28 等）和 `ios/Rede` app 层，是 **#507 刚改名的旧 IronPath/PWA 时代 legacy 代码**，living docs 明确判定为 **reference-only，不得当作已完成实现**。§10 缺口索引里几乎每项都标「规格已定义，待实现」。
- **UI 原型**：`docs/rede-prototypes/`（v0 风格 HTML）已覆盖 MVP 全部核心页，可作实现参照。视觉真源 = [`REDE_PRODUCT_DESIGN_LANGUAGE.md`](REDE_PRODUCT_DESIGN_LANGUAGE.md)（Forged Graphite + Emberline，ember 主色 `#E1652B`）。
- **结论**：MVP = **从干净基线新写最小训练闭环**。旧代码只能作算法/命名/fixtures 参考，任何复用必须走 slice review，不得整包搬运。

---

## 4. MVP 架构落地（全部在契约内）

### 4.1 数据流（不可违反）

```
读：本地 JSON AppData ──DataHealth.cleanView──▶ CleanTrainingDecisionInput ──▶ TrainingDecision ──▶ UI(今日/进展)
写：UI 操作 ──▶ gated writer(CanonicalSessionWriter 合同) ──▶ DataHealth gate ──▶ backup ──▶ atomic save
派生：LocalSnapshot(Focus/历史投影) 只读派生，永不触碰 canonical AppData
```

- **raw AppData 永不进引擎**；引擎只吃 clean input。
- canonical 写入**只走一条 gated writer**：no fake success、写前 backup、atomic save、honest failure、不写回 engine 输出。
- LocalSnapshot / UI view model / 未来 HealthKit/widget 都**不是真相**。

### 4.2 MVP 实际触碰的包

| 包 | MVP 用途 | MVP 是否触碰 |
|---|---|---|
| `RedeDomain` | AppData 最小模型 + domain 值（open-bag preserving） | ✅ 核心 |
| `RedeDataHealth` | clean view + 最小 repair/guard + 数据质量评估 | ✅ 核心 |
| `RedeTrainingDecision` | 今日裁决 + 今日处方 + 下一组建议（最小子集） | ✅ 核心 |
| `RedePersistence` | 本地 JSON store + gated 写入编排 | ✅ 核心 |
| `RedeLocalSnapshot` | Focus/历史/进展派生投影 | ✅ 核心 |
| `RedeL10n` | 术语与格式化 + **中英双语 locale 与切换** | ✅ 核心 |
| `RedeHealthKit` / `RedeNotifications` / `RedeWidgetShared` | — | ⏸️ 后置 |
| `RedeBackup` / `RedeUIKit` | placeholder，MVP 不激活 | ⏸️ 后置 |

### 4.3 App 层（薄渲染层 + 四 tab）

- 新建薄 SwiftUI app shell，只渲染 state、接 IO seam，**不承载业务判断**。
- 底部四 tab 保留 IA 契约：**今日 / 训练 / 进展 / 计划**。其中：
  - **今日 / 训练 / 进展** = MVP 真功能。
  - **计划** = MVP 阶段做**诚实空状态占位**（标题 +「计划功能即将上线」+ 一个返回今日的动作；符合 AGENTS 空状态规则），核心闭环不依赖它。这样不返工 IA，又不把 Plan 全功能塞进 MVP。
- Profile / Settings = 低频入口（非底部 tab），MVP 仅放：训练背景、单位、数据导出占位、反馈入口、健康免责。账号/同步**不出现**。

---

## 5. 实现切片队列（slice queue · 核心）

> 按依赖顺序排。每个 slice 必须能**单独验证、单独提交、单独回滚**。验证命令见 §6。每完成一个，回写 §9 进度表。
> 旧代码复用规则：可读旧 `ios/` 找算法/命名/fixtures，但**必须在该 slice 的 PR 里说明复用了什么、为何安全**，不得默认继承旧结构。
>
> **UI 硬验收（用户指令 2026-06-09）**：所有用户可见界面必须按 `docs/rede-prototypes/` 原型复原接入，**完全一致**——布局、颜色、字阶、间距、组件结构逐项对照；`rede-app.html` 为最新设计真相（含 D-A/D-B 决策），单屏稿与其冲突时以 `rede-app.html` 为准。原型与设计语言文档 token 不一致处（如 t3=#9C9484、tab bar=#100E0B）**以原型为准**。引擎数据接入（M2–M4）只替换数据源，不得改变视觉。平台原生行为（滚动物理、安全区、系统状态栏）保留。

### M0 — 干净 App 骨架（让项目能 build、能跑空壳）

| Slice | 产出 | 验收（做完你能看到什么） | 边界 |
|---|---|---|---|
| **M0-1** clean app shell + 四 tab 导航 | 新薄 app 层，四 tab 框架，计划 tab 空状态 | 模拟器能装能开，四个 tab 能切，无业务逻辑，无报错 | 不引入任何网络/存储真相；app 层不写业务 |
| **M0-2** 设计语言基底 + 四屏原型静态复原 | 按 `rede-app.html` 提取精确 token/字阶/签名组件（forged 卡、embar、锻面主按钮、钢色次级钮、ov 标签、ring、自定义 tab bar），四屏按原型**完全一致**静态复原（原型展示内容为静态数据） | 模拟器四屏截图与原型逐屏对照一致 | 静态数据在 M2–M4 被引擎真数据替换、视觉不变；训练流交互与 overlay（confirm/summary/share）属 M3；组件留 app 层，`RedeUIKit` 仍 placeholder |
| **M0-3** 中英双语 locale 基底 | `RedeL10n` 中英两套文案表 + locale 切换 + 日期/单位/数字格式化；**此后所有用户可见文案走双语 key，不得硬编码** | 设置里切换中/英，空壳文案即时切换、无缺字 | 遵循 copy baseline，英文母语级非机翻；不引入远程翻译/网络 |

### M1 — 数据地基（唯一真相 + 唯一写闸）

| Slice | 产出 | 验收 | 边界 |
|---|---|---|---|
| **M1-1** `RedeDomain.AppData` MVP 最小模型 | Codable AppData（profile/program/完成训练/logged sets 的 MVP 子集）+ open-bag 保留 + fixtures | `swift test` 通过；能编解码一份样例 AppData 不丢未知字段 | 不引入第二套模型；schema 不随意 bump |
| **M1-2** `RedePersistence` JSON store + gated writer | 本地 JSON 读写 + `CanonicalSessionWriter` 合同（load→候选→DataHealth gate→backup→atomic save→honest failure） | 测试证明：写前备份、原子保存、坏数据不覆盖、失败如实报告 | 只此一条写路径；no fake success |
| **M1-3** `RedeDataHealth` clean view（最小） | 从 raw AppData 投影出 clean view + 最小 repair/guard | 测试证明：脏/缺字段被安全投影，引擎拿到的永远是 clean input | 引擎永不直接读 raw AppData |

### M2 — 今日决策（核心价值入口）

| Slice | 产出 | 验收 | 边界 |
|---|---|---|---|
| **M2-1** `CleanTrainingDecisionInput` + 今日裁决引擎 | readiness/今日该不该练的最小判断（练/休/轻/减载）+ goldens | 给定固定输入，输出稳定裁决；`swift test` 通过 | 只吃 clean input；不写回 AppData |
| **M2-2** 今日处方引擎（最小） | 今日练什么：动作、组数、目标重量·次数（基于现有 program + 最小渐进）+ goldens | 固定输入产出确定处方；可解释「为什么」字段 | 不依赖锁死默认模板；动作事实经 catalog（最小） |
| **M2-3** 今日页 UI | 渲染裁决卡 + 处方 + 为什么 +「开始今日训练」入口（参照原型 07） | 模拟器：打开今日 5 秒看懂今天练不练、练什么 | 薄渲染；不做 dashboard/不堆卡 |

### M3 — 专注训练（唯一训练中页面）

| Slice | 产出 | 验收 | 边界 |
|---|---|---|---|
| **M3-1** 下一组建议 + 组形（最小） | 逐组处方、休息时长、下一组重量/次数建议 + 跳过/替换/完成原因模型 + tests | 固定场景产出确定的逐组序列与休息建议 | 最小 set-shape；复杂学习后置 |
| **M3-2** 专注训练 UI | 一屏：当前组打勾、休息倒计时、下一组提示、跳过/替换/完成（参照原型 01/02） | 模拟器：能从头到尾跟练完一场、操作顺手 | 「训练」tab 只此一页；无完整训练 dashboard |
| **M3-3** 完成写入 | 训练完成 → completed-session append 经 gated writer 落盘 | 模拟器：练完杀进程重开，记录还在；测试证明写入合规 | 只走 M1-2 写闸；不开第二条 store |

### M4 — 进展反馈（证明训练有效）

| Slice | 产出 | 验收 | 边界 |
|---|---|---|---|
| **M4-1** `RedeLocalSnapshot` 进展派生 | 完成训练历史、e1RM/PR、训练量的只读派生投影 + tests | 固定历史产出确定的趋势/PR；快照不碰 canonical | 派生只读；不写回真相 |
| **M4-2** 数据质量提示 | DataHealth 输出「数据是否可信」的最小信号（坏数据预警，**不写「置信度」字样**，遵守文案 §3.4/§6.2） | 注入异常数据 → 给出诚实提示 | 静默标记，不擅改用户数据 |
| **M4-3** 进展页 UI | 历史 + 趋势单色图（唯一 ember 标记）+ 训练量 + 数据质量（参照原型 08） | 模拟器：练完能在进展看到这次和趋势变化 | 判断先行；不堆密集 dashboard |

### M5 — 最小冷启动 + Profile/Settings 壳

| Slice | 产出 | 验收 | 边界 |
|---|---|---|---|
| **M5-1** 首次最小引导 | 训练背景采集（仅作 cold-start prior）+ 首版 program 初始化 + 空状态 | 新装用户 1 分钟内完成引导，今日页能给出首个处方 | 背景只作 prior，真实判断来自训练记录 |
| **M5-2** Profile/Settings 最小壳 | 单位、训练背景查看/改、数据导出占位、健康免责、反馈入口 | 模拟器：能改单位、看到免责、点开反馈 | 无账号/同步；导出可先占位 |

### M6 — TestFlight 上线就绪

| Slice | 产出 | 验收 | 边界 |
|---|---|---|---|
| **M6-1** App 元信息 | App 图标、启动屏、`Info.plist`（无网络用途声明）、显示名/版本号 | Xcode 构建产物图标/名称正确 | 改 `project.pbxproj`/manifest 需在 PR 说明理由 |
| **M6-2** 本地优先隐私 + 免责 | 隐私说明（本地存储、无第三方数据、无网络）、训练健康免责文案落地 | 文案与 Master/README 免责一致（fitness 非 medical） | 守 fitness 定位，不触发 Apple 1.4.1 |
| **M6-3** 反馈入口 | App 内反馈（邮件/表单链接，外部，不算 app runtime 网络真相） | 能一键发反馈 | 不引入 runtime analytics（见 §8） |
| **M6-4** TestFlight 构建分发 | Archive→上传 App Store Connect→TestFlight 内测组→分发链接 | 真机从 TestFlight 装上、跑通 §1 全部 7 条 | 不公开上架；公开上架后置 |

> **里程碑顺序铁律**：M0→M1→M2→M3→M4 必须按序（后者依赖前者数据地基）；M5 可与 M2–M4 部分并行；M6 在 M2–M4 闭环可演示后启动。

---

## 6. 验证与验证（怎么证明每一步真的可用）

| 改动类型 | 命令 / 方式 |
|---|---|
| 文档 / 规格变更 | `git diff --check` |
| 单包逻辑（Domain/DataHealth/TrainingDecision/Persistence/LocalSnapshot） | `cd ios/packages/<PackageName> && swift test` |
| 全包回归 | `for package in ios/packages/*; do [ -f "$package/Package.swift" ] && (cd "$package" && swift test) \|\| exit 1; done` |
| App 行为（UI/导航/写入/HealthKit/通知/widget wiring） | `xcodebuild -project ios/Rede.xcodeproj -scheme Rede -destination 'generic/platform=iOS Simulator' build` + 模拟器手测 |
| 上线真机 | TestFlight 真机跑 §8 验收清单 |

规则：
- **每个 slice 完成必须贴真实测试输出**（不是「应该能过」）。
- **较大改动（新引擎、写路径、跨包）完成后，用 `code-reviewer` 子 agent 独立审查**（只读 + git diff + 验收标准），实现者与审查者分开。
- 没有 Node/Vite/npm/Vitest 门禁；GitHub workflow 保持 Swift/Xcode。

---

## 7. 上线就绪清单（TestFlight 先行）

**MVP 必须齐（TestFlight 内测）**：
- [ ] Apple Developer Program 账号、App ID、TestFlight 配置
- [ ] App 图标 / 启动屏 / 显示名 / 版本号 / `Info.plist`
- [ ] 本地优先隐私说明（无网络、无第三方数据采集）
- [ ] 训练健康免责（fitness 非 medical，守 Apple 1.4.1）
- [ ] App 内反馈入口
- [ ] 签名 + Archive + 上传 + 内测组 + 分发链接
- [ ] §1 全部验收在真机通过（含中英双语切换）

**紧随 MVP（公开 App Store 上架，本文档之后的 fast-follow，不阻塞 TestFlight）**：
- [ ] App Store 商店页文案 + 截图 + 英文 ASO 关键词
- [ ] 隐私营养标签全套
- [ ] 母语级英文（价值面/教练解释，禁机翻，Roadmap P3）
- [ ] 提审 → 过审

---

## 8. 获客与验证编排（调和 Roadmap「验证先行」）

Roadmap 官方推荐 **B 验证先行**（先外部落地页/waitlist/烟雾测试 paywall）。本 MVP 采取的姿态是：**把可用的 App 本身作为获客与验证工具**，并保留轻量验证钩子，而不是停下来只做外部页。两者不冲突、可并行：

- **App 即验证**：TestFlight beta 用户 = 早期获客 + 真实使用验证。先看「用户愿不愿意装、愿不愿意练第二次」。
- **招募渠道**（Roadmap §7）：r/weightroom、r/Fitness、健身 Discord 招 20–50 名英文 lifter；落地页 mock（[`rede-landing-mocks.html`](rede-prototypes/rede-landing-mocks.html)）可外部投放收 waitlist，**不在本仓库恢复 Web runtime**。
- **MVP 阶段的信号怎么收（诚实约束）**：Master Architecture **禁止 remote analytics/网络**。所以 MVP **不偷接远程埋点**，早期信号靠：① TestFlight 内测反馈 + 内置反馈入口；② 用户访谈；③（可选）纯本地、不上传的使用计数展示。需要远程漏斗埋点时，另过架构 gate（Roadmap P2）。
- **最小北极星（手动观测版）**：每周完成 ≥2 次有记录训练的 beta 用户比例 + 首训练完成率 + W1 复练率。
- **本 MVP 与 Roadmap 的映射**：本文档 = Roadmap **P1（最小训练闭环）的执行层** + 用 TestFlight 把「最小可用产品」与「早期验证」合并；P0 外部验证可并行但不阻塞上线。

---

## 9. 进度追踪（活文档的「活」· 每个 slice 完成必须回写）

> 现状：clean runtime 近零，初始全部「⬜ 未开始」。状态值：⬜ 未开始 / 🟡 进行中 / ✅ 已验收。

| Milestone | Slice | 状态 | 证据（PR / 测试） | 备注 |
|---|---|---|---|---|
| M0 骨架 | M0-1 app shell + 四 tab | ✅ | 2026-06-09：删 23 个 legacy app 层文件，新建 clean shell（RedeApp + RootTabView + 四 tab 占位，计划 tab 诚实空状态）；`xcodebuild build` SUCCEEDED；模拟器装机启动截图验证四 tab 渲染 | 包依赖配置保留待 M1+ 使用 |
| M0 骨架 | M0-2 设计语言基底 + 四屏原型静态复原 | ✅ | 2026-06-09：按 `rede-app.html` 提取精确 token/字阶 + 签名组件（ForgedCard/EmbButton/SteelButton/Overline/RingDot/SegControl/SteelToggle/自定义 TabBar），四屏静态复原；`xcodebuild` SUCCEEDED；模拟器四屏截图逐屏对照原型一致 | 图标 Tabler→SF Symbols 平台等价映射；静态数据待 M2–M4 替换 |
| M0 骨架 | M0-3 中英双语 locale 基底 | ✅ | 2026-06-09：`RedeL10n` 新增 `RedeStrings`（90+ key 中英原生稿）+ `RedeLocale.resolve`；app 层 LocaleStore(@Observable) + Settings sheet 语言切换；四屏+tab bar 全部 key 化；`swift test` 通过（含 copy baseline 基准句断言）；模拟器中英八屏截图验证 | 语言偏好暂不持久化，随 M5-2 进 AppData profile；legacy Terms/Formatters 并存待后续 slice 清退 |
| M1 数据地基 | M1-1 AppData 最小模型 | ⬜ | — | |
| M1 数据地基 | M1-2 JSON store + gated writer | ⬜ | — | |
| M1 数据地基 | M1-3 DataHealth clean view | ⬜ | — | |
| M2 今日决策 | M2-1 今日裁决引擎 | ⬜ | — | |
| M2 今日决策 | M2-2 今日处方引擎 | ⬜ | — | |
| M2 今日决策 | M2-3 今日页 UI | ⬜ | — | |
| M3 专注训练 | M3-1 下一组建议 + 组形 | ⬜ | — | |
| M3 专注训练 | M3-2 专注训练 UI | ⬜ | — | |
| M3 专注训练 | M3-3 完成写入 | ⬜ | — | |
| M4 进展反馈 | M4-1 进展派生投影 | ⬜ | — | |
| M4 进展反馈 | M4-2 数据质量提示 | ⬜ | — | |
| M4 进展反馈 | M4-3 进展页 UI | ⬜ | — | |
| M5 冷启动 | M5-1 最小引导 | ⬜ | — | |
| M5 冷启动 | M5-2 Profile/Settings 壳 | ⬜ | — | |
| M6 上线 | M6-1 App 元信息 | ⬜ | — | |
| M6 上线 | M6-2 隐私 + 免责 | ⬜ | — | |
| M6 上线 | M6-3 反馈入口 | ⬜ | — | |
| M6 上线 | M6-4 TestFlight 构建分发 | ⬜ | — | |

---

## 10. 风险与红线

- **守 local-first**：MVP 全程不联网、不云、不账号、不 StoreKit、不 CoreData/SwiftData/SQLite/WebView/watchOS/CRDT/远程推送。任一需求出现 → 先改 Master Architecture。
- **不整包搬运旧代码**：旧 `ios/` 仅作参考；复用必须 slice review。
- **不假装成功**：每 slice 贴真实测试/截图；跑不动的（真机）走 §8 手动验收。
- **守 fitness 定位**：不写成 medical（避 Apple 1.4.1）；数据质量不写「置信度」字样。
- **语言（双语·硬要求）**：MVP 全部用户可见文案必须中英双语、可切换，遵循 [`REDE_PRODUCT_COPY_BASELINE.md`](REDE_PRODUCT_COPY_BASELINE.md) 的双语 voice/tone，**英文母语级、严禁机翻**（差异化护城河，Roadmap §6）。双语 key 化在 M0-3 先于所有 UI slice 建好，后续 UI 文案一律走 L10n key，不得硬编码。公开上架前由英文母语 lifter 验收价值面文案（Roadmap P3）。
- **范围蠕变**：分享卡/计划/HealthKit/订阅/widget 一旦想塞进 MVP，先回看 §2 OUT 表与 Roadmap 阶段，确认是否真的阻塞「让用户用上」。

---

## 11. 维护触发与终局（何时更新 · 何时删除）

**维护触发**：

- 任一 slice 状态变化 → 更新 §9 进度表 + CHANGELOG。
- MVP 范围、上线形态、里程碑顺序变化 → 更新 §2/§5/§7 并同步 Roadmap。
- 与系统逻辑/架构契约出现冲突 → **以那两份为准**，回改本文档，必要时停下取得架构批准。

**终局 · 完成后自清洁（本文档不长期留存）**：

触发条件 = §9 全部 slice ✅ **且** §1 验收清单在 TestFlight 真机全部通过 **且** **你（用户）明确确认 MVP 达成**——删除动作必须以这句确认为前提，任何 agent 不得自行判定达成并删除。届时按顺序执行：

1. **留痕**：把最终进度表与验收证据摘要写入 `CHANGELOG.md`（一条「MVP 达成」记录，含 TestFlight 构建号与日期）。
2. **回收**：把仍有长期价值的结论收回 canonical 文档——系统逻辑 §10 缺口索引更新已实现项；Roadmap P1 标记完成、后续移交 P2/P3。
3. **解除登记**：从 `docs/DOCS_MANIFEST.md`、`README.md`、`AGENTS.md`、`COMMERCIALIZATION_ROADMAP.md` 移除对本文档的登记与链接。
4. **删除**：`git rm docs/REDE_MVP_IMPLEMENTATION_PLAN.md`（git 历史可恢复）。

**接棒文档（为什么要自清洁）**：MVP 之后的规划由两份文档承接——**PRD**（已建并登记：[`REDE_PRD.md`](REDE_PRD.md)，其 §8 发布映射的 R0 即本文档范围）+ **基于 PRD 与 MVP 完成度的开发规划**（MVP 达成时按 DOCS_MANIFEST 纪律登记创建）。在本文档存续期间，§9 进度表是「MVP 完成程度」的唯一读数来源；本文档被删除即代表 MVP 100% 达成（以 CHANGELOG 留痕为证）。
