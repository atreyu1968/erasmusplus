import crypto from 'node:crypto';
import { get,run } from './db.mjs';

function masterKey() {
  const secret = process.env.MMG_SECRET || '';
  if (secret.length < 48) throw new Error('Se requiere MMG_SECRET de al menos 48 caracteres para guardar Resend.');
  return crypto.createHash('sha256').update('MMG:RESEND:v1:' + secret).digest();
}
function encrypt(plain) {
  const iv=crypto.randomBytes(12);
  const cipher=crypto.createCipheriv('aes-256-gcm',masterKey(),iv);
  const ciphertext=Buffer.concat([cipher.update(plain,'utf8'),cipher.final()]);
  return Buffer.concat([iv,cipher.getAuthTag(),ciphertext]).toString('base64');
}
function decrypt(encoded) {
  const bytes=Buffer.from(encoded,'base64'),iv=bytes.subarray(0,12),tag=bytes.subarray(12,28),ct=bytes.subarray(28);
  const decipher=crypto.createDecipheriv('aes-256-gcm',masterKey(),iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct),decipher.final()]).toString('utf8');
}
function readConfig(k) {
  const row=get('SELECT encrypted_value FROM configuration WHERE name=?',k);
  if (!row) return '';
  return decrypt(row.encrypted_value);
}
function saveConfig(k,value) {
  run("INSERT INTO configuration(name,encrypted_value,updated_at) VALUES (?,?,CURRENT_TIMESTAMP) ON CONFLICT(name) DO UPDATE SET encrypted_value=excluded.encrypted_value,updated_at=CURRENT_TIMESTAMP",k,encrypt(value));
}
export function readSecureConfig(k) {
  return readConfig(k);
}
export function saveSecureConfig(k,value) {
  saveConfig(k,value);
}
export function settings() {
  return {
    configured:Boolean(readConfig('resend_api_key') && readConfig('from_email') && readConfig('public_url')),
    from:readConfig('from_email'),
    publicUrl:readConfig('public_url'),
    maskedKey:readConfig('resend_api_key') ? '•••••••• configurada' : 'No configurada'
  };
}
export function configureResend({apiKey,from,publicUrl}) {
  if (apiKey && !/^re_[A-Za-z0-9_-]{8,}$/.test(apiKey)) throw Error('Clave API de Resend no válida.');
  if (!/^[^<>\r\n\s@]+@[^<>\r\n\s@]+\.[^<>\r\n\s@]+$/.test(from)) throw Error('Introduce una dirección de envío válida.');
  let url;
  try {url=new URL(publicUrl);} catch {throw Error('La URL pública no es válida.');}
  if (url.protocol!=='https:' && !(process.env.MMG_ENV!=='production' && url.origin==='http://127.0.0.1:3000')) throw Error('La URL pública debe utilizar HTTPS.');
  if (url.username||url.password||url.pathname!=='/'||url.search||url.hash) throw Error('Escribe solo el origen de la aplicación, sin rutas.');
  if (!apiKey && !readConfig('resend_api_key')) throw Error('Debes introducir la clave Resend para la primera configuración.');
  if (apiKey) saveConfig('resend_api_key',apiKey);
  saveConfig('from_email',from);
  saveConfig('public_url',url.origin);
}
export async function sendMail(to,subject,text) {
  const apiKey=readConfig('resend_api_key'),from=readConfig('from_email');
  if (!apiKey||!from) throw Error('Configura Resend en el panel de coordinación.');
  const response=await fetch('https://api.resend.com/emails',{
    method:'POST',
    headers:{Authorization:'Bearer '+apiKey,'Content-Type':'application/json'},
    body:JSON.stringify({from,to:[to],subject,text}),
    signal:AbortSignal.timeout(12000)
  });
  if (!response.ok) throw Error('Resend rechazó el envío ('+response.status+'). Comprueba dominio, clave y remitente.');
}
export function publicUrl() {return readConfig('public_url');}
