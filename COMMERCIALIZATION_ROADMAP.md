# Rede 商业化上线 Roadmap

> 决策基线（2026-06-05）：**原生 iOS（App Store）+ 英文化出海 + 订阅制**。
> 本文档是后续所有商业化动作的主干。所有代码项以"交给 Claude Code 的实现 brief"形式标注，本文档不含可运行代码。

---

## 0. 一句话判断（Thesis）

把话说在前面：你选的这条路（native iOS + 英文出海 + subscription）天花板最高，但**在赚到第一块钱之前，要先铺三块商业地基**——订阅收费闭环、专业英文内容、iOS 上架就绪。账号和云同步是重要的信任基础设施,但不是首个收费闭环的前置硬依赖;它们必须保持 local-first + opt-in,并在 Master Architecture 批准后进入实现。在一个 Hevy / Fitbod / Strong 已经占位的拥挤市场里，最大的风险不是"做不出来"，而是**埋头做 5 个月，上线才发现英文用户不买账，或定价错了**。

所以这份 Roadmap 的主干**不是**"大爆炸式开发然后上线"，而是：

> **先用最低成本验证英文需求与付费意愿 → 再 clean rewrite 最小训练闭环 + 建商业化地基 → 小英文市场软启动调漏斗 → 放量到美区。**

验证先行不是拖延，是把**不可逆的重工程投入**，压到"已知有人要、且愿意付多少钱"之后再发生。

---

## 1. 重写基线：从"目标系统逻辑"到"付费英文 iOS 订阅"的真实距离

| Workstream | 重写基线 | 距离 / 难度 |
|---|---|---|
| iOS 原生 | 产品系统逻辑、训练决策合同、设计语言和文案基线已明确;干净 iOS 实现已是活跃实现,旧 IronPath/PWA 代码已退役（git tag `legacy-parity-final`） | ✅ **Rede 1.8 (build 25) 已于 2026-07-17 提交 App Store 审核，当前 Waiting for Review**。现役 app + widget + 10 个本地包已覆盖完整 1.8 Free Core 与 production-disabled 订阅地基；公开商店发布仍以 Apple 审核结果为准 |
| 账号 + Auth | 无 first-version runtime；iOS 原生方向保留在 `docs/REDE_REBUILD_00_IRONRULES_AND_CLOUD.md` 与 `docs/CLOUD_DECISIONS_ARCHIVE.md` | **近 greenfield**。服务 opt-in 云同步、跨设备恢复和账号级支持;不阻塞首个 App Store 订阅闭环 |
| 云同步 | 无 first-version runtime；已拍板方向是 local-first + opt-in + CRDT 记录级合并 | 未实现。offline-first 冲突合并是最贵、最容易返工的一块;进入实现前必须先通过 Master Architecture gate |
| 订阅基础设施 | 🟡 企业级地基与非交易页面壳已落地，生产收费仍关闭 | 2026-07-18 已有 `RedeEntitlements`、StoreKit 2 adapter/UI wrapper、Settings 方案态、可始终进入的 Rede Coach 品牌页、到期/前台复核、并发旧结果/混合信任/交易确认防护、显式恢复、入口级 fail-closed launch gate、生产/测试双 scheme、本地月/年 fixture 与 app XCTest target。品牌页在 production 只显示品牌名、当前方案与诚实状态，不含价值承诺、商品、价格、试用、购买或未实现权益。尚无获批 paid capability、真实 App Store Connect 商品/价格/试用或有效政策页；Xcode 26.6 + iOS 26.5 Simulator 的 `SKTestSession` 仍在保存配置时报 `Code=3`。RevenueCat、账号、服务端权益和远程分析不进首片 |
| 英文化 | 产品文案方向已定义;双语 key 化基础设施与中英切换已建立（`RedeL10n` + `LocaleStore`，M0-3/M5-2），UI 文案全部 key 化 | **被低估的大头**。基础设施已就位;真正的难点仍在**证据/教练解释文案**——你的差异化所在,必须专业英文重写（非机翻），公开上架前由英文母语 lifter 审校 |
| 合规 | README 已坚持"训练决策支持，非医疗诊断" | 隐私政策 / ToS / 隐私营养标签 / 医疗免责 / GDPR·CCPA / 第三方 AI 数据披露 待补。**务必守住 "fitness 不是 medical" 定位**，否则触发 Apple Guideline 1.4.1 的监管证明要求 |
| 获客 / 增长 / 数据 | 无 approved runtime analytics;官网验证可在外部工具中进行 | 定位、ASO、冷启动渠道、漏斗埋点全空白 |
| 分享 / 增长资产 | S0 本地分享链已实现 | 1.8 已有训练总结、PR/里程碑、发展画像三类本地分享卡 + iOS Share Sheet；它们属于 Free Core。账号、feed、归因、公开主页继续后置到架构 gate |

