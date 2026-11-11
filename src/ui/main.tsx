// Entry point: start React, load the font and styles, and (in the built app)
// register the service worker that lets GardenGuide open offline.
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/lato/latin-300.css';
import '@fontsource/lato/latin-400.css';
import '@fontsource/lato/latin-700.css';
import './styles.css';
import { App } from './App.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => { /* offline support is a bonus, not essential */ });
  });
}
// Ask the browser not to clear GardenGuide's storage when space runs low.
navigator.storage?.persist?.().catch(() => {});
