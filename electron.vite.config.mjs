import { defineConfig } from 'electron-vite';
import { resolve } from 'path';
import vue from '@vitejs/plugin-vue';
import Components from 'unplugin-vue-components/vite';
import Icons from 'unplugin-icons/vite';
import IconsResolver from 'unplugin-icons/resolver';
import { FileSystemIconLoader } from 'unplugin-icons/loaders';
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
      Components({
        resolvers: [
          IconsResolver({
            prefix: 'icon',
            customCollections: ['app'],
          }),
        ],
      }),
      Icons({
        compiler: 'vue3',
        customCollections: {
          app: FileSystemIconLoader(
            resolve(__dirname, 'src/renderer/assets/svg')
          ),
        },
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
