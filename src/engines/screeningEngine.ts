import { DEFAULT_SCREENING_PROFILE } from '../data/trainingData';
import type { ScreeningProfile } from '../models/training-model';

export const severityRank: Record<string, number> = { none: 0, mild: 1, moderate: 2, severe: 3, good: 0, limited: 1, poor: 2 };

export const ISSUE_LABELS: Record<string, string> = {
  upper_crossed: '上交叉',
  scapular_control: '肩胛控制',
  core_control: '核心控制',
  hip_stability: '髋稳定',
  ankle_mobility: '踝活动',
  squat_lean_forward: '深蹲前倾',
  hip_flexor_tightness: '髋屈肌紧张',
  lumbar_compensation: '腰代偿',
  thoracic_rotation: '胸椎旋转',
  overhead_press_restriction: '上举受限',
  breathing_ribcage: '呼吸与肋骨位置',
};

export const ISSUE_RULES = [
  { issue: 'upper_crossed', posture: ['forwardHead', 'roundedShoulders'] },
  { issue: 'scapular_control', movement: ['scapularControl', 'verticalPressTolerance'] },
  { issue: 'core_control', movement: ['trunkStability', 'ribCagePosition'] },
  { issue: 'hip_stability', movement: ['singleLegStability'], posture: ['dynamicKneeValgus'] },
  { issue: 'ankle_mobility', movement: ['ankleMobility'] },
  { issue: 'squat_lean_forward', movement: ['squatPattern'], posture: ['dynamicKneeValgus'] },
  { issue: 'hip_flexor_tightness', movement: ['hipFlexorLength'], posture: ['anteriorPelvicTilt'] },
  { issue: 'lumbar_compensation', movement: ['lumbarControl', 'hingePattern'] },
  { issue: 'thoracic_rotation', posture: ['thoracicKyphosis'], movement: ['thoracicRotation'] },
  { issue: 'overhead_press_restriction', movement: ['overheadMobility', 'verticalPressTolerance'] },
  { issue: 'breathing_ribcage', movement: ['ribCagePosition'] },
];

export const FUNCTIONAL_RULES = [
  { ability: 'single_leg_stability', movement: ['singleLegStability'], posture: ['dynamicKneeValgus'] },
  { ability: 'anti_rotation', movement: ['trunkStability', 'lumbarControl'] },
  { ability: 'carry_capacity', always: true },
  { ability: 'gait_bracing', movement: ['ankleMobility', 'singleLegStability'] },
  { ability: 'overhead_stability', movement: ['overheadMobility', 'verticalPressTolerance', 'scapularControl'] },
  { ability: 'balance', movement: ['singleLegStability', 'ankleMobility'] },
];

export const inferCorrectionPriority = (screening: ScreeningProfile = DEFAULT_SCREENING_PROFILE) => {
  const scored = new Map<string, number>();
  const pushScore = (issue: string, score: number) => scored.set(issue, (scored.get(issue) || 0) + score);

  ISSUE_RULES.forEach((rule) => {
    (rule.posture || []).forEach((key) => pushScore(rule.issue, severityRank[screening.postureFlags?.[key as keyof typeof screening.postureFlags] || 'none']));
    (rule.movement || []).forEach((key) => pushScore(rule.issue, severityRank[screening.movementFlags?.[key as keyof typeof screening.movementFlags] || 'good']));
  });

  Object.entries(screening.adaptiveState?.issueScores || {}).forEach(([issue, score]) => pushScore(issue, score));
  (screening.adaptiveState?.improvingIssues || []).forEach((issue) => pushScore(issue, -1.5));

  return [...scored.entries()]
    .filter(([, score]) => score > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([issue]) => issue)
    .slice(0, 4);
};

export const inferFunctionalPriorities = (screening: ScreeningProfile = DEFAULT_SCREENING_PROFILE) => {
  const scored = new Map<string, number>();

  FUNCTIONAL_RULES.forEach((rule) => {
    let score = rule.always ? 1 : 0;
    (rule.posture || []).forEach((key) => {
      score += severityRank[screening.postureFlags?.[key as keyof typeof screening.postureFlags] || 'none'];
    });
    (rule.movement || []).forEach((key) => {
      score += severityRank[screening.movementFlags?.[key as keyof typeof screening.movementFlags] || 'good'];
    });
    if (score > 0) scored.set(rule.ability, score);
  });

  return [...scored.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([ability]) => ability)
    .slice(0, 3);
};

export const screeningSummaryCards = (screening: ScreeningProfile = DEFAULT_SCREENING_PROFILE) => ({
  correctionPriority: inferCorrectionPriority(screening).map((issue) => ISSUE_LABELS[issue] || issue),
  functionalPriority: inferFunctionalPriorities(screening),
  adaptiveSignals: [
    ...(screening.adaptiveState?.performanceDrops || []).map((item) => `表现回落：${item}`),
    ...Object.entries(screening.adaptiveState?.painByExercise || {})
      .filter(([, count]) => count >= 2)
      .map(([exerciseId, count]) => `Pain flag：${exerciseId} x ${count}`),
    ...(screening.adaptiveState?.improvingIssues || []).map((issue) => `改善中：${ISSUE_LABELS[issue] || issue}`),
  ].slice(0, 6),
});
