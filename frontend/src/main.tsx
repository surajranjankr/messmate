import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/globals.css';
import App from './App';
import { initializeStorageIfEmpty } from './lib/storage';

// Initialize localStorage with seed data on first load
initializeStorageIfEmpty();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
