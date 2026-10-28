import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

test('Menor: modelo PDF, entrega y validación manual obligatoria',async()=>{
 const folder=mkdtempSync(path.join(os.tmpdir(),'mmg-guardian-'));
 const port=35000+Math.floor(Math.random()*20000);
 const base='http://127.0.0.1:'+port;
 const token=crypto.randomBytes(32).toString('hex');
 const adminPassword='MMG-Admin-Password-2026!';
 const env={...process.env,MMG_DATA_DIR:folder,PORT:String(port),HOST:'127.0.0.1',MMG_ENV:'development',
  MMG_SECURE_COOKIE:'0',MMG_SECRET:'test-guardian-long-secure-secret-2026-01234567890123456789',
  MMG_ENABLE_REGISTRATION:'0',MMG_PRIVACY_VERSION:'MMG-2026-27-VALIDACION-PRUEBA',
  MMG_PRIVACY_CONTROLLER:'Administración educativa de prueba sin datos reales',
  MMG_PRIVACY_CONTACT:'Contacto institucional por definir',
  MMG_PRIVACY_DPO:'Delegado de protección de datos por determinar',
  MMG_PRIVACY_LEGAL_BASIS:'Ejercicio de función educativa en esta prueba',
  MMG_PRIVACY_RETENTION:'Retención de prueba según expediente educativo',
  MMG_PRIVACY_RECIPIENTS:'Destinatarios y encargados del tratamiento de prueba',
  MMG_ADMIN_USERNAME:'ADMINMMG',MMG_ADMIN_EMAIL:'coordinacion@example.edu',
  MMG_ADMIN_PASSWORD:adminPassword};
 let proc;
 try{
  const seed=spawnSync(process.execPath,['scripts/init-admin.mjs'],{env,encoding:'utf8',timeout:30000});
  assert.equal(seed.status,0,seed.stderr);
  const lines=[
   "import {run} from './src/db.mjs';",
   "import './src/feature-privacy.mjs';",
   "import {hashPassword} from './src/auth.mjs';",
   "import crypto from 'node:crypto';",
   "const pass=await hashPassword('Alumno-De-Prueba-2026');",
   "const user=run(\"INSERT INTO users(role,username,pass_hash,first_name,last_name,birth_date,institutional_email,email_verified_at,status,privacy_version) VALUES ('student','MENORDEMO',?,'Estudiante','Demo','2011-05-14','menor@canariaseducacion.es',CURRENT_TIMESTAMP,'pending','MMG-2026-27-VALIDACION-PRUEBA')\",pass);",
   "run('INSERT INTO guardian_access_tokens(token_hash,user_id,expires_at) VALUES (?,?,?)',crypto.createHash('sha256').update(process.env.MMG_TEST_TOKEN).digest('hex'),Number(user.lastInsertRowid),Date.now()+604800000);"
  ];
  const seeded=spawnSync(process.execPath,['--input-type=module','-e',lines.join('\n')],
    {env:{...env,MMG_TEST_TOKEN:token},encoding:'utf8',timeout:30000});
  assert.equal(seeded.status,0,seeded.stderr);
  proc=spawn(process.execPath,['src/server.mjs'],{env,stdio:['ignore','pipe','pipe']});
  let stderr='';proc.stderr.on('data',c=>stderr+=c);
  let ready=false;
  for(let i=0;i<80;i++){
   try{const r=await fetch(base+'/healthz');if(r.ok){ready=true;break;}}catch{}
   if(proc.exitCode!==null)throw new Error(stderr);
   await new Promise(r=>setTimeout(r,100));
  }
  assert.ok(ready,stderr);
  const start=await fetch(base+'/privacidad/tramite?token='+token,{redirect:'manual'});
  assert.equal(start.status,303);
  assert.equal(start.headers.get('location'),'/privacidad/tramite');
  const guardianCookie=start.headers.get('set-cookie')?.split(';')[0];
  assert.ok(guardianCookie?.startsWith('mmg_guardian='));
  const page=await fetch(base+'/privacidad/tramite',{headers:{Cookie:guardianCookie}});
  assert.equal(page.status,200);
  const csrfCookie=page.headers.get('set-cookie')?.split(';')[0];
  const html=await page.text();
  assert.match(html,/Autorización del representante legal/);
  const csrf=html.match(/name="csrf" value="([a-f0-9]+)"/)?.[1];
  assert.ok(csrf);
  const combined=guardianCookie+'; '+csrfCookie;
  const pdf=await fetch(base+'/privacidad/modelo.pdf',{headers:{Cookie:combined}});
  assert.equal(pdf.status,200);
  assert.equal(pdf.headers.get('content-type'),'application/pdf');
  const pdfBytes=Buffer.from(await pdf.arrayBuffer());
  assert.ok(pdfBytes.subarray(0,5).equals(Buffer.from('%PDF-')));
  const form=new FormData();
  form.append('csrf',csrf);
  form.append('guardian_name','Representante de Ejemplo');
  form.append('relation','Madre');
  form.append('declaration','yes');
  form.append('file',new Blob([pdfBytes],{type:'application/pdf'}),'firmado-de-ejemplo.pdf');
  const uploaded=await fetch(base+'/privacidad/subir',{method:'POST',headers:{Cookie:combined},body:form});
  assert.equal(uploaded.status,200);
  assert.match(await uploaded.text(),/Archivo recibido/);
  const adminLoginPage=await fetch(base+'/acceso');
  const alh=await adminLoginPage.text(),adminCookie=adminLoginPage.headers.get('set-cookie').split(';')[0];
  const act=alh.match(/name="csrf" value="([a-f0-9]+)"/)?.[1];
  const adminLogin=await fetch(base+'/acceso',{method:'POST',redirect:'manual',
   headers:{Cookie:adminCookie,'Content-Type':'application/x-www-form-urlencoded'},
   body:new URLSearchParams({username:'ADMINMMG',password:adminPassword,csrf:act})});
  assert.equal(adminLogin.status,303);
  const session=adminLogin.headers.get('set-cookie').split(';')[0];
  const board=await fetch(base+'/coordinacion',{headers:{Cookie:session}});
  const boardHtml=await board.text(),tokenAdmin=boardHtml.match(/name="csrf" value="([a-f0-9]+)"/)?.[1];
  const blocked=await fetch(base+'/coordinacion/estado',{method:'POST',
   headers:{Cookie:session,'Content-Type':'application/x-www-form-urlencoded'},
   body:new URLSearchParams({csrf:tokenAdmin,id:'2',status:'approved'})});
  assert.equal(blocked.status,200);
  assert.match(await blocked.text(),/No se puede aprobar esta cuenta/);
  const guardianAdminPage=await fetch(base+'/coordinacion/privacidad',{headers:{Cookie:session}});
  const guardianHtml=await guardianAdminPage.text();
  assert.match(guardianHtml,/Representante de Ejemplo/);
  const docId=guardianHtml.match(/name="id" value="(\d+)"/)?.[1];
  assert.ok(docId);
  const missingProof=await fetch(base+'/coordinacion/privacidad/revisar',{method:'POST',
   headers:{Cookie:session,'Content-Type':'application/x-www-form-urlencoded'},
   body:new URLSearchParams({csrf:tokenAdmin,id:docId,status:'approved'})});
  assert.equal(missingProof.status,200);
  assert.match(await missingProof.text(),/Para aprobar debes indicar cómo verificaste identidad/);
  const review=await fetch(base+'/coordinacion/privacidad/revisar',{method:'POST',
   headers:{Cookie:session,'Content-Type':'application/x-www-form-urlencoded'},
   body:new URLSearchParams({csrf:tokenAdmin,id:docId,status:'approved',
     check_method:'in_person',check_note:'Documento comprobado presencialmente con representante.'})});
  assert.equal(review.status,200);
  assert.match(await review.text(),/Documento revisado/);
  const approve=await fetch(base+'/coordinacion/estado',{method:'POST',
   headers:{Cookie:session,'Content-Type':'application/x-www-form-urlencoded'},
   body:new URLSearchParams({csrf:tokenAdmin,id:'2',status:'approved'})});
  assert.equal(approve.status,200);
  assert.match(await approve.text(),/Estado actualizado/);
 }finally{
  if(proc?.pid){proc.kill('SIGTERM');await new Promise(r=>setTimeout(r,80));}
  rmSync(folder,{recursive:true,force:true});
 }
});
