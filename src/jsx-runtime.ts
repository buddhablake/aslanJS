import { renderNode, Fragment } from './aslan';
import type { AslanIntrinsicElements } from './types';

export { Fragment };

export function jsx(tag: any, props: any): Node {
  const { children, ...rest } = props ?? {};
  return renderNode(tag, rest, children);
}

export { jsx as jsxs };

export namespace JSX {
  export type Element = Node;
  export interface IntrinsicElements extends AslanIntrinsicElements {}
}
