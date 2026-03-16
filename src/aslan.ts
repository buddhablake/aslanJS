import type { Effect, SignalGetter, SignalSetter, Signal, ElementTag, ElementProps, ElementChildren } from "./types.ts";

export const Fragment = Symbol('Fragment');

let currentEffect: Effect | null = null;

export function createSignal<T>(initial: T): Signal<T> {
    let value = initial;
    const subscribers = new Set<Effect>();

    const read: SignalGetter<T> = () => {
        if (currentEffect) {
            subscribers.add(currentEffect);
        }
        return value;
    };

    const write: SignalSetter<T> = (newValue: T | ((prev: T) => T)) => {
        if (typeof newValue === "function") {
            value = (newValue as (prev: T) => T)(value);
        } else {
            value = newValue;
        }
        subscribers.forEach((effect) => effect());
    };

    return [read, write];
}

export function createEffect(effect: Effect) {
    currentEffect = effect;
    effect();
    currentEffect = null;
}

export function createElement(
  tag: ElementTag,
  props: ElementProps,
  ...children: ElementChildren
): HTMLElement {
  const propsChildren = props?.children;
  if (propsChildren !== undefined) {
    const { children: _, ...rest } = props!;
    props = rest;
    children = Array.isArray(propsChildren) ? propsChildren : [propsChildren];
  }

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

  for (const child of children.flat()) {
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

  return el as HTMLElement;
}