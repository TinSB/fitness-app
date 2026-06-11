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
| `equipment` | ✓ | 必须 ∈ 器械注册表（9 类：barbell · dumbbell · cable · plate-loaded · selectorized · bodyweight · assisted · band · kettlebell；MVP 期 `machine` 为 plate-loaded/selectorized 合并档，P1 拆分） |
| `kind` | ✓ | 训练学角色：compound（主项）/ accessory（辅助容量）/ isolation（孤立）——原 `machine` 档改名（schema PR 2026-06-11），器械语义剥离给 `isGuided` |
| `substitutionGroup` | ✓ | 替代族；P1 升一等公民列表（规格 `ExerciseSubstitutionGroup`） |
| `startWeightKg` | ✓ | 目录起步值；口径=系统逻辑 §153（哑铃单只/杠铃总重/配重片读数）；新批次默认带「待真机校准」标签 |
| `loadType` | ✓ | 负重语义注册表内取值：external / bodyweight / bodyweight-plus / assisted / band；**非 external 在引擎支持落地前禁入处方与替换**（匹配层硬过滤，测试看守） |
| `progressionStepKg` | ✓ | 渐进一档（kg）：渐进三分支/疼痛回退/快改档位/取整量子唯一来源（2.5 全局常量已退役）；按器械类给默认，小肌群孤立可 1.25 |
| `isGuided` | 默认 false | 器械轨道稳定（固定轨迹）；目录事实，引擎暂不消费（P1 校准/展示挂点） |
| `replacedBy` | 可空 | 真弃用时的继任指针（历史延续挂点，P1 占位）；仅 deprecated 条目可填，必须指向存在的 id（测试看守） |
| `rank` | ✓ | 匹配优先级（升序）；**匹配 = filter → (rank, id) 排序**，与文件顺序无关 |
| `deprecated` | 默认 false | 弃用不删除 |
| `contraindicationHint` / `evidenceTag` | 可空 | 禁忌提示 / 证据置信标签——schema 已落 Swift 真字段（2026-06-11），P1 wave 填数据 |

**注册表**：器械类 / 场景×器械类矩阵 / 负重语义已升**引擎运行时单一真源**（`EquipmentRegistry`，schema PR 2026-06-11）——EquipmentAccess 白名单、FR-EQ1 软化键、合同测试同源引用，加器械类只改注册表+目录+covered golden 一处 PR。pattern / 肌群注册表仍住合同测试（写错即红），P1 按需升运行时。

## 3. 不可破的行为锁

1. **golden 锁**：目录任何改动跑全量 golden；处方变化必须显式改 golden 留痕。
2. **rank 改动 = 行为改动**：调 rank 等同调产品行为，PR 必须说明理由。
3. **覆盖矩阵 golden**：每个槽位 pattern × 每种器械场景 → 必须有候选；缺口进「已知缺口清单」（golden 锁定）。新增缺口 = 门禁红。
   **当前已知缺口：无**——P0 首跑抓到的 4 条（home-dumbbell 的 knee-flexion×2 /
   push-a 第二平推 / pull-a 第二划船）已由 **wave-1（2026-06-11）** 三条新动作全部清空：
   `db-leg-curl`（哑铃腿弯举）、`db-floor-press`（哑铃地板卧推）、
   `chest-supported-db-row`（上斜凳哑铃划船）——**owner 逐条审定通过
   （2026-06-11，流水线 §4.2 首次执行）**。俯卧撑系 bodyweight，留给
   bodyweight wave（loadType 闸内）。
4. **名字全覆盖**：每条目双语名非空、不回退裸 id（测试锁）。
5. **id 唯一 + 永生**：重复 id / 删除已发布 id = 测试红。

## 4. 填充流水线（P1 起每个 wave 照此走）

1. LLM 生成候选清单（动作 + 字段草稿）——**LLM 不得是动作事实最终来源**（规格红线）
2. owner / 教练身份逐条审定（名称、归类、起步重量、替代族）
3. 校验套件全绿（注册表 / 覆盖矩阵 / 名字 / golden）
4. 按器械类分批入库，**每 wave 一个 PR**，附「重量待真机校准」标签
5. TestFlight 真实反馈回写校准

