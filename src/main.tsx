import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { bootCatalogFromPath } from './lib/catalog';
import './styles/globals.css';

function initialPathname(): string {
  try {
    const stored = sessionStorage.getItem('pytyping:spa-path');
    if (stored) {
      return new URL(stored, window.location.origin).pathname;
    }
  } catch {
    /* private mode */
  }
  return window.location.pathname;
}

bootCatalogFromPath(initialPathname());

const rootElement = document.getElementById('root');
if (!rootElement) {
  document.body.innerHTML =
    '<p style="font-family:system-ui,sans-serif;padding:2rem;color:#333">PyTyping could not start: missing #root element.</p>';
  throw new Error('Root element #root not found');
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