**结论**：真正的首发关键路径是 **外部付费意愿验证 → clean iOS rewrite 最小训练闭环 → 订阅权益 → 英文核心内容 → iOS 上架就绪 → 合规 → 基础备份/导出信任**。账号和云同步是后续 Trust Infra / Paid Coach 增强项,不能抢在收费闭环和产品价值验证之前消耗最大工程成本。

---

## 2. 核心决策：上市节奏策略（发散 → 量化 → 推荐）

### 2.1 发散（Diverge）

- **A 大爆炸全量上线**：把账号+同步+订阅+全英文+iOS 全做完，一次性付费上线美区。
- **B 验证先行**：重工程前先低成本验证英文需求与付费意愿（外部落地页+waitlist+烟雾测试 paywall+静态分享卡 mock+访谈/concierge 反馈），锁定定位与定价，再开建。
- **C 分阶段软启动**：建完地基，但先在小英文区（加/澳/新西兰/爱尔兰）软启动调 onboarding→trial→convert 漏斗与 ASO，再放量美区。
- **D 免费先起量、后加订阅墙**：iOS 英文版**免费**首发，先攒用户/评论/ASO 排名，留存跑通后再上订阅。
- **E 外部落地页 + mock/demo 验证**：不用仓库内 Web runtime,用外部落地页/表单/邮件工具 + 可信 iPhone mock / demo video 验真实付费意愿。

### 2.2 量化对比（Score）

评估维度与权重（针对你"自筹资源、拥挤市场、英文需求未验证、地基很重"的处境）：

| 维度 | 权重 | A 大爆炸 | B 验证先行 | C 软启动 | D 免费先行 | E 外部验证 |
|---|---|---|---|---|---|---|
| 市场风险降低 / 验证强度 | 30% | 1 | 5 | 4 | 3 | 5 |
| 首次收入/信号速度 | 20% | 2 | 3 | 3 | 1 | 4 |
| 工程成本低 / 聚焦（低=高分） | 20% | 1 | 4 | 2 | 3 | 3 |
| 与既定 native+订阅路径契合 | 15% | 5 | 4 | 5 | 2 | 2 |
| 可逆性 / 容错 | 15% | 1 | 5 | 3 | 2 | 4 |
| **加权总分** | 100% | **1.80** | **4.25** | **3.40** | **2.30** | **3.80** |

排序：**B (4.25) > E (3.80) > C (3.40) > D (2.30) > A (1.80)**。

### 2.3 唯一推荐（Recommend）

**推荐：以 B（验证先行）为姿态，承接 C（分阶段软启动）做正式付费上线；验证阶段用 E 的机制（外部落地页 + 烟雾测试 paywall + 静态分享卡 / iPhone mock / demo video）去量真实付费意愿。**

即主干 = **验证 → 建地基 → 小英文区软启动 → 放量美区**，而不是大爆炸。

