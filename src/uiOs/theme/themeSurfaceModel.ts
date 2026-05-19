export type ThemeSurfaceMode = 'system' | 'light' | 'dark';

export type ThemeSurfaceType =
  | 'app_background'
  | 'page_surface'
  | 'glass_card'
  | 'dark_glass_card'
  | 'elevated_card'
  | 'training_hero'
  | 'health_card'
  | 'settings_group'
  | 'warning_surface'
  | 'danger_surface'
  | 'bottom_sheet'
  | 'modal_surface'
  | 'safety_strip'
  | 'compact_row';

export type ResolvedThemeSurfaceMode = 'light' | 'dark';

export type ThemeSurfaceResult = {
  surfaceType: ThemeSurfaceType;
  selectedMode: ThemeSurfaceMode;
  resolvedMode: ResolvedThemeSurfaceMode;
  className: string;
  textClassName: string;
  sourceOfTruthChanged: false;
  persistenceChanged: false;
};

export type ThemeSurfaceOptions = {
  systemPrefersDark?: boolean;
  immersiveDark?: boolean;
};

const darkSurfaceClasses: Record<ThemeSurfaceType, string> = {
  app_background: 'bg-[#0a0a0b]',
  page_surface: 'bg-[#111113]/90',
  glass_card: 'border border-white/10 bg-white/[0.07] shadow-[0_24px_80px_rgba(0,0,0,0.32)] backdrop-blur-xl',
  dark_glass_card: 'border border-white/10 bg-[#1c1c1e]/78 shadow-[0_22px_70px_rgba(0,0,0,0.3)] backdrop-blur-xl',
  elevated_card: 'border border-white/10 bg-[#1c1c1e]/88 shadow-[0_20px_70px_rgba(0,0,0,0.28)]',
  training_hero: 'border border-white/10 bg-gradient-to-br from-[#202124]/95 via-[#151618]/95 to-[#0d0d0f] shadow-[0_30px_90px_rgba(0,0,0,0.35)]',
  health_card: 'border border-white/10 bg-[#1c1c1e]/86 shadow-[0_18px_60px_rgba(0,0,0,0.25)]',
  settings_group: 'border border-white/10 bg-white/[0.07] shadow-[0_18px_60px_rgba(0,0,0,0.22)] backdrop-blur-xl',
  warning_surface: 'border border-amber-400/25 bg-amber-400/10',
  danger_surface: 'border border-red-400/25 bg-red-400/10',
  bottom_sheet: 'border border-white/10 bg-[#1c1c1e]/95 backdrop-blur-3xl',
  modal_surface: 'border border-white/10 bg-[#1c1c1e]/95 shadow-2xl',
  safety_strip: 'border border-white/8 bg-white/[0.045]',
  compact_row: 'border border-white/8 bg-white/[0.045]',
};

const lightSurfaceClasses: Record<ThemeSurfaceType, string> = {
  app_background: 'bg-slate-50',
  page_surface: 'bg-white',
  glass_card: 'border border-slate-200 bg-white/92 shadow-sm backdrop-blur-xl',
  dark_glass_card: 'border border-slate-200 bg-white/92 shadow-sm backdrop-blur-xl',
  elevated_card: 'border border-slate-200 bg-white shadow-sm',
  training_hero: 'border border-slate-200 bg-white shadow-sm',
  health_card: 'border border-slate-200 bg-white shadow-sm',
  settings_group: 'border border-slate-200 bg-white/90 shadow-sm backdrop-blur-xl',
  warning_surface: 'border border-amber-200 bg-amber-50',
  danger_surface: 'border border-red-200 bg-red-50',
  bottom_sheet: 'border border-slate-200 bg-white shadow-2xl',
  modal_surface: 'border border-slate-200 bg-white shadow-2xl',
  safety_strip: 'border border-slate-200 bg-slate-100/80',
  compact_row: 'border border-slate-200 bg-slate-50',
};

const textClasses: Record<ResolvedThemeSurfaceMode, string> = {
  dark: 'text-white',
  light: 'text-slate-950',
};

export function resolveThemeSurface(type: ThemeSurfaceType, selectedMode: ThemeSurfaceMode = 'dark', options: ThemeSurfaceOptions = {}): ThemeSurfaceResult {
  const resolvedMode: ResolvedThemeSurfaceMode =
    options.immersiveDark || selectedMode === 'dark' || (selectedMode === 'system' && options.systemPrefersDark !== false) ? 'dark' : 'light';
  const classes = resolvedMode === 'dark' ? darkSurfaceClasses : lightSurfaceClasses;

  return {
    surfaceType: type,
    selectedMode,
    resolvedMode,
    className: classes[type],
    textClassName: textClasses[resolvedMode],
    sourceOfTruthChanged: false,
    persistenceChanged: false,
  };
}
