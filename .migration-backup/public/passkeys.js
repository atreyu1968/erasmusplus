// Browser WebAuthn client. Biometrics never leave the user's device.
const enc = bytes => {
 let str='';for(const b of new Uint8Array(bytes))str+=String.fromCharCode(b);
 return btoa(str).replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
};
const dec = str => {
 const base=str.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-str.length%4)%4);
 const raw=atob(base);return Uint8Array.from(raw,c=>c.charCodeAt(0));
};
const status=document.getElementById('passkeyStatus');
function notify(message){if(status)status.textContent=message;else alert(message);}
function csrf(){return document.querySelector('input[name=csrf]')?.value||'';}
async function api(path,data){
 const response=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},
  credentials:'same-origin',body:JSON.stringify({...data,csrf:csrf()})});
 let result;try{result=await response.json();}catch{throw Error('Respuesta del servidor no válida.');}
 if(!response.ok)throw Error(result.error||'Error de verificación');
 return result;
}
function encodeAttestation(cred) {
 const r=cred.response;
 return {id:cred.id,rawId:enc(cred.rawId),type:cred.type,authenticatorAttachment:cred.authenticatorAttachment||undefined,
 response:{clientDataJSON:enc(r.clientDataJSON),attestationObject:enc(r.attestationObject),
  transports:r.getTransports?.()||[]},
 clientExtensionResults:cred.getClientExtensionResults()};
}
function encodeAssertion(cred){
 const r=cred.response;
 return {id:cred.id,rawId:enc(cred.rawId),type:cred.type,
 response:{clientDataJSON:enc(r.clientDataJSON),authenticatorData:enc(r.authenticatorData),
 signature:enc(r.signature),userHandle:r.userHandle?enc(r.userHandle):null},
 clientExtensionResults:cred.getClientExtensionResults()};
}
async function registerPasskey(){
 if(!window.PublicKeyCredential){notify('El navegador no admite WebAuthn.');return;}
 try{
  notify('Abriendo reconocimiento del dispositivo...');
  const {options,attempt}=await api('/passkeys/registro/iniciar',{});
  options.challenge=dec(options.challenge);
  options.user.id=dec(options.user.id);
  for(const key of options.excludeCredentials||[])key.id=dec(key.id);
  const result=await navigator.credentials.create({publicKey:options});
  if(!result)throw Error('Se canceló la creación de la credencial.');
  await api('/passkeys/registro/terminar',{attempt,response:encodeAttestation(result)});
  notify('Passkey vinculada correctamente.');
  location.reload();
 }catch(e){notify(e.message);}
}
async function loginPasskey(){
 if(!window.PublicKeyCredential){notify('El navegador no admite WebAuthn.');return;}
 const username=document.querySelector('input[name=username]')?.value.trim();
 if(!username){notify('Introduce primero tu DNI o CIAL.');return;}
 try{
  const {options,attempt}=await api('/passkeys/acceso/iniciar',{username});
  options.challenge=dec(options.challenge);
  for(const key of options.allowCredentials||[])key.id=dec(key.id);
  const credential=await navigator.credentials.get({publicKey:options});
  if(!credential)throw Error('Se canceló el inicio de sesión.');
  const result=await api('/passkeys/acceso/terminar',{attempt,response:encodeAssertion(credential)});
  location.assign(result.redirect);
 }catch(e){notify(e.message);}
}
document.getElementById('registerPasskey')?.addEventListener('click',registerPasskey);
document.getElementById('loginPasskey')?.addEventListener('click',loginPasskey);
