import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (file: string) => readFileSync(file, 'utf8');

describe('shared UI component implementations', () => {
  const standaloneFiles = [
    'src/ui/Card.tsx',
    'src/ui/MetricCard.tsx',
    'src/ui/ActionButton.tsx',
    'src/ui/StatusBadge.tsx',
    'src/ui/EmptyState.tsx',
    'src/ui/ConfirmDialog.tsx',
    'src/ui/SegmentedControl.tsx',
  ];

  it('implements required primitives directly instead of re-exporting common components', () => {
    for (const file of standaloneFiles) {
      expect(read(file)).not.toMatch(/^export \{.*\} from ['"]\.\/common['"];?$/m);
    }
  });

  it('keeps mobile-first touch and safe-area behavior in interactive primitives', () => {
    expect(read('src/ui/ActionButton.tsx')).toContain('min-h-11');
    expect(read('src/ui/BottomSheet.tsx')).toContain('env(safe-area-inset-bottom)');
    expect(read('src/ui/WorkoutActionBar.tsx')).toContain('env(safe-area-inset-bottom)');
    expect(read('src/ui/BottomNav.tsx')).toContain('lg:hidden');
  });

  it('supports restrained product UI states', () => {
    expect(read('src/ui/Card.tsx')).toContain('uiTokens.shadow.card');
    expect(read('src/ui/StatusBadge.tsx')).toContain('emerald');
    expect(read('src/ui/StatusBadge.tsx')).toContain('rose');
    expect(read('src/ui/ConfirmDialog.tsx')).toContain('ConfirmDialogVariant');
    expect(read('src/ui/ConfirmDialog.tsx')).toContain('aria-modal');
    expect(read('src/ui/ConfirmDialog.tsx')).toContain("tone === 'warning'");
  });
});
