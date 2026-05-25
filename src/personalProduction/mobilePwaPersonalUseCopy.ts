export type MobilePwaPersonalUseState =
  | 'phone_training_ready'
  | 'pwa_install_guidance'
  | 'local_first_available'
  | 'offline_local_available'
  | 'emergency_local_on_phone'
  | 'backup_recovery_reminder'
  | 'cloud_candidate_caution'
  | 'tap_target_readability'
  | 'small_screen_history_review'
  | 'small_screen_diagnostics'
  | 'mobile_source_of_truth_unclear';

export type MobilePwaPersonalUseSeverity = 'ready' | 'info' | 'caution' | 'stop' | 'emergency';

export type MobilePwaPersonalUseCopy = {
  label: string;
  summary: string;
  safety: string;
  severity: MobilePwaPersonalUseSeverity;
};

export type MobilePwaPersonalUseViewInput = {
  states: MobilePwaPersonalUseState[];
};

export type MobilePwaPersonalUseView = {
  title: string;
  guidance: MobilePwaPersonalUseCopy[];
  notice: string;
};

const COPY: Record<MobilePwaPersonalUseState, MobilePwaPersonalUseCopy> = {
  phone_training_ready: {
    label: '手机训练使用就绪',
    summary: '训练时优先使用本地数据记录。',
    safety: '手机使用不代表公开 SaaS，也不会启用自动上传。',
    severity: 'ready',
  },
  pwa_install_guidance: {
    label: 'PWA 安装提示',
    summary: '可以把应用添加到手机主屏幕，方便个人训练使用。',
    safety: '安装 PWA 不会启用后台同步或推送通知。',
    severity: 'info',
  },
  local_first_available: {
    label: '本地优先可用',
    summary: '本地数据仍是默认、回退、迁移和紧急恢复基础。',
    safety: '云端候选保持可选、手动、可回滚。',
    severity: 'ready',
  },
  offline_local_available: {
    label: '离线 / 本地可用说明',
    summary: '手机网络不稳定时，先按本地优先方式记录。',
    safety: '离线说明不代表后台同步或自动补传。',
    severity: 'info',
  },
  emergency_local_on_phone: {
    label: '手机紧急本地模式',
    summary: '云端候选不清楚时，回到本地数据和 emergency backup。',
    safety: '保留本地训练记录，不删除备份。',
    severity: 'caution',
  },
  backup_recovery_reminder: {
    label: '备份 / 恢复提醒',
    summary: '训练后确认本地历史和手动备份状态。',
    safety: '备份检查仍由 owner 手动执行。',
    severity: 'caution',
  },
  cloud_candidate_caution: {
    label: '避免误用云端候选',
    summary: 'cloud pull / cloud push rehearsal 仍然需要 dry run 和手动确认。',
    safety: '没有确认前不要上传或应用候选数据。',
    severity: 'stop',
  },
  tap_target_readability: {
    label: '点击区域和可读性',
    summary: '训练中常用按钮应足够清楚，文字不能遮挡操作。',
    safety: '这是 UI 指导，不改变训练规则或数据来源。',
    severity: 'info',
  },
  small_screen_history_review: {
    label: '小屏幕历史查看',
    summary: '训练后在手机上确认最新记录已经出现在本地历史。',
    safety: '历史查看不需要云端候选。',
    severity: 'info',
  },
  small_screen_diagnostics: {
    label: '小屏幕诊断查看',
    summary: '诊断提示应简短、可读，并提醒 redaction。',
    safety: '不上传完整 AppData 或敏感凭证。',
    severity: 'caution',
  },
  mobile_source_of_truth_unclear: {
    label: '手机当前数据来源不清楚',
    summary: '停止云端操作，回到本地优先或紧急本地模式。',
    safety: '先确认 source of truth，再继续训练外操作。',
    severity: 'emergency',
  },
};

export const getMobilePwaPersonalUseCopy = (state: MobilePwaPersonalUseState): MobilePwaPersonalUseCopy => COPY[state];

export const buildMobilePwaPersonalUseView = (input: MobilePwaPersonalUseViewInput): MobilePwaPersonalUseView => ({
  title: '手机 / PWA 个人使用提示',
  guidance: input.states.map(getMobilePwaPersonalUseCopy),
  notice: '手机和 PWA 使用保持本地优先；云端候选仍是可选、手动、可回滚流程。',
});

export const defaultMobilePwaPersonalUseStates: readonly MobilePwaPersonalUseState[] = [
  'phone_training_ready',
  'pwa_install_guidance',
  'local_first_available',
  'offline_local_available',
  'emergency_local_on_phone',
  'backup_recovery_reminder',
  'cloud_candidate_caution',
  'tap_target_readability',
  'small_screen_history_review',
  'small_screen_diagnostics',
];
