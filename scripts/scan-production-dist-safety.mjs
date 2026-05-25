import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const textExtensions = new Set([
  '.css',
  '.html',
  '.js',
  '.json',
  '.map',
  '.mjs',
  '.svg',
  '.txt',
  '.webmanifest',
  '.xml',
]);

const forbiddenVisibleCopy = [
  '引擎',
  '算法',
  '自动化',
  '模型',
  'AI 教练',
  '系统判断',
  '智能推荐',
  '决策系统',
  'service role',
  'API key',
  'cloud-primary',
  'default sync',
  'background sync',
];

const secretLikePatterns = [
  {
    id: 'jwt-like-value',
    pattern: /\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\b/g,
  },
  {
    id: 'private-or-secret-key',
    pattern: /\b(?:sk|pk|sb_secret)_[A-Za-z0-9_-]{16,}\b/g,
  },
  {
    id: 'google-api-key-like-value',
    pattern: /\bAIza[0-9A-Za-z_-]{20,}\b/g,
  },
  {
    id: 'service-role-env-name',
    pattern: /\b(?:VITE_SUPABASE_SERVICE_ROLE|SUPABASE_SERVICE_ROLE_KEY|SUPABASE_SERVICE_ROLE)\b/g,
  },
  {
    id: 'service-role-assignment',
    pattern: /\bservice_role\s*=/gi,
  },
  {
    id: 'literal-access-token-value',
    pattern: /\baccess_token\b\s*[:=]\s*["'`][A-Za-z0-9._~+/-]{20,}["'`]/g,
  },
  {
    id: 'literal-refresh-token-value',
    pattern: /\brefresh_token\b\s*[:=]\s*["'`][A-Za-z0-9._~+/-]{20,}["'`]/g,
  },
  {
    id: 'destructive-localstorage-delete',
    pattern: /\blocalStorage\.clear\s*\(/g,
  },
];

const collectFiles = (path) => {
  if (!existsSync(path)) return [];
  const info = statSync(path);
  if (!info.isDirectory()) return [path];
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) => collectFiles(join(path, entry.name)));
};

const isTextFile = (path) => {
  const extension = path.slice(path.lastIndexOf('.')).toLowerCase();
  return textExtensions.has(extension);
};

const makeSnippet = (source, index, length) => {
  const start = Math.max(0, index - 80);
  const end = Math.min(source.length, index + Math.max(length, 1) + 80);
  return source.slice(start, end).replace(/\s+/g, ' ').trim();
};

const isAllowedVisibleCopyMatch = (term, snippet) =>
  term === 'API key' && snippet.includes('API key is required to connect to Realtime');

export const scanProductionDistSafety = ({ root = process.cwd(), distDir = 'dist' } = {}) => {
  const absoluteDist = resolve(root, distDir);
  if (!existsSync(absoluteDist)) {
    return { skipped: true, distDir: absoluteDist, filesScanned: 0, findings: [] };
  }

  const findings = [];
  const files = collectFiles(absoluteDist).filter((file) => statSync(file).isFile() && isTextFile(file));

  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    const relativeFile = relative(root, file);
    const lowerSource = source.toLowerCase();

    for (const term of forbiddenVisibleCopy) {
      const caseInsensitive = /[A-Za-z]/.test(term);
      const haystack = caseInsensitive ? lowerSource : source;
      const needle = caseInsensitive ? term.toLowerCase() : term;
      let index = haystack.indexOf(needle);
      while (index >= 0) {
        const snippet = makeSnippet(source, index, term.length);
        if (!isAllowedVisibleCopyMatch(term, snippet)) {
          findings.push({
            file: relativeFile,
            id: 'forbidden-visible-copy',
            match: term,
            snippet,
          });
        }
        index = haystack.indexOf(needle, index + needle.length);
      }
    }

    for (const { id, pattern } of secretLikePatterns) {
      pattern.lastIndex = 0;
      let match = pattern.exec(source);
      while (match) {
        findings.push({
          file: relativeFile,
          id,
          match: match[0],
          snippet: makeSnippet(source, match.index, match[0].length),
        });
        match = pattern.exec(source);
      }
    }
  }

  return { skipped: false, distDir: absoluteDist, filesScanned: files.length, findings };
};

const isDirectRun = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  const result = scanProductionDistSafety();
  if (result.skipped) {
    console.log(`Production dist safety scan skipped: ${result.distDir} does not exist.`);
    process.exit(0);
  }
  if (!result.findings.length) {
    console.log(`Production dist safety scan passed. Files scanned: ${result.filesScanned}.`);
    process.exit(0);
  }

  console.error(`Production dist safety scan failed. Findings: ${result.findings.length}.`);
  for (const finding of result.findings.slice(0, 50)) {
    console.error(`${finding.file} [${finding.id}] ${finding.match}: ${finding.snippet}`);
  }
  if (result.findings.length > 50) {
    console.error(`... ${result.findings.length - 50} more findings omitted.`);
  }
  process.exit(1);
}
