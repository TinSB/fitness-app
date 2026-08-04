# 交接件：进阶闸门修复 + 次数上限延伸（S1 + S3，含验收撤回记录）

> 日期：2026-08-03 ｜ 来源：真实用户反馈（器械侧平举长期卡死）+ owner 观察「小肌群动作进步不了、卧推很快」
> 性质：**处方引擎语义变更**（改加重判定），最高风险类
> 执行：Codex（专家档 gpt-5.6-sol + ultra）｜验收：Claude 主会话（多 lens + 对抗核验）
> 分支：`codex/0803-progression-gate`（基线最新 origin/main `d49e5b1`）

> **2026-08-03 二轮验收后的当前终态**：S1a 保留并新增「全部工作组负荷一致」前置；S1b 保留并排除长间隔回归；S3 曾完整实现，后沿真实 `NextSetEngine` 接缝验证为结构性不可达，现已连实现与专属测试撤回留案；e1RM 改为仅 Progress 展示使用层内最大 Epley，所有等级/里程碑/相对力量/周教练决策继续沿重量优先顶组口径。下文初裁与首轮回执作为可审计历史保留，二轮裁定和终态回执覆盖其运行时结论。

## 为什么（根因，已用代码核实）

用户反馈：器械侧平举练了很久还是 40 lb，一动不动。

四路方案设计 + 三 lens 交叉评审收敛到同一个根因，**且推翻了最初「步长太大」的判断**：

现行加重判据是 `last.minReps >= slot.repMax`——**最差的那一组也要打满次数上限**。侧平举槽位是 12–20 次 × 4 组 × 60 秒休息；末组比首组掉 20–30% 次数是**正常生理**。要求 4 组全部做到 20 次，**这个门在该配置下数学上不可达**。用户不是跳不过那一档，是**永远走不到那一档面前**。

第二层问题才是步长：器械侧平举 = `selectorized`，lb 用户档位 10 lb，40 → 50 = **+25%**；而 12→20 的区间走完只能挣约 19%。**当最小一格的相对幅度超出区间预算，双进阶在数学上就是不连续的**——这是 S3 要解的。

对照卧推：6–8 区间、200 lb +5 lb = +2.5%，闸门虽严但可达，所以一直顺畅。同一套规则，一个死锁一个流畅。

## 现场事实（已核实，勿重查）

| 环节 | 现状 |
|---|---|
| 加重判据 | `TodayPrescriptionEngine` 约 :772：`last.minReps >= slot.repMax && (last.minRir ?? 99) >= 1.0` → `.increase`，次数重置 `repMin`；否则 `.hold` 目标 `repMax` |
| 安全减重 | `minRir <= 0.5`（近力竭）或 `maxReps < repMin`（掉出区间下限）→ ease 减一档 |
| lastPerformance | :1386 附近，把上一场压成 topWeightKg / repsAtTop / minReps / maxReps / minRir 五个标量 |
| 档位 | `LoadGrid` 固定绝对档：自由重量/绳索/挂片 kg 2.5 / lb 5；**选重插销机 kg 5 / lb 10**；owner 铁律「宁大勿小」不可动 |
| 区间 | 槽位定义：卧推 6-8、侧平举 **12-20**、弯举 8-12、深蹲 5-8 等 |
| 疼痛保守态 | #716 起：最近 4 场 ≥2 次痛跳过 → 只暂停更难的自动负荷进阶（钳上次重量）。**优先级最高** |
| e1RM 顶组口径 | `ProgressSnapshot` 取「重量最大的那组」算 e1RM——在 20 次宽区间会系统性低估（既有潜伏问题，见本批附带项） |

## 裁定 S1a：加重判据改「至少一组封顶 + 全组平均达标」

替换 `last.minReps >= slot.repMax`，新判据**四条全满足**才 `.increase`：

1. **至少一组真做到上限**：`last.maxReps >= slot.repMax`（防平均被刷）
2. **没有任何一组掉出区间**：全部组 `reps >= slot.repMin`
3. **全组平均达到区间中点**：`平均次数 >= (repMin + repMax) / 2`（用未取整 Double 比较）
4. **RIR 安全线一字不动**：`(last.minRir ?? 99) >= 1.0`

