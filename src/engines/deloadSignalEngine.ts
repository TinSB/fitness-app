import type { AppData, DeloadDecision } from '../models/training-model';
import { buildAdaptiveDeloadDecision } from './adaptiveFeedbackEngine';

type DeloadSignal = Pick<
  DeloadDecision,
  'triggered' | 'level' | 'strategy' | 'reasons' | 'title' | 'options' | 'autoSwitchTemplateId' | 'volumeMultiplier'
>;

export const buildDeloadSignal = (data: Partial<AppData>): DeloadSignal => {
  const decision = buildAdaptiveDeloadDecision(data);
  return {
    triggered: decision.triggered,
    level: decision.level,
    strategy: decision.strategy,
    reasons: decision.reasons,
    title: decision.title,
    options: decision.options,
    autoSwitchTemplateId: decision.autoSwitchTemplateId,
    volumeMultiplier: decision.volumeMultiplier,
  };
};
