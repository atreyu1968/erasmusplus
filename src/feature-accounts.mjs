import crypto from 'node:crypto';
import { get,run,audit,all } from './db.mjs';
import { hashPassword } from './auth.mjs';
import { sendMail,publicUrl,settings } from './mailer.mjs';
import {escape as E,clean,heading,panel,input,formEnd,validId,schoolFamilies,select,queueMail } from './feature-service.mjs';

function userPage(req,api,notice=''){
 const u=req.auth.user;
 const age=u.birth_date?Math.max(0,new Date().getUTCFullYear()-Number(u.birth_date.slice(0,4))-
  (new Date().toISOString().slice(5,10)<u.birth_date.slice(5,10)?1:0)):'No consta';
 let html=heading('MI CUENTA','Mi perfil','Datos personales y académicos del registro Erasmus+.');
 if(notice)html+=panel('Resultado','<p>'+E(notice)+'</p>');
 html+=panel('Datos personales','<p><b>Nombre:</b> '+E(u.first_name+' '+u.last_name)+'</p>'+
 '<p><b>Edad:</b> '+E(age)+'</p><p><b>Correo institucional:</b> '+E(u.institutional_email)+'</p>'+
 '<p><b>Identificador de usuario:</b> '+E(u.username)+'</p>');
 html+='<form class="card form" method="post" action="/perfil"><h2>Actualizar datos de contacto y académicos</h2>'+
 '<label>Teléfono'+input('phone',u.phone||'','tel',45)+'</label>'+
 (u.role==='student'?'<label>Teléfono familiar'+input('guardian_phone',u.guardian_phone||'','tel',45)+'</label>'+
 '<label>Correo Gmail'+input('gmail',u.gmail||'','email',180)+'</label>':'')+
 '<label>Centro'+input('center',u.center||'')+'</label>'+
 (u.role==='student'?'<label>Estudios'+input('studies',u.studies||'')+'</label>':
 '<label>Módulos y cursos'+input('modules',u.modules||'')+'</label>')+
 formEnd(api.csrf(req),'Guardar cambios');
 html+=panel('Seguridad','<p>Para cambiar la contraseña o recuperar el acceso, utiliza el enlace de recuperación enviado al correo institucional verificado.</p>'+
 '<a href="/recuperar">Restablecer contraseña</a>');
 api.layout(req,'Mi perfil',html);
}
function updateProfile(req,b,api){
 const u=req.auth.user,phone=clean(b.phone,45),guardian=clean(b.guardian_phone,45),gmail=clean(b.gmail,180),
   center=clean(b.center),studies=clean(b.studies),modules=clean(b.modules);
 if(!phone||!center){userPage(req,api,'El teléfono y centro son obligatorios.');return;}
 run('UPDATE users SET phone=?,guardian_phone=?,gmail=?,center=?,studies=?,modules=? WHERE id=?',
 phone,u.role==='student'?guardian:u.guardian_phone,u.role==='student'?gmail:u.gmail,center,
 u.role==='student'?studies:u.studies,u.role==='teacher'?modules:u.modules,u.id);
 audit(u.id,'profile_updated',u.id);
 req.auth.user=get('SELECT * FROM users WHERE id=?',u.id);
 userPage(req,api,'Datos actualizados correctamente.');
}
function adminEdit(req,api,id,notice=''){
 const u=get("SELECT * FROM users WHERE id=? AND role!='coordinator'",id);
 if(!u){api.error(req,404,'Cuenta no encontrada.');return;}
 let output=heading('COORDINACIÓN','Editar ficha de usuario','Rectifica datos personales o académicos y conserva la trazabilidad de los cambios.');
 if(notice)output+=panel('Resultado','<p>'+E(notice)+'</p>');
 output+='<form method="post" action="/coordinacion/editar/'+u.id+'" class="card form">'+
 '<label>Nombre'+input('first_name',u.first_name)+'</label>'+
 '<label>Apellidos'+input('last_name',u.last_name)+'</label>'+
 '<label>Fecha de nacimiento'+input('birth_date',u.birth_date||'','date')+'</label>'+
 '<label>DNI'+input('dni',u.dni||'')+'</label>'+
 '<label>CIAL'+input('cial',u.cial||'')+'</label>'+
 '<label>Teléfono'+input('phone',u.phone||'','tel')+'</label>'+
 '<label>Teléfono familiar'+input('guardian_phone',u.guardian_phone||'','tel')+'</label>'+
 '<label>Correo institucional'+input('institutional_email',u.institutional_email,'email')+'</label>'+
 '<label>Correo alternativo'+input('gmail',u.gmail||'','email')+'</label>'+
 '<label>Familia profesional'+select('professional_family',schoolFamilies,u.professional_family)+'</label>'+
 '<label>Centro'+input('center',u.center||'')+'</label>'+
 '<label>Estudios'+input('studies',u.studies||'')+'</label>'+
 '<label>Módulos y cursos'+input('modules',u.modules||'')+'</label>'+
 '<div class="notice-box">Si modificas el correo institucional, su verificación y la aprobación de la cuenta quedarán pendientes hasta que el usuario confirme el nuevo correo.</div>'+
 formEnd(api.csrf(req),'Guardar modificaciones');
 output+=panel('Gestión de bajas',
 '<p>Para proteger el historial administrativo, la baja desactiva la cuenta y anonimiza los campos personales a petición del responsable, previa comprobación de los plazos legales de conservación.</p>'+
 '<form action="/coordinacion/anonimizar/'+u.id+'" method="post"><label class="checkbox"><input type="checkbox" name="confirm" value="yes" required> He comprobado los requisitos de conservación y autorizo la anonimización irreversible.</label>'+
 formEnd(api.csrf(req),'Anonimizar cuenta'));
 api.layout(req,'Editar ficha de usuario',output);
}
function saveAdminEdit(req,api,id,b){
 const u=get("SELECT * FROM users WHERE id=? AND role!='coordinator'",id);
 if(!u){api.error(req,404,'Cuenta no encontrada.');return;}
 const first=clean(b.first_name,100),last=clean(b.last_name,150),email=clean(b.institutional_email,200).toLowerCase(),
   dni=clean(b.dni,30).toUpperCase(),cial=clean(b.cial,30).toUpperCase(),date=clean(b.birth_date,10);
 const username=u.role==='teacher'?dni:cial;
 if(!first||!last||!username||!email.endsWith('@canariaseducacion.es')||
   (date&&!/^\d{4}-\d{2}-\d{2}$/.test(date))){
  adminEdit(req,api,id,'Revisa el nombre, identificador, fecha y correo institucional.');return;
 }
 const dup=get('SELECT id FROM users WHERE (username=? OR institutional_email=?) AND id!=?',username,email,id);
 if(dup){adminEdit(req,api,id,'Ya existe otra cuenta con ese usuario o correo.');return;}
 const changed=email!==u.institutional_email;
 run("UPDATE users SET first_name=?,last_name=?,birth_date=?,dni=?,cial=?,username=?,phone=?,guardian_phone=?,institutional_email=?,gmail=?,professional_family=?,center=?,studies=?,modules=?,email_verified_at=CASE WHEN ? THEN NULL ELSE email_verified_at END,status=CASE WHEN ? THEN 'pending' ELSE status END WHERE id=?",
 first,last,date,dni,cial,username,clean(b.phone,45),clean(b.guardian_phone,45),email,clean(b.gmail,200),
 schoolFamilies.includes(b.professional_family)?b.professional_family:u.professional_family,
 clean(b.center,200),clean(b.studies,200),clean(b.modules,400),
 changed?1:0,changed?1:0,id);
 if(changed)run('DELETE FROM sessions WHERE user_id=?',id);
 audit(req.auth.user.id,'admin_user_profile_updated',id);
 adminEdit(req,api,id,changed?'Datos guardados. El correo modificado deberá verificarse de nuevo y la cuenta queda pendiente; utiliza el procedimiento de reenvío.':'Ficha actualizada.');
}
function anonymize(req,api,id,b){
 if(b.confirm!=='yes'){adminEdit(req,api,id,'No se ha confirmado la baja.');return;}
 const u=get("SELECT * FROM users WHERE id=? AND role!='coordinator'",id);
 if(!u){api.error(req,404,'Usuario no encontrado.');return;}
 run("UPDATE users SET first_name='Cuenta',last_name='Anonimizada',birth_date=NULL,dni=NULL,cial=NULL,phone=NULL,guardian_phone=NULL,institutional_email=?,gmail=NULL,professional_family=NULL,center=NULL,studies=NULL,modules=NULL,username=?,status='disabled',pass_hash=?,email_verified_at=NULL WHERE id=?",
 'anonimizada-'+id+'@invalid.local','BAJA-'+id,crypto.randomBytes(40).toString('hex'),id);
 run('DELETE FROM sessions WHERE user_id=?',id);
 audit(req.auth.user.id,'admin_account_anonymised',id);
 api.redirect(req,'/coordinacion');
}
function recoverPage(req,api,notice=''){
 api.layout(req,'Recuperar acceso',heading('SEGURIDAD','Restablecer contraseña','Si existe una cuenta con ese identificador y correo verificado, enviaremos instrucciones.')+
 (notice?panel('Información','<p>'+E(notice)+'</p>'):'')+
 '<form class="card form" method="post" action="/recuperar"><label>DNI o CIAL'+input('username')+'</label>'+
 formEnd(api.csrf(req),'Solicitar enlace'),{publicPage:true});
}
async function recover(req,api,b){
 const key=clean(b.username,40).toUpperCase();
 const generic='Si los datos corresponden a una cuenta verificada, recibirás un mensaje en su correo institucional.';
 const u=get("SELECT * FROM users WHERE username=? AND email_verified_at IS NOT NULL AND status!='disabled'",key);
 if(u){
  const token=crypto.randomBytes(32).toString('hex'),hashed=crypto.createHash('sha256').update(token).digest('hex');
  run('DELETE FROM password_reset_tokens WHERE user_id=?',u.id);
  run('INSERT INTO password_reset_tokens(token_hash,user_id,expires_at) VALUES (?,?,?)',hashed,u.id,Date.now()+30*60*1000);
  try{await sendMail(u.institutional_email,'Restablecimiento de contraseña · Erasmus+ MMG',
    'Se ha solicitado restablecer el acceso a Movilidades Erasmus+ MMG. Enlace válido 30 minutos:\n'+publicUrl()+'/restablecer?token='+token+
    '\nSi no reconoces esta solicitud, ignora este mensaje.');}catch(e){console.error('Recuperación: no se pudo enviar el correo:',e.message);}
 }
 recoverPage(req,api,generic);
}
function resetPage(req,api,token,notice=''){
 api.layout(req,'Nueva contraseña',heading('SEGURIDAD','Nueva contraseña','El enlace de recuperación caduca a los 30 minutos y es de un solo uso.')+
 (notice?panel('Información',E(notice)):'')+
 '<form class="card form" action="/restablecer" method="post"><input name="token" type="hidden" value="'+E(token)+'">'+
 '<label>Nueva contraseña'+input('password','','password',128)+'</label>'+
 '<label>Repetir contraseña'+input('password_again','','password',128)+'</label>'+
 formEnd(api.csrf(req),'Guardar nueva contraseña'),{publicPage:true});
}
async function reset(req,api,b){
 const token=clean(b.token,100),pass=String(b.password||'');
 if(!/^[a-f0-9]{64}$/.test(token)||pass.length<12||pass.length>128||pass!==b.password_again){
  resetPage(req,api,token,'Datos incorrectos o contraseña demasiado corta.');return;
 }
 const h=crypto.createHash('sha256').update(token).digest('hex');
 const entry=get('SELECT user_id,expires_at FROM password_reset_tokens WHERE token_hash=?',h);
 if(!entry||entry.expires_at<Date.now()){resetPage(req,api,'','Enlace caducado o no válido. Solicita uno nuevo.');return;}
 const hash=await hashPassword(pass);
 run('UPDATE users SET pass_hash=? WHERE id=?',hash,entry.user_id);
 run('DELETE FROM password_reset_tokens WHERE user_id=?',entry.user_id);
 run('DELETE FROM sessions WHERE user_id=?',entry.user_id);
 audit(entry.user_id,'password_reset',entry.user_id);
 api.layout(req,'Contraseña actualizada',panel('Contraseña actualizada',
 '<p>Ya puedes iniciar sesión con la nueva contraseña.</p><a class="btn" href="/acceso">Ir al acceso</a>'),{publicPage:true});
}

