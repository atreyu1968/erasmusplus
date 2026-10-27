import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {makePdf,digest} from '../src/pdf.mjs';

test('El PDF contiene catálogo de páginas, texto y huella verificable',()=>{
 const bytes=makePdf({title:'Candidatura Erasmus MMG',rows:[
  ['Alumno ficticio','Muestra de prueba'],['Motivación','Quiero aprender durante mi movilidad en Oporto, Portugal.']],
  note:'Documento de prueba'});
 assert.ok(bytes.toString('latin1',0,8).startsWith('%PDF-1.4'));
 assert.match(bytes.toString('latin1'),/startxref/);
 assert.match(bytes.toString('latin1'),/Candidatura Erasmus/i);
 assert.equal(digest(bytes).length,64);
});
test('Docente y alumnado: permisos, candidatura y PDF',async()=>{
 const data=mkdtempSync(path.join(os.tmpdir(),'mmg-features-'));
 const port=40000+Math.floor(Math.random()*15000);
 const base='http://127.0.0.1:'+port;
 const env={...process.env,MMG_DATA_DIR:data,PORT:String(port),HOST:'127.0.0.1',
  MMG_ENV:'development',MMG_SECURE_COOKIE:'0',MMG_SECRET:'test-MMG-a-secure-long-random-phrase-ABC-0123456789012345',
  MMG_ENABLE_REGISTRATION:'0',MMG_PRIVACY_VERSION:'PENDIENTE_REVISION'};
 let child;
 try {
  const script=[
  "import {run} from './src/db.mjs';",
  "import {hashPassword} from './src/auth.mjs';",
  "const hash=await hashPassword('Password-prueba-2026!');",
  "run(\"INSERT INTO users(role,username,pass_hash,first_name,last_name,institutional_email,email_verified_at,status,professional_family) VALUES ('student','TESTCIAL',?,'Estudiante','Ficticio','fake@canariaseducacion.es',CURRENT_TIMESTAMP,'approved','Administración y gestión')\",hash);",
  "run(\"INSERT INTO users(role,username,pass_hash,first_name,last_name,institutional_email,email_verified_at,status,professional_family) VALUES ('teacher','TESTDOC',?,'Docente','Ficticio','teacher@canariaseducacion.es',CURRENT_TIMESTAMP,'approved','Administración y gestión')\",hash);"
  ].join('\n');
  const seed=spawnSync(process.execPath,['--input-type=module','-e',script],{env,encoding:'utf8',timeout:20000});
  assert.equal(seed.status,0,seed.stderr);
  child=spawn(process.execPath,['src/server.mjs'],{env,stdio:['ignore','pipe','pipe']});
  let stderr='';child.stderr.on('data',x=>stderr+=x);
  let started=false;
  for(let i=0;i<100;i++){
   try {const r=await fetch(base+'/healthz');if(r.ok){started=true;break;}}catch{}
   if(child.exitCode!==null)throw Error(stderr);
   await new Promise(r=>setTimeout(r,100));
  }
  assert.ok(started,'Servidor no arrancó: '+stderr);
  const loginPage=await fetch(base+'/acceso');
  const html=await loginPage.text(),cookie=loginPage.headers.get('set-cookie')?.split(';')[0];
  const csrf=html.match(/name="csrf" value="([a-f0-9]+)"/)?.[1];
  assert.ok(cookie&&csrf);
  const response=await fetch(base+'/acceso',{
    method:'POST',redirect:'manual',headers:{'Content-Type':'application/x-www-form-urlencoded',Cookie:cookie},
    body:new URLSearchParams({username:'TESTCIAL',password:'Password-prueba-2026!',csrf})
  });
  assert.equal(response.status,303);
  const session=response.headers.get('set-cookie')?.split(';')[0];
  assert.ok(session);
  const denied=await fetch(base+'/coordinacion',{headers:{Cookie:session}});
  assert.equal(denied.status,403);
  const candidate=await fetch(base+'/candidatura',{headers:{Cookie:session}});
  assert.equal(candidate.status,200);
  const candidateHtml=await candidate.text();
  const userCsrf=candidateHtml.match(/name="csrf" value="([a-f0-9]+)"/)?.[1];
  assert.ok(userCsrf);
  const submitted=await fetch(base+'/candidatura',{method:'POST',redirect:'manual',
   headers:{'Content-Type':'application/x-www-form-urlencoded',Cookie:session},
   body:new URLSearchParams({
     csrf:userCsrf,mobility:'long|Movilidad larga Dual-Erasmus+',family:'Administración y gestión',
     destination:'Oporto',motivation:'Quiero realizar prácticas internacionales para mejorar mi formación profesional y mi autonomía personal.',
     mec:'No',intent:'submit'
   })});
  assert.equal(submitted.status,200);
  const result=await submitted.text();
  assert.match(result,/Candidatura presentada/);
  const link=result.match(/href="(\/documentacion\/pdf\/candidatura\/\d+)"/)?.[1];
  assert.ok(link);
  const pdf=await fetch(base+link,{headers:{Cookie:session}});
  assert.equal(pdf.status,200);
  assert.equal(pdf.headers.get('content-type'),'application/pdf');
  assert.ok(Buffer.from(await pdf.arrayBuffer()).toString('latin1',0,8).startsWith('%PDF-1.4'));
  const inaccessible=await fetch(base+'/coordinacion/documentos',{headers:{Cookie:session}});
  assert.equal(inaccessible.status,403);
 }finally {
  if(child?.pid){child.kill('SIGTERM');await new Promise(r=>setTimeout(r,60));}
  rmSync(data,{recursive:true,force:true});
 }
});
