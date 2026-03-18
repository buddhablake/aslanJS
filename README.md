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

## How reactivity works

The whole system is built on three primitives: `createSignal`, `createEffect`, and a global tracking variable called `currentEffect`. Here's how data flows through the framework from state creation to DOM update.

### Signals: reactive state containers

A signal is a closure over a value and a subscriber set:

```ts
function createSignal<T>(initial: T): [getter, setter] {
    let value = initial;
    const subscribers = new Set<Effect>();

    const read = () => {
        if (currentEffect) subscribers.add(currentEffect);  // auto-track
        return value;
    };

    const write = (newValue) => {
        value = newValue;
        subscribers.forEach(effect => effect());  // notify
    };

    return [read, write];
}
```

The getter is a function, not a property. Calling `count()` reads the value. Calling `setCount(1)` writes it. This is what makes dependency tracking possible — we can intercept reads.

### Effects: the subscription mechanism

```ts
let currentEffect: Effect | null = null;

function createEffect(effect: Effect) {
    currentEffect = effect;   // 1. register as active
    effect();                 // 2. run (any signal reads will capture this effect)
    currentEffect = null;     // 3. deregister
}
```

When an effect runs, it sets itself as `currentEffect`. Any signal that gets read during that execution adds the effect to its subscriber set. No dependency arrays, no explicit declarations — dependencies are tracked automatically by running the code.

### The data flow

Here's the full lifecycle when a user clicks a button that calls `setCount(c => c + 1)`:

```
1. setCount(c => c + 1)
   └─ Signal setter fires
      └─ Updates value in closure: 0 → 1
      └─ Iterates subscriber set, calls each effect

2. Effect re-executes
   └─ Reads count() → gets new value (1)
   └─ Re-registers itself as a subscriber (idempotent, it's a Set)
   └─ Updates textNode.textContent = "1"

3. Browser repaints
   └─ DOM node was mutated directly, no diffing needed
```

### How JSX connects to reactivity

When you write `<p>Count: {count}</p>`, the JSX compiler turns `{count}` into a child argument passed to `createElement`. Since `count` is a function (a signal getter), `createElement` detects it and wraps it in an effect:

```ts
if (typeof child === 'function') {
    const textNode = document.createTextNode('');
    createEffect(() => {
        textNode.textContent = String(child());  // reads signal, subscribes
    });
    el.appendChild(textNode);
}
```

This is the bridge between signals and the DOM. The effect reads the signal (establishing a subscription), writes to a text node, and re-runs whenever the signal changes.

### Concrete walkthrough

```tsx
function Counter() {
    const [count, setCount] = createSignal(0);
    return (
        <div>
            <p>{count}</p>
            <button onClick={() => setCount(c => c + 1)}>+1</button>
        </div>
    );
}
```

**On mount:**
1. `createSignal(0)` — creates value closure (`0`) and empty subscriber set
2. JSX renders `<p>{count}</p>` — `createElement` sees `count` is a function
3. Creates a text node, wraps `count()` in `createEffect`
4. Effect runs: sets `currentEffect`, calls `count()`, signal's getter adds effect to its subscribers, text node gets `"0"`
5. `currentEffect` cleared. DOM is built. Subscriber set: `{effect}`

**On click:**
1. `setCount(c => c + 1)` — setter updates value to `1`
2. Setter iterates subscribers, calls the effect
3. Effect re-runs: `count()` returns `1`, text node updates to `"1"`
4. Browser repaints that text node

### Routing uses the same pattern

The router is just another signal + effect:

```ts
const [currentPath, setCurrentPath] = createSignal(window.location.pathname);

function Router(routes: Route[]): HTMLElement {
    const container = document.createElement('div');
    createEffect(() => {
        const path = currentPath();          // subscribe to path changes
        const match = routes.find(r => r.path === path);
        container.innerHTML = '';            // clear old view
        container.appendChild(match.component());  // render new view
    });
    return container;
}
```

Calling `navigate("/about")` updates the `currentPath` signal, which triggers the router's effect, which swaps out the DOM subtree. Same mechanism as a counter — just applied to navigation.

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