## 5. 路线

- **P0（本文档落地时）**：JSON 化现有 31 条（1:1 迁移，golden 证明零行为变化）+ rank 匹配 + 名字迁入目录 + 注册表/覆盖矩阵/解码完整性测试套
- **P1（TestFlight 期）**：~~先过 §6.1 Blocker schema PR~~（**已落地 2026-06-11**）→ ~~wave-1 清缺口批~~（**已入库 2026-06-11，3 条，流水线首跑**）→ 批量填到 ~100（9 类器械核心动作）；substitutionGroups 一等公民；machine 拆分 plate-loaded/selectorized（id 原地改字段，§6.1 铁律）；§6.2 Should 第二批逐项拍板
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
| **+`loadType`**（external / bodyweight / bodyweight-plus / assisted / band） | startWeightKg 单 Double 三类破产：bodyweight 会被下限顶成「俯卧撑 2.5kg」伪处方；**assisted 数值=辅助量、越大越轻——疼痛瀑布 −2.5 实为加难度，安全方向反转**；band 无线性 kg。loadType 进引擎前，这三类条目禁止进处方/替换（如实输出 limitation） |
| **+`progressionStepKg`**（per-entry） | 2.5kg 全局常量散在 4 处引擎（渐进/疼痛回退/快改档位/prior 取整）：侧平举 7.5kg 单步 +33% vs 深蹲 +3%；kettlebell 物理规格 4kg、配重栈 5kg——填充时按器械类给默认值 |
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

### 6.2 Should（随 P1 修订案第二批，逐项拍板）

- **吨位口径**：哑铃单只 vs 杠铃总重混加（单臂划船 250 vs 杠铃划船 500 ≈ 等量工作差一倍）——三选一：按器械类分组展示 / +`loadFactor` / 保留裸加但 UI 标注「记录吨位」；小结与进展页同根因一起修
- **substitutionGroup 多隶属**：单值已示弱（窄握卧推锁死肱三族，不能当胸推替补）——升一等公民时定为 `[String]`（首元素=主族，P1 引擎仍只消费主族）
- **换动作后 PR 静默失效**（现行小 bug）：换入动作的 observation id 与处方 id 对不上 → isPR 恒 false——补 replacement 映射 + 测试
- **进展层注入目录只读事实**（kind/equipment 窄投影）：关键动作现=点数最多，100 条目录下趋势主角会被孤立动作抢走；趋势 flat 带宽 2.5kg 绝对值对小动作永远 flat（改相对值）
- **+`plausibleMaxKg` 或器械类系数**：可疑组判定基准 <30kg 不触发——半个目录只剩 400kg 兜底，「侧平举 100kg」永不被标；bodyweight 高 rep 合法场景会被 reps>50 误标
- **+`progressionKey` 预留**（默认=id）：力学等价变体（哑铃/壶铃高脚杯蹲）各自冷启动、趋势分裂——填充准入标准同步写进 §4：等价且口径相同的变体不另立条目
- **prior 取整失真**：7.5×0.5 取整成 5（实际 67% 非 50%）——机制已随 schema PR 落地（取整量子=per-entry 步长）；失真实际消除要等小肌群条目把步长校准成 1.25（wave 填充项）
- **draft 落盘附 catalogVersion**（恢复失败可区分目录漂移 vs 数据损坏，nice 可后置）

### 6.3 二审确认够用（不动）

rank 去顺序化 / id 永生 / 覆盖矩阵 golden 三件套在 ~100 条下结构成立；裁决、Hold、跳过正确地目录盲；PR 按动作自比口径诚实（哑铃 PR 不与杠铃串）。

## 7. 与其它真源的关系

- 引擎合同/槽位规则：系统逻辑文档（本文不改槽位语义）
- 架构边界：Master Architecture（零网络、包内资源 ✓）
- L10n：动作名迁出后，RedeL10n 只管格式与非目录文案；app 层经 LocaleStore 桥接目录名
