// =============================================================================
// Aslan Babel Plugin — JSX Compiler
// =============================================================================
//
// This plugin transforms JSX syntax into Aslan runtime function calls.
// It runs at BUILD TIME (not in the browser) as part of the Vite pipeline.
//
// What it produces:
//   HTML elements:  _$aslan.renderNode("div", { class: "foo" }, child1, child2)
//   Components:     _$aslan.createComponent(Comp, { get prop() { return expr }, ... })
//   SVG elements:   _$aslan.renderNode("circle", { cx: 10 }, undefined, true)
//   Fragments:      _$aslan.renderNode(Fragment, null, child1, child2)
//
// Two critical design choices:
//
// 1. LAZY PROPS: For components, all dynamic prop values (anything that isn't
//    a simple literal) are wrapped in getters. This means accessing props.count
//    always returns the CURRENT value, not the value at the time the component
//    was created. Without this, reactive props would evaluate once and never
//    update. This is the same approach Solid.js uses.
//
//    For HTML elements, dynamic props are wrapped in arrow functions (() => expr)
//    because the runtime already creates effects for function-valued props.
//
// 2. SVG NAMESPACE: SVG elements require document.createElementNS() instead of
//    document.createElement(). The compiler tracks SVG context as it walks the
//    tree — when it sees <svg>, everything inside is SVG until <foreignObject>
//    (which switches back to HTML for its children). A 4th argument (true) is
//    passed to renderNode for SVG elements.
//
// HOW BABEL PLUGINS WORK (quick primer):
//   1. Babel parses your source code into an AST (Abstract Syntax Tree) —
//      a tree of nodes representing every piece of syntax.
//   2. Plugins define "visitors" — functions that run when Babel encounters
//      specific node types (JSXElement, JSXFragment, etc.)
//   3. Inside visitors, you can replace nodes with new ones. That's what
//      this plugin does: it replaces JSX nodes with function call nodes.
//   4. After all plugins run, Babel converts the modified AST back to code.
//
// The `t` object (from @babel/types) is a toolkit for creating AST nodes.
// Every t.something() call builds a node:
//   t.stringLiteral("div")         → the AST node for the string "div"
//   t.identifier("foo")            → the AST node for the variable name foo
//   t.callExpression(fn, [args])   → the AST node for fn(args)
//   t.objectProperty(key, value)   → the AST node for { key: value }
//   t.objectExpression([props])    → the AST node for { ...all props }
// You're building a tree of code, not concatenating strings.
// =============================================================================

