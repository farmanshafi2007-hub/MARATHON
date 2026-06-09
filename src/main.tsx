import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';

// Polyfill process and global for Node SDKs imported in the browser (e.g. @google/genai)
if (typeof window !== 'undefined') {
  if (typeof (window as any).global === 'undefined') {
    (window as any).global = window;
  }
  if (typeof (window as any).process === 'undefined') {
    (window as any).process = { env: {} };
  }
}


import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

