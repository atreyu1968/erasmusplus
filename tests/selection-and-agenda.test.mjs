import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';

test('Valoración manual y agenda: seguridad por perfil, grupo y CSRF',async()=>{
 const data=mkdtempSync(path.join(os.tmpdir(),'mmg-selection-'));
 const port=30000+Math.floor(Math.random()*22000),base='http://127.0.0.1:'+port;
 const password='MMG-PasswordPrueba-2026!';
 const env={...process.env,MMG_DATA_DIR:data,HOST:'127.0.0.1',PORT:String(port),
  MMG_ENV:'development',MMG_SECURE_COOKIE:'0',
  MMG_SECRET:'testing-features-long-secret-2026-01234567890123456789',
  MMG_ENABLE_REGISTRATION:'0',MMG_PRIVACY_VERSION:'PENDIENTE_REVISION',
  MMG_ADMIN_USERNAME:'ADMIN',MMG_ADMIN_PASSWORD:password,MMG_ADMIN_EMAIL:'admin@example.edu'};
 let child;
 try {
  const created=spawnSync(process.execPath,['scripts/init-admin.mjs'],{env,encoding:'utf8',timeout:20000});
  assert.equal(created.status,0,created.stderr);
  const seedLines=[
   "import {run} from './src/db.mjs';",
   "import {hashPassword} from './src/auth.mjs';",
   "import './src/feature-agenda.mjs';",
   "import './src/feature-selection.mjs';",
   "const hash=await hashPassword('MMG-PasswordPrueba-2026!');",
   "const one=run(\"INSERT INTO users(role,username,pass_hash,first_name,last_name,institutional_email,email_verified_at,status,professional_family) VALUES ('student','TESTUNO',?,'Ejemplo','Uno','uno@canariaseducacion.es',CURRENT_TIMESTAMP,'approved','Administración y gestión')\",hash);",
   "const two=run(\"INSERT INTO users(role,username,pass_hash,first_name,last_name,institutional_email,email_verified_at,status,professional_family) VALUES ('student','TESTDOS',?,'Ejemplo','Dos','dos@canariaseducacion.es',CURRENT_TIMESTAMP,'approved','Administración y gestión')\",hash);",
    "const assignedTeacher=run(\"INSERT INTO users(role,username,pass_hash,first_name,last_name,institutional_email,email_verified_at,status,professional_family) VALUES ('teacher','DOCASIGNADO',?,'Docente','Asignada','docente.asignada@canariaseducacion.es',CURRENT_TIMESTAMP,'approved','Administración y gestión')\",hash);",
    "run(\"INSERT INTO users(role,username,pass_hash,first_name,last_name,institutional_email,email_verified_at,status,professional_family) VALUES ('teacher','DOCNOASIGNADO',?,'Docente','No asignada','docente.noasignada@canariaseducacion.es',CURRENT_TIMESTAMP,'approved','Administración y gestión')\",hash);",
   "const id=Number(one.lastInsertRowid);",
   "run(\"INSERT INTO applications(user_id,mobility,family,destination,motivation,mec,status,submitted_at) VALUES (?,'long','Administración y gestión','Oporto','Interés formativo suficiente para una movilidad internacional de prácticas.','No','submitted',CURRENT_TIMESTAMP)\",id);",
   "const g=run(\"INSERT INTO mobility_groups(name,destination,type) VALUES ('Grupo Oporto','Oporto','long')\");",
    "run('INSERT INTO group_members(group_id,user_id) VALUES (?,?)',Number(g.lastInsertRowid),id);",
    "run('INSERT INTO group_members(group_id,user_id) VALUES (?,?)',Number(g.lastInsertRowid),Number(assignedTeacher.lastInsertRowid));"
  ];
  const seeded=spawnSync(process.execPath,['--input-type=module','-e',seedLines.join('\n')],{env,encoding:'utf8',timeout:20000});
  assert.equal(seeded.status,0,seeded.stderr);
  child=spawn(process.execPath,['src/server.mjs'],{env,stdio:['ignore','pipe','pipe']});
  let errors='';child.stderr.on('data',c=>errors+=c);
  let alive=false;for(let i=0;i<100;i++){
    try{const r=await fetch(base+'/healthz');if(r.ok){alive=true;break;}}catch{}
    if(child.exitCode!==null)throw new Error('No inició: '+errors);
    await new Promise(r=>setTimeout(r,100));
  }
  assert.ok(alive,errors);
  async function login(username){
   const f=await fetch(base+'/acceso');
   const html=await f.text(),csrf=html.match(/name="csrf" value="([a-f0-9]+)"/)?.[1];
   const ck=f.headers.get('set-cookie')?.split(';')[0];
   assert.ok(csrf&&ck);
   const auth=await fetch(base+'/acceso',{method:'POST',redirect:'manual',headers:{
    cookie:ck,'content-type':'application/x-www-form-urlencoded'
   },body:new URLSearchParams({username,password,csrf})});
   assert.equal(auth.status,303,username);
   return auth.headers.get('set-cookie').split(';')[0];
  }
  async function page(url,cookie){
   const response=await fetch(base+url,{headers:{cookie}});
   return [response,await response.text()];
  }
  async function post(url,cookie,csrf,fields={}){
   return fetch(base+url,{method:'POST',redirect:'manual',headers:{
    cookie,'content-type':'application/x-www-form-urlencoded'},
    body:new URLSearchParams({...fields,csrf})});
  }
  const admin=await login('ADMIN');
  const [overview,oh]=await page('/coordinacion/candidaturas',admin);
  assert.equal(overview.status,200);assert.match(oh,/Valoración de candidaturas/);
  const [detail,dh]=await page('/coordinacion/candidaturas/1',admin);
  assert.equal(detail.status,200);
  const admintoken=dh.match(/name="csrf" value="([a-f0-9]+)"/)?.[1];assert.ok(admintoken);
  const invalid=await post('/coordinacion/candidaturas/1',admin,admintoken,{decision:'selected',note:'breve'});
  assert.equal(invalid.status,200);assert.match(await invalid.text(),/mínimo 15 caracteres/);
  const saved=await post('/coordinacion/candidaturas/1',admin,admintoken,{
   decision:'selected',motivation_score:'4',training_fit_score:'5',
   note:'La coordinación ha evaluado manualmente esta candidatura ficticia con criterios formativos.'
  });
  assert.equal(saved.status,200);
  const savedBody=await saved.text();assert.match(savedBody,/La valoración se ha guardado/);
  assert.match(savedBody,/Historial de decisiones/);
  const csv=await fetch(base+'/coordinacion/candidaturas/exportar.csv',{headers:{cookie:admin}});
  assert.equal(csv.status,200);assert.match(csv.headers.get('content-type'),/text\/csv/);
  const student=await login('TESTUNO');
  const other=await login('TESTDOS');
  const assignedTeacher=await login('DOCASIGNADO');
  const unassignedTeacher=await login('DOCNOASIGNADO');
  const [forbidden]=await page('/coordinacion/candidaturas/1',student);
  assert.equal(forbidden.status,403);
  const [mine,mh]=await page('/candidatura',student);
  assert.equal(mine.status,200);assert.match(mh,/Seleccionada/);
  const [agenda,ag]=await page('/agenda/grupo/1',student);
  assert.equal(agenda.status,200);assert.match(ag,/Grupo Oporto/);
  const [notMember]=await page('/agenda/grupo/1',other);
  assert.equal(notMember.status,404);
  const [teacherGroups,teacherOverview]=await page('/agenda',assignedTeacher);
  assert.equal(teacherGroups.status,200);assert.match(teacherOverview,/Grupo Oporto/);
  const [teacherAgenda,teacherHtml]=await page('/agenda/grupo/1',assignedTeacher);
  assert.equal(teacherAgenda.status,200);assert.match(teacherHtml,/Grupo Oporto/);
  const [teacherDenied]=await page('/agenda/grupo/1',unassignedTeacher);
  assert.equal(teacherDenied.status,404);
  const [groupView,gh]=await page('/agenda/grupo/1',admin);
  const csrf=gh.match(/name="csrf" value="([a-f0-9]+)"/)?.[1];
  assert.ok(csrf);
  const event=await post('/coordinacion/agenda/actividad',admin,csrf,{
   group_id:'1',title:'Reunión informativa',kind:'meeting',start_time:'2027-02-15T10:00',
   location:'Centro de acogida',description:'Repasar la planificación del grupo'
  });
  assert.equal(event.status,200);assert.match(await event.text(),/Actividad publicada/);
  const task=await post('/coordinacion/agenda/tarea',admin,csrf,{
   group_id:'1',title:'Revisar documentación',due_date:'2027-02-12',description:'Comprobar todos los formularios'
  });
  assert.equal(task.status,200);assert.match(await task.text(),/Tarea asignada/);
  const memberPage=await page('/agenda/grupo/1',student);
  assert.match(memberPage[1],/Revisar documentación/);
  assert.match(memberPage[1],/Reunión informativa/);
  const [teacherUpdated,teacherUpdatedHtml]=await page('/agenda/grupo/1',assignedTeacher);
  assert.equal(teacherUpdated.status,200);
  assert.match(teacherUpdatedHtml,/Revisar documentación/);
  assert.match(teacherUpdatedHtml,/Reunión informativa/);
  const unassigned=spawnSync(process.execPath,['--input-type=module','-e',[
   "import {get,run} from './src/db.mjs';",
   "const teacher=get(\"SELECT id FROM users WHERE username='DOCASIGNADO'\");",
   "const result=run('DELETE FROM group_members WHERE group_id=? AND user_id=?',1,teacher.id);",
   "if(result.changes!==1)process.exit(1);"
  ].join('\n')],{env,encoding:'utf8',timeout:20000});
  assert.equal(unassigned.status,0,unassigned.stderr);
  const [revokedAgenda]=await page('/agenda/grupo/1',assignedTeacher);
  assert.equal(revokedAgenda.status,404);
  const [revokedOverview,revokedOverviewHtml]=await page('/agenda',assignedTeacher);
  assert.equal(revokedOverview.status,200);
  assert.doesNotMatch(revokedOverviewHtml,/Grupo Oporto/);
  const memberCsrf=memberPage[1].match(/name="csrf" value="([a-f0-9]+)"/)?.[1];assert.ok(memberCsrf);
  const done=await post('/agenda/tarea/1/completar',student,memberCsrf);
  assert.equal(done.status,303);
  const [after,ah]=await page('/agenda/grupo/1',student);
  assert.equal(after.status,200);assert.match(ah,/Completada/);
  const disallowed=await post('/agenda/tarea/1/completar',other,
     (await page('/panel',other))[1].match(/name="csrf" value="([a-f0-9]+)"/)?.[1]||'none');
  assert.equal(disallowed.status===403||disallowed.status===404,true);
   const unassignedCsrf=(await page('/panel',unassignedTeacher))[1]
    .match(/name="csrf" value="([a-f0-9]+)"/)?.[1];
   assert.ok(unassignedCsrf);
   const unassignedCompletion=await post('/agenda/tarea/1/completar',unassignedTeacher,unassignedCsrf);
   assert.equal(unassignedCompletion.status,404);
   const completionCheck=spawnSync(process.execPath,['--input-type=module','-e',
    "import {get} from './src/db.mjs';"+
    "console.log(get(\"SELECT COUNT(*) AS n FROM mobility_task_completions c JOIN users u ON u.id=c.user_id WHERE u.username='DOCNOASIGNADO'\").n);"
   ],{env,encoding:'utf8',timeout:20000});
   assert.equal(completionCheck.status,0,completionCheck.stderr);
   assert.equal(completionCheck.stdout.trim(),'0');
  const coordinatorCompletion=await post('/agenda/tarea/1/completar',admin,csrf);
  assert.equal(coordinatorCompletion.status,403);
  assert.match(await coordinatorCompletion.text(),/no completa tareas en nombre de participantes/i);
 }finally{
  if(child?.pid){child.kill('SIGTERM');await new Promise(r=>setTimeout(r,70));}
  rmSync(data,{force:true,recursive:true});
 }
});
