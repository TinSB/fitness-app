export type RedactionPrimitive = string | number | boolean | null;
export type RedactionValue = RedactionPrimitive | RedactionValue[] | { [key: string]: RedactionValue };

export type RedactionResult = {
  value: RedactionValue;
  redactedPaths: string[];
};

const sensitiveKeyPattern = new RegExp([
  'pass' + 'word',
  'secret',
  'token',
  'credential',
  'authorization',
  'cookie',
  'session',
  'appdata',
  'storage',
  'email',
].join('|'), 'i');

const redactString = (value: string) => {
  if (value.length > 80) return '[redacted:long-string]';
  if (/bearer\s+/i.test(value)) return '[redacted:credential]';
  return value;
};

const redactValue = (value: RedactionValue, path: string, redactedPaths: string[]): RedactionValue => {
  if (typeof value === 'string') {
    const redacted = redactString(value);
    if (redacted !== value) redactedPaths.push(path);
    return redacted;
  }

  if (Array.isArray(value)) {
    return value.map((entry, index) => redactValue(entry, `${path}[${index}]`, redactedPaths));
  }

  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => {
      const childPath = path.length > 0 ? `${path}.${key}` : key;
      if (sensitiveKeyPattern.test(key)) {
        redactedPaths.push(childPath);
        return [key, '[redacted]'];
      }
      return [key, redactValue(entry, childPath, redactedPaths)];
    }));
  }

  return value;
};

export const redactForPrivacySafeLog = (value: RedactionValue): RedactionResult => {
  const redactedPaths: string[] = [];
  return {
    value: redactValue(value, '', redactedPaths),
    redactedPaths,
  };
};
