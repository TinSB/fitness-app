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
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((error) => {
      console.warn('IronPath service worker registration failed:', error);
    });
  });
}
