import { db } from './db.mjs';

db.exec(
  "CREATE TABLE IF NOT EXISTS erasmus_editions ("+
  "id INTEGER PRIMARY KEY,label TEXT NOT NULL COLLATE NOCASE UNIQUE,"+
  "is_active INTEGER NOT NULL DEFAULT 0 CHECK(is_active IN (0,1)),"+
  "created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);" +
  "CREATE UNIQUE INDEX IF NOT EXISTS one_active_erasmus_edition ON erasmus_editions(is_active) WHERE is_active=1;" +
  "CREATE TABLE IF NOT EXISTS erasmus_destinations ("+
  "id INTEGER PRIMARY KEY,edition_id INTEGER NOT NULL REFERENCES erasmus_editions(id),"+
  "name TEXT NOT NULL COLLATE NOCASE,country TEXT NOT NULL,description TEXT NOT NULL DEFAULT '',"+
  "image_url TEXT NOT NULL DEFAULT '',image_alt TEXT NOT NULL DEFAULT '',image_credit TEXT NOT NULL DEFAULT '',"+
  "image_source_url TEXT NOT NULL DEFAULT '',image_license_name TEXT NOT NULL DEFAULT '',image_license_url TEXT NOT NULL DEFAULT '',image_note TEXT NOT NULL DEFAULT '',"+
  "is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0,1)),"+
  "created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,"+
  "UNIQUE(edition_id,name));" +
  "CREATE INDEX IF NOT EXISTS erasmus_destinations_edition ON erasmus_destinations(edition_id,is_active,name);" +
  "CREATE TABLE IF NOT EXISTS erasmus_destination_modes ("+
  "destination_id INTEGER NOT NULL REFERENCES erasmus_destinations(id) ON DELETE CASCADE,"+
  "mobility TEXT NOT NULL CHECK(mobility IN ('short','long','shadowing')),"+
  "PRIMARY KEY(destination_id,mobility));" +
  "CREATE TABLE IF NOT EXISTS erasmus_destination_families ("+
  "destination_id INTEGER NOT NULL REFERENCES erasmus_destinations(id) ON DELETE CASCADE,"+
  "family TEXT NOT NULL,PRIMARY KEY(destination_id,family));" +
  "CREATE TABLE IF NOT EXISTS app_migrations (name TEXT PRIMARY KEY,applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);"
);

