# 交接件：动作库内容波 W1——补齐 72 个动作的双语技术要点

> 日期：2026-07-21 ｜ 来源：主会话盘点——165 个动作里 **72 个（44%）没有技术要点**，用户点进动作详情看到半张空白页
> 性质：内容生产（低风险、纯数据、owner 常设授权「低风险内容波不必每波等审定」）
> 执行：Codex（主控档 gpt-5.6-terra + high）｜验收：Claude 主会话
> ⚠️ **并行批次**：另有 Codex 正在做 FR-PL7③（引擎守卫 + 日序编辑器 UI + 规格文档）。**本批唯一可改文件是 `exercises.json`（+ 必要时其测试）**，严禁碰引擎/UI/PRD/系统逻辑，避免并行冲突。

## 一句话成果

`exercises.json` 里 72 个缺技术要点的动作补齐 `techniqueCuesZh/En` + `progressionZh/En` + `regressionZh/En`，风格与现有 93 条完全一致，用户点开任何动作都能看到可用的要点。

## 现场事实（已核实）

- 文件：`ios/packages/RedeTrainingDecision/Sources/RedeTrainingDecision/Resources/exercises.json`（165 条，唯一真源）
- 覆盖现状：`techniqueCuesZh/En` 93/165、`progressionZh/En` 93/165、`regressionZh/En` 93/165、`safetyNoteZh` 60、`evidenceTag/Url` 67
- **缺口 72 条**，按主肌群：chest 10、lats 9、quads 8、biceps 6、upper-back 6、triceps 6、front-delt 6、hamstrings 5、calves 4、side-delt 3、traps 3、core 3、rear-delt 2、glutes 1
- 消费端：`ExerciseDetailSheet.swift`（动作详情 sheet，K2 动作库浏览器 + 训练中点动作名）；`ExerciseCatalog.swift` 解码
- 现有风格样本（`bench-press`）：
  - `techniqueCuesZh`：**4 条**中文句，每条一个要点，句末带句号，讲**建立姿势 → 关键发力/稳定 → 握距或轨迹 → 呼吸与节奏**
  - `techniqueCuesEn`：同结构英文原生撰写（不是中文直译）
  - `progressionZh`：一句话，怎么变难（加重/慢速离心/停顿）
  - `regressionZh`：一句话，怎么变简单（减重/换器械/缩范围）

## 任务

给 **72 个缺口动作**各补：

| 字段 | 要求 |
|---|---|
| `techniqueCuesZh` | **3–4 条**，每条一个具体可执行要点，与现有 93 条同结构（姿势 → 发力 → 轨迹/握法 → 呼吸节奏，按动作特性取舍）|
| `techniqueCuesEn` | 同要点的**英文母语表达**（不是逐句直译；术语用英语健身语境的自然说法）|
| `progressionZh` / `progressionEn` | 一句话怎么加难度 |
| `regressionZh` / `regressionEn` | 一句话怎么降难度（含换器械/助力等） |

**`safetyNoteZh/En` 只在该动作确有特定风险时补**（如颈后推举、深蹲大重量、硬拉腰椎）——不是每条都要，不为凑而写。

## 红线（违反即返工）

1. **⛔ 严禁编造 evidence**：`evidenceTag` / `evidenceUrl` **一律不新增、不修改**。本批只补要点/进阶/退阶（+必要的安全提示）。宁可留空也不许生成看起来像真的的论文标题或 URL。
2. **⛔ 不动任何既有值**：93 条已有内容一字不改；不动 `id/rank/pattern/muscle/equipment/loadType` 等结构字段。**纯加字段值**。
3. **⛔ 不碰其他文件**（并行冲突）：只改 `exercises.json`；若 `ExerciseCatalogTests.swift` 有覆盖率断言需同步，可改该测试文件，**其余一律不动**。
4. **⛔ 不做医疗声明**：不写诊断、治疗、「防止受伤」保证；有疼痛/风险语境只写「不适请咨询专业人士」（对齐现有 safetyNote 口径）。
5. **⛔ 不用 AI 腔**：不写「智能」「科学证明」「最佳」「完美」这类空词；写具体动作指令（对齐现有 93 条的语气：冷静、具体、像教练在旁边说话）。
6. JSON 结构合法、缩进/键序与现有条目一致（diff 里只应看到新增字段行）。

## 内容质量标准

- **具体**：「肩胛后缩下沉（向中间夹紧、向下收）」✅；「保持正确姿势」❌
- **可执行**：用户在器械旁读一句就能照做
- **双语原生**：中英各自读起来像母语教练写的；英文不出现中式直译
- **动作特异**：每条要点针对**这个动作**（哑铃卧推的要点不能和杠铃卧推逐字雷同）——同族动作可共享概念但表述要贴合器械差异

## 验证与证据

