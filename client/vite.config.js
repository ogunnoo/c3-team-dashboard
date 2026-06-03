import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5188,
    strictPort: true,
    proxy: {
      // In local dev, proxy targets API to the Netlify dev server if running.
      "/api": "http://localhost:8888",
    },
  },
});