db.exec(
  "CREATE TABLE IF NOT EXISTS applications ("+
  "id INTEGER PRIMARY KEY,user_id INTEGER NOT NULL REFERENCES users(id),edition_id INTEGER REFERENCES erasmus_editions(id),"+
  "mobility TEXT NOT NULL CHECK(mobility IN ('short','long','shadowing')),"+
  "family TEXT NOT NULL,destination TEXT NOT NULL,motivation TEXT NOT NULL,mec TEXT NOT NULL DEFAULT 'na',"+
  "status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','submitted')),created_at TEXT DEFAULT CURRENT_TIMESTAMP,"+
  "submitted_at TEXT,pdf_file TEXT,pdf_sha256 TEXT);" +
  "CREATE TABLE IF NOT EXISTS participant_commitments ("+
  "id INTEGER PRIMARY KEY,user_id INTEGER NOT NULL REFERENCES users(id),version TEXT NOT NULL,full_name TEXT NOT NULL,"+
  "accepted_at TEXT DEFAULT CURRENT_TIMESTAMP,document_path TEXT NOT NULL,sha256 TEXT NOT NULL,"+
  "UNIQUE(user_id,version));" +
  "CREATE TABLE IF NOT EXISTS notices ("+
  "id INTEGER PRIMARY KEY,author_id INTEGER NOT NULL REFERENCES users(id),title TEXT NOT NULL,body TEXT NOT NULL,"+
  "audience TEXT NOT NULL CHECK(audience IN ('all','teacher','student')),created_at TEXT DEFAULT CURRENT_TIMESTAMP);" +
  "CREATE TABLE IF NOT EXISTS files ("+
  "id INTEGER PRIMARY KEY,owner_id INTEGER REFERENCES users(id),notice_id INTEGER REFERENCES notices(id) ON DELETE SET NULL,"+
  "group_id INTEGER,original_name TEXT NOT NULL,stored_name TEXT NOT NULL UNIQUE,mime TEXT NOT NULL,bytes INTEGER NOT NULL,"+
  "sha256 TEXT NOT NULL,created_at TEXT DEFAULT CURRENT_TIMESTAMP);" +
  "CREATE TABLE IF NOT EXISTS messages ("+
  "id INTEGER PRIMARY KEY,sender_id INTEGER NOT NULL REFERENCES users(id),receiver_id INTEGER REFERENCES users(id),"+
  "group_id INTEGER,content TEXT NOT NULL,created_at TEXT DEFAULT CURRENT_TIMESTAMP,"+
  "CHECK ((receiver_id IS NOT NULL AND group_id IS NULL) OR (receiver_id IS NULL AND group_id IS NOT NULL)));" +
  "CREATE TABLE IF NOT EXISTS mobility_groups ("+
  "id INTEGER PRIMARY KEY,name TEXT NOT NULL,destination TEXT NOT NULL,type TEXT NOT NULL CHECK(type IN ('short','long','shadowing')),"+
  "created_at TEXT DEFAULT CURRENT_TIMESTAMP);" +
  "CREATE TABLE IF NOT EXISTS group_members ("+
  "group_id INTEGER NOT NULL REFERENCES mobility_groups(id) ON DELETE CASCADE,user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,"+
  "PRIMARY KEY(group_id,user_id));" +
  "CREATE TABLE IF NOT EXISTS outbox ("+
  "id INTEGER PRIMARY KEY,to_email TEXT NOT NULL,subject TEXT NOT NULL,body TEXT NOT NULL,"+
  "status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','sent','failed')),"+
  "attempts INTEGER NOT NULL DEFAULT 0,last_error TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP,sent_at TEXT);" +
  "CREATE TABLE IF NOT EXISTS password_reset_tokens ("+
  "token_hash TEXT PRIMARY KEY,user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,expires_at INTEGER NOT NULL);" +
  "CREATE INDEX IF NOT EXISTS idx_app_user ON applications(user_id);" +
  "CREATE INDEX IF NOT EXISTS idx_notice_audience ON notices(audience);" +
  "CREATE INDEX IF NOT EXISTS idx_messages_private ON messages(sender_id,receiver_id);" +
  "CREATE INDEX IF NOT EXISTS idx_messages_group ON messages(group_id);" +
  "CREATE INDEX IF NOT EXISTS idx_outbox_status ON outbox(status,attempts);"
);

const destinationColumns=db.prepare('PRAGMA table_info(erasmus_destinations)').all().map(column=>column.name);
for (const [name,definition] of [
  ['image_alt',"TEXT NOT NULL DEFAULT ''"],
  ['image_credit',"TEXT NOT NULL DEFAULT ''"],
  ['image_source_url',"TEXT NOT NULL DEFAULT ''"],
  ['image_license_name',"TEXT NOT NULL DEFAULT ''"],
  ['image_license_url',"TEXT NOT NULL DEFAULT ''"],
  ['image_note',"TEXT NOT NULL DEFAULT ''"]
]) {
  if (!destinationColumns.includes(name)) db.exec('ALTER TABLE erasmus_destinations ADD COLUMN '+name+' '+definition);
}

if (!db.prepare('PRAGMA table_info(applications)').all().some(column=>column.name==='edition_id')) {
  db.exec('ALTER TABLE applications ADD COLUMN edition_id INTEGER REFERENCES erasmus_editions(id)');
}
if (!db.prepare('PRAGMA table_info(users)').all().some(column=>column.name==='edition_id')) {
  db.exec('ALTER TABLE users ADD COLUMN edition_id INTEGER REFERENCES erasmus_editions(id)');
}

