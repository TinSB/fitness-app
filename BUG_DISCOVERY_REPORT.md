# BUG DISCOVERY REPORT

本报告仅记录 QA / Bug Discovery 阶段发现的问题，不包含修复代码。

## 1. 验证结果

| 项目 | 命令 | 结果 |
| --- | --- | --- |
| typecheck | `npm run typecheck` | 通过 |
| test | `npm test` | 通过，255 个测试文件 / 1127 个测试 |
| build | `npm run build` | 通过 |

失败测试文件：无。

失败断言：无。

失败堆栈：无。

可能影响的功能链路：基础验证未暴露阻断问题，但静态审计发现导入数据修复、计划调整去重、关键状态链路测试质量仍有风险。

## 2. P0 高风险问题

### P0-1：导入 / 持久化动作身份污染风险

- 问题名称：导入 / 持久化动作身份污染风险
- 复现路径：导入含无效 `actualExerciseId` 或 synthetic replacement id 的旧历史数据后，再经过 repair / sanitize / save / load。
- 影响范围：历史记录池、替代动作记录、PR、e1RM、effectiveSet、训练历史详情、DataHealth。
- 相关文件：
  - `src/storage/persistence.ts`
  - `src/engines/dataRepairEngine.ts`
- 初步根因：sanitize 层仍可能把无效 `actualExerciseId` 保留为当前 `actualExerciseId`，而不是仅保留到 `legacyActualExerciseId` 并标记人工复核。DataRepairEngine 已经有低风险修复边界，但 persistence sanitize 仍是最终存储边界，可能重新放大旧数据污染。
- 建议修复方向：在 persistence sanitize 层收紧无效 exercise identity 处理：历史记录中的 invalid `actualExerciseId` 不得 fallback 到 `originalExerciseId`，也不得继续作为 active actual id；只能保留到 `legacyActualExerciseId`，并让 DataHealth / repair report 保持 needs_review。
- 建议新增测试：
  - invalid history `actualExerciseId` 经 `repairImportedAppData` 后不能成为 active actual id。
  - invalid history `actualExerciseId` 经 `sanitizeData` 后不能 fallback 到 original。
  - synthetic `__auto_alt` / `__alt_` 不能污染 PR/e1RM/effectiveSet 的记录池。
  - repaired data save/load 后仍保留 `legacyActualExerciseId`，并能被 DataHealth 报告。
- 是否建议立即修：是。该问题可能影响真实历史统计和训练记录可信度。

## 3. P1 中风险问题

### P1-1：Plan Adjustment 快速重复点击仍可能竞态生成重复草案

- 问题名称：Plan Adjustment 快速重复点击仍可能竞态生成重复草案
- 复现路径：同一 CoachAction 连续快速触发“生成调整草案”，尤其是在 React state 尚未完成下一次 render 前重复点击。
- 影响范围：Plan 待处理建议、调整草案、实验模板状态、调整历史、Today / Plan coach action 可见过滤。
- 相关文件：
  - `src/App.tsx`
  - `src/engines/programAdjustmentEngine.ts`
- 初步根因：existing draft 检查基于闭包中的 `data`，写入时只按 `draft.id` 过滤；同 sourceFingerprint 的 functional upsert 保护不足。虽然 sourceFingerprint 已用于状态判断，但写入侧仍可能在快速重复调用时创建多个同源 draft。
- 建议修复方向：将 create draft 写入收口为基于当前 `setData(current => ...)` 的 fingerprint upsert；在写入时再次按 sourceFingerprint 查找 active/applied/rolled_back 状态，而不是只信任调用前的闭包数据。
- 建议新增测试：
  - 连续调用同一 action 两次，只保留一个 active draft。
  - 同 sourceFingerprint 的 ready draft 已存在时不新增 draft，只返回已有 draft。
  - applied draft 已存在时不新增 draft。
  - rolled_back 后重新生成只生成一个 child draft，并写入 `parentDraftId`。
- 是否建议立即修：是。该问题会导致重复草案和状态不可信。

### P1-2：关键链路存在源码字符串守卫测试，不能证明真实 App handler 状态变化

- 问题名称：关键链路测试只检查源码字符串
- 复现路径：修改 `startSession`、pending patch、active template 相关 handler 逻辑但保留测试中检查的源码字符串，测试仍可通过。
- 影响范围：Today 开始训练、pending session patch 消费、activeProgramTemplateId、experimental template startSession、rollback 后训练模板。
- 相关测试：
  - `tests/activeProgramTemplateSession.test.ts`
  - `tests/pendingSessionPatchStartSession.test.ts`
- 初步根因：部分测试使用 `readFileSync` + `toContain` / `not.toContain` 验证源码文本，绕过真实 handler 状态变化。
- 建议修复方向：抽取可测试的纯 handler helper，或建立最小 App state harness，验证调用后 `activeSession`、`pendingSessionPatches`、`activeProgramTemplateId` 的真实变化。
- 建议新增测试：
  - active experimental template 下 startSession 生成 session，并保留 active template。
  - rollback 后 startSession 使用 source template。
  - pending patch 被消费后 status 变为 consumed，且不会影响下一次 session。
  - selectedTemplate 不覆盖 activeProgramTemplateId。
- 是否建议立即修：是。测试可能掩盖状态链路回归。

### P1-3：测试中存在 76 处 `toBeTruthy()`，部分关键路径断言过宽

