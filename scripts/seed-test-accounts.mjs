import os from 'node:os';
import path from 'node:path';
import { realpathSync } from 'node:fs';

const dataDirectory=process.env.MMG_DATA_DIR;
if(process.env.MMG_TEST_FIXTURES!=='1'){
  console.error('Activa explícitamente MMG_TEST_FIXTURES=1 para crear cuentas ficticias.');
  process.exit(1);
}
if(process.env.MMG_ENV!=='development'){
  console.error('Las cuentas ficticias solo pueden crearse con MMG_ENV=development.');
  process.exit(1);
}
if(process.env.MMG_ENABLE_REGISTRATION==='1'){
  console.error('Cierra el registro público antes de crear las cuentas ficticias.');
  process.exit(1);
}
if(!dataDirectory){
  console.error('Define MMG_DATA_DIR con una carpeta de base de datos aislada dentro del directorio temporal.');
  process.exit(1);
}

let temporaryRoot,databaseDirectory;
try{
  temporaryRoot=realpathSync(os.tmpdir());
  databaseDirectory=realpathSync(path.resolve(dataDirectory));
}catch{
  console.error('La carpeta MMG_DATA_DIR debe existir y estar aislada dentro del directorio temporal.');
  process.exit(1);
}
const relative=path.relative(temporaryRoot,databaseDirectory);
if(!relative||relative==='..'||relative.startsWith('..'+path.sep)||path.isAbsolute(relative)){
  console.error('Por seguridad, MMG_DATA_DIR debe ser una carpeta propia dentro del directorio temporal.');
  process.exit(1);
}

const {db,get,run}=await import('../src/db.mjs');
const {hashPassword}=await import('../src/auth.mjs');
await import('../src/feature-db.mjs');
const edition=get('SELECT id FROM erasmus_editions WHERE is_active=1');
if(!edition){
  console.error('No hay una convocatoria activa para asignar las cuentas ficticias.');
  process.exit(1);
}
const password='MMG-Aislado-Prueba-2026!';
const fixtures=[
  {role:'teacher',username:'TESTDOCENTE',first:'Docente',last:'Prueba',email:'test-docente@example.invalid'},
  {role:'student',username:'TESTALUMNO',first:'Alumnado',last:'Prueba',email:'test-alumno@example.invalid'}
];

for(const fixture of fixtures){
  const existing=get('SELECT role FROM users WHERE username=?',fixture.username);
  if(existing&&existing.role!==fixture.role){
    console.error('No se puede reutilizar '+fixture.username+': el usuario existente tiene otro perfil.');
    process.exit(1);
  }
}

const passwordHash=await hashPassword(password);
db.exec('BEGIN IMMEDIATE');
try{
  for(const fixture of fixtures){
    run(
      "INSERT INTO users(role,username,pass_hash,first_name,last_name,institutional_email,email_verified_at,status,professional_family,edition_id) "+
      "VALUES (?,?,?,?,?,?,CURRENT_TIMESTAMP,'approved','Administración y gestión',?) "+
      "ON CONFLICT(username) DO UPDATE SET pass_hash=excluded.pass_hash,first_name=excluded.first_name,"+
      "last_name=excluded.last_name,institutional_email=excluded.institutional_email,"+
      "email_verified_at=CURRENT_TIMESTAMP,status='approved',professional_family=excluded.professional_family,edition_id=excluded.edition_id",
      fixture.role,fixture.username,passwordHash,fixture.first,fixture.last,fixture.email,edition.id
    );
  }
  db.exec('COMMIT');
}catch(error){
  db.exec('ROLLBACK');
  throw error;
}

console.log('Cuentas ficticias listas en la base aislada:');
for(const fixture of fixtures)console.log('  '+fixture.role+': '+fixture.username+' / '+password);
