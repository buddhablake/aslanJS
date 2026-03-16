import { createElement, Fragment } from './aslan';
import type { AslanIntrinsicElements } from './types';

export { Fragment };

export function jsxDEV(
  type: any,
  props: any,
  _key: any,
  _isStaticChildren: any,
  _source: any,
  _self: any,
) {
  return createElement(type, props);
}

export namespace JSX {
  export type Element = HTMLElement;
  export interface IntrinsicElements extends AslanIntrinsicElements {}
}
