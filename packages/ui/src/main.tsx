import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ResearchModeProvider } from './context/ResearchMode';
import { UserProvider } from './context/UserContext';
import { DeviceUnlockProvider } from './context/DeviceUnlockContext';
import { injectWebOnlyScripts } from './utils/webScripts';
import { platform, isNativePlatform } from './utils/platform';
import './index.css';

// Web only: AdSense + Plausible. No-op inside the Capacitor native app.
injectWebOnlyScripts();

// iOS only: WebKit refuses the Web MIDI JavaScript API, so navigator.requestMIDIAccess
// is simply absent and the app's four MIDI files quietly do nothing. CoreMIDI works
// fine underneath — this installs the missing doorway over it.
//
// Android and the web keep the real API untouched: the shim declines to install if
// anything is already there, and is never reached on those platforms anyway. When
// WebKit eventually ships Web MIDI, delete this block and the shim file.
if (isNativePlatform && platform === 'ios') {
  void (async () => {
    const [{ registerPlugin }, { installWebMidiShim }] = await Promise.all([
      import('@capacitor/core'),
      import('./utils/webmidi-shim'),
    ]);
    installWebMidiShim(registerPlugin('CoreMidi'));
  })();
}

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