- **推荐理由**：你的处境里，唯一不可逆的大成本是"建完整商业化机器"（clean iOS rewrite + 云同步冲突合并 + 全量英文内容重写）。B 用 3–5 周、几乎零产品工程地砍掉"市场不要/定价错"这个最大风险。C 是 native 订阅的标准增长打法,软启动让你在低 CAC 的小英文区把漏斗和 ASO 调好,再打最贵、最不容错的美区。
- **主要取舍（牺牲了什么）**：放弃马上打磨旧 App 的速度感;先用外部验证证明目标用户愿意留资、点击价格、加入 founder beta。正式收入会晚于直接开发,但能避免把 rewrite 成本砸在错误定位上。
- **关键假设**：系统逻辑已经足够清楚 ⇒ **3–5 周内能用外部网站、mock、demo 和访谈获得付费意向信号**。若信号不足,不启动 clean iOS rebuild;继续收窄定位、价格和卖点,不在仓库恢复 Web runtime。

---

## 3. 分阶段 Roadmap

> 周数为相对周（W0 = 启动）。多 workstream 并行，故区间重叠。每阶段设**出口 Gate**，不达标不进下一阶段。

| 阶段 | 周期 | 目标 | 出口 Gate |
|---|---|---|---|
| **P0 外部定位与付费意向验证** | W0–W5 | 锁定英文定位/差异化、定价假设、付费意愿信号 | 有可量化需求 + 价格点击 / 留资 / founder beta 信号 |
| **P1 Clean iOS Rewrite SPEC + 最小训练闭环** ✅ 已完成 | W4–W14（已过） | 把系统逻辑切成可验证 rewrite slices,实现 Today / 专注训练 / Progress 最小闭环 | ✅ 已达成并持续扩展至 1.8 (25)；公开商店审核属于 P3，不再把旧 R0 验收写成当前阻塞 |
| **P2 商业化地基** | W10–W20 | 订阅+权益+基础备份/导出；远程埋点、账号、云同步各自走独立 gate | 能收费 + 权益可恢复 + 本地数据可带走；软启动前确定可验证漏斗方案 |
| **P3 英文化 / 合规 / iOS 上架就绪** | W12–W24 | 专业英文、StoreKit/App Store Connect、HealthKit 边界、合规、过审 | 价值面英文达母语级并拿到 App Store 批准 build |
| **P4 软启动+冷启动** | W18–W26 | 小英文区软启动、跑通漏斗、起量 | 健康的 trial→paid 与 D30 |
| **P5 留存增长+放量** | W24+ | 留存闭环、放量美区/英区、定价优化 | LTV > CAC，可持续增长 |

### P0 外部定位与付费意向验证（W0–W5）— 不依赖重工程

- 竞品逐个拆解（Hevy / Fitbod / Boostcamp / Strong / JEFIT）：功能 × 定价 × **评论差评点**，找定位缝隙。
- 写死英文定位陈述 + 一句话价值主张 + 3 个核心卖点（差异化 = **会解释自己的循证教练**：readiness、自动计划调整、每周引证行动、e1RM 趋势与数据质量提醒——对手要么只是 logger，要么是黑箱 AI）。
- 外部英文落地页 + 邮件 waitlist + **烟雾测试 paywall**（放真实价格按钮，量点击/留资转化）。该落地页不属于本仓库运行面，不能恢复 Web runtime。
- 旧 `/site` 验证入口已随 Web runtime 删除。后续 P0 验证只允许走外部落地页/无代码工具/邮件工具、静态 iPhone mock、demo video 或人工访谈。
- 用静态英文分享卡 mock 验证传播资产:Muscle Level、Level Up、PR、Balance Improvement、Plan/Routine Card。目标不是先做社交功能,而是验证美国 lifter 是否愿意晒、愿意点、愿意导入。
- 不在 P0 投入旧 App 英文化或 TestFlight。P0 只验证需求、价格、传播资产和招募质量。
- **Gate**：waitlist 量级 + paywall 点击率 + 访谈质量 + founder beta 愿意尝试/愿付价格达到预设阈值,才进入 P1 clean rewrite。
- *Claude Code brief*：①外部验证网站文案/信息架构/价格意向 CTA;②分享卡静态 mock 与文案变体;③访谈招募和信号表,不接仓库 runtime。

