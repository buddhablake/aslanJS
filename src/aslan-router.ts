import { createCause, createEffect, createComponent, renderNode, Fragment, getCurrentOwner, runWithOwner } from './aslan';
import type { EffectContext, DisposeFn } from './types';

const [currentPath, setCurrentPath] = createCause(window.location.pathname);

window.addEventListener('popstate', () => {
  setCurrentPath(window.location.pathname);
});

export function navigate(path: string) {
  history.pushState(null, '', path);
  setCurrentPath(path);
}

type Module = { default: (...args: any[]) => Node };

export interface Route {
  path: string;
  layouts: Module[];
  view: Module;
}

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
    return { path, layouts: matchedLayouts, view: mod };
  });
}

interface MountedLayout {
  module: Module;
  childSlot: HTMLElement;
  slotOwner: EffectContext | null;
  dispose: DisposeFn;
}

export function Router(routes: Route[]): HTMLElement {
  const container = document.createElement('div');
  let mounted: MountedLayout[] = [];
  let viewCleanup: (() => void) | null = null;

  createEffect(() => {
    const path = currentPath();
    const route = routes.find(r => r.path === path);

    if (!route) {
      if (viewCleanup) { viewCleanup(); viewCleanup = null; }
      for (let i = mounted.length - 1; i >= 0; i--) mounted[i].dispose();
      mounted.length = 0;
      container.innerHTML = '';
      container.appendChild(document.createTextNode('404 - Not Found'));
      return;
    }

    const newLayouts = route.layouts;

    let k = 0;
    while (k < mounted.length && k < newLayouts.length && mounted[k].module === newLayouts[k]) {
      k++;
    }

    if (viewCleanup) { viewCleanup(); viewCleanup = null; }

    for (let i = mounted.length - 1; i >= k; i--) {
      mounted[i].dispose();
    }
    mounted.splice(k);

    let slot = k > 0 ? mounted[k - 1].childSlot : container;
    slot.innerHTML = '';

    for (let i = k; i < newLayouts.length; i++) {
      const parentOwner = i > 0 ? mounted[i - 1].slotOwner : getCurrentOwner();
      const childSlot = document.createElement('div');
      childSlot.style.display = 'contents';
      let slotOwner: EffectContext | null = null;
      const disposables: DisposeFn[] = [];

      const node = runWithOwner(parentOwner, () => {
        return createComponent(newLayouts[i].default, {
          get children() {
            slotOwner = getCurrentOwner();
            return childSlot;
          }
        });
      }, disposables);

      slot.appendChild(node);
      mounted.push({
        module: newLayouts[i],
        childSlot,
        slotOwner,
        dispose: disposables[0],
      });
      slot = childSlot;
    }

    const viewOwner = mounted.length > 0
      ? mounted[mounted.length - 1].slotOwner
      : getCurrentOwner();
    const viewDisposables: DisposeFn[] = [];

    const viewNode = runWithOwner(viewOwner, () => {
      return createComponent(route.view.default, {});
    }, viewDisposables);

    slot.appendChild(viewNode);

    viewCleanup = () => {
      if (viewDisposables[0]) viewDisposables[0]();
    };
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
