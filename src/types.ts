export type EffectFn = () => void;
export type DisposeFn = () => void;

export interface EffectContext {
  fn: EffectFn;
  cleanups: EffectFn[];
  subscriptions: Set<EffectContext>[];
  childDisposables: DisposeFn[];
  parent: EffectContext | null;
  contexts: Record<symbol, any>;
  execute: () => void;
}

export type CauseGetter<T> = () => T;

export type CauseSetter<T> = (next: T | ((prev: T) => T)) => void;

export type Cause<T> = [CauseGetter<T>, CauseSetter<T>];

export type ElementTag = string | symbol | Function;

export type ElementProps = Record<string, any> | null;

export type Child = Node | string | number | boolean | null | undefined | (() => unknown) | ChildArray;
export interface ChildArray extends Array<Child> {}

export type ElementChildren = Child | ChildArray;

export type AslanIntrinsicElements = {
  [K in keyof HTMLElementTagNameMap]: Record<string, any>;
};

export interface ScopedCause<T> {
  (): T;
  Provider: (props: { children?: ElementChildren }) => Node;
}
