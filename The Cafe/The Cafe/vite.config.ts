import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [
    react(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client", "src"),
      "@shared": path.resolve(__dirname, "shared"),
      "@assets": path.resolve(__dirname, "attached_assets"),
    },
  },
  root: path.resolve(__dirname, "client"),
  build: {
    outDir: path.resolve(__dirname, "dist/public"),
    emptyOutDir: true,
    sourcemap: false,
    minify: 'terser',
    target: 'esnext',
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, "client", "index.html"),
      },
      output: {
        // Let Vite handle automatic chunking - NO manual chunks to avoid duplication
        // Vite's automatic splitting ensures React is singleton
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5000,
    proxy: {
      // Proxy frontend API requests to the backend dev server.
      // Start the backend with `npm run dev` (it listens on port 5000).
      "/api": {
        target: "http://localhost:5000",
        changeOrigin: true,
        secure: false,
      },
    },
    fs: {
      // Keep strict but allow access to the project root (parent of `client`)
      // so Vite can serve optimized deps from the repository `node_modules`.
      strict: true,
      // Allow the repo root (The Cafe folder) so `node_modules/.vite` can be read
      // when the Vite root is set to `client`.
      allow: [path.resolve(__dirname)],
      deny: ["**/.*"],
    },
  },
});
