import os from 'node:os';
import path from 'node:path';
import { realpathSync, statSync } from 'node:fs';

const reject = message => {
  console.error(message);
  process.exit(1);
};

if (process.env.MMG_TEST_FIXTURES !== '1') {
  reject('Activa explícitamente MMG_TEST_FIXTURES=1 para crear candidaturas ficticias.');
}
if (process.env.MMG_ENV !== 'development') {
  reject('Las candidaturas ficticias solo pueden crearse con MMG_ENV=development.');
}
if (process.env.MMG_ENABLE_REGISTRATION !== '0') {
  reject('Cierra explícitamente el registro con MMG_ENABLE_REGISTRATION=0.');
}

const configuredDirectory = process.env.MMG_DATA_DIR;
if (!configuredDirectory) {
  reject('Define MMG_DATA_DIR con una carpeta mmg-test-* dentro del directorio temporal.');
}

let temporaryRoot, databaseDirectory, databaseFile;
try {
  temporaryRoot = realpathSync(os.tmpdir());
  databaseDirectory = realpathSync(path.resolve(configuredDirectory));
  databaseFile = realpathSync(path.join(databaseDirectory, 'erasmus.sqlite3'));
} catch {
  reject('La carpeta de prueba debe existir y contener la base SQLite inicializada.');
}
const relative = path.relative(temporaryRoot, databaseDirectory);
if (!relative || relative === '..' || relative.startsWith('..' + path.sep) ||
    path.isAbsolute(relative) || !path.basename(databaseDirectory).startsWith('mmg-test-')) {
  reject('Por seguridad, MMG_DATA_DIR debe ser una carpeta propia mmg-test-* dentro del directorio temporal.');
}
if (path.dirname(databaseFile) !== databaseDirectory || statSync(databaseFile).nlink !== 1) {
  reject('La base de prueba no puede ser un enlace ni compartir el archivo SQLite con otra ubicación.');
}

const { db, get, run, audit } = await import('../src/db.mjs');
const { paper, safeDocument, deleteDocument } = await import('../src/feature-service.mjs');
const { digest } = await import('../src/pdf.mjs');

const participants = {
  student: get("SELECT * FROM users WHERE username='TESTALUMNO'"),
  teacher: get("SELECT * FROM users WHERE username='TESTDOCENTE'")
};
for (const [role, username] of [['student', 'TESTALUMNO'], ['teacher', 'TESTDOCENTE']]) {
  const user = participants[role];
  if (!user || user.role !== role || user.status !== 'approved' ||
      !user.institutional_email.endsWith('.invalid')) {
    reject('No se encuentra la cuenta ficticia aprobada '+username+'. Ejecuta antes npm run seed-test-accounts en esta misma base aislada.');
  }
}

const cases = [
  {
    role: 'student',
    mobility: 'long',
    family: 'Administración y gestión',
    destination: 'Oporto',
    mec: 'No',
    motivation: 'CASO FICTICIO: quiero ampliar mi formación administrativa mediante prácticas internacionales en Oporto y mejorar mi comunicación profesional.'
  },
  {
    role: 'student',
    mobility: 'short',
    family: 'Imagen personal',
    destination: 'Róterdam',
    mec: 'Sí',
    motivation: 'CASO FICTICIO: quiero conocer nuevas técnicas de imagen personal y compartir lo aprendido con mi grupo al regresar.'
  },
  {
    role: 'teacher',
    mobility: 'short',
    family: 'Administración y gestión',
    destination: 'Róterdam',
    mec: 'No procede',
    motivation: 'CASO FICTICIO: quiero observar prácticas de orientación profesional y adaptar actividades útiles para el aula.'
  },
  {
    role: 'teacher',
    mobility: 'shadowing',
    family: 'Agraria',
    destination: 'Viseu',
    mec: 'No procede',
    motivation: 'CASO FICTICIO: quiero realizar observación profesional para mejorar la coordinación de prácticas del alumnado.'
  }
];
const modeNames = {
  short: 'Movilidad corta',
  long: 'Movilidad larga Dual-Erasmus+',
  shadowing: 'Job Shadowing'
};

const planned = [];
for (const scenario of cases) {
  const user = participants[scenario.role];
  const existing = get('SELECT * FROM applications WHERE user_id=? AND mobility=?',
    user.id, scenario.mobility);
  if (!existing) {
    planned.push({ ...scenario, user, existing: false });
    continue;
  }
  const matches = existing.status === 'submitted' &&
    existing.family === scenario.family &&
    existing.destination === scenario.destination &&
    existing.motivation === scenario.motivation &&
    existing.mec === scenario.mec &&
    existing.pdf_file && existing.pdf_sha256;
  if (!matches) {
    reject('Conflicto con una candidatura existente de '+user.username+
      ' ('+scenario.mobility+'). No se sobrescriben datos ni valoraciones; usa una base mmg-test-* nueva.');
  }
  try {
    if (digest(safeDocument(existing.pdf_file)) !== existing.pdf_sha256) {
      reject('El PDF de una candidatura ficticia existente no coincide con su huella. No se han cambiado datos.');
    }
  } catch {
    reject('No se puede verificar el PDF de una candidatura ficticia existente. No se han cambiado datos.');
  }
  planned.push({ ...scenario, user, existing: true });
}

const generatedDocuments = [];
db.exec('BEGIN IMMEDIATE');
try {
  for (const scenario of planned.filter(item => !item.existing)) {
    const document = paper('Ficha de candidatura Erasmus+ MMG', [
      ['Participante', scenario.user.first_name+' '+scenario.user.last_name],
      ['Usuario', scenario.user.username],
      ['Perfil', scenario.role === 'student' ? 'Alumnado' : 'Docente'],
      ['Tipo de movilidad', modeNames[scenario.mobility]],
      ['Familia profesional', scenario.family],
      ['Destino solicitado', scenario.destination],
      ['Postulación personal', scenario.motivation],
      ['Beca MEC', scenario.mec],
      ['Fecha de entrega', new Date().toISOString()],
      ['Curso', '2026-2027']
    ], 'Documento ficticio generado exclusivamente para pruebas en una base temporal aislada.');
    generatedDocuments.push(document.name);
    const result = run(
      "INSERT INTO applications(user_id,mobility,family,destination,motivation,mec,status,submitted_at,pdf_file,pdf_sha256) "+
      "VALUES (?,?,?,?,?,?,'submitted',CURRENT_TIMESTAMP,?,?)",
      scenario.user.id, scenario.mobility, scenario.family, scenario.destination,
      scenario.motivation, scenario.mec, document.name, document.hash
    );
    audit(scenario.user.id, 'candidature_submitted', Number(result.lastInsertRowid));
  }
  db.exec('COMMIT');
} catch (error) {
  db.exec('ROLLBACK');
  for (const document of generatedDocuments) {
    try { deleteDocument(document); } catch {}
  }
  console.error('No se pudieron crear las candidaturas ficticias; la transacción se revirtió.');
  throw error;
}

console.log('Candidaturas ficticias listas en la base temporal aislada:');
for (const scenario of planned) {
  console.log('  '+(scenario.existing ? 'conservada' : 'creada')+': '+
    (scenario.role === 'student' ? 'alumnado' : 'docente')+' · '+
    modeNames[scenario.mobility]+' · '+scenario.destination);
}
console.log('Coordinación puede revisarlas en /coordinacion/candidaturas.');
