export type ProductionApiConfigInput = {
  enabled?: boolean;
  baseUrl?: string;
};

export type ProductionApiConfigErrorCode =
  | 'production_api_disabled'
  | 'production_api_base_url_required'
  | 'production_api_base_url_invalid'
  | 'production_api_base_url_not_production';

export type ProductionApiConfigError = {
  code: ProductionApiConfigErrorCode;
  message: string;
};

export type ProductionApiConfig =
  | {
    ok: true;
    enabled: true;
    baseUrl: string;
  }
  | {
    ok: false;
    enabled: false;
    errors: ProductionApiConfigError[];
  };

const isLocalHost = (hostname: string) =>
  hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname.endsWith('.localhost');

const error = (code: ProductionApiConfigErrorCode, message: string): ProductionApiConfigError => ({ code, message });

export const resolveProductionApiConfig = (input: ProductionApiConfigInput = {}): ProductionApiConfig => {
  if (input.enabled !== true) {
    return {
      ok: false,
      enabled: false,
      errors: [error('production_api_disabled', 'Production API client is disabled by default.')],
    };
  }

  if (input.baseUrl === undefined || input.baseUrl.trim().length === 0) {
    return {
      ok: false,
      enabled: false,
      errors: [error('production_api_base_url_required', 'Production API base URL is required when enabled.')],
    };
  }

  try {
    const url = new URL(input.baseUrl);
    if (url.protocol !== 'https:' || isLocalHost(url.hostname)) {
      return {
        ok: false,
        enabled: false,
        errors: [error('production_api_base_url_not_production', 'Production API base URL must be HTTPS and non-local.')],
      };
    }

    return {
      ok: true,
      enabled: true,
      baseUrl: url.toString().replace(/\/$/, ''),
    };
  } catch {
    return {
      ok: false,
      enabled: false,
      errors: [error('production_api_base_url_invalid', 'Production API base URL must be valid.')],
    };
  }
};
