import { db } from './db.mjs';

db.exec(
  "CREATE TABLE IF NOT EXISTS applications ("+
  "id INTEGER PRIMARY KEY,user_id INTEGER NOT NULL REFERENCES users(id),mobility TEXT NOT NULL CHECK(mobility IN ('short','long','shadowing')),"+
  "family TEXT NOT NULL,destination TEXT NOT NULL,motivation TEXT NOT NULL,mec TEXT NOT NULL DEFAULT 'na',"+
  "status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','submitted')),created_at TEXT DEFAULT CURRENT_TIMESTAMP,"+
  "submitted_at TEXT,pdf_file TEXT,pdf_sha256 TEXT);" +
  "CREATE UNIQUE INDEX IF NOT EXISTS app_unique ON applications(user_id,mobility);" +
  "CREATE TABLE IF NOT EXISTS participant_commitments ("+
  "id INTEGER PRIMARY KEY,user_id INTEGER NOT NULL REFERENCES users(id),version TEXT NOT NULL,full_name TEXT NOT NULL,"+
  "accepted_at TEXT DEFAULT CURRENT_TIMESTAMP,document_path TEXT NOT NULL,sha256 TEXT NOT NULL,"+
  "UNIQUE(user_id,version));" +
  "CREATE TABLE IF NOT EXISTS notices ("+
  "id INTEGER PRIMARY KEY,author_id INTEGER NOT NULL REFERENCES users(id),title TEXT NOT NULL,body TEXT NOT NULL,"+
  "audience TEXT NOT NULL CHECK(audience IN ('all','teacher','student')),created_at TEXT DEFAULT CURRENT_TIMESTAMP);" +
  "CREATE TABLE IF NOT EXISTS files ("+
  "id INTEGER PRIMARY KEY,owner_id INTEGER REFERENCES users(id),notice_id INTEGER REFERENCES notices(id) ON DELETE SET NULL,"+
  "group_id INTEGER,original_name TEXT NOT NULL,stored_name TEXT NOT NULL UNIQUE,mime TEXT NOT NULL,bytes INTEGER NOT NULL,"+
  "sha256 TEXT NOT NULL,created_at TEXT DEFAULT CURRENT_TIMESTAMP);" +
  "CREATE TABLE IF NOT EXISTS messages ("+
  "id INTEGER PRIMARY KEY,sender_id INTEGER NOT NULL REFERENCES users(id),receiver_id INTEGER REFERENCES users(id),"+
  "group_id INTEGER,content TEXT NOT NULL,created_at TEXT DEFAULT CURRENT_TIMESTAMP,"+
  "CHECK ((receiver_id IS NOT NULL AND group_id IS NULL) OR (receiver_id IS NULL AND group_id IS NOT NULL)));" +
  "CREATE TABLE IF NOT EXISTS mobility_groups ("+
  "id INTEGER PRIMARY KEY,name TEXT NOT NULL,destination TEXT NOT NULL,type TEXT NOT NULL CHECK(type IN ('short','long','shadowing')),"+
  "created_at TEXT DEFAULT CURRENT_TIMESTAMP);" +
  "CREATE TABLE IF NOT EXISTS group_members ("+
  "group_id INTEGER NOT NULL REFERENCES mobility_groups(id) ON DELETE CASCADE,user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,"+
  "PRIMARY KEY(group_id,user_id));" +
  "CREATE TABLE IF NOT EXISTS outbox ("+
  "id INTEGER PRIMARY KEY,to_email TEXT NOT NULL,subject TEXT NOT NULL,body TEXT NOT NULL,"+
  "status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','sent','failed')),"+
  "attempts INTEGER NOT NULL DEFAULT 0,last_error TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP,sent_at TEXT);" +
  "CREATE TABLE IF NOT EXISTS password_reset_tokens ("+
  "token_hash TEXT PRIMARY KEY,user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,expires_at INTEGER NOT NULL);" +
  "CREATE INDEX IF NOT EXISTS idx_app_user ON applications(user_id);" +
  "CREATE INDEX IF NOT EXISTS idx_notice_audience ON notices(audience);" +
  "CREATE INDEX IF NOT EXISTS idx_messages_private ON messages(sender_id,receiver_id);" +
  "CREATE INDEX IF NOT EXISTS idx_messages_group ON messages(group_id);" +
  "CREATE INDEX IF NOT EXISTS idx_outbox_status ON outbox(status,attempts);"
);
