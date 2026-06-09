import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    // For local dev (npm run dev) alongside the API server (node server.cjs).
    proxy: { "/api": "http://localhost:3000" },
  },
});
