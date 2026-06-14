# Rede 动作内容系统（Exercise Content System）

> **定位**：训练内容三层架构（系统逻辑 §三层内容）中 **Catalog 层**的数据合同与扩容操作手册。
> 产品层目标以 `docs/REDE_iOS_SYSTEM_LOGIC.md` 为准；本文管「数据怎么长、怎么校验、怎么批量填充」。
> 拍板：2026-06-11 owner（决策 1 = 包内 JSON + 启动解码 + 校验测试套；决策 2 = P0 现在做）。

- **状态**：Active / 活文档（每个内容批次 wave 必须对照本文执行）
- **登记**：`docs/DOCS_MANIFEST.md` Canonical 表

---

## 1. 为什么（31 个动作时就踩到的天花板）

| 脆弱点 | 后果（300 动作时） |
|---|---|
| first-match 靠目录顺序 | 插一行就静默改变全体用户处方 |
| 动作名 = L10n 手写双语字典 | 600 行字典，漏即显示裸 id |
| 覆盖靠人脑 | FR-EQ1（器械答案被无视）就是 31 条时人工才发现的洞 |
| 无字段校验 | pattern 拼错 = 永远匹配不上且无人知 |

## 2. 数据合同（P0 起生效）

**单一真源** = `ios/packages/RedeTrainingDecision/Sources/RedeTrainingDecision/Resources/exercises.json`，包内打包、启动解码、零网络。

每条动作（Entry）字段：

| 字段 | 必填 | 说明 |
|---|---|---|
| `id` | ✓ | 稳定 kebab-case；**永生不删**——只可 `deprecated: true`（用户历史引用必须永远可解析） |
| `nameZh` / `nameEn` | ✓ | 本地化展示名是**动作事实**（规格原文），不再住 L10n 字典 |
| `movementPattern` | ✓ | 必须 ∈ pattern 注册表 |
| `primaryMuscle` / `secondaryMuscles` | ✓ / 可空 | 必须 ∈ 肌群注册表 |
| `equipment` | ✓ | 必须 ∈ 器械注册表 `EquipmentRegistry.allClasses`（**当前 7 类**：barbell · dumbbell · cable · plate-loaded · selectorized · bodyweight · smith）。**machine 合并档已拆分（2026-06-11，原 id 原地改值）**：plate-loaded=挂片式、selectorized=插销配重栈、smith=史密斯导轨架（wave-8 新增）（步长见 §8 LoadGrid 真实档位）；`assisted`（反向负重）于 wave-9 经 loadType 闸开闸（器械仍走 selectorized）；`band · kettlebell` 仍待对应 loadType 闸放行 |
| `kind` | ✓ | 训练学角色：compound（主项）/ accessory（辅助容量）/ isolation（孤立）——原 `machine` 档改名（schema PR 2026-06-11），器械语义剥离给 `isGuided` |
| `substitutionGroups` | ✓ | 替代族数组（§6.2 落地 2026-06-11）：**首元素=主族**，引擎现仅消费主族（与单值时代行为等价）；副族留给替换候选扩展，填数据须 owner 审定 |
| `startWeightKg` | ✓ | 目录起步值；口径=系统逻辑 §153（哑铃单只/杠铃总重/配重片读数）；新批次默认带「待真机校准」标签 |
| `loadType` | ✓ | 负重语义注册表内取值：external / bodyweight / bodyweight-plus / assisted / band；**非 external 在引擎支持落地前禁入处方与替换**（匹配层硬过滤，测试看守） |
| `loadFactor` | ✓ | 吨位换算系数（owner 拍板 B 案 2026-06-11）：吨位=重量×次数×系数；双哑铃（口径记单只）=2，杠铃/绳索/器械（记总阻力）与单哑铃双手持=1。**只作用于吨位统计——处方/渐进/PR/e1RM 永不乘它** |
| `progressionKey` | 可空 | 力学等价变体共享渐进档案指针（§6.2 占位，默认 nil=各自渐进）；引擎暂不消费 |
| `isGuided` | 默认 false | 器械轨道稳定（固定轨迹）；目录事实，引擎暂不消费（P1 校准/展示挂点） |
| `replacedBy` | 可空 | 真弃用时的继任指针（历史延续挂点，P1 占位）；仅 deprecated 条目可填，必须指向存在的 id（测试看守） |
| `rank` | ✓ | 匹配优先级（升序）；**匹配 = filter → (rank, id) 排序**，与文件顺序无关 |
| `deprecated` | 默认 false | 弃用不删除 |
| `contraindicationHint` / `evidenceTag` | 可空 | 禁忌提示 / 证据置信标签——schema 已落 Swift 真字段（2026-06-11），P1 wave 填数据 |

