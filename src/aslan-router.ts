import { createCause, createEffect, createComponent, renderNode, Fragment } from './aslan';

const [currentPath, setCurrentPath] = createCause(window.location.pathname);

window.addEventListener('popstate', () => {
  setCurrentPath(window.location.pathname);
});

export function navigate(path: string) {
  history.pushState(null, '', path);
  setCurrentPath(path);
}

export interface Route {
  path: string;
  component: () => Node;
}

type Module = { default: (...args: any[]) => Node };

function normalizeDirName(name: string): string {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/_/g, '-')
    .toLowerCase();
}

function dirToRoute(filePath: string): string {
  const withoutBase = filePath.replace(/^.*?views\//, '');
  const dir = withoutBase.replace(/\/view\.(tsx|ts|jsx|js)$/, '');

  if (dir === withoutBase) return '/';

  const segments = dir.split('/').map(normalizeDirName);
  return '/' + segments.join('/');
}

function buildLayoutMap(layouts: Record<string, Module>): Map<string, Module> {
  const map = new Map<string, Module>();

  for (const [filePath, mod] of Object.entries(layouts)) {
    const dir = filePath
      .replace(/^.*?views/, '')
      .replace(/\/layout\.(tsx|ts|jsx|js)$/, '');
    map.set(dir || '/', mod);
  }

  return map;
}

function collectLayouts(
  routePath: string,
  layoutMap: Map<string, Module>
): Module[] {
  const result: Module[] = [];

  const rootLayout = layoutMap.get('/');
  if (rootLayout) result.push(rootLayout);

  const parts = routePath === '/' ? [] : routePath.split('/').filter(Boolean);
  let accumulated = '';
  for (const part of parts) {
    accumulated += '/' + part;
    const layout = layoutMap.get(accumulated);
    if (layout) result.push(layout);
  }

  return result;
}

export function buildRoutes(
  views: Record<string, Module>,
  layouts: Record<string, Module>
): Route[] {
  const layoutMap = buildLayoutMap(layouts);

  return Object.entries(views).map(([filePath, mod]) => {
    const path = dirToRoute(filePath);
    const matchedLayouts = collectLayouts(path, layoutMap);

    // Views and layouts are wrapped via createComponent so each gets
    // an owner scope. Layouts receive the inner content as lazy children
    // (getter on props), so Providers in layouts are set up before
    // view content evaluates.
    const component = () => {
      let content: any = () => createComponent(mod.default, {});
      for (let i = matchedLayouts.length - 1; i >= 0; i--) {
        const layout = matchedLayouts[i];
        const inner = content;
        content = () => createComponent(layout.default, {
          get children() { return inner(); }
        });
      }
      return content();
    };

    return { path, component };
  });
}

export function Router(routes: Route[]): HTMLElement {
  const container = document.createElement('div');

  createEffect(() => {
    const path = currentPath();
    const match = routes.find(r => r.path === path);

    container.innerHTML = '';

    if (match) {
      container.appendChild(match.component());
    } else {
      container.appendChild(document.createTextNode('404 - Not Found'));
    }
  });

  return container;
}

export function Link(props: { href: string; children?: any }): Node {
  return renderNode('a', {
    href: props.href,
    onClick: (e: Event) => {
      e.preventDefault();
      navigate(props.href);
    },
  }, props.children);
}
