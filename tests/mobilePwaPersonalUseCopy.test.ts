import { describe, expect, it } from 'vitest';
import {
  buildMobilePwaPersonalUseView,
  defaultMobilePwaPersonalUseStates,
  getMobilePwaPersonalUseCopy,
  type MobilePwaPersonalUseState,
} from '../src/personalProduction/mobilePwaPersonalUseCopy';

const states: MobilePwaPersonalUseState[] = [
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
  'mobile_source_of_truth_unclear',
];

describe('mobile PWA personal use copy', () => {
  it('provides Chinese-first guidance for all mobile PWA states', () => {
    for (const state of states) {
      const copy = getMobilePwaPersonalUseCopy(state);
      expect(copy.label).toMatch(/[\u4e00-\u9fff]/);
      expect(copy.summary).toMatch(/[\u4e00-\u9fff]/);
      expect(copy.safety).toMatch(/[\u4e00-\u9fff]/);
    }
  });

  it('states phone and PWA use are local-first and manual', () => {
    expect(getMobilePwaPersonalUseCopy('phone_training_ready').summary).toContain('本地数据');
    expect(getMobilePwaPersonalUseCopy('local_first_available').safety).toContain('可选、手动、可回滚');
    expect(getMobilePwaPersonalUseCopy('cloud_candidate_caution').summary).toContain('手动确认');
  });

  it('states no background sync automatic upload or push notification', () => {
    expect(getMobilePwaPersonalUseCopy('pwa_install_guidance').safety).toContain('不会启用后台同步或推送通知');
    expect(getMobilePwaPersonalUseCopy('offline_local_available').safety).toContain('不代表后台同步或自动补传');
    expect(getMobilePwaPersonalUseCopy('phone_training_ready').safety).toContain('不会启用自动上传');
  });

  it('builds default mobile PWA guidance view', () => {
    const view = buildMobilePwaPersonalUseView({ states: [...defaultMobilePwaPersonalUseStates] });

    expect(view.title).toBe('手机 / PWA 个人使用提示');
    expect(view.notice).toContain('本地优先');
    expect(view.guidance.map((item) => item.label)).toEqual(
      expect.arrayContaining(['手机训练使用就绪', 'PWA 安装提示', '避免误用云端候选']),
    );
  });

  it('does not claim unsafe sync SaaS or automatic behavior', () => {
    const allCopy = states.flatMap((state) => {
      const copy = getMobilePwaPersonalUseCopy(state);
      return [copy.label, copy.summary, copy.safety];
    }).join('\n');

    for (const forbidden of [
      'public SaaS',
      'SaaS 已启动',
      'default cloud sync is enabled',
      'background sync is enabled',
      'automatic upload is enabled',
      'service worker sync is enabled',
      '自动同步已开启',
      '自动上传已开启',
    ]) {
      expect(allCopy).not.toContain(forbidden);
    }
  });
});
