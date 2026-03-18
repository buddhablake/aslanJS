import type { EffectFn, EffectContext, DisposeFn, CauseGetter, CauseSetter, Cause, ElementTag, ElementProps, ElementChildren, ScopedCause } from "./types";

export const Fragment = Symbol('Fragment');

// Two separate tracking variables:
// - currentEffect: the currently executing effect (for signal subscriptions)
// - currentOwner: the current owner scope (for cleanup, context, child registration)
//
// Effects set both. Component scopes set only currentOwner.
// This prevents component-level signal reads from creating accidental
// subscriptions — only effects track causes.
let currentEffect: EffectContext | null = null;
let currentOwner: EffectContext | null = null;
let currentDisposables: DisposeFn[] | null = null;

export function createCause<T>(initial: T): Cause<T> {
    let value = initial;
    const subscribers = new Set<EffectContext>();

    const read: CauseGetter<T> = () => {
        if (currentEffect) {
            subscribers.add(currentEffect);
            currentEffect.subscriptions.push(subscribers);
        }
        return value;
    };

    const write: CauseSetter<T> = (newValue: T | ((prev: T) => T)) => {
        if (typeof newValue === "function") {
            value = (newValue as (prev: T) => T)(value);
        } else {
            value = newValue;
        }
        const snapshot = [...subscribers];
        snapshot.forEach((ctx) => ctx.execute());
    };

    return [read, write];
}

export function createEffect(fn: EffectFn): DisposeFn {
    const ctx: EffectContext = {
        fn,
        cleanups: [],
        subscriptions: [],
        childDisposables: [],
        parent: currentOwner,
        contexts: {},
        execute() {
            for (const cleanup of ctx.cleanups) cleanup();
            ctx.cleanups = [];

            for (const dispose of ctx.childDisposables) dispose();
            ctx.childDisposables = [];

            for (const subSet of ctx.subscriptions) subSet.delete(ctx);
            ctx.subscriptions = [];

            const prevEffect = currentEffect;
            const prevOwner = currentOwner;
            const prevDisposables = currentDisposables;

            currentEffect = ctx;
            currentOwner = ctx;
            currentDisposables = ctx.childDisposables;

            try {
                fn();
            } finally {
                currentEffect = prevEffect;
                currentOwner = prevOwner;
                currentDisposables = prevDisposables;
            }
        },
    };

    ctx.execute();

    const dispose: DisposeFn = () => {
        for (const cleanup of ctx.cleanups) cleanup();
        ctx.cleanups = [];
        for (const childDispose of ctx.childDisposables) childDispose();
        ctx.childDisposables = [];
        for (const subSet of ctx.subscriptions) subSet.delete(ctx);
        ctx.subscriptions = [];
    };

    if (currentDisposables) {
        currentDisposables.push(dispose);
    }

    return dispose;
}

export function onCleanup(fn: EffectFn): void {
    if (currentOwner) {
        currentOwner.cleanups.push(fn);
    }
}

// --- Component scoping ---
//
// createComponent is called by the compiled JSX for function components.
// It creates an owner scope (for cleanup, context, child registration)
// and runs the component within it. Component code does NOT track causes
// (currentEffect stays null) — only effects created inside the component do.
//
// Children are passed as a getter on the props object by the compiler.
// This means they evaluate lazily when the component accesses props.children,
// AFTER the component has set up any context (e.g., Provider).

function disposeScope(scope: EffectContext): DisposeFn {
    return () => {
        for (const cleanup of scope.cleanups) cleanup();
        scope.cleanups = [];
        for (const dispose of scope.childDisposables) dispose();
        scope.childDisposables = [];
        for (const subSet of scope.subscriptions) subSet.delete(scope);
        scope.subscriptions = [];
    };
}

export function createComponent(Comp: Function, props: Record<string, any>): Node {
    const prevEffect = currentEffect;
    const prevOwner = currentOwner;
    const prevDisposables = currentDisposables;

    const scope: EffectContext = {
        fn: () => {},
        cleanups: [],
        subscriptions: [],
        childDisposables: [],
        parent: prevOwner,
        contexts: {},
        execute: () => {},
    };

    currentEffect = null;
    currentOwner = scope;
    currentDisposables = scope.childDisposables;

    const result = Comp(props);

    currentEffect = prevEffect;
    currentOwner = prevOwner;
    currentDisposables = prevDisposables;

    if (prevDisposables) {
        prevDisposables.push(disposeScope(scope));
    }

    return result;
}

