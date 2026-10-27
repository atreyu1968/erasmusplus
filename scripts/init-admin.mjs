import { get,run,audit } from '../src/db.mjs';
import { hashPassword } from '../src/auth.mjs';

const username=String(process.env.MMG_ADMIN_USERNAME||'').trim().toUpperCase();
const email=String(process.env.MMG_ADMIN_EMAIL||'').trim().toLowerCase();
const password=String(process.env.MMG_ADMIN_PASSWORD||'');
if (!username || !email || password.length<16) {
  console.error('Define MMG_ADMIN_USERNAME, MMG_ADMIN_EMAIL y MMG_ADMIN_PASSWORD (al menos 16 caracteres).');
  process.exit(1);
}
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error('El correo del coordinador no parece válido.');
  process.exit(1);
}
const existing=get("SELECT id FROM users WHERE role='coordinator' LIMIT 1");
if (existing) {console.error('Ya existe una cuenta de coordinación. No se crea otra.');process.exit(1);}
const hashed=await hashPassword(password);
const result=run(
 "INSERT INTO users(role,username,pass_hash,first_name,last_name,institutional_email,email_verified_at,status) VALUES ('coordinator',?,?,?, ?,?,CURRENT_TIMESTAMP,'approved')",
 username,hashed,'Coordinación','Erasmus+ MMG',email);
audit(Number(result.lastInsertRowid),'coordinator_created',Number(result.lastInsertRowid));
console.log('Cuenta inicial de coordinación creada. Borra las variables MMG_ADMIN_* del entorno tras el alta.');
