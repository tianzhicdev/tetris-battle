import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // Ensure compatibility with Capacitor
    target: 'es2015',
    // Use relative paths for assets
    assetsDir: 'assets',
  },
  // Set base to empty string for relative paths (works with Capacitor)
  base: '',
})
