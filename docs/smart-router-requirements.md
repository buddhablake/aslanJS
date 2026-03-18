# Smart Router: Layout Persistence Across Route Changes

## Problem

The current Router (`src/aslan-router.ts`) destroys and rebuilds the entire component tree on every navigation:

```ts
container.innerHTML = '';              // destroy everything
container.appendChild(match.component()); // rebuild from scratch
```

This means layouts, their Providers, and all scoped context state are destroyed on every route change — even when the old and new routes share the same layout. A counter incremented on `/` resets to `0` when navigating to `/about` and back, because the `<Provide>` in the shared layout was destroyed and recreated.

React Router, SolidJS Router, and other frameworks solve this by detecting shared layouts between routes and only re-rendering the portion of the tree that actually changed.

## Current Architecture

### File structure

```
views/
  layout.tsx              → root layout (wraps ALL routes)
  view.tsx                → / (home)
  about/
    view.tsx              → /about
    layout.tsx            → nested layout (wraps /about/* routes)
  cheese-samples/
    view.tsx              → /cheese-samples
```

### How routes are built today

`buildRoutes()` in `src/aslan-router.ts` pairs each view with its layout chain using `collectLayouts()`. The layout chain is ordered root → deepest. For `/about`, the chain is `[views/layout.tsx, views/about/layout.tsx]`.

Each route's `component` function builds the full tree from scratch:

```ts
const component = () => {
  let content: any = () => createComponent(mod.default, {});
  for (let i = matchedLayouts.length - 1; i >= 0; i--) {
    const layout = matchedLayouts[i];
    const inner = content;
    content = () => createComponent(layout.default, {
      get children() { return inner(); }
    });
  }
  return content();
};
```

### How the Router renders today

```ts
export function Router(routes: Route[]): HTMLElement {
  const container = document.createElement('div');
  createEffect(() => {
    const path = currentPath();
    const match = routes.find(r => r.path === path);
    container.innerHTML = '';
    if (match) {
      container.appendChild(match.component());
    }
  });
  return container;
}
```

The Router's `createEffect` subscribes to `currentPath`. On change, it nukes `container` and rebuilds everything. Child effects from the previous render are disposed via the owner tree (this works correctly).

## Requirements

### 1. Shared layouts must persist across route changes

When navigating between two routes that share layouts, those shared layouts must NOT be destroyed and recreated. Only the portion of the tree that differs should be swapped.

**Example:** Navigating from `/` to `/cheese-samples`:
- Both share `views/layout.tsx` (root layout)
- The root layout and its `<Provide>` must stay mounted
- Only the view content inside the layout should swap (Home → CheeseSamples)
- Scoped context state provided by the root layout's `<Provide>` must survive

**Example:** Navigating from `/` to `/about`:
- Both share `views/layout.tsx` (root layout)
- `/about` has an additional `views/about/layout.tsx`
- The root layout persists
- `views/about/layout.tsx` is created fresh (it wasn't mounted before)
- The view swaps to the about view

**Example:** Navigating from `/about` to `/`:
- Root layout persists
- `views/about/layout.tsx` is destroyed (it's no longer needed)
- The view swaps to the home view

### 2. Layout disposal must be correct

When a layout is no longer shared (navigating away from a nested layout), it must be properly disposed:
- Its `onCleanup` callbacks must run
- Its child effects must be disposed
- Its scoped context values must be garbage-collectible
- Its DOM nodes must be removed

The existing owner tree disposal system handles this — the requirement is that the Router triggers disposal correctly for removed layouts while preserving shared ones.

### 3. View content must always be fresh

Views (the `view.tsx` files) are always rebuilt on navigation, even if the URL is the same path. Views are the leaf content — they don't persist.

### 4. The `navigate()` function and `popstate` handler must work unchanged

The existing `navigate(path)` function and `window.addEventListener('popstate', ...)` update `currentPath`. The Router's effect re-runs. This contract stays the same — the change is in what the Router does when it re-runs.

### 5. `buildRoutes` must expose layout chains for comparison

The Router needs to compare the old route's layout chain with the new route's layout chain to determine the common prefix. `buildRoutes` should return enough information for the Router to do this comparison.

Currently, each route's `component` is an opaque function. The Router can't see which layouts a route uses. The route structure needs to expose the layout chain.

## Design Guidance

### Route structure change

Instead of routes having an opaque `component()` function, each route should expose its layout chain and view separately:

```ts
interface Route {
  path: string;
  layouts: Module[];  // ordered root → deepest
  view: Module;       // the view.tsx module
}
```

### Router diff algorithm

On navigation, the Router should:

1. Find the matched route for the new path
2. Compare the new route's `layouts` array with the previous route's `layouts` array
3. Find the common prefix (shared layouts) by comparing module references
4. Dispose layouts that are no longer needed (from the divergence point onward in the old chain)
5. Create new layouts that are needed (from the divergence point onward in the new chain)
6. Swap the view content inside the innermost layout

### DOM structure

The Router should maintain a persistent DOM structure for mounted layouts. One approach:

- Each layout gets a stable container element (a DOM node that persists)
- The layout renders into its container
- The view renders into a slot inside the innermost layout
- On navigation, only the affected containers are swapped

### Layout rendering with lazy children

Layouts receive `children` as a getter on the props object (via the Babel plugin's `createComponent` call, or via manual `get children()` in the router). **Layouts that use `<Provide>` must NOT destructure the children prop** — they access `props.children` in JSX so children evaluate after context is set up. This is a documented convention, same as SolidJS.

### Effect ownership

Each layout's component scope (created by `createComponent`) must be a child of the Router's effect or the parent layout's scope. When a layout is disposed, its entire subtree (child layouts, view, effects, cleanups) is disposed via the existing owner tree.

When a layout persists across navigation, its scope stays alive. Only the view portion (the innermost `children`) is disposed and recreated.

## Files to Modify

- `src/aslan-router.ts` — Main changes: `Route` interface, `buildRoutes`, `Router`
- `src/aslan.ts` — May need a way to dispose a specific child scope without disposing the parent (for swapping view content inside a persisted layout)

## Files NOT to Modify

- `src/aslan-babel-plugin.ts` — No changes needed
- `src/vite-plugin-aslan.ts` — No changes needed
- `src/types.ts` — No changes needed unless new types are required for the Route interface
- Component files — No changes needed
- View files — No changes needed
- Layout files — No changes needed

## Verification

1. `npx vite build` compiles without errors
2. `npx vite dev` — app loads and all routes render
3. Navigate `/` → `/cheese-samples` → `/`: counter state in the shared root layout's Provider persists across all three navigations
4. Navigate `/` → `/about`: root layout persists, about layout mounts fresh
5. Navigate `/about` → `/`: root layout persists, about layout is disposed (onCleanup callbacks fire)
6. Browser back/forward buttons work correctly
7. Direct URL entry (page refresh) works correctly
8. 404 page still works for unknown routes
9. No memory leaks: navigating repeatedly between routes should not accumulate orphaned effects or DOM nodes

## What NOT to Do

- **Do not** add a virtual DOM or diffing algorithm. The Router should compare layout module references (identity check), not DOM trees.
- **Do not** change how layouts or views are authored. The file-based routing convention stays the same.
- **Do not** change the Babel plugin or JSX compilation. The compiler output is correct as-is.
- **Do not** change `createComponent`, `createEffect`, `createCause`, or `onCleanup`. The reactive primitives are correct.
- **Do not** cache or memoize view components. Views are always fresh on navigation.
