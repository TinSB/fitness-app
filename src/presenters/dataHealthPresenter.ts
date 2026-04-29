import { sortDataHealthIssues, type DataHealthIssue, type DataHealthReport } from '../engines/dataHealthEngine';

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
  actionLabel?: string;
  technicalDetails?: string;
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

const matchIssueCopy = (issue: DataHealthIssue): Pick<DataHealthIssueView, 'title' | 'userMessage' | 'actionLabel'> => {
  const id = issue.id.toLowerCase();

  if (id.startsWith('synthetic-replacement')) {
    return {
      title: '替代动作记录异常',
      userMessage: '有训练记录使用了旧版替代动作标记，可能影响该动作的历史显示。',
      actionLabel: '打开历史详情确认替代动作',
    };
  }
  if (id.startsWith('lb-display-decimal')) {
    return {
      title: '重量显示需要整理',
      userMessage: '部分历史记录的磅数显示存在小数，系统会按当前单位设置格式化显示。',
      actionLabel: '检查单位显示',
    };
  }
  if (id.startsWith('summary-completed-zero') || id.startsWith('summary-volume-zero') || issue.category === 'summary') {
    return {
      title: '训练汇总可能过期',
      userMessage: '某次训练的顶部汇总和组记录不一致，建议打开该记录确认。',
      actionLabel: '查看训练详情',
    };
  }
  if (id.startsWith('warmup-missing-type')) {
    return {
      title: '热身组分类不完整',
      userMessage: '部分历史组缺少热身/正式组标记，可能影响历史详情展示。',
      actionLabel: '修正历史记录',
    };
  }
  if (id.startsWith('warmup-analytics-marker')) {
    return {
      title: '热身组统计标记异常',
      userMessage: '部分热身组可能被计入强度统计，建议检查该记录的组类型。',
      actionLabel: '检查组类型',
    };
  }
  if (id.startsWith('excluded-session-in-analytics') || id.startsWith('non-normal-session-present')) {
    return {
      title: '测试数据可能参与统计',
      userMessage: '有测试或排除数据可能被计入训练分析，请检查数据状态。',
      actionLabel: '检查数据状态',
    };
  }
  if (id.startsWith('external-workout-in-history')) {
    return {
      title: '外部活动记录分类异常',
      userMessage: '有 Apple Watch 或外部运动记录可能被误归入力量训练历史。',
      actionLabel: '检查外部活动',
    };
  }
  if (id.startsWith('missing-actual-exercise') || id.startsWith('replacement-missing-original') || id.startsWith('replacement-actual-mismatch')) {
    return {
      title: '替代动作信息不完整',
      userMessage: '有训练记录的实际执行动作无法在动作库中找到。',
      actionLabel: '确认实际执行动作',
    };
  }
  if (id.startsWith('mixed-display-unit')) {
    return {
      title: '单位显示不一致',
      userMessage: '同一次训练中存在不同显示单位，请确认是否为真实记录。',
      actionLabel: '检查重量单位',
    };
  }
  if (id.startsWith('template-missing') || id.startsWith('program-template-missing')) {
    return {
      title: '计划动作缺失',
      userMessage: '某个计划模板引用了动作库中不存在的动作。',
      actionLabel: '检查计划模板',
    };
  }
  if (id.startsWith('excluded-health-readiness') || id.startsWith('excluded-workout-readiness')) {
    return {
      title: '健康数据排除状态异常',
      userMessage: '被排除的健康数据不应影响准备度评分。',
      actionLabel: '检查健康数据',
    };
  }

  if (issue.category === 'replacement') {
    return {
      title: '替代动作记录需要检查',
      userMessage: '有替代动作记录信息不完整，可能影响历史回看。',
      actionLabel: '查看详情',
    };
  }
  if (issue.category === 'unit') {
    return {
      title: '单位记录需要检查',
      userMessage: '部分重量单位显示可能不一致，请确认是否符合你的记录习惯。',
      actionLabel: '查看详情',
    };
  }
  if (issue.category === 'healthData') {
    return {
      title: '健康数据需要检查',
      userMessage: '部分健康数据状态可能影响准备度或日历展示。',
      actionLabel: '查看详情',
    };
  }
  if (issue.category === 'template') {
    return {
      title: '计划模板需要检查',
      userMessage: '计划模板中有动作引用需要确认。',
      actionLabel: '查看详情',
    };
  }

  return {
    title: '数据记录需要检查',
    userMessage: '发现一条可能影响训练回看的数据问题。',
    actionLabel: '查看详情',
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
    actionLabel: copy.actionLabel,
    technicalDetails: technicalDetails(issue),
  };
};

export const buildDataHealthViewModel = (report: DataHealthReport): DataHealthViewModel => {
  const issues = sortDataHealthIssues(report.issues || []).map(toIssueView);
  const status = statusTone(report.status);
  const summary =
    report.status === 'healthy'
      ? '未发现会影响训练统计的问题。'
      : `发现 ${issues.length} 条需要检查的数据问题。所有项目只提示，不会自动修改你的数据。`;

  return {
    statusLabel: statusLabel(report.status),
    statusTone: status,
    summary,
    primaryIssues: issues.slice(0, 3),
    secondaryIssues: issues.slice(3),
  };
};