`lastPerformance` 需要新增「全组次数数组或平均值」——**只加派生字段，不落盘、不加目录字段**。

**二轮验收补充守卫（覆盖初裁缺口）**：上述四条之前必须先满足 `performance.uniformWeightKg != nil`，即本场该动作全部工作组负荷一致；混合负荷一律不得 increase，在不命中既有 RIR/掉底 ease 分支时 hold。根因是 S1a 的 reps 原先跨负荷混算，而加重基准取 `topWeightKg`，会把 NextSet 因疼痛降重后的轻组高次数算给最重疼痛组。必测 `[100×6, 90×8, 90×8]` 与 `[40×20, 40×18(pain), 30×20, 30×20]` 均 hold；同负荷正例不变。单组场 `min=max=mean`，新旧数学等价，故不新增最小组数门槛。

走查验证（必须成为测试）：
| 场景 | 组次数 | 旧判定 | 新判定 | 对不对 |
|---|---|---|---|---|
| 侧平举 12-20×4 | 20/18/16/15 | hold（永远） | **increase** | ✅ 摸到天花板且平均 17.25 ≥ 16 |
| 侧平举只有首组能打 | 20/12/12/12 | hold | **hold** | ✅ 平均 14 < 16，正确拒绝 |
| 卧推 6-8×3 | 8/8/7 | hold | **increase** | ✅ 合理放宽（两组封顶） |
| 卧推 | 8/6/6 | hold | **hold** | ✅ 平均 6.67 < 7 |
| 任一组掉出下限 | 20/18/10 | ease（maxReps≥repMin 时 hold） | **hold**（第 2 条否决 increase） | ✅ |

⚠️ **这是放宽**：既有 golden 里凡是「有组封顶但最差组没封顶且平均过中点」的场景会从 hold 变 increase。**必须逐一列出受影响 fixture 并逐条论证新行为正确**，不许直接重捕获了事。

## 裁定 S1b：新台阶宽限（防 40↔45 无限震荡）

升档后第一次做不动就立刻退回，会造成 40→45→40→45 永久震荡（「练半年还是一片」的机械成因之一）。

- **触发**：上一场是刚升上来的新档（用最近两场比较 topWeight，上一场 > 上上场）**且**本次因 `maxReps < repMin` 要 ease。
- **行为**：改为 `.hold`（保持当前重量，目标 `repMax`），给一次再试机会；**第二次仍不达标才 ease**。
- ⛔ **只阻止向下移动，永不制造向上移动**。
- ⛔ **RIR ≤ 0.5（近力竭）仍然立即 ease，不受宽限保护**——那是安全线。
- ⛔ 疼痛保守态判定优先级更高，不受本裁定影响。
- **二轮验收补充**：宽限还必须满足 `verdict.longGapDays == nil`；停练很久回来的掉底表现直接沿原 ease/回归调制，不享受首次重试。
- 需要把 `lastPerformance` 泛化成能取最近两场（`recentPerformances(limit: 2)` 或等价），**零新落盘**。

## 裁定 S3（历史初裁）：次数上限延伸（只在实测失败后触发，静默）

当最小一格的相对幅度超出区间预算时（选重机 +25% vs 区间 19%），双进阶数学上不连续。唯一诚实的解是抬次数上限。

1. **触发条件（写死，只此一条）**：历史证据显示**用户已在下一档实测失败过并退回当前档**（即：曾出现「升到 W+1 档 → `maxReps < repMin` → ease 回 W」）。
   - ⛔ **禁止任何模型预测式触发**（如「算出来需要 26 次才够」）——必须是真实发生过的失败。
   - **2026-08-03 主会话代 owner 补充裁定（provenance）**：行为形态本身就是充分证据，不要求证明 W+1 由引擎发起；用户主动尝试下一档同样证明「在当前次数区间下拿不动下一档」。要求引擎 provenance 会迫使处方历史持久化并引入新 schema，违反本批红线。
   - **防顶组 / 递增组误判守卫（补充裁定）**：W+1 失败场必须是该动作当场的**整块工作组**，即该动作全部工作组都在精确的 W+1 档；同场混合负荷（例如 W+1 顶组 + W 回落组）一律不算证据。原因：现有目录没有组形学习，不能把顶组 / 回落形态误判为下一档失败。
   - **时效边界（补充裁定）**：只认该动作最近 **8 次出现**之内的失败证据；更早的失败不延伸今天的次数上限。
