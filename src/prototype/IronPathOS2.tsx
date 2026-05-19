import { useState, type ReactNode } from 'react';
import {
  Calendar,
  ChevronRight,
  Dumbbell,
  History,
  Home,
  Settings,
  TrendingUp,
  AlertCircle,
  Check,
  Clock,
  Activity,
  Zap,
  Shield,
  Database,
  Cloud,
  CloudOff,
  RefreshCw,
  Info,
  Minus,
  Plus,
  ChevronDown,
  X,
} from 'lucide-react';

// ============================================================
// DESIGN TOKENS - Dark Sports UI
// ============================================================

const tokens = {
  colors: {
    // Background layers
    bg: {
      primary: 'bg-zinc-950',
      secondary: 'bg-zinc-900',
      tertiary: 'bg-zinc-800',
      card: 'bg-zinc-900/80',
      cardHover: 'hover:bg-zinc-800/80',
    },
    // Text
    text: {
      primary: 'text-zinc-50',
      secondary: 'text-zinc-400',
      muted: 'text-zinc-500',
      inverse: 'text-zinc-950',
    },
    // Semantic colors
    semantic: {
      safe: 'bg-emerald-500',
      safeText: 'text-emerald-400',
      safeBg: 'bg-emerald-500/10',
      safeBorder: 'border-emerald-500/30',
      caution: 'bg-amber-500',
      cautionText: 'text-amber-400',
      cautionBg: 'bg-amber-500/10',
      cautionBorder: 'border-amber-500/30',
      danger: 'bg-rose-500',
      dangerText: 'text-rose-400',
      dangerBg: 'bg-rose-500/10',
      dangerBorder: 'border-rose-500/30',
      info: 'bg-sky-500',
      infoText: 'text-sky-400',
      infoBg: 'bg-sky-500/10',
      infoBorder: 'border-sky-500/30',
      disabled: 'bg-zinc-700',
      disabledText: 'text-zinc-500',
    },
    // Accent
    accent: {
      primary: 'bg-emerald-500',
      primaryHover: 'hover:bg-emerald-600',
      primaryText: 'text-emerald-500',
    },
    // Borders
    border: {
      default: 'border-zinc-800',
      subtle: 'border-zinc-800/50',
    },
  },
  spacing: {
    safeTop: 'pt-[env(safe-area-inset-top)]',
    safeBottom: 'pb-[env(safe-area-inset-bottom)]',
  },
  radius: {
    sm: 'rounded-lg',
    md: 'rounded-xl',
    lg: 'rounded-2xl',
    full: 'rounded-full',
  },
};

// ============================================================
// TYPES
// ============================================================

type TabId = 'today' | 'train' | 'history' | 'progress' | 'settings';

// ============================================================
// REUSABLE COMPONENTS
// ============================================================

// Primary Card
const PrimaryCard = ({
  children,
  className = '',
  onClick,
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}) => (
  <div
    onClick={onClick}
    className={`${tokens.colors.bg.card} ${tokens.radius.md} border ${tokens.colors.border.default} p-4 backdrop-blur-sm ${onClick ? 'cursor-pointer transition-colors ' + tokens.colors.bg.cardHover : ''} ${className}`}
  >
    {children}
  </div>
);

// Metric Card
const MetricCard = ({
  label,
  value,
  helper,
  tone = 'default',
}: {
  label: string;
  value: string | number;
  helper?: string;
  tone?: 'default' | 'safe' | 'caution' | 'danger';
}) => {
  const toneClasses = {
    default: tokens.colors.bg.card,
    safe: `${tokens.colors.semantic.safeBg} border ${tokens.colors.semantic.safeBorder}`,
    caution: `${tokens.colors.semantic.cautionBg} border ${tokens.colors.semantic.cautionBorder}`,
    danger: `${tokens.colors.semantic.dangerBg} border ${tokens.colors.semantic.dangerBorder}`,
  };

  return (
    <div className={`${toneClasses[tone]} ${tokens.radius.md} border ${tokens.colors.border.default} p-3`}>
      <div className={`text-xs font-medium ${tokens.colors.text.muted}`}>{label}</div>
      <div className={`mt-1 text-2xl font-bold tracking-tight ${tokens.colors.text.primary}`}>{value}</div>
      {helper && <div className={`mt-1 text-xs ${tokens.colors.text.secondary}`}>{helper}</div>}
    </div>
  );
};

