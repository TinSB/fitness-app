import { getEvidenceRule } from '../../content/evidenceRules';
import { buildCoachSentence, professionalFallback, sanitizeCopy } from '../../content/professionalCopy';
import type { EvidenceConfidence, ExplanationItem } from '../../models/training-model';

const RAW_TOKEN_PATTERN = /\b(undefined|null)\b/;

export const safeText = (value: unknown, fallback = '') => {
  const text = String(value ?? fallback).replace(RAW_TOKEN_PATTERN, '').replace(/\s+/g, ' ').trim();
  return text || fallback;
};

export const limitSentences = (text: string, maxSentences = 3) => {
  const normalized = safeText(text);
  const parts = normalized.split(/(?<=[。！？.!?])\s*/).filter(Boolean);
  return (parts.length ? parts.slice(0, maxSentences) : [normalized]).join('');
};

export const buildTemplate = (conclusion: string, reason?: string, action?: string) =>
  buildCoachSentence({
    conclusion: limitSentences(conclusion, 1),
    reason: reason ? limitSentences(reason, 1) : undefined,
    action: action ? limitSentences(action, 1) : undefined,
  });

export const formatMaybeDecimal = (value: number | undefined) => {
  if (!Number.isFinite(value)) return '0';
  const safe = Number(value);
  return Number.isInteger(safe) ? String(safe) : safe.toFixed(1);
};

export const formatExplainabilityConfidence = (confidence?: EvidenceConfidence) =>
  confidence === 'high' ? '高置信' : confidence === 'low' ? '低置信' : '中等置信';

export const makeExplanationItem = (
  title: string,
  conclusion: string,
  reason: string,
  action: string,
  evidenceRuleIds: string[] = [],
  confidence: ExplanationItem['confidence'] = 'moderate'
): ExplanationItem => {
  const primaryRule = evidenceRuleIds.map(getEvidenceRule).find(Boolean);
  return {
    title: safeText(title, '训练解释'),
    conclusion: safeText(conclusion),
    reason: safeText(reason || '当前记录没有明显限制信号。'),
    action: safeText(action || professionalFallback),
    evidenceRuleIds,
    confidence,
    caveat: primaryRule?.caveat,
  };
};

export const formatExplanationItem = (item: ExplanationItem) =>
  buildCoachSentence({
    conclusion: safeText(item.conclusion),
    reason: safeText(item.reason),
    action: safeText(item.action),
  });

export const hasUnsafeExplanationText = (text: string) => RAW_TOKEN_PATTERN.test(text) || !safeText(text);
