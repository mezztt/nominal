import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Nominal · by Mezztt
export default defineConfig({
  plugins: [react()],
  server: { port: 5180 },
  preview: { port: 5180 },
})
