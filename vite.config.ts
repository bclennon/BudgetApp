/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: '/BudgetApp/',
  plugins: [react()],
  test: {
    environment: 'node',
  },
})
