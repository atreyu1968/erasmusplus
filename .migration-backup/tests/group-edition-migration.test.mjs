import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';

test('Desempata grupos heredados a la edición vigente y aísla a la edición perdedora',()=>{
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
    "CREATE TABLE users(id INTEGER PRIMARY KEY,role TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'approved',edition_id INTEGER REFERENCES erasmus_editions(id),first_name TEXT NOT NULL,last_name TEXT NOT NULL);",
    "INSERT INTO users(id,role,status,edition_id,first_name,last_name) VALUES (1,'student','approved',2,'Edición','Perdedora Uno'),(2,'teacher','approved',2,'Edición','Perdedora Dos'),(3,'student','approved',1,'Edición','Vigente Uno'),(4,'teacher','approved',1,'Edición','Vigente Dos');",
   "CREATE TABLE mobility_groups(id INTEGER PRIMARY KEY,name TEXT NOT NULL,destination TEXT NOT NULL,type TEXT NOT NULL CHECK(type IN ('short','long','shadowing')),created_at TEXT DEFAULT CURRENT_TIMESTAMP);",
   "INSERT INTO mobility_groups(id,name,destination,type) VALUES (1,'Grupo heredado','Oporto','long');",
   "CREATE TABLE group_members(group_id INTEGER NOT NULL,user_id INTEGER NOT NULL,PRIMARY KEY(group_id,user_id));",
    "INSERT INTO group_members(group_id,user_id) VALUES (1,1),(1,2),(1,3),(1,4);",
   "`);",
   "raw.close();",
   "await import('./src/feature-db.mjs');",
    "const {get,run}=await import('./src/db.mjs');",
    "await import('./src/feature-agenda.mjs');",
    "const {agendaRoutes}=await import('./src/feature-agenda.mjs');",
    "const {socialRoutes}=await import('./src/feature-social.mjs');",
   "const migrated=get('SELECT edition_id FROM mobility_groups WHERE id=1');",
    "run(\"INSERT INTO mobility_events(group_id,kind,title,start_time,created_by) VALUES (1,'activity','Actividad de la edición vigente','2027-05-01T10:00',3)\");",
    "run(\"INSERT INTO messages(sender_id,group_id,content) VALUES (3,1,'Chat de la edición vigente')\");",
   "let rejectsMissingEdition=false;",
   "try{run(\"INSERT INTO mobility_groups(name,destination,type) VALUES ('Sin edición','Viseu','long')\")}catch(error){rejectsMissingEdition=/edition/i.test(error.message)}",
    "async function page(route,user,chat=false){",
    " let result={};",
    " const req={auth:{user},url:'http://localhost'+route};",
    " const api={mustLogin:()=>true,csrf:()=>'',layout:(_req,title,html)=>{result={status:200,title,html}},error:(_req,status,message)=>{result={status,message}}};",
    " await (chat?socialRoutes(req,'/chat','GET',api):agendaRoutes(req,route,'GET',api));",
    " return result;",
    "}",
    "const losingUsers=[get('SELECT * FROM users WHERE id=1'),get('SELECT * FROM users WHERE id=2')];",
    "const losing=await Promise.all(losingUsers.map(async user=>({",
    " agenda:await page('/agenda',user),agendaDetail:await page('/agenda/grupo/1',user),chat:await page('/chat?grupo=1',user,true)",
    "})));",
    "const currentUser=get('SELECT * FROM users WHERE id=3');",
    "const current={agenda:await page('/agenda',currentUser),agendaDetail:await page('/agenda/grupo/1',currentUser),chat:await page('/chat?grupo=1',currentUser,true)};",
    "console.log(JSON.stringify({editionId:migrated.edition_id,rejectsMissingEdition,losing,current}));"
  ].join('\n')],{env,encoding:'utf8',timeout:20000});
  assert.equal(result.status,0,result.stderr);
  const outcome=JSON.parse(result.stdout.trim());
  assert.equal(outcome.editionId,1,'el empate debe resolverse a favor de la edición vigente');
  assert.equal(outcome.rejectsMissingEdition,true);
  for(const account of outcome.losing){
   assert.equal(account.agenda.status,200);
   assert.doesNotMatch(account.agenda.html,/Grupo heredado/);
   assert.equal(account.agendaDetail.status,404);
   assert.equal(account.chat.status,404);
  }
  assert.equal(outcome.current.agenda.status,200);
  assert.match(outcome.current.agenda.html,/Grupo heredado/);
  assert.equal(outcome.current.agendaDetail.status,200);
  assert.match(outcome.current.agendaDetail.html,/Actividad de la edición vigente/);
  assert.equal(outcome.current.chat.status,200);
  assert.match(outcome.current.chat.html,/Chat de la edición vigente/);
 }finally{
  rmSync(data,{force:true,recursive:true});
 }
});
