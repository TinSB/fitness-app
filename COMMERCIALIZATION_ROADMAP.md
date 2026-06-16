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
| iOS 原生 | 产品系统逻辑、训练决策合同、设计语言和文案基线已明确;干净 iOS 实现已是活跃实现,旧 IronPath/PWA 代码已退役（git tag `legacy-parity-final`） | ✅ **R0 已上 TestFlight（2026-06-16，内部测试）**。clean rewrite 已实现 Today / 专注训练 / Progress / Plan 占位 / 引导 / 设置最小闭环（见 MVP §9，M0~M5 全 ✅，M6-4 🟡 已上传内测、阻塞全解除，版本 0.1.0）;距 R0 收官仅剩 §1 八条真机验收 owner 确认。下一阶段 → P0 需求验证 + 收 beta 反馈 |
| 账号 + Auth | 无 first-version runtime；iOS 原生方向保留在 `docs/REDE_REBUILD_00_IRONRULES_AND_CLOUD.md` 与 `docs/CLOUD_DECISIONS_ARCHIVE.md` | **近 greenfield**。服务 opt-in 云同步、跨设备恢复和账号级支持;不阻塞首个 App Store 订阅闭环 |
| 云同步 | 无 first-version runtime；已拍板方向是 local-first + opt-in + CRDT 记录级合并 | 未实现。offline-first 冲突合并是最贵、最容易返工的一块;进入实现前必须先通过 Master Architecture gate |
| 订阅基础设施 | 0 | StoreKit 2 / RevenueCat / 权益门禁 / paywall / 试用 / 恢复购买全部从零。App Store entitlement 可以先与一方账号解耦;账号只增强跨设备和支持体验。任何 StoreKit/RevenueCat/收据校验/权益持久化实现前都要先同步 Master Architecture |
| 英文化 | 产品文案方向已定义;双语 key 化基础设施与中英切换已建立（`RedeL10n` + `LocaleStore`，M0-3/M5-2），UI 文案全部 key 化 | **被低估的大头**。基础设施已就位;真正的难点仍在**证据/教练解释文案**——你的差异化所在,必须专业英文重写（非机翻），公开上架前由英文母语 lifter 审校 |
| 合规 | README 已坚持"训练决策支持，非医疗诊断" | 隐私政策 / ToS / 隐私营养标签 / 医疗免责 / GDPR·CCPA / 第三方 AI 数据披露 待补。**务必守住 "fitness 不是 medical" 定位**，否则触发 Apple Guideline 1.4.1 的监管证明要求 |
| 获客 / 增长 / 数据 | 无 approved runtime analytics;官网验证可在外部工具中进行 | 定位、ASO、冷启动渠道、漏斗埋点全空白 |
| 分享 / 增长资产 | 系统逻辑已确定 Share / Growth System; native share snapshot/card renderer 尚未实现 | 官网阶段用静态 mock 测传播兴趣;第一版 App 用本地分享卡 + iOS Share Sheet。账号、feed、归因、公开主页后置到架构 gate |

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
| **P1 Clean iOS Rewrite SPEC + 最小训练闭环** ✅ 已完成、R0 已上 TestFlight | W4–W14（已过） | 把系统逻辑切成可验证 rewrite slices,实现 Today / 专注训练 / Progress 最小闭环 | ✅ 已达成（M0~M5 全 ✅，M6-4 🟡 已上传 TestFlight 内测、阻塞全解除）：clean runtime 有真实训练闭环、fixtures、Swift tests 和可演示 UI;距 R0 收官仅剩 §1 八条真机验收 |
| **P2 商业化地基** | W10–W20 | 订阅+权益+埋点+基础备份/导出;账号/云同步完成 gate 设计 | 能收费 + 本地数据可带走 + 能测漏斗 |
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

### P1 Clean iOS Rewrite SPEC + 最小训练闭环（W4–W14）— 关键路径 · ✅ 已基本完成

> **现状（2026-06-16）**：P1 关键路径走完，**R0 已上 TestFlight（内部测试）**——MVP 闭环 M0~M5 全 ✅ 验收（版本 0.1.0，7 个干净包带测试，动作库已扩至 123 条 wave-15）；M6-4 🟡 已上传内测、阻塞全部解除（签名通 + widget bundle id 修 #546 + GitHub 解禁），距 R0 收官仅剩 §1 八条真机验收 owner 确认。下方周数 W4–W14 已成历史，本节作战略节奏回顾保留。
>
> **P1 的 slice 级实现执行清单见 [`docs/REDE_MVP_IMPLEMENTATION_PLAN.md`](docs/REDE_MVP_IMPLEMENTATION_PLAN.md)**（已锁定决策基线:TestFlight 免费先行 + 纯核心训练闭环 + 中英双语）。本节是战略节奏,具体实现、slice 顺序、验收与上线 gate 以该文档为准并双向同步。该文档为**有界活文档**:MVP 经用户确认达成后留痕进 CHANGELOG、回收进 canonical docs、解除登记并删除;后续由 [`docs/REDE_PRD.md`](docs/REDE_PRD.md)(产品需求真源,已建,FR 优先级与发布映射见其 §5/§8) + 基于 PRD 与 MVP 完成度的开发规划接棒。

