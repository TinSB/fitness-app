import { AlertCircle, Loader2, LogIn, LogOut, User, UserPlus } from 'lucide-react';
import { classNames } from '../engines/engineUtils';
import { ActionButton } from '../ui/ActionButton';
import { Card } from '../ui/Card';
import { useUiTheme } from '../uiOs/theme/UiThemeProvider';

export type CloudAuthStatus = 'signed_out' | 'signing_in' | 'signed_in' | 'error';
export type CloudAuthMode = 'sign_in' | 'sign_up';

export interface CloudAuthCardProps {
  authStatus: CloudAuthStatus;
  authMode?: CloudAuthMode;
  variant?: 'card' | 'embedded';
  hideHeader?: boolean;
  currentUserEmail?: string | null;
  emailInputValue?: string;
  emailInputLabel?: string;
  emailInputPlaceholder?: string;
  passwordInputValue?: string;
  passwordInputLabel?: string;
  passwordInputPlaceholder?: string;
  infoMessage?: string | null;
  isSigningIn?: boolean;
  errorMessage?: string | null;
  onAuthModeChange?: (mode: CloudAuthMode) => void;
  onEmailInputChange?: (value: string) => void;
  onPasswordInputChange?: (value: string) => void;
  onSignIn?: () => void;
  onSignUp?: () => void;
  onSignOut?: () => void;
  onDismiss?: () => void;
}

const statusTone: Record<CloudAuthStatus, 'slate' | 'emerald' | 'amber' | 'rose'> = {
  signed_out: 'slate',
  signing_in: 'amber',
  signed_in: 'emerald',
  error: 'rose',
};

const statusLabel = (status: CloudAuthStatus, mode: CloudAuthMode) => {
  if (status === 'signed_out') return '未登录';
  if (status === 'signing_in') return '登录中';
  if (status === 'signed_in') return '已登录';
  return mode === 'sign_up' ? '创建失败' : '登录失败';
};

