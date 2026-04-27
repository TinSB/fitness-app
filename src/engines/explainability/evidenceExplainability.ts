import { getEvidenceAuthority } from '../../content/evidenceAuthorities';
import { formatEvidenceRuleLabel, getEvidenceRule } from '../../content/evidenceRules';
import type { ExplanationItem } from '../../models/training-model';
import { buildTemplate, safeText } from './shared';

export const formatEvidenceTierLabel = (tier: unknown) =>
  (
    {
      A: '直接权威依据',
      B: '研究支持规则',
      C: '产品化辅助规则',
    } as const
  )[String(tier)] || '依据等级未标注';

export const formatEvidenceImplementationTypeLabel = (value: unknown) =>
  (
    {
      direct_guideline: '指南直接支持',
      research_supported: '研究支持',
      product_heuristic: '产品化估算',
    } as const
  )[String(value)] || '实现方式未标注';

export const formatAuthorityLevelLabel = (value: unknown) =>
  (
    {
      highest: '最高权威',
      high: '高权威',
      professional_standard: '专业标准',
      contextual: '背景参考',
      market_only: '行业市场参考',
    } as const
  )[String(value)] || '来源级别未标注';

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

  const authorities = rule.authorityIds
    .map(getEvidenceAuthority)
    .filter(Boolean)
    .map((authority) => `${authority.name}（${formatAuthorityLevelLabel(authority.authorityLevel)}）`);
  const sourceText = authorities.length ? authorities.join(' / ') : '本地证据库';

  return buildTemplate(
    `${formatEvidenceRuleLabel(rule.id)}：${formatEvidenceTierLabel(rule.evidenceTier)}`,
    `依据：${sourceText}；${formatEvidenceImplementationTypeLabel(rule.implementationType)}。${safeText(rule.practicalSummary)}`,
    `边界：${safeText(rule.caveat || '该依据用于辅助训练决策，不替代你的实际反馈。')}`,
  );
};

export const formatEvidenceSourceBoundary = (ruleId: string) => {
  const rule = getEvidenceRule(ruleId);
  return rule?.caveat || '当前依据没有额外适用边界说明。';
};
