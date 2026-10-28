import { db,get,all,run,audit } from './db.mjs';
import {escape as E,clean,validId,heading,panel,datatable,queueMail,activeEdition} from './feature-service.mjs';

db.exec(
 "CREATE TABLE IF NOT EXISTS application_reviews ("+
 "application_id INTEGER PRIMARY KEY REFERENCES applications(id) ON DELETE CASCADE,"+
 "decision TEXT NOT NULL CHECK(decision IN ('in_review','shortlisted','selected','reserve','not_selected')),"+
 "motivation_score INTEGER CHECK(motivation_score BETWEEN 0 AND 5),"+
 "training_fit_score INTEGER CHECK(training_fit_score BETWEEN 0 AND 5),"+
 "review_note TEXT NOT NULL,reviewed_by INTEGER NOT NULL REFERENCES users(id),"+
 "reviewed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);"+
 "CREATE TABLE IF NOT EXISTS application_review_history ("+
 "id INTEGER PRIMARY KEY,application_id INTEGER NOT NULL REFERENCES applications(id) ON DELETE CASCADE,"+
 "decision TEXT NOT NULL,review_note TEXT NOT NULL,actor_id INTEGER NOT NULL REFERENCES users(id),"+
 "motivation_score INTEGER,training_fit_score INTEGER,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);"+
 "CREATE INDEX IF NOT EXISTS review_history_app ON application_review_history(application_id);"
);
const labels={
 in_review:'En valoración',
 shortlisted:'Preseleccionada',
 selected:'Seleccionada',
 reserve:'Lista de reserva',
 not_selected:'No seleccionada'
};
const statusOf=a=>a.status==='draft'?'Borrador':a.review_decision?labels[a.review_decision]:'Presentada · pendiente';
const format=(v)=>v===null||v===undefined?'—':String(v);
function rowInfo(a){
 return '<tr><td><strong>'+E(a.first_name+' '+a.last_name)+'</strong><small>'+E(a.role==='student'?'Alumnado':'Docente')+'</small></td>'+
  '<td>'+E(a.edition_label||'Edición anterior')+'</td>'+
  '<td>'+E(a.mobility==='short'?'Corta':a.mobility==='long'?'Dual-Erasmus+':'Job Shadowing')+'</td>'+
 '<td>'+E(a.family)+'</td><td>'+E(a.destination)+'</td><td>'+E(statusOf(a))+'</td>'+
 '<td><a href="/coordinacion/candidaturas/'+a.id+'">Revisar expediente</a></td></tr>';
}
function listing(req,api){
 const search=new URL(req.url,'http://localhost').searchParams;
 const filter=String(search.get('estado')||'all');
  const active=activeEdition(),requestedEdition=String(search.get('edicion')||'');
  const selectedEdition=requestedEdition==='all'?null:(validId(requestedEdition)||active?.id||null);
  const editionOptions=all('SELECT id,label FROM erasmus_editions ORDER BY label DESC');
  const editionWhere=selectedEdition?' WHERE a.edition_id=?':'';
 const rows=all(
   "SELECT a.id,a.mobility,a.family,a.destination,a.status,u.first_name,u.last_name,u.role,e.label AS edition_label,r.decision AS review_decision "+
  "FROM applications a JOIN users u ON u.id=a.user_id LEFT JOIN application_reviews r ON r.application_id=a.id "+
   "LEFT JOIN erasmus_editions e ON e.id=a.edition_id"+editionWhere+
   " ORDER BY CASE WHEN a.status='submitted' THEN 0 ELSE 1 END,a.submitted_at DESC,a.id DESC LIMIT 300",
   ...(selectedEdition?[selectedEdition]:[]));
 const filtered=filter==='all'?rows:rows.filter(a=>filter==='submitted'?a.status==='submitted'&&!a.review_decision:
  filter==='draft'?a.status==='draft':a.review_decision===filter);
  const counter=all("SELECT a.status,r.decision AS review_decision FROM applications a LEFT JOIN application_reviews r ON r.application_id=a.id"+
   editionWhere,...(selectedEdition?[selectedEdition]:[]));
 const metrics=[
  ['Presentadas',counter.filter(x=>x.status==='submitted').length],
  ['Pendientes de valorar',counter.filter(x=>x.status==='submitted'&&!x.review_decision).length],
  ['Seleccionadas',counter.filter(x=>x.review_decision==='selected').length],
  ['En reserva',counter.filter(x=>x.review_decision==='reserve').length]
 ];
 let html=heading('COORDINACIÓN · SELECCIÓN','Valoración de candidaturas',
  'Decisiones manuales, motivadas y registradas en el historial. La aplicación no asigna plazas ni puntúa automáticamente.');
 html+='<div class="metrics">'+metrics.map(([label,num])=>'<div><span>'+E(label)+'</span><b>'+num+'</b></div>').join('')+'</div>';
  html+='<div class="card"><div class="row"><h2>Solicitudes</h2><a class="btn small" href="/coordinacion/candidaturas/exportar.csv?edicion='+(selectedEdition||'all')+'">Exportar CSV</a></div>'+
 '<form action="/coordinacion/candidaturas" method="get" class="filter-row">'+
  '<label>Convocatoria <select name="edicion"><option value="all"'+(requestedEdition==='all'?' selected':'')+'>Todas las convocatorias</option>'+
  editionOptions.map(edition=>'<option value="'+edition.id+'"'+(selectedEdition===edition.id?' selected':'')+'>'+E(edition.label)+'</option>').join('')+
  '</select></label>'+
 '<label>Mostrar <select name="estado"><option value="all">Todas</option>'+
 [['submitted','Pendientes de valoración'],['draft','Borradores'],...Object.entries(labels)].map(([key,label])=>
 '<option value="'+E(key)+'"'+(filter===key?' selected':'')+'>'+E(label)+'</option>').join('')+
 '</select></label><button type="submit" class="btn small">Filtrar</button></form>'+
  datatable(['Participante','Convocatoria','Modalidad','Familia profesional','Destino','Situación','Gestión'],filtered.map(rowInfo))+
 '</div>';
 api.layout(req,'Valoración de candidaturas',html);
}
function detail(req,api,id,message=''){
 const a=get(
  "SELECT a.*,e.label AS edition_label,u.first_name,u.last_name,u.role,u.institutional_email,u.username,u.center,"+
 "r.decision AS review_decision,r.review_note,r.motivation_score,r.training_fit_score,r.reviewed_at "+
  "FROM applications a JOIN users u ON u.id=a.user_id LEFT JOIN erasmus_editions e ON e.id=a.edition_id "+
  "LEFT JOIN application_reviews r ON r.application_id=a.id WHERE a.id=?",id);
 if(!a){api.error(req,404,'Candidatura no encontrada.');return;}
 const csrf=E(api.csrf(req));
 const history=all("SELECT h.*,u.first_name,u.last_name FROM application_review_history h JOIN users u ON u.id=h.actor_id WHERE h.application_id=? ORDER BY h.id DESC",id);
 let html=heading('COORDINACIÓN · SELECCIÓN','Expediente de candidatura',
   'Consulta la solicitud original y registra valoraciones y resoluciones justificadas.');
 if(message)html+=panel('Información','<p>'+E(message)+'</p>');
 html+=panel('Datos y candidatura',
  '<p><strong>Participante:</strong> '+E(a.first_name+' '+a.last_name)+' · '+E(a.role)+'</p>'+
  '<p><strong>Convocatoria:</strong> '+E(a.edition_label||'Edición anterior')+'</p>'+
  '<p><strong>Centro:</strong> '+E(a.center)+' · <strong>Familia:</strong> '+E(a.family)+'</p>'+
  '<p><strong>Movilidad:</strong> '+E(a.mobility)+' · <strong>Destino:</strong> '+E(a.destination)+'</p>'+
  '<p><strong>Beca MEC declarada:</strong> '+E(a.mec)+'</p>'+
  '<p><strong>Motivación:</strong></p><p class="preserve">'+E(a.motivation)+'</p>'+
  '<p><strong>Situación:</strong> '+E(statusOf(a))+'</p>'+
  (a.status==='submitted'?'<p><a href="/documentacion/pdf/candidatura/'+id+'">Descargar PDF original</a></p>':'<p>Borrador del participante: todavía no se puede valorar.</p>'));
 if(a.status==='submitted'){
 html+='<form action="/coordinacion/candidaturas/'+id+'" method="post" class="card form">'+
 '<h2>Resolución y motivación de la decisión</h2>'+
 '<p>Las puntuaciones son orientativas, opcionales y siempre introducidas por la persona revisora; no existe selección automática. La rúbrica definitiva deberá aprobarse por la comisión de selección.</p>'+
 '<label>Estado<select name="decision" required>'+Object.entries(labels).map(([k,label])=>
 '<option value="'+k+'"'+(a.review_decision===k?' selected':'')+'>'+E(label)+'</option>').join('')+'</select></label>'+
 '<div class="fields"><label>Motivación (0–5, opcional) <input type="number" min="0" max="5" step="1" name="motivation_score" value="'+E(format(a.motivation_score).replace('—',''))+'"></label>'+
 '<label>Adecuación formativa (0–5, opcional) <input type="number" min="0" max="5" step="1" name="training_fit_score" value="'+E(format(a.training_fit_score).replace('—',''))+'"></label></div>'+
 '<label>Justificación obligatoria <textarea name="note" maxlength="2000" rows="5" required>'+E(a.review_note||'')+'</textarea></label>'+
 '<label class="checkbox"><input type="checkbox" name="notify" value="yes"'+
 (process.env.MMG_TEST_FIXTURES==='1'?'':' checked')+'> Avisar del nuevo estado al correo institucional mediante Resend</label>'+
 '<input type="hidden" name="csrf" value="'+csrf+'"><button class="btn" type="submit">Guardar valoración</button></form>';
 }
 html+=panel('Historial de decisiones',history.length?
 datatable(['Fecha UTC','Estado','Autor','Justificación'],history.map(h=>
 '<tr><td>'+E(h.created_at)+'</td><td>'+E(labels[h.decision]||h.decision)+'</td><td>'+E(h.first_name+' '+h.last_name)+'</td>'+
 '<td class="preserve">'+E(h.review_note)+'</td></tr>')):
 '<p>No hay revisiones registradas.</p>');
 html+='<a class="btn secondary" href="/coordinacion/candidaturas">← Volver al listado</a>';
 api.layout(req,'Valoración del expediente',html);
}
function safeScore(v){
 if(v===undefined||v===null||String(v).trim()==='')return null;
 const n=Number(v);
 return Number.isInteger(n)&&n>=0&&n<=5?n:undefined;
}
function save(req,api,id,b){
 const a=get("SELECT a.*,u.institutional_email,u.first_name FROM applications a JOIN users u ON u.id=a.user_id WHERE a.id=?",id);
 if(!a||a.status!=='submitted'){api.error(req,404,'No se puede valorar una solicitud inexistente o en borrador.');return;}
 const decision=String(b.decision||''),note=clean(b.note,2000),
 motivation=safeScore(b.motivation_score),fit=safeScore(b.training_fit_score);
 if(!labels[decision]||note.length<15||motivation===undefined||fit===undefined){
  detail(req,api,id,'Selecciona un estado, justifica la decisión (mínimo 15 caracteres) y revisa las puntuaciones.');return;
 }
 // One transaction for the current result and immutable review history.
 const notificationQueued=b.notify==='yes'&&process.env.MMG_TEST_FIXTURES!=='1';
 db.exec('BEGIN IMMEDIATE');
 try {
  run("INSERT INTO application_reviews(application_id,decision,motivation_score,training_fit_score,review_note,reviewed_by) "+
   "VALUES (?,?,?,?,?,?) ON CONFLICT(application_id) DO UPDATE SET decision=excluded.decision,motivation_score=excluded.motivation_score,"+
   "training_fit_score=excluded.training_fit_score,review_note=excluded.review_note,reviewed_by=excluded.reviewed_by,reviewed_at=CURRENT_TIMESTAMP",
   id,decision,motivation,fit,note,req.auth.user.id);
  run("INSERT INTO application_review_history(application_id,decision,review_note,actor_id,motivation_score,training_fit_score) VALUES (?,?,?,?,?,?)",
   id,decision,note,req.auth.user.id,motivation,fit);
  audit(req.auth.user.id,'application_review_'+decision,id);
  if(notificationQueued){
   queueMail(a.institutional_email,'Actualización de candidatura · Erasmus+ MMG',
    'Hola '+a.first_name+'.\n\nTu candidatura Erasmus+ MMG ha cambiado al estado: '+labels[decision]+
    '.\n\nConsulta tu cuenta y, si necesitas aclaraciones, utiliza el chat con Coordinación. '+
    'El estado comunicado no sustituye la resolución oficial de la convocatoria.');
  }
  db.exec('COMMIT');
 }catch(e){db.exec('ROLLBACK');throw e;}
 detail(req,api,id,'La valoración se ha guardado con trazabilidad'+(notificationQueued?' y el aviso está en cola de envío.':'.'));
}
function csv(req,api){
  const search=new URL(req.url,'http://localhost').searchParams;
  const requested=String(search.get('edicion')||'');
  const editionId=requested==='all'?null:(validId(requested)||activeEdition()?.id||null);
  const rows=all("SELECT a.id,a.mobility,a.family,a.destination,a.status,a.submitted_at,e.label AS edition_label,u.first_name,u.last_name,u.role,r.decision,r.motivation_score,r.training_fit_score "+
  "FROM applications a JOIN users u ON u.id=a.user_id LEFT JOIN erasmus_editions e ON e.id=a.edition_id "+
  "LEFT JOIN application_reviews r ON r.application_id=a.id"+(editionId?' WHERE a.edition_id=?':'')+" ORDER BY a.id",
  ...(editionId?[editionId]:[]));
 const escapeCSV=v=>{
  const str=String(v??'');
  // Spreadsheet-formula injection prevention for CSV opened in Excel or LibreOffice.
  const safe=/^[\t\r\n ]*[=+\-@]/.test(str)?"'"+str:str;
  return '"'+safe.replace(/"/g,'""')+'"';
 };
  const head=['Expediente','Convocatoria','Participante','Perfil','Modalidad','Familia','Destino','Presentación','Estado','Resultado','Puntuación motivación','Puntuación adecuación'];
  const lines=[head,...rows.map(a=>[a.id,a.edition_label||'Edición anterior',a.first_name+' '+a.last_name,a.role,a.mobility,a.family,a.destination,a.submitted_at,a.status,labels[a.decision]||'',a.motivation_score,a.training_fit_score])];
 const result='\ufeff'+lines.map(row=>row.map(escapeCSV).join(';')).join('\r\n');
 audit(req.auth.user.id,'applications_csv_export');
 api.raw(req,200,Buffer.from(result),'text/csv; charset=utf-8',{'Content-Disposition':'attachment; filename="candidaturas-erasmus-mmg.csv"'});
}
export function participantResult(user){
  return all("SELECT a.id,a.mobility,a.destination,a.status,e.label AS edition_label,r.decision AS review_decision "+
  "FROM applications a LEFT JOIN erasmus_editions e ON e.id=a.edition_id LEFT JOIN application_reviews r ON r.application_id=a.id "+
  "WHERE a.user_id=? ORDER BY a.id DESC",user.id).map(a=>({...a,label:statusOf(a)}));
}
export async function selectionRoutes(req,url,method,api){
 const details=/^\/coordinacion\/candidaturas\/(\d+)$/.exec(url);
 if(!details&&url!=='/coordinacion/candidaturas'&&url!=='/coordinacion/candidaturas/exportar.csv')return false;
 if(!api.mustAdmin(req))return true;
 if(url==='/coordinacion/candidaturas'&&method==='GET'){listing(req,api);return true;}
 if(url==='/coordinacion/candidaturas/exportar.csv'&&method==='GET'){csv(req,api);return true;}
 if(details&&method==='GET'){detail(req,api,Number(details[1]));return true;}
 if(details&&method==='POST'){
  const b=await api.readForm(req);if(api.requireCSRF(req,b))save(req,api,Number(details[1]),b);
  return true;
 }
 api.error(req,405,'Método no permitido.');return true;
}
