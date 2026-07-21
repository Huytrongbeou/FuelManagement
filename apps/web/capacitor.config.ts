import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Capacitor packaging for the VNPT Fuel Management web app.
 *
 * The built web assets (dist/) are bundled INTO the app, so it launches instantly and works
 * offline for anything already cached — it is not a thin shell pointing at a URL. Only API
 * calls go to the server, using the domain baked in at build time via VITE_API_URL.
 *
 * IMPORTANT: VITE_API_URL must be a public HTTPS URL with a certificate from a trusted CA.
 * `localhost` resolves to the phone itself inside the app, and a self-signed certificate is
 * rejected outright by both Android and iOS webviews.
 */
const config: CapacitorConfig = {
  appId: 'vn.vnpt.fuelmanagement',
  appName: 'VNPT Quản lý nhiên liệu',
  webDir: 'dist',
  android: {
    // The webview serves the app from https://localhost, so calling an http:// API counts as
    // mixed content and Android blocks the request outright (it surfaces as "Failed to fetch").
    // Enabled so a debug build can reach an http:// gateway on the LAN during testing.
    // In production VITE_API_URL is https://, where no mixed-content request ever occurs and
    // this flag has no effect.
    allowMixedContent: true,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1000,
      backgroundColor: '#0c2340',
      showSpinner: false,
    },
  },
};

export default config;
