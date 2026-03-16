import { createElement } from './aslan';

export { createElement as jsx, createElement as jsxs };

export const Fragment = 'fragment';

export namespace JSX {
  export type Element = HTMLElement;
  export interface IntrinsicElements {
    [tag: string]: Record<string, any>;
  }
}
