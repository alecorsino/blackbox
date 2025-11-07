import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'BlackboxCLI',
      fileName: 'index',
      formats: ['es']
    },
    rollupOptions: {
      external: ['readline'],
      output: {
        banner: '#!/usr/bin/env node'
      }
    },
    target: 'node18',
    ssr: true
  },
  resolve: {
    alias: {
      '@blackbox/protocol': resolve(__dirname, '../protocol/src/index.ts')
    }
  }
});
