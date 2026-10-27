import { get,all,run,audit } from './db.mjs';
import { escape as E,clean,validId,heading,panel,datatable,formEnd,input,select,queueMail,multipart,storeUpload,isAdmin } from './feature-service.mjs';

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
 return all("SELECT id,first_name,last_name,role FROM users WHERE status='approved' AND id!=? ORDER BY first_name,last_name LIMIT 200",u.id);
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
  if(group&&!isAdmin(user)&&!get('SELECT 1 FROM group_members WHERE group_id=? AND user_id=?',groupId,user.id))group=null;
 }
 const direct=selected?all("SELECT m.*,u.first_name,u.last_name FROM messages m JOIN users u ON u.id=m.sender_id WHERE (sender_id=? AND receiver_id=?) OR (sender_id=? AND receiver_id=?) ORDER BY m.id DESC LIMIT 100",
   user.id,selected.id,selected.id,user.id).reverse():[];
 const inGroup=group?all("SELECT m.*,u.first_name,u.last_name FROM messages m JOIN users u ON u.id=m.sender_id WHERE group_id=? ORDER BY m.id DESC LIMIT 100",group.id).reverse():[];
 const membership=isAdmin(user)?all('SELECT * FROM mobility_groups ORDER BY id DESC'):
  all('SELECT g.* FROM mobility_groups g JOIN group_members m ON m.group_id=g.id WHERE m.user_id=? ORDER BY g.id DESC',user.id);
 const selectedMessages=group?inGroup:direct;
 let output=heading('COMUNICACIÓN ENTRE PARTICIPANTES','Chat interno','Contacta con coordinación, docentes y alumnado autorizado de las movilidades.');
 if(msg)output+=panel('Mensaje',E(msg));
 output+='<div class="chat-grid"><section class="card"><h2>Libreta de participantes</h2>'+
  recipients.map(x=>'<p><a href="/chat?con='+x.id+'">'+E(x.first_name+' '+x.last_name)+'</a> <small> · '+E(x.role==='teacher'?'Docente':x.role==='student'?'Alumnado':'Coordinación')+'</small></p>').join('')+
  '<h2>Grupos de movilidad</h2>'+membership.map(g=>'<p><a href="/chat?grupo='+g.id+'">'+E(g.name)+'</a></p>').join('')+
  '</section><section class="card"><h2>'+E(group?'Grupo: '+group.name:selected?selected.first_name+' '+selected.last_name:'Selecciona una conversación')+'</h2>'+
  '<div class="conversation">'+selectedMessages.map(m=>'<article class="bubble'+(m.sender_id===user.id?' mine':'')+'"><b>'+E(m.first_name+' '+m.last_name)+'</b><p class="preserve">'+E(m.content)+'</p><small>'+E(m.created_at)+'</small></article>').join('')+'</div>'+
  (selected||group?'<form method="post" action="/chat" class="form"><textarea name="content" rows="3" maxlength="2500" required placeholder="Escribe aquí..."></textarea>'+
   (selected?'<input type="hidden" name="receiver_id" value="'+selected.id+'">':'<input type="hidden" name="group_id" value="'+group.id+'">')+
   '<input type="hidden" name="csrf" value="'+E(api.csrf(req))+'"><button class="btn">Enviar mensaje</button></form>':'<p>Elige un destinatario o un grupo.</p>')+
  '<p class="muted">Las comunicaciones están sujetas a la política de uso, moderación y protección de datos del centro. No se hacen copias ocultas.</p></section></div>';
 api.layout(req,'Chat interno',output);
}
function sendChat(req,body,api){
 const user=req.auth.user,text=clean(body.content,2500);
 const recipient=validId(body.receiver_id),groupId=validId(body.group_id);
 if(text.length<1||Boolean(recipient)===Boolean(groupId)){conversation(req,api,'Debes seleccionar un destinatario o grupo y redactar el mensaje.');return;}
 if(recipient){
  const target=get("SELECT * FROM users WHERE id=? AND status='approved'",recipient);
  if(!target||target.id===user.id){conversation(req,api,'Destinatario no válido.');return;}
  const id=Number(run('INSERT INTO messages(sender_id,receiver_id,content) VALUES (?,?,?)',user.id,target.id,text).lastInsertRowid);
  queueMail(target.institutional_email,'Mensaje recibido · Erasmus+ MMG',
    'Tienes un mensaje nuevo de '+user.first_name+' '+user.last_name+
    ' en Movilidades Erasmus+ MMG. Accede a la aplicación para leerlo.');
  audit(user.id,'chat_direct_message_sent',id);
  api.redirect(req,'/chat?con='+target.id);return;
 }
 const group=get('SELECT * FROM mobility_groups WHERE id=?',groupId);
 if(!group||(!isAdmin(user)&&!get('SELECT 1 FROM group_members WHERE group_id=? AND user_id=?',groupId,user.id))){
  conversation(req,api,'No perteneces a ese grupo.');return;
 }
 const id=Number(run('INSERT INTO messages(sender_id,group_id,content) VALUES (?,?,?)',user.id,groupId,text).lastInsertRowid);
 audit(user.id,'chat_group_message_sent',id);
 api.redirect(req,'/chat?grupo='+groupId);
}
function groupsPage(req,api,notice=''){
 const groups=all('SELECT * FROM mobility_groups ORDER BY id DESC'),users=all("SELECT id,role,first_name,last_name FROM users WHERE status='approved' AND role!='coordinator' ORDER BY first_name");
 let out=heading('COORDINACIÓN · MOVILIDADES','Gestión de grupos','Crea los grupos y asigna docentes acompañantes y alumnado.');
 if(notice)out+=panel('Resultado',E(notice));
 out+='<form class="card form" method="post" action="/coordinacion/grupos"><h2>Crear grupo</h2>'+
 '<label>Nombre'+input('name')+'</label><label>Destino'+select('destination',['Viseu','Oporto','Róterdam'])+'</label>'+
 '<label>Modalidad'+select('type',['short','long','shadowing'])+'</label>'+formEnd(api.csrf(req),'Crear grupo');
 for(const g of groups){
  const members=all('SELECT u.id,u.first_name,u.last_name,u.role FROM group_members gm JOIN users u ON u.id=gm.user_id WHERE gm.group_id=?',g.id);
  out+=panel(g.name+' · '+g.destination,
  '<p>Participantes: '+members.map(m=>E(m.first_name+' '+m.last_name)+' ('+E(m.role)+')').join(', ')+'</p>'+
  '<form class="form" method="post" action="/coordinacion/grupos/asignar">'+
  '<input type="hidden" name="group_id" value="'+g.id+'">'+
  '<label>Usuario'+select('user_id',users.map(u=>String(u.id)+'|'+u.first_name+' '+u.last_name+' ('+u.role+')'))+'</label>'+
  formEnd(api.csrf(req),'Añadir usuario')+
  '<p><a href="/chat?grupo='+g.id+'">Abrir chat del grupo</a></p>');
 }
 api.layout(req,'Gestión de grupos',out);
}
function groupsPost(req,body,api){
 const name=clean(body.name,130),dest=clean(body.destination),type=clean(body.type);
 if(!name||!['Viseu','Oporto','Róterdam'].includes(dest)||!['short','long','shadowing'].includes(type)){groupsPage(req,api,'Nombre, destino o tipo incorrectos.');return;}
 const id=Number(run('INSERT INTO mobility_groups(name,destination,type) VALUES (?,?,?)',name,dest,type).lastInsertRowid);
 audit(req.auth.user.id,'group_created',id);groupsPage(req,api,'Grupo creado.');
}
function assignMember(req,body,api){
 const id=validId(body.group_id),uid=validId(String(body.user_id||'').split('|')[0]);
 const g=id&&get('SELECT * FROM mobility_groups WHERE id=?',id),u=uid&&get("SELECT * FROM users WHERE id=? AND status='approved' AND role!='coordinator'",uid);
 if(!g||!u){groupsPage(req,api,'Grupo o usuario no encontrado o sin aprobar.');return;}
 run('INSERT OR IGNORE INTO group_members(group_id,user_id) VALUES (?,?)',id,uid);
 audit(req.auth.user.id,'group_member_added',uid);
 groupsPage(req,api,'Participante incorporado al grupo.');
}
export async function socialRoutes(req,url,method,api){
 const routes=['/notificaciones','/chat','/coordinacion/avisos','/coordinacion/grupos','/coordinacion/grupos/asignar'];
 if(!routes.includes(url))return false;
 if(!api.mustLogin(req))return true;
 if(url==='/notificaciones'&&method==='GET'){noticePage(req,api);return true;}
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
 if(url==='/coordinacion/grupos/asignar'&&method==='POST'){
  if(!api.mustAdmin(req))return true;
  const b=await api.readForm(req);if(api.requireCSRF(req,b))assignMember(req,b,api);
  return true;
 }
 api.error(req,405,'Método no permitido.');return true;
}
