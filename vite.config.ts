import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8787',
    },
  },
  build: {
    outDir: 'dist/client',
    emptyOutDir: true,
  },
  test: {
    globals: true,
    environment: 'node',
    setupFiles: './vitest.setup.ts',
    include: ['server/**/*.test.ts', 'src/**/*.test.tsx'],
  },
});
