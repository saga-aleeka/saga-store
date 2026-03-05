import { defineConfig } from 'vite'

// Minimal Vite config without react-refresh plugin. For larger projects
// consider adding `@vitejs/plugin-react` once dependency versions are aligned.
export default defineConfig({
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'https://saga-store-theta.vercel.app',
        changeOrigin: true,
        secure: true
      }
    }
  }
})
