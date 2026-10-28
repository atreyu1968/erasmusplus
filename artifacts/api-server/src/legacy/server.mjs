import http from 'node:http';
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { get, all, run, audit } from './db.mjs';
import {
  hashPassword, verifyPassword, authFromRequest, csrfToken, validCsrf,
  newSession, deleteSession, cookie, canTry, countTry
} from './auth.mjs';
import { settings, configureResend, sendMail, publicUrl } from './mailer.mjs';
import crypto from 'node:crypto';
import {extraRoute,startMailWorker} from './features.mjs';
import {privacyReady,ageOnRegistration,acknowledgeAdult,clearance,emailGuardianLink} from './feature-privacy.mjs';
import {activeEdition,editionForUser,destinationsForEdition} from './feature-service.mjs';
import {getLandingSettings,publicLandingGallery} from './feature-landing.mjs';
import {renderVisitorLanding} from './feature-landing-view.mjs';

const host=process.env.HOST || '127.0.0.1', port=Number(process.env.PORT || 3000);
const isRegistrationOpen=() => process.env.MMG_ENABLE_REGISTRATION==='1' && privacyReady();
const X=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const header=(req,status,contentType='text/html; charset=utf-8',more={})=>{
  const h={
    'Content-Type':contentType,'Cache-Control':'no-store',
    'X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY',
    'Referrer-Policy':'no-referrer',
    'Content-Security-Policy':"default-src 'self'; img-src 'self' https: data:; style-src 'self'; script-src 'self'; form-action 'self'; base-uri 'self'; frame-ancestors 'none'; object-src 'none'",
    ...more
  };
  req.res.writeHead(status,h);
};
function send(req,status,html,more={}){header(req,status,'text/html; charset=utf-8',more);req.res.end(html);}
function redirect(req,to,extra={}){send(req,303,'',{Location:to,...extra});}
function csrf(req){return csrfToken(req).token;}
function field(label,name,{type='text',required=false,placeholder='',value='',extra=''}={}) {
  return '<label>'+X(label)+'<input name="'+name+'" type="'+type+'" '+(required?'required ':'')+'placeholder="'+X(placeholder)+'" value="'+X(value)+'" '+extra+'></label>';
}
function postButton(label,action,token,extras='') {
  return '<form method="post" action="'+action+'"><input type="hidden" name="csrf" value="'+X(token)+'">'+extras+'<button class="btn small" type="submit">'+X(label)+'</button></form>';
}
const nav=[['/panel','⌂','Inicio'],['/candidatura','▤','Candidatura Erasmus'],['/agenda','▦','Agenda y tareas'],['/destinos','⌖','Destinos Erasmus'],['/movilidades','✈','Tipos de movilidad'],['/normativa','§','Normativa Erasmus'],['/compromisos','✓','Compromisos'],['/notificaciones','♧','Notificaciones'],['/documentos','▣','Documentación'],['/chat','✉','Chat interno'],['/perfil','♙','Mi perfil'],['/passkeys','◎','Acceso biométrico']];
const navIconPaths={
  '⌂':'M3 10.5 12 3l9 7.5M5.5 9.5V21h13V9.5M9 21v-7h6v7',
  '⇥':'M10 17l5-5-5-5m5 5H3m11-9h6a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1h-6',
  '▤':'M7 3h10l4 4v14H3V3h4Zm0 0v5h10V3M7 13h10M7 17h7',
  '▦':'M4 5h16v16H4zM8 3v4m8-4v4M4 10h16m-11 4h2m3 0h2m-7 3h2',
  '⌖':'M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Zm-5 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',
  '✈':'m3 12 18-8-7 18-3-7-8-3Zm8 3 5-5',
  '§':'M6 3h12v18H6zM9 8h6m-6 4h6m-6 4h4',
  '✓':'m5 12 4 4L19 6',
  '♧':'M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9m-8 12h4',
  '▣':'M3 6h7l2 2h9v11H3z',
  '✉':'M4 5h16v12H9l-5 4zM8 9h8m-8 4h6',
  '♙':'M20 21a8 8 0 0 0-16 0m12-13a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
  '◎':'M12 3a9 9 0 1 0 9 9m-9-4v5l4 2m3-11h4m-2-2v4',
  '＋':'M12 5v14m-7-7h14',
  '⚙':'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm0-5v2m0 14v2m9-9h-2M5 12H3m15.36-6.36-1.42 1.42M7.06 16.94l-1.42 1.42m12.72 0-1.42-1.42M7.06 7.06 5.64 5.64'
};
function iconMarkup(icon){
  const path=navIconPaths[icon];
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="'+(path||navIconPaths['▤'])+'"/></svg>';
}
function layout(req,title,main,{publicPage=false,status=200,mainClass='',hideSidebar=false}={}){
  const user=req.auth?.user;
  const current=req.url.split('?')[0];
  const links=hideSidebar?[]:publicPage?[['/','⌂','Inicio'],['/acceso','⇥','Acceso'],['/registro','♙','Registro'],['/privacidad','§','Privacidad']]:
    [...nav,...(user?.role==='coordinator'?[['/coordinacion','▦','Control de cuentas'],['/coordinacion/ediciones','▦','Ediciones y destinos'],['/coordinacion/candidaturas','▤','Candidaturas recibidas'],['/coordinacion/documentos','▣','Archivo documental'],['/coordinacion/grupos','♙','Grupos de movilidad'],['/coordinacion/chat','✉','Supervisión de chat'],['/coordinacion/privacidad','✓','Autorizaciones de menores'],['/coordinacion/crear-cuenta','＋','Crear cuenta'],['/coordinacion/configuracion/landing','⚙','Portada y galerías'],['/coordinacion/configuracion','⚙','Configurar Resend']]:[])];
  const sidebar=links.map(([href,icon,name],index)=>
    (user?.role==='coordinator'&&index===nav.length?'<span class="nav-divider">COORDINACIÓN</span>':'')+
    '<a class="nav'+(href===current?' current':'')+'" href="'+href+'" title="'+X(name)+'" aria-label="'+X(name)+'"><i aria-hidden="true">'+iconMarkup(icon)+'</i><span class="nav-label">'+X(name)+'</span></a>'
  ).join('');
  const sessionActions=user?postButton('Cerrar sesión','/salir',csrf(req)):'<a class="btn small" href="/acceso">Acceder</a>';
  const edition=editionForUser(user);
  const userIdentity=hideSidebar?'':'<span class="avatar">'+X((user?.first_name||'E').slice(0,1))+'</span><span class="user-name">'+X(user?.first_name||'Visitante')+'</span>';
  const sidebarMarkup=hideSidebar?'':'<aside class="sidebar" id="app-sidebar" aria-label="Navegación principal">'+
    '<button class="sidebar-pin" type="button" aria-label="Fijar menú abierto" aria-controls="app-sidebar" aria-expanded="false" aria-pressed="false" title="Fijar menú abierto">'+
    '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3h8l-1 5 3 3v2H6v-2l3-3-1-5Zm4 10v8"/></svg>'+
    '</button><p class="side-label">GUÍA DE ISORA · TENERIFE</p><nav>'+sidebar+'</nav><div class="sidefooter">Enriqueciendo vidas.<br>Abriendo mentes.</div></aside>';
  const page='<!doctype html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#143e71"><title>'+X(title)+' · Erasmus+ MMG</title><link rel="icon" type="image/png" sizes="192x192" href="/erasmus-favicon-192.png"><link rel="apple-touch-icon" href="/erasmus-favicon-192.png"><link rel="stylesheet" href="/styles.css"><link rel="manifest" href="/manifest.webmanifest"></head><body>'+
  '<div class="shell'+(hideSidebar?' public-shell':'')+'"><header class="topbar"><a class="brand" href="/"><img class="brand-logo" src="/erasmus-logo.png" alt=""><span class="brand-copy"><b>Movilidades Erasmus+</b><small>IES Manuel Martín González</small></span></a><span class="course-label">'+X(edition?.label||'Sin edición activa')+'</span><div class="user">'+userIdentity+sessionActions+'</div></header>'+
  sidebarMarkup+
  '<div class="workspace"><main'+(mainClass?' class="'+X(mainClass)+'"':'')+'>'+main+'<footer>Movilidades Erasmus+ MMG · Fase 1 de desarrollo. No introducir datos reales hasta concluir la revisión de seguridad y protección de datos.</footer></main></div></div><script src="/navigation.js" defer></script></body></html>';
  const cookieResult=csrfToken(req);
  send(req,status,page,cookieResult.setCookie?{'Set-Cookie':cookieResult.setCookie}:{});
}
function error(req,status,message){layout(req,'Aviso','<section class="card"><h1>'+status+'</h1><p>'+X(message)+'</p><a class="btn" href="/">Volver al inicio</a></section>',{status,publicPage:!req.auth});}
function mustLogin(req){if(!req.auth){redirect(req,'/acceso');return false;}return true;}
function mustAdmin(req){if(!mustLogin(req))return false;if(req.auth.user.role!=='coordinator'){error(req,403,'Esta sección es exclusiva de coordinación.');return false;}return true;}
function success(title,text){return '<div class="alert success"><strong>'+X(title)+'</strong><p>'+X(text)+'</p></div>';}
function formAlert(text){return '<div class="alert">'+X(text)+'</div>';}
const fallbackDestinationImages={
  'Viseu':{
    url:'/images/viseu-cathedral.jpg',
    image_alt:'Fachada de la Catedral de Viseu con sus dos torres.',
    image_credit:'Pedro Ribeiro Simões',
    image_source_url:'https://commons.wikimedia.org/wiki/File:Viseu_Cathedral_(49870949086).jpg',
    image_license_name:'CC BY 2.0',
    image_license_url:'https://creativecommons.org/licenses/by/2.0/',
    image_note:'Recorte de encuadre en la tarjeta.'
  },
  'Oporto':{
    url:'/images/porto-ribeira.jpg',
    image_alt:'Barcos rabelos en el Duero frente al barrio de la Ribeira de Oporto.',
    image_credit:'Jakub Hałun',
    image_source_url:'https://commons.wikimedia.org/wiki/File:Rabelo_boats_and_Ribeira_seen_from_Cais_de_Gaia,_20250605_1623_9879.jpg',
    image_license_name:'CC BY 4.0',
    image_license_url:'https://creativecommons.org/licenses/by/4.0/',
    image_note:'Recorte de encuadre en la tarjeta.'
  },
  'Róterdam':{url:'https://images.unsplash.com/photo-1512470876302-972faa2aa9a4?auto=format&fit=crop&w=900&q=80'}
};
const publicImageAssets={
  '/images/viseu-cathedral.jpg':'image/jpeg',
  '/images/porto-ribeira.jpg':'image/jpeg',
  '/images/mmg-viseu-commons.jpg':'image/jpeg',
  '/images/mmg-porto-commons.jpg':'image/jpeg',
  '/erasmus-logo.png':'image/png',
  '/erasmus-favicon-192.png':'image/png',
  '/erasmus-favicon-512.png':'image/png'
};
function imageCredit(destination){
 if(!destination.image_credit||!destination.image_source_url||!destination.image_license_url||!destination.image_license_name)return '';
 return '<small class="visitor-photo-credit">Foto: '+X(destination.image_credit)+' · <a href="'+X(destination.image_source_url)+'" target="_blank" rel="noopener noreferrer">Fuente</a> · <a href="'+X(destination.image_license_url)+'" target="_blank" rel="noopener noreferrer">'+X(destination.image_license_name)+'</a>'+(destination.image_note?' · '+X(destination.image_note):'')+'</small>';
}
function destinationMedia(destination){
 const fallback=fallbackDestinationImages[destination.name];
 const useFallback=!destination.image_url;
 const hasCredit=destination.image_credit&&destination.image_source_url&&destination.image_license_url&&destination.image_license_name;
 const creditData=hasCredit?destination:(useFallback&&fallback?fallback:destination);
 return {
   image:destination.image_url||fallback?.url||'',
   alt:destination.image_alt||(useFallback&&fallback?.image_alt)||'Fotografía ilustrativa de '+destination.name,
   credit:imageCredit(creditData)
 };
}
function destinationCards(items=destinationsForEdition()){
 return items.length?'<div class="dest-grid">'+items.map(destination=>{
   const media=destinationMedia(destination);
   return '<article class="card destination">'+(media.image?'<img src="'+X(media.image)+'" alt="'+X(media.alt)+'">':'<div class="destination-image-empty" aria-hidden="true"></div>')+
    '<div><span class="eyebrow">'+X(destination.country)+'</span><h3>'+X(destination.name)+'</h3><p>'+X(destination.description)+'</p>'+media.credit+'</div></article>';
  }).join('')+'</div>':'<div class="card"><p>No hay destinos activos para la edición seleccionada.</p></div>';
}
function landing(req){
  const edition=activeEdition(),destinations=edition?destinationsForEdition(edition.id):[];
  const config=getLandingSettings();
  const content=renderVisitorLanding({
    settings:{
      title:config.title,eyebrow:config.eyebrow,heroTitle:config.hero_title,
      heroDescription:config.hero_description,
      aboutTitle:config.about_title,aboutText:config.about_text,
      destinationsTitle:config.destinations_title,destinationsDescription:config.destinations_description,
      galleryTitle:config.gallery_title,galleryDescription:config.gallery_description,
      contactTitle:config.contact_title,contactDescription:config.contact_description,
      heroImageUrl:config.hero_file_id?'/landing-media/'+config.hero_file_id:'',
      contactEmail:config.contact_email,contactPhone:config.contact_phone,address:config.address,
      socialInstagram:config.social_instagram,socialFacebook:config.social_facebook,socialYoutube:config.social_youtube
    },
    editionLabel:edition?.label||'Sin edición activa',
    destinations,
    galleryItems:publicLandingGallery()
  });
  layout(req,'Bienvenida',content,{publicPage:true,mainClass:'visitor-landing',hideSidebar:true});
}
function login(req,msg=''){
 layout(req,'Acceso','<div class="form-container"><p class="eyebrow">ÁREA PERSONAL</p><h1>Iniciar sesión</h1><p>Solo las cuentas con correo verificado y aprobadas por coordinación podrán acceder.</p>'+ (msg?formAlert(msg):'')+
  '<form class="card form" method="post" action="/acceso"><input type="hidden" name="csrf" value="'+csrf(req)+'">'+field('DNI (docentes) o CIAL (alumnado)','username',{required:true,extra:'autocomplete="username"'})+
  field('Contraseña','password',{type:'password',required:true,extra:'autocomplete="current-password"'})+'<button class="btn" type="submit">Acceder con contraseña</button><button class="btn secondary" type="button" id="loginPasskey">Entrar con passkey</button><p id="passkeyStatus" role="status"></p></form><p><a href="/registro">Solicitar una cuenta</a> · <a href="/reenviar">Reenviar verificación de correo</a></p></div>',{publicPage:true,hideSidebar:true});
}
function registration(req,msg=''){
  const edition=activeEdition();
  const open=isRegistrationOpen() && settings().configured && Boolean(edition);
 const families=['Administración y gestión','Agraria','Edificación y obra civil','Imagen personal','Transporte y mantenimiento de vehículos'];
 const options=families.map(x=>'<option>'+X(x)+'</option>').join('');
  const form='<form class="card form" method="post" action="/registro"><input type="hidden" name="csrf" value="'+csrf(req)+'">'+
  '<p class="notice-box">Esta cuenta quedará vinculada a la convocatoria '+X(edition?.label||'vigente')+'. Coordinación podrá cambiar la asignación.</p>'+
 '<h2>1. Datos personales</h2><div class="fields"><label>Perfil<select name="role" required><option value="student">Alumnado</option><option value="teacher">Docente</option></select></label>'+
 field('Nombre','first_name',{required:true,extra:'maxlength="100"'})+
 field('Apellidos','last_name',{required:true,extra:'maxlength="150"'})+
 field('Fecha de nacimiento','birth_date',{type:'date',required:true})+
 field('DNI (docentes)','dni',{extra:'maxlength="20"'})+
 field('CIAL (alumnado)','cial',{extra:'maxlength="30"'})+
 field('Teléfono personal','phone',{type:'tel',required:true})+
 field('Teléfono de progenitores (si es menor de edad)','guardian_phone',{type:'tel'})+
 field('Correo institucional','institutional_email',{type:'email',required:true,placeholder:'usuario@canariaseducacion.es'})+
 field('Correo Gmail (alumnado)','gmail',{type:'email'})+'</div>'+
 '<h2>2. Datos académicos</h2><div class="fields"><label>Familia profesional<select name="professional_family" required><option value="">Selecciona una opción</option>'+options+'</select></label>'+
 field('Centro educativo','center',{required:true,value:'IES Manuel Martín González'})+
 field('Estudios que cursas (alumnado)','studies')+
  field('Módulos y cursos '+(activeEdition()?.label||'de la edición vigente')+' (docentes)','modules')+'</div>'+
 '<h2>3. Credenciales</h2><p class="muted">El usuario será el DNI del docente o el CIAL del alumnado. Confirmarás tu correo con un enlace enviado mediante Resend. Después, coordinación deberá aprobar la cuenta.</p><div class="fields">'+
 field('Contraseña (mínimo 12 caracteres)','password',{type:'password',required:true,extra:'minlength="12" maxlength="128" autocomplete="new-password"'})+
 field('Repetir contraseña','password_again',{type:'password',required:true,extra:'minlength="12" maxlength="128"'})+'</div>'+
 '<label class="checkbox"><input type="checkbox" name="privacy" value="yes" required> He leído el <a href="/privacidad" target="_blank" rel="noopener noreferrer">aviso de privacidad</a> y acuso recibo de la información. Si soy mayor de edad, se registrará electrónicamente mi aceptación informativa; si soy menor, mi representante legal deberá firmar y subir un PDF de autorización.</label>'+
 '<button class="btn" type="submit" '+(open?'':'disabled')+'>Enviar solicitud</button></form>';
 layout(req,'Registro','<div class="heading"><p class="eyebrow">SOLICITUD DE CUENTA</p><h1>Registro de participantes</h1><p>Formulario de alumnado y docentes con aprobación manual obligatoria.</p></div>'+
  (!open?formAlert(edition?'Registro deshabilitado. Coordinación debe configurar Resend y aprobar el aviso de privacidad antes de abrir las altas.':'No hay una convocatoria vigente para asociar nuevas cuentas.'):'')+
  (msg?formAlert(msg):'')+form,{publicPage:true,hideSidebar:true});
}
function home(req){
 const user=req.auth.user;
 if(user.role==='coordinator'){redirect(req,'/coordinacion');return;}
  const edition=editionForUser(user);
 layout(req,'Mi espacio','<p class="eyebrow">TU ESPACIO ERASMUS+</p><h1>¡Bienvenido/a, '+X(user.first_name)+'!</h1><p>Tu cuenta ha sido verificada y aprobada por coordinación.</p>'+
 '<div class="hero short"><h2>Tu próxima experiencia europea empieza aquí.</h2><p>Consulta destinos, modalidades e información del programa.</p><a class="btn light" href="/destinos">Explorar destinos</a></div>'+
  '<div class="heading"><p class="eyebrow">CURSO '+X(edition?.label||'')+'</p><h2>Explora las movilidades</h2></div>'+destinationCards(edition?destinationsForEdition(edition.id):[])+
 '<div class="card"><h2>Próximas funcionalidades</h2><p>Candidaturas, archivos PDF, notificaciones y chat se desarrollarán después de validar esta primera fase.</p></div>');
}
function destinationsPage(req){
  const edition=editionForUser(req.auth.user),destinations=edition?destinationsForEdition(edition.id):[];
  const rows=destinations.map(destination=>'<tr><td>'+X(destination.name)+'</td><td>'+X(destination.country)+'</td>'+
    '<td>'+X(destination.modes.map(mode=>mode==='short'?'Movilidad corta':mode==='long'?'Movilidad larga':'Job Shadowing').join(' · '))+'</td>'+
    '<td>'+X(destination.families.join(' · ')||'Todas las familias')+'</td></tr>').join('');
  layout(req,'Destinos Erasmus','<div class="heading"><p class="eyebrow">DESCUBRE EUROPA</p><h1>Destinos Erasmus</h1><p>Información del curso '+X(edition?.label||'')+'.</p></div>'+destinationCards(destinations)+
  '<div class="card"><h2>Destinos y modalidades de la edición</h2><div class="responsive"><table><thead><tr><th>Destino</th><th>País</th><th>Modalidades</th><th>Familias profesionales</th></tr></thead><tbody>'+
  (rows||'<tr><td colspan="4">No hay destinos activos en esta edición.</td></tr>')+
  '</tbody></table></div><p class="muted">La asignación definitiva depende de la convocatoria aprobada.</p></div>');
}
function typesPage(req){
 layout(req,'Tipos de movilidad','<div class="heading"><p class="eyebrow">OPORTUNIDADES FORMATIVAS</p><h1>Tipos de movilidad</h1><p>Modalidades previstas en el proyecto.</p></div>'+
 '<div class="card"><p><a class="btn" href="/movilidad/corta">Infografía de movilidad corta</a> <a class="btn" href="/movilidad/larga">Infografía Dual-Erasmus+</a></p></div><div class="two"><div class="card"><span class="tag">MOVILIDAD CORTA</span><h2>10 días en Países Bajos</h2><p>Actividades formativas, convivencia y visita a centros como Albeda y RDM Campus. Viaje Tenerife Sur–Ámsterdam Schiphol previsto entre febrero y marzo de 2027.</p><p>Desplazamientos en transporte público y convivencia en apartamentos.</p></div>'+
 '<div class="card"><span class="tag">DUAL ERASMUS+</span><h2>Movilidad larga · 2,5 meses</h2><p>Formación en empresa u organismo equiparado para alumnado de segundo curso de ciclos de grado medio y superior, según los destinos y plazas confirmados.</p><p>Autonomía, desarrollo profesional y enriquecimiento personal.</p></div></div>');
}
function rulesPage(req){
 layout(req,'Normativa','<div class="heading"><p class="eyebrow">DOCUMENTACIÓN Y RESPONSABILIDAD</p><h1>Normativa Erasmus+</h1><p>Esta sección se completará con la normativa de la convocatoria, SIFPRE y las guías de viaje específicas de Portugal y Países Bajos.</p></div>'+
 '<div class="card"><h2>Normativa vigente y guías por destino</h2><p><a class="btn" href="/normativa/completa">Consultar normativa Erasmus+ FP y las guías de viaje Portugal / Países Bajos</a></p></div><div class="card"><h2>Documentación pendiente de validación</h2><p>La versión operativa incorporará los compromisos de participantes, documentos descargables y firma o aceptación verificable.</p><p><a href="https://erasmus-plus.ec.europa.eu/es" target="_blank" rel="noopener noreferrer">Portal oficial Erasmus+ de la Unión Europea ↗</a></p></div>');
}
function resendForm(req,msg=''){
 layout(req,'Reenviar verificación','<div class="form-container"><h1>Reenviar verificación</h1><p>Si la cuenta está pendiente de confirmar el correo, se enviará un nuevo enlace. Por privacidad, no se indicará si el usuario existe.</p>'+
 (msg?formAlert(msg):'')+
 '<form class="card form" method="post" action="/reenviar"><input type="hidden" name="csrf" value="'+csrf(req)+'">'+field('DNI o CIAL','username',{required:true})+'<button class="btn">Solicitar nuevo enlace</button></form></div>',{publicPage:true});
}
function verificationConfirm(req,token){
 layout(req,'Confirmar correo','<div class="form-container"><p class="eyebrow">VERIFICACIÓN INSTITUCIONAL</p><h1>Confirmar correo</h1><p>Al confirmar, tu correo institucional quedará validado. Aun así, tu cuenta seguirá pendiente de aprobación manual por coordinación.</p>'+
 '<form class="card form" method="post" action="/verificar"><input type="hidden" name="csrf" value="'+csrf(req)+'"><input type="hidden" name="token" value="'+X(token)+'"><button class="btn">Confirmar mi correo</button></form></div>',{publicPage:true});
}
function adminDashboard(req,notice=''){
  const users=all("SELECT u.id,u.role,u.username,u.first_name,u.last_name,u.birth_date,u.institutional_email,u.status,u.email_verified_at,u.created_at,e.label AS edition_label "+
    "FROM users u LEFT JOIN erasmus_editions e ON e.id=u.edition_id WHERE u.role!='coordinator' ORDER BY u.created_at DESC LIMIT 150");
 const total=users.length,pending=users.filter(u=>u.status==='pending').length,teachers=users.filter(u=>u.role==='teacher').length,students=users.filter(u=>u.role==='student').length;
 const rows=users.map(u=>'<tr><td><b>'+X(u.first_name+' '+u.last_name)+'</b><small>'+X(u.role==='teacher'?'Docente':'Alumnado')+'</small></td>'+
  '<td>'+X(u.institutional_email)+'</td><td>'+X(u.edition_label||'Sin asignar')+'</td><td>'+X(u.email_verified_at?'Verificado':'Pendiente')+'</td><td>'+X(clearance(u).label)+'</td><td><span class="pill">'+X(u.status)+'</span></td><td><a href="/coordinacion/usuario/'+u.id+'">Ficha</a> · <a href="/coordinacion/editar/'+u.id+'">Editar</a></td><td>'+
 (u.status==='pending'?postButton('Aprobar','/coordinacion/estado',csrf(req),'<input type="hidden" name="id" value="'+u.id+'"><input type="hidden" name="status" value="approved">'):'')+
 (u.status!=='disabled'?postButton('Desactivar','/coordinacion/estado',csrf(req),'<input type="hidden" name="id" value="'+u.id+'"><input type="hidden" name="status" value="disabled">'):'')+'</td></tr>').join('');
 layout(req,'Control de cuentas','<div class="heading"><p class="eyebrow">ADMINISTRACIÓN ERASMUS+ MMG</p><h1>Panel de coordinación</h1><p>Registro y aprobación de cuentas. Solo podrán aprobarse usuarios con correo institucional verificado.</p></div>'+
 (notice?formAlert(notice):'')+'<div class="metrics"><div><span>REGISTRADOS</span><b>'+total+'</b></div><div><span>PENDIENTES</span><b>'+pending+'</b></div><div><span>DOCENTES</span><b>'+teachers+'</b></div><div><span>ALUMNADO</span><b>'+students+'</b></div></div>'+
  '<div class="card"><div class="row"><h2>Control de cuentas</h2><a class="btn small" href="/coordinacion/ediciones">Convocatorias y destinos</a><a class="btn small" href="/coordinacion/crear-cuenta">+ Añadir cuenta</a><a class="btn small" href="/coordinacion/privacidad">✓ Revisar autorizaciones de menores</a><a class="btn small" href="/coordinacion/configuracion">⚙ Configurar Resend</a></div><div class="responsive"><table><thead><tr><th>Participante</th><th>Correo</th><th>Convocatoria</th><th>Verificación</th><th>Privacidad</th><th>Estado</th><th>Ficha</th><th>Acciones</th></tr></thead><tbody>'+rows+'</tbody></table></div>'+
 (users.length?'':'<p>Sin solicitudes de participantes.</p>')+'</div>');
}
function adminUser(req,id){
 const u=get("SELECT * FROM users WHERE id=? AND role!='coordinator'",id);
 if(!u){error(req,404,'Usuario no encontrado.');return;}
 const rows=[
 ['Nombre',u.first_name+' '+u.last_name],['Perfil',u.role],['Usuario',u.username],
  ['Convocatoria',get('SELECT label FROM erasmus_editions WHERE id=?',u.edition_id)?.label||'Sin asignar'],
 ['Nacimiento',u.birth_date],['DNI',u.dni],['CIAL',u.cial],['Teléfono',u.phone],
 ['Teléfono familiar',u.guardian_phone],['Correo institucional',u.institutional_email],
 ['Correo alternativo',u.gmail],['Familia profesional',u.professional_family],
 ['Instituto',u.center],['Estudios',u.studies],['Módulos',u.modules],
 ['Estado',u.status],['Correo verificado',u.email_verified_at||'Pendiente']
 ].map(([k,v])=>'<tr><th>'+X(k)+'</th><td>'+X(v)+'</td></tr>').join('');
 layout(req,'Ficha de participante','<div class="heading"><p class="eyebrow">SOLO COORDINACIÓN</p><h1>Ficha de participante</h1><p>Datos privados del registro. Esta primera versión es de consulta, sin modificación de campos.</p></div>'+
 '<div class="card"><div class="responsive"><table>'+rows+'</table></div><p><a class="btn" href="/coordinacion">Volver a control de cuentas</a></p></div>');
}
function mailConfig(req,notice=''){
 const s=settings();
 const contents='<div class="heading"><p class="eyebrow">CONFIGURACIÓN PRIVADA · COORDINACIÓN</p><h1>Servicio de correo Resend</h1><p>Configura los correos de verificación y las notificaciones. La clave se cifra en SQLite y no vuelve a mostrarse completa.</p></div>'+
 (notice?formAlert(notice):'')+
 '<div class="metrics"><div><span>API RESEND</span><b class="small-metric">'+X(s.maskedKey)+'</b></div><div><span>ESTADO</span><b class="small-metric">'+(s.configured?'Configurada':'Sin configurar')+'</b></div></div>'+
 '<form class="card form" method="post" action="/coordinacion/configuracion"><input type="hidden" name="csrf" value="'+csrf(req)+'">'+
 field('API Key (si dejas en blanco, se conserva la existente)','apiKey',{type:'password',placeholder:'re_••••••••',extra:'autocomplete="new-password"'})+
 field('Remitente autorizado en Resend','from',{required:true,value:s.from,placeholder:'erasmus@dominio-institucional.es'})+
 field('URL pública HTTPS de la aplicación','publicUrl',{required:true,value:s.publicUrl,placeholder:'https://subdominio.institucional.es'})+
 '<button class="btn" type="submit">Guardar configuración cifrada</button></form>'+
 '<div class="card"><h2>Antes del primer envío</h2><p>Verifica la propiedad y los registros DNS del dominio remitente dentro del panel de Resend. La configuración aquí no verifica el dominio automáticamente.</p>'+
 '<p>Solicita una clave con permisos limitados a envío. No escribas la clave en GitHub ni la compartas por correo.</p>'+
 '<form method="post" action="/coordinacion/probar-correo"><input type="hidden" name="csrf" value="'+csrf(req)+'"><button class="btn" type="submit">Enviar prueba a mi correo institucional</button></form></div>';
 layout(req,'Configurar Resend',contents);
}
async function readForm(req){
 let buffer='';for await(const chunk of req) {buffer+=chunk.toString('utf8');if(buffer.length>25000)throw Error('Formulario demasiado grande.');}
  const body={};
  for(const [key,value] of new URLSearchParams(buffer)) {
    if(!Object.hasOwn(body,key))body[key]=value;
    else if(Array.isArray(body[key]))body[key].push(value);
    else body[key]=[body[key],value];
  }
  return body;
}
function requireCSRF(req,body){if(!validCsrf(req,body)){error(req,403,'Verificación de seguridad fallida. Vuelve a cargar el formulario.');return false;}return true;}
function lookupUsername(body,role){
 return (role==='teacher'?body.dni:body.cial||'').trim().toUpperCase();
}
async function sendVerification(user){
 const token=crypto.randomBytes(32).toString('hex');
 const hashed=crypto.createHash('sha256').update(token).digest('hex');
 run('DELETE FROM verification_tokens WHERE user_id=?',user.id);
 run('INSERT INTO verification_tokens(token_hash,user_id,expires_at) VALUES (?,?,?)',hashed,user.id,Date.now()+24*3600*1000);
 const link=publicUrl()+'/verificar?token='+token;
 await sendMail(user.institutional_email,'Verifica tu correo · Erasmus+ MMG',
 'Hola '+user.first_name+'.\n\nPara verificar tu dirección de correo institucional, abre este enlace (válido 24 horas):\n'+link+
 '\n\nDespués, la coordinación del IES Manuel Martín González deberá aprobar tu cuenta manualmente.\nSi no has solicitado el registro, ignora este mensaje.');
}
async function register(req,body){
 if(!requireCSRF(req,body))return;
 if(!isRegistrationOpen()||!settings().configured){registration(req,'El registro aún no está habilitado.');return;}
  const edition=activeEdition();
  if(!edition){registration(req,'No existe una convocatoria vigente a la que asociar la cuenta.');return;}
 const role=String(body.role||'');
 if(!['student','teacher'].includes(role)){registration(req,'Selecciona un perfil válido.');return;}
 const username=lookupUsername(body,role),email=String(body.institutional_email||'').trim().toLowerCase();
 const first=String(body.first_name||'').trim(),last=String(body.last_name||'').trim();
 const password=String(body.password||''),dob=String(body.birth_date||'');
 const age=ageOnRegistration(dob);
 if(!username || username.length>30 || !first || !last || first.length>100 || last.length>150 ||
    !email.endsWith('@canariaseducacion.es') || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    password.length<12 || password.length>128 || password!==body.password_again ||
    (age===null) || age<12 || age>100 || (role==='teacher' && age<18) ||
    (age<18 && !String(body.guardian_phone||'').trim()) ||
    !String(body.phone||'').trim() || body.privacy!=='yes' ||
    !String(body.professional_family||'').trim() || !String(body.center||'').trim()) {
   registration(req,'Revisa los campos: contraseña, fecha de nacimiento, correo institucional y teléfonos obligatorios.');return;
 }
 const dup=get('SELECT id FROM users WHERE username=? OR institutional_email=?',username,email);
 if(dup){registration(req,'Ya existe una solicitud con estos datos. Contacta con coordinación.');return;}
 const hash=await hashPassword(password);
  const info=run("INSERT INTO users(role,username,pass_hash,first_name,last_name,birth_date,dni,cial,phone,guardian_phone,institutional_email,gmail,professional_family,center,studies,modules,edition_id,privacy_version,status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'pending')",
   role,username,hash,first,last,dob,String(body.dni||'').trim(),String(body.cial||'').trim(),String(body.phone||'').trim(),
   String(body.guardian_phone||'').trim(),email,String(body.gmail||'').trim(),
    String(body.professional_family||'').trim(),String(body.center||'').trim(),String(body.studies||'').trim(),String(body.modules||'').trim(),edition.id,process.env.MMG_PRIVACY_VERSION);
 const id=Number(info.lastInsertRowid);
 if(age>=18)acknowledgeAdult(id);
 audit(null,'registration_requested',id);
  let note='Solicitud guardada para la convocatoria '+edition.label+'. Revisa tu correo institucional para confirmar el enlace. Después, coordinación aprobará la cuenta.';
 try {await sendVerification({id,first_name:first,institutional_email:email});}
 catch(e){console.error('Resend: error de entrega tras registro:',e.message);note='Solicitud guardada, pero no se pudo enviar la verificación. Solicita un reenvío cuando el servicio esté disponible.';}
 layout(req,'Solicitud recibida','<div class="form-container">'+success('Solicitud recibida',note)+'<p><a class="btn" href="/acceso">Volver al acceso</a></p></div>',{publicPage:true});
}
async function loginAction(req,body){
 if(!requireCSRF(req,body))return;
 const username=String(body.username||'').trim().toUpperCase(),pass=String(body.password||'');
 const key=(req.socket.remoteAddress||'local')+':'+username.slice(0,45);
 if(!canTry(key)){login(req,'Demasiados intentos. Inténtalo más tarde.');return;}
 const user=get('SELECT * FROM users WHERE username=?',username);
 const valid=user&&await verifyPassword(pass,user.pass_hash);
 countTry(key,valid);
 if(!valid){login(req,'Usuario o contraseña incorrectos.');return;}
 if(user.status!=='approved'||(!user.email_verified_at && user.role!=='coordinator')){
   login(req,'Tu cuenta necesita verificación del correo y aprobación de coordinación antes de acceder.');return;
 }
 const sessionCookie=newSession(user.id);
 audit(user.id,'login',user.id);
 redirect(req,user.role==='coordinator'?'/coordinacion':'/panel',{'Set-Cookie':sessionCookie});
}
async function verifyAction(req,body){
 if(!requireCSRF(req,body))return;
 const token=String(body.token||'');
 if(!/^[a-f0-9]{64}$/.test(token)){error(req,400,'Enlace de verificación no válido.');return;}
 const tokenHash=crypto.createHash('sha256').update(token).digest('hex');
 const row=get('SELECT user_id,expires_at FROM verification_tokens WHERE token_hash=?',tokenHash);
 if(!row||row.expires_at<Date.now()){error(req,400,'El enlace no es válido o ha caducado. Puedes solicitar otro.');return;}
 run('UPDATE users SET email_verified_at=CURRENT_TIMESTAMP WHERE id=?',row.user_id);
 run('DELETE FROM verification_tokens WHERE user_id=?',row.user_id);
 audit(row.user_id,'email_verified',row.user_id);
 const verifiedUser=get('SELECT * FROM users WHERE id=?',row.user_id);
 let guardianInstruction='';
 if(verifiedUser && !clearance(verifiedUser).approved){
  try{
    await emailGuardianLink(verifiedUser);
    guardianInstruction=ageOnRegistration(verifiedUser.birth_date)<18?
      ' Por ser menor de edad, hemos enviado al correo institucional un enlace para descargar y entregar la autorización firmada del representante legal.':
      ' Hemos enviado un enlace para registrar electrónicamente la aceptación informativa de privacidad.';
  }catch(e){console.error('Error enviando trámite de privacidad:',e.message);guardianInstruction=' Puedes solicitar otro enlace de privacidad desde la sección correspondiente.';}
 }
 layout(req,'Correo verificado','<div class="form-container">'+success('Correo verificado correctamente',
   'Tu solicitud está pendiente de aprobación manual por coordinación. Recibirás un correo cuando se revise.'+guardianInstruction)+
 '<p><a class="btn" href="/acceso">Ir al acceso</a></p></div>',{publicPage:true});
}
async function resendAction(req,body){
 if(!requireCSRF(req,body))return;
 const username=String(body.username||'').trim().toUpperCase();
 const key=(req.socket.remoteAddress||'local')+':resend:'+username.slice(0,45);
 if(canTry(key)){
   countTry(key,false);
   const user=get("SELECT * FROM users WHERE username=? AND status='pending' AND email_verified_at IS NULL",username);
   if(user){
     const recent=get('SELECT MAX(expires_at) AS exp FROM verification_tokens WHERE user_id=?',user.id);
     if(!recent?.exp || recent.exp < Date.now()+24*3600*1000-120000){
       try {await sendVerification(user);} catch(e){console.error('Resend: error al reenviar:',e.message);}
     }
   }
 }
 resendForm(req,'Si la cuenta está pendiente y es posible enviar el mensaje, llegará un nuevo enlace al correo registrado.');
}
async function updateStatus(req,body){
 if(!requireCSRF(req,body))return;
 const id=Number(body.id),status=String(body.status||'');
 if(!Number.isSafeInteger(id)||!['approved','rejected','disabled'].includes(status)){error(req,400,'Acción no válida.');return;}
 const user=get("SELECT * FROM users WHERE id=? AND role!='coordinator'",id);
 if(!user){error(req,404,'Usuario no encontrado.');return;}
 if(status==='approved'&&!user.email_verified_at){adminDashboard(req,'No se puede aprobar una cuenta sin verificar primero su correo institucional.');return;}
 if(status==='approved'&&!clearance(user).approved){adminDashboard(req,'No se puede aprobar esta cuenta: '+clearance(user).label+'.');return;}
 run('UPDATE users SET status=?,reviewed_at=CURRENT_TIMESTAMP,reviewed_by=? WHERE id=?',status,req.auth.user.id,id);
 if(status!=='approved')run('DELETE FROM sessions WHERE user_id=?',id);
 audit(req.auth.user.id,'status_'+status,id);
 let note='Estado actualizado a '+status+'.';
 try {
  await sendMail(user.institutional_email,'Estado de tu cuenta · Erasmus+ MMG',
  'Hola '+user.first_name+'.\n\nLa coordinación ha actualizado tu cuenta a: '+status+'.\n'+
  (status==='approved'?'Ya puedes iniciar sesión en '+publicUrl():'Contacta con coordinación si necesitas más información.'));
 }catch(e){console.error('Resend: error notificando resolución:',e.message);note+=' No se pudo enviar la notificación por correo.';}
 adminDashboard(req,note);
}
export async function handler(req,res){
 req.res=res;
 try {
  const u=new URL(req.url,'http://localhost');
  const url=u.pathname;
  req.auth=authFromRequest(req);
   if(req.method==='GET'&&(['/styles.css','/manifest.webmanifest','/icon.svg','/pwa.js','/sw.js','/passkeys.js','/navigation.js'].includes(url)||publicImageAssets[url])){
    const data=await readFile(new URL('../public/'+url.slice(1),import.meta.url));
    const contentType=publicImageAssets[url]||(url.endsWith('.css')?'text/css; charset=utf-8':url.endsWith('.js')?'text/javascript; charset=utf-8':url.endsWith('.svg')?'image/svg+xml':'application/manifest+json; charset=utf-8');
    header(req,200,contentType,url==='/sw.js'?{'Service-Worker-Allowed':'/'}:publicImageAssets[url]?{'Cache-Control':'public, max-age=86400'}:{});
    res.end(data);return;
  }

  const featureApi={
    layout,error,redirect,csrf,mustLogin,mustAdmin,readForm,requireCSRF,send,
    raw:(r,status,data,type,headers={})=>{header(r,status,type,headers);r.res.end(data);}
  };
  if(await extraRoute(req,url,req.method,featureApi))return;

  if(req.method==='GET'&&url==='/healthz'){header(req,200,'text/plain');res.end('ok');return;}
  if(req.method==='GET'&&url==='/'){if(req.auth){redirect(req,req.auth.user.role==='coordinator'?'/coordinacion':'/panel');return;}landing(req);return;}
  if(req.method==='GET'&&url==='/acceso'){login(req);return;}
  if(req.method==='GET'&&url==='/registro'){registration(req);return;}
  if(req.method==='GET'&&url==='/reenviar'){resendForm(req);return;}
  if(req.method==='GET'&&url==='/verificar'){verificationConfirm(req,u.searchParams.get('token')||'');return;}
  if(req.method==='POST'){
    const body=await readForm(req);
    if(url==='/acceso'){await loginAction(req,body);return;}
    if(url==='/registro'){await register(req,body);return;}
    if(url==='/verificar'){await verifyAction(req,body);return;}
    if(url==='/reenviar'){await resendAction(req,body);return;}
    if(url==='/salir'){if(!mustLogin(req))return;if(!requireCSRF(req,body))return;deleteSession(req.auth);redirect(req,'/',{'Set-Cookie':cookie('mmg_session','',0)});return;}
    if(url==='/coordinacion/estado'){if(!mustAdmin(req))return;await updateStatus(req,body);return;}
    if(url==='/coordinacion/configuracion'){
      if(!mustAdmin(req))return;if(!requireCSRF(req,body))return;
      try {configureResend({apiKey:String(body.apiKey||'').trim(),from:String(body.from||'').trim(),publicUrl:String(body.publicUrl||'').trim()});audit(req.auth.user.id,'resend_settings_saved');mailConfig(req,'Configuración guardada de forma cifrada.');}
      catch(e){mailConfig(req,e.message);}return;
    }
    if(url==='/coordinacion/probar-correo'){
      if(!mustAdmin(req))return;if(!requireCSRF(req,body))return;
      try {await sendMail(req.auth.user.institutional_email,'Prueba de Resend · Erasmus+ MMG','Este es un mensaje de prueba de Movilidades Erasmus+ MMG.');mailConfig(req,'Correo de prueba solicitado correctamente.');}
      catch(e){mailConfig(req,e.message);}return;
    }
    error(req,404,'Ruta no encontrada.');return;
  }
  if(req.method!=='GET'){error(req,405,'Método no permitido.');return;}
  if(url==='/panel'){if(mustLogin(req))home(req);return;}
  if(url==='/destinos'){if(mustLogin(req))destinationsPage(req);return;}
  if(url==='/movilidades'){if(mustLogin(req))typesPage(req);return;}
  if(url==='/normativa'){if(mustLogin(req))rulesPage(req);return;}
  if(url==='/coordinacion'){if(mustAdmin(req))adminDashboard(req);return;}
  if(url==='/coordinacion/configuracion'){if(mustAdmin(req))mailConfig(req);return;}
  const match=/^\/coordinacion\/usuario\/(\d+)$/.exec(url);
  if(match){if(mustAdmin(req))adminUser(req,Number(match[1]));return;}
  error(req,404,'No existe la página solicitada.');
 } catch(e){
  console.error('Error del servidor:',e instanceof Error?e.stack:e);
  if(!res.headersSent){header(req,500);res.end('<h1>Error del servidor</h1><p>Se ha producido un problema. Contacta con coordinación.</p>');}
  else res.end();
 }
}
// Keep the standalone entry point for the original integration tests and tools.
if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const server=http.createServer(handler);
  server.listen(port,host,()=>console.log('Movilidades Erasmus+ MMG en http://'+host+':'+port));
  startMailWorker();
}