2. **行为**：该动作在当前重量的目标区间上限抬高为
   `extendedRepMax = min(30, repMax + ceil((repMax − repMin) / 2))`
   （12–20 → **24**；6–8 → 9；硬顶 30）。**只延伸一级，不无限延伸**。
3. **延伸后的加重判据**：S1a 四条照用，只是 `repMax` 换成 `extendedRepMax`（中点也随之重算）。达标即升档——此时用户比原来强得多，能吃下那 +25%。
4. **⛔ 零解释文案**：不新增任何用户可见说明串。用户只会看到目标次数继续往上爬。（体验 lens 明确指出配套解释文案是全场唯一一处真说教，owner 拍板：静默。）
5. 延伸后仍失败 → 本批**不做**新提示，走既有通路，留案。

### 二轮验收撤回裁定（覆盖上方 S3 运行时授权）

S3 已按上方初裁完整实现并测试，随后主会话沿默认采用 `NextSetEngine.recommend` 的真实会话接缝核验，确认在当前可判定合同下**结构性不可达**：用户在 W+1 首组疼痛、RIR≤0.5 或 `reps < repLowerBound` 时，下一组默认安全降一档回 W，完成场自然落成混合负荷。混合负荷守卫又是排除顶组/回落误判所必需；若放宽成“只看首组 W+1 掉底”，现有行为数据与顶组 W+1 + 回落 W 完全同构，无法可靠区分。此前“行为形态本身即充分证据、不要求引擎 provenance”的初裁不变；撤回根因是默认会话路径不会自然形成该整块同档失败形态。

因此本批终态为：撤掉 `effectiveRepMax`、`progressionRepMax`、最近 8 次失败证据分支及全部 S3 专属测试，恢复目录 `repMax` 原语义；旧 S3 模拟器截图只保留为历史排错材料，不作为当前验收证据。这里不是“没做过”，而是**做了 → 沿真实路径验了 → 发现不可达 → 撤回留案**。

未来重新设计仅留两条方向，均须另立切片：

1. 用跨场**频率/重复模式**区分稳定顶组回落与偶发升档失败；
2. 会话内落一条 typed「引擎升档尝试」provenance 事实（涉及新持久化合同/schema 门，本批禁止顺手加入）。

## 红线（违反即返工）

1. ⛔ **RIR 安全线（`minRir <= 0.5` → ease）一字不动**；疼痛保守态优先级最高不受影响。
2. ⛔ **不做混合组**（同一动作同时两个重量）——训练学上更优但 Rede 至少 5 个显示面建立在「一动作一重量」假设上，会产出自相矛盾的卡片；需先做专门显示设计，本批明确不碰。
3. ⛔ **不改组数任何逻辑**（owner 拍板 S2 不做）：跨训练日组数差异、减载 −1、自动均衡 +1 全部原样。
4. ⛔ 不加目录字段、不 bump schema、不改 `LoadGrid` 档位（「宁大勿小」是 owner 铁律）。
5. ⛔ 不加任何用户可见新文案（S3 静默；S1 走既有 reason code，如需新 reason 必须先停下问）。
6. ⛔ 已落盘历史不迁移；版本号不动；不 push、不开 PR。

## 附带项（同批必修，既有潜伏问题）

`ProgressSnapshot` 的 e1RM 取顶组按「重量最大的那组」——在 20 次宽区间会系统性低估（20 次的轻组 e1RM 可能高于 12 次的重组）。Progress **展示趋势**改为层内 Epley 最大的那组。二轮验收确认同一个 `bestE1RmKg` / 点列还喂 MLE、估算里程碑、相对力量、突破分享与 Weekly Coach Review，故终态必须显式双口径：展示 `points/latestE1RmKg` 用层内最大 Epley；决策 `decisionE1RmPoints/bestE1RmKg` 保持重量优先顶组。升级 App 而没有新增训练时，所有决策输出必须逐项不变。

