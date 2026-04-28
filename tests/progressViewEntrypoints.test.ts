import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Record entry points', () => {
  const appSource = readFileSync(resolve(process.cwd(), 'src/App.tsx'), 'utf8');
  const recordSource = readFileSync(resolve(process.cwd(), 'src/features/RecordView.tsx'), 'utf8');
  const progressSource = readFileSync(resolve(process.cwd(), 'src/features/ProgressView.tsx'), 'utf8');

  it('uses RecordView as the product-level record page', () => {
    expect(appSource).toContain("activeTab === 'record'");
    expect(appSource).toContain('<RecordView');
    expect(appSource).not.toContain('<ProgressView');
  });

  it('keeps ProgressView as a legacy compatibility component only', () => {
    expect(progressSource).toContain('export function ProgressView');
    expect(recordSource).not.toContain('ProgressView');
  });

  it('keeps calendar and history visible in the record center', () => {
    expect(recordSource).toContain('renderCalendar');
    expect(recordSource).toContain('renderHistory');
    expect(recordSource).toContain('selectedSession');
  });
});
