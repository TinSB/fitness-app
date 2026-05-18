import {
  buildDailyTrainingUxView,
  type DailyTrainingUxState,
} from './dailyTrainingUxCopy';

export type DailyTrainingStatusPanelProps = {
  visible?: boolean;
  state: DailyTrainingUxState;
  backupRecommended?: boolean;
  emergencyLocalAvailable?: boolean;
  cloudCandidatePaused?: boolean;
  sourceOfTruthClear?: boolean;
  ownerActionRequired?: boolean;
  recoveryActionRecommended?: boolean;
};

const CopyBlock = ({
  title,
  label,
  summary,
  safety,
}: {
  title: string;
  label: string;
  summary: string;
  safety: string;
}) => (
  <section>
    <h3>{title}</h3>
    <p>{label}</p>
    <p>{summary}</p>
    <p>{safety}</p>
  </section>
);

export const DailyTrainingStatusPanel = ({
  visible = true,
  state,
  backupRecommended = false,
  emergencyLocalAvailable = false,
  cloudCandidatePaused = false,
  sourceOfTruthClear = true,
  ownerActionRequired = false,
  recoveryActionRecommended = false,
}: DailyTrainingStatusPanelProps) => {
  if (!visible) return null;

  const view = buildDailyTrainingUxView({
    state,
    backupRecommended,
    emergencyLocalAvailable,
    cloudCandidatePaused,
    sourceOfTruthClear,
    ownerActionRequired,
    recoveryActionRecommended,
  });

  return (
    <section aria-label="Daily training personal-use status panel" data-daily-training-panel="presentational">
      <h2>{view.title}</h2>
      <p>{view.localFirstNotice}</p>
      <p>安全下一步：{view.safeNextAction}</p>

      <CopyBlock title="当前训练状态" {...view.primary} />

      {view.supporting.map((copy) => (
        <CopyBlock key={copy.label} title="辅助提醒" {...copy} />
      ))}

      <div aria-label="Daily training safety controls">
        <button type="button" disabled aria-disabled="true">
          本地训练记录
        </button>
        <button type="button" disabled aria-disabled="true">
          手动备份提醒
        </button>
        <button type="button" disabled aria-disabled="true">
          紧急本地模式
        </button>
      </div>
    </section>
  );
};
