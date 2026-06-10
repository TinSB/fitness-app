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
- **clean runtime 实现**：≈ 近零起步。现有 `ios/packages/*`（含 `RedeTrainingDecision` 73 源/68 测试、`RedeDomain` 50/28 等）和 `ios/Rede` app 层，是 **#507 刚改名的旧 IronPath/PWA 时代 legacy 代码**，living docs 明确判定为 **reference-only，不得当作已完成实现**。§10 缺口索引里几乎每项都标「规格已定义，待实现」。（2026-06-09 M1-0 更新：上述 9 个 legacy 包已整体退役移出编译面，参考走 git tag `legacy-parity-final`；树内仅存在用的 `RedeL10n`、`RedeWidgetShared` 与冻结的 `ios/ParityFixtures`。）
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
| **M1-0** legacy 包退役（clean 基线收口） | 9 个旧 IronPath/PWA 包（`RedeDomain` 链 5 包 + `RedeBackup`/`RedeUIKit`/`RedeLocalSnapshot`/`RedeNotifications`）整体移出编译面；pbxproj 解链；CI 改显式包清单断言；tag `legacy-parity-final` 留参考 | 剩余包 `swift test` 绿；`xcodebuild build` SUCCEEDED；CI 不再静默跳过消失的包 | 不动 `RedeL10n`/`RedeWidgetShared`/`ParityFixtures`；仍有效的合同语义（open-bag/schema 守卫/编辑语义）由 M1-1+ 新测试重生 |
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
| **M3-3** 完成写入 | 训练完成 → completed-session append 经 gated writer 落盘 | 模拟器：练完杀进程重开，记录还在；测试证明写入合规 | 只走 M1-2 写闸；不开第二条 store；FR-TR9（恢复进行中训练，MVP）尚无归属切片——M3-3 设计时拍板（随片实现或另开） |
| **M3-4** 恢复进行中训练（FR-TR9） | 进行中会话 draft 持久化（非 canonical 真相，独立 draft 文件）+ 重开提示「继续进行中的训练」 | 模拟器：练到一半杀进程重开，提示恢复且已完成组不丢 | draft ≠ canonical（Master：draft restore 是内存 draft 概念的落盘缓存）；恢复仅本次会话，不做跨天恢复 |

### M4 — 进展反馈（证明训练有效）

| Slice | 产出 | 验收 | 边界 |
|---|---|---|---|
| **M4-1** `RedeLocalSnapshot` 进展派生 | 完成训练历史、e1RM/PR、训练量的只读派生投影 + tests | 固定历史产出确定的趋势/PR；快照不碰 canonical | 派生只读；不写回真相 |
| **M4-2** 数据质量提示 | DataHealth 输出「数据是否可信」的最小信号（坏数据预警，**不写「置信度」字样**，遵守文案 §3.4/§6.2） | 注入异常数据 → 给出诚实提示 | 静默标记，不擅改用户数据 |
| **M4-3** 进展页 UI | 历史 + 趋势单色图（唯一 ember 标记）+ 训练量 + 数据质量（参照原型 08） | 模拟器：练完能在进展看到这次和趋势变化 | 判断先行；不堆密集 dashboard |

