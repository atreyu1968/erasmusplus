import crypto from 'node:crypto';
import { get, all, run, audit, db } from './db.mjs';
import { cookie, cookies, canTry, countTry } from './auth.mjs';
import { sendMail, publicUrl } from './mailer.mjs';
import { makePdf } from './pdf.mjs';
import { makeFillableGuardianPdf } from './guardian-fillable-pdf.mjs';
import {
  escape as E, clean, validId, panel, heading, formEnd, storeUpload, multipart, queueMail
} from './feature-service.mjs';

db.exec(
  "CREATE TABLE IF NOT EXISTS privacy_acknowledgements ("+
  "id INTEGER PRIMARY KEY,user_id INTEGER NOT NULL REFERENCES users(id),notice_version TEXT NOT NULL,"+
  "notice_sha256 TEXT NOT NULL,acceptance_type TEXT NOT NULL,accepted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,"+
  "UNIQUE(user_id,notice_version));" +
  "CREATE TABLE IF NOT EXISTS guardian_documents ("+
  "id INTEGER PRIMARY KEY,user_id INTEGER NOT NULL REFERENCES users(id),file_id INTEGER NOT NULL REFERENCES files(id),"+
  "notice_version TEXT NOT NULL,relation TEXT NOT NULL,guardian_name TEXT NOT NULL,"+
  "status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),"+
  "submitted_at TEXT DEFAULT CURRENT_TIMESTAMP,reviewed_at TEXT,reviewed_by INTEGER REFERENCES users(id),review_note TEXT);" +
  "CREATE TABLE IF NOT EXISTS guardian_access_tokens ("+
  "token_hash TEXT PRIMARY KEY,user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,"+
  "expires_at INTEGER NOT NULL);" +
  "CREATE INDEX IF NOT EXISTS guardian_review_status ON guardian_documents(status);"
);
const policyFields=[
  'MMG_PRIVACY_CONTROLLER','MMG_PRIVACY_CONTACT','MMG_PRIVACY_DPO',
  'MMG_PRIVACY_LEGAL_BASIS','MMG_PRIVACY_RETENTION','MMG_PRIVACY_RECIPIENTS'
];
export const noticeVersion=()=>process.env.MMG_PRIVACY_VERSION||'PENDIENTE_REVISION';
export function privacyReady(){
  return noticeVersion()!=='PENDIENTE_REVISION' && noticeVersion().length>3 &&
    policyFields.every(k=>String(process.env[k]||'').trim().length>=8);
}
function policy(){
  return [
    ['Responsable del tratamiento',process.env.MMG_PRIVACY_CONTROLLER||'PENDIENTE DE VALIDACIÓN INSTITUCIONAL'],
    ['Contacto del responsable',process.env.MMG_PRIVACY_CONTACT||'PENDIENTE DE VALIDACIÓN'],
    ['Delegado/a de Protección de Datos',process.env.MMG_PRIVACY_DPO||'PENDIENTE DE VALIDACIÓN'],
    ['Finalidades','Tramitación de candidaturas y movilidades Erasmus+; acreditación de participantes; comunicación con personas implicadas; gestión documental, notificaciones y seguridad de las cuentas.'],
    ['Categorías de datos','Identificativos y de contacto; DNI o CIAL; datos académicos; situación de beca MEC; escritos y documentación de participación; registros de comunicaciones necesarias. No aportar datos de salud en campos de texto libre.'],
    ['Base jurídica',process.env.MMG_PRIVACY_LEGAL_BASIS||'PENDIENTE DE DETERMINACIÓN POR EL RESPONSABLE'],
    ['Destinatarios y proveedores',process.env.MMG_PRIVACY_RECIPIENTS||'PENDIENTE DE DETERMINACIÓN, INCLUIDOS PROVEEDORES DE CORREO'],
    ['Transferencias internacionales','Verificar las transferencias y garantías de proveedores como Resend y servicios asociados, en función de su contratación y condiciones vigentes.'],
    ['Conservación',process.env.MMG_PRIVACY_RETENTION||'PENDIENTE DE APROBACIÓN'],
    ['Derechos','Podrás ejercer los derechos de acceso, rectificación, supresión, oposición, limitación del tratamiento y los demás que correspondan ante el responsable, y presentar una reclamación ante la AEPD (www.aepd.es).'],
    ['Gestión de menores','El centro requiere una autorización firmada del representante legal para la participación de toda persona menor de 18 años. Este requisito no significa que todo tratamiento educativo se base en consentimiento del menor o del representante.'],
    ['Versión del aviso',noticeVersion()]
  ];
}
const policyHash=()=>crypto.createHash('sha256').update(JSON.stringify(policy())).digest('hex');
export function ageOnRegistration(dateString){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(dateString||''))return null;
 const birth=new Date(dateString+'T00:00:00Z');
 if(!Number.isFinite(birth.getTime())||birth.toISOString().slice(0,10)!==dateString)return null;
 const now=new Date();
 return now.getUTCFullYear()-birth.getUTCFullYear()-
  (now.toISOString().slice(5,10)<dateString.slice(5,10)?1:0);
}
export function acknowledgeAdult(userId){
 const u=get('SELECT birth_date FROM users WHERE id=?',userId);
 if(ageOnRegistration(u?.birth_date)<18)throw Error('La constancia electrónica de adulto requiere mayoría de edad.');
 run('INSERT OR IGNORE INTO privacy_acknowledgements(user_id,notice_version,notice_sha256,acceptance_type) VALUES (?,?,?,?)',
 userId,noticeVersion(),policyHash(),'explicit_acknowledgement');
 audit(userId,'privacy_notice_acknowledged',userId);
}
export function clearance(user){
 const age=ageOnRegistration(user.birth_date);
 if(age===null)return {approved:false,label:'Fecha de nacimiento sin validar'};
 if(age>=18){
  const row=get('SELECT id FROM privacy_acknowledgements WHERE user_id=? AND notice_version=?',
    user.id,noticeVersion());
  return {approved:Boolean(row),label:row?'Constancia electrónica registrada':'Pendiente de aceptación electrónica'};
 }
 const approved=get("SELECT id FROM guardian_documents WHERE user_id=? AND notice_version=? AND status='approved' ORDER BY id DESC LIMIT 1",
   user.id,noticeVersion());
 const pending=get("SELECT id FROM guardian_documents WHERE user_id=? AND notice_version=? AND status='pending' ORDER BY id DESC LIMIT 1",
   user.id,noticeVersion());
 return {approved:Boolean(approved),label:approved?'Representante legal validado':pending?'Autorización en revisión':'Falta autorización firmada'};
}
export function noticePage(req,api){
 const rows=policy().map(([name,value])=>'<dt>'+E(name)+'</dt><dd>'+E(value)+'</dd>').join('');
 const body=heading('INFORMACIÓN TRANSPARENTE','Protección de datos personales',
  'Aviso de privacidad para el registro y la gestión de movilidades Erasmus+.')+
  panel('Información sobre el tratamiento','<dl class="privacy-list">'+rows+'</dl>')+
  (!privacyReady()?'<div class="notice-box"><strong>AVISO PROVISIONAL:</strong> la aplicación no admite nuevas altas reales hasta que el responsable del tratamiento apruebe y configure estos extremos.</div>':'')+
  panel('Información jurídica','<p>En el ámbito educativo, algunos tratamientos se amparan en obligaciones legales o en una misión de interés público y no requieren consentimiento. La aceptación electrónica registra que se ha leído y recibido la información, no sustituye la determinación de la base jurídica.</p>'+
  '<p>Cuando una operación concreta requiera consentimiento, deberá solicitarse por separado, de manera libre y específica.</p>'+
  '<p><a target="_blank" rel="noopener noreferrer" href="https://www.aepd.es/preguntas-frecuentes/10-menores-y-educacion/FAQ-1001-cual-es-la-edad-para-que-los-menores-puedan-prestar-consentimiento-para-tratar-sus-datos-personales">AEPD: edad para consentir el tratamiento de datos de menores ↗</a></p>');
 api.layout(req,'Aviso de privacidad',body,{publicPage:!req.auth});
}
export function guardianSession(req){
 const value=cookies(req).mmg_guardian;
 if(!value||!/^[a-f0-9]{64}$/.test(value))return null;
 const hash=crypto.createHash('sha256').update(value).digest('hex');
 const token=get('SELECT user_id,expires_at FROM guardian_access_tokens WHERE token_hash=?',hash);
 if(!token||token.expires_at<Date.now())return null;
 const user=get("SELECT * FROM users WHERE id=? AND status='pending' AND email_verified_at IS NOT NULL",token.user_id);
 if(!user||ageOnRegistration(user.birth_date)===null)return null;
 return user;
}
export async function emailGuardianLink(user){
 if(!user.email_verified_at || clearance(user).approved)return false;
 const token=crypto.randomBytes(32).toString('hex');
 run('DELETE FROM guardian_access_tokens WHERE user_id=?',user.id);
 run('INSERT INTO guardian_access_tokens(token_hash,user_id,expires_at) VALUES (?,?,?)',
  crypto.createHash('sha256').update(token).digest('hex'),user.id,Date.now()+7*24*3600*1000);
 await sendMail(user.institutional_email,'Documento del representante legal · Erasmus+ MMG',
   'Hola '+user.first_name+'.\n\nPara completar la solicitud de acceso Erasmus+ MMG debes formalizar el trámite de protección de datos: las personas adultas mediante aceptación electrónica y las menores de 18 años mediante el modelo PDF firmado por su representante legal.\n\n'+
   'Abre este enlace de acceso limitado, válido durante 7 días:\n'+publicUrl()+'/privacidad/tramite?token='+token+
   '\n\nNo compartas este enlace salvo con tu representante legal. Tras subir el PDF, coordinación lo revisará antes de aprobar la cuenta.');
 audit(user.id,'guardian_upload_link_sent',user.id);
 return true;
}

