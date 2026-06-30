import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../..');

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Compile the shared package from source so vite resolves its ESM named
      // exports (the CJS dist uses a dynamic `export *` barrel rollup can't read).
      '@workshopos/shared': resolve(repoRoot, 'packages/shared/src/index.ts'),
    },
  },
  server: {
    port: 5173,
    fs: { allow: [repoRoot] },
  },
});
