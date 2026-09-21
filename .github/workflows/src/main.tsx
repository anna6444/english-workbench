import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles/index.css';

const el = document.getElementById('root');
if (!el) {
  throw new Error('找不到 #root 挂载点，请检查 index.html。');
}

createRoot(el).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
