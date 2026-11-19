import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { join } from 'node:path';

const app = express();
const angular = new AngularNodeAppEngine({
  trustProxyHeaders: ['x-forwarded-proto'],
  ...(process.env['NG_ALLOWED_HOSTS']
    ? { allowedHosts: process.env['NG_ALLOWED_HOSTS'].split(',') }
    : {}),
});
const browser = join(import.meta.dirname, '../browser');
app.disable('x-powered-by');
app.use((_req, res, next) => {
  if (process.env['PUBLIC_ORIGIN']) {
    _req.headers.host = new URL(process.env['PUBLIC_ORIGIN']).host;
  }
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Cache-Control', 'no-store');
  if (process.env['STAGE'] !== 'production') res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  next();
});

app.get('/config.json', (_req, res) => {
  const origin = process.env['PUBLIC_ORIGIN'] || 'http://localhost:4200';
  res.json({
    productName: 'CotiTrama',
    environment: process.env['STAGE'] || 'development',
    demo: false,
    auth: {
      domain: process.env['AUTH_DOMAIN'] || '',
      clientId: process.env['AUTH_CLIENT_ID'] || '',
      redirectUri: `${origin}/auth/callback`,
      logoutUri: `${origin}/`,
    },
  });
});
app.get('/robots.txt', (_req, res) => {
  res.type('text/plain').send(`User-agent: *\nDisallow: ${process.env['STAGE'] === 'production' ? '/auth/' : '/'}\n`);
});
// Business requests go directly to the HTTP API origin in CloudFront.
app.use('/api', (_req, res) => res.status(404).json({ error: { code: 'NOT_FOUND' } }));
app.use(express.static(browser, {
  index: false,
  redirect: false,
  setHeaders(res, path) {
    res.setHeader('Cache-Control', /[.-][A-Z0-9]{8,}\.(js|css)$/i.test(path)
      ? 'public, max-age=31536000, immutable' : 'no-cache');
  },
}));
app.get('/{*splat}', (req, res, next) => {
  angular.handle(req).then(async (response) => {
    if (response) {
      await writeResponseToNodeResponse(response, res);
    } else {
      res.status(404).send('Página no encontrada');
    }
  }).catch(next);
});
app.use((_error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  res.status(500).send('No pudimos abrir CotiTrama. Intenta de nuevo.');
});

if (isMainModule(import.meta.url)) {
  const port = Number(process.env['PORT'] || 4200);
  app.listen(port, '127.0.0.1', () => console.log(`CotiTrama: http://127.0.0.1:${port}`));
}
export const reqHandler = createNodeRequestHandler(app);
