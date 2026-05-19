export type ThemeTextMode = 'light' | 'dark';

export type ThemeTextToken =
  | 'pageTitle'
  | 'pageEyebrow'
  | 'sectionTitle'
  | 'cardTitle'
  | 'primaryText'
  | 'secondaryText'
  | 'mutedText'
  | 'accentText'
  | 'warningText'
  | 'dangerText';

export type ThemeTextResult = {
  token: ThemeTextToken;
  mode: ThemeTextMode;
  className: string;
  sourceOfTruthChanged: false;
  persistenceChanged: false;
};

const darkTextClasses: Record<ThemeTextToken, string> = {
  pageTitle: 'text-white',
  pageEyebrow: 'text-emerald-200',
  sectionTitle: 'text-white',
  cardTitle: 'text-white',
  primaryText: 'text-white',
  secondaryText: 'text-white/72',
  mutedText: 'text-white/50',
  accentText: 'text-emerald-200',
  warningText: 'text-amber-100',
  dangerText: 'text-red-200',
};

const lightTextClasses: Record<ThemeTextToken, string> = {
  pageTitle: 'text-slate-950',
  pageEyebrow: 'text-emerald-700',
  sectionTitle: 'text-slate-950',
  cardTitle: 'text-slate-950',
  primaryText: 'text-slate-950',
  secondaryText: 'text-slate-700',
  mutedText: 'text-slate-500',
  accentText: 'text-emerald-700',
  warningText: 'text-amber-800',
  dangerText: 'text-red-700',
};

export function resolveThemeText(token: ThemeTextToken, mode: ThemeTextMode = 'dark'): ThemeTextResult {
  const classes = mode === 'dark' ? darkTextClasses : lightTextClasses;
  return {
    token,
    mode,
    className: classes[token],
    sourceOfTruthChanged: false,
    persistenceChanged: false,
  };
}
