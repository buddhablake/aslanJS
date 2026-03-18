import { transformAsync } from '@babel/core';
import type { Plugin } from 'vite';
import aslanBabelPlugin from './aslan-babel-plugin';

export default function aslanPlugin(): Plugin {
  return {
    name: 'vite-plugin-aslan',
    enforce: 'pre',

    async transform(code: string, id: string) {
      if (!/\.[jt]sx$/.test(id)) return null;

      const result = await transformAsync(code, {
        filename: id,
        plugins: [
          ['@babel/plugin-syntax-typescript', { isTSX: true }],
          aslanBabelPlugin,
        ],
        // Don't let Babel mess with modules — Vite handles that
        sourceType: 'module',
        sourceMaps: true,
      });

      if (!result || !result.code) return null;

      return {
        code: result.code,
        map: result.map,
      };
    }
  };
}
