import {
  filterDismissedDataHealthIssues,
  sortDataHealthIssues,
  type DataHealthIssue,
  type DataHealthReport,
} from '../engines/dataHealthEngine';
import type { DismissedDataHealthIssue } from '../models/training-model';

export type DataHealthActionType =
  | 'open_session_detail'
  | 'open_record_history'
  | 'open_record_data'
  | 'open_health_data'
  | 'open_unit_settings'
  | 'open_plan'
  | 'open_backup'
  | 'dismiss'
  | 'none';

export type DataHealthActionView = {
  id: string;
  label: string;
  type: DataHealthActionType;
  issueId?: string;
  targetId?: string;
  targetDate?: string;
  requiresConfirmation?: boolean;
};

export type DataHealthViewModel = {
  statusLabel: string;
  statusTone: 'healthy' | 'warning' | 'error';
  summary: string;
  primaryIssues: DataHealthIssueView[];
  secondaryIssues: DataHealthIssueView[];
};

export type DataHealthIssueView = {
  id: string;
  title: string;
  userMessage: string;
  severityLabel: string;
  action?: DataHealthActionView;
  dismissAction?: DataHealthActionView;
  technicalDetails?: string;
};

export type DataHealthViewModelOptions = {
  dismissedIssues?: DismissedDataHealthIssue[];
  currentDate?: string;
};

const severityLabel = (severity: DataHealthIssue['severity']) => {
  if (severity === 'error') return '需要处理';
  if (severity === 'warning') return '建议复查';
  return '提示';
};

const statusTone = (status: DataHealthReport['status']): DataHealthViewModel['statusTone'] => {
  if (status === 'has_errors') return 'error';
  if (status === 'has_warnings') return 'warning';
  return 'healthy';
};

const statusLabel = (status: DataHealthReport['status']) => {
  if (status === 'has_errors') return '需要处理';
  if (status === 'has_warnings') return '建议复查';
  return '健康';
};

const normalizeText = (value?: string) => String(value || '').replace(/\b(undefined|null)\b/g, '').trim();

const firstAffectedId = (issue: DataHealthIssue) => issue.affectedIds?.find(Boolean);

const severityRank: Record<DataHealthIssue['severity'], number> = {
  error: 3,
  warning: 2,
  info: 1,
};

const aggregateIssueKey = (issue: DataHealthIssue) => {
  const id = issue.id.toLowerCase();
  if (id.startsWith('exercise-identity-review')) return 'history-identity-review';
  if (id.startsWith('invalid-exercise-reference') || id.startsWith('missing-actual-exercise')) return 'invalid-exercise-reference';
  if (id.startsWith('incomplete-draft-set')) return 'incomplete-draft-sets';
  if (id.startsWith('summary-') || id.startsWith('incomplete-counted-in-summary') || id.startsWith('warmup-counted-effective')) return 'summary-mismatch';
  if (id.startsWith('display-weight-without-actual-kg') || id.startsWith('lb-display-decimal') || id.startsWith('mixed-display-unit')) return 'unit-history-review';
  if (id.startsWith('duplicate-session-timestamp')) return 'duplicate-session-timestamp';
  if (id.startsWith('excluded-session-in-analytics') || id.startsWith('non-normal-session-present')) return 'test-excluded-stat-participation';
  if (id.startsWith('warmup-missing-type') || id.startsWith('warmup-analytics-marker')) return 'warmup-stat-participation';
  if (id.startsWith('synthetic-replacement')) return 'synthetic-replacement';
  return issue.id;
};

export const aggregateDataHealthIssuesForDisplay = (issues: DataHealthIssue[] = []): DataHealthIssue[] => {
  const groups = new Map<string, DataHealthIssue[]>();
  issues.forEach((issue) => {
    const key = aggregateIssueKey(issue);
    const group = groups.get(key) || [];
    group.push(issue);
    groups.set(key, group);
  });

  return [...groups.entries()].flatMap(([key, group]) => {
    if (group.length === 1) return group;
    const sorted = sortDataHealthIssues(group);
    const primary = sorted[0];
    const severity = sorted.reduce<DataHealthIssue['severity']>(
      (current, item) => (severityRank[item.severity] > severityRank[current] ? item.severity : current),
      primary.severity,
    );
    return [{
      ...primary,
      id: `aggregate-${key}`,
      severity,
      message: `${group.length} 条同类问题已合并显示。${normalizeText(primary.message)}`,
      affectedIds: [...new Set(group.flatMap((item) => item.affectedIds || []))],
      suggestedAction: primary.suggestedAction,
    }];
  });
};

const action = (
  issue: DataHealthIssue,
  type: DataHealthActionType,
  label: string,
  targetId = firstAffectedId(issue),
): DataHealthActionView | undefined => {
  if (type === 'none') return undefined;
  return {
    id: `${issue.id}-${type}`,
    label,
    type,
    issueId: issue.id,
    ...(targetId ? { targetId } : {}),
  };
};

const dismissAction = (issue: DataHealthIssue): DataHealthActionView => ({
  id: `${issue.id}-dismiss`,
  label: '暂不处理',
  type: 'dismiss',
  issueId: issue.id,
});

