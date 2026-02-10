import { defineConfig } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    assetsInlineLimit: 0, // Отключаем inline для всех assets - копируем файлы
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'src/js/main.js')
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js',
        assetFileNames: (assetInfo) => {
          // Для изображений создаем папку assets/
          if (assetInfo.name.match(/\.(png|jpe?g|svg|gif|webp)$/i)) {
            return 'assets/[name].[ext]';
          }
          // Для CSS оставляем в корне dist/
          return '[name].[ext]';
        }
      }
    },
    minify: 'terser',
    sourcemap: true
  }
});