- 把 `docs/REDE_iOS_SYSTEM_LOGIC.md` 拆成 rewrite parity slices:四 tab、专注训练、DataHealth、TrainingDecision、write path、fixtures、UI验收。
- 只实现最小可卖/可验证闭环:Today 决策入口、专注训练记录、下一组建议、训练完成写入、Progress 可信反馈、Plan 只读未来安排。
- 动作库、TemplateGenerator、器械校准、SessionPrescription、Warm-up、SupportAllocation、MuscleLevelEstimator 和 ShareSnapshot 按系统逻辑合同逐片建立 fixtures 和 Swift tests。
- 旧 `ios/` 代码只能作为 reference inventory;任何复用必须经过 slice review,不得整包搬运。
- **Gate**：clean runtime 能完成一场真实训练并给出可信进展反馈;核心 packages 有 fixtures/goldens;Xcode build 和 Swift tests 通过;人工可演示。
- *Claude Code brief*：①rewrite SPEC / slice queue;②Domain/DataHealth/TrainingDecision/Persistence 最小骨架;③Today + 专注训练 + Progress 最小 UI;④fixtures/goldens 和质量门禁。

### P2 商业化地基（W10–W20）— 关键路径

- **订阅基础设施**：StoreKit 2 + **RevenueCat**（权益、收据校验、试用、恢复购买）+ paywall + 门禁。首版可以使用 App Store entitlement 作为付费真相,不要求一方账号先落地;真正接 StoreKit / RevenueCat SDK / 远程收据校验 / 权益持久化前,必须先通过 Master Architecture gate,不得直接改依赖或引入网络。
- **可见备份 / 导出**：先让用户确认本地数据能带走,避免 local-first 被误解为"丢了就没了"。
- **账号 + Auth gate**：设计 Sign in with Apple / Supabase Auth 的用户生命周期、删号、恢复购买关联和隐私边界;通过 Master Architecture 后再实现。
- **云同步 gate**：设计 local-first + opt-in 同步、source-of-truth、冲突合并、备份先于覆盖和 CRDT/记录粒度;通过 Master Architecture 后再实现,不得在 P2 偷跑网络或云端权威真相。
- **埋点**：激活、留存、trial-start、trial-convert、churn 全链路。**上线即埋点，没有数据不谈增长。**
- **Gate**：能收费 + 权益可恢复 + 本地数据可导出/备份 + 漏斗可观测;账号/云同步只完成 architecture gate 和切片计划,不作为首个付费闭环阻塞项。
- *Claude Code brief*：①StoreKit / RevenueCat entitlement architecture gate 与 paywall 门禁设计,通过后再实现；②备份/导出用户可见路径；③分析事件字典与埋点；④账号/云同步 architecture gate 文档与验收切片。

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
- **推荐**：年订 **$59.99–$69.99**、月订 **$9.99–$11.99**、**14 天试用**（向"17–32 天试用转化最高=45.7%"的高转化带靠拢，可 A/B 14 vs 30）。**主推年订**（57% 用户偏好年付，年付 LTV/留存更高）。
- **免费/付费分界**：Free Core 保留核心记录、专注训练、基础进展、本地导出和基础分享卡,确保 ASO 排名、留存和用户信任。Paid Coach 卖当前可解释的教练价值:readiness 解释、自动计划调整、每周引证行动、e1RM 趋势与数据质量提醒（坏数据预警；**不写「置信度」字样**，见 copy §3.4 / §6.2）、肌群等级深度解释和更强计划适配。Future Trust Infra 单独 gate:云同步、账号、HealthKit-derived readiness、远程归因等只有在 Master Architecture 批准且真实实现后才进入包装,不得当作首个订阅闭环的硬依赖。
- **苹果经济学**：首发默认走 StoreKit IAP 和 App Store 合规 paywall。Small Business Program 资格、Apple 费率、外链支付政策和地区差异必须在订阅产品配置前按 Apple 当前规则和法律意见刷新;不要把外链绕抽成当作首发策略。

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

## 7. 未来 30 天立即可做（不依赖工程，你/运营可并行启动）

1. 竞品逐个拆解：Hevy / Fitbod / Boostcamp / Strong / JEFIT 的功能 × 定价 × 差评点 → 一页定位缝隙图。
2. 写定英文定位陈述 + 一句话价值主张 + 3 个核心卖点。
3. 上线并对外投放外部英文落地页 + 邮件 waitlist + **烟雾测试 paywall**（真实价格按钮量转化）；上线前先把表单接到可审计的获客存储或邮件工具，继续保持“不扣费/非真实订阅”的透明文案，不在本仓库恢复 Web runtime。
4. 做 5 张英文分享卡 mock:Workout Summary、Muscle Level、Level Up、PR、Plan/Routine,拿给英文 lifter 看是否愿意晒、愿意点、愿意导入。
5. 在 r/weightroom、r/naturalhypertrophy、r/Fitness 及健身 Discord 招募 20–50 名英文 beta lifter。
6. 起草英文隐私政策 / ToS / 医疗免责骨架。
7. 注册 Apple Developer Program,并在订阅产品配置前核验 **Small Business Program** 资格、当期费率和外链支付规则。

---

*下一步可深入的任一块（按需求展开为可执行方案 / 可交付 Claude Code 的 brief）：P0 验证实验设计、P1 地基技术 brief、定价与 paywall 文案、冷启动渠道 playbook、指标体系与埋点字典。*
