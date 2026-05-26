import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

// iPhone PWA 底部 safe-area 黑边兜底（配合 src/index.css 的 [data-safe-area-filler='bottom']）
// 注：尝试过用 body::after 伪元素实现，但 Tailwind v4 build 流程会把所有 ::after 规则
// 整段移除（dist 中 ::after 出现 0 次），因此改为渲染一个真实 DOM 元素。
// 在 React 挂载前注入，保证 SSR / 首屏 / 任何路由切换都覆盖到底部。
if (typeof document !== 'undefined' && !document.querySelector('[data-safe-area-filler="bottom"]')) {
  const safeAreaFiller = document.createElement('div');
  safeAreaFiller.setAttribute('data-safe-area-filler', 'bottom');
  safeAreaFiller.setAttribute('aria-hidden', 'true');
  document.body.appendChild(safeAreaFiller);
}

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element #root was not found.');
}

createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  // iOS Safari only polls service workers every 24h by default, so a user
  // can sit on a months-old IronPath build for days after a deploy. The
  // standalone PWA never visibly reloads, so the freshest fix can be live
  // on Vercel and still invisible on the phone. To work around this:
  //
  //   1. On registration, request an immediate update check and keep a
  //      handle to the registration so we can recheck later.
  //   2. Whenever the tab becomes visible again (foreground / back from
  //      app switcher), poke registration.update() so the SW fetches the
  //      latest sw.js + chunks.
  //   3. Once the new SW takes control (controllerchange), do a one-shot
  //      reload so the page swaps to the new entry chunk immediately
  //      rather than waiting for the next cold launch.
  const setupServiceWorker = async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      // Kick an immediate update check; harmless on first install.
      registration.update().catch(() => {});

      const recheck = () => {
        if (document.visibilityState !== 'visible') return;
        registration.update().catch(() => {});
      };
      document.addEventListener('visibilitychange', recheck);
      window.addEventListener('focus', recheck);

      let reloaded = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (reloaded) return;
        reloaded = true;
        window.location.reload();
      });
    } catch (error) {
      console.warn('IronPath service worker registration failed:', error);
    }
  };

  window.addEventListener('load', () => {
    void setupServiceWorker();
  });
}
