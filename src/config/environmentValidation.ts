export type IronPathEnvironmentName = 'local' | 'development' | 'staging' | 'production';

export type RuntimeSourceMode = 'localStorage' | 'apiReadonly' | 'apiPrimaryDev';

export type EnvironmentValidationInput = {
  environmentName: IronPathEnvironmentName;
  runtimeSource: RuntimeSourceMode;
  productionRuntimeEnabled?: boolean;
  secretReferenceNames?: readonly string[];
  containsSecretValues?: boolean;
};

export type EnvironmentValidationResult = {
  ok: boolean;
  environmentName: IronPathEnvironmentName;
  productionRuntimeEnabled: boolean;
  secretValuesAccepted: false;
  errors: string[];
  warnings: string[];
};

export const validateEnvironmentConfig = ({
  environmentName,
  runtimeSource,
  productionRuntimeEnabled = false,
  secretReferenceNames = [],
  containsSecretValues = false,
}: EnvironmentValidationInput): EnvironmentValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (containsSecretValues) {
    errors.push('secret values must not be supplied to browser validation');
  }

  if (productionRuntimeEnabled) {
    errors.push('production runtime is not enabled by this skeleton');
  }

  if (environmentName === 'production') {
    warnings.push('production environment requires a future architecture gate');
  }

  if (runtimeSource === 'apiPrimaryDev' && environmentName === 'production') {
    errors.push('API primary dev mode is not a production runtime source');
  }

  if (secretReferenceNames.some((name) => name.trim().length === 0)) {
    errors.push('secret reference names must be non-empty placeholders');
  }

  return {
    ok: errors.length === 0,
    environmentName,
    productionRuntimeEnabled,
    secretValuesAccepted: false,
    errors,
    warnings,
  };
};
