import crypto from 'node:crypto';
import { promisify } from 'node:util';
import { get, run } from './db.mjs';

const scrypt = promisify(crypto.scrypt);
export const production = process.env.MMG_ENV === 'production';
const secret = process.env.MMG_SECRET || 'INSECURE_LOCAL_DEVELOPMENT_ONLY';
if (production && secret.length < 48) throw new Error('Configura MMG_SECRET con al menos 48 caracteres.');
if (production && process.env.MMG_SECURE_COOKIE !== '1') throw new Error('Se requiere MMG_SECURE_COOKIE=1 en producción.');
const H = x => crypto.createHmac('sha256', secret).update(x).digest('hex');
const secure = process.env.MMG_SECURE_COOKIE === '1' ? '; Secure' : '';
export const cookie = (name, value, seconds = 8*3600) =>
  name + '=' + encodeURIComponent(value) + '; Path=/; HttpOnly; SameSite=Lax; Max-Age=' + seconds + secure;

export async function hashPassword(password) {
  const salt = crypto.randomBytes(24).toString('hex');
  const bytes = await scrypt(password, salt, 64, { N:16384, r:8, p:1, maxmem:32*1024*1024 });
  return salt + ':' + bytes.toString('hex');
}
export async function verifyPassword(password, stored) {
  try {
    const [salt, hex] = stored.split(':');
    const actual = await scrypt(password, salt, 64, { N:16384, r:8, p:1, maxmem:32*1024*1024 });
    const expected = Buffer.from(hex, 'hex');
    return expected.length === actual.length && crypto.timingSafeEqual(actual, expected);
  } catch { return false; }
}
export function cookies(req) {
  const result = {};
  for (const segment of (req.headers.cookie || '').split(';')) {
    const pos = segment.indexOf('=');
    if (pos < 1) continue;
    const k = segment.slice(0,pos).trim();
    try { result[k] = decodeURIComponent(segment.slice(pos+1).trim()); } catch {}
  }
  return result;
}
export function signedCsrf(req) {
  if (req._signedCsrf) return req._signedCsrf;
  const raw = cookies(req).mmg_csrf || '';
  const [token,signature] = raw.split('.');
  if (token && signature && /^[a-f0-9]{48}$/.test(token) && H(token) === signature)
    return (req._signedCsrf = { token });
  const next = crypto.randomBytes(24).toString('hex');
  return (req._signedCsrf = { token:next, setCookie:cookie('mmg_csrf', next + '.' + H(next), 3600) });
}
export function authFromRequest(req) {
  const raw = cookies(req).mmg_session;
  if (!raw || !/^[a-f0-9]{64}$/.test(raw)) return null;
  const tokenHash = crypto.createHash('sha256').update(raw).digest('hex');
  const row = get('SELECT s.csrf,s.expires_at,u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=?',tokenHash);
  return row && row.status === 'approved' && row.expires_at > Date.now()
    ? { token:raw, user:row, csrf:row.csrf } : null;
}
export function csrfToken(req) {
  return req.auth ? { token:req.auth.csrf } : signedCsrf(req);
}
export function validCsrf(req, body) {
  const submitted = String(body.csrf || '');
  const expected = csrfToken(req).token;
  return submitted.length === expected.length && submitted.length > 0 &&
    crypto.timingSafeEqual(Buffer.from(submitted), Buffer.from(expected));
}
export function newSession(id) {
  return newSessionData(id).cookie;
}
export function newSessionData(id) {
  const token = crypto.randomBytes(32).toString('hex');
  const csrf = crypto.randomBytes(24).toString('hex');
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  run('INSERT INTO sessions(token_hash,user_id,csrf,expires_at) VALUES (?,?,?,?)',
    hash,id,csrf,Date.now()+8*3600*1000);
  return { token, csrf, cookie:cookie('mmg_session',token) };
}
export function deleteSession(auth) {
  if (auth) run('DELETE FROM sessions WHERE token_hash=?',
    crypto.createHash('sha256').update(auth.token).digest('hex'));
}
const tries = new Map();
export function canTry(key) {
  const entry=tries.get(key);
  return !entry || entry.reset < Date.now() || entry.count < 8;
}
export function countTry(key, success) {
  if (success) { tries.delete(key); return; }
  let entry=tries.get(key);
  if (!entry || entry.reset < Date.now()) entry={count:0,reset:Date.now()+15*60000};
  entry.count++;
  tries.set(key,entry);
  if (tries.size > 5000) {
    for (const [k,entry] of tries) if (entry.reset < Date.now()) tries.delete(k);
  }
}
