import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'us.tendrid.chrometria',
  appName: 'Chrometria',
  webDir: 'dist',
  android: {
    backgroundColor: '#111827',
  },
  ios: {
    backgroundColor: '#111827',
    // The app is a full-screen canvas; never inset for the keyboard/scroll view.
    contentInset: 'never',
  },
  server: {
    androidScheme: 'https',
  },
};

export default config;
