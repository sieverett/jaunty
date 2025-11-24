import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Global error handlers for debugging
window.addEventListener('unhandledrejection', (event) => {
  console.error('[GLOBAL] Unhandled promise rejection:', event.reason);
  console.error('[GLOBAL] Promise:', event.promise);
});

window.addEventListener('error', (event) => {
  console.error('[GLOBAL] Unhandled error:', event.error);
  console.error('[GLOBAL] Message:', event.message);
  console.error('[GLOBAL] Source:', event.filename, 'Line:', event.lineno);
});

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);