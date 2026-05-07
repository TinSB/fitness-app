# Training Record Trust Checklist

This checklist defines the release bar for IronPath training-record trustworthiness. It covers Record, History, Calendar, Summary, effective-set explanations, edit audit trails, and DataHealth alignment.

## 1. Record 可信度原则

- Record displays must be derived from sanitized `history`.
- Historical sessions and set logs are preserved; high-risk history is flagged for review, not silently rewritten.
- `test` and `excluded` sessions remain visible in Record, but default analytics exclude them.
- User-facing Record copy must not expose internal ids, synthetic replacement ids, raw enum values, `undefined`, or `null`.

## 2. Summary 口径

- Detail Summary is computed from real session logs via `buildSessionDetailSummary(session, unitSettings)`.
- `done=true` working sets count as completed working sets.
- `done=false` working sets count as incomplete and do not enter completed sets, volume, PR, e1RM, or effective sets.
- Warmup sets are counted separately and never enter PR, e1RM, or effective sets.
- `identityInvalid` sets remain visible but do not enter PR, e1RM, or effective sets.
- Legacy cached summary fields are review signals only, not display truth.

## 3. 有效组解释原则

- Effective-set explanation explains the current effective-set result without changing scoring.
- `buildEffectiveSetExplanation(session)` must align with `buildSessionDetailSummary(session)`.
- Excluded rows must explain why completed working sets were not counted.
- Required Chinese reasons include incomplete sets, warmup sets, identity review, and test/excluded sessions.

## 4. editHistory 审计原则

- `editHistory` is audit-only and must not feed volume, effective sets, PR, e1RM, calendar, coach actions, or recommendations.
- Working-set edits record readable before/after text and affected stats such as volume, effective sets, PR, and e1RM.
- Warmup-only edits record `none` for affected stats and must not affect PR, e1RM, or effective sets.
- No-op saves and cancelled edits must not append audit entries or show success semantics.

## 5. Calendar / History / Detail 一致性原则

- Date grouping, month range, list sorting, selected-day details, and detail display use `getSessionCalendarDate(session)`.
- Calendar, history list, data-management rows, and detail drawer all use the same sanitized history source.
- Visible summaries in all Record surfaces are recalculated from set logs on demand.
- Deleting a session updates calendar markers, history rows, selected session, and detail state.
- Editing or changing `dataFlag` updates list/detail summaries and default analytics inclusion.

## 6. DataHealth 与 Record 对齐原则

- DataHealth history issues should route to the affected Record detail when the session exists.
- If a session cannot be found, the app falls back to the history list and shows a Chinese recovery message.
- DataHealth warnings must not contradict Record detail warnings.
- Technical details stay folded and may include ids; default UI copy must not expose internal ids.
- Dismissed issues hide for the current day and reappear the next day if still relevant.

## 7. 手动验收清单

| 验收项 | 操作 | 预期结果 | 通过 / 失败 | 备注 |
|---|---|---|---|---|
| 打开历史详情 | Record 中选择任意历史训练 | Calendar、list、detail 是同一 session，日期一致 |  |  |
| 查看 Summary | 对比顶部 Summary 和 set logs | 完成组、未完成组、热身组、有效组一致 |  |  |
| 查看有效组解释 | 展开“为什么有效组较少？” | 未计入组有中文原因 |  |  |
| 修正正式组 | 修改重量或次数并保存 | Summary 更新，editHistory 记录影响统计 |  |  |
| 修正热身组 | 修改热身重量并保存 | 热身量更新，不影响 PR/e1RM/有效组 |  |  |
| no-op 保存 | 不做改动直接保存 | 不新增 editHistory，不显示成功保存 |  |  |
| 删除训练 | 删除当天一条或最后一条记录 | Calendar marker 和 list 同步更新 |  |  |
| dataFlag 切换 | normal/test/excluded 来回切换 | 详情可见，默认 analytics inclusion 正确 |  |  |
| DataHealth 跳转 | 点击历史记录类 issue action | 定位到对应 Record detail 或安全 fallback |  |  |
| 真实 fixture 回归 | 运行自动测试 | `trainingRecordTrustFinalRegression.test.ts` 通过 |  |  |

## 8. 阶段 2 完成判定

- Record Summary 可信。
- 有效组解释可信。
- editHistory 可追踪。
- Calendar / History / Detail 一致。
- DataHealth 与 Record 对齐。
- 真实 fixture 回归通过。
