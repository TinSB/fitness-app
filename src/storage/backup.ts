import { analyzeImportedAppData } from '../engines/dataRepairEngine';
import type { AppData } from '../models/training-model';
import { sanitizeData, validateAppDataSchema } from './persistence';

export interface ImportAppDataResult {
  ok: boolean;
  data?: AppData;
  error?: string;
}

export const getBackupFileName = (date = new Date()) => `ironpath-backup-${date.toISOString().slice(0, 10)}.json`;

export const exportAppData = (data: AppData) => JSON.stringify(sanitizeData(data), null, 2);

export const importAppData = (jsonText: string): ImportAppDataResult => {
  try {
    const parsed = JSON.parse(jsonText) as unknown;
    const importReport = analyzeImportedAppData(parsed);
    if (importReport.status === 'unsafe') {
      return {
        ok: false,
        error: importReport.issues[0]?.message || '该文件不是 IronPath 应用备份结构，未覆盖当前数据。',
      };
    }

    const sanitized = sanitizeData(parsed);

    if (!validateAppDataSchema(sanitized)) {
      return {
        ok: false,
        error: '备份文件结构不完整，未覆盖当前数据。',
      };
    }

    return { ok: true, data: sanitized };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? `备份文件不是有效 JSON：${error.message}` : '备份文件不是有效 JSON。',
    };
  }
};
