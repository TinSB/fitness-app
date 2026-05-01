import React from 'react';
import { Database, Trash2, Upload } from 'lucide-react';
import {
  getXmlImportSizeLimit,
  parseHealthImportFile,
  validateHealthImportFileBeforeParse,
} from '../engines/healthImportEngine';
import {
  createAppleHealthStreamingImportJob,
  isAppleHealthStreamingWorkerSupported,
  type AppleHealthStreamingImportJob,
  type AppleHealthStreamingImportProgress,
} from '../engines/appleHealthStreamingImportEngine';
import { buildHealthSummary } from '../engines/healthSummaryEngine';
import { formatWeight } from '../engines/unitConversionEngine';
import type { AppData, HealthImportBatch, HealthMetricSample, HealthMetricType, ImportedWorkoutSample } from '../models/training-model';
import { ActionButton, Card, InlineNotice, SectionHeader, StatusBadge } from '../ui/common';
import { ErrorBoundary } from '../ui/ErrorBoundary';
import { useConfirmDialog } from '../ui/useConfirmDialog';

interface HealthDataPanelProps {
  data: AppData;
  onUpdateData: (data: AppData) => void;
}

type HealthImportPreview = ReturnType<typeof parseHealthImportFile>;
type HealthImportPreviewStats = {
  newSamples: HealthMetricSample[];
  duplicateSampleCount: number;
  skippedSampleCount: number;
  newWorkouts: ImportedWorkoutSample[];
  duplicateWorkoutCount: number;
  skippedWorkoutCount: number;
};

type XmlDateRangeOption = '7' | '30' | '90' | 'all';
type HealthImportStatus = 'idle' | 'reading' | 'parsing' | 'preview_ready' | 'error' | 'cancelled';

const HEALTH_IMPORT_WARNING_DISPLAY_LIMIT = 20;
const HEALTH_IMPORT_ERROR_TITLE = '健康数据导入失败';
const HEALTH_IMPORT_ERROR_DESCRIPTION = '文件可能过大或格式不受支持。请尝试导入最近 30 天数据，或使用 CSV/JSON。';
const APP_BACKUP_IN_HEALTH_IMPORT_MESSAGE = '这是 IronPath 应用备份 JSON，请到“我的 → 备份与恢复”导入。健康数据导入不会处理完整应用备份。';

const xmlMetricOptions: Array<{ id: HealthMetricType; label: string }> = [
  { id: 'sleep_duration', label: '睡眠' },
  { id: 'resting_heart_rate', label: '静息心率' },
  { id: 'hrv', label: 'HRV' },
  { id: 'steps', label: '步数' },
  { id: 'active_energy', label: '活动能量' },
  { id: 'body_weight', label: '体重' },
  { id: 'workout', label: '外部活动' },
];

const defaultXmlMetricTypes: HealthMetricType[] = ['sleep_duration', 'resting_heart_rate', 'hrv', 'steps', 'workout'];

const looksLikeAppDataBackup = (fileText: string) => {
  try {
    const parsed = JSON.parse(fileText) as Record<string, unknown>;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return false;
    return (
      Array.isArray(parsed.history) ||
      Array.isArray(parsed.templates) ||
      typeof parsed.programTemplate === 'object' ||
      typeof parsed.todayStatus === 'object'
    );
  } catch {
    return false;
  }
};

const buildXmlDateOptions = (range: XmlDateRangeOption) => {
  if (range === 'all') return {};
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const start = new Date(end);
  start.setDate(start.getDate() - Number(range) + 1);
  start.setHours(0, 0, 0, 0);
  return { fromDate: start.toISOString(), toDate: end.toISOString() };
};

const mergeById = <T extends { id: string }>(current: T[] = [], next: T[] = []) => {
  const map = new Map<string, T>();
  current.forEach((item) => map.set(item.id, item));
  next.forEach((item) => map.set(item.id, item));
  return [...map.values()];
};

