import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync,spawn} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const data=mkdtempSync(path.join(os.tmpdir(),'mmg-test-'));
const port=30000+Math.floor(Math.random()*25000);
const base='http://127.0.0.1:'+port;
const env={...process.env,MMG_DATA_DIR:data,HOST:'127.0.0.1',PORT:String(port),
 MMG_ENV:'development',MMG_SECURE_COOKIE:'0',
 MMG_SECRET:'dev-test-secret-longer-than-48-characters---0123456789-ABCDEF',
 MMG_ENABLE_REGISTRATION:'0',MMG_PRIVACY_VERSION:'PENDIENTE_REVISION',
 MMG_ADMIN_USERNAME:'TESTADMIN',MMG_ADMIN_PASSWORD:'UnaFraseDePruebaRealmenteLarga2026!',
 MMG_ADMIN_EMAIL:'coordinacion@example.edu'};
let child;
async function fetchWait(){
 for(let i=0;i<80;i++){
  try{const r=await fetch(base+'/healthz');if(r.ok)return;}catch{}
  if(child.exitCode!==null)throw new Error('El proceso terminó antes de iniciar.');
  await new Promise(resolve=>setTimeout(resolve,100));
 }
 throw new Error('El servidor no respondió a la comprobación de salud.');
}
test('MVP: creación del coordinador y controles básicos',async ()=>{
 try {
  const seed=spawnSync(process.execPath,['scripts/init-admin.mjs'],{env,encoding:'utf8',timeout:20000});
  assert.equal(seed.status,0,seed.stderr);
  child=spawn(process.execPath,['src/server.mjs'],{env,stdio:['ignore','pipe','pipe']});
  let stderr='';
  child.stderr.on('data',x=>stderr+=x);
  await fetchWait();
  let r=await fetch(base+'/healthz');
  assert.equal(r.status,200);
  assert.equal(await r.text(),'ok');
  r=await fetch(base+'/coordinacion',{redirect:'manual'});
  assert.equal(r.status,303);
  assert.equal(r.headers.get('location'),'/acceso');
  r=await fetch(base+'/registro');
  assert.equal(r.status,200);
  let html=await r.text();
  assert.match(html,/Registro deshabilitado/);
  assert.match(html,/canariaseducacion.es/);
  r=await fetch(base+'/acceso');
  const c=r.headers.get('set-cookie');
  assert.ok(c?.includes('mmg_csrf='));
  html=await r.text();
  const csrf=html.match(/name="csrf" value="([a-f0-9]+)"/)?.[1];
  assert.ok(csrf,'Token CSRF de formulario público');
  const cookie=c.split(';')[0];
  const body=new URLSearchParams({username:'TESTADMIN',password:'UnaFraseDePruebaRealmenteLarga2026!',csrf});
  r=await fetch(base+'/acceso',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded',cookie},body,redirect:'manual'});
  assert.equal(r.status,303);
  assert.equal(r.headers.get('location'),'/coordinacion');
  const session=r.headers.get('set-cookie')?.split(';')[0];
  assert.ok(session?.startsWith('mmg_session='));
  r=await fetch(base+'/coordinacion',{headers:{cookie:session}});
  assert.equal(r.status,200);
  html=await r.text();
  assert.match(html,/Panel de coordinación/);
  r=await fetch(base+'/coordinacion/grupos',{headers:{cookie:session}});
  assert.equal(r.status,200);
  assert.match(await r.text(),/Gestión de grupos/);
  r=await fetch(base+'/coordinacion/documentos',{headers:{cookie:session}});
  assert.equal(r.status,200);
  assert.match(await r.text(),/Documentación Erasmus/);
  // Registration must not work without approved privacy version.
  r=await fetch(base+'/registro',{method:'POST',redirect:'manual',headers:{'content-type':'application/x-www-form-urlencoded',cookie},
   body:new URLSearchParams({csrf,role:'student',first_name:'Ficticio'})});
  assert.equal(r.status,200);
  assert.match(await r.text(),/Registro deshabilitado/);
 }finally{
  if(child?.pid){child.kill('SIGTERM');await new Promise(r=>setTimeout(r,50));}
  rmSync(data,{recursive:true,force:true});
 }
});