## 首轮验收标准（历史记录；S3 条目已失效，二轮终态以下方回执为准）

1. 侧平举 4 组做出 20/18/16/15 这种正常的递减 → **下次会加重**（以前永远不加）
2. 只有第一组能打满、后面全崩（20/12/12/12）→ **不加重**（防刷）
3. 卧推该涨还是涨，节奏不比现在慢
4. 加重后第一次没做到 → **不会立刻退回去**，给一次再试；第二次还不行才退
5. 在某个重量上试过下一档失败退回后 → 目标次数继续往上爬（12-20 变成能爬到 24），爬到了再升档
6. 练得接近力竭（RIR 0）→ 该减还是减，一点没变
7. 有疼痛记录的动作 → 照样暂停自动加重，不受本批影响

## 首轮验证要求（历史记录；不得用于当前终态验收）

1. **测试先红后绿**：S1a 五个走查场景逐条；S1b 宽限（首次不退/二次退/RIR≤0.5 不受保护/刚升档判定）；S3（模型预测式触发必须被拒、整块 W+1 工作组失败并回到 W 才延伸、同场混合负荷不触发、8 次出现窗外不触发、W+1 `maxReps >= repMin` 不触发、延伸只一级、延伸后达标升档、硬顶 30）；疼痛保守态优先级不变。
2. **golden 零回归 + 变更清单**：不触发本批任何条件的历史必须逐字节等价；**因 S1a 放宽而改变的 fixture 必须逐一列出并逐条论证新行为训练学上正确**（禁止「重捕获了事」）。
3. **跨层集成**：builder → clean → `plan()` 全链，至少覆盖「侧平举卡死用户连续 8 周」与「卧推正常用户连续 8 周」两条时间线，证明前者解锁、后者不被拖慢。
4. **canonical 实证 + 模拟器实拍**（装前真 build、前台确认、md5 互异）：卡死场景解锁前后的处方行。PNG 前缀 `2026-08-03-progression-`。
5. 门禁 exit 0。
6. **规格写回（引擎语义变更必须同批 grep 全部 canonical 文档）**：系统逻辑进阶规则段、PRD 相关 FR、`TodayPrescriptionEngine` 头部注释的规则说明（现写着「全组打满 repMax」需同步）、CHANGELOG/DEV_LOG、TestFlight 清单补验法。

## Git 纪律

`git fetch` 后从 `origin/main`（d49e5b1）拉 `codex/0803-progression-gate`；commit 前 `git status`；明确 pathspec 禁 `-A`；判据/宽限/延伸/e1RM/文档分步提交。

## 停止条件

- 同一问题修 3 次不过即停。
- 触红线、行为歧义（尤其：新判据与既有 golden 冲突超出预期规模、宽限与安全 ease 的优先级不清、S3 触发条件在现有历史结构下无法可靠判定）→ **立即停下回报，不自行改裁定**。
- 若需要新增用户可见文案 → 停下问。

## 首轮实施回执模板（历史记录）

```
## 首轮实施回执（历史记录；下方二轮回执覆盖终态）
- 分支与 commit 清单
- S1a 判据：[实现点 + 五场景测试 + 受影响 golden 逐条论证]
- S1b 宽限：[刚升档判定方式 + 优先级 + 测试]
- S3 延伸：[触发证据来源 + 公式 + 一级限制 + 测试]
- e1RM 附带项：[改法 + 测试]
- 跨层集成：[两条 8 周时间线证据]
- gate / 实拍 / 规格写回 / 未尽事项
```

## 二轮验收纠偏实施回执（当前终态）

