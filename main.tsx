import './src/index.css';
import { Router, buildRoutes } from '@/aslan-router';

const views = import.meta.glob<{ default: () => HTMLElement }>(
  './views/**/view.tsx',
  { eager: true }
);

const layouts = import.meta.glob<{ default: (...args: any[]) => HTMLElement }>(
  './views/**/layout.tsx',
  { eager: true }
);

const routes = buildRoutes(views, layouts);

const app = document.getElementById('app');
if (app) {
  app.appendChild(Router(routes));
}
