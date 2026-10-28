import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, chmodSync } from 'node:fs';
import path from 'node:path';

try { process.loadEnvFile('.env'); } catch (error) {
  if (error.code !== 'ENOENT') throw error;
}

const directory = path.resolve(process.env.MMG_DATA_DIR || './data');
mkdirSync(directory, { recursive: true, mode: 0o700 });
try { chmodSync(directory, 0o700); } catch {}

export const db = new DatabaseSync(path.join(directory, 'erasmus.sqlite3'));
db.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;');
db.exec(
  "CREATE TABLE IF NOT EXISTS users (" +
  "id INTEGER PRIMARY KEY, role TEXT NOT NULL CHECK(role IN ('coordinator','teacher','student'))," +
  "username TEXT NOT NULL UNIQUE, pass_hash TEXT NOT NULL, first_name TEXT NOT NULL," +
  "last_name TEXT NOT NULL, birth_date TEXT, dni TEXT, cial TEXT, phone TEXT," +
  "guardian_phone TEXT, institutional_email TEXT NOT NULL, gmail TEXT, professional_family TEXT," +
  "center TEXT, studies TEXT, modules TEXT," +
  "privacy_version TEXT, status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','disabled'))," +
  "created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, reviewed_at TEXT, reviewed_by INTEGER REFERENCES users(id));" +
  "CREATE TABLE IF NOT EXISTS sessions (" +
  "token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE," +
  "csrf TEXT NOT NULL, expires_at INTEGER NOT NULL);" +
  "CREATE TABLE IF NOT EXISTS audit (" +
  "id INTEGER PRIMARY KEY, actor_id INTEGER REFERENCES users(id)," +
  "action TEXT NOT NULL, target_id INTEGER, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);" +
  "CREATE INDEX IF NOT EXISTS idx_user_status ON users(status,role);"
);

db.exec(
  "CREATE TABLE IF NOT EXISTS configuration (name TEXT PRIMARY KEY, encrypted_value TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);" +
  "CREATE TABLE IF NOT EXISTS verification_tokens (token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at INTEGER NOT NULL);" +
  "CREATE INDEX IF NOT EXISTS verification_by_user ON verification_tokens(user_id);"
);
if (!db.prepare('PRAGMA table_info(users)').all().some(x=>x.name==='email_verified_at')) {
  db.exec('ALTER TABLE users ADD COLUMN email_verified_at TEXT');
}

export const get = (sql, ...params) => db.prepare(sql).get(...params);
export const all = (sql, ...params) => db.prepare(sql).all(...params);
export const run = (sql, ...params) => db.prepare(sql).run(...params);
export function audit(actor, action, target = null) {
  run('INSERT INTO audit(actor_id,action,target_id) VALUES (?,?,?)', actor || null, action, target);
}
