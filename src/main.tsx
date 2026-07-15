import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import ResilienceErrorBoundary from './components/ResilienceErrorBoundary';
import './index.css';
import { logger } from './core/utils/systemLogger';

// Initial boot log
logger.addLog('system', 'Application Booting...', null, 'Bootloader');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ResilienceErrorBoundary>
      <App />
    </ResilienceErrorBoundary>
  </StrictMode>,
);
