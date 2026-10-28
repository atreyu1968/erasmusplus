import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const publicDir = fileURLToPath(new URL('../public/', import.meta.url));
const mime = {
  '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webmanifest': 'application/manifest+json; charset=utf-8',
};

// The legacy app is server-rendered, not an SPA. Preserve native navigation,
// POST/redirect/GET, file uploads/downloads, passkeys and all response headers.
export async function webHandler(req, res) {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const asset = path.resolve(publicDir, '.' + pathname);
    if ((req.method === 'GET' || req.method === 'HEAD') &&
        asset.startsWith(publicDir) && mime[path.extname(asset)] &&
        (await stat(asset).catch(() => null))?.isFile()) {
      const bytes = await readFile(asset);
      res.writeHead(200, {
        'Content-Type': mime[path.extname(asset)],
        'Content-Length': bytes.length,
        'Cache-Control': pathname === '/sw.js' ? 'no-store' : 'no-cache',
        'X-Content-Type-Options': 'nosniff',
        ...(pathname === '/sw.js' ? { 'Service-Worker-Allowed': '/' } : {}),
      });
      res.end(req.method === 'HEAD' ? undefined : bytes);
      return;
    }
    // Internal service calls use the workspace's shared proxy, never a fixed
    // artifact port. Browser requests retain the existing same-origin URLs.
    const upstream = http.request({
      hostname: 'localhost', port: 80, method: req.method,
      path: '/api/legacy' + req.url, headers: req.headers,
    }, response => {
      res.writeHead(response.statusCode, response.headers);
      response.pipe(res);
      response.on('error', () => res.destroy());
    });
    upstream.on('error', () => {
      if (!res.headersSent) {
        res.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
        res.end('No se puede conectar con la plataforma. Inténtalo de nuevo en unos instantes.');
      } else res.destroy();
    });
    req.on('aborted', () => upstream.destroy());
    res.on('close', () => { if (!res.writableFinished) upstream.destroy(); });
    req.pipe(upstream);
  } catch {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Solicitud no válida.');
  }
}

const port = Number(process.env.PORT);
if (!Number.isInteger(port) || port <= 0) throw new Error('PORT is required');
http.createServer(webHandler).listen(port, '0.0.0.0');
