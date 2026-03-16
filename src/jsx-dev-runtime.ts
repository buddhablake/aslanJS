import { createElement } from './aslan';

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

export const Fragment = 'fragment';

export namespace JSX {
  export type Element = HTMLElement;
  export interface IntrinsicElements {
    [tag: string]: Record<string, any>;
  }
}
