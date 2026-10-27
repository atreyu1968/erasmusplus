import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';

test('Asigna edición a grupos heredados y rechaza grupos sin convocatoria',()=>{
 const data=mkdtempSync(path.join(os.tmpdir(),'mmg-group-editions-'));
 const env={...process.env,MMG_DATA_DIR:data,MMG_SECRET:'group-edition-migration-test-secret-0123456789'};
 try {
  const result=spawnSync(process.execPath,['--input-type=module','-e',[
   "import {DatabaseSync} from 'node:sqlite';",
   "import path from 'node:path';",
   "const raw=new DatabaseSync(path.join(process.env.MMG_DATA_DIR,'erasmus.sqlite3'));",
   "raw.exec(`",
   "CREATE TABLE erasmus_editions(id INTEGER PRIMARY KEY,label TEXT NOT NULL UNIQUE,is_active INTEGER NOT NULL DEFAULT 0,created_at TEXT DEFAULT CURRENT_TIMESTAMP,updated_at TEXT DEFAULT CURRENT_TIMESTAMP);",
   "INSERT INTO erasmus_editions(id,label,is_active) VALUES (1,'2026–2027',1),(2,'2027–2028',0);",
   "CREATE TABLE users(id INTEGER PRIMARY KEY,role TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'approved',edition_id INTEGER REFERENCES erasmus_editions(id));",
   "INSERT INTO users(id,role,status,edition_id) VALUES (1,'student','approved',2),(2,'teacher','approved',2),(3,'student','approved',1);",
   "CREATE TABLE mobility_groups(id INTEGER PRIMARY KEY,name TEXT NOT NULL,destination TEXT NOT NULL,type TEXT NOT NULL CHECK(type IN ('short','long','shadowing')),created_at TEXT DEFAULT CURRENT_TIMESTAMP);",
   "INSERT INTO mobility_groups(id,name,destination,type) VALUES (1,'Grupo heredado','Oporto','long');",
   "CREATE TABLE group_members(group_id INTEGER NOT NULL,user_id INTEGER NOT NULL,PRIMARY KEY(group_id,user_id));",
   "INSERT INTO group_members(group_id,user_id) VALUES (1,1),(1,2),(1,3);",
   "`);",
   "raw.close();",
   "await import('./src/feature-db.mjs');",
   "const {get,run}=await import('./src/db.mjs');",
   "const migrated=get('SELECT edition_id FROM mobility_groups WHERE id=1');",
   "let rejectsMissingEdition=false;",
   "try{run(\"INSERT INTO mobility_groups(name,destination,type) VALUES ('Sin edición','Viseu','long')\")}catch(error){rejectsMissingEdition=/edition/i.test(error.message)}",
   "console.log(JSON.stringify({editionId:migrated.edition_id,rejectsMissingEdition}));"
  ].join('\n')],{env,encoding:'utf8',timeout:20000});
  assert.equal(result.status,0,result.stderr);
  assert.deepEqual(JSON.parse(result.stdout.trim()),{editionId:2,rejectsMissingEdition:true});
 }finally{
  rmSync(data,{force:true,recursive:true});
 }
});
