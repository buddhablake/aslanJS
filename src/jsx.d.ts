declare namespace JSX {
  type IntrinsicElements = {
    [K in keyof HTMLElementTagNameMap]: Record<string, any>;
  };
}