import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  parseHealthImportFile,
  validateHealthImportFileBeforeParse,
  XML_IMPORT_DESKTOP_WARNING_BYTES,
  XML_IMPORT_MOBILE_HARD_LIMIT_BYTES,
} from '../src/engines/healthImportEngine';

const fileLike = (name: string, size: number, type = '') => ({ name, size, type }) as File;

describe('health import mobile stability', () => {
  it('warns large Apple Health XML on mobile so streaming import can run', () => {
    const validation = validateHealthImportFileBeforeParse(fileLike('export.xml', XML_IMPORT_MOBILE_HARD_LIMIT_BYTES + 1, 'text/xml'), { isMobile: true });

    expect(validation.allowed).toBe(true);
    expect(validation.severity).toBe('warning');
    expect(validation.message).toContain('后台分块解析');
  });

  it('warns but allows large Apple Health XML on desktop for streaming import', () => {
    const warning = validateHealthImportFileBeforeParse(fileLike('export.xml', XML_IMPORT_DESKTOP_WARNING_BYTES + 1, 'text/xml'), { isMobile: false });
    const forced = validateHealthImportFileBeforeParse(fileLike('export.xml', XML_IMPORT_DESKTOP_WARNING_BYTES + 1, 'text/xml'), { isMobile: false, force: true });

    expect(warning.allowed).toBe(true);
    expect(warning.severity).toBe('warning');
    expect(warning.requiresConfirmation).toBeFalsy();
    expect(forced.allowed).toBe(true);
    expect(forced.requiresConfirmation).toBeFalsy();
  });

  it('allows small XML and does not block CSV or JSON imports', () => {
    const xml = validateHealthImportFileBeforeParse(fileLike('export.xml', 2000, 'text/xml'), { isMobile: true });
    const csv = validateHealthImportFileBeforeParse(fileLike('health.csv', XML_IMPORT_MOBILE_HARD_LIMIT_BYTES * 2, 'text/csv'), { isMobile: true });
    const json = validateHealthImportFileBeforeParse(fileLike('health.json', XML_IMPORT_MOBILE_HARD_LIMIT_BYTES * 2, 'application/json'), { isMobile: true });

    expect(xml.allowed).toBe(true);
    expect(parseHealthImportFile('<?xml version="1.0"?><HealthData></HealthData>', 'export.xml').warnings.join(' ')).toContain('没有找到');
    expect(csv.allowed).toBe(true);
    expect(json.allowed).toBe(true);
  });

  it('keeps parser failures and cancellations transactional in HealthDataPanel', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/features/HealthDataPanel.tsx'), 'utf8');
    const cancelBody = source.slice(source.indexOf('const cancelImport'), source.indexOf('const handleFile'));
    const errorBody = source.slice(source.indexOf('} catch (error)'), source.indexOf('} finally'));

    expect(source).toContain("setImportStatus('error')");
    expect(source).toContain('HealthDataImportErrorState');
    expect(cancelBody).toContain('已取消导入，现有数据未改变。');
    expect(cancelBody).not.toContain('onUpdateData');
    expect(errorBody).not.toContain('onUpdateData');
  });
});