function createAccountPage(req,api,notice=''){
 if(!api.mustAdmin(req))return;
 let html=heading('COORDINACIÓN','Añadir cuenta manualmente','Una cuenta añadida por coordinación también debe confirmar su correo institucional y pasar la validación.');
 if(notice)html+=panel('Resultado',E(notice));
 html+='<form method="post" action="/coordinacion/crear-cuenta" class="card form">'+
 '<label>Perfil'+select('role',['teacher','student'])+'</label>'+
 '<label>Nombre'+input('first_name')+'</label>'+
 '<label>Apellidos'+input('last_name')+'</label>'+
 '<label>Fecha de nacimiento'+input('birth_date','','date',10)+'</label>'+
 '<label>Teléfono familiar (si es menor)'+input('guardian_phone','','tel',45)+'</label>'+
 '<label>DNI docente'+input('dni')+'</label>'+
 '<label>CIAL alumnado'+input('cial')+'</label>'+
 '<label>Correo institucional'+input('institutional_email','','email')+'</label>'+
 '<label>Teléfono'+input('phone','','tel')+'</label>'+
 '<label>Centro'+input('center','IES Manuel Martín González')+'</label>'+
 '<label>Familia profesional'+select('professional_family',schoolFamilies)+'</label>'+
 '<p>El usuario establecerá su contraseña mediante la recuperación de acceso, después de verificar su correo.</p>'+
 formEnd(api.csrf(req),'Crear cuenta pendiente');
 api.layout(req,'Añadir cuenta',html);
}
function createAccount(req,api,b){
 const role=clean(b.role),first=clean(b.first_name,100),last=clean(b.last_name,150),
  email=clean(b.institutional_email,200).toLowerCase(),dni=clean(b.dni,30).toUpperCase(),cial=clean(b.cial,30).toUpperCase(),
  username=role==='teacher'?dni:cial,
  dob=clean(b.birth_date,10),age=ageOnRegistration(dob),guardian=clean(b.guardian_phone,45);
 if(!['teacher','student'].includes(role)||!first||!last||!username||!email.endsWith('@canariaseducacion.es')||
  age===null||age<12||age>100||(role==='teacher'&&age<18)||(age<18&&!guardian)||!privacyReady()||!settings().configured){
  createAccountPage(req,api,'La cuenta exige datos válidos, privacidad aprobada y Resend configurado.');return;
 }
 if(get('SELECT id FROM users WHERE username=? OR institutional_email=?',username,email)){
  createAccountPage(req,api,'Ya hay una cuenta con ese identificador o correo.');return;
 }
 const id=Number(run("INSERT INTO users(role,username,pass_hash,first_name,last_name,dni,cial,phone,guardian_phone,birth_date,institutional_email,center,professional_family,privacy_version,status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,'pending')",
  role,username,'disabled-'+crypto.randomBytes(30).toString('hex'),first,last,dni,cial,clean(b.phone,45),guardian,dob,email,
  clean(b.center,200),schoolFamilies.includes(b.professional_family)?b.professional_family:null,
  process.env.MMG_PRIVACY_VERSION).lastInsertRowid);
 const token=crypto.randomBytes(32).toString('hex');
 run('INSERT INTO verification_tokens(token_hash,user_id,expires_at) VALUES (?,?,?)',
  crypto.createHash('sha256').update(token).digest('hex'),id,Date.now()+24*3600*1000);
 queueMail(email,'Confirma tu alta en Movilidades Erasmus+ MMG',
  'Coordinación ha creado una solicitud de cuenta Erasmus+ MMG. Confirma el correo desde este enlace (24 horas): '+
  publicUrl()+'/verificar?token='+token+
  '\nCuando lo hayas confirmado, recibirás las indicaciones de aceptación de privacidad o autorización del representante. Tras la revisión, utiliza Recuperar acceso para crear tu contraseña.');
 audit(req.auth.user.id,'admin_account_created',id);
 createAccountPage(req,api,'Cuenta creada. El correo de verificación se ha incorporado a la cola de Resend.');
}

