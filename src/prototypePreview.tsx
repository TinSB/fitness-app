import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { IronPathOS2 } from './prototype/IronPathOS2';
import './index.css';

// Preview wrapper for the UI-OS 2 prototype
const PreviewApp = () => {
  const [showPrototype, setShowPrototype] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.location.search.includes('prototype=os2');
    }
    return false;
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('prototype') === 'os2') {
      setShowPrototype(true);
    }
  }, []);

  if (showPrototype) {
    return <IronPathOS2 />;
  }

  // Show a launcher to switch between main app and prototype
  return (
    <div className="min-h-dvh bg-zinc-950 text-zinc-50 font-sans antialiased flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight">IronPath</h1>
          <p className="mt-2 text-zinc-400">选择要启动的界面</p>
        </div>

        <div className="space-y-3">
          <button
            type="button"
            onClick={() => setShowPrototype(true)}
            className="w-full rounded-xl bg-emerald-500 px-6 py-4 text-lg font-semibold text-zinc-950 hover:bg-emerald-600 transition-colors"
          >
            UI-OS 2 原型
            <span className="block text-sm font-normal opacity-80">暗色运动风格 · 移动优先</span>
          </button>

          <a
            href="/"
            className="w-full rounded-xl bg-zinc-800 px-6 py-4 text-lg font-semibold text-zinc-50 hover:bg-zinc-700 transition-colors flex flex-col items-center justify-center"
          >
            主应用
            <span className="text-sm font-normal text-zinc-400">完整功能版本</span>
          </a>
        </div>

        <p className="text-center text-xs text-zinc-500">
          UI-OS 2 是视觉原型，不包含真实数据逻辑
        </p>
      </div>
    </div>
  );
};

// Mount preview app
const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <PreviewApp />
    </React.StrictMode>
  );
}