> **渐进步长不再是目录字段**（2026-06-13）：步长 = 器械×用户单位的真实档位（见 §8 `LoadGrid`），随单位原生档位系统落地，`progressionStepKg` 字段已删除。

**注册表**：器械类 / 场景×器械类矩阵 / 负重语义已升**引擎运行时单一真源**（`EquipmentRegistry`，schema PR 2026-06-11）——EquipmentAccess 白名单、FR-EQ1 软化键、合同测试同源引用，加器械类只改注册表+目录+covered golden 一处 PR。pattern / 肌群注册表仍住合同测试（写错即红），P1 按需升运行时。

## 3. 不可破的行为锁

1. **golden 锁**：目录任何改动跑全量 golden；处方变化必须显式改 golden 留痕。
2. **rank 改动 = 行为改动**：调 rank 等同调产品行为，PR 必须说明理由。
3. **覆盖矩阵 golden**：每个槽位 pattern × 每种器械场景 → 必须有候选；缺口进「已知缺口清单」（golden 锁定）。新增缺口 = 门禁红。
   P0 首跑抓到的 4 条已由 wave-1 清空（db-leg-curl/db-floor-press/chest-supported-db-row，
   owner 审定通过）。**wave-5（2026-06-13）新增「伸膝」动作类后产生 4 条新缺口
   （如实，非 bug）**：`home-dumbbell|legs-a|knee-extension`、`home-dumbbell|lower|knee-extension`、
   `minimal|legs-a|knee-extension`、`minimal|lower|knee-extension`——腿屈伸 leg-extension
   仅选重机器械，家用哑铃/极简场景配不出，无哑铃版可填（区别于耸肩/腹肌有哑铃版无缺口）。
4. **名字全覆盖**：每条目双语名非空、不回退裸 id（测试锁）。
5. **id 唯一 + 永生**：重复 id / 删除已发布 id = 测试红。

## 4. 填充流水线（P1 起每个 wave 照此走）

0. **准入标准**（§6.2 定案）：力学等价且负重口径相同的变体**不另立条目**（防渐进档案分裂）；确需分立的等价变体填 `progressionKey` 指向共享档案。新条目键序照既有模板（id→…→substitutionGroups→…→loadFactor→isGuided→rank），可选字段（deprecated 等）不显式写默认值。**loadFactor 惯例（owner 终审 2026-06-11）**：双哑铃=2；杠铃/绳索/器械/单哑铃双手持=1；**单侧动作=1**（一组=单边记录）
1. LLM 生成候选清单（动作 + 字段草稿）——**LLM 不得是动作事实最终来源**（规格红线）
2. owner / 教练身份逐条审定（名称、归类、起步重量、替代族、**吨位系数**）
3. 校验套件全绿（注册表 / 覆盖矩阵 / 名字 / golden）
4. 按器械类分批入库，**每 wave 一个 PR**，附「重量待真机校准」标签
5. TestFlight 真实反馈回写校准

## 5. 路线

