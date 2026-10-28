import { cp, mkdir } from 'node:fs/promises';
await mkdir('dist/lib', { recursive: true });
await cp('src/legacy', 'dist/legacy', { recursive: true });
await cp('src/public', 'dist/public', { recursive: true });
await cp('src/legacy-entry.mjs', 'dist/legacy-entry.mjs');
await cp('src/lib/runtime-logger.mjs', 'dist/lib/runtime-logger.mjs');