### P1 Clean iOS Rewrite SPEC + 最小训练闭环（W4–W14）— 关键路径 · ✅ 已完成

> **现状（2026-07-17）**：P1 已完成，产品已扩展到 Rede 1.8 (build 25)、9 个现役本地包和 165 动作目录；1.8 已提交 App Store 审核并处于 Waiting for Review。下方 W4–W14 仅作战略节奏回顾，不再代表当前版本或下一步。
>
> **P1 已完成、R0 已上 TestFlight（2026-06-16，内部测试）。** 原 P1 的 slice 级执行清单（MVP 实现计划）为有界活文档，已按其 §11 收官删除（留痕进 `CHANGELOG.md` 2026-06-16 MVP 达成记录、长期结论回收进本路线图 + 系统逻辑 §10 + PRD、git 历史可恢复）。后续由 [`docs/REDE_PRD.md`](docs/REDE_PRD.md)（产品需求真源，FR 优先级与发布映射见其 §5/§8，R0 = 已交付范围）+ 基于 PRD 的开发规划接棒。

- 把 `docs/REDE_iOS_SYSTEM_LOGIC.md` 拆成 rewrite parity slices:四 tab、专注训练、DataHealth、TrainingDecision、write path、fixtures、UI验收。
- 只实现最小可卖/可验证闭环:Today 决策入口、专注训练记录、下一组建议、训练完成写入、Progress 可信反馈、Plan 只读未来安排。
- 动作库、TemplateGenerator、器械校准、SessionPrescription、Warm-up、SupportAllocation、MuscleLevelEstimator 和 ShareSnapshot 按系统逻辑合同逐片建立 fixtures 和 Swift tests。
- 旧 `ios/` 代码只能作为 reference inventory;任何复用必须经过 slice review,不得整包搬运。
- **Gate**：clean runtime 能完成一场真实训练并给出可信进展反馈;核心 packages 有 fixtures/goldens;Xcode build 和 Swift tests 通过;人工可演示。
- *Claude Code brief*：①rewrite SPEC / slice queue;②Domain/DataHealth/TrainingDecision/Persistence 最小骨架;③Today + 专注训练 + Progress 最小 UI;④fixtures/goldens 和质量门禁。

### P2 商业化地基（W10–W20）— 关键路径

- **订阅基础设施（2026-07-18 基础 runtime 已落地，production fail-closed）**：StoreKit 2 位于薄 `RedeEntitlements` seam 后；Apple 已验证 current entitlement 是唯一付费真相，月/年同一 access tier，显式恢复，价格/试用/条款完全取 StoreKit 本地化值。当前 production product IDs 与 paid-capability flag 故意为空；首片不接 RevenueCat、不建账号/服务器、不持久化 entitlement、不接远程 analytics；RevenueCat 只在跨平台、账号支持、webhook、客服后台或订阅分析成为真实需求时重开评估。
- **可见备份 / 导出**：canonical JSON 原样导出已随 1.8 实现；独立备份仍是后续信任切片。
- **账号 + Auth gate**：设计 Sign in with Apple / Supabase Auth 的用户生命周期、删号、恢复购买关联和隐私边界;通过 Master Architecture 后再实现。
- **云同步 gate**：设计 local-first + opt-in 同步、source-of-truth、冲突合并、备份先于覆盖和 CRDT/记录粒度;通过 Master Architecture 后再实现,不得在 P2 偷跑网络或云端权威真相。
- **埋点（独立 gate）**：激活、留存、trial-start、trial-convert、churn 的观测方案必须在软启动前成立，但远程 analytics 不得夹带进首个 StoreKit 实现切片；先明确最小数据、隐私披露与退出边界。
- **Gate**：StoreKitTest + Sandbox/TestFlight 证明购买、pending、续订/grace、过期、退款/撤销、恢复、重装/换设备和离线；商品目录/权益未知时 1.8 Free Core 完整可用；本地数据可导出。账号/云同步/远程分析不阻塞首个收费闭环。
- *剩余实现 brief*：①在 PRD 批准首个 1.8 之后的 paid 能力；②修复/换环境跑通现有 `SKTestSession` 全生命周期测试；③再配置 App Store Connect 单一 subscription group、真实月/年商品与可打开的 Privacy Policy / Terms of Use，走 Sandbox/TestFlight；④通过前保持 production purchase gate 关闭；⑤分析、账号、云同步各走独立 gate。

