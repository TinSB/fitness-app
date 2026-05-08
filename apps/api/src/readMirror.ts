import type { AppData, TrainingSession } from '../../../packages/contracts/src';
import { APP_DATA_SCHEMA_VERSION } from '../../../packages/contracts/src';
import {
  buildSessionDetailSummary,
  filterAnalyticsHistory,
  getSessionCalendarDate,
  listSessionHistory,
} from '../../../packages/core/src';
import { buildDataHealthReport } from '../../../src/engines/dataHealthEngine';
import { sanitizeData } from '../../../src/storage/appDataSanitize';

export type ReadMirrorMethod = 'GET';

export type ReadMirrorRoute =
  | '/health'
  | '/app-data/summary'
  | '/sessions/summary'
  | '/history'
  | '/history/:id'
  | '/data-health/summary';

export type ReadMirrorRequest = {
  method: ReadMirrorMethod | string;
  path: string;
};

export type ReadMirrorResponse<TBody = unknown> = {
  status: number;
  body: TBody;
};

export const READ_MIRROR_ROUTES: Array<{
  method: ReadMirrorMethod;
  path: ReadMirrorRoute;
  description: string;
}> = [
  { method: 'GET', path: '/health', description: 'Read-only API skeleton health and schema version.' },
  { method: 'GET', path: '/app-data/summary', description: 'AppData count and selected-state mirror.' },
  { method: 'GET', path: '/sessions/summary', description: 'Active and historical session count mirror.' },
  { method: 'GET', path: '/history', description: 'Record history list mirror.' },
  { method: 'GET', path: '/history/:id', description: 'Record history detail mirror.' },
  { method: 'GET', path: '/data-health/summary', description: 'DataHealth report summary mirror.' },
];

export type ReadMirrorHealth = {
  ok: true;
  service: 'ironpath-read-mirror-api';
  mode: 'read_only';
  schemaVersion: number;
  appDataSchemaVersion: number;
  routes: Array<Pick<(typeof READ_MIRROR_ROUTES)[number], 'method' | 'path'>>;
};

export type ReadMirrorAppDataSummary = {
  schemaVersion: number;
  templateCount: number;
  historyCount: number;
  activeSessionId?: string;
  selectedTemplateId?: string;
  activeProgramTemplateId?: string;
  trainingMode?: string;
  weightUnit?: string;
  pendingSessionPatchCount: number;
  dismissedCoachActionCount: number;
  dismissedDataHealthIssueCount: number;
  dataRepairLogCount: number;
};

export type ReadMirrorSessionSummary = {
  activeSession: ReadMirrorSessionListItem | null;
  totalHistorySessions: number;
  completedHistorySessions: number;
  analyticsSessionCount: number;
  byDataFlag: Record<'normal' | 'test' | 'excluded', number>;
  latestSession: ReadMirrorSessionListItem | null;
};

export type ReadMirrorSessionListItem = {
  id: string;
  calendarDate: string;
  templateId: string;
  templateName: string;
  dataFlag: 'normal' | 'test' | 'excluded';
  completed: boolean;
  completedWorkingSets: number;
  effectiveSets: number;
  warmupSets: number;
  incompleteSets: number;
  workingVolumeKg: number;
  excludedFromStats: boolean;
};

export type ReadMirrorHistoryList = {
  sessions: ReadMirrorSessionListItem[];
};

export type ReadMirrorHistoryDetail = {
  session: TrainingSession;
  calendarDate: string;
  summary: ReturnType<typeof buildSessionDetailSummary>;
};

export type ReadMirrorDataHealthSummary = {
  status: ReturnType<typeof buildDataHealthReport>['status'];
  summary: string;
  issueCount: number;
  issues: ReturnType<typeof buildDataHealthReport>['issues'];
};

const normalFlag = (session: Pick<TrainingSession, 'dataFlag'>): 'normal' | 'test' | 'excluded' =>
  session.dataFlag === 'test' || session.dataFlag === 'excluded' ? session.dataFlag : 'normal';

export const buildReadMirrorAppData = (rawData: unknown): AppData => sanitizeData(rawData);

export const buildReadMirrorHealth = (data: AppData): ReadMirrorHealth => ({
  ok: true,
  service: 'ironpath-read-mirror-api',
  mode: 'read_only',
  schemaVersion: APP_DATA_SCHEMA_VERSION,
  appDataSchemaVersion: data.schemaVersion,
  routes: READ_MIRROR_ROUTES.map(({ method, path }) => ({ method, path })),
});

