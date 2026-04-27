import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('shared UI components', () => {
  const source = readFileSync(resolve(process.cwd(), 'src/ui/common.tsx'), 'utf8');

  it('exports the product UI primitives used by feature pages', () => {
    expect(source).toContain('export const Card');
    expect(source).toContain('export const SectionHeader');
    expect(source).toContain('export const ActionButton');
    expect(source).toContain('export const SegmentedTabs');
    expect(source).toContain('export const StatusBadge');
    expect(source).toContain('export const EmptyState');
    expect(source).toContain('export const InlineNotice');
    expect(source).toContain('export const MobileActionBar');
  });

  it('keeps mobile safe-area handling in the shared action bar', () => {
    expect(source).toContain('env(safe-area-inset-bottom)');
    expect(source).toContain('min-h-11');
  });

  it('keeps empty states lightweight and actionable', () => {
    expect(source).toContain('export const EmptyState');
    expect(source).toContain('action ?');
    expect(source).toContain('border-dashed');
    expect(source).toContain('p-4');
  });
});
