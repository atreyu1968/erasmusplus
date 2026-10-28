import http from 'node:http';
import { fileURLToPath } from 'node:url';

// Resolve local storage consistently, regardless of the workflow's cwd.
process.chdir(fileURLToPath(new URL('../../../', import.meta.url)));
if (!process.env.MMG_SECRET && process.env.SESSION_SECRET) {
  process.env.MMG_SECRET = process.env.SESSION_SECRET;
}
const { handler } = await import('./legacy/server.mjs');
const { startMailWorker } = await import('./legacy/features.mjs');
const { logger } = await import('./lib/runtime-logger.mjs');
const port = Number(process.env.PORT);
if (!Number.isInteger(port) || port <= 0) throw new Error('PORT is required');

http.createServer((req, res) => {
  if (req.url === '/api/healthz') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({ status: 'ok' }));
    return;
  }
  // Keep the legacy SSR/form protocol and mobile JSON API under the shared
  // gateway without changing cookies, CSRF tokens, or streaming request bodies.
  if (req.url === '/api/mobile' || req.url.startsWith('/api/mobile/')) {
    req.url = req.url.slice('/api'.length) || '/';
    void handler(req, res);
    return;
  }
  if (req.url === '/api/legacy' || req.url.startsWith('/api/legacy/')) {
    req.url = req.url.slice('/api/legacy'.length) || '/';
    void handler(req, res);
    return;
  }
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Not found');
}).listen(port, '0.0.0.0', () => logger.info({ port }, 'Erasmus+ API ready'));
startMailWorker();