- **分支、基线与提交**：`codex/0803-progression-gate`，`origin/main@d49e5b1`。首轮可审计提交为 `995f08e`（交接件）、`4c9ebab`（S1a）、`4f68982`（S1b）、`e9cef85`（后撤回的 S3）、`ed796ed`（后收窄的 e1RM）与 `e256b44`（首轮文档）；二轮实现为 `2e38607`（S1a/S1b 纠偏并撤 S3）和 `cb7fd61`（e1RM 双通道及 App 接线）。本节及 canonical 写回归最终 docs 提交。未 push、未开 PR。
- **① S1a 混合负荷漏洞（已闭合）**：`reachedProgressionGate` 在原四条件之前要求 `performance.uniformWeightKg != nil`。因此 `[100×6, 90×8, 90×8]` 与 `[40×20, 40×18(pain), 30×20, 30×20]` 均不能 increase；未命中既有 RIR/掉底 ease 时 hold。同负荷 20/18/16/15、8/8/7 等裁定行为不变。RIR≤0.5 的立即 ease、疼痛保守态的外层最高优先和组数逻辑均未移动。
- **② e1RM 外溢（已闭合）**：`ProgressSnapshot` 显式分成两个口径。展示 `points/latestE1RmKg` 取每场层内 Epley 最大工作组；决策 `decisionE1RmPoints/bestE1RmKg` 保持升级前“重量优先、同重比次数”的顶组 Epley。MLE performance 轴、实测/估算力量里程碑、相对力量五档、`MuscleLevelMemory` 的 level-up/peak/pending、Today 突破与分享快照、Weekly Coach Review 均只读决策口径。同一批历史逐项比较完整 `MuscleDevelopmentProfile`、里程碑、相对力量、memory advancing/persisted state 与分享事实，输出保持旧口径一致；敏感性断言另证明误接展示点会改变这些结果。App-hosted 测试使用隔离 canonical/memory 文件走真实 `ProgressModel`，同时锁住展示 133.33 kg、决策 99.17 kg，且不会凭空制造估算 100 kg 里程碑或升级/分享事实；生产默认文件路径未变。
- **③ S3（已实现、验出不可达、完整撤回）**：首轮确实实现并测试了 `effectiveRepMax`、`progressionRepMax`、最近 8 次 W+1 失败证据、一级延伸与上限 30。二轮沿默认 `NextSetEngine.recommend` 会话路径核验后确认：W+1 首组疼痛、RIR≤0.5 或低于下限会让后续组安全降到 W，真实落盘自然成为混合负荷；若只认首组，又与 W+1 顶组 + W 回落完全同构。因此当前默认会话路径不会自然形成所需的整块同档失败证据，已删除上述全部实现、透传和 S3 专属测试，目录 `repMax` 恢复唯一上限。此前“行为形态本身即充分证据、不要求引擎 provenance”的初裁不变；这不是“没做过”，而是**做了 → 沿真实路径验了 → 发现不可达 → 撤回留案**。未来仅保留跨场频率/重复模式识别，或另立切片落 typed“引擎升档尝试”provenance 事实；后者涉及持久化/schema 门，本批未越界。
- **④ S1b 长间隔（已闭合）**：新档首次掉底的 hold 宽限现在与 increase 同样要求 `verdict.longGapDays == nil`；长间隔回归直接走原 ease/回归调制。刚升档仍按最近两次 `topWeightKg` 严格上升判定，宽限只阻止一次下降、不制造上升；第二次同档失败及 RIR≤0.5 行为不变。
- **⑤ 集成范围与措辞（已闭合）**：两条八周测试已撤掉 S3 叙事并重写。它们真实覆盖手写训练观察 → `TrainFlowState` / `CompletedSessionBuilder` → `AppData` → clean input → `TodayPrescriptionEngine.plan()` 的存储与处方接线；侧平举锁 S1a/S1b 与目录上限，卧推锁既有 100→102.5→105 kg 节奏。因为重量观察是测试手写，回执不再把它称为覆盖 `NextSetEngine` 组内决策的“全链”；该接缝由 `NextSetEngineTests` 11/11 直接锁定，并构成撤 S3 的依据。
- **⑥ 最小组数（报备、不改）**：未增加 `>=2` 组门。单组时 min=max=mean，新旧判据数学等价；额外门会无依据改变既有行为，且 `golden-prescription-deload` 的 hack-squat 正是 80×8 单组。
- **RED → GREEN 证据**：二轮先红：四条聚焦进阶测试共 12 个断言失败（两条混合负荷、长间隔、撤 S3 后目录上限）；e1RM 决策点缺失为编译 RED；Weekly Coach 旧接线有 2 个失败断言；App 生产接线因缺少隔离 seam 编译 RED。最小实现后，`ProgressionGateTests` 18/18、`NextSetEngineTests` 11/11、`RedeTrainingDecision` 512/512、`RedeLocalSnapshot` 241/241、Weekly Coach 聚焦测试和 App 生产接线测试全部通过。独立代码审查未发现代码 P0/P1/P2；其唯一 P2 是旧/新回执并存造成的文档终态歧义，已由历史标记和本节闭合。
- **golden 逐项论证（0 变更、0 重捕获）**：`golden-prescription-first-exposure` 无历史，不进入闸门；`golden-prescription-progression` 是同负荷 8/8/8，新旧都升档；`golden-prescription-deload` 的 hack-squat 是 80×8 单组，min=max=mean，闸门结果在 verdict 调制前不变；`golden-prescription-pull-day` 只有 bench-press 历史，拉类动作仍为首练；`golden-prescription-legs-day` 只有 bench-press / lat-pulldown 历史，腿类动作仍为首练。五份 expected JSON 字节测试全部通过，fixture 文件没有改动。
- **权威门禁**：最终 `bash .claude/quality-gate.cmd` 真实 exit 0。10 个 Swift 包共 1,194/1,194：`RedeDataHealth` 61、`RedeDomain` 69、`RedeEntitlements` 28、`RedeHealthKit` 4、`RedeL10n` 144、`RedeLocalSnapshot` 241、`RedeNotifications` 13、`RedePersistence` 110、`RedeTrainingDecision` 512、`RedeWidgetShared` 12；通用 iOS Simulator build 通过；App-hosted 白名单 82/82；末行 `QUALITY GATE: PASS`。
- **canonical 写回与红线核对**：已按 `DOCS_MANIFEST` grep 全部 canonical 入口并写回 `TodayPrescriptionEngine` 头部旧规则说明、系统逻辑 §6.0.1/§6.5/§8、PRD FR-T2/FR-PR2/FR-PR7/FR-SUB3、CHANGELOG、DEV_LOG 和 TestFlight N17。Master architecture、roadmap、设计/文案、exercise catalog 与 cloud archive 没有本批新真相，无需改。没有新增目录字段、schema bump、迁移、版本、package/project manifest 或用户可见文案；没有改 LoadGrid、组数、RIR/疼痛优先级、辅助式/自重/外挂自重路径。
- **当前残余与证据边界**：首轮 S3 / 单通道 max-Epley 的 Simulator 截图只属历史排错材料，不是终态验收证据；旧 `Rede-Progression-QA` 的 derived `muscle-level-memory.json` 可能已被当时的单调 peak/pending 写入污染，本轮没有复用、清理或迁移该设备。分支未发布，TestFlight/生产数据不受影响。TestFlight N17 仍待真机勾选；本批没有 push、没有 PR。

