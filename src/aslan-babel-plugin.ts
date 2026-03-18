// Babel plugin that transforms JSX into Aslan runtime calls.
//
// HTML elements:  renderNode("div", { class: "foo" }, child1, child2)
// Components:     createComponent(Comp, { prop: "value", get children() { return [...] } })
// Fragments:      renderNode(Fragment, null, child1, child2)
//
// The key difference from react-jsx: component children are wrapped
// in a getter so they evaluate lazily. This lets Providers set up
// context before children render.

export default function aslanBabelPlugin({ types: t }: any) {

  function isComponentTag(name: any): boolean {
    if (t.isJSXIdentifier(name)) {
      return /^[A-Z_]/.test(name.name);
    }
    return t.isJSXMemberExpression(name);
  }

  function jsxNameToExpression(name: any): any {
    if (t.isJSXIdentifier(name)) {
      if (isComponentTag(name)) {
        return t.identifier(name.name);
      }
      return t.stringLiteral(name.name);
    }
    if (t.isJSXMemberExpression(name)) {
      return t.memberExpression(
        jsxNameToExpression(name.object),
        t.identifier(name.property.name)
      );
    }
    throw new Error(`Unknown JSX name type: ${name.type}`);
  }

  // Recursively transform a JSX node into an expression
  function transformNode(node: any): any {
    if (t.isJSXElement(node)) {
      return transformElement(node);
    }
    if (t.isJSXFragment(node)) {
      return transformFragment(node);
    }
    if (t.isJSXText(node)) {
      const text = node.value.replace(/\n\s*/g, ' ').trim();
      if (!text) return null;
      return t.stringLiteral(text);
    }
    if (t.isJSXExpressionContainer(node)) {
      if (t.isJSXEmptyExpression(node.expression)) return null;
      return node.expression;
    }
    if (t.isJSXSpreadChild(node)) {
      return t.spreadElement(node.expression);
    }
    return null;
  }

  function processChildren(children: any[]): any[] {
    const result: any[] = [];
    for (const child of children) {
      const expr = transformNode(child);
      if (expr !== null) {
        result.push(expr);
      }
    }
    return result;
  }

  function buildPropsObject(attributes: any[]): any {
    if (attributes.length === 0) {
      return t.nullLiteral();
    }

    const properties: any[] = [];

    for (const attr of attributes) {
      if (t.isJSXSpreadAttribute(attr)) {
        properties.push(t.spreadElement(attr.argument));
      } else {
        const key = t.isJSXNamespacedName(attr.name)
          ? `${attr.name.namespace.name}:${attr.name.name.name}`
          : attr.name.name;

        let value;
        if (attr.value === null) {
          value = t.booleanLiteral(true);
        } else if (t.isJSXExpressionContainer(attr.value)) {
          if (t.isJSXEmptyExpression(attr.value.expression)) {
            value = t.identifier('undefined');
          } else {
            value = attr.value.expression;
          }
        } else {
          value = attr.value;
        }

        properties.push(
          t.objectProperty(t.identifier(key), value)
        );
      }
    }

    return t.objectExpression(properties);
  }

  function transformElement(node: any): any {
    const { openingElement, children } = node;
    const tag = jsxNameToExpression(openingElement.name);
    const isComp = isComponentTag(openingElement.name);
    const processedChildren = processChildren(children);

    if (isComp) {
      // Component: createComponent(Comp, { ...props, get children() { return ... } })
      const properties: any[] = [];

      for (const attr of openingElement.attributes) {
        if (t.isJSXSpreadAttribute(attr)) {
          properties.push(t.spreadElement(attr.argument));
        } else {
          const key = t.isJSXNamespacedName(attr.name)
            ? `${attr.name.namespace.name}:${attr.name.name.name}`
            : attr.name.name;

          let value;
          if (attr.value === null) {
            value = t.booleanLiteral(true);
          } else if (t.isJSXExpressionContainer(attr.value)) {
            value = t.isJSXEmptyExpression(attr.value.expression)
              ? t.identifier('undefined')
              : attr.value.expression;
          } else {
            value = attr.value;
          }

          properties.push(t.objectProperty(t.identifier(key), value));
        }
      }

      if (processedChildren.length > 0) {
        const childrenValue = processedChildren.length === 1
          ? processedChildren[0]
          : t.arrayExpression(processedChildren);

        // Lazy children via getter: get children() { return ... }
        properties.push(
          t.objectMethod(
            'get',
            t.identifier('children'),
            [],
            t.blockStatement([t.returnStatement(childrenValue)])
          )
        );
      }

      const propsArg = properties.length > 0
        ? t.objectExpression(properties)
        : t.objectExpression([]);

      return t.callExpression(
        t.memberExpression(t.identifier('_$aslan'), t.identifier('createComponent')),
        [tag, propsArg]
      );

    } else {
      // HTML element: renderNode("div", props, children)
      const propsArg = buildPropsObject(openingElement.attributes);
      const childrenArg = processedChildren.length === 0
        ? t.identifier('undefined')
        : processedChildren.length === 1
          ? processedChildren[0]
          : t.arrayExpression(processedChildren);

      return t.callExpression(
        t.memberExpression(t.identifier('_$aslan'), t.identifier('renderNode')),
        [tag, propsArg, childrenArg]
      );
    }
  }

  function transformFragment(node: any): any {
    const processedChildren = processChildren(node.children);
    const childrenArg = processedChildren.length === 0
      ? t.identifier('undefined')
      : processedChildren.length === 1
        ? processedChildren[0]
        : t.arrayExpression(processedChildren);

    return t.callExpression(
      t.memberExpression(t.identifier('_$aslan'), t.identifier('renderNode')),
      [
        t.memberExpression(t.identifier('_$aslan'), t.identifier('Fragment')),
        t.nullLiteral(),
        childrenArg
      ]
    );
  }

  return {
    name: 'aslan-jsx',
    visitor: {
      // Add the import at the top of each file that contains JSX
      Program: {
        enter(path: any, state: any) {
          state.hasJSX = false;
        },
        exit(path: any, state: any) {
          if (state.hasJSX) {
            const importDecl = t.importDeclaration(
              [t.importNamespaceSpecifier(t.identifier('_$aslan'))],
              t.stringLiteral('@/src/aslan')
            );
            path.unshiftContainer('body', importDecl);
          }
        }
      },

      JSXElement(path: any, state: any) {
        state.hasJSX = true;
        path.replaceWith(transformElement(path.node));
      },

      JSXFragment(path: any, state: any) {
        state.hasJSX = true;
        path.replaceWith(transformFragment(path.node));
      }
    }
  };
}