// Status Badge
const StatusBadge = ({
  children,
  tone = 'default',
}: {
  children: ReactNode;
  tone?: 'safe' | 'caution' | 'danger' | 'info' | 'default';
}) => {
  const toneClasses = {
    safe: `${tokens.colors.semantic.safeBg} ${tokens.colors.semantic.safeText} border ${tokens.colors.semantic.safeBorder}`,
    caution: `${tokens.colors.semantic.cautionBg} ${tokens.colors.semantic.cautionText} border ${tokens.colors.semantic.cautionBorder}`,
    danger: `${tokens.colors.semantic.dangerBg} ${tokens.colors.semantic.dangerText} border ${tokens.colors.semantic.dangerBorder}`,
    info: `${tokens.colors.semantic.infoBg} ${tokens.colors.semantic.infoText} border ${tokens.colors.semantic.infoBorder}`,
    default: `bg-zinc-800 ${tokens.colors.text.secondary} border border-zinc-700`,
  };

  return (
    <span className={`inline-flex items-center gap-1.5 ${tokens.radius.full} border px-2.5 py-1 text-xs font-medium ${toneClasses[tone]}`}>
      {children}
    </span>
  );
};

// Action Button
const ActionButton = ({
  children,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  disabled = false,
  onClick,
}: {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}) => {
  const variants = {
    primary: `${tokens.colors.accent.primary} ${tokens.colors.accent.primaryHover} ${tokens.colors.text.inverse} font-semibold`,
    secondary: `bg-zinc-800 hover:bg-zinc-700 ${tokens.colors.text.primary} font-medium`,
    danger: `${tokens.colors.semantic.dangerBg} ${tokens.colors.semantic.dangerText} hover:bg-rose-500/20 font-medium border ${tokens.colors.semantic.dangerBorder}`,
    ghost: `bg-transparent hover:bg-zinc-800 ${tokens.colors.text.secondary} font-medium`,
  };

  const sizes = {
    sm: 'px-3 py-2 text-sm min-h-[36px]',
    md: 'px-4 py-3 text-base min-h-[48px]',
    lg: 'px-5 py-4 text-lg min-h-[56px]',
  };

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`${tokens.radius.md} inline-flex items-center justify-center gap-2 transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${sizes[size]} ${fullWidth ? 'w-full' : ''}`}
    >
      {children}
    </button>
  );
};

