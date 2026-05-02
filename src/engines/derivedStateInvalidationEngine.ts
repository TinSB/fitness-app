export type AppMutationEvent =
  | 'session_completed'
  | 'session_edited'
  | 'session_deleted'
  | 'session_dataflag_changed'
  | 'template_applied'
  | 'template_rolled_back'
  | 'coach_action_dismissed'
  | 'data_health_issue_dismissed'
  | 'pending_patch_created'
  | 'pending_patch_consumed'
  | 'pending_patch_dismissed'
  | 'health_data_imported'
  | 'unit_changed'
  | 'replacement_applied'
  | 'backup_restored';

export type InvalidationResult = {
  invalidateToday: boolean;
  invalidatePlan: boolean;
  invalidateRecord: boolean;
  invalidateAnalytics: boolean;
  invalidateCoachActions: boolean;
  reason: string;
};

const result = (flags: Omit<InvalidationResult, 'reason'>, reason: string): InvalidationResult => ({
  ...flags,
  reason,
});

export function buildDerivedStateInvalidation(event: AppMutationEvent): InvalidationResult {
  if (event === 'session_completed') {
    return result(
      {
        invalidateToday: true,
        invalidatePlan: false,
        invalidateRecord: true,
        invalidateAnalytics: true,
        invalidateCoachActions: true,
      },
      '训练完成后，今日状态、记录、统计和教练建议需要重新计算。',
    );
  }
  if (event === 'session_edited' || event === 'session_deleted' || event === 'session_dataflag_changed') {
    return result(
      {
        invalidateToday: event !== 'session_edited',
        invalidatePlan: false,
        invalidateRecord: true,
        invalidateAnalytics: true,
        invalidateCoachActions: true,
      },
      '历史记录变更后，记录页、训练统计和教练建议需要重新计算。',
    );
  }
  if (event === 'template_applied') {
    return result(
      {
        invalidateToday: true,
        invalidatePlan: true,
        invalidateRecord: false,
        invalidateAnalytics: false,
        invalidateCoachActions: true,
      },
      '应用实验模板后，今日建议、计划页和教练建议需要重新计算。',
    );
  }
  if (event === 'template_rolled_back') {
    return result(
      {
        invalidateToday: true,
        invalidatePlan: true,
        invalidateRecord: false,
        invalidateAnalytics: false,
        invalidateCoachActions: true,
      },
      '回滚模板后，今日建议、计划页和教练建议需要重新计算。',
    );
  }
  if (event === 'coach_action_dismissed') {
    return result(
      {
        invalidateToday: true,
        invalidatePlan: true,
        invalidateRecord: false,
        invalidateAnalytics: false,
        invalidateCoachActions: true,
      },
      '暂不处理教练建议后，今日和计划中的可见建议需要重新过滤。',
    );
  }
  if (event === 'data_health_issue_dismissed') {
    return result(
      {
        invalidateToday: false,
        invalidatePlan: false,
        invalidateRecord: true,
        invalidateAnalytics: false,
        invalidateCoachActions: false,
      },
      '暂不处理数据健康问题后，记录和我的页面中的可见问题需要重新过滤。',
    );
  }
  if (event === 'pending_patch_created' || event === 'pending_patch_dismissed') {
    return result(
      {
        invalidateToday: true,
        invalidatePlan: false,
        invalidateRecord: false,
        invalidateAnalytics: false,
        invalidateCoachActions: true,
      },
      '本次临时调整状态变更后，今日页和教练建议需要重新计算。',
    );
  }
  if (event === 'pending_patch_consumed') {
    return result(
      {
        invalidateToday: true,
        invalidatePlan: false,
        invalidateRecord: false,
        invalidateAnalytics: false,
        invalidateCoachActions: true,
      },
      '本次临时调整已进入训练，今日页、训练页和教练建议需要重新计算。',
    );
  }
  if (event === 'health_data_imported') {
    return result(
      {
        invalidateToday: true,
        invalidatePlan: false,
        invalidateRecord: false,
        invalidateAnalytics: false,
        invalidateCoachActions: true,
      },
      '导入健康数据后，准备度、今日建议和教练建议需要重新计算。',
    );
  }
  if (event === 'unit_changed') {
    return result(
      {
        invalidateToday: true,
        invalidatePlan: true,
        invalidateRecord: true,
        invalidateAnalytics: false,
        invalidateCoachActions: false,
      },
      '单位切换只影响显示层换算，内部训练重量仍按公斤保存。',
    );
  }
  if (event === 'backup_restored') {
    return result(
      {
        invalidateToday: true,
        invalidatePlan: true,
        invalidateRecord: true,
        invalidateAnalytics: true,
        invalidateCoachActions: true,
      },
      '瀵煎叆鎴栨仮澶囨暟鎹悗锛屼粖鏃ャ€佽鍒掋€佽褰曘€佺粺璁″拰鏁欑粌寤鸿闇€瑕侀噸鏂拌绠椼€?',
    );
  }
  return result(
    {
      invalidateToday: true,
      invalidatePlan: false,
      invalidateRecord: true,
      invalidateAnalytics: true,
      invalidateCoachActions: true,
    },
    '替代动作会影响本次训练记录、历史统计和相关教练建议，需要重新计算。',
  );
}
