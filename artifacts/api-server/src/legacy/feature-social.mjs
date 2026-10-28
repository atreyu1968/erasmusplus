import { createHash } from 'node:crypto';
import { db,get,all,run,audit } from './db.mjs';
import { escape as E,clean,validId,heading,panel,datatable,formEnd,input,select,queueMail,multipart,storeUpload,isAdmin,activeEdition,editionForUser } from './feature-service.mjs';

function noticePage(req,api,notice=''){
 const u=req.auth.user,items=all("SELECT n.*,u.first_name,u.last_name FROM notices n JOIN users u ON u.id=n.author_id WHERE n.audience='all' OR n.audience=? ORDER BY n.created_at DESC LIMIT 100",u.role);
 let output=heading('TABLÓN INFORMATIVO','Notificaciones','Avisos y documentos para participantes del proyecto Erasmus+.');
 if(notice)output+=panel('Aviso','<p>'+E(notice)+'</p>');
 output+=items.map(n=>{
  const attachments=all('SELECT id,original_name FROM files WHERE notice_id=?',n.id);
  return '<article class="card"><div class="row"><span class="pill">'+E(n.audience==='all'?'Todos':n.audience==='student'?'Alumnado':'Docentes')+'</span><small>'+E(n.created_at)+'</small></div>'+
  '<h2>'+E(n.title)+'</h2><p class="preserve">'+E(n.body)+'</p><p class="muted">Publicado por '+E(n.first_name+' '+n.last_name)+'</p>'+
  attachments.map(f=>'<p><a href="/archivo/'+f.id+'">⬇ Descargar '+E(f.original_name)+'</a></p>').join('')+'</article>';
 }).join('')||panel('Sin avisos','<p>Todavía no se ha publicado información.</p>');
 if(isAdmin(u)){
  output+='<form class="card form" method="post" action="/coordinacion/avisos" enctype="multipart/form-data">'+
  '<h2>Publicar notificación</h2><label>Título'+input('title')+'</label>'+
  '<label>Destinatarios'+select('audience',['all','student','teacher'])+'</label>'+
  '<label>Contenido<textarea name="body" rows="5" maxlength="6000" required></textarea></label>'+
  '<label>Adjuntar imagen o documento (opcional)<input type="file" name="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.docx"></label>'+
  '<p class="muted">Se enviará un aviso por correo institucional a los usuarios aprobados del perfil seleccionado. La entrega se gestionará mediante la cola de Resend.</p>'+
  formEnd(api.csrf(req),'Publicar aviso');
 }
 api.layout(req,'Notificaciones',output);
}
async function publishNotice(req,api){
 const form=await multipart(req);
 if(!api.requireCSRF(req,{csrf:form.get('csrf')}))return;
 const title=clean(form.get('title'),140),body=clean(form.get('body'),6000);
 const audience=clean(form.get('audience'),20);
 if(!title||!body||!['all','teacher','student'].includes(audience)){
  noticePage(req,api,'Completa el título, el mensaje y los destinatarios.');return;
 }
 const id=Number(run('INSERT INTO notices(author_id,title,body,audience) VALUES (?,?,?,?)',
   req.auth.user.id,title,body,audience).lastInsertRowid);
 try {
  if(form.get('file')?.size)await storeUpload(form.get('file'),{ownerId:req.auth.user.id,noticeId:id});
 }catch(e){
  run('DELETE FROM notices WHERE id=?',id);
  noticePage(req,api,'No se publicó la notificación: '+e.message);return;
 }
 audit(req.auth.user.id,'notice_created',id);
 const targets=audience==='all'?
 all("SELECT institutional_email FROM users WHERE status='approved' AND role!='coordinator'"):
 all("SELECT institutional_email FROM users WHERE status='approved' AND role=?",audience);
 for(const target of targets){
  queueMail(target.institutional_email,'Nuevo aviso Erasmus+ MMG: '+title,
   'Se ha publicado una notificación en Movilidades Erasmus+ MMG:\n\n'+title+
   '\n\nAccede a tu cuenta para consultar la información y los documentos adjuntos.');
 }
 noticePage(req,api,'Aviso publicado y '+targets.length+' correo(s) incorporados a la cola de envío.');
}
function directory(u){
 if(isAdmin(u))return all("SELECT id,first_name,last_name,role FROM users WHERE status='approved' AND id!=? ORDER BY first_name,last_name LIMIT 200",u.id);
 // Participants see coordination and members of their own approved mobility groups only.
  return all("SELECT DISTINCT u.id,u.first_name,u.last_name,u.role FROM users u WHERE u.status='approved' AND u.id!=? AND "+
   "(u.role='coordinator' OR EXISTS (SELECT 1 FROM group_members a JOIN group_members b ON b.group_id=a.group_id "+
   "JOIN mobility_groups g ON g.id=a.group_id WHERE a.user_id=? AND b.user_id=u.id AND g.edition_id=? AND u.edition_id=g.edition_id)) "+
   "ORDER BY u.first_name,u.last_name LIMIT 200",u.id,u.id,editionForUser(u)?.id||null);
}
function conversation(req,api,msg=''){
 const user=req.auth.user;
 const contactId=validId(new URL(req.url,'http://localhost').searchParams.get('con'));
 const recipients=directory(user);
 const selected=contactId && recipients.find(x=>x.id===contactId);
 const groupId=validId(new URL(req.url,'http://localhost').searchParams.get('grupo'));
 let group=null;
 if(groupId){
  group=get('SELECT * FROM mobility_groups WHERE id=?',groupId);
   if(!group||(!isAdmin(user)&&(!get('SELECT 1 FROM group_members WHERE group_id=? AND user_id=?',groupId,user.id)||
    group.edition_id!==editionForUser(user)?.id))){
   api.error(req,404,'No existe el grupo o no tienes autorización.');return;
  }
 }
 const direct=selected?all("SELECT m.*,u.first_name,u.last_name FROM messages m JOIN users u ON u.id=m.sender_id WHERE (sender_id=? AND receiver_id=?) OR (sender_id=? AND receiver_id=?) ORDER BY m.id DESC LIMIT 100",
   user.id,selected.id,selected.id,user.id).reverse():[];
 const inGroup=group?all("SELECT m.*,u.first_name,u.last_name FROM messages m JOIN users u ON u.id=m.sender_id WHERE group_id=? ORDER BY m.id DESC LIMIT 100",group.id).reverse():[];
  const membership=isAdmin(user)?all('SELECT g.*,e.label AS edition_label FROM mobility_groups g JOIN erasmus_editions e ON e.id=g.edition_id ORDER BY g.id DESC'):
   all('SELECT g.*,e.label AS edition_label FROM mobility_groups g JOIN erasmus_editions e ON e.id=g.edition_id '+
    'JOIN group_members m ON m.group_id=g.id WHERE m.user_id=? AND g.edition_id=? ORDER BY g.id DESC',user.id,editionForUser(user)?.id||null);
 const selectedMessages=group?inGroup:direct;
 let output=heading('COMUNICACIÓN ENTRE PARTICIPANTES','Chat interno','Contacta con coordinación, docentes y alumnado autorizado de las movilidades.');
 if(msg)output+=panel('Mensaje',E(msg));
 output+='<div class="chat-grid"><section class="card"><h2>Libreta de participantes</h2>'+
  recipients.map(x=>'<p><a href="/chat?con='+x.id+'">'+E(x.first_name+' '+x.last_name)+'</a> <small> · '+E(x.role==='teacher'?'Docente':x.role==='student'?'Alumnado':'Coordinación')+'</small></p>').join('')+
  '<h2>Grupos de movilidad</h2>'+membership.map(g=>'<p><a href="/chat?grupo='+g.id+'">'+E(g.name)+'</a> <small> · '+E(g.edition_label)+'</small></p>').join('')+
  '</section><section class="card"><h2>'+E(group?'Grupo: '+group.name:selected?selected.first_name+' '+selected.last_name:'Selecciona una conversación')+'</h2>'+
  '<div class="conversation">'+selectedMessages.map(m=>'<article class="bubble'+(m.sender_id===user.id?' mine':'')+'"><b>'+E(m.first_name+' '+m.last_name)+'</b><p class="preserve">'+E(m.content)+'</p><small>'+E(m.created_at)+'</small></article>').join('')+'</div>'+
  (selected||group?'<form method="post" action="/chat" class="form"><textarea name="content" rows="3" maxlength="2500" required placeholder="Escribe aquí..."></textarea>'+
   (selected?'<input type="hidden" name="receiver_id" value="'+selected.id+'">':'<input type="hidden" name="group_id" value="'+group.id+'">')+
   '<input type="hidden" name="csrf" value="'+E(api.csrf(req))+'"><button class="btn">Enviar mensaje</button></form>':'<p>Elige un destinatario o un grupo.</p>')+
  '<p class="muted">Las comunicaciones pueden ser supervisadas por Coordinación de acuerdo con el protocolo del centro y dejando constancia del acceso. No se hacen copias ocultas a los participantes.</p></section></div>';
 api.layout(req,'Chat interno',output);
}
function sendChat(req,body,api){
 const user=req.auth.user,text=clean(body.content,2500);
 const recipient=validId(body.receiver_id),groupId=validId(body.group_id);
 if(text.length<1||Boolean(recipient)===Boolean(groupId)){conversation(req,api,'Debes seleccionar un destinatario o grupo y redactar el mensaje.');return;}
 if(recipient){
  const target=get("SELECT * FROM users WHERE id=? AND status='approved'",recipient);
  if(!target||target.id===user.id||!directory(user).some(x=>x.id===target.id)){
   conversation(req,api,'Destinatario no autorizado: solo coordinación y participantes de tus grupos.');return;
  }
  const id=Number(run('INSERT INTO messages(sender_id,receiver_id,content) VALUES (?,?,?)',user.id,target.id,text).lastInsertRowid);
  queueMail(target.institutional_email,'Mensaje recibido · Erasmus+ MMG',
    'Tienes un mensaje nuevo de '+user.first_name+' '+user.last_name+
    ' en Movilidades Erasmus+ MMG. Accede a la aplicación para leerlo.');
  audit(user.id,'chat_direct_message_sent',id);
  api.redirect(req,'/chat?con='+target.id);return;
 }
 const group=get('SELECT * FROM mobility_groups WHERE id=?',groupId);
  if(!group||(!isAdmin(user)&&(!get('SELECT 1 FROM group_members WHERE group_id=? AND user_id=?',groupId,user.id)||
   group.edition_id!==editionForUser(user)?.id))){
  conversation(req,api,'No perteneces a ese grupo.');return;
 }
 const id=Number(run('INSERT INTO messages(sender_id,group_id,content) VALUES (?,?,?)',user.id,groupId,text).lastInsertRowid);
 audit(user.id,'chat_group_message_sent',id);
 api.redirect(req,'/chat?grupo='+groupId);
}
function groupsPage(req,api,notice='',selectedEditionId=null){
  const editions=all('SELECT id,label FROM erasmus_editions ORDER BY label DESC');
  const requested=validId(selectedEditionId||new URL(req.url,'http://localhost').searchParams.get('edicion'));
  const selected=editions.find(edition=>edition.id===requested)||editions.find(edition=>edition.id===activeEdition()?.id)||editions[0]||null;
  const groups=selected?all('SELECT g.*,e.label AS edition_label FROM mobility_groups g JOIN erasmus_editions e ON e.id=g.edition_id WHERE g.edition_id=? ORDER BY g.id DESC',selected.id):[];
  const users=selected?all("SELECT id,role,first_name,last_name FROM users WHERE status='approved' AND role!='coordinator' AND edition_id=? ORDER BY first_name",selected.id):[];
 let out=heading('COORDINACIÓN · MOVILIDADES','Gestión de grupos','Crea los grupos y asigna docentes acompañantes y alumnado.');
 if(notice)out+=panel('Resultado',E(notice));
  out+='<form class="card form" method="get" action="/coordinacion/grupos"><label>Convocatoria'+
   '<select name="edicion">'+editions.map(edition=>'<option value="'+edition.id+'"'+(selected?.id===edition.id?' selected':'')+'>'+E(edition.label)+'</option>').join('')+
   '</select></label><button class="btn secondary" type="submit">Consultar grupos</button></form>';
 out+='<form class="card form" method="post" action="/coordinacion/grupos"><h2>Crear grupo</h2>'+
 '<label>Nombre'+input('name')+'</label><label>Destino'+select('destination',['Viseu','Oporto','Róterdam'])+'</label>'+
  '<label>Modalidad'+select('type',['short','long','shadowing'])+'</label>'+
  '<label>Convocatoria<select name="edition_id">'+editions.map(edition=>'<option value="'+edition.id+'"'+(selected?.id===edition.id?' selected':'')+'>'+E(edition.label)+'</option>').join('')+
  '</select></label>'+formEnd(api.csrf(req),'Crear grupo');
  if(!selected)out+=panel('Sin convocatorias','<p>Crea una convocatoria antes de crear grupos.</p>');
 for(const g of groups){
   const members=all('SELECT u.id,u.first_name,u.last_name,u.role FROM group_members gm JOIN users u ON u.id=gm.user_id WHERE gm.group_id=? AND u.edition_id=?',g.id,g.edition_id);
    const groupEditions=editions.map(edition=>'<option value="'+edition.id+'"'+(edition.id===g.edition_id?' selected':'')+'>'+E(edition.label)+'</option>').join('');
   out+=panel(g.name+' · '+g.destination+' · '+g.edition_label,
  '<p>Participantes: '+members.map(m=>E(m.first_name+' '+m.last_name)+' ('+E(m.role)+')').join(', ')+'</p>'+
   '<form class="form" method="post" action="/coordinacion/grupos/cambiar-convocatoria">'+
   '<input type="hidden" name="group_id" value="'+g.id+'">'+
   '<label>Corregir convocatoria<select name="edition_id">'+groupEditions+'</select></label>'+
   formEnd(api.csrf(req),'Revisar cambio')+
  '<form class="form" method="post" action="/coordinacion/grupos/asignar">'+
  '<input type="hidden" name="group_id" value="'+g.id+'">'+
  '<label>Usuario'+select('user_id',users.map(u=>String(u.id)+'|'+u.first_name+' '+u.last_name+' ('+u.role+')'))+'</label>'+
  formEnd(api.csrf(req),'Añadir usuario')+
  '<p><a href="/chat?grupo='+g.id+'">Abrir chat del grupo</a></p>');
 }
 api.layout(req,'Gestión de grupos',out);
}
function groupEditionSnapshot(groupId,targetEditionId){
 const group=get('SELECT edition_id FROM mobility_groups WHERE id=?',groupId);
 if(!group)return null;
 return {
  currentEditionId:group.edition_id,targetEditionId,
  members:all('SELECT gm.user_id,u.edition_id,u.status FROM group_members gm JOIN users u ON u.id=gm.user_id WHERE gm.group_id=? ORDER BY gm.user_id',groupId)
   .map(row=>[row.user_id,row.edition_id,row.status]),
  events:all('SELECT id FROM mobility_events WHERE group_id=? ORDER BY id',groupId).map(row=>row.id),
  tasks:all('SELECT t.id,(SELECT COUNT(*) FROM mobility_task_completions c WHERE c.task_id=t.id) AS completions FROM mobility_tasks t WHERE t.group_id=? ORDER BY t.id',groupId)
   .map(row=>[row.id,row.completions]),
  messages:all('SELECT id FROM messages WHERE group_id=? ORDER BY id',groupId).map(row=>row.id),
  files:all('SELECT id FROM files WHERE group_id=? ORDER BY id',groupId).map(row=>row.id)
 };
}
function snapshotToken(snapshot){
 return createHash('sha256').update(JSON.stringify(snapshot)).digest('hex');
}
function groupEditionImpact(groupId,targetEditionId){
 const snapshot=groupEditionSnapshot(groupId,targetEditionId);
 const matchedMembers=snapshot.members.filter(member=>member[1]===targetEditionId).length;
 return {
  snapshot,token:snapshotToken(snapshot),memberCount:snapshot.members.length,
  matchedMembers,mismatchedMembers:snapshot.members.length-matchedMembers,
  eventCount:snapshot.events.length,taskCount:snapshot.tasks.length,
  completionCount:snapshot.tasks.reduce((count,task)=>count+task[1],0),
  messageCount:snapshot.messages.length,fileCount:snapshot.files.length
 };
}
function reviewGroupEdition(req,body,api){
 const groupId=validId(body.group_id),targetId=validId(body.edition_id);
 const group=groupId&&get('SELECT g.*,e.label AS edition_label FROM mobility_groups g JOIN erasmus_editions e ON e.id=g.edition_id WHERE g.id=?',groupId);
 const target=targetId&&get('SELECT id,label FROM erasmus_editions WHERE id=?',targetId);
 if(!group||!target){groupsPage(req,api,'Selecciona un grupo y una convocatoria válidos.',group?.edition_id);return;}
 if(group.edition_id===target.id){groupsPage(req,api,'El grupo ya pertenece a esa convocatoria.',group.edition_id);return;}
 const impact=groupEditionImpact(group.id,target.id);
 const csrf=E(api.csrf(req));
 const bodyHtml='<p>Vas a cambiar <b>'+E(group.name)+'</b> de <b>'+E(group.edition_label)+'</b> a <b>'+E(target.label)+'</b>.</p>'+
  '<p><b>Participantes:</b> '+impact.memberCount+' asignados; '+impact.matchedMembers+' ya pertenecen a la convocatoria destino y '+impact.mismatchedMembers+' no coinciden con ella. Las asignaciones se conservarán; las cuentas que no coincidan no podrán ver la agenda del grupo.</p>'+
  '<p><b>Agenda y tareas:</b> se conservarán '+impact.eventCount+' actividades, '+impact.taskCount+' tareas y '+impact.completionCount+' registros de tareas completadas. Seguirán asociadas al grupo y solo serán visibles para miembros aprobados de la convocatoria destino.</p>'+
  '<p><b>Historial:</b> se conservarán '+impact.messageCount+' mensajes de grupo y '+impact.fileCount+' documentos. La corrección quedará registrada sin borrar el historial anterior.</p>'+
  '<p class="muted">El cambio no mueve cuentas entre convocatorias ni envía la agenda a cuentas que no pertenezcan al grupo.</p>'+
  '<form class="form" method="post" action="/coordinacion/grupos/cambiar-convocatoria/confirmar">'+
  '<input type="hidden" name="group_id" value="'+group.id+'">'+
  '<input type="hidden" name="current_edition_id" value="'+group.edition_id+'">'+
  '<input type="hidden" name="edition_id" value="'+target.id+'">'+
  '<input type="hidden" name="snapshot" value="'+impact.token+'">'+
  '<input type="hidden" name="csrf" value="'+csrf+'">'+
  '<button class="btn" type="submit">Confirmar cambio de convocatoria</button> '+
  '<a class="btn secondary" href="/coordinacion/grupos?edicion='+group.edition_id+'">Cancelar</a></form>';
 api.layout(req,'Revisar convocatoria del grupo',heading('COORDINACIÓN · MOVILIDADES','Revisar cambio de convocatoria',
  'Comprueba cómo afectará el cambio antes de guardarlo.')+panel('Efectos del cambio',bodyHtml));
}
function confirmGroupEdition(req,body,api){
 const groupId=validId(body.group_id),currentId=validId(body.current_edition_id),targetId=validId(body.edition_id);
 const snapshot=String(body.snapshot||'');
 const group=groupId&&get('SELECT id,edition_id FROM mobility_groups WHERE id=?',groupId);
 const target=targetId&&get('SELECT id FROM erasmus_editions WHERE id=?',targetId);
 if(!group||!target||!currentId||group.edition_id!==currentId||currentId===targetId){
  groupsPage(req,api,'El grupo o la convocatoria cambiaron desde la revisión. Vuelve a revisar el cambio.',group?.edition_id);return;
 }
 let stale=false;
 db.exec('BEGIN IMMEDIATE');
 try{
  const currentGroup=get('SELECT id,edition_id FROM mobility_groups WHERE id=?',groupId);
  const currentImpact=currentGroup&&groupEditionImpact(groupId,targetId);
  if(!currentGroup||currentGroup.edition_id!==currentId||!currentImpact||currentImpact.token!==snapshot){
   stale=true;
   throw new Error('stale group edition review');
  }
  const updated=run('UPDATE mobility_groups SET edition_id=? WHERE id=? AND edition_id=?',targetId,groupId,currentId);
  if(updated.changes!==1)throw new Error('group edition update conflict');
  run('INSERT INTO mobility_group_edition_history(group_id,previous_edition_id,new_edition_id,changed_by) VALUES (?,?,?,?)',
   groupId,currentId,targetId,req.auth.user.id);
  audit(req.auth.user.id,'mobility_group_edition_changed',groupId);
  db.exec('COMMIT');
 }catch(error){
  db.exec('ROLLBACK');
  if(stale){
   groupsPage(req,api,'La composición del grupo o su agenda cambiaron desde la revisión. Revisa de nuevo los efectos antes de confirmar.',currentId);
   return;
  }
  throw error;
 }
 groupsPage(req,api,'Convocatoria del grupo corregida. Sus participantes, agenda, tareas e historial se han conservado.',targetId);
}
function groupsPost(req,body,api){
 const name=clean(body.name,130),dest=clean(body.destination),type=clean(body.type),editionId=validId(body.edition_id);
 if(!name||!['Viseu','Oporto','Róterdam'].includes(dest)||!['short','long','shadowing'].includes(type)||!editionId||!get('SELECT id FROM erasmus_editions WHERE id=?',editionId)){
  groupsPage(req,api,'Nombre, destino, modalidad o convocatoria incorrectos.',editionId);return;
 }
 const id=Number(run('INSERT INTO mobility_groups(name,destination,type,edition_id) VALUES (?,?,?,?)',name,dest,type,editionId).lastInsertRowid);
 audit(req.auth.user.id,'group_created',id);groupsPage(req,api,'Grupo creado.',editionId);
}
function assignMember(req,body,api){
 const id=validId(body.group_id),uid=validId(String(body.user_id||'').split('|')[0]);
 const g=id&&get('SELECT * FROM mobility_groups WHERE id=?',id),u=uid&&get("SELECT * FROM users WHERE id=? AND status='approved' AND role!='coordinator'",uid);
 if(!g||!u){groupsPage(req,api,'Grupo o usuario no encontrado o sin aprobar.',g?.edition_id);return;}
 if(u.edition_id!==g.edition_id){groupsPage(req,api,'El participante y el grupo deben pertenecer a la misma convocatoria.',g.edition_id);return;}
 run('INSERT OR IGNORE INTO group_members(group_id,user_id) VALUES (?,?)',id,uid);
 audit(req.auth.user.id,'group_member_added',uid);
 groupsPage(req,api,'Participante incorporado al grupo.',g.edition_id);
}

