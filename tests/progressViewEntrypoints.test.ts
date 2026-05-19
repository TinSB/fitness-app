import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Record and progress entry points', () => {
  const appSource = readFileSync(resolve(process.cwd(), 'src/App.tsx'), 'utf8');
  const recordSource = readFileSync(resolve(process.cwd(), 'src/features/RecordView.tsx'), 'utf8');
  const progressSource = readFileSync(resolve(process.cwd(), 'src/features/ProgressView.tsx'), 'utf8');

  it('uses RecordView for history and progress metrics pages', () => {
    expect(appSource).toContain("activeTab === 'history'");
    expect(appSource).toContain("activeTab === 'progress' && progressMode === 'metrics'");
    expect(appSource).toContain('<RecordView');
    expect(appSource).not.toContain('<ProgressView');
  });

  it('keeps ProgressView as a legacy compatibility component only', () => {
    expect(progressSource).toContain('export function ProgressView');
    expect(recordSource).not.toContain('ProgressView');
  });

  it('keeps calendar and history visible in the record center', () => {
    expect(recordSource).toContain('renderCalendar');
    expect(recordSource).toContain('renderHistoryList');
    expect(recordSource).toContain('selectedSession');
  });
});
