import { AlertCircle, Loader2, LogIn, LogOut, User } from 'lucide-react';
import { classNames } from '../engines/engineUtils';
import { ActionButton } from '../ui/ActionButton';
import { Card } from '../ui/Card';
import { useUiTheme } from '../uiOs/theme/UiThemeProvider';

export type CloudAuthStatus = 'signed_out' | 'signing_in' | 'signed_in' | 'error';

export interface CloudAuthCardProps {
  authStatus: CloudAuthStatus;
  currentUserEmail?: string | null;
  isSigningIn?: boolean;
  errorMessage?: string | null;
  onSignIn?: () => void;
  onSignOut?: () => void;
  onDismiss?: () => void;
}

const statusConfig: Record<CloudAuthStatus, { label: string; tone: 'slate' | 'emerald' | 'amber' | 'rose' }> = {
  signed_out: { label: '未登录', tone: 'slate' },
  signing_in: { label: '登录中', tone: 'amber' },
  signed_in: { label: '已登录', tone: 'emerald' },
  error: { label: '登录失败', tone: 'rose' },
};

export function CloudAuthCard({
  authStatus,
  currentUserEmail,
  isSigningIn,
  errorMessage,
  onSignIn,
  onSignOut,
  onDismiss,
}: CloudAuthCardProps) {
  const { resolvedTheme } = useUiTheme();
  const isDark = resolvedTheme === 'dark';
  const config = statusConfig[authStatus];

  return (
    <Card tone={config.tone} padded className="space-y-4" data-testid="ironpath-auth-card">
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
            ) : (
              <User className={classNames('h-5 w-5', isDark ? 'text-white/70' : 'text-slate-500')} />
            )}
          </div>
          <div>
            <h3 className={classNames('text-base font-semibold', isDark ? 'text-white' : 'text-slate-900')}>
              登录账号
            </h3>
            <p
              className={classNames('text-sm', isDark ? 'text-white/60' : 'text-slate-500')}
              data-testid="ironpath-auth-status"
            >
              {config.label}
            </p>
          </div>
        </div>
      </div>

      {authStatus === 'signed_in' && currentUserEmail ? (
        <div className={classNames('rounded-lg px-3 py-2', isDark ? 'bg-white/[0.06]' : 'bg-slate-50')}>
          <p className={classNames('truncate text-sm font-medium', isDark ? 'text-white/90' : 'text-slate-700')}>
            {currentUserEmail}
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
        {(authStatus === 'signed_out' || authStatus === 'error') && onSignIn ? (
          <ActionButton
            variant="primary"
            size="md"
            onClick={onSignIn}
            disabled={isSigningIn}
            data-testid="ironpath-auth-sign-in"
          >
            <LogIn className="h-4 w-4" />
            <span>登录账号</span>
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

        {(authStatus === 'error' || authStatus === 'signed_out') && onDismiss ? (
          <ActionButton variant="ghost" size="md" onClick={onDismiss}>
            <span>稍后再说</span>
          </ActionButton>
        ) : null}
      </div>
    </Card>
  );
}