### P3 英文化 / 合规 / iOS 上架就绪（W12–W24）— 与 P2 并行

- Swift locale 基础设施,key 化 clean runtime 文案。
- **证据/教练/定义/professional copy 专业英文重写**（母语级、Apple/Things 调性，**严禁机翻**——这是差异化护城河）。
- 英文 onboarding，围绕"循证教练"卖点设计首启。
- App Store 商店页文案 + 截图 + **英文 ASO** 关键词。
- **HealthKit 权限 / 观测事实 / HealthContext gate**（native 才能做）——先服务 Progress / dataQuality 解释;影响 readiness 或 Scheduler 前必须有 Master-approved engine-input slice。
- App Store Connect 配置、**隐私营养标签**、健康/医疗**免责**（守住 fitness 定位）、订阅产品配置。
- 合规：隐私政策、ToS、GDPR/CCPA、（若用第三方 AI 处理用户数据需**显式披露+同意**）。
- **Share Card MVP**：实现本地 `ShareSnapshot`、`SharePrivacyFilter`、Workout / Muscle Level / Level Up / PR / Balance 卡片渲染和 iOS Share Sheet。不得引入账号、云端个人页、公开 feed、远程归因或 HealthKit 原始数据分享。
- TestFlight 公测 → 修 → 提审 → 过审。
- **Gate**：价值面（证据/教练解释）英文达母语级,由英文母语 lifter 验收;拿到 App Store 批准 build。
- *Claude Code brief*：①i18n 基础设施 + clean runtime key 提取；②英文内容文件骨架与人工校对流程；③HealthKit authorization / HealthObservation / HealthContext gate 设计；④App Store Connect 元数据/隐私标签清单；⑤订阅产品与 paywall 联调 gate；⑥本地分享卡 MVP。

### P4 软启动 + 冷启动获客（W18–W26）

- **软启动**小英文区（加/澳/新西兰），低 CAC 调 onboarding→trial→convert 与 ASO。
- 冷启动渠道（**以 organic/content 为主**，市场 UA 成本在涨、赢家通吃）：Reddit 健身社区、Product Hunt、健身 YouTuber/IG、**循证内容 SEO（直接复用你的证据库做内容护城河）**、申请 App Store featuring。
- 分享增长回路:完成训练、肌群升级、PR、均衡度改善和计划确认后,推动用户生成隐私安全分享卡;每张卡带 Rede 品牌和通用下载/landing link。第一轮只看 share sheet 打开率、用户主动反馈、落地页点击和 beta 招募效果,不假装已有精确归因。
- paywall / 定价 A/B、漏斗优化。
- **Gate**：trial→paid ≥ 行业中位（见 §5）且 D30 健康。

### P5 留存 + 增长 + 放量（W24+）

- 留存闭环：**每周教练行动 = 天然召回钩子** + push + 适度 streak；referral；win-back。
- 若 S0 分享卡证明有效,再进入 S1/S2:导入型 Plan/Routine 分享、referral/deferred deep link、安装归因和 share -> paid 漏斗;公开 feed / challenge / 排行榜只有在分享带来留存和付费后才评估。
- 放量美区/英区；年订主推；定价持续优化。
- 固化指标复盘 SOP（周/月）。

