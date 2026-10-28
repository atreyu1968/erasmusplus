import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const data=mkdtempSync(path.join(os.tmpdir(),'mmg-landing-'));
const port=31000+Math.floor(Math.random()*20000);
const base='http://127.0.0.1:'+port;
const adminPassword='Landing-test-password-2026!';
const env={
  ...process.env,NO_COLOR:'1',FORCE_COLOR:'0',MMG_DATA_DIR:data,HOST:'127.0.0.1',PORT:String(port),
  MMG_ENV:'development',MMG_SECURE_COOKIE:'0',
  MMG_SECRET:'dev-landing-secret-longer-than-48-characters---0123456789-ABCDEF',
  MMG_TEST_FIXTURES:'1',MMG_ENABLE_REGISTRATION:'0',MMG_PRIVACY_VERSION:'PENDIENTE_REVISION',
  MMG_ADMIN_USERNAME:'LANDINGADMIN',MMG_ADMIN_PASSWORD:adminPassword,
  MMG_ADMIN_EMAIL:'coordinacion@example.edu'
};

const onePixelPng=Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL2WQAAAABJRU5ErkJggg==',
  'base64'
);

async function waitForServer(child) {
  for(let i=0;i<80;i++) {
    try {
      const response=await fetch(base+'/healthz');
      if(response.ok)return;
    } catch {}
    if(child.exitCode!==null)throw new Error('El servidor terminó antes de iniciar.');
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  throw new Error('El servidor no respondió a la comprobación de salud.');
}

test('la portada es configurable y las galerías requieren publicación autorizada',async t=>{
  const seed=spawnSync(process.execPath,['scripts/init-admin.mjs'],{env,encoding:'utf8',timeout:20000});
  assert.equal(seed.status,0,seed.stderr);
  const child=spawn(process.execPath,['src/server.mjs'],{env,stdio:['ignore','pipe','pipe']});
  t.after(()=>{
    child.kill('SIGTERM');
    rmSync(data,{recursive:true,force:true});
  });

  let stderr='';
  child.stderr.on('data',chunk=>stderr+=chunk);
  await waitForServer(child);

  let response=await fetch(base+'/');
  assert.equal(response.status,200);
  let html=await response.text();
  assert.equal((html.match(/<article class="vl-destination">/g)||[]).length,3);
  assert.match(html,/Enriqueciendo vidas\. Abriendo mentes\./);
  assert.match(html,/photo-1555881400-74d7acaacd8b/);
  assert.match(html,/2026–2027/);
  assert.match(html,/Solicitar cuenta/);
  assert.match(html,/Iniciar sesión/);
  assert.match(html,/href="\/acceso"/);
  assert.match(html,/href="\/registro"/);
  assert.equal((html.match(/class="visitor-landing"/g)||[]).length,1);
  assert.doesNotMatch(html,/class="sidebar"/);
  assert.doesNotMatch(html,/class="vl-gallery"/);

  response=await fetch(base+'/coordinacion/configuracion/landing',{redirect:'manual'});
  assert.equal(response.status,303,'la configuración requiere una sesión de coordinación');
  assert.equal(response.headers.get('location'),'/acceso');

  const loginPage=await fetch(base+'/acceso');
  const csrfCookie=loginPage.headers.get('set-cookie')?.split(';')[0];
  const loginHtml=await loginPage.text();
  const csrf=loginHtml.match(/name="csrf" value="([a-f0-9]+)"/)?.[1];
  assert.ok(csrfCookie&&csrf);
  response=await fetch(base+'/acceso',{
    method:'POST',
    headers:{cookie:csrfCookie,'content-type':'application/x-www-form-urlencoded'},
    body:new URLSearchParams({username:'LANDINGADMIN',password:adminPassword,csrf}),
    redirect:'manual'
  });
  assert.equal(response.status,303);
  const sessionCookie=response.headers.get('set-cookie')?.split(';')[0];
  assert.ok(sessionCookie?.startsWith('mmg_session='));
  const cookie=csrfCookie+'; '+sessionCookie;

  response=await fetch(base+'/coordinacion/configuracion/landing',{headers:{cookie}});
  assert.equal(response.status,200);
  html=await response.text();
  assert.match(html,/Configurar landing/);
  assert.match(html,/Galerías/);
  assert.match(html,/Confirmo que existe autorización institucional/);
  const adminCsrf=html.match(/name="csrf" value="([a-f0-9]+)"/)?.[1];
  assert.ok(adminCsrf);

  const settings=new FormData();
  for(const [key,value] of Object.entries({
    csrf:adminCsrf,
    title:'Movilidades MMG',
    eyebrow:'Erasmus+ del IES MMG',
    hero_title:'Tu formación llega más lejos',
    hero_description:'Descubre las oportunidades de movilidad de la convocatoria vigente.',
    about_title:'Aprender en otros entornos',
    about_text:'Una experiencia de movilidad profesional en Europa.',
    destinations_title:'Destinos confirmados',
    destinations_description:'Consulta las oportunidades de esta convocatoria.',
    gallery_title:'Historias Erasmus+',
    gallery_description:'Experiencias compartidas por nuestra comunidad.',
    contact_title:'Contacta con el centro',
    contact_description:'Consulta las próximas convocatorias.',
    contact_email:'',contact_phone:'',address:'',
    social_instagram:'',social_facebook:'',social_youtube:'',
    hero_image_consent:'yes'
  }))settings.set(key,value);
  settings.set('hero_image',new File([onePixelPng],'portada.png',{type:'image/png'}));
  response=await fetch(base+'/coordinacion/configuracion/landing/settings',{method:'POST',headers:{cookie},body:settings});
  assert.equal(response.status,200,stderr);
  html=await response.text();
  assert.match(html,/La portada se ha guardado/);
  const heroId=html.match(/src="\/landing-media\/(\d+)\?preview=1"/)?.[1];
  assert.ok(heroId,'se guarda y previsualiza la imagen de portada');

  response=await fetch(base+'/',{headers:{'cache-control':'no-cache'}});
  html=await response.text();
  assert.match(html,/Tu formación llega más lejos/);
  assert.match(html,/Movilidades MMG/);
  assert.match(html,/Destinos confirmados/);
  response=await fetch(base+'/landing-media/'+heroId);
  assert.equal(response.status,200);
  assert.match(response.headers.get('content-type')||'',/image\/png/);

  const createAlbum=new URLSearchParams({csrf:adminCsrf,title:'Portugal en imágenes',description:'Una experiencia de movilidad profesional.'});
  response=await fetch(base+'/coordinacion/configuracion/landing/album',{
    method:'POST',headers:{cookie,'content-type':'application/x-www-form-urlencoded'},body:createAlbum
  });
  assert.equal(response.status,200);
  html=await response.text();
  const albumId=html.match(/action="\/coordinacion\/configuracion\/landing\/album\/(\d+)"/)?.[1];
  assert.ok(albumId);

  const addPhoto=async({publish=false,consent=false}={})=>{
    const form=new FormData();
    form.set('csrf',adminCsrf);
    form.set('alt_text','Vista del destino durante la movilidad');
    form.set('caption','Aprendizaje en Europa');
    if(publish)form.set('publish_now','1');
    if(consent)form.set('consent_confirmed','yes');
    form.set('image',new File([onePixelPng],'destino.png',{type:'image/png'}));
    return fetch(base+'/coordinacion/configuracion/landing/album/'+albumId+'/foto',{
      method:'POST',headers:{cookie},body:form
    });
  };
  response=await addPhoto({publish:true});
  html=await response.text();
  assert.match(html,/autorización institucional/i,'no publica fotos sin confirmación');
  response=await addPhoto();
  assert.equal(response.status,200);
  html=await response.text();
  const photoId=html.match(/action="\/coordinacion\/configuracion\/landing\/foto\/(\d+)"/)?.[1];
  const imageId=html.match(/src="\/landing-media\/(\d+)\?preview=1"/g)?.at(-1)?.match(/\/landing-media\/(\d+)/)?.[1];
  assert.ok(photoId&&imageId);
  response=await fetch(base+'/landing-media/'+imageId);
  assert.equal(response.status,404,'las imágenes en borrador no son públicas');

  const photoPublish=new URLSearchParams({csrf:adminCsrf,action:'toggle',publish:'1',consent_confirmed:'yes'});
  response=await fetch(base+'/coordinacion/configuracion/landing/foto/'+photoId,{
    method:'POST',headers:{cookie,'content-type':'application/x-www-form-urlencoded'},body:photoPublish
  });
  assert.equal(response.status,200);
  html=await response.text();
  assert.match(html,/Imagen publicada/);
  const albumPublish=new URLSearchParams({
    csrf:adminCsrf,action:'save',title:'Portugal en imágenes',
    description:'Una experiencia de movilidad profesional.',edition_id:'',is_published:'1'
  });
  response=await fetch(base+'/coordinacion/configuracion/landing/album/'+albumId,{
    method:'POST',headers:{cookie,'content-type':'application/x-www-form-urlencoded'},body:albumPublish
  });
  assert.equal(response.status,200);
  html=await response.text();
  assert.match(html,/Galería publicada en la portada/);
  response=await fetch(base+'/');
  html=await response.text();
  assert.match(html,/class="vl-section vl-gallery"/);
  assert.match(html,/Historias Erasmus\+/);
  response=await fetch(base+'/landing-media/'+imageId);
  assert.equal(response.status,200,'la imagen publicada se sirve en la portada');

  const deleteUnconfirmed=new URLSearchParams({csrf:adminCsrf,action:'delete'});
  response=await fetch(base+'/coordinacion/configuracion/landing/album/'+albumId,{
    method:'POST',headers:{cookie,'content-type':'application/x-www-form-urlencoded'},body:deleteUnconfirmed
  });
  html=await response.text();
  assert.match(html,/Confirma que quieres eliminar la galería/);
  response=await fetch(base+'/landing-media/'+imageId);
  assert.equal(response.status,200,'una petición sin confirmación no borra la galería');

  const deleteAlbum=new URLSearchParams({csrf:adminCsrf,action:'delete',confirm_delete:'yes'});
  response=await fetch(base+'/coordinacion/configuracion/landing/album/'+albumId,{
    method:'POST',headers:{cookie,'content-type':'application/x-www-form-urlencoded'},body:deleteAlbum
  });
  assert.equal(response.status,200);
  response=await fetch(base+'/landing-media/'+imageId);
  assert.equal(response.status,404,'al eliminar la galería se retiran sus imágenes');
  response=await fetch(base+'/');
  html=await response.text();
  assert.doesNotMatch(html,/class="vl-section vl-gallery"/);
});
