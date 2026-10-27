import { db,get,all,run,audit } from './db.mjs';
import { escape as E,clean,validId,schoolFamilies,destinations,select,input,formEnd,panel,heading,datatable,paper,safeDocument,deleteDocument,storeUpload,multipart,attachment,readAttachment,isAdmin } from './feature-service.mjs';

const familyDest={
 'Imagen personal':['Viseu','Róterdam'],
 'Transporte y mantenimiento de vehículos':['Viseu'],
 'Administración y gestión':['Oporto','Róterdam'],
 'Agraria':['Róterdam'],
 'Edificación y obra civil':['Viseu']
};
const modeName={short:'Movilidad corta',long:'Movilidad larga Dual-Erasmus+',shadowing:'Job Shadowing'};
function formBody(csrf,u,old={},notice='') {
 const modes=u.role==='teacher'?['short','shadowing']:['short','long'];
 return heading('CANDIDATURA · CURSO 2026–2027','Presentar candidatura','Completa las preguntas y entrega tu solicitud. Las fichas presentadas se guardan como PDF inmutable.')+
 (notice?panel('Aviso','<p>'+E(notice)+'</p>'):'')+
 '<form method="post" action="/candidatura" class="card form">'+
 '<h2>Datos de la candidatura</h2>'+
 '<label>Tipo de movilidad'+select('mobility',modes.map(m=>m+'|'+modeName[m]),'')+'</label>'+
 '<label>Familia profesional'+select('family',schoolFamilies,old.family||u.professional_family||'')+'</label>'+
 '<label>Destino deseado'+select('destination',destinations,old.destination||'Róterdam')+'</label>'+
 (u.role==='student'?'<label>¿Tienes beca MEC?'+select('mec',['Sí','No'],old.mec||'No')+'</label>':'')+
 '<label>Motivación personal<textarea name="motivation" rows="8" maxlength="5000" required>'+E(old.motivation||'')+'</textarea></label>'+
 '<div class="notice-box">La movilidad corta prevista se desarrollará en Países Bajos. Para la movilidad larga se comprobará la correspondencia entre familia profesional y destino.</div>'+
 '<input type="hidden" name="csrf" value="'+E(csrf)+'"><button class="btn" name="intent" value="submit">Presentar candidatura</button>'+
 '<button class="btn secondary" name="intent" value="draft">Guardar borrador</button></form>';
}
function normalizeMobility(raw){
 const m=String(raw||'').split('|')[0];
 return ['short','long','shadowing'].includes(m)?m:null;
}
function allowed(u,mobility,family,destination){
 if(u.role==='coordinator')return false;
 if((mobility==='long'&&u.role!=='student')||(mobility==='shadowing'&&u.role!=='teacher'))return false;
 if(!schoolFamilies.includes(family)||!destinations.includes(destination))return false;
 if(mobility==='short')return destination==='Róterdam';
 if(mobility==='long')return (familyDest[family]||[]).includes(destination);
 return true;
}
function listApps(u,csrf){
 const rows=all("SELECT a.*,r.decision AS review_decision FROM applications a LEFT JOIN application_reviews r ON r.application_id=a.id WHERE a.user_id=? ORDER BY a.created_at DESC",u.id);
 return panel('Mis candidaturas',
 rows.length?datatable(['Modalidad','Destino','Estado','Documento'],rows.map(a=>
 '<tr><td>'+E(modeName[a.mobility])+'</td><td>'+E(a.destination)+'</td><td>'+E(a.status==='draft'?'Borrador':({in_review:'En valoración',shortlisted:'Preseleccionada',selected:'Seleccionada',reserve:'En lista de reserva',not_selected:'No seleccionada'})[a.review_decision]||'Presentada · pendiente')+'</td><td>'+
 (a.status==='submitted'?'<a href="/documentacion/pdf/candidatura/'+a.id+'">Descargar PDF</a>':'Puedes presentar el borrador con el formulario')+
 '</td></tr>')):'<p>No tienes candidaturas guardadas.</p>');
}
function candidatePage(req,api,notice=''){
 const user=req.auth.user;
 if(isAdmin(user)){api.redirect(req,'/coordinacion/candidaturas');return;}
 api.layout(req,'Candidatura Erasmus',formBody(api.csrf(req),user,{},notice)+listApps(user,api.csrf(req)));
}
function pdfRows(application,u){
 return [
 ['Participante',u.first_name+' '+u.last_name],['Usuario',u.username],['Perfil',u.role==='student'?'Alumnado':'Docente'],
 ['Tipo de movilidad',modeName[application.mobility]],
 ['Familia profesional',application.family],['Destino solicitado',application.destination],
 ['Postulación personal',application.motivation],['Beca MEC',application.mec],
 ['Fecha de entrega',new Date().toISOString()],['Curso','2026-2027']];
}
function submitCandidate(req,body,api){
 const u=req.auth.user;
 if(isAdmin(u)){api.error(req,403,'Coordinación no presenta candidaturas.');return;}
 const mobility=normalizeMobility(body.mobility),family=clean(body.family),destination=clean(body.destination);
 const motivation=clean(body.motivation,5000),mec=u.role==='student'?clean(body.mec):'No procede';
 const intent=String(body.intent||'');
 if(!mobility||!allowed(u,mobility,family,destination)||motivation.length<30||
   (u.role==='student'&&!['Sí','No'].includes(mec))||!['submit','draft'].includes(intent)) {
    candidatePage(req,api,'Comprueba modalidad, familia profesional, destino y motivación (mínimo 30 caracteres).');return;
 }
 const existing=get('SELECT * FROM applications WHERE user_id=? AND mobility=?',u.id,mobility);
 if(existing?.status==='submitted'){candidatePage(req,api,'Esta modalidad ya tiene una solicitud presentada. Contacta con coordinación si necesitas subsanar un error.');return;}
 const application={mobility,family,destination,motivation,mec};
 let id;
 if(existing){
   id=existing.id;
   run('UPDATE applications SET family=?,destination=?,motivation=?,mec=? WHERE id=?',family,destination,motivation,mec,id);
 }else{
   id=Number(run('INSERT INTO applications(user_id,mobility,family,destination,motivation,mec) VALUES (?,?,?,?,?,?)',
       u.id,mobility,family,destination,motivation,mec).lastInsertRowid);
 }
 if(intent==='submit'){
   const pdf=paper('Ficha de candidatura Erasmus+ MMG',pdfRows(application,u),'El documento refleja las respuestas registradas en el momento de la entrega.');
   run("UPDATE applications SET status='submitted',submitted_at=CURRENT_TIMESTAMP,pdf_file=?,pdf_sha256=? WHERE id=? AND status='draft'",
       pdf.name,pdf.hash,id);
   audit(u.id,'candidature_submitted',id);
 }else audit(u.id,'candidature_draft_saved',id);
 candidatePage(req,api,intent==='submit'?'Candidatura presentada. Descarga el PDF desde el listado.':'Borrador guardado correctamente.');
}
const termsVersion='MMG-ERASMUS-2026-27-BORRADOR-1';
const terms=[
 'Participaré en las actividades programadas de acuerdo con las instrucciones del centro y la institución de acogida.',
 'Respetaré las normas de convivencia, seguridad, asistencia, puntualidad y uso responsable del alojamiento y del transporte.',
 'Facilitaré los documentos de identificación y viaje requeridos y comunicaré cualquier incidencia al personal responsable.',
 'Cumpliré el plan de aprendizaje acordado, así como las normas aplicables en el país de destino.',
 'Utilizaré los canales de emergencia y seguiré las indicaciones del centro ante cualquier situación grave.',
 'Conozco que el centro revisará la documentación y que el presente acuse digital no sustituye una firma electrónica cualificada.'
];
function commitments(req,api,notice=''){
 const u=req.auth.user;
 const existing=get('SELECT id,accepted_at FROM participant_commitments WHERE user_id=? AND version=?',u.id,termsVersion);
 let body=heading('COMPROMISO DE PARTICIPACIÓN','Responsabilidades en la movilidad','Lee detenidamente el borrador informativo y registra tu aceptación para revisión.');
 body+=panel('Términos de participación (borrador)', '<ol>'+terms.map(t=>'<li>'+E(t)+'</li>').join('')+'</ol>'+
 '<div class="notice-box">Este texto debe ser aprobado por el centro y por sus responsables jurídicos antes del uso con alumnado. No sustituye consentimientos parentales, autorizaciones de viaje ni firmas requeridas por ley.</div>');
 if(notice)body+=panel('Resultado','<p>'+E(notice)+'</p>');
 if(existing)body+=panel('Aceptación registrada','<p>Registrada el '+E(existing.accepted_at)+'. <a href="/documentacion/pdf/compromiso/'+existing.id+'">Descargar PDF</a></p>');
 else body+='<form class="card form" method="post" action="/compromisos"><label>Nombre y apellidos del participante'+input('full_name',u.first_name+' '+u.last_name)+'</label>'+
 '<label class="checkbox"><input type="checkbox" name="accept" value="yes" required> Declaro haber leído los términos informativos indicados.</label>'+
 '<input type="hidden" name="csrf" value="'+E(api.csrf(req))+'"><button class="btn">Registrar aceptación</button></form>';
 api.layout(req,'Compromisos Erasmus',body);
}
function postCommit(req,body,api){
 const u=req.auth.user;
 if(body.accept!=='yes'||clean(body.full_name,180)!==u.first_name+' '+u.last_name){
   commitments(req,api,'Para registrar la aceptación introduce exactamente el nombre completo de tu cuenta.');return;
 }
 const existing=get('SELECT id FROM participant_commitments WHERE user_id=? AND version=?',u.id,termsVersion);
 if(existing){commitments(req,api,'Ya existe una aceptación registrada.');return;}
 const p=paper('Acuse de lectura de compromisos (borrador)',[
  ['Participante',u.first_name+' '+u.last_name],['Usuario',u.username],['Versión',termsVersion],
  ...terms.map((term,i)=>['Compromiso '+(i+1),term]),
  ['Manifestación','Declaro haber leído el borrador.'],
  ['Fecha y hora (UTC)',new Date().toISOString()]
 ],'Acuse electrónico simple, no equivalente a firma electrónica cualificada.');
 const id=Number(run('INSERT INTO participant_commitments(user_id,version,full_name,document_path,sha256) VALUES (?,?,?,?,?)',
 u.id,termsVersion,clean(body.full_name),p.name,p.hash).lastInsertRowid);
 audit(u.id,'commitment_accepted',id);
 commitments(req,api,'Acuse registrado y PDF generado.');
}
function myDocs(req,api,notice=''){
 const u=req.auth.user;
 if(isAdmin(u)){api.redirect(req,'/coordinacion/documentos');return;}
 const apps=all("SELECT id,mobility,submitted_at FROM applications WHERE user_id=? AND status='submitted'",u.id);
 const commitmentsList=all('SELECT id,version,accepted_at FROM participant_commitments WHERE user_id=?',u.id);
 const ownFiles=all('SELECT * FROM files WHERE owner_id=? ORDER BY id DESC',u.id);
 let html=heading('EXPEDIENTE PERSONAL','Mi documentación','Archivo privado de candidaturas, compromisos y documentos aportados.');
 if(notice)html+=panel('Aviso',E(notice));
 html+=panel('Candidaturas y acuses PDF',apps.map(a=>'<p><a href="/documentacion/pdf/candidatura/'+a.id+'">Ficha '+E(modeName[a.mobility])+'</a> · '+E(a.submitted_at)+'</p>').join('')+
 commitmentsList.map(c=>'<p><a href="/documentacion/pdf/compromiso/'+c.id+'">Compromiso '+E(c.version)+'</a></p>').join('')||'<p>Aún no hay fichas presentadas.</p>');
 html+=panel('Mis archivos',ownFiles.map(f=>'<p><a href="/archivo/'+f.id+'">'+E(f.original_name)+'</a></p>').join('')||'<p>No hay archivos adjuntos.</p>');
 html+='<form class="card form" method="post" action="/documentos/subir" enctype="multipart/form-data"><h2>Entregar documento complementario</h2>'+
 '<p>Formatos permitidos: PDF, JPG, PNG, WEBP o DOCX. Máximo 6 MB. El archivo será visible para Coordinación.</p>'+
 '<label>Seleccionar archivo<input name="file" type="file" required accept=".pdf,.jpg,.jpeg,.png,.webp,.docx"></label>'+
 '<input type="hidden" name="csrf" value="'+E(api.csrf(req))+'"><button class="btn">Adjuntar documento</button></form>';
 api.layout(req,'Mi documentación',html);
}
function adminDocs(req,api,notice=''){
 if(!api.mustAdmin(req))return;
 const docs=all("SELECT a.*,u.first_name,u.last_name FROM applications a JOIN users u ON u.id=a.user_id WHERE a.status='submitted' ORDER BY a.id DESC");
 const commitmentsList=all('SELECT c.*,u.first_name,u.last_name FROM participant_commitments c JOIN users u ON u.id=c.user_id ORDER BY c.id DESC');
 const uploads=all('SELECT f.*,u.first_name,u.last_name FROM files f LEFT JOIN users u ON u.id=f.owner_id ORDER BY f.id DESC LIMIT 150');
 const csrf=E(api.csrf(req));
 const deleteForm=(kind,id)=>'<form method="post" action="/coordinacion/documentos/borrar">'+
 '<input type="hidden" name="csrf" value="'+csrf+'"><input type="hidden" name="kind" value="'+kind+'"><input type="hidden" name="id" value="'+id+'">'+
 '<label class="checkbox"><input type="checkbox" name="confirm" value="yes" required> Confirmar baja</label><button class="btn small">Borrar con auditoría</button></form>';
 let out=heading('ARCHIVO ADMINISTRATIVO','Documentación Erasmus','Documentos privados de ejecución, PDFs inmutables y archivos adjuntos.');
 if(notice)out+=panel('Resultado',E(notice));
 out+=panel('Fichas de candidatura',datatable(['Participante','Movilidad','Documento','Eliminar'],docs.map(a=>
 '<tr><td>'+E(a.first_name+' '+a.last_name)+'</td><td>'+E(modeName[a.mobility])+'</td><td><a href="/documentacion/pdf/candidatura/'+a.id+'">PDF</a></td><td>'+deleteForm('application',a.id)+'</td></tr>')));
 out+=panel('Acuses y compromisos',datatable(['Participante','Versión','Documento','Eliminar'],commitmentsList.map(c=>
 '<tr><td>'+E(c.first_name+' '+c.last_name)+'</td><td>'+E(c.version)+'</td><td><a href="/documentacion/pdf/compromiso/'+c.id+'">PDF</a></td><td>'+deleteForm('commitment',c.id)+'</td></tr>')));
 out+=panel('Documentos adjuntos',datatable(['Nombre','Propietario','Documento','Eliminar'],uploads.map(f=>
 '<tr><td>'+E(f.original_name)+'</td><td>'+E((f.first_name||'')+' '+(f.last_name||''))+'</td><td><a href="/archivo/'+f.id+'">Descargar</a></td><td>'+deleteForm('file',f.id)+'</td></tr>')));
 api.layout(req,'Archivo documental',out);
}
export async function candidateRoutes(req,url,method,api){
 const pdf=/^\/documentacion\/pdf\/(candidatura|compromiso)\/(\d+)$/.exec(url);
 const file=/^\/archivo\/(\d+)$/.exec(url);
 const routes=['/candidatura','/compromisos','/documentos','/documentos/subir','/coordinacion/candidaturas','/coordinacion/documentos','/coordinacion/documentos/borrar'];
 if(!pdf&&!file&&!routes.includes(url))return false;
 if(!api.mustLogin(req))return true;
 const u=req.auth.user;
 if(pdf&&method==='GET'){
  const kind=pdf[1],id=Number(pdf[2]);
  const row=kind==='candidatura'?get('SELECT user_id,pdf_file FROM applications WHERE id=? AND status=?',id,'submitted'):
    get('SELECT user_id,document_path AS pdf_file FROM participant_commitments WHERE id=?',id);
  if(!row||(!isAdmin(u)&&row.user_id!==u.id)){api.error(req,404,'Documento no encontrado.');return true;}
  api.raw(req,200,safeDocument(row.pdf_file),'application/pdf',{'Content-Disposition':'attachment; filename="erasmus-mmg-'+kind+'-'+id+'.pdf"'});
  audit(u.id,'document_download',id);
  return true;
 }
 if(file&&method==='GET'){
  const f=attachment(Number(file[1]),u);
  if(!f){api.error(req,404,'Archivo no encontrado.');return true;}
  const safeName=f.original_name.replace(/["\r\n]/g,'_');
  api.raw(req,200,readAttachment(f),f.mime,{'Content-Disposition':'attachment; filename*=UTF-8\'\''+encodeURIComponent(safeName)});
  audit(u.id,'file_download',f.id);
  return true;
 }
 if(url==='/candidatura'){
  if(method==='GET')candidatePage(req,api);
  else {const b=await api.readForm(req);if(api.requireCSRF(req,b))submitCandidate(req,b,api);}
  return true;
 }
 if(url==='/compromisos'){
  if(method==='GET')commitments(req,api);
  else {const b=await api.readForm(req);if(api.requireCSRF(req,b))postCommit(req,b,api);}
  return true;
 }
 if(url==='/documentos'&&method==='GET'){myDocs(req,api);return true;}
 if(url==='/documentos/subir'&&method==='POST'){
  if(isAdmin(u)){api.error(req,403,'Esta carga está reservada a participantes.');return true;}
  const form=await multipart(req);
  if(!api.requireCSRF(req,{csrf:form.get('csrf')}))return true;
  try {
   const uploaded=await storeUpload(form.get('file'),{ownerId:u.id});
   if(!uploaded)throw Error('Selecciona un archivo válido.');
   audit(u.id,'file_upload',uploaded);
   myDocs(req,api,'Documento adjuntado correctamente.');
  }catch(e){myDocs(req,api,e.message);}
  return true;
 }
 if(url==='/coordinacion/candidaturas'&&method==='GET'){
  if(!api.mustAdmin(req))return true;
  const apps=all("SELECT a.id,a.mobility,a.destination,a.status,a.submitted_at,u.first_name,u.last_name FROM applications a JOIN users u ON u.id=a.user_id ORDER BY a.id DESC");
  api.layout(req,'Candidaturas recibidas',heading('COORDINACIÓN','Candidaturas recibidas','Revisión de todas las solicitudes docentes y de alumnado.')+
    panel('Solicitudes',datatable(['Participante','Tipo','Destino','Estado','Ficha PDF'],apps.map(a=>
      '<tr><td>'+E(a.first_name+' '+a.last_name)+'</td><td>'+E(modeName[a.mobility])+'</td><td>'+E(a.destination)+'</td>'+
      '<td>'+E(a.status)+'</td><td>'+(a.status==='submitted'?'<a href="/documentacion/pdf/candidatura/'+a.id+'">Descargar</a>':'Borrador')+'</td></tr>'))));
  return true;
 }
 if(url==='/coordinacion/documentos'&&method==='GET'){adminDocs(req,api);return true;}
 if(url==='/coordinacion/documentos/borrar'&&method==='POST'){
  if(!api.mustAdmin(req))return true;
  const b=await api.readForm(req);
  if(!api.requireCSRF(req,b))return true;
  const kind=String(b.kind||''),id=validId(b.id);
  if(b.confirm!=='yes'||!id||!['application','commitment','file'].includes(kind)){
    adminDocs(req,api,'Borrado cancelado: confirma el documento y la acción.');return true;
  }
  try {
   if(kind==='application'){
    const row=get("SELECT pdf_file FROM applications WHERE id=? AND status='submitted'",id);
    if(!row)throw Error('No se encuentra el documento.');
    run('DELETE FROM applications WHERE id=?',id);deleteDocument(row.pdf_file);
   } else if(kind==='commitment'){
    const row=get('SELECT document_path FROM participant_commitments WHERE id=?',id);
    if(!row)throw Error('No se encuentra el documento.');
    run('DELETE FROM participant_commitments WHERE id=?',id);deleteDocument(row.document_path);
   } else {
    const row=get('SELECT stored_name FROM files WHERE id=?',id);
    if(!row)throw Error('No se encuentra el archivo.');
    run('DELETE FROM files WHERE id=?',id);
    // File extensions are fixed by MIME allowlist
    if(/^[a-f0-9]{48}\.(pdf|jpg|png|webp|docx)$/.test(row.stored_name)){
      const {unlinkSync}=await import('node:fs');
      const {join}=await import('node:path');
      const {docsDir}=await import('./feature-service.mjs');
      try{unlinkSync(join(docsDir,row.stored_name));}catch(e){if(e.code!=='ENOENT')throw e;}
    }
   }
   audit(u.id,'admin_document_deleted_'+kind,id);
   adminDocs(req,api,'Documento eliminado del archivo y baja registrada en auditoría.');
  } catch(e){adminDocs(req,api,e.message);}
  return true;
 }
 api.error(req,405,'Método no permitido.');
 return true;
}