const computePreviewStats = (
  currentSamples: HealthMetricSample[] = [],
  currentWorkouts: ImportedWorkoutSample[] = [],
  preview: HealthImportPreview | null
): HealthImportPreviewStats => {
  if (!preview) {
    return { newSamples: [], duplicateSampleCount: 0, skippedSampleCount: 0, newWorkouts: [], duplicateWorkoutCount: 0, skippedWorkoutCount: 0 };
  }
  const sampleIds = new Set(currentSamples.map((item) => item.id));
  const workoutIds = new Set(currentWorkouts.map((item) => item.id));
  const newSamples = preview.samples.filter((item) => !sampleIds.has(item.id));
  const newWorkouts = preview.workouts.filter((item) => !workoutIds.has(item.id));
  return {
    newSamples,
    duplicateSampleCount: preview.samples.length - newSamples.length,
    skippedSampleCount: Math.max(0, Number(preview.batch.skippedSampleCount || 0)),
    newWorkouts,
    duplicateWorkoutCount: preview.workouts.length - newWorkouts.length,
    skippedWorkoutCount: Math.max(0, Number(preview.batch.skippedWorkoutCount || 0)),
  };
};

const formatDateTime = (value?: string) => {
  if (!value) return '未记录';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
};

const batchItems = <T extends HealthMetricSample | ImportedWorkoutSample>(items: T[] = [], batch: HealthImportBatch) =>
  items.filter((item) => (batch.id && item.batchId === batch.id) || (!item.batchId && item.importedAt === batch.importedAt));

const batchIsExcluded = (data: AppData, batch: HealthImportBatch) => {
  if (batch.dataFlag === 'excluded') return true;
  const samples = batchItems(data.healthMetricSamples, batch);
  const workouts = batchItems(data.importedWorkoutSamples, batch);
  const combined = [...samples, ...workouts];
  return combined.length > 0 && combined.every((item) => item.dataFlag === 'excluded');
};

export const getVisibleHealthImportWarnings = (warnings: string[], limit = HEALTH_IMPORT_WARNING_DISPLAY_LIMIT) => ({
  visibleWarnings: warnings.slice(0, limit),
  hiddenWarningCount: Math.max(0, warnings.length - limit),
});

const formatImportBytes = (bytes = 0) => `${Math.round((bytes / (1024 * 1024)) * 10) / 10} MB`;

export const HealthDataImportErrorState = ({
  detail,
  onRetry,
  onClear,
}: {
  detail?: string;
  onRetry: () => void;
  onClear: () => void;
}) => (
  <Card tone="rose" className="space-y-3">
    <div>
      <div className="text-base font-semibold text-rose-950">{HEALTH_IMPORT_ERROR_TITLE}</div>
      <div className="mt-1 text-sm leading-6 text-rose-900">{detail || HEALTH_IMPORT_ERROR_DESCRIPTION}</div>
    </div>
    <div className="flex flex-wrap gap-2">
      <ActionButton variant="secondary" onClick={onRetry}>
        重新选择文件
      </ActionButton>
      <ActionButton variant="ghost" onClick={onClear}>
        清除导入状态
      </ActionButton>
    </div>
  </Card>
);

const readFileAsText = (file: File, setReader: (reader: FileReader | null) => void) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    setReader(reader);
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('文件读取失败'));
    reader.onabort = () => reject(new DOMException('导入已取消', 'AbortError'));
    reader.readAsText(file);
  });

