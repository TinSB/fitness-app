import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const appSource = () => readFileSync(resolve(process.cwd(), 'src/App.tsx'), 'utf8');
const profileSource = () => readFileSync(resolve(process.cwd(), 'src/features/ProfileView.tsx'), 'utf8');
const recordSource = () => readFileSync(resolve(process.cwd(), 'src/features/RecordView.tsx'), 'utf8');

describe('data health action routing', () => {
  it('routes record actions to history, detail, data, or fallback states', () => {
    const source = appSource();

    expect(source).toContain("action.type === 'open_record_history'");
    expect(source).toContain("setProgressTarget({ section: 'list'");
    expect(source).toContain("action.type === 'open_session_detail'");
    expect(source).toContain("sessionId: session.id");
    expect(source).toContain('暂时无法定位到对应记录。');
    expect(source).toContain("action.type === 'open_record_data'");
    expect(source).toContain("setProgressTarget({ section: 'data' })");
  });

  it('routes profile and plan actions to the right top-level pages', () => {
    const source = appSource();

    expect(source).toContain("openProfileTarget('unit_settings')");
    expect(source).toContain("openProfileTarget('health_data')");
    expect(source).toContain("openProfileTarget('data_management')");
    expect(source).toContain("action.type === 'open_plan'");
    expect(source).toContain("setActiveTab('plan')");
  });

  it('RecordView responds to external target props', () => {
    const source = recordSource();

    expect(source).toContain('initialSection');
    expect(source).toContain('selectedSessionId');
    expect(source).toContain('setSelectedSession(next)');
    expect(source).toContain('setActiveSection(normalizeSection(initialSection ||');
  });

  it('ProfileView supports target section scrolling', () => {
    const source = profileSource();

    expect(source).toContain('targetSection');
    expect(source).toContain('scrollIntoView');
    expect(source).toContain('unit_settings');
    expect(source).toContain('health_data');
    expect(source).toContain('data_management');
  });
});
