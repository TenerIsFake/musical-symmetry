import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'us.tendrid.chrometria',
  appName: 'Chrometria',
  webDir: 'dist',
  android: {
    backgroundColor: '#111827',
  },
  server: {
    androidScheme: 'https',
  },
};

export default config;
