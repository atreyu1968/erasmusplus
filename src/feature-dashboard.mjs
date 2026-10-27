import {all,get} from './db.mjs';
import {escape as E,heading,panel,activeEdition} from './feature-service.mjs';

const resultName={
 in_review:'En valoración',shortlisted:'Preseleccionada',
 selected:'Seleccionada',reserve:'En reserva',not_selected:'No seleccionada'
};
function card(label,value,detail){
 return '<article class="stat-tile"><small>'+E(label)+'</small><strong>'+E(value)+'</strong><span>'+E(detail)+'</span></article>';
}
export function participantDashboard(req,api){
 const u=req.auth.user;
 if(u.role==='coordinator'){api.redirect(req,'/coordinacion');return;}
 const app=all(
  "SELECT a.id,a.mobility,a.destination,a.status,e.label AS edition_label,r.decision FROM applications a "+
  "LEFT JOIN erasmus_editions e ON e.id=a.edition_id LEFT JOIN application_reviews r ON r.application_id=a.id "+
  "WHERE a.user_id=? ORDER BY a.id DESC",u.id);
 const groups=all("SELECT g.id,g.name,g.destination,g.type FROM mobility_groups g "+
 "JOIN group_members gm ON gm.group_id=g.id WHERE gm.user_id=? ORDER BY g.id DESC LIMIT 20",u.id);
 const notices=get("SELECT COUNT(*) AS n FROM notices WHERE audience='all' OR audience=?",u.role).n;
 const tasks=get(
 "SELECT COUNT(*) AS n FROM mobility_tasks t JOIN group_members gm ON gm.group_id=t.group_id "+
 "LEFT JOIN mobility_task_completions c ON c.task_id=t.id AND c.user_id=? "+
 "WHERE gm.user_id=? AND c.task_id IS NULL",u.id,u.id).n;
 const recent=all("SELECT n.title,n.created_at FROM notices n WHERE n.audience='all' OR n.audience=? ORDER BY n.id DESC LIMIT 3",u.role);
 const events=all("SELECT e.title,e.start_time,e.location,g.name FROM mobility_events e JOIN mobility_groups g ON g.id=e.group_id "+
 "JOIN group_members gm ON gm.group_id=g.id WHERE gm.user_id=? AND e.start_time>=? "+
 "ORDER BY e.start_time LIMIT 5",u.id,new Date().toISOString().slice(0,16));
 const role=u.role==='student'?'alumnado':'profesorado';
  let out=heading('CURSO '+(activeEdition()?.label||'')+' · ERASMUS+ MMG','¡Hola, '+u.first_name+'!',
   'Tu espacio personal de '+role+' para las movilidades Erasmus+ del IES Manuel Martín González.');
 out+='<div class="stat-grid">'+
  card('Candidaturas',app.length,'En esta convocatoria')+
  card('Grupos asignados',groups.length,'Movilidades confirmadas por coordinación')+
  card('Tareas pendientes',tasks,'Consultar en Agenda')+
  card('Avisos publicados',notices,'Notificaciones para tu perfil')+
 '</div>';
 out+='<div class="hero dashboard-hero"><div><span class="eyebrow">ENRIQUECIENDO VIDAS · ABRIENDO MENTES</span>'+
 '<h2>Europa empieza con una oportunidad.</h2>'+
 '<p>Descubre nuevos destinos, aprende de otras culturas y comparte tu experiencia profesional.</p>'+
 '<div class="actions"><a class="btn light" href="/destinos">Explorar destinos</a>'+
 '<a class="btn outlined" href="/candidatura">Mi candidatura</a></div></div></div>';
 out+='<div class="two">'+panel('Mis candidaturas',
  app.length?app.map(a=>'<div class="dashboard-item"><div><b>'+E(a.mobility==='long'?'Dual-Erasmus+':a.mobility==='short'?'Movilidad corta':'Job Shadowing')+
   '</b><p>'+E(a.edition_label||'Edición anterior')+' · '+E(a.destination)+' · '+E(a.status==='draft'?'Borrador':resultName[a.decision]||'Presentada · pendiente')+'</p></div>'+
  (a.status==='submitted'?'<a href="/documentacion/pdf/candidatura/'+a.id+'">Ficha PDF</a>':'<a href="/candidatura">Continuar</a>')+
  '</div>').join(''):'<p>Aún no has presentado candidaturas. Puedes comenzar cuando la convocatoria esté abierta.</p>'+
  '<p><a href="/candidatura">Abrir candidaturas →</a></p>')+
 panel('Mis grupos y movilidades',
  groups.length?groups.map(g=>'<div class="dashboard-item"><div><b>'+E(g.name)+'</b><p>'+E(g.destination)+'</p></div>'+
  '<a href="/agenda/grupo/'+g.id+'">Agenda</a></div>').join(''):'<p>Los grupos aparecerán cuando coordinación confirme la asignación.</p>'+
  '<p><a href="/agenda">Ver agenda y tareas →</a></p>')+'</div>';
 out+='<div class="two">'+panel('Próximas actividades',
  events.length?events.map(e=>'<div class="dashboard-item"><div><b>'+E(e.title)+'</b>'+
  '<p>'+E(e.name)+' · '+E(e.start_time.replace('T',' '))+(e.location?' · '+E(e.location):'')+'</p></div></div>').join(''):
  '<p>No hay actividades futuras asignadas todavía.</p>'+
  '<p><a href="/agenda">Consultar planificación →</a></p>')+
 panel('Últimos avisos',recent.length?recent.map(n=>
  '<div class="dashboard-item"><div><b>'+E(n.title)+'</b><p>'+E(n.created_at)+'</p></div></div>').join(''):
  '<p>Por ahora no hay nuevas notificaciones.</p>'+
  '<p><a href="/notificaciones">Abrir tablón →</a></p>')+'</div>';
 api.layout(req,'Mi espacio Erasmus+',out);
}
export async function dashboardRoutes(req,url,method,api){
 if(url!=='/panel')return false;
 if(!api.mustLogin(req))return true;
 if(method!=='GET'){api.error(req,405,'Método no permitido.');return true;}
 participantDashboard(req,api);
 return true;
}