export function renderNode(
  tag: ElementTag,
  props: ElementProps,
  children: ElementChildren,
): Node {
  const el = tag === Fragment
    ? document.createDocumentFragment()
    : document.createElement(tag as string);

  if (props && el instanceof HTMLElement) {
    for (const [key, val] of Object.entries(props)) {

      // Event handlers (onClick, onInput, etc.) are callbacks, not causes.
      // Handle them first so the reactive check below doesn't wrap them.
      if (key.startsWith('on')) {
        el.addEventListener(key.slice(2).toLowerCase(), val);

      // If the value is a function, it's a cause accessor passed without
      // being called: <div class={color} />. Wrap in an effect so the
      // attribute updates when the cause changes.
      } else if (typeof val === 'function') {
        createEffect(() => {
          const resolved = val();
          if (key === 'className') {
            el.className = resolved;
          } else {
            el.setAttribute(key, resolved);
          }
        });

      // Static values — set once, no tracking needed
      } else if (key === 'className') {
        el.className = val;
      } else {
        el.setAttribute(key, val);
      }
    }
  }

  const flatChildren = Array.isArray(children) ? children.flat() : (children != null ? [children] : []);
  for (const child of flatChildren) {
    if (child == null || child === false) continue;

    // Cause accessor passed as child — reactive text node
    if (typeof child === 'function') {
      const textNode = document.createTextNode('');
      createEffect(() => {
        textNode.textContent = String(child());
      });
      el.appendChild(textNode);
    } else if (child instanceof Node) {
      el.appendChild(child);
    } else {
      el.appendChild(document.createTextNode(String(child)));
    }
  }

  return el;
}

// --- Scoped Context API ---

export function createScopedCause<T>(factory: () => T): ScopedCause<T> {
    const key = Symbol();

    // The consumer: walks up the owner tree to find the nearest
    // Provider that matches, returns its context value.
    const consume = (() => {
        let owner = currentOwner;
        while (owner) {
            if (key in owner.contexts) return owner.contexts[key] as T;
            owner = owner.parent;
        }
        throw new Error('No Provider found for this scoped cause');
    }) as unknown as ScopedCause<T>;

    // The Provider: runs the factory fresh and attaches the result
    // to the current scope. Does NOT destructure props — children
    // is a getter that must evaluate lazily (after context is set up).
    consume.Provider = (props: { children?: ElementChildren }): Node => {
        if (currentOwner) {
            currentOwner.contexts[key] = factory();
        }
        return renderNode(Fragment, null, props.children as ElementChildren);
    };

    return consume;
}

// Flattens nested Providers into a single wrapper.
// <Provide contexts={[useAuth, useTheme]}> is equivalent to
// <useAuth.Provider><useTheme.Provider>...</useTheme.Provider></useAuth.Provider>
export function Provide(props: { contexts: ScopedCause<any>[], children?: ElementChildren }): Node {
    // Build a chain of nested Providers. Children are only accessed
    // via getter at the innermost level, so all Providers have set up
    // their context before children evaluate.
    const wrap = (i: number): any => {
        if (i >= props.contexts.length) return props.children;
        return createComponent(props.contexts[i].Provider, {
            get children() { return wrap(i + 1); }
        });
    };
    const result = wrap(0);
    return result instanceof Node ? result : renderNode(Fragment, null, result);
}

export function getCurrentOwner(): EffectContext | null {
    return currentOwner;
}

export function runWithOwner<T>(
    owner: EffectContext | null,
    fn: () => T,
    disposables?: DisposeFn[]
): T {
    const prevEffect = currentEffect;
    const prevOwner = currentOwner;
    const prevDisposables = currentDisposables;

    currentEffect = null;
    currentOwner = owner;
    currentDisposables = disposables ?? (owner ? owner.childDisposables : null);

    try {
        return fn();
    } finally {
        currentEffect = prevEffect;
        currentOwner = prevOwner;
        currentDisposables = prevDisposables;
    }
}