// Babel passes an object with a `types` property (commonly aliased as `t`).
// `t` is the @babel/types utility — it has helpers to create and check AST nodes.
export default function aslanBabelPlugin({ types: t }: any) {

  // ---------------------------------------------------------------------------
  // Helper: Is this AST node a static (compile-time constant) value?
  // ---------------------------------------------------------------------------
  // Static values don't need reactive wrapping — they can never change at
  // runtime. Everything else MIGHT be reactive (it could read a signal),
  // so we wrap it to be safe.
  //
  // Static:   "hello", 42, true, false, null, `template with no ${expressions}`
  // Dynamic:  count(), myVar, a + b, obj.prop, condition ? a : b
  //
  // Wrapping a non-reactive dynamic value is wasteful but not incorrect —
  // the effect just runs once and never re-runs since no signals were read.
  // So we err on the side of wrapping too much rather than too little.
  function isStaticValue(node: any): boolean {
    return (
      t.isStringLiteral(node) ||
      t.isNumericLiteral(node) ||
      t.isBooleanLiteral(node) ||
      t.isNullLiteral(node) ||
      // Template literals with no expressions are static: `hello world`
      // Template literals WITH expressions are dynamic: `hello ${name}`
      (t.isTemplateLiteral(node) && node.expressions.length === 0)
    );
  }

  // ---------------------------------------------------------------------------
  // Helper: Is this prop name an event handler?
  // ---------------------------------------------------------------------------
  // Event handlers (onClick, onInput, onChange, etc.) should NOT be wrapped
  // in reactive getters/functions. They're callbacks — the user passes a
  // function reference, and we need to pass that exact function to
  // addEventListener. Wrapping it would break things.
  //
  // Convention: starts with "on" followed by an uppercase letter.
  //   onClick   → yes (event handler)
  //   onInput   → yes (event handler)
  //   once      → no (just a prop that starts with "on")
  //   online    → no (third char is lowercase)
  function isEventHandler(name: string): boolean {
    return (
      name.length > 2 &&
      name[0] === 'o' &&
      name[1] === 'n' &&
      name[2] === name[2].toUpperCase()
    );
  }

  // ---------------------------------------------------------------------------
  // Helper: Is this tag a component (uppercase) or an HTML element (lowercase)?
  // ---------------------------------------------------------------------------
  // In JSX, the convention is:
  //   <div>       → lowercase → HTML element → renderNode("div", ...)
  //   <MyComponent> → uppercase → component  → createComponent(MyComponent, ...)
  //   <Foo.Bar>   → member expression → always a component
  //
  // This distinction determines the ENTIRE output shape — components get
  // lazy children and use createComponent, HTML elements get eager children
  // and use renderNode.
  function isComponentTag(name: any): boolean {
    if (t.isJSXIdentifier(name)) {
      // Starts with uppercase letter or underscore = component.
      // e.g. MyComponent, _InternalThing
      return /^[A-Z_]/.test(name.name);
    }
    // Member expressions like <Foo.Bar> are always components.
    // You'd never write <foo.bar> for an HTML element.
    return t.isJSXMemberExpression(name);
  }

  // ---------------------------------------------------------------------------
  // Helper: Get the raw tag name string from a JSX opening element
  // ---------------------------------------------------------------------------
  // Used for SVG context tracking — we need to know the actual tag name
  // (like "svg" or "foreignObject") to decide SVG namespace handling.
  // Returns null for components (they don't have simple string tag names).
  function getTagName(openingElement: any): string | null {
    if (t.isJSXIdentifier(openingElement.name) && !isComponentTag(openingElement.name)) {
      return openingElement.name.name;
    }
    return null;
  }

  // ---------------------------------------------------------------------------
  // Helper: Convert a JSX tag name into a JS expression for the output code
  // ---------------------------------------------------------------------------
  // JSX tag names exist in a special part of the AST. We need to convert them
  // into regular JavaScript expressions that can be used as function arguments.
  //
  // Examples:
  //   <div>          → "div"         (string literal — it's an HTML tag name)
  //   <MyComponent>  → MyComponent   (identifier — it's a variable reference)
  //   <Foo.Bar>      → Foo.Bar       (member expression — property access)
  function jsxNameToExpression(name: any): any {
    if (t.isJSXIdentifier(name)) {
      if (isComponentTag(name)) {
        // Component: output a variable reference (identifier).
        // <MyComponent> → the variable MyComponent (which holds the function)
        return t.identifier(name.name);
      }
      // HTML element: output a string.
      // <div> → the string "div" (renderNode uses this to call document.createElement)
      return t.stringLiteral(name.name);
    }
    if (t.isJSXMemberExpression(name)) {
      // <Foo.Bar> → Foo.Bar as a member expression.
      // Recurse on `name.object` because it could be nested: <A.B.C>
      return t.memberExpression(
        jsxNameToExpression(name.object),
        t.identifier(name.property.name)
      );
    }
    // This should never happen with valid JSX, but just in case:
    throw new Error(`Unknown JSX name type: ${name.type}`);
  }

  // ---------------------------------------------------------------------------
  // Helper: Transform any single JSX child node into a JS expression
  // ---------------------------------------------------------------------------
  // JSX children come in several flavors. This function handles all of them
  // and returns a JS expression (or null to skip it).
  //
  // A JSX element like:
  //   <div>
  //     Hello {name}
  //     <span>world</span>
  //   </div>
  //
  // Has these children in the AST:
  //   JSXText("Hello ")
  //   JSXExpressionContainer(name)
  //   JSXElement(<span>world</span>)
  //
  // The isSVG parameter is threaded through so nested elements inside <svg>
  // inherit the SVG context and get created with the right namespace.
  function transformNode(node: any, isSVG: boolean): any {
    // Child is another JSX element: <span>...</span>
    // Recursively transform it into a renderNode/createComponent call.
    if (t.isJSXElement(node)) {
      return transformElement(node, isSVG);
    }

    // Child is a fragment: <>...</>
    if (t.isJSXFragment(node)) {
      return transformFragment(node, isSVG);
    }

    // Child is plain text: "Hello world"
    // JSX text often has weird whitespace from indentation, so we clean it up:
    //   - Replace newlines + leading spaces with a single space
    //   - Trim the result
    //   - If nothing's left (it was all whitespace), skip it (return null)
    if (t.isJSXText(node)) {
      const text = node.value.replace(/\n\s*/g, ' ').trim();
      if (!text) return null;
      return t.stringLiteral(text);
    }

    // Child is a JS expression in curly braces: {someVariable} or {1 + 2}
    // The curly braces are just JSX syntax — we unwrap to get the inner expression.
    // JSXEmptyExpression is what you get from {/* a comment */} — skip those.
    if (t.isJSXExpressionContainer(node)) {
      if (t.isJSXEmptyExpression(node.expression)) return null;
      return node.expression;
    }

    // Spread child: {...items} — rare but valid JSX syntax.
    // Converts to a spread element so it expands in the children array.
    if (t.isJSXSpreadChild(node)) {
      return t.spreadElement(node.expression);
    }

    // Unknown node type — skip it.
    return null;
  }

  // ---------------------------------------------------------------------------
  // Helper: Process ALL children of a JSX element
  // ---------------------------------------------------------------------------
  // Runs transformNode on each child and filters out nulls (whitespace-only
  // text nodes, empty expressions, etc.)
  //
  // isSVG is passed through so child elements know they're inside an SVG.
  function processChildren(children: any[], isSVG: boolean): any[] {
    const result: any[] = [];
    for (const child of children) {
      const expr = transformNode(child, isSVG);
      if (expr !== null) {
        result.push(expr);
      }
    }
    return result;
  }

  // ---------------------------------------------------------------------------
  // Helper: Create a valid JS property key from a prop name
  // ---------------------------------------------------------------------------
  // In JS objects, property keys that are valid identifiers can be bare:
  //   { class: "foo" }        ← class is a valid identifier
  //   { "aria-label": "x" }   ← aria-label has a hyphen, needs quotes
  //
  // This function checks if the name is a valid JS identifier. If so, it
  // returns an identifier node (bare key). Otherwise, a string literal (quoted).
  function propKey(name: string): any {
    return /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(name)
      ? t.identifier(name)
      : t.stringLiteral(name);
  }

  // ---------------------------------------------------------------------------
  // Helper: Extract the resolved value from a JSX attribute
  // ---------------------------------------------------------------------------
  // Handles the three ways a prop value can appear in JSX:
  //   <div disabled />          → attr.value is null       → true
  //   <div class="foo" />       → attr.value is StringLit  → "foo"
  //   <div class={expr} />      → attr.value is ExprCont   → expr
  function extractAttrValue(attr: any): any {
    if (attr.value === null) {
      // Boolean shorthand: <input disabled> means disabled={true}
      return t.booleanLiteral(true);
    }
    if (t.isJSXExpressionContainer(attr.value)) {
      // Expression value: onClick={handler} or count={5}
      if (t.isJSXEmptyExpression(attr.value.expression)) {
        return t.identifier('undefined');
      }
      return attr.value.expression;
    }
    // String literal value: class="foo" — already a StringLiteral AST node.
    return attr.value;
  }

  // ---------------------------------------------------------------------------
  // Helper: Extract the prop name string from a JSX attribute
  // ---------------------------------------------------------------------------
  // Handles both simple names (class, onClick) and namespaced names (on:click).
  function extractAttrName(attr: any): string {
    return t.isJSXNamespacedName(attr.name)
      ? `${attr.name.namespace.name}:${attr.name.name.name}`
      : attr.name.name;
  }

  // ---------------------------------------------------------------------------
  // Build a props object for HTML elements (with reactive wrapping)
  // ---------------------------------------------------------------------------
  // Takes the JSX attributes array and builds a JS object expression.
  //
  // Static props are passed directly:
  //   <div class="foo">  →  { class: "foo" }
  //
  // Dynamic props are wrapped in arrow functions so the runtime can create
  // effects that re-run when signals change:
  //   <div class={isDark() ? 'dark' : 'light'}>  →  { class: () => isDark() ? 'dark' : 'light' }
  //
  // Event handlers are NEVER wrapped — they're callbacks, not reactive values:
  //   <div onClick={handleClick}>  →  { onClick: handleClick }
  //
  // The runtime (renderNode) checks `typeof val === 'function'` for non-event
  // props and creates an effect: createEffect(() => setProp(el, key, val()))
  function buildPropsObject(attributes: any[]): any {
    // No attributes? Return null (not an empty object) — this tells
    // renderNode there are no props to process.
    if (attributes.length === 0) {
      return t.nullLiteral();
    }

    const properties: any[] = [];

    for (const attr of attributes) {
      // Spread attribute: {...someObject}
      // In the AST this is a JSXSpreadAttribute node. We convert it to
      // a spread element so it expands into the object: { ...someObject }
      if (t.isJSXSpreadAttribute(attr)) {
        properties.push(t.spreadElement(attr.argument));
      } else {
        // Normalize `class` → `className` so the runtime always uses the
        // fast `el.className = val` path instead of `setAttribute('class', val)`.
        // Users can write either `class` or `className` in JSX — both work.
        let key = extractAttrName(attr);
        if (key === 'class') key = 'className';

        let value = extractAttrValue(attr);

        // Wrap dynamic non-event props in arrow functions for reactivity.
        //
        // BEFORE (no wrapping):
        //   <div className={isDark() ? 'dark' : 'light'}>
        //   → { className: isDark() ? 'dark' : 'light' }
        //   → evaluates ONCE, class never updates when isDark changes
        //
        // AFTER (with wrapping):
        //   <div className={isDark() ? 'dark' : 'light'}>
        //   → { className: () => isDark() ? 'dark' : 'light' }
        //   → runtime creates an effect, class updates reactively
        //
        // We skip wrapping for:
        //   - Static values ("foo", 42, true) — they can't change
        //   - Event handlers (onClick, onInput) — they're callbacks, not values
        //   - Arrow functions — already wrapped by the user (avoids double-wrap)
        if (!isStaticValue(value) && !isEventHandler(key) && !t.isArrowFunctionExpression(value)) {
          value = t.arrowFunctionExpression([], value);
        }

        const k = propKey(key);
        // t.objectProperty(key, value, computed)
        // The third arg `computed` is true when the key is a string literal
        // (needs quotes), false when it's an identifier (bare key).
        properties.push(
          t.objectProperty(k, value, !t.isIdentifier(k))
        );
      }
    }

    return t.objectExpression(properties);
  }

  // ---------------------------------------------------------------------------
  // Transform a JSX element into a runtime call
  // ---------------------------------------------------------------------------
  // This is the main function. It takes a JSX element node and returns either:
  //   _$aslan.createComponent(Comp, { get prop() {...} })  — for components
  //   _$aslan.renderNode("div", { prop: () => expr }, child)  — for HTML elements
  //
  // The two paths differ in how they handle children and props:
  //   Components:    children and dynamic props are LAZY via getters
  //   HTML elements: children are EAGER, dynamic props use arrow functions
  //
  // The isSVG parameter tracks whether we're inside an <svg> element.
  // When true, a 4th argument (true) is passed to renderNode so the runtime
  // uses document.createElementNS instead of document.createElement.
  function transformElement(node: any, isSVG: boolean = false): any {
    const { openingElement, children } = node;

    // Convert the tag name: "div" for HTML, MyComponent for components
    const tag = jsxNameToExpression(openingElement.name);

    // Is this a component or HTML element?
    const isComp = isComponentTag(openingElement.name);

    // --- SVG context tracking ---
    // Get the raw tag name so we can check for SVG-related elements.
    const tagName = getTagName(openingElement);

    // Are we currently in SVG context?
    // We enter SVG context when we encounter <svg>.
    // We stay in SVG context for all nested elements (circle, rect, g, etc.)
    // EXCEPT: <foreignObject>'s children exit SVG context (they're HTML).
    //
    // Note: components reset SVG context — we can't know what they render
    // at compile time. If a component renders SVG elements, it must include
    // <svg> or the elements must handle their own namespace.
    const isCurrentSVG = !isComp && (isSVG || tagName === 'svg');

    // Children inherit SVG context, UNLESS parent is <foreignObject>.
    // <foreignObject> is the SVG escape hatch — its children are HTML.
    const childSVG = isCurrentSVG && tagName !== 'foreignObject';

    // Transform all children into JS expressions, passing SVG context through
    const processedChildren = processChildren(children, childSVG);

    if (isComp) {
      // =======================================================================
      // COMPONENT PATH
      // =======================================================================
      // Output: _$aslan.createComponent(MyComponent, {
      //   get propA() { return expr },
      //   propB: "static",
      //   get children() { return <transformed children> }
      // })
      //
      // Dynamic props use getters so accessing props.count always returns the
      // latest value. Static props (literals) are passed directly since they
      // can never change. Children always use a getter (lazy evaluation).

      const properties: any[] = [];

      for (const attr of openingElement.attributes) {
        if (t.isJSXSpreadAttribute(attr)) {
          properties.push(t.spreadElement(attr.argument));
        } else {
          const key = extractAttrName(attr);
          const value = extractAttrValue(attr);

          const k = propKey(key);

          // For components: wrap dynamic non-event values in GETTERS.
          //
          // BEFORE (no wrapping):
          //   <Counter count={count()} />
          //   → { count: count() }
          //   → count() is called once, result is frozen
          //
          // AFTER (with getter):
          //   <Counter count={count()} />
          //   → { get count() { return count() } }
          //   → every access to props.count calls count() fresh
          //
          // This is what makes props reactive. When the component reads
          // props.count inside an effect, it gets the current value and
          // the effect re-runs when the underlying signal changes.
          if (!isStaticValue(value) && !isEventHandler(key)) {
            // t.objectMethod('get', ...) creates: get propName() { return expr }
            properties.push(
              t.objectMethod(
                'get',
                k,
                [],
                t.blockStatement([t.returnStatement(value)])
              )
            );
          } else {
            // Static value or event handler — pass directly, no getter needed.
            properties.push(t.objectProperty(k, value, !t.isIdentifier(k)));
          }
        }
      }

      // Add children as a lazy getter on the props object.
      // This is THE key design decision of this compiler.
      //
      // If there's one child:  get children() { return <child> }
      // If there are multiple: get children() { return [<child1>, <child2>] }
      //
      // WHY a getter? Consider:
      //   <ThemeProvider value={theme}>
      //     <App />          ← this needs to access the theme context
      //   </ThemeProvider>
      //
      // Without the getter, <App /> would be evaluated BEFORE ThemeProvider
      // runs, so the context wouldn't exist yet. The getter delays evaluation
      // until ThemeProvider's code calls props.children, which happens AFTER
      // it has set up the context.
      if (processedChildren.length > 0) {
        const childrenValue = processedChildren.length === 1
          ? processedChildren[0]
          : t.arrayExpression(processedChildren);

        // t.objectMethod('get', ...) creates:  get children() { return ... }
        // This is a JS getter — accessing props.children calls this function.
        properties.push(
          t.objectMethod(
            'get',                                              // method kind
            t.identifier('children'),                           // method name
            [],                                                 // parameters (none for getters)
            t.blockStatement([t.returnStatement(childrenValue)]) // body: { return <children> }
          )
        );
      }

      // Build the final props object. Even if there are no props or children,
      // we still pass an empty object {} (not null) — createComponent always
      // expects an object.
      const propsArg = properties.length > 0
        ? t.objectExpression(properties)
        : t.objectExpression([]);

      // Build the final call: _$aslan.createComponent(MyComponent, { ...props })
      return t.callExpression(
        t.memberExpression(t.identifier('_$aslan'), t.identifier('createComponent')),
        [tag, propsArg]
      );

    } else {
      // =======================================================================
      // HTML / SVG ELEMENT PATH
      // =======================================================================
      // Output: _$aslan.renderNode("div", { class: "foo" }, children)
      //    or:  _$aslan.renderNode("circle", { cx: () => x() }, undefined, true)
      //
      // The 4th argument (true) tells the runtime to use createElementNS
      // for SVG elements instead of createElement.

      // Build the props object (or null if no attributes).
      // Dynamic props are automatically wrapped in arrow functions.
      const propsArg = buildPropsObject(openingElement.attributes);

      // Build the children argument:
      //   0 children → undefined (no children to render)
      //   1 child    → pass it directly (no array wrapper needed)
      //   2+ children → wrap in an array [child1, child2, ...]
      const childrenArg = processedChildren.length === 0
        ? t.identifier('undefined')
        : processedChildren.length === 1
          ? processedChildren[0]
          : t.arrayExpression(processedChildren);

      // Build the final call arguments
      const callArgs: any[] = [tag, propsArg, childrenArg];

      // If we're in SVG context, pass true as the 4th argument.
      // This tells renderNode to use document.createElementNS with the
      // SVG namespace ("http://www.w3.org/2000/svg") instead of
      // document.createElement.
      if (isCurrentSVG) {
        callArgs.push(t.booleanLiteral(true));
      }

      // Build the final call: _$aslan.renderNode("div", props, children[, true])
      return t.callExpression(
        t.memberExpression(t.identifier('_$aslan'), t.identifier('renderNode')),
        callArgs
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Transform a JSX fragment (<>...</>) into a runtime call
  // ---------------------------------------------------------------------------
  // Fragments are just containers with no DOM element. They render their
  // children directly without a wrapper node.
  //
  // <>
  //   <div>a</div>
  //   <div>b</div>
  // </>
  //
  // becomes: _$aslan.renderNode(_$aslan.Fragment, null, [<div>a</div>, <div>b</div>])
  //
  // _$aslan.Fragment is a special symbol/value that renderNode recognizes.
  // When it sees Fragment as the tag, it skips creating a DOM element and
  // just renders the children directly.
  //
  // isSVG is passed through so that if a fragment is used inside <svg>,
  // its child elements still get the SVG namespace.
  function transformFragment(node: any, isSVG: boolean = false): any {
    const processedChildren = processChildren(node.children, isSVG);

    // Same children logic as HTML elements:
    // 0 → undefined, 1 → direct, 2+ → array
    const childrenArg = processedChildren.length === 0
      ? t.identifier('undefined')
      : processedChildren.length === 1
        ? processedChildren[0]
        : t.arrayExpression(processedChildren);

    return t.callExpression(
      // _$aslan.renderNode(
      t.memberExpression(t.identifier('_$aslan'), t.identifier('renderNode')),
      [
        // First arg: _$aslan.Fragment (the special fragment marker)
        t.memberExpression(t.identifier('_$aslan'), t.identifier('Fragment')),
        // Second arg: null (fragments never have props)
        t.nullLiteral(),
        // Third arg: the children
        childrenArg
      ]
    );
  }

  // ===========================================================================
  // PLUGIN DEFINITION — this is what Babel actually calls
  // ===========================================================================
  // A Babel plugin returns an object with a `visitor`. The visitor defines
  // handler functions for AST node types. When Babel walks the tree and
  // encounters a matching node type, it calls your handler.
  //
  // Think of it like event listeners for the AST:
  //   "When you see a JSXElement, call this function"
  //   "When you see a JSXFragment, call this function"
  return {
    // Plugin name — shows up in Babel error messages
    name: 'aslan-jsx',

    visitor: {
      // ---------------------------------------------------------------------
      // Program visitor — handles the auto-import
      // ---------------------------------------------------------------------
      // `Program` is the root node of every file's AST. It has two hooks:
      //   enter: runs BEFORE Babel visits the file's contents
      //   exit:  runs AFTER Babel has visited everything
      //
      // We use this to auto-inject the Aslan runtime import at the top of
      // any file that contains JSX. This way users never need to manually
      // write `import * as _$aslan from '@/src/aslan'`.
      Program: {
        // Before processing: initialize a flag to track if we find any JSX
        enter(_path: any, state: any) {
          state.hasJSX = false;
        },

        // After processing: if we found JSX, inject the import at the top
        exit(path: any, state: any) {
          if (state.hasJSX) {
            // Build: import * as _$aslan from '@/src/aslan'
            //
            // This is a namespace import — it imports EVERYTHING from the
            // module as a single object called _$aslan. So _$aslan.renderNode,
            // _$aslan.createComponent, _$aslan.Fragment all come from this.
            //
            // The underscore+dollar prefix (_$aslan) is a convention to avoid
            // colliding with user variable names — nobody names their
            // variables _$aslan.
            const importDecl = t.importDeclaration(
              [t.importNamespaceSpecifier(t.identifier('_$aslan'))],
              t.stringLiteral('@/src/aslan')
            );
            // unshiftContainer('body', ...) inserts the import at the very
            // top of the file (before all other statements).
            path.unshiftContainer('body', importDecl);
          }
        }
      },

      // ---------------------------------------------------------------------
      // JSXElement visitor — handles <div> and <Component> tags
      // ---------------------------------------------------------------------
      // Every time Babel encounters a JSXElement node in the AST, this runs.
      // It sets the hasJSX flag (so we know to add the import) and replaces
      // the JSX node with the transformed function call.
      //
      // path.replaceWith() swaps the current AST node for a new one.
      // After this, the JSXElement is gone and a CallExpression is in its place.
      JSXElement(path: any, state: any) {
        state.hasJSX = true;
        path.replaceWith(transformElement(path.node));
      },

      // ---------------------------------------------------------------------
      // JSXFragment visitor — handles <>...</> syntax
      // ---------------------------------------------------------------------
      // Same idea as JSXElement but for fragments.
      JSXFragment(path: any, state: any) {
        state.hasJSX = true;
        path.replaceWith(transformFragment(path.node));
      }
    }
  };
}
