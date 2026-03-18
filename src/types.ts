export type EffectFn = () => void;
export type DisposeFn = () => void;

export interface EffectContext {
  fn: EffectFn;
  execute: () => void;
  cleanups: EffectFn[];
  subscriptions: Set<EffectContext>[];
  childDisposables: DisposeFn[];
}

export type SignalGetter<T> = () => T;

export type SignalSetter<T> = (next: T | ((prev: T) => T)) => void;

export type Signal<T> = [SignalGetter<T>, SignalSetter<T>];

export type ElementTag = string | symbol | Function;

export type ElementProps = Record<string, any> | null;

export type Child = Node | string | number | boolean | null | undefined | (() => unknown) | ChildArray;
export interface ChildArray extends Array<Child> {}

export type ElementChildren = Child | ChildArray;

export type AslanIntrinsicElements = {
  [K in keyof HTMLElementTagNameMap]: Record<string, any>;
};