export function CloudAuthCard({
  authStatus,
  authMode = 'sign_in',
  variant = 'card',
  hideHeader = false,
  currentUserEmail,
  emailInputValue,
  emailInputLabel,
  emailInputPlaceholder,
  passwordInputValue,
  passwordInputLabel,
  passwordInputPlaceholder,
  infoMessage,
  isSigningIn,
  errorMessage,
  onAuthModeChange,
  onEmailInputChange,
  onPasswordInputChange,
  onSignIn,
  onSignUp,
  onSignOut,
  onDismiss,
}: CloudAuthCardProps) {
  const { resolvedTheme } = useUiTheme();
  const isDark = resolvedTheme === 'dark';
  const canEditCredentials = authStatus === 'signed_out' || authStatus === 'error';
  const canSwitchMode = canEditCredentials && Boolean(onAuthModeChange && onSignIn && onSignUp);
  const primaryAuthAction = authMode === 'sign_up' ? onSignUp : onSignIn;
  const primaryAuthLabel = authMode === 'sign_up' ? '创建账号' : '登录账号';
  const primaryAuthTestId = authMode === 'sign_up' ? 'ironpath-auth-sign-up' : 'ironpath-auth-sign-in';
  const authTitle = authMode === 'sign_up' && canEditCredentials ? '创建账号' : '登录账号';

  const content = (
    <>
      {hideHeader ? null : (
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className={classNames(
              'flex h-10 w-10 items-center justify-center rounded-full',
              isDark ? 'bg-white/10' : 'bg-slate-100',
            )}
          >
            {authStatus === 'signing_in' ? (
              <Loader2 className={classNames('h-5 w-5 animate-spin', isDark ? 'text-white/70' : 'text-slate-500')} />
            ) : authStatus === 'error' ? (
              <AlertCircle className={classNames('h-5 w-5', isDark ? 'text-rose-300' : 'text-rose-500')} />
            ) : authMode === 'sign_up' && canEditCredentials ? (
              <UserPlus className={classNames('h-5 w-5', isDark ? 'text-white/70' : 'text-slate-500')} />
            ) : (
              <User className={classNames('h-5 w-5', isDark ? 'text-white/70' : 'text-slate-500')} />
            )}
          </div>
          <div>
            <h3 className={classNames('text-base font-semibold', isDark ? 'text-white' : 'text-slate-900')}>
              {authTitle}
            </h3>
            <p
              className={classNames('text-sm', isDark ? 'text-white/60' : 'text-slate-500')}
              data-testid="ironpath-auth-status"
            >
              {statusLabel(authStatus, authMode)}
            </p>
          </div>
        </div>
      </div>
      )}

      {authStatus === 'signed_in' && currentUserEmail ? (
        <div className={classNames('rounded-lg px-3 py-2', isDark ? 'bg-white/[0.06]' : 'bg-slate-50')}>
          <p className={classNames('truncate text-sm font-medium', isDark ? 'text-white/90' : 'text-slate-700')}>
            {currentUserEmail}
          </p>
        </div>
      ) : null}

      {canSwitchMode ? (
        <div
          className={classNames(
            'grid grid-cols-2 rounded-lg p-1 text-sm',
            isDark ? 'bg-white/[0.06]' : 'bg-slate-100',
          )}
        >
          {([
            ['sign_in', '登录账号', 'ironpath-auth-mode-sign-in'],
            ['sign_up', '创建账号', 'ironpath-auth-mode-sign-up'],
          ] as const).map(([mode, label, testId]) => (
            <button
              key={mode}
              type="button"
              onClick={() => onAuthModeChange?.(mode)}
              className={classNames(
                'rounded-md px-3 py-2 font-medium transition',
                authMode === mode
                  ? isDark
                    ? 'bg-white/15 text-white'
                    : 'bg-white text-slate-900 shadow-sm'
                  : isDark
                    ? 'text-white/55 hover:text-white'
                    : 'text-slate-500 hover:text-slate-800',
              )}
              data-testid={testId}
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}

      {canEditCredentials && onEmailInputChange ? (
        <label className="block space-y-1.5">
          <span className={classNames('text-xs font-medium', isDark ? 'text-white/50' : 'text-slate-500')}>
            {emailInputLabel ?? '邮箱'}
          </span>
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            value={emailInputValue ?? ''}
            onChange={(event) => onEmailInputChange(event.target.value)}
            placeholder={emailInputPlaceholder ?? '用于登录的邮箱'}
            className={classNames(
              'w-full rounded-lg border px-3 py-2 text-sm outline-none transition',
              isDark
                ? 'border-white/10 bg-white/[0.06] text-white placeholder:text-white/30 focus:border-emerald-300/60'
                : 'border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:border-emerald-500',
            )}
            data-testid="ironpath-auth-email-input"
          />
        </label>
      ) : null}

      {canEditCredentials && onPasswordInputChange ? (
        <label className="block space-y-1.5">
          <span className={classNames('text-xs font-medium', isDark ? 'text-white/50' : 'text-slate-500')}>
            {passwordInputLabel ?? '密码'}
          </span>
          <input
            type="password"
            autoComplete={authMode === 'sign_up' ? 'new-password' : 'current-password'}
            value={passwordInputValue ?? ''}
            onChange={(event) => onPasswordInputChange(event.target.value)}
            placeholder={passwordInputPlaceholder ?? '输入密码'}
            className={classNames(
              'w-full rounded-lg border px-3 py-2 text-sm outline-none transition',
              isDark
                ? 'border-white/10 bg-white/[0.06] text-white placeholder:text-white/30 focus:border-emerald-300/60'
                : 'border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:border-emerald-500',
            )}
            data-testid="ironpath-auth-password-input"
          />
        </label>
      ) : null}

      {infoMessage ? (
        <div className={classNames('rounded-lg px-3 py-2', isDark ? 'bg-emerald-400/10' : 'bg-emerald-50')}>
          <p className={classNames('text-sm', isDark ? 'text-emerald-200' : 'text-emerald-700')}>
            {infoMessage}
          </p>
        </div>
      ) : null}

      {authStatus === 'error' && errorMessage ? (
        <div className={classNames('rounded-lg px-3 py-2', isDark ? 'bg-rose-400/10' : 'bg-rose-50')}>
          <p className={classNames('text-sm', isDark ? 'text-rose-200' : 'text-rose-700')}>
            {errorMessage}
          </p>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {canEditCredentials && primaryAuthAction ? (
          <ActionButton
            variant="primary"
            size="md"
            onClick={primaryAuthAction}
            disabled={isSigningIn}
            data-testid={primaryAuthTestId}
          >
            <LogIn className="h-4 w-4" />
            <span>{primaryAuthLabel}</span>
          </ActionButton>
        ) : null}

        {authStatus === 'signing_in' ? (
          <ActionButton variant="secondary" size="md" disabled>
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>登录中</span>
          </ActionButton>
        ) : null}

        {authStatus === 'signed_in' && onSignOut ? (
          <ActionButton variant="ghost" size="md" onClick={onSignOut} data-testid="ironpath-auth-sign-out">
            <LogOut className="h-4 w-4" />
            <span>退出登录</span>
          </ActionButton>
        ) : null}

        {canEditCredentials && onDismiss ? (
          <ActionButton variant="ghost" size="md" onClick={onDismiss}>
            <span>稍后再说</span>
          </ActionButton>
        ) : null}
      </div>
    </>
  );

  if (variant === 'embedded') {
    return (
      <div className="space-y-3" data-testid="ironpath-auth-card">
        {content}
      </div>
    );
  }

  return (
    <Card tone={statusTone[authStatus]} padded className="space-y-4" data-testid="ironpath-auth-card">
      {content}
    </Card>
  );
}
