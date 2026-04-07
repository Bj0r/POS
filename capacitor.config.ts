import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.ocmpc.pos',
  appName: 'POS',
  webDir: 'dist',
  server: {
    url: 'https://pos.sousounofreiren.io',
    cleartext: false
  },
  android: {
    allowMixedContent: false,
    backgroundColor: '#ffffff'
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#ffffff',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true
    }
  }
};

export default config;