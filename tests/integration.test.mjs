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
  MMG_TEST_FIXTURES:'1',
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
  const fixtureEnv={...env,MMG_ENV:'development',MMG_TEST_FIXTURES:'1'};
  const unsafeFixtureEnv={...fixtureEnv,MMG_DATA_DIR:path.resolve('data')};
  const unsafeTarget=spawnSync(process.execPath,['scripts/seed-test-accounts.mjs'],{env:unsafeFixtureEnv,encoding:'utf8',timeout:20000});
  assert.notEqual(unsafeTarget.status,0);
  const openRegistration=spawnSync(process.execPath,['scripts/seed-test-accounts.mjs'],{
   env:{...fixtureEnv,MMG_ENABLE_REGISTRATION:'1'},encoding:'utf8',timeout:20000
  });
  assert.notEqual(openRegistration.status,0);
  const productionMode=spawnSync(process.execPath,['scripts/seed-test-accounts.mjs'],{
   env:{...fixtureEnv,MMG_ENV:'production'},encoding:'utf8',timeout:20000
  });
  assert.notEqual(productionMode.status,0);
  for(let i=0;i<2;i++){
   const fixtures=spawnSync(process.execPath,['scripts/seed-test-accounts.mjs'],{env:fixtureEnv,encoding:'utf8',timeout:20000});
   assert.equal(fixtures.status,0,fixtures.stderr);
   assert.match(fixtures.stdout,/TESTDOCENTE/);
   assert.match(fixtures.stdout,/TESTALUMNO/);
  }
   const candidateFixtures=spawnSync(process.execPath,['scripts/seed-test-candidates.mjs'],{
    env:fixtureEnv,encoding:'utf8',timeout:20000
   });
   assert.equal(candidateFixtures.status,0,candidateFixtures.stderr);
   assert.match(candidateFixtures.stdout,/alumnado/);
   assert.match(candidateFixtures.stdout,/docente/);
   const repeatedCandidates=spawnSync(process.execPath,['scripts/seed-test-candidates.mjs'],{
    env:fixtureEnv,encoding:'utf8',timeout:20000
   });
   assert.equal(repeatedCandidates.status,0,repeatedCandidates.stderr);
   assert.match(repeatedCandidates.stdout,/conservada/);
   const unsafeCandidates=spawnSync(process.execPath,['scripts/seed-test-candidates.mjs'],{
    env:{...fixtureEnv,MMG_DATA_DIR:path.resolve('data')},encoding:'utf8',timeout:20000
   });
   assert.notEqual(unsafeCandidates.status,0);
   const openRegistrationCandidates=spawnSync(process.execPath,['scripts/seed-test-candidates.mjs'],{
    env:{...fixtureEnv,MMG_ENABLE_REGISTRATION:'1'},encoding:'utf8',timeout:20000
   });
   assert.notEqual(openRegistrationCandidates.status,0);
   const productionCandidates=spawnSync(process.execPath,['scripts/seed-test-candidates.mjs'],{
    env:{...fixtureEnv,MMG_ENV:'production'},encoding:'utf8',timeout:20000
   });
   assert.notEqual(productionCandidates.status,0);
  child=spawn(process.execPath,['src/server.mjs'],{env,stdio:['ignore','pipe','pipe']});
  let stderr='';
  child.stderr.on('data',x=>stderr+=x);
  await fetchWait();
  let r=await fetch(base+'/healthz');
  assert.equal(r.status,200);
  assert.equal(await r.text(),'ok');
  r=await fetch(base+'/');
  assert.equal(r.status,200,'la portada pública responde correctamente');
  assert.match(r.headers.get('content-type')||'',/text\/html/);
  let homepage=await r.text();
  assert.equal((homepage.match(/<article class="visitor-destination">/g)||[]).length,3,
   'la portada publica los tres destinos previstos');
  for(const destination of ['Viseu','Oporto','Róterdam']){
   assert.ok(homepage.includes('<h3>'+destination+'</h3>'),`la portada publica ${destination}`);
  }
  for(const [label,route] of [
   ['registro','/registro'],['acceso','/acceso'],['privacidad','/privacidad']
  ]){
   assert.ok(homepage.includes('href="'+route+'"'),`la portada enlaza con ${label}`);
   const publicPage=await fetch(base+route);
   assert.equal(publicPage.status,200,`el destino ${route} responde correctamente`);
    const pageHtml=await publicPage.text();
    assert.doesNotMatch(pageHtml,/class="sidebar"/,`la página ${route} no muestra barra lateral`);
  }
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
   r=await fetch(base+'/coordinacion/candidaturas',{headers:{cookie:session}});
   assert.equal(r.status,200);
   html=await r.text();
   assert.match(html,/Docente Prueba/);
   assert.match(html,/Alumnado Prueba/);
   const candidateIds=[...html.matchAll(/href="\/coordinacion\/candidaturas\/(\d+)">Revisar expediente/g)]
    .map(match=>match[1]);
   assert.equal(candidateIds.length,4,'dos modalidades por perfil aparecen en coordinación');
   for(const candidateId of candidateIds){
    r=await fetch(base+'/coordinacion/candidaturas/'+candidateId,{headers:{cookie:session}});
    assert.equal(r.status,200);
    const detail=await r.text();
    assert.match(detail,/CASO FICTICIO/);
    assert.match(detail,/Presentada · pendiente/);
    const pdfPath='/documentacion/pdf/candidatura/'+candidateId;
    assert.ok(detail.includes('href="'+pdfPath+'"'));
    r=await fetch(base+pdfPath,{headers:{cookie:session}});
    assert.equal(r.status,200);
    assert.match(r.headers.get('content-type'),/application\/pdf/);
    assert.ok(Buffer.from(await r.arrayBuffer()).toString('latin1',0,8).startsWith('%PDF-1.4'));
   }
   const reviewedId=candidateIds[0];
   r=await fetch(base+'/coordinacion/candidaturas/'+reviewedId,{headers:{cookie:session}});
   html=await r.text();
   assert.doesNotMatch(html,/name="notify" value="yes" checked/);
   const reviewCsrf=html.match(/name="csrf" value="([a-f0-9]+)"/)?.[1];
   assert.ok(reviewCsrf);
   r=await fetch(base+'/coordinacion/candidaturas/'+reviewedId,{
    method:'POST',redirect:'manual',headers:{cookie:session,'content-type':'application/x-www-form-urlencoded'},
    body:new URLSearchParams({
     csrf:reviewCsrf,decision:'selected',motivation_score:'4',training_fit_score:'5',
     note:'Valoración ficticia para comprobar que el sembrado conserva las decisiones.',
     notify:'yes'
    })
   });
   assert.equal(r.status,200);
   const reviewedResponse=await r.text();
   assert.match(reviewedResponse,/La valoración se ha guardado/);
   assert.doesNotMatch(reviewedResponse,/aviso está en cola de envío/);
   const queuedMail=spawnSync(process.execPath,['--input-type=module','-e',
    "import {get} from './src/db.mjs'; console.log(get('SELECT COUNT(*) AS count FROM outbox').count);"
   ],{env,encoding:'utf8',timeout:20000});
   assert.equal(queuedMail.status,0,queuedMail.stderr);
   assert.equal(queuedMail.stdout.trim(),'0','el modo de fixtures no encola avisos');
   const repeatAfterReview=spawnSync(process.execPath,['scripts/seed-test-candidates.mjs'],{
    env:fixtureEnv,encoding:'utf8',timeout:20000
   });
   assert.equal(repeatAfterReview.status,0,repeatAfterReview.stderr);
   assert.match(repeatAfterReview.stdout,/conservada/);
   r=await fetch(base+'/coordinacion/candidaturas/'+reviewedId,{headers:{cookie:session}});
   const preservedReview=await r.text();
   assert.match(preservedReview,/Seleccionada/);
   assert.match(preservedReview,/Valoración ficticia para comprobar que el sembrado conserva las decisiones/);
  r=await fetch(base+'/coordinacion/grupos',{headers:{cookie:session}});
  assert.equal(r.status,200);
  assert.match(await r.text(),/Gestión de grupos/);
  r=await fetch(base+'/coordinacion/documentos',{headers:{cookie:session}});
  assert.equal(r.status,200);
  assert.match(await r.text(),/Documentación Erasmus/);

   async function loginFixture(username){
    const page=await fetch(base+'/acceso');
    const pageHtml=await page.text(),csrfToken=pageHtml.match(/name="csrf" value="([a-f0-9]+)"/)?.[1];
    const csrfCookie=page.headers.get('set-cookie')?.split(';')[0];
    assert.ok(csrfCookie&&csrfToken);
    const response=await fetch(base+'/acceso',{method:'POST',headers:{
     'content-type':'application/x-www-form-urlencoded',cookie:csrfCookie
    },body:new URLSearchParams({username,password:'MMG-Aislado-Prueba-2026!',csrf:csrfToken}),redirect:'manual'});
    assert.equal(response.status,303,username);
    assert.equal(response.headers.get('location'),'/panel');
    return response.headers.get('set-cookie')?.split(';')[0];
   }
   for(const [username,roleOnlyMobility,forbiddenMobility,hasMecField] of [
    ['TESTDOCENTE','shadowing','long',false],['TESTALUMNO','long','shadowing',true]
   ]){
    const participant=await loginFixture(username);
    assert.ok(participant?.startsWith('mmg_session='));
    r=await fetch(base+'/panel',{headers:{cookie:participant}});
    assert.equal(r.status,200,username+' puede abrir su panel');
    r=await fetch(base+'/coordinacion',{headers:{cookie:participant}});
    assert.equal(r.status,403,username+' no puede acceder a coordinación');
    r=await fetch(base+'/candidatura',{headers:{cookie:participant}});
    assert.equal(r.status,200,username+' puede abrir su candidatura');
    html=await r.text();
    assert.match(html,new RegExp('value="'+roleOnlyMobility+'\\|'));
    assert.doesNotMatch(html,new RegExp('value="'+forbiddenMobility+'\\|'));
    assert.equal(html.includes('¿Tienes beca MEC?'),hasMecField);
   }
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
