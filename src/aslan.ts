import type { EffectFn, EffectContext, DisposeFn, SignalGetter, SignalSetter, Signal, ElementTag, ElementProps, ElementChildren } from "./types";

export const Fragment = Symbol('Fragment');

let currentEffect: EffectContext | null = null;

export function createSignal<T>(initial: T): Signal<T> {
  let value = initial;
  const subscribers = new Set<EffectContext>();

  const read: SignalGetter<T> = () => {
    if (currentEffect) {
      // this is how we create bi-directional links between signals and effects
      // Here we are saying this is an effect that is going to need to re-run when this signal changes, so we add it to the list of subscribers for this signal.
      subscribers.add(currentEffect);
      // Here we saying that this effect is subscribed to the signal so it has awareness of all signals it is subscribed to, so we add the signal's subscriber list to the effect's list of subscriptions. This way when it comes time for cleanup, we can easily remove the effect from all the signals it is subscribed to.
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
    execute() {
      // Run user-registered cleanup callbacks (e.g. clearInterval)
      for (const cleanup of ctx.cleanups) cleanup();
      ctx.cleanups = [];
      // Unsubscribe from all signals
      for (const sub of ctx.subscriptions) {
        sub.delete(ctx);
      }
      ctx.subscriptions = [];
      // Dispose all child effects
      for (const child of ctx.childDisposables) {
        child();
      }
      ctx.childDisposables = [];
      // Save/restore parent context for nesting
      const prevEffect = currentEffect;
      currentEffect = ctx;
      fn();
      currentEffect = prevEffect;
    },
    subscriptions: [],
    childDisposables: [],
  };

  ctx.execute();

  const dispose: DisposeFn = () => {
    for (const cleanup of ctx.cleanups) cleanup();
    ctx.cleanups = [];
    for (const sub of ctx.subscriptions) {
      sub.delete(ctx);
    }
    ctx.subscriptions = [];
    for (const child of ctx.childDisposables) {
      child();
    }
    ctx.childDisposables = [];
  };

  // Register with parent effect if one is running
  if (currentEffect) {
    currentEffect.childDisposables.push(dispose);
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
