import {
 generateRegistrationOptions,verifyRegistrationResponse,
 generateAuthenticationOptions,verifyAuthenticationResponse
} from '@simplewebauthn/server';
import crypto from 'node:crypto';
import { get,all,run,audit,db } from './db.mjs';
import { newSession } from './auth.mjs';
import {escape as E,heading,panel} from './feature-service.mjs';

db.exec(
 "CREATE TABLE IF NOT EXISTS passkey_credentials ("+
 "id TEXT PRIMARY KEY,user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,"+
 "public_key TEXT NOT NULL,counter INTEGER NOT NULL DEFAULT 0,transports TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP);" +
 "CREATE TABLE IF NOT EXISTS passkey_challenges ("+
 "id TEXT PRIMARY KEY,user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,"+
 "challenge TEXT NOT NULL,purpose TEXT NOT NULL,expires_at INTEGER NOT NULL);" +
 "CREATE INDEX IF NOT EXISTS passkey_by_user ON passkey_credentials(user_id);"
);
function config(req){
 const requestOrigin=String(req.headers.origin||'').trim();
 const origin=String(process.env.MMG_PASSKEY_ORIGIN||requestOrigin).trim();
 let u;
 try{u=new URL(origin);}catch{throw Error('No se pudo validar el origen seguro de WebAuthn.');}
 const rpID=String(process.env.MMG_PASSKEY_RPID||u.hostname).trim();
 if((u.protocol!=='https:' && !(u.hostname==='localhost'&&u.protocol==='http:')) ||
   u.hostname!==rpID || u.pathname!=='/' || u.search || u.hash)
   throw Error('La configuración WebAuthn requiere un dominio y origen HTTPS coincidentes.');
 if(requestOrigin){
  let incoming;
  try{incoming=new URL(requestOrigin);}catch{throw Error('El origen de la solicitud no es válido.');}
  if(incoming.origin!==u.origin)throw Error('La solicitud no procede del origen WebAuthn configurado.');
 }
 return {rpID,origin:u.origin};
}
function respond(req,api,status,obj,headers={}){
 api.raw(req,status,Buffer.from(JSON.stringify(obj)), 'application/json; charset=utf-8',headers);
}
async function bodyJSON(req){
 let size=0,parts=[];
 for await(const b of req){size+=b.length;if(size>120000)throw Error('Solicitud demasiado grande.');parts.push(b);}
 return JSON.parse(Buffer.concat(parts).toString('utf8'));
}
function csrf(req,data,api){
 return api.requireCSRF(req,data);
}
function currentCredentials(id){
 return all('SELECT * FROM passkey_credentials WHERE user_id=?',id);
}
function page(req,api){
 const keys=currentCredentials(req.auth.user.id);
 const html=heading('SEGURIDAD','Acceso biométrico · Passkeys','Vincula una credencial del dispositivo para iniciar sesión con huella, rostro o PIN, según lo permita tu equipo.')+
 panel('Mis credenciales',keys.map(k=>'<p>Credencial registrada el '+E(k.created_at)+
 '<form method="post" action="/passkeys/eliminar"><input type="hidden" name="credential" value="'+E(k.id)+'">'+
 '<input type="hidden" name="csrf" value="'+E(api.csrf(req))+'"><button class="btn small secondary">Eliminar credencial</button></form></p>').join('')||
 '<p>No tienes credenciales vinculadas.</p>')+
 '<div class="card"><h2>Vincular una nueva passkey</h2><p>No almacenamos tus huellas ni tus rasgos faciales. La comprobación biométrica ocurre en el dispositivo.</p>'+
 '<input type="hidden" name="csrf" id="mmg-passkey-csrf" value="'+E(api.csrf(req))+'">'+
 '<button type="button" class="btn" id="registerPasskey">Vincular este dispositivo</button>'+
 '<p id="passkeyStatus" role="status"></p></div>';
 api.layout(req,'Passkeys',html);
}
export async function passkeyRoutes(req,url,method,api){
 const supported=['/passkeys','/passkeys/registro/iniciar','/passkeys/registro/terminar',
  '/passkeys/acceso/iniciar','/passkeys/acceso/terminar','/passkeys/eliminar'];
 if(!supported.includes(url))return false;
 if(url==='/passkeys'&&method==='GET'){
  if(api.mustLogin(req))page(req,api);
  return true;
 }
 if(url==='/passkeys/eliminar'){
  if(!api.mustLogin(req))return true;
  const b=await api.readForm(req);if(!csrf(req,b,api))return true;
  const credential=String(b.credential||'');
  const row=get('SELECT id FROM passkey_credentials WHERE id=? AND user_id=?',credential,req.auth.user.id);
  if(row){run('DELETE FROM passkey_credentials WHERE id=?',credential);audit(req.auth.user.id,'passkey_removed');}
  api.redirect(req,'/passkeys');return true;
 }
 if(method!=='POST'){api.error(req,405,'Método no permitido.');return true;}
 let body;
 try{body=await bodyJSON(req);}catch{respond(req,api,400,{error:'Datos JSON inválidos.'});return true;}
 if(!csrf(req,body,api))return true;
 let conf;
  try{conf=config(req);}catch(e){respond(req,api,503,{error:e.message});return true;}
 try{
 if(url==='/passkeys/registro/iniciar'){
  if(!api.mustLogin(req))return true;
  const u=req.auth.user,creds=currentCredentials(u.id);
  const options=await generateRegistrationOptions({
    rpName:'Movilidades Erasmus+ MMG',rpID:conf.rpID,
    userID:Buffer.from('mmg-'+u.id),
    userName:u.username,userDisplayName:u.first_name+' '+u.last_name,
    attestationType:'none',
    authenticatorSelection:{residentKey:'preferred',userVerification:'required'},
    excludeCredentials:creds.map(c=>({id:c.id,transports:JSON.parse(c.transports||'[]')}))
  });
  const attempt=crypto.randomBytes(24).toString('hex');
  run("INSERT INTO passkey_challenges(id,user_id,challenge,purpose,expires_at) VALUES (?,?,?,'register',?)",
   attempt,u.id,options.challenge,Date.now()+5*60*1000);
  respond(req,api,200,{options,attempt});return true;
 }
 if(url==='/passkeys/registro/terminar'){
  if(!api.mustLogin(req))return true;
  const attempt=String(body.attempt||''),row=get("SELECT * FROM passkey_challenges WHERE id=? AND user_id=? AND purpose='register'",
    attempt,req.auth.user.id);
  if(!row||row.expires_at<Date.now()){respond(req,api,400,{error:'Reto de registro caducado.'});return true;}
  run('DELETE FROM passkey_challenges WHERE id=?',attempt);
  const result=await verifyRegistrationResponse({
    response:body.response,expectedChallenge:row.challenge,expectedOrigin:conf.origin,
    expectedRPID:conf.rpID,requireUserVerification:true
  });
  if(!result.verified||!result.registrationInfo?.credential){respond(req,api,400,{error:'No se pudo verificar la credencial.'});return true;}
  const c=result.registrationInfo.credential;
  run('INSERT INTO passkey_credentials(id,user_id,public_key,counter,transports) VALUES (?,?,?,?,?)',
    c.id,req.auth.user.id,Buffer.from(c.publicKey).toString('base64'),c.counter,JSON.stringify(c.transports||[]));
  audit(req.auth.user.id,'passkey_registered');
  respond(req,api,200,{ok:true});return true;
 }
 if(url==='/passkeys/acceso/iniciar'){
  const username=String(body.username||'').trim().toUpperCase();
  const u=get("SELECT * FROM users WHERE username=? AND status='approved'",username);
  if(!u||currentCredentials(u.id).length===0){respond(req,api,400,{error:'No se puede iniciar sesión con passkey para esta cuenta.'});return true;}
  const creds=currentCredentials(u.id);
  const options=await generateAuthenticationOptions({
   rpID:conf.rpID,userVerification:'required',
   allowCredentials:creds.map(c=>({id:c.id,transports:JSON.parse(c.transports||'[]')}))
  });
  const attempt=crypto.randomBytes(24).toString('hex');
  run("INSERT INTO passkey_challenges(id,user_id,challenge,purpose,expires_at) VALUES (?,?,?,'authenticate',?)",
   attempt,u.id,options.challenge,Date.now()+5*60*1000);
  respond(req,api,200,{options,attempt});return true;
 }
 if(url==='/passkeys/acceso/terminar'){
  const attempt=String(body.attempt||'');
  const row=get("SELECT * FROM passkey_challenges WHERE id=? AND purpose='authenticate'",attempt);
  if(!row||row.expires_at<Date.now()){respond(req,api,400,{error:'Reto de acceso caducado.'});return true;}
  run('DELETE FROM passkey_challenges WHERE id=?',attempt);
  const u=get("SELECT * FROM users WHERE id=? AND status='approved'",row.user_id);
  const c=u&&get('SELECT * FROM passkey_credentials WHERE id=? AND user_id=?',String(body.response?.id||''),u.id);
  if(!c){respond(req,api,403,{error:'Credencial no autorizada.'});return true;}
  if(u.role!=='coordinator'&&!u.email_verified_at){respond(req,api,403,{error:'Correo no verificado.'});return true;}
  const result=await verifyAuthenticationResponse({
   response:body.response,expectedChallenge:row.challenge,expectedOrigin:conf.origin,expectedRPID:conf.rpID,
   credential:{id:c.id,publicKey:Buffer.from(c.public_key,'base64'),counter:c.counter,transports:JSON.parse(c.transports||'[]')},
   requireUserVerification:true
  });
  if(!result.verified){respond(req,api,403,{error:'No se pudo verificar la credencial.'});return true;}
  run('UPDATE passkey_credentials SET counter=? WHERE id=?',result.authenticationInfo.newCounter,c.id);
  audit(u.id,'passkey_login',u.id);
  const cval=newSession(u.id);
  respond(req,api,200,{ok:true,redirect:u.role==='coordinator'?'/coordinacion':'/panel'},{'Set-Cookie':cval});
  return true;
 }
 }catch(e){
  console.error('Passkeys:',e.message);
  respond(req,api,400,{error:'Operación biométrica no completada. Revisa el dispositivo y la configuración HTTPS.'});return true;
 }
 api.error(req,404,'Ruta desconocida.');return true;
}