function supervisor(req,api){
 if(!api.mustAdmin(req))return;
 const messages=all("SELECT m.id,m.content,m.created_at,s.first_name AS sender_first,s.last_name AS sender_last,r.first_name AS receiver_first,r.last_name AS receiver_last,g.name AS group_name FROM messages m JOIN users s ON s.id=m.sender_id LEFT JOIN users r ON r.id=m.receiver_id LEFT JOIN mobility_groups g ON g.id=m.group_id ORDER BY m.id DESC LIMIT 150");
 audit(req.auth.user.id,'chat_supervision_accessed');
 const cells=messages.map(m=>'<tr><td>'+E(m.created_at)+'</td><td>'+E(m.sender_first+' '+m.sender_last)+'</td><td>'+E(m.group_name||m.receiver_first+' '+m.receiver_last)+'</td><td><div class="preserve">'+E(m.content)+'</div></td></tr>');
 api.layout(req,'Supervisión del chat',heading('COORDINACIÓN · SUPERVISIÓN','Supervisión de comunicaciones',
   'Acceso restringido al coordinador y registrado en auditoría. La supervisión debe ser conocida por las personas participantes y ajustarse al protocolo institucional.')+
   panel('Mensajes recientes',datatable(['Fecha','Emisor','Destino','Contenido'],cells)));
}

