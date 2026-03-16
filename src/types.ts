export type Effect = () => void;

export type SignalGetter<T> = () => T;

export type SignalSetter<T> = (next: T | ((prev: T) => T)) => void;

export type Signal<T> = [SignalGetter<T>, SignalSetter<T>];

export type ElementTag = string | symbol | Function;

export type ElementProps = Record<string, any> | null;

export type ElementChildren = any[];

export type AslanIntrinsicElements = {
  [K in keyof HTMLElementTagNameMap]: Record<string, any>;
};