---

## 4. 定价与打包建议（基于竞品调研）

### 竞品价格地图（定价 Gate 前必须刷新，USD）

下表是用于定位和价格锚的研究快照,不是永久价格真相。进入 paywall / 订阅产品配置前,必须重新核验竞品价格、Apple 费率、外链支付政策和 App Store Review Guidelines。

| App | 定位 | 月 | 年 | 备注 |
|---|---|---|---|---|
| StrongLifts 5×5 | 新手程序 | — | 免费为主 | 入门 |
| Strong | 干净手动 logger | ~$4.99 | ~$120 | 老牌但只是 logger |
| **Hevy** | logger + 轻 Trainer | $2.99 | **$23.99**（含 lifetime $74.99） | **价值领头羊**；Trainer 做自适应/自动加重/换动作，但深度浅 |
| JEFIT | 程序 + 分析 | $12.99 | $69.99 | 中段 |
| Boostcamp | 程序库 | $11.99 | $79.99 | 程序导向 |
| **Fitbod** | AI 自动生成训练 | $15.99 | **$95.99** | **付费天花板**，黑箱 AI，是你最近的定价锚 |

### Rede 定价主张

- **定位**：在 Hevy（$24/yr 的 logger+轻 trainer）**之上**，对标/超越 Fitbod（$96/yr 黑箱 AI），卖点 = **"会解释自己的循证教练"**。
- **待验证价格假设，不是已批准商品配置**：年订 **$59.99–$69.99**、月订 **$9.99–$11.99**、**14 天试用**；创建 App Store Connect 商品前必须刷新竞品、Apple 当前政策和试用证据。同一 subscription group 的月/年商品提供同一 `paidCoach` access tier；App 内只显示 StoreKit 返回的 storefront 本地化价格、资格与续订条款，绝不硬编码这些美元假设。
- **免费/付费分界（方案 A，2026-07-17 已拍板）**：Rede 1.8 已有能力全部继续属于 Free Core——现有 readiness 判断/解释、训练处方与记录、计划查看/自动调整/编辑、进展/e1RM/数据质量/肌群等级、本地导出和现有分享卡均不得回收收费。首个获批 post-1.8 Paid Coach 能力为 **每周教练复盘（FR-SUB3）**：只新增跨周事实的单一判断、可核对依据与行动编排，不锁底层数据或入口。后续更长周期洞察、自动周行动、计划适配/导入仍只是候选，不因写在 Roadmap 就获得实现授权。安全、核心训练/记录、canonical 保存、数据读取/导出、隐私控制永不收费。Future Trust Infra 继续单独 gate。
- **苹果经济学**：首发默认走 StoreKit IAP 和 App Store 合规 paywall。Small Business Program 资格、Apple 费率、外链支付政策和地区差异必须在订阅产品配置前按 Apple 当前规则和法律意见刷新;不要把外链绕抽成当作首发策略。

### 首个 Paid Coach Decision Gate（2026-07-18）

每周教练复盘专家判断 **80/100**（用户价值 17/20、差异化 18/20、技术可行性 19/20、风险与可逆性 13/15、真实付费证据 7/15、测量准备度 6/10），高于 70 分开发线；付费证据仍为 E0/E1，因此只授权本地产品开发和受控测试，不授权 production paywall。发布前产品门槛：固定任务可用性测试至少 6/8 用户能无帮助复述主判断并完成行动，且无人把观察误解成医学/确定因果；技术门槛为场景 fixtures 全绿、Free Core 零回归、Simulator 中英/权益矩阵通过。若用户认为只是免费统计换壳、超过 25% 测试者误解结论，或主要活跃用户长期无法获得可靠复盘，则停止收费包装并回到证据验证。

---

## 5. 北极星与关键指标

