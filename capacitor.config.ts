import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.obsidiansound.player",
  appName: "LAWLIET",
  webDir: "dist/capacitor",
  android: { backgroundColor: "#08090B" },
  plugins: {
    CapacitorSQLite: {
      androidIsEncryption: false,
    },
  },
};

export default config;
