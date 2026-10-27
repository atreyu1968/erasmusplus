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
    "import {run,get} from './src/db.mjs';",
   "import {hashPassword} from './src/auth.mjs';",
   "import './src/feature-agenda.mjs';",
   "import './src/feature-selection.mjs';",
   "const hash=await hashPassword('MMG-PasswordPrueba-2026!');",
    "const currentEdition=get('SELECT id FROM erasmus_editions WHERE is_active=1').id;",
    "const nextEdition=Number(run(\"INSERT INTO erasmus_editions(label,is_active) VALUES ('2027–2028',0)\").lastInsertRowid);",
    "const one=run(\"INSERT INTO users(role,username,pass_hash,first_name,last_name,institutional_email,email_verified_at,status,professional_family,edition_id) VALUES ('student','TESTUNO',?,'Ejemplo','Uno','uno@canariaseducacion.es',CURRENT_TIMESTAMP,'approved','Administración y gestión',?)\",hash,currentEdition);",
    "const two=run(\"INSERT INTO users(role,username,pass_hash,first_name,last_name,institutional_email,email_verified_at,status,professional_family,edition_id) VALUES ('student','TESTDOS',?,'Ejemplo','Dos','dos@canariaseducacion.es',CURRENT_TIMESTAMP,'approved','Administración y gestión',?)\",hash,nextEdition);",
     "const assignedTeacher=run(\"INSERT INTO users(role,username,pass_hash,first_name,last_name,institutional_email,email_verified_at,status,professional_family,edition_id) VALUES ('teacher','DOCASIGNADO',?,'Docente','Asignada','docente.asignada@canariaseducacion.es',CURRENT_TIMESTAMP,'approved','Administración y gestión',?)\",hash,currentEdition);",
     "run(\"INSERT INTO users(role,username,pass_hash,first_name,last_name,institutional_email,email_verified_at,status,professional_family,edition_id) VALUES ('teacher','DOCNOASIGNADO',?,'Docente','No asignada','docente.noasignada@canariaseducacion.es',CURRENT_TIMESTAMP,'approved','Administración y gestión',?)\",hash,currentEdition);",
   "const id=Number(one.lastInsertRowid);",
    "run(\"INSERT INTO applications(user_id,edition_id,mobility,family,destination,motivation,mec,status,submitted_at) VALUES (?,?,'long','Administración y gestión','Oporto','Interés formativo suficiente para una movilidad internacional de prácticas.','No','submitted',CURRENT_TIMESTAMP)\",id,currentEdition);",
    "const g=run(\"INSERT INTO mobility_groups(name,destination,type,edition_id) VALUES ('Grupo Oporto','Oporto','long',?)\",currentEdition);",
    "run('INSERT INTO group_members(group_id,user_id) VALUES (?,?)',Number(g.lastInsertRowid),id);",
     "run('INSERT INTO group_members(group_id,user_id) VALUES (?,?)',Number(g.lastInsertRowid),Number(assignedTeacher.lastInsertRowid));",
    "const nextGroup=run(\"INSERT INTO mobility_groups(name,destination,type,edition_id) VALUES ('Grupo Róterdam 2027','Róterdam','long',?)\",nextEdition);",
    "run('INSERT INTO group_members(group_id,user_id) VALUES (?,?)',Number(nextGroup.lastInsertRowid),Number(two.lastInsertRowid));",
    "const admin=get(\"SELECT id FROM users WHERE username='ADMIN'\");",
    "run(\"INSERT INTO mobility_events(group_id,kind,title,start_time,created_by) VALUES (?,'activity','Actividad convocatoria nueva','2027-05-01T10:00',?)\",Number(nextGroup.lastInsertRowid),admin.id);",
    "console.log(JSON.stringify({currentEdition,nextEdition,studentId:id,otherId:Number(two.lastInsertRowid),teacherId:Number(assignedTeacher.lastInsertRowid)}));"
  ];
  const seeded=spawnSync(process.execPath,['--input-type=module','-e',seedLines.join('\n')],{env,encoding:'utf8',timeout:20000});
  assert.equal(seeded.status,0,seeded.stderr);
   const editions=JSON.parse(seeded.stdout.trim());
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
  function queuedMail(){
   const result=spawnSync(process.execPath,['--input-type=module','-e',[
    "import {all} from './src/db.mjs';",
    "console.log(JSON.stringify(all('SELECT to_email,subject,body FROM outbox')));"
   ].join('\n')],{env,encoding:'utf8',timeout:20000});
   assert.equal(result.status,0,result.stderr);
   return JSON.parse(result.stdout);
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
   assert.doesNotMatch(ag,/Grupo Róterdam 2027|Actividad convocatoria nueva|Tarea convocatoria nueva/);
   const [otherAgenda,otherAgendaHtml]=await page('/agenda/grupo/2',other);
   assert.equal(otherAgenda.status,200);assert.match(otherAgendaHtml,/Actividad convocatoria nueva/);
   const [otherOldAgenda]=await page('/agenda/grupo/1',other);
   assert.equal(otherOldAgenda.status,404);
   const [otherDashboard,otherDashboardHtml]=await page('/panel',other);
   assert.equal(otherDashboard.status,200);
   assert.match(otherDashboardHtml,/Actividad convocatoria nueva/);
   assert.doesNotMatch(otherDashboardHtml,/Grupo Oporto/);
   const [coordGroups,coordGroupsHtml]=await page('/coordinacion/grupos?edicion='+editions.nextEdition,admin);
   assert.equal(coordGroups.status,200);
   assert.match(coordGroupsHtml,/Grupo Róterdam 2027 · Róterdam · 2027–2028/);
   assert.match(coordGroupsHtml,/Ejemplo Dos/);
   assert.doesNotMatch(coordGroupsHtml,/Grupo Oporto/);
   assert.doesNotMatch(coordGroupsHtml,/Ejemplo Uno/);
   const coordGroupsCsrf=coordGroupsHtml.match(/name="csrf" value="([a-f0-9]+)"/)?.[1];assert.ok(coordGroupsCsrf);
   const wrongEditionAssignment=await post('/coordinacion/grupos/asignar',admin,coordGroupsCsrf,{
    group_id:'1',user_id:String(editions.otherId)
   });
   assert.equal(wrongEditionAssignment.status,200);
   assert.match(await wrongEditionAssignment.text(),/deben pertenecer a la misma convocatoria/);
   const createdGroup=await post('/coordinacion/grupos',admin,coordGroupsCsrf,{
    name:'Grupo creado en segunda edición',destination:'Róterdam',type:'long',edition_id:String(editions.nextEdition)
   });
   assert.equal(createdGroup.status,200);
   assert.match(await createdGroup.text(),/Grupo creado/);
  const [notMember]=await page('/agenda/grupo/1',other);
  assert.equal(notMember.status,404);
  const [teacherGroups,teacherOverview]=await page('/agenda',assignedTeacher);
  assert.equal(teacherGroups.status,200);assert.match(teacherOverview,/Grupo Oporto/);
  const [teacherAgenda,teacherHtml]=await page('/agenda/grupo/1',assignedTeacher);
  assert.equal(teacherAgenda.status,200);assert.match(teacherHtml,/Grupo Oporto/);
  const [teacherDenied]=await page('/agenda/grupo/1',unassignedTeacher);
  assert.equal(teacherDenied.status,404);
  const [teacherChat,teacherChatHtml]=await page('/chat?grupo=1',assignedTeacher);
  assert.equal(teacherChat.status,200);assert.match(teacherChatHtml,/Grupo: Grupo Oporto/);
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
   const nextTaskSeed=spawnSync(process.execPath,['--input-type=module','-e',[
    "import {get,run} from './src/db.mjs';",
    "const group=get(\"SELECT id FROM mobility_groups WHERE name='Grupo Róterdam 2027'\");",
    "const admin=get(\"SELECT id FROM users WHERE username='ADMIN'\");",
    "run(\"INSERT INTO mobility_tasks(group_id,title,due_date,created_by) VALUES (?,'Tarea convocatoria nueva','2027-05-02',?)\",group.id,admin.id);"
   ].join('\n')],{env,encoding:'utf8',timeout:20000});
   assert.equal(nextTaskSeed.status,0,nextTaskSeed.stderr);
   const [otherAgendaWithTask,otherAgendaWithTaskHtml]=await page('/agenda/grupo/2',other);
   assert.equal(otherAgendaWithTask.status,200);
   assert.match(otherAgendaWithTaskHtml,/Tarea convocatoria nueva/);
  const memberPage=await page('/agenda/grupo/1',student);
  assert.match(memberPage[1],/Revisar documentación/);
  assert.match(memberPage[1],/Reunión informativa/);
  const [teacherUpdated,teacherUpdatedHtml]=await page('/agenda/grupo/1',assignedTeacher);
  assert.equal(teacherUpdated.status,200);
  assert.match(teacherUpdatedHtml,/Revisar documentación/);
  assert.match(teacherUpdatedHtml,/Reunión informativa/);
  const assignedTeacherCsrf=teacherUpdatedHtml.match(/name="csrf" value="([a-f0-9]+)"/)?.[1];
  assert.ok(assignedTeacherCsrf);
  const teacherCompletion=await post('/agenda/tarea/1/completar',assignedTeacher,assignedTeacherCsrf);
  assert.equal(teacherCompletion.status,303);
  const [teacherAfterCompletion,teacherAfterCompletionHtml]=await page('/agenda/grupo/1',assignedTeacher);
  assert.equal(teacherAfterCompletion.status,200);
  assert.match(teacherAfterCompletionHtml,/Completada/);
  const assignedCompletionCheck=spawnSync(process.execPath,['--input-type=module','-e',[
   "import {get} from './src/db.mjs';",
   "console.log(get(\"SELECT COUNT(*) AS n FROM mobility_task_completions c JOIN users u ON u.id=c.user_id WHERE c.task_id=1 AND u.username='DOCASIGNADO'\").n);"
  ].join('\n')],{env,encoding:'utf8',timeout:20000});
  assert.equal(assignedCompletionCheck.status,0,assignedCompletionCheck.stderr);
  assert.equal(assignedCompletionCheck.stdout.trim(),'1');
  const initialMail=queuedMail();
  const expectedRecipients=['docente.asignada@canariaseducacion.es','uno@canariaseducacion.es'];
  assert.deepEqual(initialMail.filter(m=>m.body.includes('Reunión informativa'))
   .map(m=>m.to_email).sort(),expectedRecipients);
  assert.deepEqual(initialMail.filter(m=>m.body.includes('Revisar documentación'))
   .map(m=>m.to_email).sort(),expectedRecipients);
  const unassigned=spawnSync(process.execPath,['--input-type=module','-e',[
   "import {get,run} from './src/db.mjs';",
   "const teacher=get(\"SELECT id FROM users WHERE username='DOCASIGNADO'\");",
   "const result=run('DELETE FROM group_members WHERE group_id=? AND user_id=?',1,teacher.id);",
   "if(result.changes!==1)process.exit(1);"
  ].join('\n')],{env,encoding:'utf8',timeout:20000});
  assert.equal(unassigned.status,0,unassigned.stderr);
  const laterEvent=await post('/coordinacion/agenda/actividad',admin,csrf,{
   group_id:'1',title:'Actividad tras retirada',kind:'activity',start_time:'2027-03-15T10:00'
  });
  assert.equal(laterEvent.status,200);assert.match(await laterEvent.text(),/Actividad publicada/);
  const laterTask=await post('/coordinacion/agenda/tarea',admin,csrf,{
   group_id:'1',title:'Tarea tras retirada',due_date:'2027-03-12'
  });
  assert.equal(laterTask.status,200);assert.match(await laterTask.text(),/Tarea asignada/);
  const mailAfterRemoval=queuedMail();
  assert.deepEqual(mailAfterRemoval.filter(m=>m.body.includes('Actividad tras retirada'))
   .map(m=>m.to_email),['uno@canariaseducacion.es']);
  assert.deepEqual(mailAfterRemoval.filter(m=>m.body.includes('Tarea tras retirada'))
   .map(m=>m.to_email),['uno@canariaseducacion.es']);
  const [revokedAgenda]=await page('/agenda/grupo/1',assignedTeacher);
  assert.equal(revokedAgenda.status,404);
  const [revokedChat]=await page('/chat?grupo=1',assignedTeacher);
  assert.equal(revokedChat.status,404);
  const [revokedOverview,revokedOverviewHtml]=await page('/agenda',assignedTeacher);
  assert.equal(revokedOverview.status,200);
  assert.doesNotMatch(revokedOverviewHtml,/Grupo Oporto/);
  const memberCsrf=memberPage[1].match(/name="csrf" value="([a-f0-9]+)"/)?.[1];assert.ok(memberCsrf);
  const done=await post('/agenda/tarea/1/completar',student,memberCsrf);
  assert.equal(done.status,303);
  const resent=await post('/agenda/tarea/1/completar',student,memberCsrf);
  assert.equal(resent.status,303);
  const [after,ah]=await page('/agenda/grupo/1',student);
  assert.equal(after.status,200);assert.match(ah,/Completada/);
  const completionAuditCheck=spawnSync(process.execPath,['--input-type=module','-e',[
    "import {get} from './src/db.mjs';",
    "const completion=get(\"SELECT COUNT(*) AS n FROM mobility_task_completions c JOIN users u ON u.id=c.user_id WHERE c.task_id=1 AND u.username='TESTUNO'\").n;",
    "const audits=get(\"SELECT COUNT(*) AS n FROM audit a JOIN users u ON u.id=a.actor_id WHERE a.action='mobility_task_completed' AND a.target_id=1 AND u.username='TESTUNO'\").n;",
    "console.log(JSON.stringify({completion,audits}));"
  ].join('\n')],{env,encoding:'utf8',timeout:20000});
  assert.equal(completionAuditCheck.status,0,completionAuditCheck.stderr);
  assert.deepEqual(JSON.parse(completionAuditCheck.stdout.trim()),{completion:1,audits:1});
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
   const reassigned=spawnSync(process.execPath,['--input-type=module','-e',[
    "import {get,run} from './src/db.mjs';",
    "const edition=get(\"SELECT id FROM erasmus_editions WHERE label='2027–2028'\");",
    "for(const username of ['TESTUNO','DOCASIGNADO']){",
    " const user=get('SELECT id FROM users WHERE username=?',username);",
    " run('UPDATE users SET edition_id=? WHERE id=?',edition.id,user.id);",
    " if(username==='DOCASIGNADO')run('INSERT OR IGNORE INTO group_members(group_id,user_id) VALUES (1,?)',user.id);",
    " run('INSERT OR IGNORE INTO group_members(group_id,user_id) VALUES (2,?)',user.id);",
    "}"
   ].join('\n')],{env,encoding:'utf8',timeout:20000});
   assert.equal(reassigned.status,0,reassigned.stderr);
   const [reassignedAgenda,reassignedAgendaHtml]=await page('/agenda',student);
   assert.equal(reassignedAgenda.status,200);
   assert.match(reassignedAgendaHtml,/Grupo Róterdam 2027/);
   assert.doesNotMatch(reassignedAgendaHtml,/Grupo Oporto/);
   const [oldGroupAfterReassignment]=await page('/agenda/grupo/1',student);
   assert.equal(oldGroupAfterReassignment.status,404);
   const [reassignedDashboard,reassignedDashboardHtml]=await page('/panel',student);
   assert.equal(reassignedDashboard.status,200);
   assert.match(reassignedDashboardHtml,/Actividad convocatoria nueva/);
   assert.doesNotMatch(reassignedDashboardHtml,/Reunión informativa/);
   const [teacherNewEditionAgenda,teacherNewEditionHtml]=await page('/agenda/grupo/2',assignedTeacher);
   assert.equal(teacherNewEditionAgenda.status,200);
   assert.match(teacherNewEditionHtml,/Tarea convocatoria nueva/);
   const [teacherOldEditionAgenda]=await page('/agenda/grupo/1',assignedTeacher);
   assert.equal(teacherOldEditionAgenda.status,404);
   const [studentOldEditionChat]=await page('/chat?grupo=1',student);
   assert.equal(studentOldEditionChat.status,404);
   const [teacherNewEditionChat,teacherNewEditionChatHtml]=await page('/chat?grupo=2',assignedTeacher);
   assert.equal(teacherNewEditionChat.status,200);
   assert.match(teacherNewEditionChatHtml,/Grupo: Grupo Róterdam 2027/);
   const [teacherOldEditionChat]=await page('/chat?grupo=1',assignedTeacher);
   assert.equal(teacherOldEditionChat.status,404);
    const legacyMemberSeed=spawnSync(process.execPath,['--input-type=module','-e',[
     "import {get,run} from './src/db.mjs';",
     "const teacher=get(\"SELECT id FROM users WHERE username='DOCNOASIGNADO'\");",
     "const admin=get(\"SELECT id FROM users WHERE username='ADMIN'\");",
     "run('INSERT INTO group_members(group_id,user_id) VALUES (1,?)',teacher.id);",
     "run(\"INSERT INTO messages(sender_id,group_id,content) VALUES (?,1,'Mensaje que debe conservarse')\",admin.id);",
     "console.log(JSON.stringify({members:get('SELECT COUNT(*) AS n FROM group_members WHERE group_id=1').n,events:get('SELECT COUNT(*) AS n FROM mobility_events WHERE group_id=1').n,tasks:get('SELECT COUNT(*) AS n FROM mobility_tasks WHERE group_id=1').n,completions:get('SELECT COUNT(*) AS n FROM mobility_task_completions c JOIN mobility_tasks t ON t.id=c.task_id WHERE t.group_id=1').n,messages:get('SELECT COUNT(*) AS n FROM messages WHERE group_id=1').n}));"
    ].join('\n')],{env,encoding:'utf8',timeout:20000});
    assert.equal(legacyMemberSeed.status,0,legacyMemberSeed.stderr);
    const preservedGroupHistory=JSON.parse(legacyMemberSeed.stdout.trim());
    const [beforeCorrection,adminGroupsHtml]=await page('/coordinacion/grupos?edicion='+editions.currentEdition,admin);
    assert.equal(beforeCorrection.status,200);
    const groupCorrectionCsrf=adminGroupsHtml.match(/name="csrf" value="([a-f0-9]+)"/)?.[1];assert.ok(groupCorrectionCsrf);
    const [legacyMemberAgenda]=await page('/agenda/grupo/1',unassignedTeacher);
    assert.equal(legacyMemberAgenda.status,200);
    const correctionReview=await post('/coordinacion/grupos/cambiar-convocatoria',admin,groupCorrectionCsrf,{
     group_id:'1',edition_id:String(editions.nextEdition)
    });
    assert.equal(correctionReview.status,200);
    const correctionReviewHtml=await correctionReview.text();
    assert.match(correctionReviewHtml,/Revisar cambio de convocatoria/);
    assert.match(correctionReviewHtml,/2 ya pertenecen a la convocatoria destino y 1 no coinciden/);
    assert.match(correctionReviewHtml,/2 actividades/);
    assert.match(correctionReviewHtml,/2 tareas/);
    const reviewSnapshot=correctionReviewHtml.match(/name="snapshot" value="([a-f0-9]+)"/)?.[1];assert.ok(reviewSnapshot);
    const previewReadOnly=spawnSync(process.execPath,['--input-type=module','-e',[
     "import {get} from './src/db.mjs';",
     "console.log(JSON.stringify({edition:get('SELECT edition_id FROM mobility_groups WHERE id=1').edition_id,history:get('SELECT COUNT(*) AS n FROM mobility_group_edition_history WHERE group_id=1').n}));"
    ].join('\n')],{env,encoding:'utf8',timeout:20000});
    assert.equal(previewReadOnly.status,0,previewReadOnly.stderr);
    assert.deepEqual(JSON.parse(previewReadOnly.stdout.trim()),{edition:editions.currentEdition,history:0});
    const correction=await post('/coordinacion/grupos/cambiar-convocatoria/confirmar',admin,groupCorrectionCsrf,{
     group_id:'1',current_edition_id:String(editions.currentEdition),edition_id:String(editions.nextEdition),snapshot:reviewSnapshot
    });
    assert.equal(correction.status,200);
    assert.match(await correction.text(),/Convocatoria del grupo corregida/);
    const correctedHistory=spawnSync(process.execPath,['--input-type=module','-e',[
     "import {get} from './src/db.mjs';",
     "console.log(JSON.stringify({edition:get('SELECT edition_id FROM mobility_groups WHERE id=1').edition_id,history:get('SELECT COUNT(*) AS n FROM mobility_group_edition_history WHERE group_id=1').n,members:get('SELECT COUNT(*) AS n FROM group_members WHERE group_id=1').n,events:get('SELECT COUNT(*) AS n FROM mobility_events WHERE group_id=1').n,tasks:get('SELECT COUNT(*) AS n FROM mobility_tasks WHERE group_id=1').n,completions:get('SELECT COUNT(*) AS n FROM mobility_task_completions c JOIN mobility_tasks t ON t.id=c.task_id WHERE t.group_id=1').n,messages:get('SELECT COUNT(*) AS n FROM messages WHERE group_id=1').n,transition:get('SELECT previous_edition_id,new_edition_id FROM mobility_group_edition_history WHERE group_id=1')}));"
    ].join('\n')],{env,encoding:'utf8',timeout:20000});
    assert.equal(correctedHistory.status,0,correctedHistory.stderr);
    const corrected=JSON.parse(correctedHistory.stdout.trim());
    assert.equal(corrected.edition,editions.nextEdition);
    assert.deepEqual(corrected.transition,{previous_edition_id:editions.currentEdition,new_edition_id:editions.nextEdition});
    assert.equal(corrected.history,1);
    assert.deepEqual({members:corrected.members,events:corrected.events,tasks:corrected.tasks,completions:corrected.completions,messages:corrected.messages},preservedGroupHistory);
    const [formerEditionMemberAgenda]=await page('/agenda/grupo/1',unassignedTeacher);
    assert.equal(formerEditionMemberAgenda.status,404);
    const [sameEditionNonMemberAgenda]=await page('/agenda/grupo/1',other);
    assert.equal(sameEditionNonMemberAgenda.status,404);
    const addNewEditionMember=await post('/coordinacion/grupos/asignar',admin,groupCorrectionCsrf,{
     group_id:'1',user_id:String(editions.otherId)
    });
    assert.equal(addNewEditionMember.status,200);
    assert.match(await addNewEditionMember.text(),/Participante incorporado/);
    const [newEditionAgenda,newEditionAgendaHtml]=await page('/agenda/grupo/1',other);
    assert.equal(newEditionAgenda.status,200);
    assert.match(newEditionAgendaHtml,/Reunión informativa/);
    assert.match(newEditionAgendaHtml,/Revisar documentación/);
    const [newEditionChat,newEditionChatHtml]=await page('/chat?grupo=1',other);
    assert.equal(newEditionChat.status,200);
    assert.match(newEditionChatHtml,/Mensaje que debe conservarse/);
    const staleReview=await post('/coordinacion/grupos/cambiar-convocatoria',admin,groupCorrectionCsrf,{
     group_id:'1',edition_id:String(editions.currentEdition)
    });
    assert.equal(staleReview.status,200);
    const staleReviewHtml=await staleReview.text();
    const staleSnapshot=staleReviewHtml.match(/name="snapshot" value="([a-f0-9]+)"/)?.[1];assert.ok(staleSnapshot);
    const scheduleChanged=spawnSync(process.execPath,['--input-type=module','-e',[
     "import {get,run} from './src/db.mjs';",
     "const admin=get(\"SELECT id FROM users WHERE username='ADMIN'\");",
     "run(\"INSERT INTO mobility_events(group_id,kind,title,start_time,created_by) VALUES (1,'activity','Actividad añadida después de revisar','2027-04-01T10:00',?)\",admin.id);"
    ].join('\n')],{env,encoding:'utf8',timeout:20000});
    assert.equal(scheduleChanged.status,0,scheduleChanged.stderr);
    const staleConfirmation=await post('/coordinacion/grupos/cambiar-convocatoria/confirmar',admin,groupCorrectionCsrf,{
     group_id:'1',current_edition_id:String(editions.nextEdition),edition_id:String(editions.currentEdition),snapshot:staleSnapshot
    });
    assert.equal(staleConfirmation.status,200);
    assert.match(await staleConfirmation.text(),/cambiaron desde la revisión/);
    const staleChangeBlocked=spawnSync(process.execPath,['--input-type=module','-e',[
     "import {get} from './src/db.mjs';",
     "console.log(JSON.stringify({edition:get('SELECT edition_id FROM mobility_groups WHERE id=1').edition_id,history:get('SELECT COUNT(*) AS n FROM mobility_group_edition_history WHERE group_id=1').n}));"
    ].join('\n')],{env,encoding:'utf8',timeout:20000});
    assert.equal(staleChangeBlocked.status,0,staleChangeBlocked.stderr);
    assert.deepEqual(JSON.parse(staleChangeBlocked.stdout.trim()),{edition:editions.nextEdition,history:1});
 }finally{
  if(child?.pid){child.kill('SIGTERM');await new Promise(r=>setTimeout(r,70));}
  rmSync(data,{force:true,recursive:true});
 }
});
