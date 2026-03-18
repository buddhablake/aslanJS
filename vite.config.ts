import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import aslanPlugin from './src/vite-plugin-aslan';

export default defineConfig({
  plugins: [
    aslanPlugin(),
    tailwindcss(),
  ],
  resolve: {
    tsconfigPaths: true,
  },
});
