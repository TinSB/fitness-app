# IronPath 训练执行 QA 清单

本清单用于在手机 Safari / PWA 和桌面端手动验证真实训练链路。每次发布前至少跑一遍手机端关键路径：开始训练 -> 记录组 -> 替代/不适/support -> 保存 -> 历史回看。

## 1. 开始训练
- 操作步骤：打开“今日”，点击“开始训练”；若已有未完成训练，再次点击开始。
- 期望结果：无 activeSession 时创建新训练；已有 activeSession 时显示继续训练或确认，不静默覆盖。
- 失败检查：`App.tsx`、`sessionBuilder.ts`、`TrainingView.tsx`、`TodayView.tsx`、persistence activeSession。

## 2. 热身组顺序
- 操作步骤：进入 Focus Mode，完成热身组 1，再完成热身组 2、3。
- 期望结果：严格按热身 1 -> 2 -> 3；不跳号，不回退。
- 失败检查：`focusModeStateEngine.ts`、`warmupPolicyEngine.ts`、`TrainingFocusView.tsx`。

## 3. 正式组顺序
- 操作步骤：完成最后一个热身组后继续完成正式组。
- 期望结果：进入正式组 1，然后正式组 2、3；动作完成后进入下一个未完成动作。
- 失败检查：`buildFocusStepQueue()`、`completeFocusSet()`、`getCurrentFocusStep()`。

## 4. +重量 / -重量
- 操作步骤：在实际记录区点击 -10/-5/-2.5/+2.5/+5/+10 或 lb 模式对应按钮。
- 期望结果：只修改当前 actual draft，推荐重量不变；重量不低于 0。
- 失败检查：`adjustFocusSetValue()`、`updateFocusActualDraft()`、`TrainingFocusView.tsx`。

## 5. +次数 / -次数
- 操作步骤：点击 -5/-1/+1/+5。
- 期望结果：只修改当前 actual reps，推荐次数不变；次数不低于 0。
- 失败检查：`actualSetDraft`、`TrainingFocusView.tsx`。

## 6. 自定义重量输入
- 操作步骤：点击重量数字，输入 kg 或 lb 数值并确认。
- 期望结果：显示用户单位；内部保存 kg；刷新后 draft 不丢。
- 失败检查：`unitConversionEngine.ts`、`updateFocusActualDraft()`、persistence。

## 7. 套用建议
- 操作步骤：点击“套用建议”。
- 期望结果：推荐重量/次数复制到 actual draft；推荐处方本身不被改写。
- 失败检查：`applySuggestedFocusStep()`、`TrainingFocusView.tsx`。

## 8. 复制上组
- 操作步骤：完成当前动作第 1 组后，在第 2 组点击“复制上组”。
- 期望结果：当前 draft 复制上一组重量、次数、RIR、动作质量；没有上一组时提示“暂无上一组可复制”。
- 失败检查：`copyPreviousFocusActualDraft()`、Focus Mode feedback。

## 9. 替代动作
- 操作步骤：点击“替代动作”，选择哑铃卧推/胸推机等替代动作。
- 期望结果：面板打开；选择后当前动作立即更新；activeSession 保存 original/actual/replacement ids；历史显示原计划和实际执行。
- 失败检查：`replacementEngine.ts`、`TrainingFocusView.tsx`、`ProgressView.tsx`、`e1rmEngine.ts`。

## 10. 标记不适
- 操作步骤：当前组点击“标记不适”，再点击一次。
- 期望结果：立即反馈；第一次写入 painFlag，第二次取消或明确提示；不适组不生成高质量 PR/高置信 e1RM。
- 失败检查：`updateFocusActualDraft()`、`completeFocusSet()`、`analytics.ts`、`e1rmEngine.ts`。

## 11. 动作质量
- 操作步骤：选择“良好 / 可接受 / 较差”后完成一组。
- 期望结果：set log 保存 techniqueQuality；较差动作质量不计高质量 PR，并降低有效组置信度。
- 失败检查：`completeFocusSet()`、`effectiveSetEngine.ts`、`analytics.ts`、formatter。

## 12. 纠偏模块
- 操作步骤：进入训练后完成或跳过纠偏动作。
- 期望结果：纠偏 steps 在主训练前；完成/跳过写入 supportExerciseLogs；不计入主训练 PR。
- 失败检查：`buildFocusStepQueue()`、`completeFocusSupportStep()`、`skipFocusSupportStep()`。

## 13. 功能补丁
- 操作步骤：完成主训练后完成或跳过功能补丁。
- 期望结果：功能 steps 在主训练后；完成/跳过写入 supportExerciseLogs；Focus/完整训练页状态一致。
- 失败检查：`supportExerciseLogs`、`skipFocusSupportBlock()`、`TrainingView.tsx`。

## 14. 休息计时器
- 操作步骤：完成一组后锁屏/切后台/刷新，再回到训练。
- 期望结果：使用 startedAt + durationSec 计算剩余时间；过期显示休息结束。
- 失败检查：`restTimerEngine.ts`、session `restTimerState` persistence。

## 15. 完成训练
- 操作步骤：完成所有 correction/main/functional steps，点击“保存并结束训练”。
- 期望结果：进入完成状态；保存后 activeSession 清空，session 写入 history。
- 失败检查：`trainingCompletionEngine.ts`、`App.tsx`、`TrainingFocusView.tsx`。

## 16. 历史详情
- 操作步骤：进入“记录 -> 历史”，打开刚保存的训练。
- 期望结果：显示日期、模板、热身/正式组、support、原计划动作和实际执行动作。
- 失败检查：`ProgressView.tsx`、`trainingCalendarEngine.ts`、formatter。

## 17. 删除训练
- 操作步骤：在历史详情点击删除并确认。
- 期望结果：必须二次确认；删除后 history 移除，日历/e1RM/PR/有效组重新计算。
- 失败检查：`sessionHistoryEngine.ts`、`Record/ProgressView` callbacks。

## 18. 标记测试
- 操作步骤：将历史训练标记为测试数据。
- 期望结果：UI 仍可查看；默认 analytics、PR、e1RM、日历统计排除。
- 失败检查：`markSessionDataFlag()`、`filterAnalyticsHistory()`、`buildTrainingCalendar()`。

## 19. 恢复正常
- 操作步骤：把测试训练恢复为正常数据。
- 期望结果：重新参与 analytics、PR、e1RM、日历统计。
- 失败检查：`sessionHistoryEngine.ts`、`effectiveSetEngine.ts`、`e1rmEngine.ts`。

## 20. 刷新页面恢复 activeSession
- 操作步骤：训练中调整 actual draft、完成部分 step、替代动作后刷新页面。
- 期望结果：activeSession、当前 step、actual draft、restTimer、替代动作状态都恢复。
- 失败检查：`storage/persistence.ts`、`focusModeStateEngine.ts`、`replacementEngine.ts`。

