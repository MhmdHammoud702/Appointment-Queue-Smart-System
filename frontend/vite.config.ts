import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: ["patch-baghdad-mesa-however.trycloudflare.com"],
    proxy: {
      "/api": {
        target: "http://127.0.0.1:3000",
        changeOrigin: true,
      },
      "/socket.io": {
        target: "http://127.0.0.1:3000",
        changeOrigin: true,
        ws: true,
      },
    },
    watch: {
      ignored: ["**/node_modules/**", "**/.git/**", "**/.tsupgrader/**"],
    },
  },
});
