import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ResearchModeProvider } from './context/ResearchMode';
import { UserProvider } from './context/UserContext';
import { DeviceUnlockProvider } from './context/DeviceUnlockContext';
import { injectWebOnlyScripts } from './utils/webScripts';
import './index.css';

// Web only: AdSense + Plausible. No-op inside the Capacitor native app.
injectWebOnlyScripts();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <UserProvider>
      <DeviceUnlockProvider>
        <ResearchModeProvider>
          <App />
        </ResearchModeProvider>
      </DeviceUnlockProvider>
    </UserProvider>
  </React.StrictMode>,
);
