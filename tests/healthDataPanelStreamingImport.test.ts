import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const readSource = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('HealthDataPanel streaming XML import', () => {
  it('routes XML import through the worker streaming job', () => {
    const source = readSource('src/features/HealthDataPanel.tsx');
    const xmlBranch = source.slice(source.indexOf('if (isXml)'), source.indexOf("setImportStatus('reading');", source.indexOf('if (isXml)') + 800));

    expect(source).toContain('createAppleHealthStreamingImportJob');
    expect(source).toContain('isAppleHealthStreamingWorkerSupported');
    expect(xmlBranch).toContain('createAppleHealthStreamingImportJob(file');
    expect(xmlBranch).toContain('if (!isAppleHealthStreamingWorkerSupported())');
  });

  it('shows streaming progress and cancellation controls', () => {
    const source = readSource('src/features/HealthDataPanel.tsx');

    expect(source).toContain('streamProgress');
    expect(source).toContain('已扫描');
    expect(source).toContain('已识别记录');
    expect(source).toContain('取消导入');
    expect(source).toContain('streamingImportJobRef.current?.cancel()');
  });

  it('keeps preview and AppData writes separated until confirmation', () => {
    const source = readSource('src/features/HealthDataPanel.tsx');
    const handleFileBody = source.slice(source.indexOf('const handleFile'), source.indexOf('const confirmImport'));
    const confirmBody = source.slice(source.indexOf('const confirmImport'), source.indexOf('const updateBatchFlag'));

    expect(handleFileBody).toContain('setPreview(result)');
    expect(handleFileBody).not.toContain('onUpdateData');
    expect(confirmBody).toContain('onUpdateData(nextData)');
  });

  it('does not let large XML fall back to the main-thread parser when Worker is unavailable', () => {
    const source = readSource('src/features/HealthDataPanel.tsx');
    const fallbackBranch = source.slice(source.indexOf('if (!isAppleHealthStreamingWorkerSupported())'), source.indexOf("setImportStatus('parsing');", source.indexOf('if (!isAppleHealthStreamingWorkerSupported())')));

    expect(fallbackBranch).toContain('file.size > limitBytes');
    expect(fallbackBranch).toContain('当前浏览器不支持后台解析大型 XML');
    expect(fallbackBranch).toContain('return;');
  });
});
