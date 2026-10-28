import {db,get,all,run,audit} from './db.mjs';
import {escape as E,clean,validId,heading,panel,datatable,queueMail,editionForUser} from './feature-service.mjs';

db.exec(
 "CREATE TABLE IF NOT EXISTS mobility_events ("+
 "id INTEGER PRIMARY KEY,group_id INTEGER NOT NULL REFERENCES mobility_groups(id) ON DELETE CASCADE,"+
 "kind TEXT NOT NULL CHECK(kind IN ('activity','deadline','travel','meeting')),"+
 "title TEXT NOT NULL,description TEXT NOT NULL DEFAULT '',location TEXT NOT NULL DEFAULT '',"+
 "start_time TEXT NOT NULL,end_time TEXT,created_by INTEGER NOT NULL REFERENCES users(id),"+
 "created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);"+
 "CREATE INDEX IF NOT EXISTS mobility_events_group ON mobility_events(group_id,start_time);"+
 "CREATE TABLE IF NOT EXISTS mobility_tasks ("+
 "id INTEGER PRIMARY KEY,group_id INTEGER NOT NULL REFERENCES mobility_groups(id) ON DELETE CASCADE,"+
 "title TEXT NOT NULL,description TEXT NOT NULL DEFAULT '',due_date TEXT,"+
 "created_by INTEGER NOT NULL REFERENCES users(id),created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);"+
 "CREATE TABLE IF NOT EXISTS mobility_task_completions ("+
 "task_id INTEGER NOT NULL REFERENCES mobility_tasks(id) ON DELETE CASCADE,"+
 "user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,"+
 "completed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY(task_id,user_id));"+
 "CREATE INDEX IF NOT EXISTS mobility_tasks_group ON mobility_tasks(group_id,due_date);"
);
const eventLabel={activity:'Actividad formativa',deadline:'Plazo',travel:'Desplazamiento',meeting:'Reunión'};
function myGroups(u){
 return u.role==='coordinator'?all(
  'SELECT g.*,e.label AS edition_label FROM mobility_groups g JOIN erasmus_editions e ON e.id=g.edition_id ORDER BY g.id DESC'):
 all("SELECT g.*,e.label AS edition_label FROM mobility_groups g JOIN erasmus_editions e ON e.id=g.edition_id "+
  "JOIN group_members gm ON gm.group_id=g.id WHERE gm.user_id=? AND g.edition_id=? ORDER BY g.id DESC",
  u.id,editionForUser(u)?.id||null);
}
function canSee(u,groupId){return u.role==='coordinator'||Boolean(get(
 'SELECT 1 FROM group_members gm JOIN mobility_groups g ON g.id=gm.group_id '+
 'WHERE gm.group_id=? AND gm.user_id=? AND g.edition_id=?',groupId,u.id,editionForUser(u)?.id||null));}
