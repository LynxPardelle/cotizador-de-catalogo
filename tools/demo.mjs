import { createServer, request } from 'node:http';
import { once } from 'node:events';
import { createDemoServer } from '../services/local-server.mjs';
import { handler } from '../web/dist/lambda/index.mjs';

const backend = await createDemoServer();
backend.listen(0, '127.0.0.1');
await once(backend, 'listening');
const backendPort = backend.address().port;
const port = Number(process.env.DEMO_PORT || 4200);
const origin = `http://127.0.0.1:${port}`;

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, origin);
    if (url.pathname === '/config.json') {
      res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
      res.end(JSON.stringify({
        productName: 'CotiTrama', environment: 'local', demo: true,
        auth: { domain: '', clientId: '', redirectUri: `${origin}/auth/callback`, logoutUri: `${origin}/` },
      }));
      return;
    }
    if (url.pathname.startsWith('/api/')) {
      const upstream = request({
        host: '127.0.0.1', port: backendPort, path: req.url, method: req.method,
        headers: { ...req.headers, host: `127.0.0.1:${backendPort}` },
      }, (response) => {
        res.writeHead(response.statusCode, response.headers);
        response.pipe(res);
      });
      upstream.on('error', () => { res.writeHead(502); res.end('No pudimos completar la solicitud.'); });
      req.pipe(upstream);
      return;
    }
    const result = await handler({
      version: '2.0', rawPath: url.pathname, rawQueryString: url.search.slice(1),
      headers: { ...req.headers, host: `127.0.0.1:${port}` },
      requestContext: { requestId: 'demo', http: { method: req.method, path: url.pathname, sourceIp: '127.0.0.1', protocol: 'HTTP/1.1' } },
      isBase64Encoded: false,
    }, {});
    res.writeHead(result.statusCode, { ...result.headers, ...(result.cookies ? { 'set-cookie': result.cookies } : {}) });
    res.end(result.isBase64Encoded ? Buffer.from(result.body || '', 'base64') : result.body);
  } catch (error) {
    console.error('La solicitud de demo no pudo completarse:', error.message);
    if (!res.headersSent) res.writeHead(500);
    res.end('No pudimos abrir la demostración.');
  }
});
server.listen(port, '127.0.0.1');
await once(server, 'listening');
console.log(`CotiTrama demo: ${origin} (sólo datos sintéticos; almacenamiento temporal).`);
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => { server.close(); backend.close(); });
}
