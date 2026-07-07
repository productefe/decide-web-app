import type { CapacitorConfig } from "@capacitor/cli";

const serverUrl = process.env.CAPACITOR_SERVER_URL;

const config: CapacitorConfig = {
  appId: "com.productefe.decide",
  appName: "DECIDE",
  webDir: "public",
  ...(serverUrl
    ? {
        server: {
          url: serverUrl,
          cleartext: false,
        },
      }
    : {}),
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      backgroundColor: "#F5F0E6",
      showSpinner: false,
    },
    StatusBar: {
      style: "LIGHT",
      backgroundColor: "#F5F0E6",
    },
  },
};

export default config;