- **P0（本文档落地时）**：JSON 化现有 31 条（1:1 迁移，golden 证明零行为变化）+ rank 匹配 + 名字迁入目录 + 注册表/覆盖矩阵/解码完整性测试套
- **P1（TestFlight 期）**：~~先过 §6.1 Blocker schema PR~~（**已落地**）→ ~~wave-1 清缺口批~~（3 条）→ ~~§6.2 Should 第二批~~（loadFactor/多隶属数组等八项）→ ~~wave-2 四器械类核心补全~~（**已入库 + owner 审定通过 2026-06-11，15 条 → 49 条**：rank 全尾部追加=处方零变化；随批定案：db-pullover 留垂直拉族、hip-thrust 归铰链族、直臂下压独立孤立族不当复合替补）→ ~~wave-3 五器械类补全~~（**已入库 + owner 审定通过 2026-06-13，12 条 → 61 条**：各族薄弱处补真实动作，rank 全尾部追加=处方零变化；审定随批定：肩推统一 shoulder 口径、T 杠划船不固定轨道、cable-pull-through 改 accessory）→ ~~wave-4 五器械类补全~~（**已入库 + owner 审定通过 2026-06-13，12 条 → 73 条**：常见变体补族厚度，rank 全尾部追加=处方零变化；审定随批定：下斜卧推归水平推变体、地雷推举照 T 杠先例归 plate-loaded、相扑硬拉主肌群 glutes）→ ~~wave-5 新动作类~~（**已入库 + owner 审定通过 2026-06-13，6 条 → 79 条 · 行为变化**：腿屈伸/耸肩/腹肌三个新 pattern + 新槽位——腿日加腿屈伸+卷腹、拉/上肢日加耸肩，goldens 已改留痕；审定随批定：腹肌放腿日末尾 1-2×/周、耸肩在拉日+上肢日）→ ~~wave-6 自重引擎开闸~~（**已入库 + owner 审定通过 2026-06-13 · 行为/引擎**：loadType=bodyweight 开闸——按次数进阶、到 25 次提示换难度、重量恒 0；+6 徒手动作；家用/极简场景加 bodyweight；今日页展示改次数。**遗留**：完整「按次数调整」train 交互留作后续 UI 片；bodyweight-plus/assisted/band 仍闸内）→ ~~wave-7 挂片式 Hammer 器械~~（**已入库 + owner 审定通过 2026-06-13，6 条 → 91 条**：悍马卧推/上斜悍马/悍马划船/悍马下拉/悍马肩推/钟摆深蹲，商业房常见挂片式器械，rank 尾部追加=处方零变化，丰富商业用户换动作列表）→ ~~wave-8 史密斯机整类~~（**已入库 + owner 审定通过 2026-06-13，6 条 → 97 条**：新增 `smith` 器械类 + 史密斯深蹲/平板卧推/上斜卧推/肩推/站姿提踵/耸肩；商业房通用导轨架此前零覆盖。rank 920-970 尾部追加=处方零变化，仅进替换候选；`smith` 同入 `machineClasses`（导轨=固定路径站，合同「guided ⟹ 固定器械类」自洽——腿日固定器械深蹲槽从此认史密斯深蹲为候选，rank 最高不抢默认）；档位同杠铃 2.5kg/5lb；场景闸未改=家用/极简自动挡掉、商业房放行。审查随批清：提踵/耸肩起始重量对齐 sibling、补家用排除断言）→ ~~wave-9 辅助器械「反向负重」引擎~~（**已入库 + owner 审定通过 2026-06-14 · 引擎/行为**：`loadType=assisted` 开闸——配重越重越轻松，**安全方向整体反转**单独一条引擎路径：进阶=减辅助、力竭/喊疼/调制=加辅助、新手冷启动放大、到底毕业自动换自重孪生；辅助量不进吨位/PR/e1RM；+1 条辅助引体（selectorized + assisted + 族 vertical-pull）。**配套 sticky swaps**（plan() 对当日唯一 pattern 槽优先「上次实际做的动作」）让进阶经今日页可达、所有换动作跨天粘住、5 golden 零漂移。**配套显示层**（今日页+训练流「辅助 N」前缀 + 表头「辅助」标列 + 「少帮/多帮」档位 + 毕业提示，模拟器实拍验证）。三片各自独立 commit + 全程 TDD（AssistedEngineTests 9 + StickySwapTests 5）+ 两轮独立审查 0 BLOCKER。**仍 latent**：assisted 首练按背景缩放（首次换入用默认值）；bodyweight-plus/band/kettlebell 仍闸内）→ ~~wave-10 内容补全~~（**已入库 + owner 审定通过 2026-06-14，7 条 → 105 条**：多 agent gap-survey 后定批——**辅助双杠臂屈伸(assisted)+双杠臂屈伸(bodyweight)**完成 owner 原始诉求并走「辅助→自重」毕业阶梯（归 triceps-extension/族 triceps，给三头线补自重档）、单腿腿屈伸+悍马腿屈伸（伸膝 1→3）、悍马腿弯举、绳索耸肩、反握引体。全 rank 990-1050 尾挂=处方零变化、5 golden 零漂移；审查随批补 triceps 替换候选快照。**目录破 100**）→ 后续：bodyweight-plus 引擎（负重引体/双杠）+ 髋外展/内收/罗马椅（需加日程槽，独立立项）；~~machine 拆分~~（**已落地 + owner 审定通过 2026-06-11**：9 条原 id 原地改值——plate-loaded 3 条/selectorized 6 条；槽位器械偏好升类集合匹配；行为零变化 golden 实证）；bodyweight/band/kettlebell 类各有前置闸
- **P2（FF）**：几百动作 + 肌群贡献权重（contributionModelVersion）+ TemplateGenerator 按规格消费 `ExerciseCatalogSnapshot`

## 6. P1 schema 修订案（2026-06-11 二审定案——wave 填充的前置闸）