export async function socialRoutes(req,url,method,api){
 const routes=['/notificaciones','/chat','/coordinacion/avisos','/coordinacion/grupos','/coordinacion/grupos/asignar',
  '/coordinacion/grupos/cambiar-convocatoria','/coordinacion/grupos/cambiar-convocatoria/confirmar','/coordinacion/chat'];
 if(!routes.includes(url))return false;
 if(!api.mustLogin(req))return true;
 if(url==='/notificaciones'&&method==='GET'){noticePage(req,api);return true;}
 if(url==='/coordinacion/chat'&&method==='GET'){supervisor(req,api);return true;}
 if(url==='/chat'&&method==='GET'){conversation(req,api);return true;}
 if(url==='/chat'&&method==='POST'){
  const b=await api.readForm(req);if(api.requireCSRF(req,b))sendChat(req,b,api);return true;
 }
 if(url==='/coordinacion/avisos'&&method==='POST'){
  if(api.mustAdmin(req))await publishNotice(req,api);return true;
 }
 if(url==='/coordinacion/grupos'){
  if(!api.mustAdmin(req))return true;
  if(method==='GET')groupsPage(req,api);
  else {const b=await api.readForm(req);if(api.requireCSRF(req,b))groupsPost(req,b,api);}
  return true;
 }
  if(url==='/coordinacion/grupos/cambiar-convocatoria'||url==='/coordinacion/grupos/cambiar-convocatoria/confirmar'){
   if(!api.mustAdmin(req))return true;
   if(method!=='POST'){api.error(req,405,'Método no permitido.');return true;}
   const b=await api.readForm(req);
   if(api.requireCSRF(req,b)){
    if(url.endsWith('/confirmar'))confirmGroupEdition(req,b,api);else reviewGroupEdition(req,b,api);
   }
   return true;
  }
 if(url==='/coordinacion/grupos/asignar'&&method==='POST'){
  if(!api.mustAdmin(req))return true;
  const b=await api.readForm(req);if(api.requireCSRF(req,b))assignMember(req,b,api);
  return true;
 }
 api.error(req,405,'Método no permitido.');return true;
}
