declare namespace JSX {
  type Element = Node;
  interface IntrinsicElements {
    [tag: string]: Record<string, any>;
  }
  // Tells TypeScript that <Component>stuff</Component>
  // passes "stuff" as the "children" prop
  interface ElementChildrenAttribute {
    children: {};
  }
}
