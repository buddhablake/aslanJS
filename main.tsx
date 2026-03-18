import './src/index.css';
import { Router, buildRoutes } from '@/src/aslan-router';

const views = import.meta.glob<{ default: () => Node }>(
  './views/**/view.tsx',
  { eager: true }
);

const layouts = import.meta.glob<{ default: (...args: any[]) => Node }>(
  './views/**/layout.tsx',
  { eager: true }
);

const routes = buildRoutes(views, layouts);

const app = document.getElementById('app');
if (app) {
  app.appendChild(Router(routes));
}