> 来源：全引擎决策消费矩阵 + 刚性/冲突二审（13 条决策路径逐一对照）。
> 结论：P0 字段对「选动作」（槽位/替换/命名/弃用）够用；**「重量语义」轴在
> bodyweight / assisted / band 三类上整体破产**——以下 Blocker 不先落地，
> 第一个含这三类的 wave 就是 100 条重审 + 安全事故。

### 6.1 Blocker（先于任何 wave，一个 schema PR 拍掉）——**已落地 2026-06-11（catalogVersion mvp-2）**

> 落地形态备注：kind 第三档实测承载「主项 vs 辅助容量」真实角色语义
> （hack-squat=compound vs leg-press=accessory），故采用**值改名 machine→accessory**
> 而非二审原案的二分收敛；轨道稳定性独立为 `isGuided`。软化键照原案改拴
> `EquipmentRegistry.machineClasses`。行为零变化由全量 golden 未改全绿证明。

| 修订 | 为什么是 Blocker |
|---|---|
| **+`loadType`**（external / bodyweight / bodyweight-plus / assisted / band） | startWeightKg 单 Double 三类破产：bodyweight 会被下限顶成「俯卧撑 2.5kg」伪处方；**assisted 数值=辅助量、越大越轻——疼痛瀑布 −2.5 实为加难度，安全方向反转**；band 无线性 kg。**进展：external（P0）+ bodyweight（wave-6，按次数进阶）+ assisted（wave-9，反向负重——进阶=减辅助、缓降=加辅助、毕业换自重）已开闸；bodyweight-plus/band 仍闸内** |
| ~~+`progressionStepKg`（per-entry）~~ → **2026-06-13 升级为 `LoadGrid`（器械×单位真实档位）** | 初版 per-entry 步长解决了「全局 2.5 一刀切」，但仍是单位无关纯 kg 步长。owner「宁大勿小」拍板后升级单位原生真实档位（§8）：磅落 5lb、公斤 2.5kg；字段删除，步长由器械类决定 |
| **kind 拆轴**：kind 收敛 {compound, isolation} + 新增 `isGuided`（轨道稳定性） | "machine" 既是训练学角色又是器械名；FR-EQ1 软化逻辑 key 在字符串 "machine" 上——machine 拆 plate-loaded/selectorized 后软化失明、槽位字面量悬空；100 条按旧 kind 填完即返工 |
| **场景 × 器械类可用性矩阵升单一真源**（器械注册表进引擎运行时，EquipmentAccess 从它派生） | 注册表现仅住测试；白名单/槽位/软化三处散落字面量。**致命咬合：§3 缺口药方「俯卧撑清 home 缺口」会被 dumbbell-only 白名单直接滤掉——不改矩阵，缺口清单一条都清不掉** |
| **id 演化铁律**：machine 拆分 = 原 id 原地改 equipment 值，**禁止弃用+新 id**；预留 `replacedBy` | 渐进历史按 id 查——换 id = 全体器械动作用户力量记录静默归零（80kg 器械推胸变回首练定档） |
| **`contraindicationHint` / `evidenceTag` 真字段** | §2 已承诺 P1 启用，Swift struct 缺位——wave 数据没有归宿 |

**assisted（反向器械）记录口径**（owner 质询 2026-06-11 定案）：

- **方向固定在目录**：越加越轻是动作固有事实（`loadType: assisted`），一次定死——不进用户数据、不可配置、引擎不猜
- **数字原样记机器读数**（辅助配重 kg）。否决两案：换算「有效负荷」（依赖体重、随体重漂移、与机器读数对不上）；存负数（吨位/e1RM/键盘/可疑组处处漏）
- **解释全在引擎按 loadType 翻转**：进步=辅助下降、疼痛/力竭=辅助增加、PR=辅助新低、趋势方向反读、不进吨位裸加与 e1RM（如实 limitation）
- **显示带「辅助」前缀**（"辅助 20kg"），渐进文案同语义（"辅助 20→17.5 · 进阶"）
- **毕业=换动作不换数轴**：辅助引体→自重引体→负重引体 = 三条目（assisted/bodyweight/bodyweight-plus）同替代族，单条目数轴永远单调不跨零
- 待拍板小项：assisted 首练定档规则（新手先验=加多少辅助）——schema PR 已落地，此项随 assisted 首个 wave 拍（loadType 闸保证此前零运行时影响）

### 6.2 Should 第二批——**已落地 2026-06-11（catalogVersion wave-1.1）**

