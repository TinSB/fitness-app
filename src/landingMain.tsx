import React from 'react';
import { createRoot } from 'react-dom/client';
import { LandingPage } from './landing/LandingPage';
import './landing.css';

const container = document.getElementById('root');

if (container) {
  createRoot(container).render(
    <React.StrictMode>
      <LandingPage />
    </React.StrictMode>,
  );
}
