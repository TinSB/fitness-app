import { useState, type ReactNode } from 'react';

// ============================================================================
// IronPath UI-OS 2 - Apple-inspired Liquid Training OS
// ============================================================================
// Design principles: clarity, depth, restraint, large typography,
// soft materials, clear component states, bottom sheets, tactile buttons

// ============================================================================
// Component State Types
// ============================================================================
type BadgeState = 'safe' | 'info' | 'warning' | 'danger' | 'disabled' | 'manual-required';
type EquipmentType = 'barbell' | 'dumbbell' | 'machine-stack' | 'plate-loaded' | 'smith' | 'unknown';
type SafetyState = 'local-ok' | 'backup-suggested' | 'cloud-paused' | 'emergency-ready' | 'source-unclear';
type TabId = 'today' | 'train' | 'history' | 'progress' | 'settings';

// ============================================================================
// Glass Card - Soft translucent material
// ============================================================================
function GlassCard({ 
  children, 
  className = '',
  padding = 'md',
  onClick,
  highlight = false,
}: { 
  children: ReactNode; 
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  onClick?: () => void;
  highlight?: boolean;
}) {
  const paddingMap = {
    none: '',
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-5',
  };
  
  return (
    <div 
      className={`
        backdrop-blur-xl rounded-2xl
        ${paddingMap[padding]}
        ${onClick ? 'cursor-pointer active:scale-[0.98] transition-transform duration-150' : ''}
        ${highlight ? 'ring-1 ring-emerald-500/30' : ''}
        ${className}
      `}
      style={{
        background: 'rgba(44, 44, 46, 0.6)',
        border: '1px solid rgba(255, 255, 255, 0.06)',
      }}
      onClick={onClick}
    >
      {children}
    </div>
  );
}

// ============================================================================
// Action Button with States - Large tactile buttons for gym use
// ============================================================================
function ActionButton({
  children,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  disabled = false,
  loading = false,
  onClick,
}: {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  disabled?: boolean;
  loading?: boolean;
  onClick?: () => void;
}) {
  const sizeStyles = {
    sm: 'px-4 py-2.5 text-sm rounded-xl min-h-[40px]',
    md: 'px-5 py-3.5 text-base rounded-2xl min-h-[52px]',
    lg: 'px-6 py-4 text-lg rounded-2xl min-h-[60px]',
  };
  
  const variantStyles = {
    primary: disabled 
      ? 'bg-emerald-500/30 text-white/40' 
      : 'bg-emerald-500 text-white font-semibold active:bg-emerald-600 active:scale-[0.98]',
    secondary: disabled
      ? 'bg-white/5 text-white/30'
      : 'bg-white/10 text-white font-medium active:bg-white/15 active:scale-[0.98]',
    ghost: disabled
      ? 'text-white/30'
      : 'text-white/70 font-medium active:bg-white/5 active:scale-[0.98]',
    danger: disabled
      ? 'bg-red-500/20 text-white/40'
      : 'bg-red-500/15 text-red-400 font-medium active:bg-red-500/25 active:scale-[0.98]',
  };

  return (
    <button
      className={`
        transition-all duration-150 flex items-center justify-center gap-2
        ${sizeStyles[size]}
        ${variantStyles[variant]}
        ${fullWidth ? 'w-full' : ''}
      `}
      disabled={disabled || loading}
      onClick={onClick}
    >
      {loading ? (
        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      ) : (
        children
      )}
    </button>
  );
}

