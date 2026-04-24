/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/setupTests.ts'],
    globals: true,
  },
  build: {
    rollupOptions: {
      onwarn(warning, warn) {
        // @nevware21/ts-async (transitive dep of applicationinsights-web) emits
        // misplaced /*#__PURE__*/ annotations that Rollup removes automatically.
        // Suppress the noise; the build output is correct.
        if (warning.code === 'INVALID_ANNOTATION' && warning.id?.includes('@nevware21')) return;
        warn(warning);
      },
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-fluent': ['@fluentui/react'],
          'vendor-appinsights': [
            '@microsoft/applicationinsights-web',
            '@microsoft/applicationinsights-react-js',
          ],
        },
      },
    },
  },
})
