import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('RecordView information architecture', () => {
  const recordSource = readFileSync(resolve(process.cwd(), 'src/features/RecordView.tsx'), 'utf8');

  it('is an independent record center instead of a ProgressView wrapper', () => {
    expect(recordSource).not.toContain("from './ProgressView'");
    expect(recordSource).not.toContain('<ProgressView');
    expect(recordSource).toContain('export function RecordView');
    expect(recordSource).toContain('recordSections');
  });

  it('defaults to the calendar-first record workflow', () => {
    expect(recordSource).toContain("initialSection || 'calendar'");
    expect(recordSource).toContain("id: 'calendar'");
    expect(recordSource).toContain("id: 'history'");
    expect(recordSource).toContain("id: 'dashboard'");
    expect(recordSource).toContain("id: 'pr'");
    expect(recordSource).toContain("id: 'data'");
  });

  it('uses the new product UI components for record actions', () => {
    expect(recordSource).toContain("from '../ui/SegmentedControl'");
    expect(recordSource).toContain("from '../ui/Drawer'");
    expect(recordSource).toContain("from '../ui/ConfirmDialog'");
    expect(recordSource).toContain("from '../ui/EmptyState'");
  });
});