// Chip / Tag for selection
const SelectionChip = ({
  children,
  selected = false,
  onClick,
}: {
  children: ReactNode;
  selected?: boolean;
  onClick?: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={`${tokens.radius.full} border px-4 py-2 text-sm font-medium transition-all ${
      selected
        ? `${tokens.colors.accent.primary} border-emerald-500 ${tokens.colors.text.inverse}`
        : `bg-zinc-900 ${tokens.colors.border.default} ${tokens.colors.text.secondary} hover:bg-zinc-800 hover:text-zinc-300`
    }`}
  >
    {children}
  </button>
);

// Data Source Badge
const DataSourceBadge = ({ isLocal = true }: { isLocal?: boolean }) => (
  <div className={`${tokens.radius.sm} inline-flex items-center gap-2 border ${tokens.colors.semantic.safeBorder} ${tokens.colors.semantic.safeBg} px-3 py-1.5 text-xs font-medium ${tokens.colors.semantic.safeText}`}>
    {isLocal ? <Database className="h-3.5 w-3.5" /> : <Cloud className="h-3.5 w-3.5" />}
    {isLocal ? '当前使用本地数据' : '云端候选'}
  </div>
);

// Inline Warning
const InlineWarning = ({ children, tone = 'caution' }: { children: ReactNode; tone?: 'caution' | 'danger' | 'info' }) => {
  const toneClasses = {
    caution: `${tokens.colors.semantic.cautionBg} ${tokens.colors.semantic.cautionText} border ${tokens.colors.semantic.cautionBorder}`,
    danger: `${tokens.colors.semantic.dangerBg} ${tokens.colors.semantic.dangerText} border ${tokens.colors.semantic.dangerBorder}`,
    info: `${tokens.colors.semantic.infoBg} ${tokens.colors.semantic.infoText} border ${tokens.colors.semantic.infoBorder}`,
  };

  const icons = {
    caution: <AlertCircle className="h-4 w-4 shrink-0" />,
    danger: <AlertCircle className="h-4 w-4 shrink-0" />,
    info: <Info className="h-4 w-4 shrink-0" />,
  };

  return (
    <div className={`${tokens.radius.sm} flex items-start gap-2 border p-3 text-sm ${toneClasses[tone]}`}>
      {icons[tone]}
      <span>{children}</span>
    </div>
  );
};

// Section Header
const SectionHeader = ({ title, action }: { title: string; action?: ReactNode }) => (
  <div className="mb-3 flex items-center justify-between">
    <h3 className={`text-sm font-semibold ${tokens.colors.text.secondary}`}>{title}</h3>
    {action}
  </div>
);

// ============================================================
// BOTTOM NAVIGATION
// ============================================================

const BottomNav = ({
  activeTab,
  onNavigate,
}: {
  activeTab: TabId;
  onNavigate: (id: TabId) => void;
}) => {
  const navItems: { id: TabId; label: string; icon: typeof Home }[] = [
    { id: 'today', label: '今日', icon: Home },
    { id: 'train', label: '训练', icon: Dumbbell },
    { id: 'history', label: '历史', icon: History },
    { id: 'progress', label: '进步', icon: TrendingUp },
    { id: 'settings', label: '设置', icon: Settings },
  ];

  return (
    <nav className={`fixed inset-x-0 bottom-0 z-50 border-t ${tokens.colors.border.default} ${tokens.colors.bg.secondary} ${tokens.spacing.safeBottom} backdrop-blur-xl`}>
      <div className="grid h-16 grid-cols-5">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.id)}
              className={`flex flex-col items-center justify-center gap-1 transition-colors ${
                isActive ? tokens.colors.accent.primaryText : tokens.colors.text.muted
              }`}
            >
              <Icon className={`h-5 w-5 ${isActive ? 'stroke-[2.5]' : 'stroke-[1.5]'}`} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

// ============================================================
// MOBILE APP SHELL
// ============================================================

const MobileAppShell = ({
  children,
  activeTab,
  onNavigate,
}: {
  children: ReactNode;
  activeTab: TabId;
  onNavigate: (id: TabId) => void;
}) => (
  <div className={`min-h-dvh ${tokens.colors.bg.primary} ${tokens.colors.text.primary} font-sans antialiased`}>
    {/* Top Status Area */}
    <div className={`sticky top-0 z-40 ${tokens.colors.bg.primary}/95 backdrop-blur-xl ${tokens.spacing.safeTop}`}>
      <div className="flex h-12 items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <div className={`grid h-7 w-7 place-items-center ${tokens.radius.sm} ${tokens.colors.accent.primary}`}>
            <Dumbbell className={`h-4 w-4 ${tokens.colors.text.inverse}`} />
          </div>
          <span className="text-base font-bold tracking-tight">IronPath</span>
        </div>
        <DataSourceBadge />
      </div>
    </div>

    {/* Page Content */}
    <main className="px-4 pb-24">{children}</main>

    {/* Bottom Navigation */}
    <BottomNav activeTab={activeTab} onNavigate={onNavigate} />
  </div>
);

// ============================================================
// PAGE 1: TODAY / 今日
// ============================================================

const TodayPage = () => {
  const [selectedFocus, setSelectedFocus] = useState<string>('system');

  const focusOptions = [
    { id: 'system', label: '系统推荐' },
    { id: 'chest', label: '胸' },
    { id: 'back', label: '背' },
    { id: 'legs', label: '腿' },
    { id: 'shoulders', label: '肩' },
    { id: 'arms', label: '手臂' },
    { id: 'core', label: '核心' },
    { id: 'recovery', label: '恢复' },
  ];

  return (
    <div className="space-y-4 py-4">
      {/* Today Recommendation Card */}
      <PrimaryCard>
        <div className="mb-3 flex items-start justify-between">
          <div>
            <div className={`text-xs font-medium ${tokens.colors.text.muted}`}>今日训练建议</div>
            <h2 className={`mt-1 text-xl font-bold ${tokens.colors.text.primary}`}>上肢力量 / 卧推重点</h2>
          </div>
          <StatusBadge tone="safe">
            <Check className="h-3 w-3" /> 状态正常
          </StatusBadge>
        </div>
        <p className={`text-sm leading-relaxed ${tokens.colors.text.secondary}`}>
          最近卧推表现稳定，今天建议保持重量，专注动作质量。
        </p>
      </PrimaryCard>

      {/* Today Focus Override */}
      <div>
        <SectionHeader title="今天想练" />
        <div className="flex flex-wrap gap-2">
          {focusOptions.map((option) => (
            <SelectionChip
              key={option.id}
              selected={selectedFocus === option.id}
              onClick={() => setSelectedFocus(option.id)}
            >
              {option.label}
            </SelectionChip>
          ))}
        </div>
      </div>

      {/* Recovery Status */}
      <PrimaryCard>
        <SectionHeader title="恢复状态" />
        <div className="grid grid-cols-3 gap-3">
          <div className={`${tokens.radius.sm} ${tokens.colors.semantic.safeBg} border ${tokens.colors.semantic.safeBorder} p-3 text-center`}>
            <Activity className={`mx-auto h-5 w-5 ${tokens.colors.semantic.safeText}`} />
            <div className={`mt-1 text-xs font-medium ${tokens.colors.semantic.safeText}`}>状态正常</div>
          </div>
          <div className={`${tokens.radius.sm} bg-zinc-800 border ${tokens.colors.border.default} p-3 text-center`}>
            <Clock className={`mx-auto h-5 w-5 ${tokens.colors.text.secondary}`} />
            <div className={`mt-1 text-xs font-medium ${tokens.colors.text.secondary}`}>休息充足</div>
          </div>
          <div className={`${tokens.radius.sm} bg-zinc-800 border ${tokens.colors.border.default} p-3 text-center`}>
            <Zap className={`mx-auto h-5 w-5 ${tokens.colors.text.secondary}`} />
            <div className={`mt-1 text-xs font-medium ${tokens.colors.text.secondary}`}>精力良好</div>
          </div>
        </div>
      </PrimaryCard>

      {/* Last Related Workout */}
      <PrimaryCard>
        <SectionHeader title="上次相关训练" action={<ChevronRight className={`h-4 w-4 ${tokens.colors.text.muted}`} />} />
        <div className="flex items-center justify-between">
          <div>
            <div className={`font-semibold ${tokens.colors.text.primary}`}>平板卧推</div>
            <div className={`text-sm ${tokens.colors.text.secondary}`}>135 lb × 5，RIR 2</div>
          </div>
          <div className={`text-right text-xs ${tokens.colors.text.muted}`}>2天前</div>
        </div>
      </PrimaryCard>

      {/* Primary Action */}
      <ActionButton variant="primary" size="lg" fullWidth>
        <Dumbbell className="h-5 w-5" />
        开始今天训练
      </ActionButton>

      {/* Safety Strip */}
      <div className={`${tokens.radius.md} border ${tokens.colors.border.default} ${tokens.colors.bg.card} divide-y divide-zinc-800`}>
        <div className="flex items-center justify-between p-3">
          <span className={`text-sm ${tokens.colors.text.secondary}`}>本地数据正常</span>
          <StatusBadge tone="safe"><Check className="h-3 w-3" /></StatusBadge>
        </div>
        <div className="flex items-center justify-between p-3">
          <span className={`text-sm ${tokens.colors.text.secondary}`}>备份建议</span>
          <StatusBadge tone="safe">正常</StatusBadge>
        </div>
        <div className="flex items-center justify-between p-3">
          <span className={`text-sm ${tokens.colors.text.secondary}`}>云端候选</span>
          <StatusBadge tone="default"><CloudOff className="h-3 w-3" /> 未自动同步</StatusBadge>
        </div>
      </div>
    </div>
  );
};

// ============================================================
// PAGE 2: TRAIN / 训练 (Focus Mode)
// ============================================================

const TrainPage = () => {
  const [weight, setWeight] = useState('135');
  const [reps, setReps] = useState('5');
  const [rir, setRir] = useState('2');
  const [currentSet, setCurrentSet] = useState(1);
  const [showDetails, setShowDetails] = useState(false);

  return (
    <div className="space-y-4 py-4">
      {/* Active Session Notice */}
      <div className={`${tokens.radius.md} border ${tokens.colors.semantic.safeBorder} ${tokens.colors.semantic.safeBg} p-3`}>
        <div className="flex items-center gap-2">
          <div className={`h-2 w-2 ${tokens.radius.full} bg-emerald-500 animate-pulse`} />
          <span className={`text-sm font-medium ${tokens.colors.semantic.safeText}`}>训练进行中</span>
          <span className={`text-xs ${tokens.colors.text.muted}`}>· 已训练 12 分钟</span>
        </div>
      </div>

      {/* Current Exercise Card */}
      <PrimaryCard>
        <div className="flex items-start justify-between">
          <div>
            <div className={`text-xs font-medium ${tokens.colors.text.muted}`}>当前动作</div>
            <h2 className={`mt-1 text-xl font-bold ${tokens.colors.text.primary}`}>平板卧推</h2>
          </div>
          <StatusBadge tone="info">
            热身组 {currentSet} / 3
          </StatusBadge>
        </div>
        <div className={`mt-2 flex items-center gap-2 text-sm ${tokens.colors.text.secondary}`}>
          <span>Olympic Barbell · 45 lb 杆重</span>
        </div>
      </PrimaryCard>

      {/* Equipment-Aware Recommendation */}
      <PrimaryCard className="border-emerald-500/30">
        <SectionHeader 
          title="推荐处方" 
          action={
            <button 
              type="button" 
              onClick={() => setShowDetails(!showDetails)}
              className={`text-xs ${tokens.colors.accent.primaryText}`}
            >
              {showDetails ? '收起' : '详情'}
            </button>
          }
        />
        
        {/* Primary Load Display */}
        <div className="mb-4 text-center">
          <div className={`text-4xl font-bold tracking-tight ${tokens.colors.text.primary}`}>
            空杆 45 lb × 10 次
          </div>
          <div className={`mt-1 text-sm ${tokens.colors.text.secondary}`}>
            热身组 · 专注动作模式
          </div>
        </div>

        {/* Equipment Details (Collapsible) */}
        {showDetails && (
          <div className={`${tokens.radius.sm} border ${tokens.colors.border.default} bg-zinc-800/50 p-3 space-y-2`}>
            <div className="flex items-center justify-between text-sm">
              <span className={tokens.colors.text.muted}>理论计算</span>
              <span className={tokens.colors.text.secondary}>17 lb</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className={tokens.colors.text.muted}>实际可做</span>
              <span className={tokens.colors.text.primary}>45 lb</span>
            </div>
            <div className={`text-xs ${tokens.colors.text.muted} pt-2 border-t ${tokens.colors.border.default}`}>
              理论重量低于空杆，使用空杆热身
            </div>
          </div>
        )}
      </PrimaryCard>

      {/* Actual Set Input */}
      <PrimaryCard>
        <SectionHeader title="实际完成" />
        
        {/* Weight Input */}
        <div className="mb-4">
          <label className={`mb-2 block text-xs font-medium ${tokens.colors.text.muted}`}>重量 (lb)</label>
          <div className="flex items-center gap-2">
            <button 
              type="button"
              onClick={() => setWeight(String(Math.max(0, Number(weight) - 5)))}
              className={`${tokens.radius.sm} grid h-12 w-12 place-items-center bg-zinc-800 text-zinc-400 hover:bg-zinc-700`}
            >
              <Minus className="h-5 w-5" />
            </button>
            <input
              type="number"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              className={`${tokens.radius.sm} h-12 flex-1 border ${tokens.colors.border.default} bg-zinc-800 px-4 text-center text-xl font-bold ${tokens.colors.text.primary} focus:border-emerald-500 focus:outline-none`}
            />
            <button 
              type="button"
              onClick={() => setWeight(String(Number(weight) + 5))}
              className={`${tokens.radius.sm} grid h-12 w-12 place-items-center bg-zinc-800 text-zinc-400 hover:bg-zinc-700`}
            >
              <Plus className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Reps and RIR */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={`mb-2 block text-xs font-medium ${tokens.colors.text.muted}`}>次数</label>
            <div className="flex items-center gap-2">
              <button 
                type="button"
                onClick={() => setReps(String(Math.max(0, Number(reps) - 1)))}
                className={`${tokens.radius.sm} grid h-10 w-10 place-items-center bg-zinc-800 text-zinc-400`}
              >
                <Minus className="h-4 w-4" />
              </button>
              <input
                type="number"
                value={reps}
                onChange={(e) => setReps(e.target.value)}
                className={`${tokens.radius.sm} h-10 flex-1 border ${tokens.colors.border.default} bg-zinc-800 px-3 text-center text-lg font-bold ${tokens.colors.text.primary} focus:border-emerald-500 focus:outline-none`}
              />
              <button 
                type="button"
                onClick={() => setReps(String(Number(reps) + 1))}
                className={`${tokens.radius.sm} grid h-10 w-10 place-items-center bg-zinc-800 text-zinc-400`}
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div>
            <label className={`mb-2 block text-xs font-medium ${tokens.colors.text.muted}`}>RIR</label>
            <div className="flex items-center gap-2">
              <button 
                type="button"
                onClick={() => setRir(String(Math.max(0, Number(rir) - 1)))}
                className={`${tokens.radius.sm} grid h-10 w-10 place-items-center bg-zinc-800 text-zinc-400`}
              >
                <Minus className="h-4 w-4" />
              </button>
              <input
                type="number"
                value={rir}
                onChange={(e) => setRir(e.target.value)}
                className={`${tokens.radius.sm} h-10 flex-1 border ${tokens.colors.border.default} bg-zinc-800 px-3 text-center text-lg font-bold ${tokens.colors.text.primary} focus:border-emerald-500 focus:outline-none`}
              />
              <button 
                type="button"
                onClick={() => setRir(String(Number(rir) + 1))}
                className={`${tokens.radius.sm} grid h-10 w-10 place-items-center bg-zinc-800 text-zinc-400`}
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </PrimaryCard>

      {/* Primary Actions */}
      <div className="grid grid-cols-2 gap-3">
        <ActionButton variant="secondary" size="md" fullWidth>
          套用建议
        </ActionButton>
        <ActionButton variant="primary" size="md" fullWidth onClick={() => setCurrentSet(currentSet + 1)}>
          <Check className="h-5 w-5" />
          完成一组
        </ActionButton>
      </div>

      {/* Secondary Actions */}
      <div className="flex gap-2">
        <ActionButton variant="ghost" size="sm">
          <RefreshCw className="h-4 w-4" />
          替代动作
        </ActionButton>
        <ActionButton variant="ghost" size="sm">
          <AlertCircle className="h-4 w-4" />
          标记不适
        </ActionButton>
        <ActionButton variant="danger" size="sm">
          <X className="h-4 w-4" />
          放弃本组
        </ActionButton>
      </div>

      {/* Safety Indicator */}
      <InlineWarning tone="info">
        当前使用本地数据 · 云端不会自动同步
      </InlineWarning>
    </div>
  );
};

// ============================================================
// PAGE 3: HISTORY / 历史
// ============================================================

const HistoryPage = () => {
  const mockWorkouts = [
    {
      id: '1',
      date: '今天',
      focus: '上肢力量',
      mainLifts: ['卧推 135 lb × 5', '肩推 95 lb × 8'],
      volume: '18 组',
      status: 'completed' as const,
    },
    {
      id: '2',
      date: '昨天',
      focus: '下肢力量',
      mainLifts: ['深蹲 185 lb × 5', '硬拉 225 lb × 3'],
      volume: '15 组',
      status: 'completed' as const,
    },
    {
      id: '3',
      date: '3天前',
      focus: '上肢拉',
      mainLifts: ['引体向上 BW × 8', '杠铃划船 135 lb × 8'],
      volume: '16 组',
      status: 'flagged' as const,
    },
  ];

  const exerciseHistory = [
    { name: '卧推', lastWeight: '135 lb', lastReps: 5, trend: 'up' },
    { name: '深蹲', lastWeight: '185 lb', lastReps: 5, trend: 'stable' },
    { name: '罗马尼亚硬拉', lastWeight: '155 lb', lastReps: 8, trend: 'up' },
  ];

  return (
    <div className="space-y-4 py-4">
      {/* Data Health Hint */}
      <div className={`${tokens.radius.sm} flex items-center gap-2 ${tokens.colors.semantic.safeBg} border ${tokens.colors.semantic.safeBorder} px-3 py-2`}>
        <Check className={`h-4 w-4 ${tokens.colors.semantic.safeText}`} />
        <span className={`text-sm ${tokens.colors.semantic.safeText}`}>没有发现明显异常</span>
      </div>

      {/* Recent Workouts */}
      <div>
        <SectionHeader title="最近训练" />
        <div className="space-y-3">
          {mockWorkouts.map((workout) => (
            <PrimaryCard key={workout.id} onClick={() => {}}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`font-semibold ${tokens.colors.text.primary}`}>{workout.focus}</span>
                    {workout.status === 'flagged' && (
                      <StatusBadge tone="caution">
                        <AlertCircle className="h-3 w-3" /> 建议检查
                      </StatusBadge>
                    )}
                  </div>
                  <div className={`mt-1 text-sm ${tokens.colors.text.secondary}`}>
                    {workout.mainLifts.join(' · ')}
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-xs ${tokens.colors.text.muted}`}>{workout.date}</div>
                  <div className={`text-sm ${tokens.colors.text.secondary}`}>{workout.volume}</div>
                </div>
              </div>
            </PrimaryCard>
          ))}
        </div>
      </div>

      {/* Exercise History Preview */}
      <div>
        <SectionHeader title="动作历史" action={<ChevronRight className={`h-4 w-4 ${tokens.colors.text.muted}`} />} />
        <div className="space-y-2">
          {exerciseHistory.map((exercise) => (
            <div
              key={exercise.name}
              className={`${tokens.radius.md} flex items-center justify-between border ${tokens.colors.border.default} ${tokens.colors.bg.card} p-3`}
            >
              <div>
                <div className={`font-medium ${tokens.colors.text.primary}`}>{exercise.name}</div>
                <div className={`text-sm ${tokens.colors.text.secondary}`}>
                  {exercise.lastWeight} × {exercise.lastReps}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {exercise.trend === 'up' && (
                  <TrendingUp className={`h-4 w-4 ${tokens.colors.semantic.safeText}`} />
                )}
                <ChevronRight className={`h-4 w-4 ${tokens.colors.text.muted}`} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ============================================================
// PAGE 4: PROGRESS / 进步
// ============================================================

const ProgressPage = () => {
  return (
    <div className="space-y-4 py-4">
      {/* Main Progress Insight */}
      <PrimaryCard>
        <div className={`text-xs font-medium ${tokens.colors.text.muted}`}>训练洞察</div>
        <p className={`mt-2 text-base leading-relaxed ${tokens.colors.text.primary}`}>
          卧推强度有小幅上升，但最近恢复压力偏高。
        </p>
        <div className={`mt-3 ${tokens.radius.sm} ${tokens.colors.semantic.infoBg} border ${tokens.colors.semantic.infoBorder} p-3`}>
          <p className={`text-sm ${tokens.colors.semantic.infoText}`}>
            下次建议先保持重量，专注动作质量。
          </p>
        </div>
      </PrimaryCard>

      {/* PR / e1RM Cards */}
      <div>
        <SectionHeader title="估算最大重量 (e1RM)" />
        <div className="grid grid-cols-3 gap-3">
          <MetricCard label="卧推" value="175 lb" helper="+5 lb 本周" tone="safe" />
          <MetricCard label="深蹲" value="225 lb" helper="稳定" />
          <MetricCard label="硬拉" value="275 lb" helper="+10 lb 本月" tone="safe" />
        </div>
      </div>

      {/* Volume Summary */}
      <div>
        <SectionHeader title="训练量概览" />
        <div className="grid grid-cols-3 gap-3">
          <MetricCard label="有效组" value="42" helper="本周" />
          <MetricCard label="训练量" value="12,500 lb" helper="总负荷" />
          <MetricCard label="恢复压力" value="中等" helper="建议保守" tone="caution" />
        </div>
      </div>

      {/* Progress Chart Placeholder */}
      <PrimaryCard>
        <SectionHeader title="卧推进步趋势" />
        {/* Simple visual chart mock */}
        <div className="relative h-32">
          <div className="absolute inset-0 flex items-end justify-between gap-1 px-2">
            {[65, 70, 68, 75, 78, 80, 82, 85].map((height, i) => (
              <div
                key={i}
                className={`flex-1 ${tokens.radius.sm} ${i === 7 ? 'bg-emerald-500' : 'bg-zinc-700'}`}
                style={{ height: `${height}%` }}
              />
            ))}
          </div>
          <div className={`absolute bottom-0 left-0 right-0 flex justify-between text-xs ${tokens.colors.text.muted} pt-2`}>
            <span>4周前</span>
            <span>现在</span>
          </div>
        </div>
      </PrimaryCard>

      {/* Recommendation */}
      <InlineWarning tone="info">
        基于当前数据，建议下周增加 5 lb 测试新 PR。
      </InlineWarning>
    </div>
  );
};

// ============================================================
// PAGE 5: SETTINGS / 设置
// ============================================================

const SettingsPage = () => {
  const [unit, setUnit] = useState<'lb' | 'kg'>('lb');

  const equipmentProfiles = [
    { name: '平板卧推', equipment: 'Olympic Barbell', barWeight: '45 lb' },
    { name: 'Smith Machine', equipment: 'Smith Machine', barWeight: '25 lb' },
    { name: '哑铃', equipment: '每只手', increment: '5 lb 一跳' },
  ];

  return (
    <div className="space-y-4 py-4">
      {/* Units */}
      <PrimaryCard>
        <SectionHeader title="单位设置" />
        <div className="flex gap-2">
          <SelectionChip selected={unit === 'lb'} onClick={() => setUnit('lb')}>
            lb (磅)
          </SelectionChip>
          <SelectionChip selected={unit === 'kg'} onClick={() => setUnit('kg')}>
            kg (公斤)
          </SelectionChip>
        </div>
      </PrimaryCard>

      {/* Backup / Recovery */}
      <PrimaryCard>
        <SectionHeader title="备份与恢复" />
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className={`text-sm ${tokens.colors.text.secondary}`}>备份状态</span>
            <StatusBadge tone="safe"><Check className="h-3 w-3" /> 正常</StatusBadge>
          </div>
          <div className="flex items-center justify-between">
            <span className={`text-sm ${tokens.colors.text.secondary}`}>上次备份</span>
            <span className={`text-sm ${tokens.colors.text.muted}`}>今天 14:30</span>
          </div>
          <div className="grid grid-cols-2 gap-2 pt-2">
            <ActionButton variant="secondary" size="sm" fullWidth>
              <Shield className="h-4 w-4" />
              恢复演练
            </ActionButton>
            <ActionButton variant="danger" size="sm" fullWidth>
              <AlertCircle className="h-4 w-4" />
              紧急本地模式
            </ActionButton>
          </div>
        </div>
      </PrimaryCard>

      {/* Equipment Profiles */}
      <PrimaryCard>
        <SectionHeader title="器械档案" action={<ChevronRight className={`h-4 w-4 ${tokens.colors.text.muted}`} />} />
        <div className="space-y-3">
          {equipmentProfiles.map((profile, i) => (
            <div
              key={i}
              className={`${tokens.radius.sm} flex items-center justify-between border ${tokens.colors.border.default} bg-zinc-800/50 p-3`}
            >
              <div>
                <div className={`font-medium ${tokens.colors.text.primary}`}>{profile.name}</div>
                <div className={`text-sm ${tokens.colors.text.secondary}`}>
                  {profile.equipment} · {profile.barWeight || profile.increment}
                </div>
              </div>
              <ChevronRight className={`h-4 w-4 ${tokens.colors.text.muted}`} />
            </div>
          ))}
        </div>
      </PrimaryCard>

      {/* Cloud Candidate */}
      <PrimaryCard>
        <SectionHeader title="云端候选" />
        <div className="space-y-3">
          <InlineWarning tone="info">
            云端候选不会自动同步。Cloud pull / push 需要手动确认。
          </InlineWarning>
          <div className="flex items-center justify-between">
            <span className={`text-sm ${tokens.colors.text.secondary}`}>云端状态</span>
            <StatusBadge tone="default"><CloudOff className="h-3 w-3" /> 未连接</StatusBadge>
          </div>
          <div className="grid grid-cols-2 gap-2 pt-2">
            <ActionButton variant="secondary" size="sm" fullWidth disabled>
              <Cloud className="h-4 w-4" />
              手动拉取
            </ActionButton>
            <ActionButton variant="secondary" size="sm" fullWidth disabled>
              <Cloud className="h-4 w-4" />
              手动推送
            </ActionButton>
          </div>
        </div>
      </PrimaryCard>

      {/* Diagnostics */}
      <PrimaryCard>
        <SectionHeader title="诊断摘要" />
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className={tokens.colors.text.secondary}>本地记录数</span>
            <span className={tokens.colors.text.primary}>156 条</span>
          </div>
          <div className="flex items-center justify-between">
            <span className={tokens.colors.text.secondary}>数据健康</span>
            <StatusBadge tone="safe">正常</StatusBadge>
          </div>
          <div className={`pt-2 text-xs ${tokens.colors.text.muted} border-t ${tokens.colors.border.default}`}>
            诊断数据不包含完整训练数据 · 不上传外部监控
          </div>
        </div>
      </PrimaryCard>

      {/* About / Data Safety */}
      <PrimaryCard>
        <SectionHeader title="关于 IronPath" />
        <div className={`space-y-2 text-sm ${tokens.colors.text.secondary}`}>
          <p>IronPath 是个人专属训练系统。</p>
          <ul className="list-inside list-disc space-y-1">
            <li>本地优先，数据安全</li>
            <li>Personal-only，非公共 SaaS</li>
            <li>本地记录仍可继续</li>
          </ul>
        </div>
      </PrimaryCard>
    </div>
  );
};

// ============================================================
// MAIN EXPORT - IronPath OS 2 Prototype
// ============================================================

export const IronPathOS2 = () => {
  const [activeTab, setActiveTab] = useState<TabId>('today');

  const renderPage = () => {
    switch (activeTab) {
      case 'today':
        return <TodayPage />;
      case 'train':
        return <TrainPage />;
      case 'history':
        return <HistoryPage />;
      case 'progress':
        return <ProgressPage />;
      case 'settings':
        return <SettingsPage />;
      default:
        return <TodayPage />;
    }
  };

  return (
    <MobileAppShell activeTab={activeTab} onNavigate={setActiveTab}>
      {renderPage()}
    </MobileAppShell>
  );
};

export default IronPathOS2;