- ~~吨位口径~~：**owner 拍板 B 案 = +`loadFactor`，系数表终审通过（2026-06-11）**。小结与进展页同步乘系数（同根因一起修 ✓）；PR/e1RM/处方永不乘。终审口径：双哑铃=2（12 条）、杠铃/绳索/器械=1、单哑铃双手持=1、**单侧动作=1（owner 惯例：一组=单边记录）**
- ~~substitutionGroup 多隶属~~：`substitutionGroups: [String]` 落地，首元素=主族、引擎仅消费主族（行为等价，golden 未动）；副族填数据留给后续 wave（owner 审定）
- ~~换动作后 PR 静默失效~~：修复——换入动作只和**它自己的历史**比（SessionStore 注入 overrides；无历史=保守不发奖，与首练同口径）；绝不和被换走动作的历史比
- ~~进展层注入目录只读事实~~：`ExerciseStatsFacts` 窄投影（loadFactor/isCompound，app 层注入，进展包不依赖决策包）；关键动作复合优先（深蹲 2 点压过侧平举 4 点）；趋势带宽改相对值 max(1.25, 首点 e1RM×3%)
- ~~plausibleMax~~：动作级合理上限落地（投影=起步值×6、下限 60、全局 400 兜底——待校准启发值）；「侧平举 100kg」现在会被标；reps 阈值分档留给 bodyweight wave
- ~~progressionKey 预留~~：字段占位落地 + §4 准入标准（等价变体不另立条目）
- ~~prior 取整失真~~：档位系统（§8）定案——「宁大勿小」下哑铃无 1.25kg 微调档，小肌群孤立动作就走 2.5kg/5lb 真实档（取整量子=器械真实档位），先验在真实格子上取整即正确
- ~~draft 落盘附 catalogVersion~~：落地（旧 draft 解码兼容，恢复失败可区分目录漂移 vs 数据损坏）

### 6.3 二审确认够用（不动）

rank 去顺序化 / id 永生 / 覆盖矩阵 golden 三件套在 ~100 条下结构成立；裁决、Hold、跳过正确地目录盲；PR 按动作自比口径诚实（哑铃 PR 不与杠铃串）。

## 7. 与其它真源的关系

- 引擎合同/槽位规则：系统逻辑文档（本文不改槽位语义）
- 架构边界：Master Architecture（零网络、包内资源 ✓）
- L10n：动作名迁出后，RedeL10n 只管格式与非目录文案；app 层经 LocaleStore 桥接目录名

## 8. 器械真实档位系统（LoadGrid，owner 拍板「宁大勿小」2026-06-13）

> **问题**：内部用公斤当真值、磅纯换算 → 22.5kg 显示 49.5lb，没有任何哑铃能配出。
> **铁律「宁大勿小」**（owner）：档位宁可粗——给粗了用户能找到对应器械配出；给细了
> （如 2.5lb）他健身房没有，记录就和现实对不上。
> **架构 = 单位原生**：磅用户重量真住 5lb 格子（45/50/55…，引擎每步加 5lb），公斤用户
> 住 2.5kg 格子；底层恒存公斤。实现：引擎按 stepKg 取整即吸附，步长换成器械×单位真实档位。

| 器械类 | 磅档位 | 公斤档位 | 依据 |
|---|---|---|---|
| barbell | 5 lb | 2.5 kg | 标准片 2×2.5lb / 2×1.25kg |
| dumbbell | 5 lb | 2.5 kg | 商用架 5lb / 2.5kg 步进 |
| plate-loaded | 5 lb | 2.5 kg | 奥林匹克片对称加载 |
| cable | 5 lb | 2.5 kg | 10lb 栈×2:1 滑轮=手上 5lb 实际 |
| selectorized | 10 lb | 5 kg | 裸配重栈整片（宁大勿小：加片销不一定有） |

**规格来源**（2026-06-13 多 agent 网络调研，带 URL 存 DEV_LOG）：哑铃 Rogue/REP 固定架
+ Bowflex/PowerBlock；杠铃片 IWF TCRR 2020 + 美制 Rogue/Eleiko；选重栈 Life Fitness/Cybex；
绳索 2:1 滑轮。

**单位接线**：canonical `userProfile.unitSystem` → CleanProfile → 引擎 `LoadUnit`；缺失/未知
→ kg（既有 golden 与无偏好用户口径，零行为变化）。

**落地影响**：公斤自由重量零变化（全量 golden 未改）；公斤选重机 3 条
（machine-chest-press/leg-curl/calf-raise）步长 2.5→5（宁大勿小，goldens 留痕）；磅用户
全链路落 5lb 真实格子。待真机校准：各器械起步重量、可调哑铃轻段 2.5lb 微调是否启用。
