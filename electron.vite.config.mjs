import { defineConfig } from 'electron-vite';
import { resolve } from 'path';
import vue from '@vitejs/plugin-vue';
import { createSvgIconsPlugin } from 'vite-plugin-svg-icons';
import pkg from './package.json';

export default defineConfig({
  // dev specific config
  main: {
    // ...
  },
  preload: {
    // ...
    define: {
      'process.env.VUE_APP_VERSION': JSON.stringify(pkg.version),
    },
  },
  renderer: {
    // ...
    lib: {
      entry: resolve(__dirname, 'src/renderer/main.js'),
    },
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src/renderer'),
        components: resolve(__dirname, 'src/renderer/components'),
      },
    },
    plugins: [
      vue(),
      createSvgIconsPlugin({
        iconDirs: [resolve(__dirname, 'src/renderer/assets/svg')],
        symbolId: 'icon-[name]',
      }),
    ],
    css: {
      preprocessorOptions: {
        scss: {
          additionalData: `@use "@/assets/scss/variable" as *;`,
        },
      },
    },
  },
});