| **M4-4** 训练中自主调节强化（插片·用户指令 2026-06-10） | SegControl 命中区修复 + 快改可见性（图标+一次性提示）+ 重量任意精度直接输入 + 回流合同显式测试 | 模拟器/真机：点分段框任意位置可切换；训练页重量可见可调可精确输入；调整值驱动下一组与下一场 | 零新增组件面；首练定档（训练水平缩放）归 M5-1 |

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
| M1 数据地基 | M1-0 legacy 包退役 | ✅ | 2026-06-09：9 包整体退役（~330 跟踪文件），pbxproj 脚本化解链（-108 行，app target 仅剩 RedeL10n+RedeWidgetShared）；CI 改 EXPECTED_PACKAGES 显式断言（修复包消失静默变绿隐患）；新增 `.claude/quality-gate.cmd`；本地门禁 PASS：RedeL10n 23 测试绿（含 parity）+ RedeWidgetShared 9 测试绿 + `xcodebuild` SUCCEEDED；tag `legacy-parity-final` | 老数据迁移暂缓（开门设计：open-bag + legacy 字段词汇）；DEV_LOG.md 同 PR 登记建立并回填 M0 |
| M1 数据地基 | M1-1 AppData 最小模型 | ✅ | 2026-06-09：新建 RedeDomain 包（TDD 红→绿；8 源文件：JSONValue/SchemaVersion/AppData + 4 实体视图）；verbatim storage + 类型化只读视图，open-bag 全层级保留由构造保证；20 测试绿 = schemaVersion 守卫 9 + open-bag 往返 4 + 类型视图 6 + 真实导出冒烟 1（805KB legacy 导出无损往返）；门禁 PASS（3 包 52 测试 + xcodebuild SUCCEEDED） | 字段词汇沿用 legacy tag（开门设计）；schemaVersion=8 不 bump；变更语义归 M1-2 gated writer；顺手修复 M1-0 漏网：workspace 退役包残留引用（删 5 个失效引用，RedeDomain 由新包顶替，补登 RedeWidgetShared） |
| M1 数据地基 | M1-2 JSON store + gated writer | ✅ | 2026-06-09：新建 RedePersistence 包（TDD 红→绿，19 测试）；JSONFileAppDataStore（load 三态/原子写/时间戳备份）+ CanonicalSessionWriter 唯一 gated 编排（load→候选→注入 gate→backup→atomic save→honest failure），首个入口 appendCompletedSession；验收逐条有测试：写前备份字节级断言、坏数据不覆盖、gate 拒绝文件不动、失败如实传播、open-bag 保全；门禁 PASS（4 包 71 测试 + xcodebuild SUCCEEDED） | DataHealth gate 为注入 seam，真实现随 M1-3；其余写入类别随各自 slice 加入口，不另起写路径 |
| M1 数据地基 | M1-3 DataHealth clean view | ✅ | 2026-06-09：新建 RedeDataHealth 包（TDD 红→绿，20 测试）；CleanAppDataViewBuilder 纯值投影（raw verbatim 携带永不改写），丢弃式 guard（session 需 id/date/completed、重复 id 保首个；exercise 需 exerciseId；set 需 weight≥0/reps≥1；rir 0...15；profile 标量宽松范围），每次丢弃记 typed DataHealthIssue（兼作 Progress 数据可信提示素材）；不发明默认值（冷启动 prior 归 M2 引擎）；门禁 PASS（5 包 91 测试 + xcodebuild SUCCEEDED） | M2 起引擎只吃 CleanAppDataView，永不读 raw；M1 数据地基里程碑完成 |
| M2 今日决策 | M2-1 今日裁决引擎 | ✅ | 2026-06-09：新建 RedeTrainingDecision 包（TDD 红→绿，16 测试含 4 goldens）；CleanTrainingDecisionInput 私有 init 编译期锁（raw 进不了引擎）+ 注入 today（无 clock/IO/不写回）；安全优先瀑布出 FR-T1 四态（练/轻/休/减载）+ typed reason/signal（引擎零文案，FR-T3 禁词结构化满足）；输入面按 PRD 开放决策 #2 拍板落地（仅历史+计划结构）；DataHealth 增补 CleanProgram 投影 + 日期格式 guard（26 测试）；门禁 PASS（6 包 113 测试 + xcodebuild SUCCEEDED） | 阈值由 goldens 锁定；减载排序高于连练休息（结构性超量优先）；训练日名称归 M2-2 处方 |
| M2 今日决策 | M2-2 今日处方引擎 | ✅ | 2026-06-09：TodayPrescriptionEngine（TDD 红→绿，包内 +17 测试含 5 goldens 锁定全部五个训练日）；吃 M2-1 裁决（rest→无处方）；输出全 typed/kg 口径/零文案（动作+组数+次数区间+目标重量+RIR+previous→target→change 三元组）；日计划=槽位规则×ExerciseCatalog.minimal（24 动作）现算非冻结模板；双重渐进 ±2.5kg（RIR min 口径：任一组力竭即不加重，审查后拍板）+ 裁决调制（light×0.9/deload×0.8 组数−1；取整弹回则强制下调一格）；哑铃=单只口径声明；PRD 开放决策 #1 拍板落地；系统逻辑新增 §6.0.1；门禁 PASS（6 包 130 测试 + xcodebuild SUCCEEDED） | 组形归 M3-1；restSeconds 归 M3；动作双语名归 M2-3 L10n；catalog 贡献权重/禁忌缺席已声明 limitation |
| M2 今日决策 | M2-3 今日页 UI | ✅ | 2026-06-09：今日页接引擎真数据（TodayModel 组合层：store→clean view→input→裁决→处方），视觉零改动只换数据源；RedeL10n 新增引擎文案层（typed code→双语「信号+影响+决策」句 + 24 动作名 + 禁词回归测试）；DTO 补 Rail 字段；app target 链接 4 引擎包（pbxproj 正当理由：引擎接线）；修复真 bug：Info.plist 未声明 zh-Hans 致中文系统用户默认英文界面；审查后加固：unreadable 数据三态诚实降级（绝不当新用户渲染）+ 主线程外异步加载；门禁 PASS（6 包 136 测试 + xcodebuild SUCCEEDED）+ 模拟器中英双语首启截图（校准态，数值全部可溯源引擎输出） | 重量 kg 显示（FR-SE1 前不硬编码 lb，拍板留痕）；Receipt 交互/Hold/Swap 归 M3；M2 里程碑完成 |
| M3 专注训练 | M3-4 恢复进行中训练 | ✅ | 2026-06-10：draft = 处方+事件日志（reducer 只记被接受的事件），恢复 = 重放——「恢复态≡中断态」由 Equatable 直接断言（TDD +7 测试；审查加固：重放任一事件被拒→恢复返回 nil 宁缺勿错、resting 态 Hold 重放、卡小结态恢复）；独立 draft 文件（非 canonical、不经写闸、仅当日、完成即删、best-effort 原子写）；SessionStore.apply 事件包装（每个动作即存）；启动双语恢复提示（Resume/Discard/稍后无循环）；模拟器实证：练 1 组杀进程重开出提示（截图存档）；门禁 PASS（6 包 198 测试） | M3 里程碑完成；draft ≠ canonical ✓ |
| M3 专注训练 | M3-1 下一组建议 + 组形 | ✅ | 2026-06-09：SessionSetPlanner 确定性逐组展开（straight sets + 动作级 restSeconds，组形学习按 §6.3 后置）+ NextSetEngine（执行事实为基线：偏离计划延续用户实际重量；安全瀑布 疼痛→flag+减2.5 / RIR≤0.5→减 / 掉出区间下限→减；无 RIR 不猜；全组完成→nil）+ SetSkipReason/SessionEndReason/同替代族替换候选；TDD +22 测试（审查加固：五个训练日 rest 序列精确锁定、替换候选排除当日已排动作、疼痛独立场景）；系统逻辑新增 §6.0.2；门禁 PASS（6 包 158 测试 + xcodebuild SUCCEEDED） | 组形学习/热身/器械校准按 §6.3 后置；落盘归 M3-3 写闸 |
| M3 专注训练 | M3-2 专注训练 UI | ✅ | 2026-06-09：训练页全交互——状态机抽成包内纯 reducer（TrainFlowState，11 测试）+ SessionSummaryBuilder（4 测试），app 层只渲染+计时；当前组卡/打勾/set⇄rest 原地 morph 倒计时(+30s/暂停/跳过)/Hold 持久开关/快改(两次点击)/跳过组·动作(带原因)/换动作(同族排除当日)/登记不适(保守化+合规警示句)/Finish 确认+小结；TrainEngineCopy 双语层；门禁 PASS（6 包 180 测试）+ 模拟器中英截图；审查 2 MAJOR（跳过后组表错位、不适提示跨组残留）+ 4 MINOR 全部修复 | 落盘归 M3-3；FR-TR9（恢复进行中训练）无归属切片已留痕；无原型控件（快改/不适/更多/空态）取保守样式待设计确认 |
| M3 专注训练 | M3-3 完成写入 | ✅ | 2026-06-09：CompletedSessionBuilder（只记用户事实：实际组/跳过/替换审计/收尾原因，engine 输出不落盘）+ 真 DataHealth gate（CanonicalWriteValidation：clean 不丢 session + 新 session 必须过净化，拒绝时文件原字节不动）+ SessionStore 写入接线（保存并完成/诚实失败可重试）；端到端测试走完整闭环（空库→处方→跟练→落盘→重读→裁决翻转休息+二次写产生备份）；**模拟器实证：练完杀进程重开，今日页直接「已练，休息」**；门禁 PASS（6 包 191 测试）；审查 3 MAJOR（双击双写、跳过后换动作留痕错位、钩子空转）+ 5 MINOR 全部修复 | FR-TR9 拍板：另开 M3-4（draft 非 canonical 真相）；只走 M1-2 写闸 ✓ |
| M4 进展反馈 | M4-1 进展派生投影 | ✅ | 2026-06-10：`RedeLocalSnapshot` 重生为 Foundation-only 独立包（Master 硬约束：与 RedeDomain/canonical 强制解耦，输入是包内自有值类型，app 组合层负责映射）；`ProgressSnapshotBuilder` 纯函数投影：历史（volume/组数/顶组/PR/时长，新→旧）+ 每动作 Epley e1RM 趋势（旧→新 + latest/best）+ ISO 周训练量（周一起始，纯整数日期数学无时区依赖）；口径全部对齐已落盘实现（Epley 同 SessionSummary、PR 严格大于+首练不发奖同 M3）；TDD 17 测试（含闰年/跨年周界、非法日期跳过、确定性断言；审查加固：同场重复动作条目先合并再判 PR——首练日场内自比不发奖、每场每动作单一 e1RM 点，+2 测试）；CI/门禁/workspace 三处注册；门禁 PASS（7 包 215 测试） | 派生只读不写回 ✓；UI 接线归 M4-3；legacy median-e1RM/置信度门控不进本合同（置信度归 M4-2 行为表达） |
| M4 进展反馈 | M4-2 数据质量提示 | ✅ | 2026-06-10：DataQualityReportBuilder（RedeDataHealth）输出 typed 最小信号：① 净化丢弃统计按类聚合（场/动作/组/字段）；② 可疑数值静默标记——相对规则（>1.5×本人更早场最好顶组，基准 ≥30kg，首练不标，被标组不进基准防污染）+ 绝对天花板（>400kg）+ 次数（>50），一组一理由按优先级；TDD 16 测试（12 红→绿 + 审查补 4：理由优先级显式断言、次数规则独立触发、基准 30kg 端点、基准不演化已知边界锁定）；红线结构化满足：只标不改（clean view 原样有测试）、零文案（「置信度」结构上不存在）、缺 RIR 缺口刻意不进报告（§3.4 折进训练时）；门禁 PASS（7 包 231 测试） | 阈值为 MVP 起步值（测试锁定待校准）；UI 标记+修正入口归 M4-3 |
| M4 进展反馈 | M4-3 进展页 UI | ✅ | 2026-06-10：进展页接真数据（原型骨架不变：三尺度 seg + 判断句 HERO + 单色图唯一 ember）——单次=按动作量柱+PR ember；本周=按周量柱+与上周 delta（FR-PR3）；周期=关键动作真 e1RM 折线 ember 标最高点 + §5.3 原文句式；新增历史（FR-PR1，含逐组明细 sheet）与数据质量区（FR-PR4 行为化提示）；可疑组不进统计但如实列出（§3.4 行为表达，模拟器实证 227kg 手滑值丢失假 PR）；RedeLocalSnapshot +TrendInsight/WeeklyInsight（12 测试）、RedeL10n 进展文案层 +formatE1Rm（7 测试，禁词扩「置信度/confidence」）；模拟器抓 2 真 bug（Epley 浮点直出 UI、手滑值霸占判断句）；审查 2 MAJOR（判断调用移回组合层、跳周≠第一周文案）+ 5 MINOR + 2 NIT 全修；门禁 PASS（7 包 250 测试）+ 中英三尺度/空态/数据区/默认 Week 回归截图；M4 里程碑完成 | 诚实化拍板：按肌群柱/人形图（无肌群权重）、Development 块（FR-PR6 FF）、计划减载点（无周期模型）不上——不给用户看编造数据；修正入口随 M5 编辑类写入；时长展示待 clean view 扩字段 |
| M4 进展反馈 | M4-4 训练中自主调节强化（插片） | ✅ | 2026-06-10：用户真机反馈两问题——①进展页分段框只有文字可点（.plain 只命中不透明像素）→ contentShape 修复；②「硬模板」诊断为可见性问题（引擎本就跟随实际执行）→ 重量旁加可调图标 + 一次性提示（用过即消失）+ 调节行重量改任意精度数字框（≥0 钳制，不可解析不猜）；回流链显式合同测试（调整→下一组跟随→落盘只记实际→下一场以实际为基线，绝不回拉目录值）；审查 2 MAJOR + 4 MINOR/NIT 全修（关键一条：数字框未收键盘直接打勾会静默记旧值→打勾前强制提交 + 键盘加「完成」键；回流断言强化为双重渐进精确值 52.5）；门禁 PASS（7 包 253 测试）+ 中英截图 | 首练定档（训练水平缩放首练重量）归 M5-1 引导；分段命中/数字框输入列入手动验收 |
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