## 首轮实施回执（历史记录；已被上方二轮终态覆盖）

> 本节只保留首轮“当时实现、当时测试、当时截图”的审计事实，不是当前运行时合同或当前验收结论。尤其是 S3 分支、1,198/81 的旧门禁数字和 S3 截图均已失效；上方二轮回执是唯一终态。

- **分支与 commit 清单**：`codex/0803-progression-gate`，基线 `origin/main@d49e5b1`；`995f08e` 交接件，`4c9ebab` S1a 判据，`4f68982` S1b 宽限，`e9cef85` S3 延伸，`ed796ed` e1RM；canonical 规格、日志、TestFlight 验法与本回执归本次 docs 提交。未 push、未开 PR。
- **S1a 判据**：`LastPerformance` 只新增不落盘的 `meanReps: Double` 派生值，并从第一项就以 `Double` 累加，避免 clean 极端次数触发 `Int` 溢出。普通 external 的 `reachedProgressionGate` 同时要求 `maxReps >= effectiveRepMax`、`minReps >= repMin`、未取整 `meanReps >= (repMin + effectiveRepMax)/2`、`minRir >= 1.0`（nil 沿旧合同视为有余力），长间隔压制保持原位置。走查测试逐条锁定：侧平举 20/18/16/15 升档；20/12/12/12 保持；卧推 8/8/7 升档；8/6/6 保持；20/18/10 因破下限不升档；另锁住 RIR 0.5 不升与 `Int.max` 平均无溢出。RED 时旧实现聚焦套件共 21 项、33 个预期断言失败；最终该包 518/518。
  - **S1a golden 变更清单：0 个，未重捕获**。五份 fixture 逐一论证：`golden-prescription-first-exposure` 没有历史，根本不进入闸门；`golden-prescription-progression` 的卧推为 8/8/8，新旧判据都升档；`golden-prescription-deload` 的 hack-squat 只有 80×8 一组，新旧判据结果相同，随后 deload 调制不变；`golden-prescription-pull-day` 只有 bench-press 历史，今日拉类动作仍是首练；`golden-prescription-legs-day` 只有 bench-press / lat-pulldown 历史，今日腿部动作仍是首练。`GoldenPrescriptionTests` 对五份 expected JSON 的字节比较全部通过。
