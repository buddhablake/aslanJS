# Roadmap

Features and improvements to consider. Roughly ordered by impact.

## Routing
- [ ] Dynamic route parameters (`/user/:id`)
- [ ] Query string parsing and access
- [ ] 404 catch-all view (`views/404.tsx` convention)
- [ ] Route guards / middleware (auth checks, redirects)
- [ ] Lazy route loading (drop `eager: true` from glob)
- [ ] Scroll restoration on navigation
- [ ] Nested route outlets

## Reactivity
- [ ] Computed/derived signals (`createComputed`)
- [ ] Effect cleanup functions (return a teardown from effects)
- [ ] Batched signal updates (avoid cascading re-renders)
- [ ] `onMount` / `onUnmount` lifecycle hooks

## Components
- [ ] Fragment support in `createElement` (currently creates a `<fragment>` DOM node)
- [ ] Error boundaries
- [ ] Context / provider pattern for shared state
- [ ] Ref support for direct DOM access

## DX
- [ ] Dev-mode warnings (duplicate routes, missing default exports, etc.)
- [ ] `dev` and `build` scripts in package.json
- [ ] Linter / formatter config
- [ ] Test setup and basic test suite for core primitives

## Performance
- [ ] Lazy route loading via async `import.meta.glob`
- [ ] Signal update batching / microtask scheduling
- [ ] Surgical DOM updates instead of full container replacement on route change
