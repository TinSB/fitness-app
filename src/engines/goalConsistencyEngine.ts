import type { AppData, PrimaryGoal, TrainingMode } from '../models/training-model';

export type CanonicalPrimaryGoal = PrimaryGoal | 'fat_loss_support';
export type CanonicalTrainingMode = TrainingMode;

export type GoalModeAuditResult = {
  primaryGoal: CanonicalPrimaryGoal;
  trainingMode: CanonicalTrainingMode;
  mesocycleGoal?: CanonicalPrimaryGoal;
  isConsistent: boolean;
  warnings: string[];
  explanation: string;
};

const normalizeToken = (value: unknown) => String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_');

export const normalizePrimaryGoal = (value: unknown, fallback: PrimaryGoal = 'hypertrophy'): PrimaryGoal => {
  const text = String(value || '').trim();
  const token = normalizeToken(value);
  if (
    text === '增肌' ||
    text === '肌肥大' ||
    token === 'hypertrophy' ||
    token === 'muscle_gain' ||
    token === 'musclegrowth' ||
    token === 'muscle_growth'
  ) {
    return 'hypertrophy';
  }
  if (text === '减脂' || token === 'fat_loss' || token === 'fatloss') return 'fat_loss';
  if (text === '力量' || token === 'strength') return 'strength';
  return ['hypertrophy', 'strength', 'fat_loss'].includes(token) ? (token as PrimaryGoal) : fallback;
};

export const normalizeTrainingMode = (value: unknown, fallback: TrainingMode = 'hybrid'): TrainingMode => {
  const text = String(value || '').trim();
  const token = normalizeToken(value);
  if (
    text === '增肌' ||
    text === '肌肥大' ||
    token === 'hypertrophy' ||
    token === 'muscle_gain' ||
    token === 'musclegrowth' ||
    token === 'muscle_growth'
  ) {
    return 'hypertrophy';
  }
  if (text === '力量' || token === 'strength') return 'strength';
  if (text === '综合' || token === 'hybrid') return 'hybrid';
  return ['hybrid', 'strength', 'hypertrophy'].includes(token) ? (token as TrainingMode) : fallback;
};

const explainCombination = (primaryGoal: PrimaryGoal, trainingMode: TrainingMode, mesocycleGoal?: CanonicalPrimaryGoal) => {
  if (primaryGoal === 'fat_loss' && trainingMode === 'hybrid') {
    return mesocycleGoal === 'fat_loss_support'
      ? '减脂主目标 + 综合训练模式是合法组合；周期中的肌肥大式训练被解释为保肌型减脂周期，不会自动改成增肌目标。'
      : '减脂主目标 + 综合训练模式是合法组合；力量训练用于保肌、维持力量和训练习惯。';
  }
  if (primaryGoal === 'hypertrophy' && trainingMode === 'hypertrophy') {
    return '主目标和训练模式都指向肌肥大（增肌），处方应走同一套肌肥大逻辑。';
  }
  if (primaryGoal === 'strength' && trainingMode === 'strength') {
    return '主目标和训练模式都指向力量优先，主复合动作可使用更低次数和更长休息。';
  }
  if (trainingMode === 'hybrid') {
    return '综合训练模式会在主动作和辅助动作之间保持折中，不等同于纯力量或纯肌肥大。';
  }
  return '当前目标和训练模式可以并存，但计划说明需要避免把同义目标拆成不同算法分支。';
};

export const auditGoalModeConsistency = (appData: Partial<AppData>): GoalModeAuditResult => {
  const primaryGoal = normalizePrimaryGoal(
    appData.userProfile?.primaryGoal ?? appData.programTemplate?.primaryGoal ?? appData.mesocyclePlan?.primaryGoal,
    'hypertrophy'
  );
  const trainingMode = normalizeTrainingMode(appData.trainingMode ?? appData.settings?.trainingMode, 'hybrid');
  const rawMesocycleGoal = appData.mesocyclePlan?.primaryGoal
    ? normalizePrimaryGoal(appData.mesocyclePlan.primaryGoal, primaryGoal)
    : undefined;
  const programGoal = appData.programTemplate?.primaryGoal
    ? normalizePrimaryGoal(appData.programTemplate.primaryGoal, primaryGoal)
    : undefined;
  const warnings: string[] = [];
  let mesocycleGoal: CanonicalPrimaryGoal | undefined = rawMesocycleGoal;
  let isConsistent = true;

  if (primaryGoal === 'fat_loss' && rawMesocycleGoal === 'hypertrophy') {
    mesocycleGoal = 'fat_loss_support';
    warnings.push('减脂主目标下的肌肥大式周期应标注为保肌型减脂周期，避免看起来像被改成增肌。');
  } else if (rawMesocycleGoal && rawMesocycleGoal !== primaryGoal) {
    isConsistent = false;
    warnings.push(`周期目标与用户主目标不一致：用户主目标为 ${primaryGoal}，周期目标为 ${rawMesocycleGoal}。`);
  }

  if (primaryGoal === 'fat_loss' && programGoal === 'hypertrophy') {
    warnings.push('减脂主目标下的默认模板可继续使用肌肥大式力量训练，但 UI 应解释为保肌训练而不是增肌目标。');
  } else if (programGoal && programGoal !== primaryGoal) {
    isConsistent = false;
    warnings.push(`模板目标与用户主目标不一致：用户主目标为 ${primaryGoal}，模板目标为 ${programGoal}。`);
  }

  return {
    primaryGoal,
    trainingMode,
    mesocycleGoal,
    isConsistent,
    warnings,
    explanation: explainCombination(primaryGoal, trainingMode, mesocycleGoal),
  };
};