- **北极星**：每周完成 **≥2 次有记录训练且看到 ≥1 条教练行动** 的活跃用户数（同时抓留存 + "差异化价值被感知"）。
- **漏斗**：激活（首训练 + 首次看到教练行动）→ W1/W4 留存 → 试用开启率 → **试用转付费（目标 ≥ 行业中位 39.9%，争 top decile 68.3%）** → D30 / 年留存（行业年订留存约 33%）→ ARPI / LTV vs CAC。
- **分享漏斗**：S0 只看本地链路:share entry shown → share preview opened → share card generated → share sheet presented → share payload exported,再用落地页/App Store 外部点击做粗估。S2 后才允许进入 referral attribution:landing/App Store click → install → first workout → trial → paid。
- 行业参考：健康健身类 60 天 median ARPI ≈ $0.63；市场 2025 比 2024 多 31% 订阅 App 上线、单 App 月均收入降 22%、UA 涨——**所以靠内容/organic，不靠烧量**。

---

## 6. 风险与"不要做"清单

- **不要**把产品定位成 medical（触发 Apple 监管证明要求）——继续守 "训练决策支持，非医疗诊断"。
- **不要**机翻证据/教练内容（直接毁掉差异化护城河）。
- **不要**在验证前就建完整云同步冲突合并（最贵、最易返工）——首个收费闭环先用 local-first + 导出/备份;云同步另过 architecture gate。
- **不要**美区冷启动首发（CAC 最高、最不容错）——先小英文区软启动。
- **不要**把"免费"当默认锚（D 方案的坑：后加墙易反弹）。
- **不要**第一版就做公开 feed、好友图谱、地区排行榜或自动发布。分享系统先做外部平台传播资产,等数据证明有效再扩展。
- **依赖警示**：订阅、英文化、合规和 App Store 上架在首发关键路径上;账号+云同步是高价值后续地基,但不得被误写成订阅硬依赖。

---

## 7. 当前下一步（2026-07-18）

P0/P1 的验证与 clean rewrite 清单已成为历史；Rede 1.8 (25) 已提交 App Review。P2 的 production-disabled subscription foundation 与非交易 Rede Coach 页面壳已实现。页面壳可以先存在，但不得在没有真实 paid 产品价值和真实商店证据时把它变成空 paywall：

1. 按已批准 FR-SUB3 实现首个 **1.8 之后新增**的 Paid Coach 能力“每周教练复盘”；V1 纯派生、只导航、不自动改计划，Free Core 回归与 Simulator 验收是完成门槛。
2. FR-SUB3 完成 package/app/Simulator 验收后，才把这一项真实权益填入现有 StoreKit 页面；不得为了填满页面临时复用 1.8 免费能力。production fail-closed 配置继续保留。
3. 解决 Xcode 26.6 / iOS 26.5 Simulator `SKTestSession` 的 `SKInternalErrorDomain Code=3`，或在另一套可复现 Xcode/Simulator 环境跑通仓库已有的购买、取消、pending、验证失败、续订、grace、过期、退款/撤销和恢复 XCTest；失败不得改成跳过。
4. 创建 App Store Connect 单一 subscription group 的月/年商品前，刷新 Apple 当前政策、Small Business Program 资格、竞品价格和试用证据；product IDs、价格和试用不写成架构常量。
5. 首个 paid 能力真实存在后再打开生产 paywall；配置可点击的 Privacy Policy / Terms of Use（URL 属于发布配置），并用 Sandbox/TestFlight 验证本地化商品、购买/恢复、重装/换设备、离线行为和两条政策目的地；通过前不提交订阅版本。
6. 远程 analytics、账号、云同步继续各走独立 gate，不夹进 entitlement 首片。英文母语复核、隐私政策 / ToS / fitness 免责与 1.8 真机残留验收可并行，不改变主线。

---

*当前最小下一片：实现并验收 FR-SUB3 每周教练复盘；同时在可复现环境跑通现有 StoreKitTest。真实权益、商品与购买控件只在各自门禁通过后逐步填入。*