const matchIssueCopy = (issue: DataHealthIssue): Pick<DataHealthIssueView, 'title' | 'userMessage' | 'action'> => {
  const id = issue.id.toLowerCase();

  if (id.startsWith('aggregate-history-identity-review') || id.startsWith('exercise-identity-review')) {
    return {
      title: '动作记录身份需要检查',
      userMessage: '部分历史记录来自旧版替代动作逻辑，系统已保留原始记录，但不会把它用于 PR、e1RM 或有效组。',
      action: action(issue, 'open_session_detail', '查看相关训练'),
    };
  }
  if (id.startsWith('aggregate-incomplete-draft-sets') || id.startsWith('incomplete-draft-set')) {
    return {
      title: '存在未完成草稿组',
      userMessage: '部分组有重量、次数或 RIR，但仍是未完成状态。它们只应显示为草稿，不参与完成组、总量、PR、e1RM 或有效组。',
      action: action(issue, 'open_session_detail', '查看历史训练'),
    };
  }
  if (
    id.startsWith('aggregate-summary-mismatch') ||
    id.startsWith('summary-completed-mismatch') ||
    id.startsWith('summary-volume-mismatch') ||
    id.startsWith('summary-effective-mismatch') ||
    id.startsWith('incomplete-counted-in-summary') ||
    id.startsWith('warmup-counted-effective')
  ) {
    return {
      title: '历史 Summary 与组记录不一致',
      userMessage: '部分历史记录的顶部汇总和真实 set logs 不一致。Record 会按真实组记录重新计算，请打开详情复查。',
      action: action(issue, 'open_session_detail', '查看训练详情'),
    };
  }
  if (id.startsWith('aggregate-unit-history-review') || id.startsWith('display-weight-without-actual-kg')) {
    return {
      title: '历史重量记录需要检查',
      userMessage: '部分历史组缺少用于计算的重量来源。系统不会用旧显示重量替代真实计算重量。',
      action: action(issue, 'open_unit_settings', '打开单位设置'),
    };
  }
  if (id.startsWith('aggregate-invalid-exercise-reference') || id.startsWith('invalid-exercise-reference')) {
    return {
      title: '历史动作引用需要检查',
      userMessage: '部分历史记录引用了动作库中不存在的动作。系统会保留原始记录，但不会把它用于 PR、e1RM 或有效组。',
      action: action(issue, 'open_session_detail', '查看相关训练'),
    };
  }
  if (id.startsWith('aggregate-duplicate-session-timestamp') || id.startsWith('duplicate-session-timestamp')) {
    return {
      title: '发现疑似重复训练记录',
      userMessage: '部分历史训练的开始、结束时间和模板相同。系统不会自动删除，请先人工确认。',
      action: action(issue, 'open_session_detail', '查看历史训练'),
    };
  }
  if (id.startsWith('aggregate-test-excluded-stat-participation')) {
    return {
      title: '测试或排除数据需要检查',
      userMessage: '测试或排除训练可以继续查看，但默认不应参与 PR、e1RM、有效组或统计。',
      action: action(issue, 'open_session_detail', '查看历史训练'),
    };
  }
  if (id.startsWith('aggregate-warmup-stat-participation')) {
    return {
      title: '热身组统计状态需要检查',
      userMessage: '部分热身组可能缺少分类或带有强度统计标记。热身组不应进入 PR、e1RM 或有效组。',
      action: action(issue, 'open_session_detail', '查看训练详情'),
    };
  }
  if (id.startsWith('synthetic-replacement')) {
    return {
      title: '替代动作记录异常',
      userMessage: '有训练记录使用了旧版替代动作标记，可能影响该动作的历史显示。',
      action: action(issue, 'open_session_detail', '查看相关训练'),
    };
  }
  if (id.startsWith('lb-display-decimal')) {
    return {
      title: '重量显示需要整理',
      userMessage: '部分历史记录的磅数显示存在小数，系统会按当前单位设置格式化显示。',
      action: action(issue, 'open_unit_settings', '打开单位设置'),
    };
  }
  if (id.startsWith('summary-completed-zero') || id.startsWith('summary-volume-zero') || issue.category === 'summary') {
    return {
      title: '训练汇总可能过期',
      userMessage: '某次训练的顶部汇总和组记录不一致，建议打开该记录确认。',
      action: action(issue, 'open_session_detail', '查看训练详情'),
    };
  }
  if (id.startsWith('warmup-missing-type')) {
    return {
      title: '热身组分类不完整',
      userMessage: '部分历史组缺少热身/正式组标记，可能影响历史详情展示。',
      action: action(issue, 'open_session_detail', '查看训练详情'),
    };
  }
  if (id.startsWith('warmup-analytics-marker')) {
    return {
      title: '热身组统计标记异常',
      userMessage: '部分热身组可能被计入强度统计，建议检查该记录的组类型。',
      action: action(issue, 'open_session_detail', '查看训练详情'),
    };
  }
  if (id.startsWith('excluded-session-in-analytics') || id.startsWith('non-normal-session-present')) {
    return {
      title: '测试数据可能参与统计',
      userMessage: '有测试或排除数据可能被计入训练分析，请检查数据状态。',
      action: action(issue, 'open_session_detail', '查看历史训练'),
    };
  }
  if (id.startsWith('external-workout-in-history')) {
    return {
      title: '外部活动记录分类异常',
      userMessage: '有 Apple Watch 或外部运动记录可能被误归入力量训练历史。',
      action: action(issue, 'open_health_data', '查看健康数据'),
    };
  }
  if (id.startsWith('missing-actual-exercise') || id.startsWith('replacement-missing-original') || id.startsWith('replacement-actual-mismatch')) {
    return {
      title: '替代动作信息不完整',
      userMessage: '有训练记录的实际执行动作无法在动作库中找到。',
      action: action(issue, 'open_session_detail', '查看相关训练'),
    };
  }
  if (id.startsWith('mixed-display-unit')) {
    return {
      title: '单位显示不一致',
      userMessage: '同一次训练中存在不同显示单位，请确认是否为真实记录。',
      action: action(issue, 'open_unit_settings', '打开单位设置'),
    };
  }
  if (id.startsWith('template-missing') || id.startsWith('program-template-missing')) {
    return {
      title: '计划动作缺失',
      userMessage: '某个计划模板引用了动作库中不存在的动作。',
      action: action(issue, 'open_plan', '打开计划页'),
    };
  }
  if (id.startsWith('excluded-health-readiness') || id.startsWith('excluded-workout-readiness')) {
    return {
      title: '健康数据排除状态异常',
      userMessage: '被排除的健康数据不应影响准备度评分。',
      action: action(issue, 'open_health_data', '查看健康数据'),
    };
  }
  if (id.startsWith('backup')) {
    return {
      title: '建议导出备份',
      userMessage: '当前数据建议先导出备份，再进行修正或整理。',
      action: action(issue, 'open_backup', '导出备份'),
    };
  }

  if (issue.category === 'replacement') {
    return {
      title: '替代动作记录需要检查',
      userMessage: '有替代动作记录信息不完整，可能影响历史回看。',
      action: action(issue, 'open_session_detail', '查看相关训练'),
    };
  }
  if (issue.category === 'unit') {
    return {
      title: '单位记录需要检查',
      userMessage: '部分重量单位显示可能不一致，请确认是否符合你的记录习惯。',
      action: action(issue, 'open_unit_settings', '打开单位设置'),
    };
  }
  if (issue.category === 'healthData') {
    return {
      title: '健康数据需要检查',
      userMessage: '部分健康数据状态可能影响准备度或日历展示。',
      action: action(issue, 'open_health_data', '查看健康数据'),
    };
  }
  if (issue.category === 'template') {
    return {
      title: '计划模板需要检查',
      userMessage: '计划模板中有动作引用需要确认。',
      action: action(issue, 'open_plan', '打开计划页'),
    };
  }

  return {
    title: '数据记录需要检查',
    userMessage: '发现一条可能影响训练回看的数据问题。',
  };
};