- 问题名称：测试断言过宽
- 复现路径：引入错误值但仍为 truthy，例如错误 id、错误文案、错误对象、错误 draft 状态，测试仍可通过。
- 影响范围：DataHealth、Plan Adjustment、Evidence、Pipeline、history edit、session patch 等多个测试区域。
- 相关测试：多个测试文件均有 `toBeTruthy()`，其中 DataHealth / Plan Adjustment / Pipeline 链路风险更高。
- 初步根因：部分测试只确认“有值”，没有确认“正确值”或“状态变化”。
- 建议修复方向：对关键链路替换为具体断言，例如 `toEqual`、`toMatchObject`、`toHaveLength`、明确 id/status/message/state delta。
- 建议新增测试：
  - Toast 出现时同时断言 AppData 状态变化。
  - DataHealth issue id 精确匹配且 dismiss 后 visible list 减少。
  - Plan draft status / sourceFingerprint / parentDraftId 精确匹配。
  - Pipeline 输出不只存在，还要和 expected nextWorkout / visibleCoachActions 一致。
- 是否建议立即修：建议分批修。优先处理 P0/P1 链路中的宽松断言。

### P1-4：Program Adjustment 内部 id 仍使用 `Date.now()` / `Math.random()`

- 问题名称：Program Adjustment 内部随机 id 风险
- 复现路径：生成 adjustment draft / change / history，多次相同输入可能得到不同 draft id / change id。
- 影响范围：Plan 草案显示、diff 高亮、调整历史定位、重复草案去重、测试稳定性。
- 相关文件：
  - `src/engines/programAdjustmentEngine.ts`
- 初步根因：`makeId()` 仍使用 `Date.now()` + `Math.random()`，`changeFromRecommendation()` 也用 random 生成 change id。虽然 sourceFingerprint 已存在，但部分 UI / history 仍引用 draft/change id 做定位。
- 建议修复方向：保留随机 id 作为实例 id 时，必须确保业务去重、UI 聚合、history matching 只依赖 sourceFingerprint / sourceRecommendationId / sourceTemplateId 等稳定身份；如果可行，为 draft/change/history 生成稳定业务 id 或 deterministic revision id。
- 建议新增测试：
  - 同输入重复调用 fingerprint 稳定。
  - UI 去重不依赖 draft id。
  - 同 fingerprint 多个 legacy draft 默认只显示一个。
  - 快速重复点击不会因不同 draft id 生成重复 active draft。
- 是否建议立即修：建议与 P1-1 同轮处理。

## 4. P2 低风险问题

### P2-1：原生弹窗扫描无真实 native alert / confirm，但有自定义 `confirm()` 误报

- 问题名称：原生弹窗扫描误报
- 复现路径：全局搜索 `window.alert`、`window.confirm`、`alert(`、`confirm(`。
- 影响范围：代码审计。
- 相关文件：
  - `src/ui/useConfirmDialog.tsx`
  - `src/features/HealthDataPanel.tsx`
  - `src/features/ProgressView.tsx`
  - `src/features/TodayView.tsx`
- 初步根因：命中的 `confirm(` 是自定义 `useConfirmDialog` hook 返回的确认函数，不是原生 `window.confirm`。
- 建议修复方向：无需修业务代码；保留源码守卫时应区分 `window.confirm` 与自定义 hook。
- 建议新增测试：
  - 源码不包含 `window.alert` / `window.confirm`。
  - 关键确认流程使用 `ConfirmDialog`。
- 是否建议立即修：否。

### P2-2：raw enum 扫描主要是内部类型 / formatter false positive

- 问题名称：raw enum 扫描误报
- 复现路径：搜索 `high / medium / low / hybrid / strength / warmup / working / support / compound / isolation / machine / undefined / null`。
- 影响范围：可见文案守卫、formatter、类型定义。
- 相关文件：
  - `src/features/PlanView.tsx`
  - `src/features/ProgressView.tsx`
  - 多个 presenter / formatter / engine 文件
- 初步根因：多数命中是内部类型、中文 formatter 映射、条件渲染中的 `null`，不是直接用户可见 raw enum。
- 建议修复方向：继续依赖 visible text guard；不要把内部类型常量当成 UI bug。后续可强化重点页面渲染文本测试。
- 建议新增测试：
  - Today / Focus / Record / Plan / My 可见文本不包含 raw enum、`undefined`、`null`。
  - Formatter 覆盖所有新增 enum。
- 是否建议立即修：否。

## 5. 测试质量审计摘要

- `.only` / `.skip`：未发现。
- snapshot 过度依赖：未发现 `toMatchSnapshot` / `toMatchInlineSnapshot`。
- 宽松断言：发现 76 处 `toBeTruthy()`，需要按风险分批收紧。
- 只看源码字符串的测试：存在，尤其是 startSession / pending patch / active template 链路。
- 只检查 Toast 而不检查 AppData 的风险：当前测试覆盖已有进步，但后续应继续在关键操作中同时断言状态变化。

## 6. 静态风险扫描摘要

- 原生弹窗：未发现真实 `window.alert` / `window.confirm`；`confirm(` 为自定义 hook 误报。
- 假按钮：未发现 `onClick={() => {}}` / `onClick={undefined}`。
- 数据身份风险：`programAdjustmentEngine.ts`、`sessionBuilder.ts`、`persistence.ts` 中仍存在 `Date.now()` / `Math.random()`。其中 session id 可接受，Program Adjustment 业务去重需重点关注。
- 旧状态路径：Today / Plan 已使用 `buildEnginePipeline`；Record 中存在直接 history filter，当前主要用于本地统计显示，不直接生成 coach recommendation。

## 7. 建议下一轮优先级

1. 立即修 P0：导入 / 持久化动作身份污染风险。
2. 同轮或下一轮修 P1-1 + P1-4：Plan Adjustment 快速重复点击和随机 id 去重风险。
3. 后续补 P1-2 + P1-3：把源码字符串守卫测试和 `toBeTruthy()` 宽松断言改成真实状态断言。