- **S1b 宽限**：同动作表现按 `日期 + canonical append offset` 排序；ordinary external 取最近两次，最近 topWeight 严格大于前一次（容差 `1e-9 kg`）且本次 `maxReps < repMin`，只把既有 ease 改为在当前新档 hold 一次。连续第二次同档失败时两次 topWeight 不再上升，因此走原 ease；该分支只阻止下降、不制造上升。`minRir <= 0.5` 分支仍先执行并立即 ease，疼痛保守态仍在处方外层最高优先。测试锁住首次保持、二次退档、RIR 0.5 首次也立即退档。
- **S3 延伸**：不新增 provenance/schema；最近一场定义当前 W，最近 8 次该动作出现中只认一场**全部工作组负荷相同且等于 W 的精确下一 LoadGrid 档**、该场 `maxReps < repMin`、并在它之后已有 topWeight 回到 W 的行为证据。命中后 `effectiveRepMax = min(30, repMax + ceil((repMax-repMin)/2))`，始终从目录原区间计算一次，不递归。测试覆盖正例、失败恰在 8 次窗首而更早 W 在窗外、混合 W+1/W 顶组回落拒绝、失败落在第 9 次以前拒绝、W+1 已做到 repMin 拒绝、无实测仅预测拒绝、跳两档拒绝、24 达标后升档、多轮失败仍只到 24、硬顶 30；无新 reason 或用户文案。
- **e1RM 附带项**：`ProgressSnapshotBuilder` 对每场每动作单独选择 Epley `w×(1+r/30)` 最大的工作组生成趋势点；历史顶组、`bestWeightKg` 与重量 PR 继续重量优先、同重比次数。测试锁住 62.5×6 的 Epley 75 低于 60×8 的 76，以及另一场中 20×8 仍是重量顶组/PR、16×20 才是 e1RM 代表组。`RedeLocalSnapshot` 239/239。
- **跨层集成**：两条连续 8 周时间线均由生产 `TrainFlowState → CompletedSessionBuilder → TrainingSession → AppData → CleanAppDataViewBuilder → CleanTrainingDecisionInput → TodayPrescriptionEngine.plan()` 生成事实。侧平举时间线依次证明 40 lb 正常递减升 50、第一次失败保 50、第二次失败退 40、当前上限延伸 24、24 次闸门挣到后再升 50，并最终离开原档；卧推时间线保持 100→102.5→105 kg 的既有节奏且所有 `repUpperBound` 仍为 8。
- **gate / 实拍 / 规格写回 / 未尽事项**：独立审查提出的 `Int` 溢出、e1RM/重量 PR 证据分离、S3 一级限制和测试日期四项均已关闭，定向复核无剩余 P0–P3。最终权威 `bash .claude/quality-gate.cmd` exit 0：10 个 Swift 包共 1,198 项、Xcode build、App 宿主 81/81，末行 `QUALITY GATE: PASS`。其后用最终源码再次真实 build/install 到 `Rede-Progression-QA`（iPhone 17 Pro / iOS 26.5），五个 canonical fixture 写入前后 SHA-256 各自相同；五张最终 PNG 均为 1206×2622 且 MD5 互异：`.ai-tmp/progression-gate/2026-08-03-progression-before.png` `af3d13452bbf7e8349c11c11ccc851e9`（40 lb×20）、`...-s1a-unlocked.png` `b99363a54b11e1df399522dac43d2b1e`（50 lb×12）、`...-s3-extended.png` `f46cb7fe23f94c0759dad1173edd5423`（40 lb×24）、`...-s3-earned.png` `cad473a777105168abd6aafa37f509c3`（50 lb×12）、`...-e1rm.png` `d2705d81df18d16d22427c81a5d748b0`（e1RM 76 kg、重量里程碑 60 kg）。前台 AX 直接读到对应处方与进展文本。已 grep manifest 登记的全部 canonical 文档并写回 `TodayPrescriptionEngine` 头注释、系统逻辑 §6.0.1/§8、PRD FR-T2、CHANGELOG、DEV_LOG 与 TestFlight N17；Master、roadmap、设计/文案、catalog 合同均无本批新真相。旧历史不迁移；组形学习仍留案，混合负荷故意不算 S3 证据；TestFlight N17 仍未真机勾选。没有改组数、RIR/疼痛优先级、LoadGrid、目录/schema/版本、package/project manifest、辅助式/自重/外挂自重分支或用户可见文案。

