import type { TrainingTemplate } from '../models/training-model';
import type { TodayTrainingState } from '../engines/todayStateEngine';

export type TodayViewModel = {
  state: TodayTrainingState['status'];
  pageTitle: string;
  recommendationLabel: string;
  primaryActionLabel: string;
  secondaryActionLabels: string[];
  statusText: string;
};

export const buildTodayViewModel = ({
  todayState,
  selectedTemplate,
  completedTemplateName,
}: {
  todayState: TodayTrainingState;
  selectedTemplate: TrainingTemplate;
  completedTemplateName?: string;
}): TodayViewModel => {
  if (todayState.status === 'completed') {
    return {
      state: 'completed',
      pageTitle: '今日训练已完成',
      recommendationLabel: '下次建议',
      primaryActionLabel: '查看本次训练',
      secondaryActionLabels: ['查看训练日历', '再练一场'],
      statusText: `已完成 ${completedTemplateName || '本次训练'}。下一次建议只作为参考，不代表今天必须继续训练。`,
    };
  }

  if (todayState.status === 'in_progress') {
    return {
      state: 'in_progress',
      pageTitle: '训练进行中',
      recommendationLabel: '当前训练',
      primaryActionLabel: '继续训练',
      secondaryActionLabels: ['查看完整训练页'],
      statusText: '当前有未完成训练，继续记录即可。',
    };
  }

  return {
    state: 'not_started',
    pageTitle: '今天该怎么练',
    recommendationLabel: '今日建议',
    primaryActionLabel: '开始训练',
    secondaryActionLabels: ['查看动作安排'],
    statusText: `建议执行 ${selectedTemplate.name}。`,
  };
};
