import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: {
    resolve: true,
    compilerOptions: {
      incremental: false
    }
  },
  clean: true,
  target: 'node18',
  platform: 'node',
  tsconfig: 'tsconfig.build.json',
  external: [
    '@google/earthengine',
    '@google-cloud/storage',
    '@modelcontextprotocol/sdk',
    'google-auth-library',
    'googleapis'
  ],
  noExternal: [],
  sourcemap: true,
  minify: false,
  splitting: false,
  shims: true,
  esbuildOptions(options) {
    options.mainFields = ['module', 'main'];
  }
});