function HealthDataPanelContent({ data, onUpdateData }: HealthDataPanelProps) {
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const readerRef = React.useRef<FileReader | null>(null);
  const streamingImportJobRef = React.useRef<AppleHealthStreamingImportJob | null>(null);
  const importJobRef = React.useRef<{ id: number; cancelled: boolean } | null>(null);
  const importJobSeqRef = React.useRef(0);
  const [preview, setPreview] = React.useState<HealthImportPreview | null>(null);
  const [message, setMessage] = React.useState('');
  const [importStatus, setImportStatus] = React.useState<HealthImportStatus>('idle');
  const [importError, setImportError] = React.useState('');
  const [streamProgress, setStreamProgress] = React.useState<AppleHealthStreamingImportProgress | null>(null);
  const [pendingFileWarning, setPendingFileWarning] = React.useState<{ file: File; message: string } | null>(null);
  const [xmlDateRange, setXmlDateRange] = React.useState<XmlDateRangeOption>('30');
  const [xmlMetricTypes, setXmlMetricTypes] = React.useState<HealthMetricType[]>(defaultXmlMetricTypes);
  const { confirm, ConfirmDialogHost } = useConfirmDialog();
  const healthIntegrationSettings = {
    useHealthDataForReadiness: data.settings?.healthIntegrationSettings?.useHealthDataForReadiness !== false,
    showExternalWorkoutsInCalendar: data.settings?.healthIntegrationSettings?.showExternalWorkoutsInCalendar !== false,
  };
  const updateHealthIntegrationSettings = (updates: Partial<typeof healthIntegrationSettings>) => {
    onUpdateData({
      ...data,
      settings: {
        ...data.settings,
        healthIntegrationSettings: {
          ...healthIntegrationSettings,
          ...updates,
        },
      },
    });
  };
  const summary = React.useMemo(
    () => buildHealthSummary(data.healthMetricSamples || [], data.importedWorkoutSamples || []),
    [data.healthMetricSamples, data.importedWorkoutSamples]
  );
  const previewStats = React.useMemo(
    () => computePreviewStats(data.healthMetricSamples || [], data.importedWorkoutSamples || [], preview),
    [data.healthMetricSamples, data.importedWorkoutSamples, preview]
  );
  const batches = [...(data.healthImportBatches || [])].sort((left, right) => right.importedAt.localeCompare(left.importedAt));
  const importBusy = importStatus === 'reading' || importStatus === 'parsing';

  React.useEffect(
    () => () => {
      if (importJobRef.current) importJobRef.current.cancelled = true;
      if (readerRef.current && readerRef.current.readyState === 1) readerRef.current.abort();
      streamingImportJobRef.current?.cancel();
    },
    []
  );

  const clearImportState = () => {
    if (importJobRef.current) importJobRef.current.cancelled = true;
    if (readerRef.current && readerRef.current.readyState === 1) readerRef.current.abort();
    streamingImportJobRef.current?.cancel();
    importJobRef.current = null;
    readerRef.current = null;
    streamingImportJobRef.current = null;
    setPreview(null);
    setPendingFileWarning(null);
    setImportError('');
    setStreamProgress(null);
    setImportStatus('idle');
    setMessage('');
    if (inputRef.current) inputRef.current.value = '';
  };

  const retryImport = () => {
    clearImportState();
    window.setTimeout(() => inputRef.current?.click(), 0);
  };

  const cancelImport = () => {
    if (importJobRef.current) importJobRef.current.cancelled = true;
    if (readerRef.current && readerRef.current.readyState === 1) readerRef.current.abort();
    streamingImportJobRef.current?.cancel();
    importJobRef.current = null;
    readerRef.current = null;
    streamingImportJobRef.current = null;
    setPreview(null);
    setPendingFileWarning(null);
    setImportError('');
    setStreamProgress(null);
    setImportStatus('cancelled');
    setMessage('已取消导入，现有数据未改变。');
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleFile = async (file?: File, options: { force?: boolean } = {}) => {
    if (!file) return;
    const validation = validateHealthImportFileBeforeParse(file, { force: options.force });
    setPreview(null);
    setImportError('');
    setPendingFileWarning(null);
    setStreamProgress(null);

    if (!validation.allowed) {
      setImportStatus('error');
      setImportError(validation.message || HEALTH_IMPORT_ERROR_DESCRIPTION);
      setMessage(validation.message || HEALTH_IMPORT_ERROR_DESCRIPTION);
      if (inputRef.current) inputRef.current.value = '';
      return;
    }

    if (validation.requiresConfirmation && validation.message && !options.force) {
      setImportStatus('idle');
      setPendingFileWarning({ file, message: validation.message });
      setMessage(validation.message);
      if (inputRef.current) inputRef.current.value = '';
      return;
    }

    const job = { id: importJobSeqRef.current + 1, cancelled: false };
    importJobSeqRef.current = job.id;
    importJobRef.current = job;
    let fileText = '';
    try {
      const isXml = validation.kind === 'xml' || file.name.toLowerCase().endsWith('.xml');
      if (isXml) {
        const xmlOptions = {
          ...buildXmlDateOptions(xmlDateRange),
          metricTypes: xmlMetricTypes,
          includeWorkouts: xmlMetricTypes.includes('workout'),
        };

        if (!isAppleHealthStreamingWorkerSupported()) {
          const limitBytes = validation.limitBytes || getXmlImportSizeLimit(validation.mobile);
          if (file.size > limitBytes) {
            setImportStatus('error');
            setImportError('当前浏览器不支持后台解析大型 XML，请使用电脑端或 CSV/JSON 导入。');
            setMessage('当前浏览器不支持后台解析大型 XML，请使用电脑端或 CSV/JSON 导入。');
            return;
          }

          setImportStatus('reading');
          setMessage('正在读取小型 Apple Health XML…');
          fileText = await readFileAsText(file, (reader) => {
            readerRef.current = reader;
          });
          if (job.cancelled || importJobRef.current?.id !== job.id) return;
          setImportStatus('parsing');
          setMessage('正在解析 Apple Health XML…');
          const result = parseHealthImportFile(fileText, file.name, xmlOptions);
          fileText = '';
          if (job.cancelled || importJobRef.current?.id !== job.id) return;
          setPreview(result);
          setImportStatus('preview_ready');
          setMessage(result.samples.length || result.workouts.length ? '已生成 Apple Health XML 导入预览。' : '没有找到可导入的健康数据。');
          return;
        }

        setImportStatus('parsing');
        setMessage(validation.message || '正在解析 Apple Health XML…大型 XML 会在后台分块解析，可能需要几分钟。');
        const streamingJob = createAppleHealthStreamingImportJob(file, xmlOptions, {
          onProgress: (progress) => {
            if (importJobRef.current?.id !== job.id || job.cancelled) return;
            setStreamProgress(progress);
          },
        });
        streamingImportJobRef.current = streamingJob;
        const result = await streamingJob.promise;
        streamingImportJobRef.current = null;
        if (job.cancelled || importJobRef.current?.id !== job.id) return;
        setPreview(result);
        setImportStatus('preview_ready');
        setMessage(result.samples.length || result.workouts.length ? '已生成 Apple Health XML 导入预览。' : '没有找到可导入的健康数据。');
        return;
      }

      setImportStatus('reading');
      setMessage('正在读取文件…');
      fileText = await readFileAsText(file, (reader) => {
        readerRef.current = reader;
      });
      if (job.cancelled || importJobRef.current?.id !== job.id) return;

      setImportStatus('parsing');
      setMessage('正在解析健康数据…');
      await new Promise<void>((resolve) => (typeof window === 'undefined' ? resolve() : window.setTimeout(resolve, 0)));
      if (job.cancelled || importJobRef.current?.id !== job.id) return;

      if (file.name.toLowerCase().endsWith('.json') && looksLikeAppDataBackup(fileText)) {
        fileText = '';
        setPreview(null);
        setImportStatus('error');
        setImportError(APP_BACKUP_IN_HEALTH_IMPORT_MESSAGE);
        setMessage(APP_BACKUP_IN_HEALTH_IMPORT_MESSAGE);
        return;
      }

      const result = parseHealthImportFile(fileText, file.name);
      fileText = '';
      if (job.cancelled || importJobRef.current?.id !== job.id) return;
      setPreview(result);
      setImportStatus('preview_ready');
      setMessage(result.samples.length || result.workouts.length ? '文件已解析，请确认后导入。' : '没有找到可导入的健康数据。');
    } catch (error) {
      fileText = '';
      streamingImportJobRef.current = null;
      if ((error as Error)?.name === 'AbortError' || job.cancelled) {
        setImportStatus('cancelled');
        setMessage('已取消导入，现有数据未改变。');
        return;
      }
      console.error('Health data import failed.', error);
      setPreview(null);
      setImportStatus('error');
      setImportError(HEALTH_IMPORT_ERROR_DESCRIPTION);
      setMessage(HEALTH_IMPORT_ERROR_DESCRIPTION);
    } finally {
      if (importJobRef.current?.id === job.id) importJobRef.current = null;
      readerRef.current = null;
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const confirmImport = () => {
    if (importStatus !== 'preview_ready' || !preview || (!preview.samples.length && !preview.workouts.length)) return;
    const batch: HealthImportBatch = {
      ...preview.batch,
      sampleCount: previewStats.newSamples.length,
      workoutCount: previewStats.newWorkouts.length,
      newSampleCount: previewStats.newSamples.length,
      duplicateSampleCount: previewStats.duplicateSampleCount,
      skippedSampleCount: previewStats.skippedSampleCount,
      newWorkoutCount: previewStats.newWorkouts.length,
      duplicateWorkoutCount: previewStats.duplicateWorkoutCount,
      skippedWorkoutCount: previewStats.skippedWorkoutCount,
    };
    try {
      const nextData = {
        ...data,
        healthMetricSamples: mergeById(data.healthMetricSamples, previewStats.newSamples.map((item) => ({ ...item, batchId: batch.id }))),
        importedWorkoutSamples: mergeById(data.importedWorkoutSamples, previewStats.newWorkouts.map((item) => ({ ...item, batchId: batch.id }))),
        healthImportBatches: mergeById(data.healthImportBatches, [batch]).sort((left, right) => right.importedAt.localeCompare(left.importedAt)),
      };
      onUpdateData(nextData);
    } catch (error) {
      console.error('Health data merge failed.', error);
      setImportStatus('error');
      setImportError('导入合并失败，现有数据没有被覆盖。请重新选择文件再试。');
      return;
    }
    setMessage(`健康数据已导入：新增样本 ${previewStats.newSamples.length}，重复样本 ${previewStats.duplicateSampleCount}，新增外部活动 ${previewStats.newWorkouts.length}。`);
    setPreview(null);
    setImportStatus('idle');
  };

  const updateBatchFlag = async (batch: HealthImportBatch, dataFlag: 'normal' | 'excluded') => {
    if (dataFlag === 'excluded') {
      const confirmed = await confirm({
        title: '更改数据状态？',
        description: '测试或排除数据仍可查看，但不会参与训练统计。',
        confirmText: '确认更改',
        cancelText: '取消',
        variant: 'warning',
      });
      if (!confirmed) return;
    }
    onUpdateData({
      ...data,
      healthMetricSamples: (data.healthMetricSamples || []).map((item) => ((item.batchId === batch.id || (!item.batchId && item.importedAt === batch.importedAt)) ? { ...item, dataFlag } : item)),
      importedWorkoutSamples: (data.importedWorkoutSamples || []).map((item) => ((item.batchId === batch.id || (!item.batchId && item.importedAt === batch.importedAt)) ? { ...item, dataFlag } : item)),
      healthImportBatches: (data.healthImportBatches || []).map((item) => (item.id === batch.id ? { ...item, dataFlag } : item)),
    });
    setMessage(dataFlag === 'excluded' ? '已排除该批健康数据。' : '该批健康数据已恢复参与分析。');
  };

  const deleteBatch = async (batch: HealthImportBatch) => {
    const confirmed = await confirm({
      title: '删除这批健康数据？',
      description: '删除后，这批导入的睡眠、心率、HRV、运动记录将不再用于准备度和日历。',
      confirmText: '删除',
      cancelText: '取消',
      variant: 'danger',
    });
    if (!confirmed) return;
    onUpdateData({
      ...data,
      healthMetricSamples: (data.healthMetricSamples || []).filter((item) => item.batchId !== batch.id && (item.batchId || item.importedAt !== batch.importedAt)),
      importedWorkoutSamples: (data.importedWorkoutSamples || []).filter((item) => item.batchId !== batch.id && (item.batchId || item.importedAt !== batch.importedAt)),
      healthImportBatches: (data.healthImportBatches || []).filter((item) => item.id !== batch.id),
    });
    setMessage('已删除该批健康数据。');
  };

  const confirmLargeXmlImport = async () => {
    if (!pendingFileWarning) return;
    const confirmed = await confirm({
      title: '继续解析大型 XML？',
      description: '手机端解析大型文件可能较慢或失败。建议优先导入最近 30–90 天数据。',
      confirmText: '继续解析',
      cancelText: '取消',
      variant: 'warning',
    });
    if (confirmed) {
      void handleFile(pendingFileWarning.file, { force: true });
    } else {
      setPendingFileWarning(null);
    }
  };

  return (
    <Card>
      <SectionHeader
        eyebrow="健康数据"
        title="健康数据导入"
        description="当前 Web 版不能直接读取 Apple Health。你可以导入 CSV / JSON / Apple Health export.xml，让 IronPath 辅助判断准备度和恢复。"
        action={<StatusBadge tone="slate">手动导入</StatusBadge>}
      />

      <div className="grid gap-3 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-3">
          <InlineNotice tone="slate" title="边界">
            Safari PWA 不能直接读取 HealthKit；导入数据仅作恢复和活动负荷参考，不作医疗诊断。
          </InlineNotice>
          <InlineNotice tone="amber" title="Apple Health XML">
            Apple Health 官方导出的 export.xml 可能很大。现在会在后台分块解析；手机端仍建议只导入最近 30 天或 90 天数据，CSV/JSON 仍然最快。
          </InlineNotice>
          <div className="grid gap-2 rounded-lg border border-slate-200 bg-white p-3 text-sm">
            <label className="flex items-center justify-between gap-3">
              <span className="font-semibold text-slate-700">用健康数据辅助准备度</span>
              <input
                type="checkbox"
                checked={healthIntegrationSettings.useHealthDataForReadiness}
                onChange={(event) => updateHealthIntegrationSettings({ useHealthDataForReadiness: event.target.checked })}
              />
            </label>
            <label className="flex items-center justify-between gap-3">
              <span className="font-semibold text-slate-700">日历显示外部活动</span>
              <input
                type="checkbox"
                checked={healthIntegrationSettings.showExternalWorkoutsInCalendar}
                onChange={(event) => updateHealthIntegrationSettings({ showExternalWorkoutsInCalendar: event.target.checked })}
              />
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <ActionButton variant="secondary" onClick={() => inputRef.current?.click()} disabled={importBusy}>
              <Upload className="h-4 w-4" />
              选择 CSV / JSON / XML
            </ActionButton>
            {importBusy ? (
              <ActionButton variant="ghost" onClick={cancelImport}>
                取消导入
              </ActionButton>
            ) : null}
            <input
              ref={inputRef}
              type="file"
              accept=".json,.csv,.xml,application/json,text/csv,text/xml,application/xml"
              className="hidden"
              onChange={(event) => void handleFile(event.target.files?.[0])}
            />
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <div className="text-sm font-semibold text-slate-950">Apple Health XML 导入选项</div>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {([
                ['7', '最近 7 天'],
                ['30', '最近 30 天'],
                ['90', '最近 90 天'],
                ['all', '全部'],
              ] as Array<[XmlDateRangeOption, string]>).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setXmlDateRange(id)}
                  className={[
                    'min-h-10 rounded-lg border px-2 text-sm font-semibold',
                    xmlDateRange === id ? 'border-emerald-500 bg-emerald-50 text-emerald-900' : 'border-slate-200 bg-white text-slate-600',
                  ].join(' ')}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {xmlMetricOptions.map((option) => {
                const selected = xmlMetricTypes.includes(option.id);
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() =>
                      setXmlMetricTypes((current) =>
                        selected ? current.filter((item) => item !== option.id) : [...current, option.id]
                      )
                    }
                    className={[
                      'rounded-md border px-2 py-1 text-xs font-semibold',
                      selected ? 'border-emerald-500 bg-emerald-50 text-emerald-900' : 'border-slate-200 bg-white text-slate-600',
                    ].join(' ')}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
            <div className="mt-2 text-xs leading-5 text-slate-500">默认导入最近 30 天的睡眠、静息心率、HRV、步数和外部活动。</div>
          </div>

          {importBusy ? (
            <InlineNotice tone="amber" title={importStatus === 'reading' ? '正在读取文件' : '正在解析 Apple Health XML'}>
              <div className="space-y-2">
                <div>{importStatus === 'reading' ? '正在读取文件…' : '正在解析 Apple Health XML…'} 解析完成前不能确认导入。</div>
                {streamProgress ? (
                  <div className="rounded-md bg-white p-2 text-xs leading-5 text-slate-700">
                    <div className="font-semibold text-slate-950">
                      进度 {streamProgress.totalBytes ? Math.min(100, Math.round((streamProgress.processedBytes / streamProgress.totalBytes) * 100)) : 0}%
                    </div>
                    <div>
                      已扫描 {formatImportBytes(streamProgress.processedBytes)} / {formatImportBytes(streamProgress.totalBytes)}
                    </div>
                    <div>
                      已识别记录 {streamProgress.detectedRecordCount} 条 / 已导入样本 {streamProgress.importedSampleCount} 条 / 外部活动 {streamProgress.importedWorkoutCount} 条
                    </div>
                  </div>
                ) : null}
                <ActionButton variant="secondary" onClick={cancelImport}>
                  取消导入
                </ActionButton>
              </div>
            </InlineNotice>
          ) : null}

          {pendingFileWarning ? (
            <InlineNotice tone="amber" title="文件较大">
              <div className="space-y-2">
                <div>{pendingFileWarning.message}</div>
                <div className="flex flex-wrap gap-2">
                  <ActionButton variant="primary" onClick={() => void confirmLargeXmlImport()}>
                    继续解析
                  </ActionButton>
                  <ActionButton variant="ghost" onClick={retryImport}>
                    重新选择文件
                  </ActionButton>
                </div>
                <div className="text-xs text-amber-800">继续后可能耗时较长。</div>
              </div>
            </InlineNotice>
          ) : null}

          {importStatus === 'error' ? (
            <HealthDataImportErrorState detail={importError || undefined} onRetry={retryImport} onClear={clearImportState} />
          ) : null}

          {preview ? (
            <div className="rounded-lg border border-slate-200 bg-stone-50 p-3 text-sm">
              <div className="font-semibold text-slate-950">导入预览</div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <div className="rounded-md bg-white p-2">
                  <div className="text-xs text-slate-500">新增样本</div>
                  <div className="text-lg font-semibold text-slate-950">{previewStats.newSamples.length}</div>
                </div>
                <div className="rounded-md bg-white p-2">
                  <div className="text-xs text-slate-500">新增外部活动</div>
                  <div className="text-lg font-semibold text-slate-950">{previewStats.newWorkouts.length}</div>
                </div>
                <div className="rounded-md bg-white p-2">
                  <div className="text-xs text-slate-500">重复样本</div>
                  <div className="text-lg font-semibold text-slate-950">{previewStats.duplicateSampleCount}</div>
                </div>
                <div className="rounded-md bg-white p-2">
                  <div className="text-xs text-slate-500">重复活动</div>
                  <div className="text-lg font-semibold text-slate-950">{previewStats.duplicateWorkoutCount}</div>
                </div>
              </div>
              {preview.summary ? (
                <div className="mt-2 rounded-md bg-white p-2 text-xs leading-5 text-slate-600">
                  识别 Record {preview.summary.detectedRecordCount} 条 / 导入指标 {preview.summary.metricTypes.join('、') || '无'}
                  {preview.summary.dateRange ? ` / ${preview.summary.dateRange.startDate.slice(0, 10)} 至 ${preview.summary.dateRange.endDate.slice(0, 10)}` : ''}
                </div>
              ) : null}
              {preview.warnings.length ? (
                <div className="mt-2 space-y-1 text-xs leading-5 text-amber-700">
                  {getVisibleHealthImportWarnings(preview.warnings).visibleWarnings.map((warning) => <div key={warning}>{warning}</div>)}
                  {getVisibleHealthImportWarnings(preview.warnings).hiddenWarningCount ? (
                    <div>还有 {getVisibleHealthImportWarnings(preview.warnings).hiddenWarningCount} 条警告。</div>
                  ) : null}
                </div>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                <ActionButton variant="primary" onClick={confirmImport} disabled={importStatus !== 'preview_ready' || (!previewStats.newSamples.length && !previewStats.newWorkouts.length)}>
                  确认导入
                </ActionButton>
                <ActionButton variant="ghost" onClick={cancelImport}>
                  取消
                </ActionButton>
              </div>
            </div>
          ) : null}

          {message ? <InlineNotice tone={message.includes('没有') ? 'amber' : 'emerald'}>{message}</InlineNotice> : null}
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
            <div className="rounded-lg bg-stone-50 p-3 text-sm">
              <div className="text-xs text-slate-500">最近睡眠</div>
              <div className="mt-1 font-semibold text-slate-950">{summary.latestSleepHours ? `${summary.latestSleepHours} 小时` : '暂无'}</div>
            </div>
            <div className="rounded-lg bg-stone-50 p-3 text-sm">
              <div className="text-xs text-slate-500">静息心率</div>
              <div className="mt-1 font-semibold text-slate-950">{summary.latestRestingHeartRate ? `${summary.latestRestingHeartRate} bpm` : '暂无'}</div>
            </div>
            <div className="rounded-lg bg-stone-50 p-3 text-sm">
              <div className="text-xs text-slate-500">HRV</div>
              <div className="mt-1 font-semibold text-slate-950">{summary.latestHrv ? `${summary.latestHrv} ms` : '暂无'}</div>
            </div>
            <div className="rounded-lg bg-stone-50 p-3 text-sm">
              <div className="text-xs text-slate-500">步数</div>
              <div className="mt-1 font-semibold text-slate-950">{summary.latestSteps ? Math.round(summary.latestSteps) : '暂无'}</div>
            </div>
            <div className="rounded-lg bg-stone-50 p-3 text-sm">
              <div className="text-xs text-slate-500">体重</div>
              <div className="mt-1 font-semibold text-slate-950">{summary.latestBodyWeightKg ? formatWeight(summary.latestBodyWeightKg, data.unitSettings) : '暂无'}</div>
            </div>
            <div className="rounded-lg bg-stone-50 p-3 text-sm">
              <div className="text-xs text-slate-500">外部活动</div>
              <div className="mt-1 font-semibold text-slate-950">{summary.recentWorkoutCount} 次 / {summary.recentWorkoutMinutes} 分钟</div>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-950">
              <Database className="h-4 w-4 text-emerald-600" />
              导入历史
            </div>
            {batches.length ? (
              <div className="space-y-2">
                {batches.slice(0, 6).map((batch) => {
                  const excluded = batchIsExcluded(data, batch);
                  return (
                    <div key={batch.id} className="rounded-lg bg-stone-50 p-3 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="font-semibold text-slate-950">{batch.fileName || '健康数据导入'}</div>
                        <StatusBadge tone={excluded ? 'slate' : 'emerald'}>{excluded ? '已排除' : '参与分析'}</StatusBadge>
                      </div>
                      <div className="mt-1 text-xs leading-5 text-slate-500">
                        {formatDateTime(batch.importedAt)} / 新增样本 {batch.newSampleCount ?? batch.sampleCount} / 重复样本 {batch.duplicateSampleCount ?? 0} / 新增外部活动 {batch.newWorkoutCount ?? batch.workoutCount}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => updateBatchFlag(batch, excluded ? 'normal' : 'excluded')}
                          className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700"
                        >
                          {excluded ? '恢复参与' : '排除统计'}
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteBatch(batch)}
                          className="inline-flex items-center gap-1 rounded-md border border-rose-200 bg-white px-2 py-1 text-xs font-semibold text-rose-700"
                        >
                          <Trash2 className="h-3 w-3" />
                          删除
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-lg bg-stone-50 p-4 text-sm text-slate-500">暂无健康数据导入记录。</div>
            )}
          </div>

          <InlineNotice tone="slate" title="日历显示">
            Apple Watch workout 会作为外部活动背景显示，不会自动变成 IronPath 力量训练，也不会参与 PR / e1RM。
          </InlineNotice>
        </div>
      </div>
      <ConfirmDialogHost />
    </Card>
  );
}

export function HealthDataPanel(props: HealthDataPanelProps) {
  return (
    <ErrorBoundary
      onError={(error, errorInfo) => {
        console.error('HealthDataPanel crashed.', error, errorInfo);
      }}
      fallback={({ resetError }) => (
        <HealthDataImportErrorState
          onRetry={resetError}
          onClear={resetError}
        />
      )}
    >
      <HealthDataPanelContent {...props} />
    </ErrorBoundary>
  );
}
