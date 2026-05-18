import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ProductionCandidateControlPanel } from '../src/cloudProduction/ProductionCandidateControlPanel';

const visibleText = (markup: string) => markup.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

describe('ProductionCandidateControlPanel', () => {
  it('renders current data source cloud safety rollback and emergency local status', () => {
    const markup = renderToStaticMarkup(createElement(ProductionCandidateControlPanel, {
      dataSourceState: 'localStorage-primary',
      cloudPullState: 'cloud-pull-dry-run',
      cloudPushState: 'cloud-push-dry-run',
      recoveryState: 'rollback-available',
      ownerStatus: 'owner-ok',
      schemaStatus: 'schema-ok',
      rollbackAvailable: true,
      emergencyLocalAvailable: true,
      lastRecommendation: '继续本地数据模式；云端候选需要手动确认。',
    }));
    const text = visibleText(markup);

    expect(text).toContain('个人生产候选控制面板');
    expect(text).toContain('本地数据模式');
    expect(text).toContain('当前使用本机数据');
    expect(text).toContain('从云端读取候选数据');
    expect(text).toContain('不会自动覆盖本地数据');
    expect(text).toContain('准备上传候选数据');
    expect(text).toContain('dry run / owner check / backup check / 手动确认');
    expect(text).toContain('回滚 / 关闭云端候选可用');
    expect(text).toContain('紧急本地模式可用');
    expect(text).toContain('不是 public SaaS');
  });

  it('renders owner and schema warnings in simple language', () => {
    const markup = renderToStaticMarkup(createElement(ProductionCandidateControlPanel, {
      dataSourceState: 'unknown',
      cloudPullState: 'cloud-pull-blocked',
      cloudPushState: 'cloud-push-blocked',
      recoveryState: 'owner-mismatch',
      ownerStatus: 'owner-mismatch',
      schemaStatus: 'schema-validation-failed',
      rollbackAvailable: false,
      emergencyLocalAvailable: false,
    }));
    const text = visibleText(markup);

    expect(text).toContain('当前数据来源不清楚');
    expect(text).toContain('数据归属不一致');
    expect(text).toContain('先不要上传或应用云端数据');
    expect(text).toContain('需要检查账号 / owner scope');
    expect(text).toContain('数据结构验证失败');
    expect(text).toContain('需要检查数据格式');
    expect(text).toContain('紧急本地模式未确认；停止云端操作');
  });

  it('does not call optional callbacks on render', () => {
    const callbacks = {
      onRequestCloudPullDryRun: vi.fn(),
      onRequestCloudPushDryRun: vi.fn(),
      onRequestRollback: vi.fn(),
      onRequestEmergencyLocal: vi.fn(),
    };

    renderToStaticMarkup(createElement(ProductionCandidateControlPanel, {
      dataSourceState: 'cloud-candidate',
      cloudPullState: 'cloud-pull-needs-confirmation',
      cloudPushState: 'cloud-push-needs-confirmation',
      recoveryState: 'caution',
      rollbackAvailable: true,
      emergencyLocalAvailable: true,
      ...callbacks,
    }));

    expect(callbacks.onRequestCloudPullDryRun).not.toHaveBeenCalled();
    expect(callbacks.onRequestCloudPushDryRun).not.toHaveBeenCalled();
    expect(callbacks.onRequestRollback).not.toHaveBeenCalled();
    expect(callbacks.onRequestEmergencyLocal).not.toHaveBeenCalled();
  });

  it('keeps panel source browser-safe and presentational', () => {
    const source = readFileSync('src/cloudProduction/ProductionCandidateControlPanel.tsx', 'utf8');

    for (const forbidden of [
      'node:',
      '@supabase/supabase-js',
      'createClient',
      'localStorage.',
      'sessionStorage.',
      'fetch(',
      'XMLHttpRequest',
      'navigator.sendBeacon',
      'POST /data-health/repair/apply',
      'POST /reset',
      'POST /recovery',
      'POST /backup',
      'POST /export',
      'POST /import',
      'setSourceOfTruth',
      'sourceOfTruthChanged: true',
      'enableSync',
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });
});
