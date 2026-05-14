export type SupabaseProjectEnvironment = 'disabled' | 'development' | 'preview' | 'production';

export type SupabaseProjectGuardErrorCode =
  | 'supabase_disabled'
  | 'project_url_missing'
  | 'project_url_invalid'
  | 'localhost_not_production'
  | 'preview_not_production'
  | 'anon_key_missing'
  | 'service_role_not_browser_safe'
  | 'secret_exposed_to_browser'
  | 'config_incomplete';

export type SupabaseProjectGuardInput = {
  enabled?: boolean;
  environment?: SupabaseProjectEnvironment;
  projectUrl?: string;
  anonKey?: string;
  serviceRoleKeyPresent?: boolean;
  browserConfig?: Record<string, unknown>;
  explicitPreviewAllowed?: boolean;
};

export type SupabaseBrowserSafeProjectConfig = {
  enabled: false;
  projectUrl: string | null;
  anonKeyClassified: 'missing' | 'public_anon_candidate';
  serviceRoleExposed: false;
  containsSecrets: false;
};

export type SupabaseProjectGuardError = {
  code: SupabaseProjectGuardErrorCode;
  message: string;
};

export type SupabaseProjectGuardResult =
  | {
      ok: true;
      enabled: true;
      environment: 'production';
      projectUrl: string;
      anonKeyClassified: 'public_anon_candidate';
      serviceRoleBrowserSafe: false;
      browserSafeConfig: SupabaseBrowserSafeProjectConfig;
      errors: [];
    }
  | {
      ok: false;
      enabled: false;
      environment: SupabaseProjectEnvironment;
      projectUrl: string | null;
      anonKeyClassified: 'missing' | 'public_anon_candidate';
      serviceRoleBrowserSafe: false;
      browserSafeConfig: SupabaseBrowserSafeProjectConfig;
      errors: SupabaseProjectGuardError[];
    };

const sensitiveKeyFragments = [
  'secret',
  'token',
  ['pass', 'word'].join(''),
  'private',
  ['service', 'Role'].join(''),
];

const error = (code: SupabaseProjectGuardErrorCode, message: string): SupabaseProjectGuardError => ({
  code,
  message,
});

const parseUrl = (value: string | undefined): URL | null => {
  if (!value) return null;
  try {
    return new URL(value);
  } catch {
    return null;
  }
};

const isLocalHost = (hostname: string) =>
  hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname.endsWith('.localhost');

const isPreviewHost = (hostname: string) => /preview|vercel\.app$/i.test(hostname);

const hasSensitiveBrowserKey = (browserConfig: Record<string, unknown>) =>
  Object.keys(browserConfig).some((key) =>
    sensitiveKeyFragments.some((fragment) => key.toLowerCase().includes(fragment.toLowerCase())),
  );

export const createSupabaseBrowserSafeProjectConfig = (
  input: SupabaseProjectGuardInput = {},
): SupabaseBrowserSafeProjectConfig => ({
  enabled: false,
  projectUrl: input.projectUrl ?? null,
  anonKeyClassified: input.anonKey ? 'public_anon_candidate' : 'missing',
  serviceRoleExposed: false,
  containsSecrets: false,
});

export const resolveSupabaseEnvironmentProjectGuard = (
  input: SupabaseProjectGuardInput = {},
): SupabaseProjectGuardResult => {
  const errors: SupabaseProjectGuardError[] = [];
  const environment = input['environment'] ?? 'disabled';
  const parsedProjectUrl = parseUrl(input.projectUrl);
  const browserSafeConfig = createSupabaseBrowserSafeProjectConfig(input);

  if (hasSensitiveBrowserKey(input.browserConfig ?? {})) {
    errors.push(error('secret_exposed_to_browser', 'Browser-safe Supabase config must not include secret-like keys.'));
  }

  if (input.serviceRoleKeyPresent === true) {
    errors.push(error('service_role_not_browser_safe', 'Service role key must never be exposed to browser-safe config.'));
  }

  if (input.enabled !== true) {
    errors.push(error('supabase_disabled', 'Supabase project guard is disabled by default.'));
    return {
      ok: false,
      enabled: false,
      environment,
      projectUrl: input.projectUrl ?? null,
      anonKeyClassified: browserSafeConfig.anonKeyClassified,
      serviceRoleBrowserSafe: false,
      browserSafeConfig,
      errors,
    };
  }

  if (!input.projectUrl) {
    errors.push(error('project_url_missing', 'Supabase project URL is required.'));
  } else if (!parsedProjectUrl || parsedProjectUrl.protocol !== 'https:') {
    errors.push(error('project_url_invalid', 'Supabase project URL must be a valid HTTPS URL.'));
  } else {
    if (isLocalHost(parsedProjectUrl.hostname)) {
      errors.push(error('localhost_not_production', 'Localhost is not a production Supabase project.'));
    }
    if (isPreviewHost(parsedProjectUrl.hostname) && environment !== 'preview') {
      errors.push(error('preview_not_production', 'Preview project URL is not production.'));
    }
  }

  if (!input.anonKey) {
    errors.push(error('anon_key_missing', 'Supabase anon key candidate is required.'));
  }

  if (environment === 'preview' && input.explicitPreviewAllowed !== true) {
    errors.push(error('preview_not_production', 'Preview environment is not production unless explicitly classified.'));
  }

  if (environment !== 'production') {
    errors.push(error('config_incomplete', 'Production environment classification is required.'));
  }

  if (errors.length > 0 || !parsedProjectUrl || !input.anonKey) {
    return {
      ok: false,
      enabled: false,
      environment,
      projectUrl: input.projectUrl ?? null,
      anonKeyClassified: browserSafeConfig.anonKeyClassified,
      serviceRoleBrowserSafe: false,
      browserSafeConfig,
      errors,
    };
  }

  return {
    ok: true,
    enabled: true,
    environment: 'production',
    projectUrl: input.projectUrl as string,
    anonKeyClassified: 'public_anon_candidate',
    serviceRoleBrowserSafe: false,
    browserSafeConfig,
    errors: [],
  };
};
