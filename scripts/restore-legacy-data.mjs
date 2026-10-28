import { existsSync, realpathSync } from 'node:fs';
import { cp, mkdir, mkdtemp, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import { DatabaseSync, backup } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

// Local data is intentionally not committed. Restore it on the main workspace
// after merging, and never replace an already established data directory.
export async function restoreLegacyData(root = fileURLToPath(new URL('../', import.meta.url))) {
  const source = path.join(root, '.migration-backup/data');
  const destination = path.join(root, 'data');
  if (existsSync(destination) || !existsSync(path.join(source, 'erasmus.sqlite3'))) return false;
  const staging = await mkdtemp(path.join(root, '.mmg-data-restore-'));
  let db;
  try {
    await mkdir(staging, { mode: 0o700 });
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
  }
  try {
    // SQLite's backup API includes committed WAL content. Plainly copying only
    // erasmus.sqlite3 would discard records still present in its WAL.
    db = new DatabaseSync(path.join(source, 'erasmus.sqlite3'), { readOnly: true });
    await backup(db, path.join(staging, 'erasmus.sqlite3'));
    if (existsSync(path.join(source, 'documents'))) {
      await cp(path.join(source, 'documents'), path.join(staging, 'documents'), { recursive: true });
    }
    await rename(staging, destination);
    return true;
  } finally {
    db?.close();
    await rm(staging, { recursive: true, force: true });
  }
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await restoreLegacyData();
}