// ============================================================================
// Segmented Control - iOS style
// ============================================================================
function SegmentedControl({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string; disabled?: boolean }[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div 
      className="flex p-1 rounded-xl"
      style={{ background: 'rgba(118, 118, 128, 0.24)' }}
    >
      {options.map((option) => {
        const isSelected = value === option.value;
        const isDisabled = option.disabled;
        
        return (
          <button
            key={option.value}
            className={`
              flex-1 py-2.5 px-3 rounded-lg text-sm font-medium transition-all duration-200
              ${isSelected 
                ? 'bg-white/20 text-white shadow-sm backdrop-blur-sm' 
                : isDisabled
                ? 'text-white/25'
                : 'text-white/55 active:bg-white/10'
              }
            `}
            disabled={isDisabled}
            onClick={() => !isDisabled && onChange(option.value)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

// ============================================================================
// Status Badge with States
// ============================================================================
function StatusBadge({
  state = 'info',
  children,
}: {
  state?: BadgeState;
  children: ReactNode;
}) {
  const stateStyles = {
    safe: 'bg-emerald-500/15 text-emerald-400',
    info: 'bg-blue-500/15 text-blue-400',
    warning: 'bg-amber-500/15 text-amber-400',
    danger: 'bg-red-500/15 text-red-400',
    disabled: 'bg-white/8 text-white/40',
    'manual-required': 'bg-orange-500/15 text-orange-400',
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium ${stateStyles[state]}`}>
      {children}
    </span>
  );
}

// ============================================================================
// Safety Strip - Local-first indicator
// ============================================================================
function SafetyStrip({ state = 'local-ok' }: { state?: SafetyState }) {
  const configs = {
    'local-ok': { 
      icon: '●', 
      text: '当前使用本地数据', 
      color: 'text-emerald-400',
      bg: 'rgba(52, 199, 89, 0.08)'
    },
    'backup-suggested': { 
      icon: '○', 
      text: '建议备份本地数据', 
      color: 'text-amber-400',
      bg: 'rgba(255, 159, 10, 0.08)'
    },
    'cloud-paused': { 
      icon: '◐', 
      text: '云端候选已暂停，需手动确认', 
      color: 'text-orange-400',
      bg: 'rgba(255, 149, 0, 0.08)'
    },
    'emergency-ready': { 
      icon: '◉', 
      text: '紧急本地模式可用', 
      color: 'text-blue-400',
      bg: 'rgba(10, 132, 255, 0.08)'
    },
    'source-unclear': { 
      icon: '◌', 
      text: '数据来源待确认', 
      color: 'text-white/40',
      bg: 'rgba(255, 255, 255, 0.04)'
    },
  };

  const config = configs[state];

  return (
    <div 
      className="flex items-center justify-center gap-2 py-3 px-4 rounded-2xl"
      style={{ background: config.bg }}
    >
      <span className={`text-sm ${config.color}`}>{config.icon}</span>
      <span className="text-sm text-white/50">{config.text}</span>
    </div>
  );
}

// ============================================================================
// Equipment-Aware Load Display - Hero Component for Train page
// ============================================================================
function EquipmentAwareLoadCard({
  type = 'barbell',
  mainDisplay,
  subInfo,
  note,
  state = 'default',
}: {
  type?: EquipmentType;
  mainDisplay: string;
  subInfo?: string;
  note?: string;
  state?: 'default' | 'warning' | 'blocked';
}) {
  const typeLabels: Record<EquipmentType, string> = {
    barbell: '杠铃',
    dumbbell: '哑铃',
    'machine-stack': '器械',
    'plate-loaded': '挂片器械',
    smith: '史密斯架',
    unknown: '未知器械',
  };

  const stateGradients = {
    default: 'from-emerald-500/12 via-emerald-500/6 to-transparent',
    warning: 'from-amber-500/12 via-amber-500/6 to-transparent',
    blocked: 'from-red-500/12 via-red-500/6 to-transparent',
  };

  return (
    <div 
      className={`relative overflow-hidden rounded-3xl p-6 bg-gradient-to-b ${stateGradients[state]}`}
      style={{ border: '1px solid rgba(255, 255, 255, 0.06)' }}
    >
      {/* Type indicator */}
      <div className="flex items-center gap-2 mb-5">
        <span className="text-xs text-white/35 uppercase tracking-widest font-medium">
          {typeLabels[type]}
        </span>
      </div>
      
      {/* Main weight display - Large and readable for gym use */}
      <div className="mb-4">
        <span 
          className="text-5xl font-extralight text-white tracking-tight"
          style={{ fontFeatureSettings: '"tnum"' }}
        >
          {mainDisplay}
        </span>
      </div>
      
      {/* Sub info */}
      {subInfo && (
        <p className="text-base text-white/55 mb-2">{subInfo}</p>
      )}
      
      {/* Note */}
      {note && (
        <p className="text-sm text-white/35 leading-relaxed">{note}</p>
      )}
    </div>
  );
}

// ============================================================================
// Bottom Sheet
// ============================================================================
function BottomSheet({
  isOpen,
  onClose,
  title,
  children,
  confirmRequired = false,
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  confirmRequired?: boolean;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Sheet */}
      <div 
        className="relative w-full rounded-t-3xl p-6 pb-10"
        style={{ 
          background: 'rgba(28, 28, 30, 0.95)',
          backdropFilter: 'blur(40px)',
          maxHeight: '85vh',
          animation: 'slideUp 0.3s ease-out',
        }}
      >
        {/* Handle */}
        <div className="w-9 h-1 bg-white/20 rounded-full mx-auto mb-5" />
        
        {/* Title */}
        <h3 className="text-xl font-semibold text-white mb-5">{title}</h3>
        
        {/* Content */}
        <div className="overflow-y-auto">
          {children}
        </div>
        
        {confirmRequired && (
          <div className="mt-5 pt-4 border-t border-white/8">
            <p className="text-xs text-amber-400 text-center">需要手动确认</p>
          </div>
        )}
      </div>
      
      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

// ============================================================================
// Floating Bottom Navigation - iOS style
// ============================================================================
function FloatingBottomNav({
  activeTab,
  onTabChange,
}: {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}) {
  const tabs: { id: TabId; label: string; icon: string }[] = [
    { id: 'today', label: '今日', icon: '◐' },
    { id: 'train', label: '训练', icon: '◉' },
    { id: 'history', label: '历史', icon: '◷' },
    { id: 'progress', label: '进步', icon: '△' },
    { id: 'settings', label: '设置', icon: '⚙' },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 pb-8 px-4 z-40 pointer-events-none">
      <div 
        className="flex items-center justify-around py-3 px-2 rounded-2xl backdrop-blur-2xl pointer-events-auto"
        style={{ 
          background: 'rgba(28, 28, 30, 0.88)',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          boxShadow: '0 4px 30px rgba(0, 0, 0, 0.3)',
        }}
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              className={`
                flex flex-col items-center gap-1 py-2 px-5 rounded-xl transition-all duration-200
                ${isActive 
                  ? 'text-emerald-400' 
                  : 'text-white/35 active:text-white/50'
                }
              `}
              onClick={() => onTabChange(tab.id)}
            >
              <span className={`text-xl ${isActive ? 'scale-110' : ''} transition-transform`}>{tab.icon}</span>
              <span className="text-[11px] font-medium">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// Settings Row - iOS style list item
// ============================================================================
function SettingsRow({
  label,
  value,
  valueColor = 'text-white/50',
  showArrow = false,
  border = true,
  onClick,
}: {
  label: string;
  value?: string;
  valueColor?: string;
  showArrow?: boolean;
  border?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      className={`
        w-full flex items-center justify-between px-4 py-4
        ${border ? 'border-b border-white/5' : ''}
        ${onClick ? 'active:bg-white/5' : ''}
        text-left
      `}
      onClick={onClick}
      disabled={!onClick}
    >
      <span className="text-white">{label}</span>
      <span className="flex items-center gap-2">
        {value && <span className={`text-sm ${valueColor}`}>{value}</span>}
        {showArrow && <span className="text-white/25 text-lg">›</span>}
      </span>
    </button>
  );
}

// ============================================================================
// PAGE: Today - Calm and decisive
// ============================================================================
function TodayPage() {
  const [trainingType, setTrainingType] = useState('push');

  return (
    <div className="flex flex-col gap-5 pb-36">
      {/* Header */}
      <div className="pt-4">
        <p className="text-sm text-white/35 mb-1">周一</p>
        <h1 className="text-[34px] font-semibold text-white tracking-tight">今日</h1>
      </div>

      {/* Training suggestion */}
      <GlassCard>
        <p className="text-sm text-white/45 mb-2">今日训练建议</p>
        <h2 className="text-[22px] font-semibold text-white mb-2">推举日</h2>
        <p className="text-[15px] text-white/55 leading-relaxed">
          根据你的训练周期，今天建议进行上肢推举训练
        </p>
      </GlassCard>

      {/* Training type selector */}
      <div>
        <p className="text-sm text-white/45 mb-3">今天想练</p>
        <SegmentedControl
          options={[
            { value: 'push', label: '推' },
            { value: 'pull', label: '拉' },
            { value: 'legs', label: '腿' },
            { value: 'rest', label: '休息' },
          ]}
          value={trainingType}
          onChange={setTrainingType}
        />
      </div>

      {/* Recovery status */}
      <GlassCard>
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-white/45">恢复状态</p>
          <StatusBadge state="safe">良好</StatusBadge>
        </div>
        <div className="flex items-baseline gap-3">
          <span 
            className="text-[44px] font-extralight text-white"
            style={{ fontFeatureSettings: '"tnum"' }}
          >
            85%
          </span>
          <span className="text-sm text-white/35">预估恢复度</span>
        </div>
        <p className="text-sm text-white/45 mt-3">
          上次训练后已休息 48 小时
        </p>
      </GlassCard>

      {/* Last related training */}
      <GlassCard>
        <p className="text-sm text-white/45 mb-3">上次相关训练</p>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-white font-medium text-[17px]">卧推</p>
            <p className="text-sm text-white/45 mt-0.5">3 天前</p>
          </div>
          <div className="text-right">
            <p className="text-xl text-white font-light">135 lb × 5</p>
            <p className="text-xs text-white/35 mt-0.5">最佳组</p>
          </div>
        </div>
      </GlassCard>

      {/* Start training button */}
      <ActionButton variant="primary" size="lg" fullWidth>
        开始今天训练
      </ActionButton>

      {/* Safety strip */}
      <SafetyStrip state="local-ok" />
    </div>
  );
}

// ============================================================================
// PAGE: Train - Focus mode, lowest clutter
// ============================================================================
function TrainPage() {
  const [showAlternatives, setShowAlternatives] = useState(false);
  const [actualWeight, setActualWeight] = useState('45');
  const [actualReps, setActualReps] = useState('10');

  return (
    <div className="flex flex-col gap-5 pb-36">
      {/* Current exercise header */}
      <div className="pt-4">
        <p className="text-sm text-emerald-400 font-medium mb-1">训练中</p>
        <h1 className="text-[34px] font-semibold text-white tracking-tight">卧推</h1>
        <p className="text-[15px] text-white/45 mt-1">第 1 组 / 共 4 组 · 热身</p>
      </div>

      {/* Equipment-aware prescription - Hero Component */}
      <EquipmentAwareLoadCard
        type="barbell"
        mainDisplay="空杆 45 lb × 10"
        subInfo="理论 17 lb → 实际 45 lb"
        note="杆重已计入，理论重量低于空杆，使用空杆热身"
      />

      {/* Actual set input */}
      <GlassCard>
        <p className="text-sm text-white/45 mb-5">实际完成</p>
        <div className="flex gap-4">
          <div className="flex-1">
            <label className="text-xs text-white/35 block mb-2 uppercase tracking-wider">重量</label>
            <input
              type="text"
              inputMode="numeric"
              value={actualWeight}
              onChange={(e) => setActualWeight(e.target.value)}
              className="w-full bg-white/5 border border-white/8 rounded-xl px-4 py-4 text-[28px] text-white text-center font-light focus:outline-none focus:border-emerald-500/50 focus:bg-white/8 transition-colors"
              style={{ fontFeatureSettings: '"tnum"' }}
            />
            <p className="text-xs text-white/30 text-center mt-2">lb</p>
          </div>
          <div className="flex-1">
            <label className="text-xs text-white/35 block mb-2 uppercase tracking-wider">次数</label>
            <input
              type="text"
              inputMode="numeric"
              value={actualReps}
              onChange={(e) => setActualReps(e.target.value)}
              className="w-full bg-white/5 border border-white/8 rounded-xl px-4 py-4 text-[28px] text-white text-center font-light focus:outline-none focus:border-emerald-500/50 focus:bg-white/8 transition-colors"
              style={{ fontFeatureSettings: '"tnum"' }}
            />
            <p className="text-xs text-white/30 text-center mt-2">次</p>
          </div>
        </div>
      </GlassCard>

      {/* Primary action */}
      <ActionButton variant="primary" size="lg" fullWidth>
        完成这组
      </ActionButton>

      {/* Secondary actions */}
      <div className="flex gap-3">
        <ActionButton variant="secondary" size="md" fullWidth>
          套用建议
        </ActionButton>
        <ActionButton 
          variant="ghost" 
          size="md" 
          fullWidth
          onClick={() => setShowAlternatives(true)}
        >
          替代动作
        </ActionButton>
      </div>

      {/* Discomfort marker */}
      <div className="pt-2">
        <ActionButton variant="danger" size="sm">
          标记不适
        </ActionButton>
      </div>

      {/* Safety strip */}
      <SafetyStrip state="local-ok" />

      {/* Alternatives bottom sheet */}
      <BottomSheet
        isOpen={showAlternatives}
        onClose={() => setShowAlternatives(false)}
        title="替代动作"
      >
        <div className="flex flex-col gap-3">
          {['哑铃卧推', '上斜卧推', '器械推胸', '俯卧撑'].map((exercise) => (
            <GlassCard key={exercise} onClick={() => setShowAlternatives(false)} padding="md">
              <span className="text-white text-[17px]">{exercise}</span>
            </GlassCard>
          ))}
        </div>
      </BottomSheet>
    </div>
  );
}

// ============================================================================
// PAGE: History - Clean timeline cards
// ============================================================================
function HistoryPage() {
  const sessions = [
    {
      date: '今天',
      entries: [
        { name: '卧推', sets: '4 组', best: '135 lb × 5', status: 'complete' as const },
      ],
    },
    {
      date: '昨天',
      entries: [
        { name: '深蹲', sets: '5 组', best: '185 lb × 5', status: 'complete' as const },
        { name: '腿举', sets: '3 组', best: '360 lb × 10', status: 'complete' as const },
      ],
    },
    {
      date: '3 天前',
      entries: [
        { name: '硬拉', sets: '3 组', best: '225 lb × 3', status: 'complete' as const },
        { name: '划船', sets: '4 组', best: '135 lb × 8', status: 'partial' as const },
      ],
    },
  ];

  return (
    <div className="flex flex-col gap-5 pb-36">
      {/* Header */}
      <div className="pt-4">
        <h1 className="text-[34px] font-semibold text-white tracking-tight">历史</h1>
        <p className="text-[15px] text-white/45 mt-1">最近训练记录</p>
      </div>

      {/* Data health tip */}
      <GlassCard padding="sm">
        <div className="flex items-center gap-3 px-1">
          <span className="text-emerald-400">✓</span>
          <span className="text-sm text-white/55">本地训练记录完整，共 47 次训练</span>
        </div>
      </GlassCard>

      {/* Timeline */}
      {sessions.map((session) => (
        <div key={session.date}>
          <p className="text-sm text-white/35 mb-3 font-medium">{session.date}</p>
          <div className="flex flex-col gap-2">
            {session.entries.map((entry, idx) => (
              <GlassCard key={idx}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white font-medium text-[17px]">{entry.name}</p>
                    <p className="text-sm text-white/45 mt-0.5">{entry.sets}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-white text-lg font-light">{entry.best}</p>
                    <StatusBadge state={entry.status === 'complete' ? 'safe' : 'warning'}>
                      {entry.status === 'complete' ? '完成' : '部分'}
                    </StatusBadge>
                  </div>
                </div>
              </GlassCard>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// PAGE: Progress - Human-readable insights
// ============================================================================
function ProgressPage() {
  return (
    <div className="flex flex-col gap-5 pb-36">
      {/* Header */}
      <div className="pt-4">
        <h1 className="text-[34px] font-semibold text-white tracking-tight">进步</h1>
        <p className="text-[15px] text-white/45 mt-1">训练洞察与趋势</p>
      </div>

      {/* Insights - Human readable */}
      <div className="flex flex-col gap-3">
        <GlassCard>
          <div className="flex items-start gap-4">
            <span className="text-emerald-400 text-xl mt-0.5">↑</span>
            <div>
              <p className="text-white font-medium text-[17px]">卧推强度有小幅上升</p>
              <p className="text-sm text-white/45 mt-1">过去两周 e1RM 增加约 5 lb</p>
            </div>
          </div>
        </GlassCard>

        <GlassCard>
          <div className="flex items-start gap-4">
            <span className="text-amber-400 text-xl mt-0.5">◐</span>
            <div>
              <p className="text-white font-medium text-[17px]">最近恢复压力偏高</p>
              <p className="text-sm text-white/45 mt-1">训练频率高于平均，注意休息</p>
            </div>
          </div>
        </GlassCard>

        <GlassCard>
          <div className="flex items-start gap-4">
            <span className="text-blue-400 text-xl mt-0.5">→</span>
            <div>
              <p className="text-white font-medium text-[17px]">下次建议先保持重量</p>
              <p className="text-sm text-white/45 mt-1">巩固当前强度后再考虑加重</p>
            </div>
          </div>
        </GlassCard>
      </div>

      {/* e1RM cards */}
      <div>
        <p className="text-sm text-white/45 mb-3">估算最大重量 (e1RM)</p>
        <div className="grid grid-cols-2 gap-3">
          {[
            { name: '卧推', value: '165', unit: 'lb', trend: '+5' },
            { name: '深蹲', value: '225', unit: 'lb', trend: '—' },
            { name: '硬拉', value: '275', unit: 'lb', trend: '+10' },
            { name: '推举', value: '95', unit: 'lb', trend: '—' },
          ].map((item) => (
            <GlassCard key={item.name}>
              <p className="text-xs text-white/35 mb-2 uppercase tracking-wider">{item.name}</p>
              <p 
                className="text-[32px] font-extralight text-white"
                style={{ fontFeatureSettings: '"tnum"' }}
              >
                {item.value}
                <span className="text-sm text-white/35 ml-1">{item.unit}</span>
              </p>
              <p className={`text-sm mt-2 ${item.trend.includes('+') ? 'text-emerald-400' : 'text-white/35'}`}>
                {item.trend}
              </p>
            </GlassCard>
          ))}
        </div>
      </div>

      {/* Trend placeholder */}
      <GlassCard>
        <p className="text-sm text-white/45 mb-4">训练量趋势</p>
        <div 
          className="h-32 rounded-xl flex items-center justify-center"
          style={{ background: 'rgba(255, 255, 255, 0.03)' }}
        >
          <p className="text-sm text-white/25">趋势图表</p>
        </div>
      </GlassCard>
    </div>
  );
}

// ============================================================================
// PAGE: Settings - iOS-like grouped cards
// ============================================================================
function SettingsPage() {
  const [showBackupSheet, setShowBackupSheet] = useState(false);
  const [showRestoreSheet, setShowRestoreSheet] = useState(false);

  return (
    <div className="flex flex-col gap-6 pb-36">
      {/* Header */}
      <div className="pt-4">
        <h1 className="text-[34px] font-semibold text-white tracking-tight">设置</h1>
      </div>

      {/* Units */}
      <div>
        <p className="text-sm text-white/45 mb-3 px-1">单位</p>
        <GlassCard padding="none">
          <SettingsRow label="重量单位" value="lb" />
          <SettingsRow label="身高单位" value="cm" border={false} />
        </GlassCard>
      </div>

      {/* Backup & Recovery */}
      <div>
        <p className="text-sm text-white/45 mb-3 px-1">备份与恢复</p>
        <GlassCard padding="none">
          <SettingsRow 
            label="导出本地数据" 
            showArrow 
            onClick={() => setShowBackupSheet(true)}
          />
          <SettingsRow 
            label="从文件恢复" 
            showArrow 
            onClick={() => setShowRestoreSheet(true)}
          />
          <SettingsRow 
            label="紧急本地模式" 
            value="可用"
            valueColor="text-emerald-400"
            border={false}
          />
        </GlassCard>
      </div>

      {/* Equipment profiles */}
      <div>
        <p className="text-sm text-white/45 mb-3 px-1">器械档案</p>
        <GlassCard padding="none">
          <SettingsRow label="杠铃" value="45 lb 标准杆" />
          <SettingsRow label="哑铃组" value="5-50 lb" />
          <SettingsRow label="已配置器械" value="12 种" border={false} />
        </GlassCard>
      </div>

      {/* Cloud candidate */}
      <div>
        <p className="text-sm text-white/45 mb-3 px-1">云端候选</p>
        <GlassCard>
          <div className="flex items-center justify-between mb-3">
            <span className="text-white text-[17px]">云端候选</span>
            <StatusBadge state="manual-required">需手动确认</StatusBadge>
          </div>
          <p className="text-sm text-white/45 leading-relaxed">
            云端候选不会自动同步。如需使用，请手动确认每次操作。
          </p>
        </GlassCard>
      </div>

      {/* Diagnostics */}
      <div>
        <p className="text-sm text-white/45 mb-3 px-1">诊断摘要</p>
        <GlassCard padding="none">
          <SettingsRow label="本地数据状态" value="正常" valueColor="text-emerald-400" />
          <SettingsRow label="上次备份" value="从未" valueColor="text-amber-400" />
          <SettingsRow label="存储使用" value="2.3 MB" border={false} />
        </GlassCard>
      </div>

      {/* About data safety */}
      <GlassCard>
        <p className="text-sm text-white/45 mb-2">关于数据安全</p>
        <p className="text-[15px] text-white/55 leading-relaxed">
          IronPath 采用本地优先设计。所有训练数据默认存储在你的设备上。
          本地训练记录仍可继续，即使离线也不受影响。
        </p>
      </GlassCard>

      {/* Safety strip */}
      <SafetyStrip state="local-ok" />

      {/* Backup bottom sheet */}
      <BottomSheet
        isOpen={showBackupSheet}
        onClose={() => setShowBackupSheet(false)}
        title="导出本地数据"
        confirmRequired
      >
        <div className="flex flex-col gap-4">
          <p className="text-[15px] text-white/55 leading-relaxed">
            将导出所有本地训练记录和设置到一个文件。
          </p>
          <ActionButton variant="primary" fullWidth>
            确认导出
          </ActionButton>
          <ActionButton variant="ghost" fullWidth onClick={() => setShowBackupSheet(false)}>
            取消
          </ActionButton>
        </div>
      </BottomSheet>

      {/* Restore bottom sheet */}
      <BottomSheet
        isOpen={showRestoreSheet}
        onClose={() => setShowRestoreSheet(false)}
        title="从文件恢复"
        confirmRequired
      >
        <div className="flex flex-col gap-4">
          <p className="text-[15px] text-white/55 leading-relaxed">
            需要手动确认。原型仅展示恢复确认流程；真实导入前必须先校验文件，不会自动覆盖本地训练记录。
          </p>
          <ActionButton variant="primary" fullWidth onClick={() => setShowRestoreSheet(false)}>
            我知道了
          </ActionButton>
          <ActionButton variant="ghost" fullWidth onClick={() => setShowRestoreSheet(false)}>
            取消
          </ActionButton>
        </div>
      </BottomSheet>
    </div>
  );
}

// ============================================================================
// Main App Shell
// ============================================================================
export default function IronPathOS2() {
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
    <div 
      className="min-h-dvh w-full"
      style={{ 
        background: '#0a0a0b',
        fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", system-ui, sans-serif',
      }}
    >
      {/* Safe area top */}
      <div className="h-12" style={{ paddingTop: 'env(safe-area-inset-top)' }} />
      
      {/* Main content */}
      <main className="px-5">
        {renderPage()}
      </main>

      {/* Floating bottom nav */}
      <FloatingBottomNav 
        activeTab={activeTab} 
        onTabChange={setActiveTab} 
      />
    </div>
  );
}
