import { createSignal, createEffect, createElement } from '@/aslan';

const [currentPath, setCurrentPath] = createSignal(window.location.pathname);

window.addEventListener('popstate', () => {
  setCurrentPath(window.location.pathname);
});

export function navigate(path: string) {
  history.pushState(null, '', path);
  setCurrentPath(path);
}

export interface Route {
  path: string;
  component: () => HTMLElement;
}

type Module = { default: (...args: any[]) => HTMLElement };

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

function collectLayouts(
  routePath: string,
  layouts: Record<string, Module>
): Module[] {
  const result: Module[] = [];
  const parts = routePath === '/' ? [] : routePath.split('/').filter(Boolean);

  const rootKey = Object.keys(layouts).find(k => /views\/layout\.(tsx|ts|jsx|js)$/.test(k));
  if (rootKey) result.push(layouts[rootKey]);

  let accumulated = '';
  for (const part of parts) {
    accumulated += '/' + part;
    const key = Object.keys(layouts).find(k => {
      const dir = k.replace(/^.*?views/, '').replace(/\/layout\.(tsx|ts|jsx|js)$/, '');
      return dir === accumulated;
    });
    if (key) result.push(layouts[key]);
  }

  return result;
}

export function buildRoutes(
  views: Record<string, Module>,
  layouts: Record<string, Module>
): Route[] {
  return Object.entries(views).map(([filePath, mod]) => {
    const path = dirToRoute(filePath);
    const matchedLayouts = collectLayouts(path, layouts);

    const component = () => {
      let content = mod.default();
      for (let i = matchedLayouts.length - 1; i >= 0; i--) {
        content = matchedLayouts[i].default({ children: content });
      }
      return content;
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

export function Link({ href, children }: { href: string; children?: any }): HTMLElement {
  const anchor = createElement('a', { href, onClick: (e: Event) => {
    e.preventDefault();
    navigate(href);
  }}, ...(Array.isArray(children) ? children : [children]));

  return anchor as HTMLElement;
}
