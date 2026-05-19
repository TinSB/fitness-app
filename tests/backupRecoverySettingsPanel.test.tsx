import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { BackupRecoverySettingsPanel } from '../src/uiOs/settings/BackupRecoverySettingsPanel';

const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

describe('BackupRecoverySettingsPanel', () => {
  it('renders backup and recovery controls without HTTP route expansion copy', () => {
    const markup = renderToStaticMarkup(
      <BackupRecoverySettingsPanel
        copy="Backup / Recovery 保持 safety-first，不新增 HTTP backup/import/export route。"
        onDownloadBackup={vi.fn()}
        onDownloadCsv={vi.fn()}
        onImportClick={vi.fn()}
        onOpenRecordData={vi.fn()}
      />,
    );
    const visible = text(markup);

    expect(visible).toContain('Backup / Recovery');
    expect(visible).toContain('导出 JSON');
    expect(visible).toContain('导出 CSV');
    expect(visible).toContain('导入恢复');
    expect(visible).toContain('恢复会覆盖当前本地数据');
    expect(visible).toContain('管理单次训练记录');
  });
});
