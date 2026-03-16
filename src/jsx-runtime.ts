import { createElement, Fragment } from './aslan';
import type { AslanIntrinsicElements } from './types';

export { createElement as jsx, createElement as jsxs, Fragment };

export namespace JSX {
  export type Element = HTMLElement;
  export interface IntrinsicElements extends AslanIntrinsicElements {}
}
