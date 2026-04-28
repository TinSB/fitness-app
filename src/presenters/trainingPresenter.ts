import { getFocusNavigationState } from '../engines/focusModeStateEngine';
import { formatWeight } from '../engines/unitConversionEngine';
import { formatBlockType, formatExerciseName } from '../i18n/formatters';
import type { TrainingSession, UnitSettings } from '../models/training-model';

export type TrainingFocusViewModel = {
  state: 'active_step' | 'support_step' | 'completed';
  phaseLabel: string;
  exerciseName: string;
  stepLabel: string;
  prescriptionSummary: string;
  actualDraftSummary: string;
  primaryActionLabel: string;
  secondaryActions: string[];
};

export const buildTrainingFocusViewModel = (session: TrainingSession, unitSettings: UnitSettings): TrainingFocusViewModel => {
  const state = getFocusNavigationState(session);
  if (state.sessionComplete || state.currentStep.stepType === 'completed') {
    return {
      state: 'completed',
      phaseLabel: '训练完成',
      exerciseName: session.templateName,
      stepLabel: '全部步骤已完成',
      prescriptionSummary: '保存后会进入训练历史和日历。',
      actualDraftSummary: '',
      primaryActionLabel: '查看本次训练',
      secondaryActions: ['查看训练日历', '返回首页'],
    };
  }

  const supportStep = state.currentStep.blockType === 'correction' || state.currentStep.blockType === 'functional';
  const exerciseName = state.currentExercise ? formatExerciseName(state.currentExercise) : state.currentStep.exerciseName || '支持动作';
  const actual = state.actualDraft;
  const planned =
    typeof state.currentStep.plannedWeight === 'number'
      ? `${formatWeight(state.currentStep.plannedWeight, unitSettings)} × ${state.currentStep.plannedReps || 0}`
      : `${state.currentStep.plannedReps || 0} 次`;

  return {
    state: supportStep ? 'support_step' : 'active_step',
    phaseLabel: supportStep ? formatBlockType(state.currentStep.blockType) : state.currentStep.stepType === 'warmup' ? '热身组' : '正式组',
    exerciseName,
    stepLabel: state.currentStep.label,
    prescriptionSummary: `建议：${planned}`,
    actualDraftSummary: `实际：${actual?.actualWeightKg === undefined ? '待输入' : formatWeight(actual.actualWeightKg, unitSettings)} / ${
      actual?.actualReps === undefined ? '待输入' : `${actual.actualReps} 次`
    }`,
    primaryActionLabel: '完成一组',
    secondaryActions: ['复制上组', '标记不适', '替代动作'],
  };
};