function validDate(s){
 return /^\d{4}-\d{2}-\d{2}$/.test(s||'')&&!Number.isNaN(Date.parse(s+'T00:00:00Z'))&&
 new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;
}
function dateTime(s){
 return /^\d{4}-\d{2}-\d{2}T\d\d:\d\d$/.test(s||'')&&
 validDate(s.slice(0,10))&&Number(s.slice(11,13))<24&&Number(s.slice(14,16))<60;
}
function statusText(date){
 if(!date)return 'Sin plazo';
 const today=new Date().toISOString().slice(0,10);
 return date<today?'Plazo transcurrido':date===today?'Vence hoy':'Hasta '+date.split('-').reverse().join('/');
}
function listing(req,api){
 const u=req.auth.user,groups=myGroups(u);
 let html=heading('PLANIFICACIÓN ERASMUS+','Agenda y seguimiento',
  'Consulta actividades, plazos y tareas de los grupos de movilidad en los que participas.');
 if(groups.length){
  html+='<div class="dest-grid">'+groups.map(g=>
   '<article class="card"><span class="eyebrow">'+E(g.edition_label)+' · '+E(g.type)+' · '+E(g.destination)+'</span>'+
   '<h2>'+E(g.name)+'</h2><p>Agenda de la movilidad, actividades y compromisos.</p>'+
   '<a class="btn" href="/agenda/grupo/'+g.id+'">Ver planificación</a></article>').join('')+'</div>';
 }else html+=panel('Sin grupos asignados','<p>Cuando coordinación confirme los grupos de la convocatoria, aparecerán aquí las actividades y los plazos correspondientes.</p>');
 api.layout(req,'Agenda Erasmus+',html);
}
function groupPage(req,api,id,msg=''){
  const g=get('SELECT g.*,e.label AS edition_label FROM mobility_groups g JOIN erasmus_editions e ON e.id=g.edition_id WHERE g.id=?',id);
 if(!g||!canSee(req.auth.user,id)){api.error(req,404,'No existe el grupo o no tienes autorización.');return;}
 const admin=req.auth.user.role==='coordinator',u=req.auth.user,csrf=E(api.csrf(req));
 const events=all('SELECT * FROM mobility_events WHERE group_id=? ORDER BY start_time,id',id);
 const tasks=all("SELECT t.*,c.completed_at AS my_completed FROM mobility_tasks t "+
 "LEFT JOIN mobility_task_completions c ON c.task_id=t.id AND c.user_id=? WHERE t.group_id=? ORDER BY CASE WHEN t.due_date IS NULL THEN 1 ELSE 0 END,t.due_date,t.id",u.id,id);
  const members=all("SELECT u.id,u.first_name,u.last_name,u.role FROM users u "+
  "JOIN group_members gm ON gm.user_id=u.id WHERE gm.group_id=? AND u.edition_id=? ORDER BY u.role DESC,u.first_name",id,g.edition_id);
  let html=heading('CONVOCATORIA '+g.edition_label+' · '+g.destination,g.name,'Planificación orientativa y seguimiento de participantes.');
 if(msg)html+=panel('Resultado','<p>'+E(msg)+'</p>');
 html+=panel('Equipo y destino',
  '<p><b>Convocatoria:</b> '+E(g.edition_label)+' · <b>Modalidad:</b> '+E(g.type)+' · <b>Destino:</b> '+E(g.destination)+'</p>'+
 '<p><b>Participantes:</b> '+E(members.map(x=>x.first_name+' '+x.last_name+' ('+(x.role==='teacher'?'docente':'alumnado')+')').join(' · ')||'Por asignar')+'</p>'+
 '<p><a href="/chat?grupo='+id+'">Abrir chat del grupo</a></p>');
 html+=panel('Calendario de actividades',
 events.length?datatable(['Fecha/hora prevista','Tipo','Actividad','Lugar'],events.map(e=>
 '<tr><td>'+E(e.start_time.replace('T',' '))+'</td><td>'+E(eventLabel[e.kind])+'</td>'+
 '<td><b>'+E(e.title)+'</b><small>'+E(e.description)+'</small></td><td>'+E(e.location||'Por confirmar')+'</td></tr>')):
 '<p>No hay actividades fechadas todavía. Coordinación publicará las visitas y desplazamientos cuando estén confirmados.</p>');
 html+=panel('Tareas y documentación pendiente',
 tasks.length?datatable(['Tarea','Plazo','Seguimiento'],tasks.map(t=>{
  const completed=admin?get('SELECT COUNT(*) AS n FROM mobility_task_completions WHERE task_id=?',t.id).n:null;
  return '<tr><td><b>'+E(t.title)+'</b><small>'+E(t.description)+'</small></td>'+
   '<td>'+E(statusText(t.due_date))+'</td><td>'+
   (admin?completed+' de '+members.length+' participantes han marcado completada':t.my_completed?
     '<span class="pill">Completada</span>':
     '<form action="/agenda/tarea/'+t.id+'/completar" method="post">'+
     '<input type="hidden" name="csrf" value="'+csrf+'"><button class="btn small" type="submit">Marcar realizada</button></form>')+
  '</td></tr>';})):'<p>No hay tareas asignadas.</p>');
 if(admin){
  html+='<div class="two"><form class="card form" method="post" action="/coordinacion/agenda/actividad">'+
   '<h2>Publicar actividad</h2><input type="hidden" name="group_id" value="'+id+'">'+
   '<label>Título<input name="title" maxlength="150" required></label>'+
   '<label>Tipo<select name="kind">'+Object.entries(eventLabel).map(([key,value])=>
    '<option value="'+key+'">'+E(value)+'</option>').join('')+'</select></label>'+
   '<label>Inicio (hora local del destino)<input type="datetime-local" name="start_time" required></label>'+
   '<label>Fin (opcional)<input type="datetime-local" name="end_time"></label>'+
   '<label>Lugar<input name="location" maxlength="180"></label>'+
   '<label>Descripción<textarea name="description" rows="3" maxlength="1500"></textarea></label>'+
   '<input type="hidden" name="csrf" value="'+csrf+'"><button class="btn">Publicar actividad</button></form>'+
   '<form class="card form" method="post" action="/coordinacion/agenda/tarea">'+
   '<h2>Crear tarea</h2><input type="hidden" name="group_id" value="'+id+'">'+
   '<label>Descripción breve<input name="title" maxlength="150" required></label>'+
   '<label>Fecha límite (opcional)<input type="date" name="due_date"></label>'+
   '<label>Instrucciones<textarea name="description" rows="4" maxlength="1500"></textarea></label>'+
   '<input type="hidden" name="csrf" value="'+csrf+'"><button class="btn">Asignar tarea</button></form></div>';
 }
 html+='<a href="/agenda" class="btn secondary">← Volver a todos los grupos</a>';
 api.layout(req,'Agenda del grupo',html);
}
function groupNotice(id,title,message){
 const people=all("SELECT u.institutional_email FROM users u JOIN group_members gm ON gm.user_id=u.id "+
  "JOIN mobility_groups g ON g.id=gm.group_id WHERE gm.group_id=? AND u.status='approved' AND u.edition_id=g.edition_id",id);
 for(const p of people)queueMail(p.institutional_email,title,message);
}
function newEvent(req,api,b){
  const id=validId(b.group_id),g=id&&get('SELECT id,name FROM mobility_groups WHERE id=?',id);
 if(!g){api.error(req,404,'Grupo no encontrado.');return;}
 const kind=String(b.kind||''),title=clean(b.title,150),description=clean(b.description,1500),
  location=clean(b.location,180),start=clean(b.start_time,16),end=clean(b.end_time,16);
 if(!eventLabel[kind]||!title||!dateTime(start)||(end&&(!dateTime(end)||end<start))){
  groupPage(req,api,id,'La actividad necesita título, tipo y fecha válidos; el fin no puede ser anterior al inicio.');return;
 }
 const result=run("INSERT INTO mobility_events(group_id,kind,title,description,location,start_time,end_time,created_by) VALUES (?,?,?,?,?,?,?,?)",
 id,kind,title,description,location,start,end||null,req.auth.user.id);
 audit(req.auth.user.id,'mobility_event_created',Number(result.lastInsertRowid));
 groupNotice(id,'Nueva actividad Erasmus+ MMG',
  'Se ha añadido una actividad al grupo '+g.name+': '+title+'. Consulta tu agenda para ver sus detalles.');
 groupPage(req,api,id,'Actividad publicada. Los avisos al grupo están en cola de correo.');
}
function newTask(req,api,b){
 const id=validId(b.group_id),g=id&&get('SELECT id,name FROM mobility_groups WHERE id=?',id);
 if(!g){api.error(req,404,'Grupo no encontrado.');return;}
 const title=clean(b.title,150),description=clean(b.description,1500),due=clean(b.due_date,10);
 if(!title||(due&&!validDate(due))){
  groupPage(req,api,id,'Revisa el título y la fecha límite.');return;
 }
 const t=run("INSERT INTO mobility_tasks(group_id,title,description,due_date,created_by) VALUES (?,?,?,?,?)",
 id,title,description,due||null,req.auth.user.id);
 audit(req.auth.user.id,'mobility_task_created',Number(t.lastInsertRowid));
 groupNotice(id,'Nueva tarea Erasmus+ MMG',
  'Se ha asignado al grupo '+g.name+' la tarea: '+title+(due?' (plazo '+due+')':'')+'. Consulta tu agenda.');
 groupPage(req,api,id,'Tarea asignada a los participantes.');
}
function complete(req,api,id){
 const t=get('SELECT * FROM mobility_tasks WHERE id=?',id);
 if(!t||!canSee(req.auth.user,t.group_id)){api.error(req,404,'Tarea no encontrada.');return;}
 if(req.auth.user.role==='coordinator'){api.error(req,403,'La coordinación no completa tareas en nombre de participantes.');return;}
  const completion=run('INSERT OR IGNORE INTO mobility_task_completions(task_id,user_id) VALUES (?,?)',id,req.auth.user.id);
  if(completion.changes) audit(req.auth.user.id,'mobility_task_completed',id);
 api.redirect(req,'/agenda/grupo/'+t.group_id);
}
export async function agendaRoutes(req,url,method,api){
 const detail=/^\/agenda\/grupo\/(\d+)$/.exec(url);
 const completion=/^\/agenda\/tarea\/(\d+)\/completar$/.exec(url);
 if(!detail&&!completion&&!['/agenda','/coordinacion/agenda/actividad','/coordinacion/agenda/tarea'].includes(url))return false;
 if(!api.mustLogin(req))return true;
 if(url==='/agenda'&&method==='GET'){listing(req,api);return true;}
 if(detail&&method==='GET'){groupPage(req,api,Number(detail[1]));return true;}
 if(completion&&method==='POST'){
  const b=await api.readForm(req);if(api.requireCSRF(req,b))complete(req,api,Number(completion[1]));
  return true;
 }
 if((url==='/coordinacion/agenda/actividad'||url==='/coordinacion/agenda/tarea')&&method==='POST'){
  if(!api.mustAdmin(req))return true;
  const b=await api.readForm(req);
  if(api.requireCSRF(req,b)){
   if(url.endsWith('/actividad'))newEvent(req,api,b);else newTask(req,api,b);
  }
  return true;
 }
 api.error(req,405,'Método no permitido.');return true;
}
