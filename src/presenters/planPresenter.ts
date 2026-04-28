import type { AppData } from '../models/training-model';
import { formatTemplateName } from '../i18n/formatters';

export type PlanViewModel = {
  currentTemplateName: string;
  templateStateLabel: string;
  sections: string[];
  hasExperimentalTemplate: boolean;
};

export const buildPlanViewModel = (data: AppData): PlanViewModel => {
  const current = data.templates.find((template) => template.id === (data.activeProgramTemplateId || data.selectedTemplateId));
  const hasExperimentalTemplate = Boolean(current?.isExperimentalTemplate);
  return {
    currentTemplateName: current ? formatTemplateName(current, '当前模板') : '当前模板',
    templateStateLabel: hasExperimentalTemplate ? '实验模板' : '原始模板',
    sections: ['当前模板', '周期时间线', '本周训练日', '训练日模板', '实验模板', '计划调整', '调整历史'],
    hasExperimentalTemplate,
  };
};
