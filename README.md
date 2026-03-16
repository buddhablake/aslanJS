# Aslan.js

A small, signal-based JavaScript framework. This is a learning project — I'm building it to understand how frameworks work under the hood. It is not production-ready and probably shouldn't be used for anything real. But if you want to poke around or build a toy app with it, here's how it works.

## What's in the box

**Reactivity** — Signals and effects. That's it. No virtual DOM, no diffing. Signals hold values, effects run when those values change, and DOM updates happen directly.

```tsx
import { createSignal, createEffect } from '@/aslan';

const [count, setCount] = createSignal(0);

createEffect(() => {
  console.log('Count is now:', count());
});

setCount(1);       // logs: Count is now: 1
setCount(c => c + 1); // logs: Count is now: 2
```

**JSX** — A custom JSX runtime so you can write components. It outputs real DOM nodes, not a virtual tree.

```tsx
function Counter() {
  const [count, setCount] = createSignal(0);

  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={() => setCount(c => c + 1)}>+1</button>
    </div>
  );
}
```

**File-based routing** — Drop a `view.tsx` in the `views/` directory and it becomes a route. The path comes from the folder name, not the file name.

```
views/
  layout.tsx              → wraps all views
  view.tsx                → /
  about/
    view.tsx              → /about
    layout.tsx            → wraps /about/* views
  cheese-samples/
    view.tsx              → /cheese-samples
```

**Layouts** — Put a `layout.tsx` next to your views and it automatically wraps them. Layouts nest from root down. Views never need to import their layout.

## Getting started

```bash
npm install
npx vite
```

## Project structure

```
main.tsx              → app entry point
views/                → routes (view.tsx) and layouts (layout.tsx)
components/           → shared components
src/
  aslan.ts            → core: signals, effects, createElement
  aslan-router.ts     → router, Link, navigate, buildRoutes
  jsx-runtime.ts      → JSX runtime (production)
  jsx-dev-runtime.ts  → JSX runtime (development)
  types.ts            → shared types
  index.css           → Tailwind CSS entry
```

## Known limitations

This framework is missing a lot. Some notable gaps:

- No dynamic route params (`/user/:id` won't work)
- No effect cleanup — subscriptions and event listeners can leak
- No computed/derived signals
- No error boundaries
- No SSR or hydration
- No async support in effects
- Signal changes trigger effects synchronously with no batching
- Route changes replace the entire DOM subtree (no diffing)
- All routes are eagerly loaded at startup
- Tied to Vite (uses `import.meta.glob` for route discovery)

## Why "Aslan"

Because every framework needs a name, and this one's a lion that's still learning to roar.