export const buildReadMirrorAppDataSummary = (data: AppData): ReadMirrorAppDataSummary => ({
  schemaVersion: data.schemaVersion,
  templateCount: data.templates.length,
  historyCount: data.history.length,
  activeSessionId: data.activeSession?.id,
  selectedTemplateId: data.selectedTemplateId,
  activeProgramTemplateId: data.activeProgramTemplateId,
  trainingMode: data.trainingMode,
  weightUnit: data.unitSettings?.weightUnit,
  pendingSessionPatchCount: data.pendingSessionPatches?.length || 0,
  dismissedCoachActionCount: data.dismissedCoachActions?.length || 0,
  dismissedDataHealthIssueCount: data.dismissedDataHealthIssues?.length || 0,
  dataRepairLogCount: data.settings.dataRepairLogs?.length || 0,
});

export const buildReadMirrorSessionListItem = (session: TrainingSession): ReadMirrorSessionListItem => {
  const summary = buildSessionDetailSummary(session);
  return {
    id: session.id,
    calendarDate: getSessionCalendarDate(session),
    templateId: session.templateId,
    templateName: session.templateName,
    dataFlag: normalFlag(session),
    completed: session.completed === true,
    completedWorkingSets: summary.completedWorkingSets,
    effectiveSets: summary.effectiveSets,
    warmupSets: summary.warmupSets,
    incompleteSets: summary.incompleteSets,
    workingVolumeKg: summary.workingVolumeKg,
    excludedFromStats: summary.excludedFromStats,
  };
};

export const buildReadMirrorSessionsSummary = (data: AppData): ReadMirrorSessionSummary => {
  const history = listSessionHistory(data.history);
  const byDataFlag = history.reduce<Record<'normal' | 'test' | 'excluded', number>>(
    (acc, session) => {
      acc[normalFlag(session)] += 1;
      return acc;
    },
    { normal: 0, test: 0, excluded: 0 },
  );
  return {
    activeSession: data.activeSession ? buildReadMirrorSessionListItem(data.activeSession) : null,
    totalHistorySessions: history.length,
    completedHistorySessions: history.filter((session) => session.completed === true).length,
    analyticsSessionCount: filterAnalyticsHistory(history).length,
    byDataFlag,
    latestSession: history[0] ? buildReadMirrorSessionListItem(history[0]) : null,
  };
};

export const buildReadMirrorHistoryList = (data: AppData): ReadMirrorHistoryList => ({
  sessions: listSessionHistory(data.history).map(buildReadMirrorSessionListItem),
});

export const buildReadMirrorHistoryDetail = (data: AppData, sessionId: string): ReadMirrorHistoryDetail | null => {
  const session = data.history.find((item) => item.id === sessionId) || null;
  if (!session) return null;
  return {
    session,
    calendarDate: getSessionCalendarDate(session),
    summary: buildSessionDetailSummary(session, data.unitSettings),
  };
};

export const buildReadMirrorDataHealthSummary = (data: AppData): ReadMirrorDataHealthSummary => {
  const report = buildDataHealthReport(data);
  return {
    status: report.status,
    summary: report.summary,
    issueCount: report.issues.length,
    issues: report.issues,
  };
};

export const handleReadMirrorRequest = (data: AppData, request: ReadMirrorRequest): ReadMirrorResponse => {
  if (request.method !== 'GET') {
    return {
      status: 405,
      body: { error: 'Read mirror API only supports GET requests.' },
    };
  }

  if (request.path === '/health') return { status: 200, body: buildReadMirrorHealth(data) };
  if (request.path === '/app-data/summary') return { status: 200, body: buildReadMirrorAppDataSummary(data) };
  if (request.path === '/sessions/summary') return { status: 200, body: buildReadMirrorSessionsSummary(data) };
  if (request.path === '/history') return { status: 200, body: buildReadMirrorHistoryList(data) };
  if (request.path === '/data-health/summary') return { status: 200, body: buildReadMirrorDataHealthSummary(data) };

  const historyMatch = request.path.match(/^\/history\/([^/]+)$/);
  if (historyMatch) {
    const detail = buildReadMirrorHistoryDetail(data, decodeURIComponent(historyMatch[1]));
    return detail
      ? { status: 200, body: detail }
      : { status: 404, body: { error: 'History session not found.' } };
  }

  return {
    status: 404,
    body: { error: 'Read mirror route not found.' },
  };
};
