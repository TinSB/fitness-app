import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createConfirmDialogController } from '../src/ui/useConfirmDialog';

describe('useConfirmDialog controller', () => {
  it('resolves true when confirmed', async () => {
    const controller = createConfirmDialogController();
    const result = controller.confirm({
      title: '删除这次训练？',
      description: '删除后不会参与统计。',
      confirmText: '删除',
      cancelText: '取消',
      variant: 'danger',
    });

    expect(controller.getPending()?.variant).toBe('danger');
    controller.resolve(true);
    await expect(result).resolves.toBe(true);
  });

  it('resolves false when cancelled', async () => {
    const controller = createConfirmDialogController();
    const result = controller.confirm({
      title: '保存修正？',
      description: '修改后会重新计算统计。',
      confirmText: '保存修正',
      cancelText: '继续编辑',
      variant: 'warning',
    });

    controller.resolve(false);
    await expect(result).resolves.toBe(false);
  });

  it('cancels a pending dialog when another async confirm starts', async () => {
    const controller = createConfirmDialogController();
    const first = controller.confirm({ title: '第一次', description: '说明' });
    const second = controller.confirm({ title: '第二次', description: '说明', variant: 'warning' });

    await expect(first).resolves.toBe(false);
    expect(controller.getPending()?.title).toBe('第二次');
    controller.resolve(true);
    await expect(second).resolves.toBe(true);
  });

  it('renders danger and warning variants through the unified component', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/ui/ConfirmDialog.tsx'), 'utf8');

    expect(source).toContain("ConfirmDialogVariant = 'default' | 'danger' | 'warning'");
    expect(source).toContain("tone === 'warning'");
    expect(source).toContain('aria-modal');
  });
});
