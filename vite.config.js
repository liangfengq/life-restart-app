import { defineConfig } from 'vite';

// base: './' 让构建产物用相对路径，Capacitor WebView（file:// 或 assets）下资源不 404
export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    assetsInlineLimit: 0
  }
});
