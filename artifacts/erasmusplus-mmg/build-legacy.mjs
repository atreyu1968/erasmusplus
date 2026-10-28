import { cp, mkdir } from 'node:fs/promises';
await mkdir('dist/src', { recursive: true });
await cp('public', 'dist/public', { recursive: true });
await cp('src/web-server.mjs', 'dist/src/web-server.mjs');
