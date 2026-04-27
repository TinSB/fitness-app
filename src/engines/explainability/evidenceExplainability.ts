import { formatEvidenceRuleLabel, getEvidenceRule } from '../../content/evidenceRules';
import type { ExplanationItem } from '../../models/training-model';
import { buildTemplate, formatExplainabilityConfidence } from './shared';

export const formatExplanationEvidence = (item: ExplanationItem) =>
  (item.evidenceRuleIds || []).map((id) => formatEvidenceRuleLabel(id)).filter(Boolean);

export const buildEvidenceRuleExplanation = (ruleId: string) => {
  const rule = getEvidenceRule(ruleId);
  if (!rule) {
    return buildTemplate(
      '当前依据暂未收录',
      '依据：这条规则还没有进入本地 evidenceRules。',
      '边界：先按已有训练记录和人工判断处理。',
    );
  }

  return buildTemplate(
    `${formatEvidenceRuleLabel(rule.id)}：${formatExplainabilityConfidence(rule.confidence)}`,
    `依据：${rule.practicalSummary}`,
    `边界：${rule.caveat || '该依据用于辅助训练决策，不替代你的实际反馈。'}`,
  );
};

export const formatEvidenceSourceBoundary = (ruleId: string) => {
  const rule = getEvidenceRule(ruleId);
  return rule?.caveat || '当前依据没有额外适用边界说明。';
};
