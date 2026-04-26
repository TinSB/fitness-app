import React from 'react';
import { DEFAULT_PROGRAM_TEMPLATE, DEFAULT_SCREENING_PROFILE, DEFAULT_USER_PROFILE } from '../data/trainingData';
import {
  findTemplate,
  inferCorrectionPriority,
  inferFunctionalPriorities,
  screeningSummaryCards,
  selectCorrectionModules,
  selectFunctionalAddons,
} from '../engines/trainingEngine';
import type { AppData, MovementFlagKey, PostureFlagKey } from '../models/training-model';
import {
  CORRECTION_STRATEGY_LABELS,
  FUNCTIONAL_STRATEGY_LABELS,
  MOVEMENT_FLAG_KEYS,
  MOVEMENT_FLAG_LABELS,
  POSTURE_FLAG_KEYS,
  POSTURE_FLAG_LABELS,
  PRIMARY_GOAL_LABELS,
  TRAINING_LEVEL_LABELS,
} from '../models/training-model';
import { InfoPill, LabelInput, Page, Segment } from '../ui/common';

interface AssessmentViewProps {
  data: AppData;
  onProfileChange: (field: string, value: string) => void;
  onProgramChange: (field: string, value: string) => void;
  onScreeningChange: (group: 'postureFlags' | 'movementFlags', field: string, value: string) => void;
  onGoProgram: () => void;
}

const postureSeverityLabels: Record<string, string> = {
  none: '无',
  mild: '轻度',
  moderate: '中度',
  severe: '明显',
};

const movementSeverityLabels: Record<string, string> = {
  good: '良好',
  limited: '受限',
  poor: '较差',
};

const issueLabels: Record<string, string> = {
  upper_crossed: '上交叉倾向',
  scapular_control: '肩胛控制',
  thoracic_extension: '胸椎伸展',
  hip_stability: '髋稳定',
  anterior_pelvic_tilt: '骨盆前倾',
  core_control: '核心控制',
  ankle_mobility: '踝活动度',
  squat_lean_forward: '深蹲前倾',
  hip_flexor_tightness: '髋屈肌紧张',
  lumbar_compensation: '腰椎代偿',
  thoracic_rotation: '胸椎旋转',
  overhead_press_restriction: '过顶推受限',
  breathing_ribcage: '呼吸 / 肋骨位置',
  single_leg_stability: '单腿稳定',
  anti_rotation: '抗旋转',
  carry_capacity: '搬运能力',
  gait_bracing: '步态支撑',
  overhead_stability: '过顶稳定',
  core_stability: '核心稳定',
  locomotion: '移动能力',
  balance: '平衡',
};

const joinLabels = (values: string[]) => values.map((value) => issueLabels[value] || value).join(' / ');