function adultPortal(req,api,msg=''){
 const user=guardianSession(req);
 if(!user || ageOnRegistration(user.birth_date)<18){portalUnavailable(req,api);return;}
 const approved=clearance(user).approved;
 let html=heading('PROTECCIÓN DE DATOS','Aceptación electrónica de persona adulta',
  'Completa tu solicitud de acceso confirmando que has recibido y leído la información de privacidad.');
 html+=panel('Datos del participante','<p>'+E(user.first_name+' '+user.last_name)+' · '+E(user.institutional_email)+'</p>');
 if(msg)html+=panel('Resultado',E(msg));
 html+=panel('Aviso de privacidad','<p>Versión: '+E(noticeVersion())+'</p><p><a href="/privacidad" target="_blank" rel="noopener noreferrer">Leer información completa sobre el tratamiento de datos ↗</a></p>'+
 '<p>Este acuse de recibo no equivale al consentimiento para finalidades opcionales ni sustituye las autorizaciones adicionales que correspondan.</p>');
 if(approved)html+=panel('Confirmación registrada','<p>Consta electrónicamente que has recibido y leído el aviso. Coordinación revisará tu cuenta antes de autorizar el acceso.</p>');
 else html+='<form class="card form" method="post" action="/privacidad/aceptar">'+
 '<label class="checkbox"><input type="checkbox" name="accept" value="yes" required> Confirmo de forma expresa que he recibido y leído la información de privacidad de esta versión.</label>'+
 '<input type="hidden" name="csrf" value="'+E(api.csrf(req))+'"><button class="btn" type="submit">Registrar mi aceptación electrónica</button></form>';
 api.layout(req,'Aceptación electrónica',html,{publicPage:true});
}
async function adultAccept(req,api){
 const user=guardianSession(req);
 if(!user||ageOnRegistration(user.birth_date)<18){portalUnavailable(req,api);return;}
 const form=await api.readForm(req);
 if(!api.requireCSRF(req,form))return;
 if(form.accept!=='yes'){adultPortal(req,api,'Debes confirmar el aviso para continuar.');return;}
 if(!clearance(user).approved)acknowledgeAdult(user.id);
 adultPortal(req,api,'Aceptación electrónica registrada con fecha, hora y huella de la versión del aviso.');
}