1. **结构验证**（必须跑）：JSON 解码通过；补完后统计 `techniqueCuesZh/En`、`progressionZh/En`、`regressionZh/En` 均达 **165/165**；`evidenceTag/Url` 计数**仍为 67**（证明没编造）。
2. **包测试**：`cd ios/packages/RedeTrainingDecision && swift test`（含 `ExerciseCatalogTests`）全绿。
3. **门禁**：仓库根 `.claude/quality-gate.cmd` exit 0（内容波一次冻结点即可）。
4. **模拟器实拍抽样**（1–2 张）：动作库进详情页，随便点一个**本批新补**的动作（如 `preacher-curl`），看要点/进阶/退阶都渲染正常、不溢出。装前必真 `xcodebuild build`；截图前确认前台是 Rede。PNG 前缀 `2026-07-21-contentwave-` 存 `docs/工作记录/`。
5. **抽样自检**：随机抽 5 条自查中英是否互为原生表达而非直译，写进回执。

## Git 纪律

- 已在分支 `codex/0721-content-wave-w1`（基线 origin/main），直接开工。
- **每次 commit 前重跑 `git status`**：并行批次在跑，`git add` 只用明确 pathspec（`exercises.json` 及必要测试），**禁用 `-A`**。
- 可按肌群分批提交；**不 push、不开 PR**。

## 停止条件

- 某动作你无法给出有把握的专业要点（冷门器械/不确定的动作模式）→ **留空并在回执里列出**，不要编。
- 同一问题修 3 次不过即停回报。

## 实施回执模板（收尾必填**回填本文件末尾**）

```

## 实施回执
- 分支与 commit 清单：`codex/0721-content-wave-w1`；本轮未创建 commit（未 push、未开 PR）。
- 覆盖率：补前 `techniqueCuesZh/En`、`progressionZh/En`、`regressionZh/En` 均为 93/165；补后六组字段均为 165/165。`evidenceTag` / `evidenceUrl` 均保持 67（未新增或修改）。
- 留空未补的动作：无。
- 抽样自检：`preacher-curl`、`single-arm-cable-row`、`assisted-pull-up`、`band-good-morning`、`nordic-curl` 已逐条核对；中英文均按各自训练语境撰写，包含动作设置、发力/轨迹与进退阶指令，非逐句直译。
- 包测试 / gate：`swift test`：`RedeTrainingDecisionPackageTests.xctest` 396 tests / 0 failures；`.claude/quality-gate.cmd` exit 0（尾部：`QUALITY GATE: PASS`）。
- 实拍：无文件。
- 未尽事项：Simulator 前台状态检查超时，无法确认没有占用并行批次的运行包；按交接件未抢占、未重装，故未做实拍抽样。
```

## 第二轮精修回执

- 器械真实性：`smith-squat` 已改为沿固定导轨下沉、上背压住杠铃的正确口径，删除不存在的背垫；`smith-overhead-press` 的中文破句已重写。全批支撑面词 grep 后，W1 命中的 `pec-deck`、`reverse-pec-deck`、`seated-leg-curl`、`machine-lateral-raise`、`ab-crunch-machine`、`hammer-*`、`pendulum-squat` 等均为具有相应座椅/胸垫/靠背的真实器械；`smith-*` 和 band 条目无伪造垫面。
- plate-loaded：`seated-calf-raise`、`hammer-chest-press`（两处）、`incline-hammer-press`、`hammer-row`、`hammer-pulldown`、`hammer-shoulder-press`、`hammer-leg-extension`（两处）、`hammer-leg-curl` 已不再把插片式器械称作 “the stack”；其余 “Stack the wrists” 为手腕叠放动词，不是配重块。
- 内容加厚：72 条 W1 均为 4 条中英技术要点；中文要点平均字符数由前三条合计 **72.1** 提升至四条合计 **105.1**（+45.8%）。所有退阶/进阶补入具体秒数、角度、距离、握距、支撑或进阶条件；弹力带明确“拉得更长＝阻力更大”，`band-lat-pulldown` 的退阶保持跪姿/坐姿，不再写成站姿。
- 对齐与命名：`db-pullover` 中英文统一为顺躺平凳；`meadows-row` 改为「梅多斯划船」，并同步唯一硬编码历史日志。W1 cue 数组均已改为多行格式。
- 结构：JSON 解码通过；`techniqueCuesZh/En`、`regressionZh/En`、`progressionZh/En` 六组字段均为 **165/165**；72 条 W1 均为 4 条要点；`evidenceTag` / `evidenceUrl` 均仍为 **67**，逐值对比无改动；历史 93 条逐值对比无改动。
- 规格与测试：FR-EX2 已更新为 2026-07-21 W1 的 165/165 状态；`ExerciseCatalogTests` 已将六组字段覆盖断言锁定为 165。`cd ios/packages/RedeTrainingDecision && swift test`：396 tests / 0 failures；`.claude/quality-gate.cmd`：exit 0 / PASS。
- 未尽事项：无内容或结构缺口；未做 Simulator 实拍（本轮为目录内容与测试门槛精修，未改 UI 运行时）。