const technicalDetails = (issue: DataHealthIssue) => {
  const details = [
    `技术详情：${issue.id}`,
    `原始标题：${normalizeText(issue.title)}`,
    `原始说明：${normalizeText(issue.message)}`,
    issue.affectedIds?.length ? `相关记录：${issue.affectedIds.join('、')}` : '',
    issue.suggestedAction ? `建议操作：${normalizeText(issue.suggestedAction)}` : '',
  ].filter(Boolean);
  return details.join('\n');
};

const toIssueView = (issue: DataHealthIssue): DataHealthIssueView => {
  const copy = matchIssueCopy(issue);
  return {
    id: issue.id,
    title: copy.title,
    userMessage: copy.userMessage,
    severityLabel: severityLabel(issue.severity),
    action: copy.action,
    dismissAction: dismissAction(issue),
    technicalDetails: technicalDetails(issue),
  };
};

export const buildDataHealthViewModel = (report: DataHealthReport, options: DataHealthViewModelOptions = {}): DataHealthViewModel => {
  const rawFilteredIssues = filterDismissedDataHealthIssues(
    report.issues || [],
    options.dismissedIssues || [],
    options.currentDate || '',
  );
  const aggregatedIssues = aggregateDataHealthIssuesForDisplay(rawFilteredIssues);
  const filteredIssues = filterDismissedDataHealthIssues(
    aggregatedIssues,
    options.dismissedIssues || [],
    options.currentDate || '',
  );
  const issues = sortDataHealthIssues(filteredIssues).map(toIssueView);
  const status = statusTone(report.status);
  const summary =
    report.status === 'healthy'
      ? '未发现会影响训练统计的问题。'
      : issues.length
        ? `发现 ${issues.length} 条需要检查的数据问题。所有项目只提示，不会自动修改你的数据。`
        : '暂无待处理数据健康问题。';

  return {
    statusLabel: statusLabel(report.status),
    statusTone: status,
    summary,
    primaryIssues: issues.slice(0, 3),
    secondaryIssues: issues.slice(3),
  };
};
