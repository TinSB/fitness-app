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
| `kind` | ✓ | compound / isolation / machine |
| `substitutionGroup` | ✓ | 替代族；P1 升一等公民列表（规格 `ExerciseSubstitutionGroup`） |
| `startWeightKg` | ✓ | 目录起步值；口径=系统逻辑 §153（哑铃单只/杠铃总重/配重片读数）；新批次默认带「待真机校准」标签 |
| `rank` | ✓ | 匹配优先级（升序）；**匹配 = filter → (rank, id) 排序**，与文件顺序无关 |
| `deprecated` | 默认 false | 弃用不删除 |
| `contraindicationHint` / `evidenceTag` | P1 启用 | 禁忌提示 / 证据置信标签（规格要求字段，P0 预留） |

**注册表**（pattern / 器械 / 肌群）是封闭集合，住引擎源码；校验测试逐条核对目录，写错即红。

## 3. 不可破的行为锁

1. **golden 锁**：目录任何改动跑全量 golden；处方变化必须显式改 golden 留痕。
2. **rank 改动 = 行为改动**：调 rank 等同调产品行为，PR 必须说明理由。
3. **覆盖矩阵 golden**：每个槽位 pattern × 每种器械场景 → 必须有候选；缺口进「已知缺口清单」（golden 锁定）。新增缺口 = 门禁红；P1 填充的目标就是清空清单。
   **当前已知缺口（P0 首跑即抓到 4 条，后两条人工推演两轮都漏）**：
   - `home-dumbbell × knee-flexion`（legs-a / lower）——哑铃无合理腿弯举
   - `home-dumbbell × push-a 第二 horizontal-press 槽`——家用只有一个哑铃平推候选（P1 候选：哑铃地板卧推/俯卧撑）
   - `home-dumbbell × pull-a 第二 horizontal-pull 槽`——家用只有一个哑铃划船候选（P1 候选：上斜凳支撑哑铃划船）
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
- **P1（TestFlight 期）**：批量填到 ~100（9 类器械核心动作）；substitutionGroups 一等公民；contraindication/evidence 启用；machine 拆分 plate-loaded/selectorized
- **P2（FF）**：几百动作 + 肌群贡献权重（contributionModelVersion）+ TemplateGenerator 按规格消费 `ExerciseCatalogSnapshot`

## 6. 与其它真源的关系

- 引擎合同/槽位规则：系统逻辑文档（本文不改槽位语义）
- 架构边界：Master Architecture（零网络、包内资源 ✓）
- L10n：动作名迁出后，RedeL10n 只管格式与非目录文案；app 层经 LocaleStore 桥接目录名