export function AssessmentView({ data, onProfileChange, onProgramChange, onScreeningChange, onGoProgram }: AssessmentViewProps) {
  const profile = data.userProfile || DEFAULT_USER_PROFILE;
  const screening = data.screeningProfile || DEFAULT_SCREENING_PROFILE;
  const program = data.programTemplate || DEFAULT_PROGRAM_TEMPLATE;
  const selectedTemplate = findTemplate(data.templates, data.selectedTemplateId);
  const corrections = selectCorrectionModules(screening, selectedTemplate, program.correctionStrategy);
  const addons = selectFunctionalAddons(screening, selectedTemplate, program.functionalStrategy);
  const summary = screeningSummaryCards(screening);

  return (
    <Page
      eyebrow="筛查"
      title="初始筛查与计划建档"
      action={
        <button onClick={onGoProgram} className="rounded-lg bg-slate-950 px-4 py-3 text-sm font-black text-white">
          查看计划组成
        </button>
      }
    >
      <div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
        <section className="space-y-4">
          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="mb-3 font-black text-slate-950">基础档案</h2>
            <div className="grid gap-3 md:grid-cols-2">
              <LabelInput label="名字" value={profile.name} onChange={(value) => onProfileChange('name', value)} />
              <LabelInput label="年龄" type="number" value={profile.age} onChange={(value) => onProfileChange('age', value)} />
              <LabelInput label="身高 cm" type="number" value={profile.heightCm} onChange={(value) => onProfileChange('heightCm', value)} />
              <LabelInput label="体重 kg" type="number" value={profile.weightKg} onChange={(value) => onProfileChange('weightKg', value)} />
            </div>
            <div className="mt-4 space-y-3">
              <div>
                <div className="mb-2 text-xs font-bold text-slate-500">主目标</div>
                <Segment value={profile.primaryGoal} options={Object.keys(PRIMARY_GOAL_LABELS)} labels={PRIMARY_GOAL_LABELS} onChange={(value) => onProfileChange('primaryGoal', value)} />
              </div>
              <div>
                <div className="mb-2 text-xs font-bold text-slate-500">训练经验</div>
                <Segment value={profile.trainingLevel} options={Object.keys(TRAINING_LEVEL_LABELS)} labels={TRAINING_LEVEL_LABELS} onChange={(value) => onProfileChange('trainingLevel', value)} />
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="mb-3 font-black text-slate-950">计划策略</h2>
            <div className="grid gap-3 md:grid-cols-2">
              <LabelInput label="每周训练天数" type="number" value={program.daysPerWeek} onChange={(value) => onProgramChange('daysPerWeek', value)} />
              <LabelInput label="单次训练时长" type="number" value={profile.sessionDurationMin} onChange={(value) => onProfileChange('sessionDurationMin', value)} />
            </div>
            <div className="mt-4 space-y-3">
              <div>
                <div className="mb-2 text-xs font-bold text-slate-500">纠偏策略</div>
                <Segment
                  value={program.correctionStrategy}
                  options={Object.keys(CORRECTION_STRATEGY_LABELS)}
                  labels={CORRECTION_STRATEGY_LABELS}
                  onChange={(value) => onProgramChange('correctionStrategy', value)}
                />
              </div>
              <div>
                <div className="mb-2 text-xs font-bold text-slate-500">功能补丁策略</div>
                <Segment
                  value={program.functionalStrategy}
                  options={Object.keys(FUNCTIONAL_STRATEGY_LABELS)}
                  labels={FUNCTIONAL_STRATEGY_LABELS}
                  onChange={(value) => onProgramChange('functionalStrategy', value)}
                />
              </div>
            </div>
          </section>
        </section>

        <section className="space-y-4">
          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="mb-3 font-black text-slate-950">体态筛查</h2>
            <div className="grid gap-3 md:grid-cols-2">
              {POSTURE_FLAG_KEYS.map((key) => (
                <div key={key}>
                  <div className="mb-2 text-xs font-bold text-slate-500">{POSTURE_FLAG_LABELS[key as PostureFlagKey]}</div>
                  <Segment
                    value={screening.postureFlags[key]}
                    options={['none', 'mild', 'moderate', 'severe']}
                    labels={postureSeverityLabels}
                    onChange={(next) => onScreeningChange('postureFlags', key, next)}
                  />
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="mb-3 font-black text-slate-950">动作与功能筛查</h2>
            <div className="grid gap-3 md:grid-cols-2">
              {MOVEMENT_FLAG_KEYS.map((key) => (
                <div key={key}>
                  <div className="mb-2 text-xs font-bold text-slate-500">{MOVEMENT_FLAG_LABELS[key as MovementFlagKey]}</div>
                  <Segment
                    value={screening.movementFlags[key]}
                    options={['good', 'limited', 'poor']}
                    labels={movementSeverityLabels}
                    onChange={(next) => onScreeningChange('movementFlags', key, next)}
                  />
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
            <div className="mb-2 text-xs font-black uppercase tracking-widest text-emerald-700">筛查输出</div>
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              <InfoPill label="主线建议" value={`${program.splitType} / ${program.daysPerWeek} 天`} />
              <InfoPill label="纠偏优先级" value={summary.correctionPriority.length ? joinLabels(summary.correctionPriority) : joinLabels(inferCorrectionPriority(screening)) || '暂无'} />
              <InfoPill label="功能补丁优先级" value={summary.functionalPriority.length ? joinLabels(summary.functionalPriority) : joinLabels(inferFunctionalPriorities(screening)) || '最低配补丁'} />
              <InfoPill label="预计插入的纠偏模块" value={corrections.map((item) => item.name).join(' / ') || '暂无'} />
              <InfoPill label="预计插入的功能补丁" value={addons.map((item) => item.name).join(' / ') || '暂无'} />
              <InfoPill label="动态反馈信号" value={summary.adaptiveSignals.length ? joinLabels(summary.adaptiveSignals) : '当前还没有闭环反馈'} />
            </div>
          </section>
        </section>
      </div>
    </Page>
  );
}
