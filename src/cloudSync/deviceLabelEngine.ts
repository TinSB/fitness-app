// Feature #40: Produce a stable, human-readable device label from the
// browser user agent so the "上次同步：iPhone, 2h 前" string in account
// settings is meaningful even when the user has signed in from multiple
// devices. The label is intentionally coarse — we report device class +
// browser family (e.g. "iPhone · Safari"), never IP, location, or
// fingerprintable identifiers.
//
// Pure function so callers can mock the user agent during testing.

export type DeviceLabelInput = {
  userAgent: string | null | undefined;
  platform?: string | null;
  fallback?: string;
};

export type DeviceLabelResult = {
  label: string;
  deviceClass: 'iphone' | 'ipad' | 'android-phone' | 'android-tablet' | 'mac' | 'windows' | 'linux' | 'unknown';
  browser: 'safari' | 'chrome' | 'edge' | 'firefox' | 'samsung' | 'unknown';
};

const detectDeviceClass = (ua: string, platform: string): DeviceLabelResult['deviceClass'] => {
  const lower = ua.toLowerCase();
  if (/iphone/.test(lower)) return 'iphone';
  if (/ipad/.test(lower) || (platform === 'MacIntel' && /touch/i.test(ua))) return 'ipad';
  if (/android/.test(lower)) return /mobile/.test(lower) ? 'android-phone' : 'android-tablet';
  if (/macintosh|mac os x/.test(lower)) return 'mac';
  if (/windows/.test(lower)) return 'windows';
  if (/linux/.test(lower)) return 'linux';
  return 'unknown';
};

const detectBrowser = (ua: string): DeviceLabelResult['browser'] => {
  const lower = ua.toLowerCase();
  // Order matters: Edge/Chrome lookalikes ship "Chrome" in their UA too.
  if (/edg\//.test(lower)) return 'edge';
  if (/samsungbrowser/.test(lower)) return 'samsung';
  if (/firefox\//.test(lower)) return 'firefox';
  if (/chrome\//.test(lower) || /crios/.test(lower)) return 'chrome';
  if (/safari\//.test(lower) && !/chrome|crios|edg|samsungbrowser/.test(lower)) return 'safari';
  return 'unknown';
};

const DEVICE_LABELS: Record<DeviceLabelResult['deviceClass'], string> = {
  iphone: 'iPhone',
  ipad: 'iPad',
  'android-phone': 'Android 手机',
  'android-tablet': 'Android 平板',
  mac: 'Mac',
  windows: 'Windows',
  linux: 'Linux',
  unknown: '未知设备',
};

const BROWSER_LABELS: Record<DeviceLabelResult['browser'], string> = {
  safari: 'Safari',
  chrome: 'Chrome',
  edge: 'Edge',
  firefox: 'Firefox',
  samsung: 'Samsung Internet',
  unknown: '浏览器',
};

export const buildDeviceLabel = (input: DeviceLabelInput): DeviceLabelResult => {
  const ua = (input.userAgent ?? '').trim();
  if (!ua) {
    return {
      label: input.fallback ?? '未知设备',
      deviceClass: 'unknown',
      browser: 'unknown',
    };
  }
  const platform = (input.platform ?? '').trim();
  const deviceClass = detectDeviceClass(ua, platform);
  const browser = detectBrowser(ua);
  const browserLabel = BROWSER_LABELS[browser];
  const deviceLabel = DEVICE_LABELS[deviceClass];
  const label =
    deviceClass === 'unknown' && browser === 'unknown'
      ? input.fallback ?? '未知设备'
      : `${deviceLabel} · ${browserLabel}`;
  return { label, deviceClass, browser };
};

const TIME_UNITS: ReadonlyArray<[number, string]> = [
  [60 * 60 * 24 * 365, '年'],
  [60 * 60 * 24 * 30, '个月'],
  [60 * 60 * 24, '天'],
  [60 * 60, '小时'],
  [60, '分钟'],
];

export const formatRelativeSyncTime = (
  syncedAtIso: string | null | undefined,
  nowIso?: string,
): string => {
  if (!syncedAtIso) return '从未同步';
  const synced = new Date(syncedAtIso);
  const now = nowIso ? new Date(nowIso) : new Date();
  if (Number.isNaN(synced.getTime()) || Number.isNaN(now.getTime())) return '同步时间未知';
  const diffSec = Math.max(0, Math.floor((now.getTime() - synced.getTime()) / 1000));
  if (diffSec < 60) return '刚刚同步';
  for (const [seconds, label] of TIME_UNITS) {
    if (diffSec >= seconds) {
      const value = Math.floor(diffSec / seconds);
      return `${value} ${label}前同步`;
    }
  }
  return '刚刚同步';
};
