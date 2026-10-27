import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';

test('Las convocatorias separan destinos, cuentas y candidaturas conservando el historial',async()=>{
 const data=mkdtempSync(path.join(os.tmpdir(),'mmg-editions-'));
 const port=41000+Math.floor(Math.random()*12000);
 const base='http://127.0.0.1:'+port;
 const env={...process.env,MMG_DATA_DIR:data,PORT:String(port),HOST:'127.0.0.1',
  MMG_ENV:'development',MMG_SECURE_COOKIE:'0',
  MMG_SECRET:'test-MMG-editions-secure-random-phrase-ABC-0123456789',
  MMG_ENABLE_REGISTRATION:'0',MMG_PRIVACY_VERSION:'PENDIENTE_REVISION'};
 let child;
 try{
  const seedScript=[
   "import './src/feature-db.mjs';",
   "import {get,run} from './src/db.mjs';",
   "import {hashPassword} from './src/auth.mjs';",
   "const edition=get('SELECT id FROM erasmus_editions WHERE is_active=1');",
   "const hash=await hashPassword('Password-prueba-2026!');",
   "run(\"INSERT INTO users(role,username,pass_hash,first_name,last_name,institutional_email,email_verified_at,status) VALUES ('coordinator','EDITIONADMIN',?,'Coordinación','Prueba','admin@canariaseducacion.es',CURRENT_TIMESTAMP,'approved')\",hash);",
   "const student=run(\"INSERT INTO users(role,username,pass_hash,first_name,last_name,birth_date,cial,institutional_email,email_verified_at,status,professional_family,center,edition_id) VALUES ('student','EDITIONSTUDENT',?,'Alumna','Prueba','2004-05-06','EDITIONSTUDENT','student@canariaseducacion.es',CURRENT_TIMESTAMP,'approved','Administración y gestión','IES Manuel Martín González',?)\",hash,edition.id);",
   "const otherStudent=run(\"INSERT INTO users(role,username,pass_hash,first_name,last_name,birth_date,cial,institutional_email,email_verified_at,status,professional_family,center,edition_id) VALUES ('student','EDITIONSTAY',?,'Alumna','SinMover','2004-05-06','EDITIONSTAY','stay@canariaseducacion.es',CURRENT_TIMESTAMP,'approved','Administración y gestión','IES Manuel Martín González',?)\",hash,edition.id);",
   "const teacher=run(\"INSERT INTO users(role,username,pass_hash,first_name,last_name,birth_date,dni,institutional_email,email_verified_at,status,center,edition_id) VALUES ('teacher','EDITIONTEACHER',?,'Docente','Prueba','1980-05-06','EDITIONTEACHER','teacher@canariaseducacion.es',CURRENT_TIMESTAMP,'approved','IES Manuel Martín González',?)\",hash,edition.id);",
   "console.log('PARTICIPANT_ID='+student.lastInsertRowid);",
   "console.log('STAY_ID='+otherStudent.lastInsertRowid);",
   "console.log('TEACHER_ID='+teacher.lastInsertRowid);"
  ].join('\n');
  const seed=spawnSync(process.execPath,['--input-type=module','-e',seedScript],{cwd:process.cwd(),env,encoding:'utf8',timeout:30000});
  assert.equal(seed.status,0,seed.stderr);
  const participantId=seed.stdout.match(/PARTICIPANT_ID=(\d+)/)?.[1];
  const stayId=seed.stdout.match(/STAY_ID=(\d+)/)?.[1];
  const teacherId=seed.stdout.match(/TEACHER_ID=(\d+)/)?.[1];
  assert.ok(participantId&&stayId&&teacherId,'Las cuentas ficticias deben quedar preparadas.');

  child=spawn(process.execPath,['src/server.mjs'],{cwd:process.cwd(),env,stdio:['ignore','pipe','pipe']});
  let stderr='';child.stderr.on('data',chunk=>stderr+=chunk);
  let started=false;
  for(let i=0;i<120;i++){
   try{const response=await fetch(base+'/healthz');if(response.ok){started=true;break;}}catch{}
   if(child.exitCode!==null)throw Error(stderr||'El servidor terminó antes de arrancar.');
   await new Promise(resolve=>setTimeout(resolve,100));
  }
  assert.ok(started,'El servidor no arrancó: '+stderr);

  const visitor=await fetch(base+'/');
  const visitorHtml=await visitor.text();
  assert.equal(visitor.status,200);
  assert.doesNotMatch(visitorHtml,/class="sidebar"|class="sidebar-toggle"/);
  assert.match(visitorHtml,/class="brand-logo" src="\/erasmus-logo\.png"/);
  assert.match(visitorHtml,/rel="icon" type="image\/png"[^>]+erasmus-favicon-192\.png/);
   assert.match(visitorHtml,/viseu-cathedral\.jpg/);
   assert.match(visitorHtml,/CC BY 2\.0/);
  for(const asset of ['erasmus-logo.png','erasmus-favicon-192.png','erasmus-favicon-512.png']){
   const response=await fetch(base+'/'+asset);
   assert.equal(response.status,200,asset+' debe servirse correctamente');
   assert.match(response.headers.get('content-type')||'',/image\/png/);
  }
  const manifest=await (await fetch(base+'/manifest.webmanifest')).json();
  assert.ok(manifest.icons.some(icon=>icon.src==='/erasmus-favicon-192.png'));
  const photo=await fetch(base+'/images/viseu-cathedral.jpg');
  assert.equal(photo.status,200);
  assert.match(photo.headers.get('content-type')||'',/image\/jpeg/);

  async function login(username){
   const page=await fetch(base+'/acceso');
   const html=await page.text();
   const csrf=html.match(/name="csrf" value="([a-f0-9]+)"/)?.[1];
   const csrfCookie=page.headers.get('set-cookie')?.split(';')[0];
   assert.ok(csrf&&csrfCookie);
   const response=await fetch(base+'/acceso',{method:'POST',redirect:'manual',
    headers:{'Content-Type':'application/x-www-form-urlencoded',Cookie:csrfCookie},
    body:new URLSearchParams({username,password:'Password-prueba-2026!',csrf})});
   assert.equal(response.status,303);
   const session=response.headers.get('set-cookie')?.split(';')[0];
   assert.ok(session);
   return {cookie:csrfCookie+'; '+session};
  }
  const coordinator=await login('EDITIONADMIN');
  const participant=await login('EDITIONSTUDENT');
  const initialApplicationPage=await fetch(base+'/candidatura',{headers:{Cookie:participant.cookie}});
  let html=await initialApplicationPage.text();
  const initialCsrf=html.match(/name="csrf" value="([a-f0-9]+)"/)?.[1];
  const oldEditionId=html.match(/name="edition_id" value="(\d+)"/)?.[1];
  assert.ok(initialCsrf&&oldEditionId);
  assert.match(html,/Viseu/);

  const oldDraft=await fetch(base+'/candidatura',{method:'POST',headers:{
   'Content-Type':'application/x-www-form-urlencoded',Cookie:participant.cookie},
   body:new URLSearchParams({csrf:initialCsrf,edition_id:oldEditionId,
    mobility:'long|Movilidad larga Dual-Erasmus+',family:'Administración y gestión',
    destination:'Oporto',motivation:'Quiero mejorar mi formación profesional y aprender en un entorno internacional.',mec:'No',intent:'draft'})});
  assert.match(await oldDraft.text(),/Borrador guardado correctamente/);

  const adminPage=await fetch(base+'/coordinacion/ediciones',{headers:{Cookie:coordinator.cookie}});
  html=await adminPage.text();
  assert.match(html,/class="sidebar-pin"/);
  assert.doesNotMatch(html,/sidebar-toggle/);
  const adminCsrf=html.match(/name="csrf" value="([a-f0-9]+)"/)?.[1];
  assert.ok(adminCsrf);
  const created=await fetch(base+'/coordinacion/ediciones',{method:'POST',headers:{
   'Content-Type':'application/x-www-form-urlencoded',Cookie:coordinator.cookie},
   body:new URLSearchParams({csrf:adminCsrf,action:'create-edition',label:'2027–2028'})});
  html=await created.text();
  const destinationSection=html.slice(html.indexOf('Destinos de 2027–2028'));
  const newEditionId=destinationSection.match(/name="edition_id" value="(\d+)"/)?.[1];
  assert.ok(newEditionId&&newEditionId!==oldEditionId,'La edición nueva debe crearse aparte.');

  const destinationBody=new URLSearchParams({csrf:adminCsrf,action:'create-destination',
   edition_id:newEditionId,name:'Lisboa',country:'Portugal',
   description:'Prácticas de formación profesional en Lisboa.',modes:'long',families:'Administración y gestión'});
  const destinationCreated=await fetch(base+'/coordinacion/ediciones',{method:'POST',headers:{
   'Content-Type':'application/x-www-form-urlencoded',Cookie:coordinator.cookie},body:destinationBody});
  assert.match(await destinationCreated.text(),/Lisboa/);
  const activated=await fetch(base+'/coordinacion/ediciones',{method:'POST',headers:{
   'Content-Type':'application/x-www-form-urlencoded',Cookie:coordinator.cookie},
   body:new URLSearchParams({csrf:adminCsrf,action:'activate-edition',edition_id:newEditionId})});
  assert.match(await activated.text(),/ya está vigente/);

  const newVisitor=await (await fetch(base+'/')).text();
  assert.match(newVisitor,/2027–2028/);
  assert.match(newVisitor,/Lisboa/);
  assert.doesNotMatch(newVisitor,/Viseu/);

  const unassignedPage=await fetch(base+'/candidatura',{headers:{Cookie:participant.cookie}});
  html=await unassignedPage.text();
  assert.match(html,/pertenece a/);
  assert.doesNotMatch(html,/name="edition_id"/);
  const forged=await fetch(base+'/candidatura',{method:'POST',headers:{
   'Content-Type':'application/x-www-form-urlencoded',Cookie:participant.cookie},
   body:new URLSearchParams({csrf:initialCsrf,edition_id:newEditionId,
    mobility:'long|Movilidad larga Dual-Erasmus+',family:'Administración y gestión',
    destination:'Lisboa',motivation:'Quiero mejorar mi formación profesional y aprender en un entorno internacional.',mec:'No',intent:'submit'})});
  assert.match(await forged.text(),/no está asignada a la convocatoria vigente/);

  const transferPage=await fetch(base+'/coordinacion/ediciones?origen='+oldEditionId+'&destino='+newEditionId,
   {headers:{Cookie:coordinator.cookie}});
  html=await transferPage.text();
  assert.match(html,/Alumna Prueba/);
  assert.match(html,/Docente Prueba/);
  assert.match(html,/Alumna SinMover/);
  const preview=await fetch(base+'/coordinacion/ediciones',{method:'POST',headers:{
   'Content-Type':'application/x-www-form-urlencoded',Cookie:coordinator.cookie},
   body:new URLSearchParams([
    ['csrf',adminCsrf],['action','preview-edition-transfer'],['source_edition_id',oldEditionId],
    ['destination_edition_id',newEditionId],['account_ids',participantId],['account_ids',teacherId]
   ])});
  html=await preview.text();
  assert.match(html,/Se cambiarán 2 cuentas/);
  assert.match(html,/Confirmar traslado/);
  const confirm=await fetch(base+'/coordinacion/ediciones',{method:'POST',headers:{
   'Content-Type':'application/x-www-form-urlencoded',Cookie:coordinator.cookie},
   body:new URLSearchParams([
    ['csrf',adminCsrf],['action','confirm-edition-transfer'],['source_edition_id',oldEditionId],
    ['destination_edition_id',newEditionId],['account_ids',participantId],['account_ids',teacherId]
   ])});
  html=await confirm.text();
  assert.match(html,/2 cuentas trasladadas/);
  assert.match(html,/candidaturas históricas se mantienen/);

  const assignedPage=await fetch(base+'/candidatura',{headers:{Cookie:participant.cookie}});
  html=await assignedPage.text();
  assert.match(html,/Lisboa/);
  assert.match(html,new RegExp('name="edition_id" value="'+newEditionId+'"'));
  const newDraft=await fetch(base+'/candidatura',{method:'POST',headers:{
   'Content-Type':'application/x-www-form-urlencoded',Cookie:participant.cookie},
   body:new URLSearchParams({csrf:initialCsrf,edition_id:newEditionId,
    mobility:'long|Movilidad larga Dual-Erasmus+',family:'Administración y gestión',
    destination:'Lisboa',motivation:'Quiero mejorar mi formación profesional y aprender en un entorno internacional.',mec:'No',intent:'draft'})});
  assert.match(await newDraft.text(),/Borrador guardado correctamente/);
  const dashboard=await (await fetch(base+'/panel',{headers:{Cookie:participant.cookie}})).text();
  assert.match(dashboard,/2026–2027 · Oporto/);
  assert.match(dashboard,/2027–2028 · Lisboa/);
  const inspect=spawnSync(process.execPath,['--input-type=module','-e',[
   "import {all} from './src/db.mjs';",
   "const ids=process.env.TEST_IDS.split(',').map(Number);",
   "console.log(JSON.stringify({users:all('SELECT id,edition_id FROM users WHERE id IN (?,?,?) ORDER BY id',...ids),applications:all('SELECT edition_id,status FROM applications WHERE user_id=? ORDER BY edition_id',ids[0]),audit:all(\"SELECT action,target_id FROM audit WHERE action LIKE 'admin_user_edition_bulk_reassigned_%' ORDER BY target_id\")}));"
  ].join('\n')],{cwd:process.cwd(),env:{...env,TEST_IDS:[participantId,stayId,teacherId].join(',')},encoding:'utf8',timeout:30000});
  assert.equal(inspect.status,0,inspect.stderr);
  const state=JSON.parse(inspect.stdout.trim());
  assert.deepEqual(state.users.map(user=>[user.id,user.edition_id]),[
   [Number(participantId),Number(newEditionId)],[Number(stayId),Number(oldEditionId)],[Number(teacherId),Number(newEditionId)]
  ].sort((a,b)=>a[0]-b[0]));
  assert.deepEqual(state.applications.map(application=>application.edition_id),[Number(oldEditionId),Number(newEditionId)]);
  assert.deepEqual(state.audit.map(entry=>entry.target_id).sort((a,b)=>a-b),[Number(participantId),Number(teacherId)].sort((a,b)=>a-b));
  assert.ok(state.audit.every(entry=>entry.action.includes('_'+oldEditionId+'_to_'+newEditionId)));
 }finally{
  if(child?.pid){child.kill('SIGTERM');await new Promise(resolve=>setTimeout(resolve,80));}
  rmSync(data,{recursive:true,force:true});
 }
});
