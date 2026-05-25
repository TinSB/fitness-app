import { execFileSync, spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { createServer } from 'node:net';
import { describe, expect, it } from 'vitest';

const REQUIRED_GMAIL_SMOKE_ENV_KEYS = [
  'IRONPATH_AUTH_SMOKE_EMAIL',
  'IRONPATH_AUTH_SMOKE_BASE_URL',
  'GOOGLE_GMAIL_CLIENT_ID',
  'GOOGLE_GMAIL_CLIENT_SECRET',
  'GOOGLE_GMAIL_REFRESH_TOKEN',
] as const;

type GmailSmokeEnvKey = typeof REQUIRED_GMAIL_SMOKE_ENV_KEYS[number];

type GmailSmokeEnv = Record<GmailSmokeEnvKey, string>;

type BrowserSmokeResult = {
  authCard: boolean;
  signedIn: boolean;
  syncOff: boolean;
  noCloudPrimary: boolean;
  noDefaultSync: boolean;
  noBackgroundSync: boolean;
};

const repoRoot = () => process.cwd();

const readLocalEnv = () => {
  const envFile = resolve(repoRoot(), '.env.local');
  const values: Record<string, string> = {};
  if (!existsSync(envFile)) return values;

  for (const rawLine of readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || !line.includes('=')) continue;
    const [key, ...rest] = line.split('=');
    values[key.trim()] = rest.join('=').trim().replace(/^['"]|['"]$/g, '');
  }
  return values;
};

const resolveSmokeEnv = () => {
  const localEnv = readLocalEnv();
  const missing: GmailSmokeEnvKey[] = [];
  const values = {} as GmailSmokeEnv;

  for (const key of REQUIRED_GMAIL_SMOKE_ENV_KEYS) {
    const value = process.env[key] || localEnv[key];
    if (!value?.trim()) {
      missing.push(key);
      continue;
    }
    values[key] = value.trim();
  }

  return { missing, values };
};

const redact = (text: string, values: string[]) => {
  let redacted = text;
  for (const value of values.filter(Boolean)) {
    redacted = redacted.split(value).join('[redacted]');
  }
  return redacted
    .replace(/access_token=[^&\s"'<>]+/gi, 'access_token=[redacted]')
    .replace(/refresh_token=[^&\s"'<>]+/gi, 'refresh_token=[redacted]')
    .replace(/token_hash=[^&\s"'<>]+/gi, 'token_hash=[redacted]')
    .replace(/token=[^&\s"'<>]+/gi, 'token=[redacted]');
};

const requestJson = async <TValue>(
  url: string,
  init: RequestInit,
  redactions: string[],
): Promise<TValue> => {
  const response = await fetch(url, init);
  if (!response.ok) {
    throw new Error(`request failed: ${response.status} ${response.statusText}`);
  }
  const text = await response.text();
  return JSON.parse(redact(text, redactions)) as TValue;
};

const getGmailAccessToken = async (env: GmailSmokeEnv) => {
  const params = new URLSearchParams({
    client_id: env.GOOGLE_GMAIL_CLIENT_ID,
    client_secret: env.GOOGLE_GMAIL_CLIENT_SECRET,
    refresh_token: env.GOOGLE_GMAIL_REFRESH_TOKEN,
    grant_type: 'refresh_token',
  });

  const result = await requestJson<{ access_token?: string }>(
    'https://oauth2.googleapis.com/token',
    {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: params,
    },
    Object.values(env),
  );

  if (!result.access_token) throw new Error('gmail access token unavailable');
  return result.access_token;
};

const gmailApi = async <TValue>(path: string, accessToken: string, env: GmailSmokeEnv) =>
  requestJson<TValue>(
    `https://gmail.googleapis.com/gmail/v1/users/me/${path}`,
    { headers: { authorization: `Bearer ${accessToken}` } },
    [...Object.values(env), accessToken],
  );

const decodeBase64Url = (value: string) =>
  Buffer.from(value.replaceAll('-', '+').replaceAll('_', '/'), 'base64').toString('utf8');

const collectMessageBodies = (payload: { body?: { data?: string }; parts?: unknown[] } | undefined): string[] => {
  if (!payload) return [];
  const bodies: string[] = [];
  if (payload.body?.data) bodies.push(decodeBase64Url(payload.body.data));
  for (const part of payload.parts || []) {
    bodies.push(...collectMessageBodies(part as { body?: { data?: string }; parts?: unknown[] }));
  }
  return bodies;
};

const htmlDecode = (value: string) =>
  value
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>');

const extractLoginLink = (message: { payload?: { body?: { data?: string }; parts?: unknown[] } }) => {
  const text = htmlDecode(collectMessageBodies(message.payload).join('\n'));
  const links = [...text.matchAll(/https?:\/\/[^\s"'<>]+/g)].map((match) => match[0]);
  return links.find((link) =>
    (
      link.includes('/auth/v1/verify') ||
      link.includes('token_hash=') ||
      link.includes('type=magiclink') ||
      link.includes('access_token=')
    ) &&
    (
      link.includes('supabase.co') ||
      link.includes('auth/callback')
    ),
  ) ?? null;
};

const waitForNewestSupabaseLoginLink = async (
  env: GmailSmokeEnv,
  accessToken: string,
  afterUnixSeconds: number,
) => {
  const query = [
    `to:${env.IRONPATH_AUTH_SMOKE_EMAIL}`,
    `after:${afterUnixSeconds}`,
    'newer_than:15m',
    'from:noreply@mail.app.supabase.io',
  ].join(' ');

  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    const list = await gmailApi<{ messages?: Array<{ id: string }> }>(
      `messages?q=${encodeURIComponent(query)}&maxResults=10`,
      accessToken,
      env,
    );

    if (list.messages?.length) {
      const metadata = await Promise.all(
        list.messages.map(async (message) => gmailApi<{ id: string; internalDate: string }>(
          `messages/${message.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
          accessToken,
          env,
        )),
      );
      const newest = metadata.sort((a, b) => Number(b.internalDate) - Number(a.internalDate))[0];
      const full = await gmailApi<{ payload?: { body?: { data?: string }; parts?: unknown[] } }>(
        `messages/${newest.id}?format=full`,
        accessToken,
        env,
      );
      const link = extractLoginLink(full);
      if (link) return link;
    }

    await new Promise((resolve) => setTimeout(resolve, 5_000));
  }

  throw new Error('newest matching Supabase login email not found');
};

const findBrowserHarness = () => {
  const pathResult = spawnSync('where.exe', ['browser-harness'], { encoding: 'utf8' });
  const fromPath = pathResult.stdout.split(/\r?\n/).find((line) => line.trim());
  if (fromPath) return fromPath.trim();

  const userProfile = process.env.USERPROFILE || process.env.HOME || '';
  const fallback = join(userProfile, '.local', 'bin', 'browser-harness.exe');
  return existsSync(fallback) ? fallback : null;
};

const findChrome = () => {
  const candidates = [
    join(process.env.ProgramFiles || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    join(process.env['ProgramFiles(x86)'] || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
  ];
  return candidates.find((candidate) => existsSync(candidate)) ?? null;
};

const getFreePort = async () =>
  new Promise<number>((resolvePort, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : null;
      server.close(() => {
        if (port) resolvePort(port);
        else reject(new Error('free port unavailable'));
      });
    });
  });

const waitForChromeDevTools = async (port: number) => {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (response.ok) return;
    } catch {
      // keep polling until Chrome exposes DevTools.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('chrome remote debugging endpoint unavailable');
};

const startIsolatedChrome = async () => {
  const chrome = findChrome();
  if (!chrome) throw new Error('chrome executable not found');

  const port = await getFreePort();
  const profileDir = mkdtempSync(join(tmpdir(), 'ironpath-gmail-auth-smoke-'));
  const processHandle = spawn(chrome, [
    '--headless=new',
    '--disable-gpu',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profileDir}`,
    'about:blank',
  ], {
    detached: false,
    stdio: 'ignore',
  });

  await waitForChromeDevTools(port);
  return { port, profileDir, processHandle };
};

const stopIsolatedChrome = (chrome: { processHandle: ChildProcess; profileDir: string } | null) => {
  if (!chrome) return;
  chrome.processHandle.kill();
  try {
    rmSync(chrome.profileDir, { recursive: true, force: true, maxRetries: 20, retryDelay: 100 });
  } catch {
    // Temp cleanup best effort only.
  }
};

const runBrowserHarness = (
  script: string,
  cdpPort: number,
  redactions: string[],
): BrowserSmokeResult => {
  const binary = findBrowserHarness();
  if (!binary) throw new Error('browser-harness executable not found');

  const result = spawnSync(binary, [], {
    input: script,
    encoding: 'utf8',
    env: {
      ...process.env,
      BU_CDP_URL: `http://127.0.0.1:${cdpPort}`,
      PATH: `${dirname(binary)};${process.env.PATH || ''}`,
    },
    maxBuffer: 1024 * 1024,
  });

  const output = redact(`${result.stdout}\n${result.stderr}`, redactions);
  if (result.status !== 0) throw new Error(`browser-harness failed: ${output.trim()}`);

  const jsonLine = result.stdout.split(/\r?\n/).reverse().find((line) => line.trim().startsWith('{'));
  if (!jsonLine) throw new Error('browser-harness did not return smoke state');
  return JSON.parse(jsonLine) as BrowserSmokeResult;
};

const passiveSyncStateJs = `
  const text = document.body.innerText || '';
  return {
    authCard: Boolean(document.querySelector('[data-testid="ironpath-auth-card"]')),
    signedIn: Boolean(document.querySelector('[data-testid="ironpath-auth-sign-out"]')) || text.includes('已登录'),
    syncOff: text.includes('同步未开启') || text.includes('本地数据仍会保留'),
    noCloudPrimary: !text.includes('云端优先'),
    noDefaultSync: !text.includes('默认开启'),
    noBackgroundSync: !text.includes('后台同步')
  };
`;

const triggerLoginScript = (baseUrl: string, email: string) => `
import json
new_tab(${JSON.stringify(baseUrl)})
wait_for_load(30)
wait_for_network_idle(timeout=15)
if not wait_for_element('[data-testid="ironpath-auth-email-input"]', timeout=5, visible=True):
    js("""
      const target = [...document.querySelectorAll('button,a,[role="button"]')]
        .find((item) => (item.textContent || '').includes('设置') || /settings/i.test(item.textContent || ''));
      if (target) target.click();
      Boolean(target);
    """)
wait_for_element('[data-testid="ironpath-auth-email-input"]', timeout=20, visible=True)
fill_input('[data-testid="ironpath-auth-email-input"]', ${JSON.stringify(email)}, timeout=5)
js("const button = document.querySelector('[data-testid=\\"ironpath-auth-sign-in\\"]'); if (button) button.click(); Boolean(button);")
wait_for_network_idle(timeout=20)
wait(2)
print(json.dumps(js("""${passiveSyncStateJs}"""), ensure_ascii=False))
`;

const completeLoginScript = (loginLink: string) => `
import json
new_tab(${JSON.stringify(loginLink)})
wait_for_load(45)
wait_for_network_idle(timeout=30)
wait(4)
if not wait_for_element('[data-testid="ironpath-auth-card"]', timeout=5, visible=True):
    js("""
      const target = [...document.querySelectorAll('button,a,[role="button"]')]
        .find((item) => (item.textContent || '').includes('设置') || /settings/i.test(item.textContent || ''));
      if (target) target.click();
      Boolean(target);
    """)
wait_for_element('[data-testid="ironpath-auth-card"]', timeout=20, visible=True)
print(json.dumps(js("""${passiveSyncStateJs}"""), ensure_ascii=False))
`;

describe('Gmail Full Auto Auth Smoke Test V1', () => {
  it('uses the newest matching Gmail magic link to confirm signed-in state while sync remains off', async () => {
    const { missing, values } = resolveSmokeEnv();
    if (missing.length > 0) {
      process.stdout.write('missing Gmail smoke env\n');
      return;
    }

    const beforeTriggerUnixSeconds = Math.floor(Date.now() / 1000) - 30;
    const chrome = await startIsolatedChrome();
    const redactions = Object.values(values);

    try {
      const triggered = runBrowserHarness(
        triggerLoginScript(values.IRONPATH_AUTH_SMOKE_BASE_URL, values.IRONPATH_AUTH_SMOKE_EMAIL),
        chrome.port,
        redactions,
      );
      expect(triggered.authCard).toBe(true);
      expect(triggered.syncOff).toBe(true);
      expect(triggered.noCloudPrimary).toBe(true);
      expect(triggered.noDefaultSync).toBe(true);
      expect(triggered.noBackgroundSync).toBe(true);

      const accessToken = await getGmailAccessToken(values);
      const loginLink = await waitForNewestSupabaseLoginLink(values, accessToken, beforeTriggerUnixSeconds);
      const signedIn = runBrowserHarness(
        completeLoginScript(loginLink),
        chrome.port,
        [...redactions, accessToken, loginLink],
      );

      expect(signedIn.authCard).toBe(true);
      expect(signedIn.signedIn).toBe(true);
      expect(signedIn.syncOff).toBe(true);
      expect(signedIn.noCloudPrimary).toBe(true);
      expect(signedIn.noDefaultSync).toBe(true);
      expect(signedIn.noBackgroundSync).toBe(true);
    } finally {
      stopIsolatedChrome(chrome);
    }
  }, 180_000);

  it('keeps package and lockfile drift out of the Gmail smoke test task', () => {
    for (const path of ['package.json', 'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml']) {
      const diff = execFileSync('git', ['diff', '--', path], {
        cwd: repoRoot(),
        encoding: 'utf8',
      }).trim();
      expect(diff, `${path} should not change`).toBe('');
    }
  });
});
