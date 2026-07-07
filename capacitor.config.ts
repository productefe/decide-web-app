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
      backgroundColor: "#F7F2E8",
      showSpinner: false,
    },
    StatusBar: {
      style: "LIGHT",
      backgroundColor: "#F7F2E8",
    },
  },
};

export default config;
