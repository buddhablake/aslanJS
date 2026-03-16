import { renderNode, Fragment } from './aslan';
import type { AslanIntrinsicElements } from './types';

export { Fragment };

export function jsxDEV(
  type: any,
  props: any,
  _key: any,
  _isStaticChildren: any,
  _source: any,
  _self: any,
): Node {
  const { children, ...rest } = props ?? {};
  return renderNode(type, rest, children);
}

export namespace JSX {
  export type Element = Node;
  export interface IntrinsicElements extends AslanIntrinsicElements {}
}
