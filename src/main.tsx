import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/lobster/400.css';
import '@fontsource/pt-sans/400.css';
import '@fontsource/pt-sans/700.css';
import { App } from './app/App.tsx';
import './ui/styles/global.scss';

const root = document.getElementById('root');
if (!root) throw new Error('Root element #root not found');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
