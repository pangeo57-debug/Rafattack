import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.surplo.app",
  appName: "Surplo",
  webDir: "public",
  // Loads the live deployed Next.js app inside the native shell instead of
  // bundling static files, since the app needs a real server (API routes,
  // auth, Postgres). Update this once you have your production Vercel URL.
  server: {
    url: "https://surplo.vercel.app",
    cleartext: false,
  },
  ios: {
    contentInset: "always",
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: false,
      backgroundColor: "#4f46e5",
    },
  },
};

export default config;
