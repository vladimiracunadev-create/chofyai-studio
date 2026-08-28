/**
 * main.tsx — punto de montaje del frontend.
 *
 * Monta `App` sobre el elemento `#root` de `index.html`. `StrictMode` está
 * activo a propósito: en desarrollo ejecuta los efectos dos veces, lo que hace
 * aflorar suscripciones mal limpiadas — algo importante en esta aplicación, que
 * mantiene varios `setInterval` y varios `listen()` de Tauri.
 *
 * Documentación relacionada: `docs/system-documentation/04-code-map.md`.
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
