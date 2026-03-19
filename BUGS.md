# Aslan.js Bugs

## Open

### 1. Whitespace between JSX expressions is stripped

Adjacent text and expressions lose their spacing:

```tsx
// Expected: "2 items left"
// Actual:   "2itemsleft"
<span>{() => count()} {() => count() === 1 ? 'item' : 'items'} left</span>
```

**Root cause:** The Babel plugin's `transformNode` strips whitespace from `JSXText` nodes — `node.value.replace(/\n\s*/g, ' ').trim()` trims each text segment independently. A space-only text node between two expression containers gets trimmed to empty and discarded.

**Workaround:** Combine into a single template literal expression:

```tsx
<span>{() => `${count()} ${count() === 1 ? 'item' : 'items'} left`}</span>
```

**Fix:** A `JSXText` node that is only whitespace and sits between two sibling nodes should emit `" "` instead of being discarded.

**Location:** `src/aslan-babel-plugin.ts`, `transformNode`, `JSXText` handling (~line 205).

## Fixed

### 2. Dynamic class props on HTML elements got double-wrapped

When writing an arrow function for `class`/`className` on an HTML element, the compiler wrapped it again, producing `() => () => expr`.

**Fix applied:** Added `&& !t.isArrowFunctionExpression(value)` to the wrapping condition in `buildPropsObject` (~line 346). The compiler now skips wrapping values that are already arrow functions.

**Additionally:** The compiler now normalizes `class` → `className` for HTML elements so the runtime always uses the fast `el.className = val` path. Users can write either `class` or `className` in JSX — both produce `className` in the compiled output.

**Location:** `src/aslan-babel-plugin.ts`, `buildPropsObject`.