## 主会话验收结论（2026-08-04）

全量三 lens 验收：5 MAJOR + 3 MINOR + 2 NIT（另 9 条被对抗核验驳回，理由逐行核过代码）。三个独立真问题（e1RM 外溢被三个 lens 各报一次）全部定向闭合，闭合后两路复验 **pass=true**（复验方独立重跑 10 个包 1,194/1,194、对 10 个 golden 文件逐个 shasum 比对全 SAME、全仓清点 e1RM 消费方归位）。独立门禁两次 exit 0。

**两条根因是主会话交接件的裁定缺口，已如实记录**：
1. S1a 只裁定了「按次数判定」，未继承 S3 的负荷一致性纪律 → 旧闸门 `minReps >= repMax` 天然对混合负荷免疫，新闸门把这道保护拆了。最危险路径：单次疼痛不进保守态 → NextSetEngine 因 painReported 降后续组重量 → 轻组打满、平均被拉过中点 → **下次把最重那组加重**。已加 `uniformWeightKg != nil` 守卫闭合。
2. e1RM 附带项裁定范围写成「ProgressSnapshot 趋势点」，未意识到同一个 `bestE1RmKg` 还喂 MLE performance 轴 / 估算里程碑 / 相对力量地板 / levelUp 突破卡，且 MLE peaks 只升不降写盘不可逆。已改为展示/决策双通道闭合。

**主会话另做的收口**：残余风险留案（见下）、两条 e1RM 点列逐场对齐断言、CHANGELOG「Uniform-load behavior is unchanged」补参照系。

**已知非阻断残余（留案）**：
1. **顶组+回落用户不再自动升档**：负荷一致性守卫要求整场同负荷，`[100×8, 90×8, 90×8]` 在守卫前会升、之后 hold。这是有意的保守取舍——放宽成「只看最重那一档」会同时放行「引擎因疼痛降重后仍判加重」这条更危险的路径。真解法是组形（top/backoff）学习层；在它落地前，收到「我练顶组回落重量不涨」的反馈直接归因本条，不要重做根因调查。已写入系统逻辑 §6.0.1。
2. `latestE1RmKg`（展示口径）与 `bestE1RmKg`（决策口径）字段名不含口径前缀，当前无消费面同时读、注释与 §8.0 已锁；未来新消费面误读是隐性风险。
3. 同场同 exerciseId 多 occurrence（FR-TR6 A→B→A / FR-TR14 二次加练）若两段负荷不同会被判混合负荷而 hold——偏保守不偏激进，与 #721 occurrence 拆分语义有轻微张力。
4. 进展页曲线 e1RM 可能已过 100kg 而「估算里程碑」尚未达成（两个口径的必然结果），界面无解释——规格已写明是拍板取舍。
5. `testProgressModelKeepsDecisionE1RMForEveryDecisionConsumer` 挂在 `SessionStoreDraftTests` 类下（主题不符但门禁按类白名单确实会跑）。
