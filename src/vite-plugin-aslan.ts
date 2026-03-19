// transformAsync takes a string of source code and runs Babel plugins over it.
// It returns the transformed code + a source map. It's async because Babel
// supports async plugins (though ours is synchronous).
import { transformAsync } from '@babel/core';

// Vite's Plugin type — this is the interface every Vite plugin must conform to.
// It defines hooks like `transform`, `resolveId`, `load`, etc. that Vite calls
// at different stages of its build pipeline.
import type { Plugin } from 'vite';

// Our custom Babel plugin that converts JSX syntax into Aslan runtime calls.
// e.g. <div class="foo"> becomes _$aslan.renderNode("div", { class: "foo" })
import aslanBabelPlugin from './aslan-babel-plugin';

// This function returns a Vite plugin object. Users call it in their vite.config.ts:
//   import aslanPlugin from './vite-plugin-aslan'
//   export default { plugins: [aslanPlugin()] }
export default function aslanPlugin(): Plugin {
  return {
    // Every Vite plugin needs a unique name — used in error messages and debug logs.
    name: 'vite-plugin-aslan',

    // 'pre' means this plugin runs BEFORE other plugins (like Vite's built-in
    // esbuild transform). We need this because we must transform JSX into
    // function calls before esbuild tries to handle it — esbuild would
    // otherwise transform JSX into React.createElement calls, which isn't
    // what we want.
    enforce: 'pre',

    // `transform` is a Vite hook called for every file in the project.
    // - `code`: the raw source code of the file as a string
    // - `id`: the absolute file path (e.g. "/Users/you/project/src/App.tsx")
    // Returning null means "I don't want to transform this file, skip it."
    // Returning { code, map } means "here's the transformed version."
    async transform(code: string, id: string) {
      // Only process .jsx and .tsx files. The regex [jt]sx matches both.
      // All other files (plain .ts, .js, .css, etc.) pass through untouched.
      if (!/\.[jt]sx$/.test(id)) return null;

      // Hand the source code to Babel for transformation.
      const result = await transformAsync(code, {
        // `filename` tells Babel which file it's processing — used for error
        // messages and source map generation so stack traces point to the
        // right file.
        filename: id,

        plugins: [
          // This plugin teaches Babel how to PARSE TypeScript + JSX syntax.
          // It doesn't transform anything — it just lets Babel understand the
          // syntax so our plugin can work with the AST (abstract syntax tree).
          // `isTSX: true` enables both TypeScript and JSX parsing together.
          ['@babel/plugin-syntax-typescript', { isTSX: true }],

          // Our custom plugin that actually transforms the JSX nodes in the AST
          // into _$aslan.renderNode() and _$aslan.createComponent() calls.
          aslanBabelPlugin,
        ],

        // Tell Babel the source code uses ES modules (import/export).
        // Without this, Babel might try to convert imports to require() calls.
        // We don't want that — Vite handles module resolution and bundling
        // itself, so Babel should leave import/export statements alone.
        sourceType: 'module',

        // Generate source maps so that when you debug in the browser, the
        // dev tools show your original JSX source code, not the transformed
        // renderNode() calls.
        sourceMaps: true,
      });

      // If Babel returned nothing (e.g. the file was empty or had no JSX),
      // return null to tell Vite there's nothing to change.
      if (!result || !result.code) return null;

      // Return the transformed code and source map back to Vite.
      // Vite will continue its pipeline with this new code — resolving
      // imports, bundling, etc.
      return {
        code: result.code,
        map: result.map,
      };
    }
  };
}