if (!db.prepare('SELECT 1 FROM app_migrations WHERE name=?').get('seed-erasmus-editions-v1')) {
  let edition=db.prepare('SELECT id FROM erasmus_editions WHERE label=?').get('2026–2027');
  if (!edition) {
    const result=db.prepare("INSERT INTO erasmus_editions(label,is_active) VALUES (?,1)").run('2026–2027');
    edition={id:Number(result.lastInsertRowid)};
  } else if (!db.prepare('SELECT 1 FROM erasmus_editions WHERE is_active=1').get()) {
    db.prepare('UPDATE erasmus_editions SET is_active=1 WHERE id=?').run(edition.id);
  }

  const seeds=[
    {name:'Viseu',country:'Portugal',description:'Patrimonio, gastronomía y formación profesional en el centro de Portugal.',
      image_url:'/images/viseu-cathedral.jpg',
      image_alt:'Fachada de la Catedral de Viseu con sus dos torres.',
      image_credit:'Pedro Ribeiro Simões',
      image_source_url:'https://commons.wikimedia.org/wiki/File:Viseu_Cathedral_(49870949086).jpg',
      image_license_name:'CC BY 2.0',
      image_license_url:'https://creativecommons.org/licenses/by/2.0/',
      image_note:'Recorte de encuadre en la tarjeta.',
      modes:['long','shadowing'],families:['Imagen personal','Transporte y mantenimiento de vehículos','Edificación y obra civil']},
    {name:'Oporto',country:'Portugal',description:'Ciudad histórica a orillas del Duero, con oportunidades en administración y gestión.',
      image_url:'/images/porto-ribeira.jpg',
      image_alt:'Barcos rabelos en el Duero frente al barrio de la Ribeira de Oporto.',
      image_credit:'Jakub Hałun',
      image_source_url:'https://commons.wikimedia.org/wiki/File:Rabelo_boats_and_Ribeira_seen_from_Cais_de_Gaia,_20250605_1623_9879.jpg',
      image_license_name:'CC BY 4.0',
      image_license_url:'https://creativecommons.org/licenses/by/4.0/',
      image_note:'Recorte de encuadre en la tarjeta.',
      modes:['long','shadowing'],families:['Administración y gestión']},
    {name:'Róterdam',country:'Países Bajos',description:'Innovación, movilidad urbana y formación profesional.',
      image_url:'https://images.unsplash.com/photo-1512470876302-972faa2aa9a4?auto=format&fit=crop&w=1300&q=80',
      image_alt:'Canal urbano con edificios y embarcaciones',
      modes:['short','long','shadowing'],families:['Imagen personal','Administración y gestión','Agraria']}
  ];
  const addDestination=db.prepare(
    'INSERT INTO erasmus_destinations(edition_id,name,country,description,image_url,image_alt,image_credit,image_source_url,image_license_name,image_license_url,image_note) VALUES (?,?,?,?,?,?,?,?,?,?,?)'
  );
  const addMode=db.prepare('INSERT INTO erasmus_destination_modes(destination_id,mobility) VALUES (?,?)');
  const addFamily=db.prepare('INSERT INTO erasmus_destination_families(destination_id,family) VALUES (?,?)');
  for (const destination of seeds) {
    const result=addDestination.run(edition.id,destination.name,destination.country,destination.description,
      destination.image_url,destination.image_alt,destination.image_credit||'',
      destination.image_source_url||'',destination.image_license_name||'',destination.image_license_url||'',destination.image_note||'');
    const destinationId=Number(result.lastInsertRowid);
    for (const mode of destination.modes) addMode.run(destinationId,mode);
    for (const family of destination.families) addFamily.run(destinationId,family);
  }
  db.prepare('INSERT INTO app_migrations(name) VALUES (?)').run('seed-erasmus-editions-v1');
}

const activeEdition=db.prepare('SELECT id FROM erasmus_editions WHERE is_active=1').get();
if (activeEdition) {
  db.prepare('UPDATE applications SET edition_id=? WHERE edition_id IS NULL').run(activeEdition.id);
  db.prepare("UPDATE users SET edition_id=? WHERE role IN ('student','teacher') AND edition_id IS NULL").run(activeEdition.id);
}
db.exec('DROP INDEX IF EXISTS app_unique;');
db.exec('CREATE UNIQUE INDEX IF NOT EXISTS app_unique_per_edition ON applications(user_id,mobility,edition_id);');
