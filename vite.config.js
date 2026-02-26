import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/TermNova/',
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
})
