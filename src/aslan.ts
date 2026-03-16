import type { EffectFn, EffectContext, DisposeFn, SignalGetter, SignalSetter, Signal, ElementTag, ElementProps, ElementChildren } from "./types";

export const Fragment = Symbol('Fragment');

let currentEffect: EffectContext | null = null;
let currentDisposables: DisposeFn[] | null = null;

export function createSignal<T>(initial: T): Signal<T> {
    let value = initial;
    const subscribers = new Set<EffectContext>();

    const read: SignalGetter<T> = () => {
        if (currentEffect) {
            subscribers.add(currentEffect);
            currentEffect.subscriptions.push(subscribers);
        }
        return value;
    };

    const write: SignalSetter<T> = (newValue: T | ((prev: T) => T)) => {
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
        execute() {
            // Run cleanup callbacks from previous run
            for (const cleanup of ctx.cleanups) cleanup();
            ctx.cleanups = [];

            // Dispose child effects from previous run
            for (const dispose of ctx.childDisposables) dispose();
            ctx.childDisposables = [];

            // Remove self from all signal subscriber sets
            for (const subSet of ctx.subscriptions) subSet.delete(ctx);
            ctx.subscriptions = [];

            // Save parent context
            const prevEffect = currentEffect;
            const prevDisposables = currentDisposables;

            // Set up fresh tracking
            currentEffect = ctx;
            currentDisposables = ctx.childDisposables;

            try {
                fn();
            } finally {
                // Restore parent context
                currentEffect = prevEffect;
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

    // Register with parent effect's disposables
    if (currentDisposables) {
        currentDisposables.push(dispose);
    }

    return dispose;
}

export function onCleanup(fn: EffectFn): void {
    if (currentEffect) {
        currentEffect.cleanups.push(fn);
    }
}

export function renderNode(
  tag: ElementTag,
  props: ElementProps,
  children: ElementChildren,
): Node {
  if (typeof tag === 'function') {
    return tag({ ...props, children });
  }

  const el = tag === Fragment
    ? document.createDocumentFragment()
    : document.createElement(tag as string);

  if (props && el instanceof HTMLElement) {
    for (const [key, val] of Object.entries(props)) {
      if (key.startsWith('on')) {
        el.addEventListener(key.slice(2).toLowerCase(), val);
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