export async function accountRoutes(req,url,method,api){
 const edit=/^\/coordinacion\/editar\/(\d+)$/.exec(url),anon=/^\/coordinacion\/anonimizar\/(\d+)$/.exec(url);
 if(!['/perfil','/recuperar','/restablecer','/coordinacion/crear-cuenta'].includes(url)&&!edit&&!anon)return false;
 if(url==='/recuperar'){
  if(method==='GET')recoverPage(req,api);else {const b=await api.readForm(req);if(api.requireCSRF(req,b))await recover(req,api,b);}
  return true;
 }
 if(url==='/restablecer'){
  if(method==='GET')resetPage(req,api,new URL(req.url,'http://localhost').searchParams.get('token')||'');
  else {const b=await api.readForm(req);if(api.requireCSRF(req,b))await reset(req,api,b);}
  return true;
 }
 if(!api.mustLogin(req))return true;
 if(url==='/coordinacion/crear-cuenta'){
  if(!api.mustAdmin(req))return true;
  if(method==='GET')createAccountPage(req,api);
  else {const b=await api.readForm(req);if(api.requireCSRF(req,b))createAccount(req,api,b);}
  return true;
 }
 if(url==='/perfil'){
  if(method==='GET')userPage(req,api);
  else {const b=await api.readForm(req);if(api.requireCSRF(req,b))updateProfile(req,b,api);}
  return true;
 }
 if(!api.mustAdmin(req))return true;
 const id=Number((edit||anon)[1]);
 if(!validId(id)){api.error(req,400,'Identificador incorrecto.');return true;}
 if(method==='GET'&&edit){adminEdit(req,api,id);return true;}
 if(method==='POST'&&edit){
  const b=await api.readForm(req);if(api.requireCSRF(req,b))saveAdminEdit(req,api,id,b);return true;
 }
 if(method==='POST'&&anon){
  const b=await api.readForm(req);if(api.requireCSRF(req,b))anonymize(req,api,id,b);return true;
 }
 api.error(req,405,'Método no permitido.');return true;
}
