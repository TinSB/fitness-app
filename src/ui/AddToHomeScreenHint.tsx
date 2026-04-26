import React from 'react';

const DISMISSED_KEY = 'ironpath.addToHomeScreen.dismissed';

const isIosSafari = () => {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const isIos = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
  return isIos && isSafari;
};

const isStandalone = () => {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(display-mode: standalone)').matches || Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);
};

export function AddToHomeScreenHint() {
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    if (typeof localStorage === 'undefined') return;
    const dismissed = localStorage.getItem(DISMISSED_KEY) === '1';
    setVisible(isIosSafari() && !isStandalone() && !dismissed);
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed inset-x-3 bottom-[calc(76px+env(safe-area-inset-bottom))] z-40 rounded-lg border border-emerald-200 bg-white p-3 shadow-xl md:hidden">
      <div className="flex gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-emerald-600 text-sm font-black text-white">IP</div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-black text-slate-950">添加到主屏幕</div>
          <div className="mt-1 text-sm leading-5 text-slate-600">在 iPhone 上训练时使用更方便：点击 Safari 分享按钮，然后选择“添加到主屏幕”。</div>
        </div>
        <button
          onClick={() => {
            localStorage.setItem(DISMISSED_KEY, '1');
            setVisible(false);
          }}
          className="h-9 rounded-md px-2 text-sm font-black text-slate-500"
          aria-label="关闭添加到主屏幕提示"
        >
          ×
        </button>
      </div>
    </div>
  );
}