function documentForGuardian(user){
 const rowlist=[
  ['Documento','Autorización para participación en Movilidades Erasmus+ MMG y declaración de información de protección de datos.'],
  ['Curso','2026-2027'],['Centro','IES Manuel Martín González - Guía de Isora, Tenerife'],
  ['Nombre del menor',user.first_name+' '+user.last_name],
  ['Fecha de nacimiento',user.birth_date],
  ['Datos del representante','Nombre y apellidos: __________________________________________'],
  ['Documento identificativo del representante','DNI/NIE/Pasaporte: _________________________'],
  ['Vínculo con el menor','Padre / Madre / Tutor legal / Representante acreditado (marcar)'],
  ['Teléfono de contacto del representante','__________________________________________'],
  ['Declaración A','Declaro ejercer la patria potestad, tutela o representación legal que me habilita para autorizar esta participación y puedo acreditarlo ante el centro si se requiere.'],
  ['Declaración B','He recibido o tengo a mi disposición el aviso de privacidad, versión '+noticeVersion()+', y conozco las finalidades y derechos indicados.'],
  ['Declaración C','Autorizo que el menor participe en los trámites de solicitud y preparación de movilidades Erasmus+ del centro, según la convocatoria y autorizaciones adicionales que resulten necesarias.'],
  ['No es una autorización de viaje','Las autorizaciones de salida de España, las relativas al viaje de menores, seguros, prácticas, imágenes o tratamientos sujetos a consentimiento separado se tramitarán, cuando correspondan, en documentos específicos.'],
  ['Lugar y fecha','__________________________________________'],
  ['Firma manuscrita del representante legal','__________________________________________']
 ];
 return makePdf({title:'Modelo de autorización del representante legal (BORRADOR)',rows:rowlist,
 note:'Cumplimentar, firmar de forma manuscrita y subir un PDF legible. Modelo sujeto a aprobación por el centro y su delegado de protección de datos.'});
}
function guardianPortal(req,api,msg=''){
 const user=guardianSession(req);
 if(!user){portalUnavailable(req,api);return;}
 if(ageOnRegistration(user.birth_date)>=18){adultPortal(req,api,msg);return;}
 const status=clearance(user);
 const records=all('SELECT status,submitted_at,review_note FROM guardian_documents WHERE user_id=? ORDER BY id DESC LIMIT 5',user.id);
 let h=heading('REGISTRO DE MENORES','Autorización del representante legal',
   'Documento obligatorio para continuar con la aprobación de la cuenta Erasmus+ MMG.');
 h+=panel('Solicitante', '<p><b>'+E(user.first_name+' '+user.last_name)+'</b> · '+E(user.center||'IES Manuel Martín González')+
 '</p><p>Estado del documento: <span class="pill">'+E(status.label)+'</span></p>');
 if(msg)h+=panel('Resultado','<p>'+E(msg)+'</p>');
 h+=panel('Paso 1 · Descargar y firmar el modelo',
   '<p>El documento incluye los datos del menor, campos para el representante legal y el espacio de firma. Puede cumplimentarse digitalmente y firmarse después a mano, o imprimirse y escanearse.</p>'+
   '<p><a class="btn" href="/privacidad/modelo.pdf">⬇ Descargar modelo PDF</a></p>'+
   '<p>La firma se revisará manualmente; la plataforma no verifica automáticamente la identidad del firmante.</p>');
 if(!status.approved && !records.some(x=>x.status==='pending')){
  h+='<form method="post" action="/privacidad/subir" class="card form" enctype="multipart/form-data">'+
  '<h2>Paso 2 · Subir el PDF firmado</h2><label>Nombre y apellidos del representante legal'+
  '<input name="guardian_name" maxlength="150" required></label>'+
  '<label>Relación con el alumno<select name="relation"><option>Padre</option><option>Madre</option><option>Tutor/a legal</option><option>Otro representante legal</option></select></label>'+
  '<label>Documento firmado en PDF (máximo 6 MB)<input type="file" name="file" accept=".pdf,application/pdf" required></label>'+
  '<label class="checkbox"><input type="checkbox" name="declaration" value="yes" required> Declaro que el documento adjunto contiene la firma del representante legal y que los datos son correctos.</label>'+
  '<input type="hidden" name="csrf" value="'+E(api.csrf(req))+'"><button class="btn">Enviar a revisión</button></form>';
 }else if(status.approved){
  h+=panel('Validación finalizada','<p>La autorización ha sido aprobada por coordinación. La cuenta podrá aprobarse cuando se cumplan también los requisitos restantes.</p>');
 }else {
  h+=panel('Documento pendiente','<p>La documentación se ha recibido. Coordinación revisará la firma y la representación legal antes de habilitar la cuenta.</p>');
 }
 if(records.length)h+=panel('Historial del trámite','<ul>'+records.map(x=>'<li>'+E(x.submitted_at)+' · '+E(x.status)+(x.review_note?' · '+E(x.review_note):'')+'</li>').join('')+'</ul>');
 api.layout(req,'Autorización para menores',h,{publicPage:true});
}
function portalUnavailable(req,api){
 api.layout(req,'Enlace no disponible',panel('Enlace caducado o no autorizado',
   '<p>Para proteger los datos del menor, este acceso temporal ha caducado, ya se ha usado para una cuenta no pendiente o no corresponde con la solicitud.</p>'+
   '<p><a href="/privacidad/renovar">Solicitar otro enlace</a></p>'),{publicPage:true,status:403});
}
function guardianToken(req,api){
 const raw=new URL(req.url,'http://localhost').searchParams.get('token')||'';
 if(!/^[a-f0-9]{64}$/.test(raw)){portalUnavailable(req,api);return;}
 const hash=crypto.createHash('sha256').update(raw).digest('hex');
 const row=get('SELECT * FROM guardian_access_tokens WHERE token_hash=?',hash);
 const user=row&&get('SELECT * FROM users WHERE id=?',row.user_id);
 if(!row||row.expires_at<Date.now()||!user||!user.email_verified_at||user.status!=='pending'||ageOnRegistration(user.birth_date)===null){
  portalUnavailable(req,api);return;
 }
 api.redirect(req,'/privacidad/tramite',{'Set-Cookie':cookie('mmg_guardian',raw,7*24*3600)});
}
async function guardianSubmit(req,api){
 const user=guardianSession(req);
 if(!user){portalUnavailable(req,api);return;}
 const approval=clearance(user);
 if(approval.approved||get("SELECT id FROM guardian_documents WHERE user_id=? AND status='pending' LIMIT 1",user.id)){
  guardianPortal(req,api,'Ya se ha entregado una autorización pendiente o aprobada.');return;
 }
 const form=await multipart(req);
 if(!api.requireCSRF(req,{csrf:form.get('csrf')}))return;
 const guardian=clean(form.get('guardian_name'),150),relation=clean(form.get('relation'),40),file=form.get('file');
 if(!guardian||!['Padre','Madre','Tutor/a legal','Otro representante legal'].includes(relation)||form.get('declaration')!=='yes'||
  !file||file.type!=='application/pdf'){
   guardianPortal(req,api,'Introduce los datos del representante y adjunta el PDF firmado.');return;
 }
 try{
  const id=await storeUpload(file,{ownerId:user.id});
  if(!id)throw Error('No se ha podido guardar el PDF.');
  const doc=Number(run("INSERT INTO guardian_documents(user_id,file_id,notice_version,guardian_name,relation,status) VALUES (?,?,?,?,?,'pending')",
    user.id,id,noticeVersion(),guardian,relation).lastInsertRowid);
  audit(user.id,'guardian_document_uploaded',doc);
  guardianPortal(req,api,'Archivo recibido. Coordinación verificará la firma y la representación legal.');
 }catch(e){
  guardianPortal(req,api,'No se ha completado la entrega: '+e.message);
 }
}
function reviewPage(req,api,msg=''){
 const list=all("SELECT d.*,u.first_name,u.last_name,u.birth_date,u.institutional_email,f.original_name FROM guardian_documents d JOIN users u ON u.id=d.user_id JOIN files f ON f.id=d.file_id ORDER BY CASE d.status WHEN 'pending' THEN 0 ELSE 1 END,d.id DESC LIMIT 150");
 const rows=list.map(x=>'<tr><td>'+E(x.first_name+' '+x.last_name)+'<small>'+E(x.birth_date)+'</small></td>'+
 '<td>'+E(x.guardian_name)+'<small>'+E(x.relation)+'</small></td>'+
 '<td><a href="/archivo/'+x.file_id+'">Revisar PDF firmado</a></td><td>'+E(x.status)+'</td>'+
 '<td>'+ (x.status==='pending'?'<form method="post" action="/coordinacion/privacidad/revisar">'+
 '<input type="hidden" name="id" value="'+x.id+'"><input type="hidden" name="csrf" value="'+E(api.csrf(req))+'">'+
 '<label>Observaciones<input name="note" maxlength="250" placeholder="Opcional"></label>'+
 '<button class="btn small" name="status" value="approved">Aprobar</button> '+
 '<button class="btn small secondary" name="status" value="rejected">Rechazar</button></form>':'Revisado')+'</td></tr>');
 let body=heading('COORDINACIÓN · PRIVACIDAD','Autorizaciones de menores','Revisa el documento firmado y comprueba que quien firma tiene representación legal acreditable.');
 if(msg)body+=panel('Resultado',E(msg));
 body+=panel('Documentos recibidos','<p>La aceptación del formulario no verifica automáticamente la identidad del representante. El coordinador debe valorar la documentación de acuerdo con el protocolo aprobado por el centro.</p>'+
 '<div class="responsive"><table><thead><tr><th>Alumno/a</th><th>Representante</th><th>Documento</th><th>Estado</th><th>Validación</th></tr></thead><tbody>'+rows.join('')+'</tbody></table></div>');
 api.layout(req,'Autorizaciones de menores',body);
}
function reviewPost(req,api,b){
 const id=validId(b.id),status=clean(b.status),note=clean(b.note,250);
 if(!id||!['approved','rejected'].includes(status)){reviewPage(req,api,'Acción de revisión inválida.');return;}
 const entry=get("SELECT d.*,u.institutional_email,u.first_name,u.status AS account_status FROM guardian_documents d JOIN users u ON u.id=d.user_id WHERE d.id=?",id);
 if(!entry||entry.status!=='pending'||entry.account_status!=='pending'){
  reviewPage(req,api,'El documento ya no está pendiente o la cuenta no admite cambios.');return;
 }
 run("UPDATE guardian_documents SET status=?,reviewed_at=CURRENT_TIMESTAMP,reviewed_by=?,review_note=? WHERE id=?",
   status,req.auth.user.id,note,id);
 audit(req.auth.user.id,'guardian_authorization_'+status,id);
 try{
  // No secret URLs stored in the outbox; status notifications contain no sensitive details.
  queueMail(entry.institutional_email,'Autorización del representante legal · Erasmus+ MMG',
    'La coordinación ha '+(status==='approved'?'validado':'rechazado')+
    ' la autorización presentada para el registro Erasmus+ de '+entry.first_name+
    '. Consulta al centro si necesitas información o una nueva entrega.');
 }catch(e){console.error('No se pudo poner el correo en cola:',e.message);}
 reviewPage(req,api,'Documento revisado: '+status+'. La activación de la cuenta sigue requiriendo tu aprobación manual.');
}
function renewalForm(req,api,notice=''){
 const body=heading('DOCUMENTACIÓN DE MENORES','Renovar enlace temporal','Si la cuenta es de un menor con correo ya verificado, se enviará un enlace de entrega al correo institucional.');
 api.layout(req,'Renovar enlace',body+(notice?panel('Información',E(notice)):'')+
 '<form class="card form" method="post" action="/privacidad/renovar"><label>DNI o CIAL de la cuenta <input name="username" required maxlength="40"></label>'+
 formEnd(api.csrf(req),'Solicitar nuevo enlace'),{publicPage:true});
}
async function renew(req,api,b){
 const username=clean(b.username,40).toUpperCase();
 const key='guardian-renew:'+req.socket.remoteAddress+':'+username;
 if(canTry(key)){
  countTry(key,false);
  const user=get("SELECT * FROM users WHERE username=? AND status='pending' AND email_verified_at IS NOT NULL",username);
  if(user&&!clearance(user).approved){
   try{await emailGuardianLink(user);}catch(e){console.error('Error enviando autorización del representante:',e.message);}
  }
 }
 renewalForm(req,api,'Si corresponde a una cuenta elegible, recibirás un nuevo enlace en el correo institucional.');
}
export async function privacyRoutes(req,url,method,api){
 if(url==='/privacidad'&&method==='GET'){noticePage(req,api);return true;}
 if(url==='/privacidad/tramite'&&method==='GET'){
   if(new URL(req.url,'http://localhost').searchParams.has('token'))guardianToken(req,api);
   else guardianPortal(req,api);
   return true;
 }
 if(url==='/privacidad/modelo.pdf'&&method==='GET'){
   const user=guardianSession(req);
   if(!user){portalUnavailable(req,api);return true;}
   const pdf=await makeFillableGuardianPdf(user);
   api.raw(req,200,pdf,'application/pdf',{'Content-Disposition':'attachment; filename="MMG_autorizacion_representante_legal.pdf"'});
   audit(user.id,'guardian_template_downloaded',user.id);return true;
 }
 if(url==='/privacidad/subir'&&method==='POST'){await guardianSubmit(req,api);return true;}
 if(url==='/privacidad/aceptar'&&method==='POST'){await adultAccept(req,api);return true;}
 if(url==='/privacidad/renovar'){
   if(method==='GET')renewalForm(req,api);
   else if(method==='POST'){const b=await api.readForm(req);if(api.requireCSRF(req,b))await renew(req,api,b);}
   else api.error(req,405,'Método no permitido.');
   return true;
 }
 if(url==='/coordinacion/privacidad'){
   if(!api.mustAdmin(req))return true;
   if(method==='GET')reviewPage(req,api);
   else api.error(req,405,'Método no permitido.');
   return true;
 }
 if(url==='/coordinacion/privacidad/revisar'){
   if(!api.mustAdmin(req))return true;
   if(method==='POST'){const b=await api.readForm(req);if(api.requireCSRF(req,b))await reviewPost(req,api,b);}
   else api.error(req,405,'Método no permitido.');
   return true;
 }
 return false;
}
