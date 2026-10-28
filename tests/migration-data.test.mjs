import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { restoreLegacyData } from '../scripts/restore-legacy-data.mjs';

test('migration restores WAL records and private documents once, without replacing existing data', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'mmg-port-'));
  const source = path.join(root, '.migration-backup/data');
  await mkdir(path.join(source, 'documents'), { recursive: true });
  const db = new DatabaseSync(path.join(source, 'erasmus.sqlite3'));
  try {
    db.exec("PRAGMA journal_mode=WAL; CREATE TABLE example(id INTEGER PRIMARY KEY); INSERT INTO example VALUES(7)");
    await writeFile(path.join(source, 'documents/example.txt'), 'Fictional attachment');
    assert.equal(await restoreLegacyData(root), true);
    const restored = new DatabaseSync(path.join(root, 'data/erasmus.sqlite3'));
    try {
      assert.equal(restored.prepare('SELECT id FROM example').get().id, 7);
      assert.equal(await readFile(path.join(root, 'data/documents/example.txt'), 'utf8'), 'Fictional attachment');
      restored.exec('INSERT INTO example VALUES(8)');
      assert.equal(await restoreLegacyData(root), false);
      assert.equal(restored.prepare('SELECT count(*) AS n FROM example').get().n, 2);
    } finally { restored.close(); }
  } finally {
    db.close();
    await rm(root, { recursive: true, force: true });
  }
});
