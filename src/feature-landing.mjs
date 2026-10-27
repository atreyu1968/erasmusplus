import { unlinkSync } from 'node:fs';
import path from 'node:path';
import { all, db, get, run, audit } from './db.mjs';
import {
  clean, escape as E, heading, panel, multipart, storeUpload, docsDir, readAttachment
} from './feature-service.mjs';

const landingPath='/coordinacion/configuracion/landing';

db.exec(`
  CREATE TABLE IF NOT EXISTS landing_settings (
    id INTEGER PRIMARY KEY CHECK (id=1),
    title TEXT NOT NULL DEFAULT 'IES Manuel Martín González',
    eyebrow TEXT NOT NULL DEFAULT 'Erasmus+ · Formación profesional',
    hero_title TEXT NOT NULL DEFAULT 'Aprender en Europa. Crecer desde Tenerife.',
    hero_description TEXT NOT NULL DEFAULT 'Movilidades para descubrir nuevas formas de trabajar, ampliar horizontes y llevar lo aprendido de vuelta al aula y al oficio.',
    hero_consent_confirmed_by INTEGER REFERENCES users(id),
    hero_consent_confirmed_at TEXT,
    about_title TEXT NOT NULL DEFAULT 'La formación profesional también se construye viajando.',
    about_text TEXT NOT NULL DEFAULT 'El IES Manuel Martín González impulsa experiencias de movilidad Erasmus+ para que alumnado y profesorado conozcan otros entornos profesionales, contrasten ideas y vuelvan con nuevas herramientas. Cada destino abre una perspectiva distinta; el aprendizaje continúa mucho después del viaje.',
    destinations_title TEXT NOT NULL DEFAULT 'Destinos para descubrir.',
    destinations_description TEXT NOT NULL DEFAULT 'Conoce las oportunidades de movilidad y las familias profesionales vinculadas a cada experiencia.',
    gallery_title TEXT NOT NULL DEFAULT 'La experiencia, en imágenes.',
    gallery_description TEXT NOT NULL DEFAULT 'Momentos, lugares y aprendizajes compartidos por la comunidad Erasmus+ del centro.',
    contact_title TEXT NOT NULL DEFAULT '¿Hablamos de tu próxima experiencia?',
    contact_description TEXT NOT NULL DEFAULT 'Consulta las convocatorias y mantente cerca de las novedades Erasmus+ del centro.',
    hero_file_id INTEGER REFERENCES files(id) ON DELETE SET NULL,
    contact_email TEXT NOT NULL DEFAULT '',
    contact_phone TEXT NOT NULL DEFAULT '',
    address TEXT NOT NULL DEFAULT '',
    social_instagram TEXT NOT NULL DEFAULT '',
    social_facebook TEXT NOT NULL DEFAULT '',
    social_youtube TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  INSERT OR IGNORE INTO landing_settings(id) VALUES (1);
  CREATE TABLE IF NOT EXISTS landing_gallery_albums (
    id INTEGER PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    edition_id INTEGER REFERENCES erasmus_editions(id) ON DELETE SET NULL,
    is_published INTEGER NOT NULL DEFAULT 0 CHECK (is_published IN (0,1)),
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS landing_gallery_items (
    id INTEGER PRIMARY KEY,
    album_id INTEGER NOT NULL REFERENCES landing_gallery_albums(id) ON DELETE CASCADE,
    file_id INTEGER NOT NULL REFERENCES files(id) ON DELETE RESTRICT,
    caption TEXT NOT NULL DEFAULT '',
    alt_text TEXT NOT NULL,
    is_published INTEGER NOT NULL DEFAULT 0 CHECK (is_published IN (0,1)),
    consent_confirmed_by INTEGER REFERENCES users(id),
    consent_confirmed_at TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS landing_gallery_album_order ON landing_gallery_albums(is_published,sort_order,id);
  CREATE INDEX IF NOT EXISTS landing_gallery_item_order ON landing_gallery_items(album_id,is_published,sort_order,id);
`);

export function getLandingSettings() {
  return get('SELECT * FROM landing_settings WHERE id=1');
}

export function publicLandingGallery() {
  return all(
    'SELECT i.id,i.caption,i.alt_text,i.created_at,f.id AS file_id,a.title AS album_title,a.description AS album_description '+
    'FROM landing_gallery_items i JOIN landing_gallery_albums a ON a.id=i.album_id '+
    'JOIN files f ON f.id=i.file_id '+
    'WHERE i.is_published=1 AND a.is_published=1 '+
    'ORDER BY a.sort_order,a.id,i.sort_order,i.id DESC LIMIT 12'
  ).map(item=>({
    id:item.id,
    title:item.caption||item.album_title,
    description:item.caption?item.album_title:item.album_description,
    imageUrl:'/landing-media/'+item.file_id,
    imageAlt:item.alt_text,
    createdAt:item.created_at
  }));
}

function escapeValue(value,max) {
  return clean(value,max);
}

function validatedUrl(value,label) {
  const input=clean(value,500);
  if(!input)return '';
  try {
    const url=new URL(input);
    if(url.protocol!=='https:'||url.username||url.password)throw Error();
    return url.href;
  } catch {
    throw Error(label+' debe ser una dirección HTTPS válida.');
  }
}

function validatedSettings(body) {
  const email=clean(body.contact_email,200).toLowerCase();
  if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw Error('Introduce un correo de contacto válido.');
  return {
    title:escapeValue(body.title,100)||'IES Manuel Martín González',
    eyebrow:escapeValue(body.eyebrow,120)||'Erasmus+ · Formación profesional',
    hero_title:escapeValue(body.hero_title,160)||'Aprender en Europa. Crecer desde Tenerife.',
    hero_description:escapeValue(body.hero_description,1000),
    about_title:escapeValue(body.about_title,160),
    about_text:escapeValue(body.about_text,1200),
    destinations_title:escapeValue(body.destinations_title,160),
    destinations_description:escapeValue(body.destinations_description,600),
    gallery_title:escapeValue(body.gallery_title,160),
    gallery_description:escapeValue(body.gallery_description,600),
    contact_title:escapeValue(body.contact_title,160),
    contact_description:escapeValue(body.contact_description,600),
    contact_email:email,
    contact_phone:escapeValue(body.contact_phone,60),
    address:escapeValue(body.address,300),
    social_instagram:validatedUrl(body.social_instagram,'Instagram'),
    social_facebook:validatedUrl(body.social_facebook,'Facebook'),
    social_youtube:validatedUrl(body.social_youtube,'YouTube')
  };
}

function settingsForm(req,api,settings,message='') {
  const csrf=E(api.csrf(req));
  const input=(label,name,value='',type='text',extra='')=>
    '<label>'+E(label)+'<input name="'+name+'" type="'+type+'" value="'+E(value)+'" '+extra+'></label>';
  const content=heading('PORTADA PÚBLICA · ERASMUS+','Configurar landing',
    'Edita los datos de bienvenida y las galerías que verán las personas visitantes.')+
    (message?panel('Resultado','<p>'+E(message)+'</p>'):'')+
    '<form class="card form landing-settings-form" method="post" action="'+landingPath+'/settings" enctype="multipart/form-data">'+
    '<h2>Contenido de portada</h2>'+
    '<input type="hidden" name="csrf" value="'+csrf+'">'+
    input('Nombre que aparece en la portada','title',settings.title,'text','maxlength="100" required')+
    input('Texto breve sobre el centro','eyebrow',settings.eyebrow,'text','maxlength="120" required')+
    input('Titular principal','hero_title',settings.hero_title,'text','maxlength="160" required')+
    '<label>Descripción de bienvenida<textarea name="hero_description" rows="4" maxlength="1000">'+E(settings.hero_description)+'</textarea></label>'+
    '<label>Imagen de portada <input type="file" name="hero_image" accept="image/jpeg,image/png,image/webp"><small>JPG, PNG o WebP; máximo 6 MB.</small></label>'+
    '<label class="checkbox"><input type="checkbox" name="hero_image_consent" value="yes">Confirmo que existe autorización institucional para publicar esta imagen.</label>'+
    (settings.hero_file_id?'<div class="landing-image-preview"><img src="/landing-media/'+settings.hero_file_id+'?preview=1" alt="Imagen actual de portada"><label class="checkbox"><input type="checkbox" name="remove_hero_image" value="yes">Quitar imagen y usar la ilustración predeterminada</label></div>':'')+
    '<h2>Textos de las secciones</h2>'+
    input('Título de la sección informativa','about_title',settings.about_title,'text','maxlength="160"')+
    '<label>Texto informativo<textarea name="about_text" rows="4" maxlength="1200">'+E(settings.about_text)+'</textarea></label>'+
    input('Título de destinos','destinations_title',settings.destinations_title,'text','maxlength="160"')+
    '<label>Descripción de destinos<textarea name="destinations_description" rows="3" maxlength="600">'+E(settings.destinations_description)+'</textarea></label>'+
    input('Título de galería','gallery_title',settings.gallery_title,'text','maxlength="160"')+
    '<label>Descripción de galería<textarea name="gallery_description" rows="3" maxlength="600">'+E(settings.gallery_description)+'</textarea></label>'+
    input('Título de contacto','contact_title',settings.contact_title,'text','maxlength="160"')+
    '<label>Texto de contacto<textarea name="contact_description" rows="3" maxlength="600">'+E(settings.contact_description)+'</textarea></label>'+
    '<h2>Contacto y redes sociales</h2>'+
    '<div class="fields">'+input('Correo electrónico','contact_email',settings.contact_email,'email','maxlength="200"')+
    input('Teléfono','contact_phone',settings.contact_phone,'tel','maxlength="60"')+
    input('Dirección','address',settings.address,'text','maxlength="300"')+
    input('Instagram (URL HTTPS)','social_instagram',settings.social_instagram,'url','maxlength="500"')+
    input('Facebook (URL HTTPS)','social_facebook',settings.social_facebook,'url','maxlength="500"')+
    input('YouTube (URL HTTPS)','social_youtube',settings.social_youtube,'url','maxlength="500"')+'</div>'+
    '<button class="btn" type="submit">Guardar portada</button></form>';
  return content;
}

function albumSection(req,api,message='') {
  const csrf=E(api.csrf(req));
  const editions=all('SELECT id,label FROM erasmus_editions ORDER BY label DESC');
  const editionOptions='<option value="">Sin convocatoria vinculada</option>'+editions.map(edition=>
    '<option value="'+edition.id+'">'+E(edition.label)+'</option>'
  ).join('');
  const albums=all(
    'SELECT a.*,e.label AS edition_label,(SELECT COUNT(*) FROM landing_gallery_items i WHERE i.album_id=a.id) AS item_count,'+
    '(SELECT COUNT(*) FROM landing_gallery_items i WHERE i.album_id=a.id AND i.is_published=1) AS published_count '+
    'FROM landing_gallery_albums a LEFT JOIN erasmus_editions e ON e.id=a.edition_id ORDER BY a.sort_order,a.id DESC'
  );
  let html=message?panel('Resultado','<p>'+E(message)+'</p>'):'';
  html+='<section class="landing-gallery-admin"><div class="heading"><p class="eyebrow">FOTOGRAFÍAS DEL CENTRO</p>'+
    '<h2>Galerías</h2><p>Crea álbumes, asócialos a una convocatoria y publica solo imágenes con autorización confirmada. No subas imágenes de menores sin la autorización institucional y familiar que corresponda.</p></div>'+
    '<form class="card form" method="post" action="'+landingPath+'/album">'+
    '<h3>Nueva galería</h3><input type="hidden" name="csrf" value="'+csrf+'">'+
    '<label>Nombre de la galería<input name="title" maxlength="120" required></label>'+
    '<label>Descripción<textarea name="description" rows="2" maxlength="500"></textarea></label>'+
    '<label>Convocatoria vinculada<select name="edition_id">'+editionOptions+'</select></label>'+
    '<button class="btn" type="submit">Crear galería</button></form>';
  if(!albums.length)html+=panel('Aún no hay galerías','<p>Crea una galería y añade imágenes para que aparezca en la portada.</p>');
  for(const album of albums) {
    const items=all(
      'SELECT i.*,f.id AS stored_file_id FROM landing_gallery_items i JOIN files f ON f.id=i.file_id '+
      'WHERE i.album_id=? ORDER BY i.sort_order,i.id DESC',
      album.id
    );
    const states=album.is_published
      ?'<span class="pill">Publicada</span>'
      :'<span class="pill">Borrador</span>';
    html+='<section class="card landing-album"><div class="row"><div><h3>'+E(album.title)+'</h3>'+
      '<p>'+E(album.edition_label||'Sin convocatoria vinculada')+' · '+album.published_count+'/'+album.item_count+' imágenes publicadas</p></div>'+states+'</div>'+
      '<form class="form landing-album-edit" method="post" action="'+landingPath+'/album/'+album.id+'">'+
      '<input type="hidden" name="csrf" value="'+csrf+'"><input type="hidden" name="action" value="save">'+
      '<label>Nombre<input name="title" maxlength="120" value="'+E(album.title)+'" required></label>'+
      '<label>Descripción<textarea name="description" rows="2" maxlength="500">'+E(album.description)+'</textarea></label>'+
      '<label>Convocatoria<select name="edition_id">'+editions.map(edition=>
        '<option value="'+edition.id+'"'+(Number(album.edition_id)===edition.id?' selected':'')+'>'+E(edition.label)+'</option>'
      ).join('')+'<option value=""'+(album.edition_id?'':' selected')+'>Sin convocatoria vinculada</option></select></label>'+
      '<label class="checkbox"><input type="checkbox" name="is_published" value="1"'+(album.is_published?' checked':'')+'>Mostrar esta galería en la portada</label>'+
      '<button class="btn small" type="submit">Guardar galería</button></form>';
    if(items.length) {
      html+='<div class="landing-gallery-admin-items">';
      for(const item of items) {
        html+='<article class="landing-gallery-admin-item"><img src="/landing-media/'+item.stored_file_id+'?preview=1" alt="'+E(item.alt_text)+'">'+
          '<div><b>'+E(item.caption||item.alt_text)+'</b><small>'+E(item.alt_text)+'</small><span>'+(item.is_published?'Publicada':'Borrador')+'</span></div>'+
          '<form method="post" action="'+landingPath+'/foto/'+item.id+'" class="form">'+
          '<input type="hidden" name="csrf" value="'+csrf+'"><input type="hidden" name="action" value="toggle">'+
          '<input type="hidden" name="publish" value="'+(item.is_published?'0':'1')+'">'+
          (item.is_published?'':'<label class="checkbox"><input type="checkbox" name="consent_confirmed" value="yes" required>Confirmo que existe autorización para publicar esta imagen.</label>')+
          '<button class="btn small secondary" type="submit">'+(item.is_published?'Retirar':'Publicar')+'</button></form>'+
          '<form method="post" action="'+landingPath+'/foto/'+item.id+'" class="form landing-delete-form">'+
          '<input type="hidden" name="csrf" value="'+csrf+'"><input type="hidden" name="action" value="delete">'+
          '<label class="checkbox"><input type="checkbox" name="confirm_delete" value="yes" required>Confirmar borrado</label>'+
          '<button class="btn small danger" type="submit">Eliminar</button></form></article>';
      }
      html+='</div>';
    }
    html+='<form class="card form landing-gallery-upload" method="post" action="'+landingPath+'/album/'+album.id+'/foto" enctype="multipart/form-data">'+
      '<h4>Añadir imagen</h4><input type="hidden" name="csrf" value="'+csrf+'">'+
      '<label>Archivo de imagen<input type="file" name="image" accept="image/jpeg,image/png,image/webp" required></label>'+
      '<label>Texto alternativo<input name="alt_text" maxlength="240" required placeholder="Describe la imagen para lectores de pantalla"></label>'+
      '<label>Pie de foto<input name="caption" maxlength="240"></label>'+
      '<label class="checkbox"><input type="checkbox" name="publish_now" value="1">Publicar en la portada ahora</label>'+
      '<label class="checkbox"><input type="checkbox" name="consent_confirmed" value="yes">Confirmo que existe autorización institucional para publicar esta imagen.</label>'+
      '<small>Si la publicas ahora, debes marcar la confirmación de autorización. La imagen no se mostrará mientras esté en borrador.</small>'+
      '<button class="btn small" type="submit">Subir imagen</button></form>'+
      '<form class="landing-delete-album" method="post" action="'+landingPath+'/album/'+album.id+'">'+
      '<input type="hidden" name="csrf" value="'+csrf+'"><input type="hidden" name="action" value="delete">'+
      '<label class="checkbox"><input type="checkbox" name="confirm_delete" value="yes" required>Confirmo que quiero eliminar la galería y sus imágenes.</label>'+
      '<button class="btn small danger" type="submit">Eliminar galería</button></form></section>';
  }
  html+='</section>';
  return html;
}

function renderAdmin(req,api,message='') {
  const settings=getLandingSettings();
  const content=settingsForm(req,api,settings,message)+albumSection(req,api);
  api.layout(req,'Configurar landing Erasmus+',content);
}

function ensureImage(file) {
  if(!file||typeof file.arrayBuffer!=='function'||!file.size)return false;
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)) {
    throw Error('Solo se admiten imágenes JPG, PNG o WebP.');
  }
  if(file.size>6*1024*1024)throw Error('La imagen no puede superar los 6 MB.');
  return true;
}

function fileIsReferenced(fileId) {
  return Boolean(get(
    'SELECT 1 FROM landing_settings WHERE hero_file_id=? '+
    'UNION SELECT 1 FROM landing_gallery_items WHERE file_id=? '+
    'UNION SELECT 1 FROM guardian_documents WHERE file_id=? LIMIT 1',
    fileId,fileId,fileId
  ));
}

function removeUnreferencedImage(fileId) {
  if(!fileId||fileIsReferenced(fileId))return;
  const file=get('SELECT id,stored_name FROM files WHERE id=?',fileId);
  if(!file||!/^[a-f0-9]{48}\.(jpg|png|webp)$/.test(file.stored_name))return;
  run('DELETE FROM files WHERE id=?',fileId);
  try {unlinkSync(path.join(docsDir,file.stored_name));} catch(error) {
    if(error.code!=='ENOENT')console.error('No se pudo retirar una imagen antigua de la landing:',error.message);
  }
}

async function saveSettings(req,api) {
  const form=await multipart(req);
  const body=Object.fromEntries([...form.entries()].filter(([,value])=>typeof value==='string'));
  if(!api.requireCSRF(req,body))return;
  const values=validatedSettings(body);
  const current=getLandingSettings();
  const file=form.get('hero_image');
  let heroFileId=current.hero_file_id;
  let uploadedFileId=null;
  if(body.remove_hero_image==='yes')heroFileId=null;
  if(ensureImage(file)) {
    if(body.hero_image_consent!=='yes')throw Error('Confirma que tienes autorización institucional antes de publicar la imagen de portada.');
    uploadedFileId=await storeUpload(file,{ownerId:req.auth.user.id});
    heroFileId=uploadedFileId;
  }
  try {
    run(
      'UPDATE landing_settings SET title=?,eyebrow=?,hero_title=?,hero_description=?,about_title=?,about_text=?,destinations_title=?,destinations_description=?,gallery_title=?,gallery_description=?,contact_title=?,contact_description=?,hero_file_id=?,hero_consent_confirmed_by=?,hero_consent_confirmed_at=?,contact_email=?,contact_phone=?,address=?,social_instagram=?,social_facebook=?,social_youtube=?,updated_at=CURRENT_TIMESTAMP WHERE id=1',
      values.title,values.eyebrow,values.hero_title,values.hero_description,values.about_title,values.about_text,
      values.destinations_title,values.destinations_description,values.gallery_title,values.gallery_description,
      values.contact_title,values.contact_description,heroFileId,
      uploadedFileId?req.auth.user.id:body.remove_hero_image==='yes'?null:current.hero_consent_confirmed_by,
      uploadedFileId?new Date().toISOString():body.remove_hero_image==='yes'?null:current.hero_consent_confirmed_at,
      values.contact_email,
      values.contact_phone,values.address,values.social_instagram,values.social_facebook,values.social_youtube
    );
    if(current.hero_file_id&&current.hero_file_id!==heroFileId)removeUnreferencedImage(current.hero_file_id);
    audit(req.auth.user.id,'landing_settings_updated');
    renderAdmin(req,api,'La portada se ha guardado.');
  } catch(error) {
    if(uploadedFileId)removeUnreferencedImage(uploadedFileId);
    throw error;
  }
}

function createAlbum(req,api,body) {
  if(!api.requireCSRF(req,body))return;
  const title=clean(body.title,120),description=clean(body.description,500);
  const editionId=body.edition_id?Number(body.edition_id):null;
  if(!title)throw Error('Escribe el nombre de la galería.');
  if(editionId&&!get('SELECT id FROM erasmus_editions WHERE id=?',editionId))throw Error('La convocatoria seleccionada no existe.');
  const result=run('INSERT INTO landing_gallery_albums(title,description,edition_id) VALUES (?,?,?)',title,description,editionId);
  audit(req.auth.user.id,'landing_gallery_created',Number(result.lastInsertRowid));
  renderAdmin(req,api,'Galería creada como borrador. Añade imágenes para publicarla.');
}

function updateAlbum(req,api,body,albumId) {
  if(!api.requireCSRF(req,body))return;
  const album=get('SELECT * FROM landing_gallery_albums WHERE id=?',albumId);
  if(!album)throw Error('No se encuentra la galería.');
  if(body.action==='delete') {
    if(body.confirm_delete!=='yes')throw Error('Confirma que quieres eliminar la galería y sus imágenes.');
    const fileIds=all('SELECT file_id FROM landing_gallery_items WHERE album_id=?',albumId).map(row=>row.file_id);
    run('DELETE FROM landing_gallery_albums WHERE id=?',albumId);
    fileIds.forEach(removeUnreferencedImage);
    audit(req.auth.user.id,'landing_gallery_deleted',albumId);
    renderAdmin(req,api,'Galería eliminada.');
    return;
  }
  const title=clean(body.title,120),description=clean(body.description,500);
  const editionId=body.edition_id?Number(body.edition_id):null;
  const publish=body.is_published==='1'?1:0;
  if(!title)throw Error('Escribe el nombre de la galería.');
  if(editionId&&!get('SELECT id FROM erasmus_editions WHERE id=?',editionId))throw Error('La convocatoria seleccionada no existe.');
  if(publish&&!get('SELECT 1 FROM landing_gallery_items WHERE album_id=? AND is_published=1 LIMIT 1',albumId)) {
    throw Error('Publica al menos una imagen autorizada antes de publicar la galería.');
  }
  run('UPDATE landing_gallery_albums SET title=?,description=?,edition_id=?,is_published=?,updated_at=CURRENT_TIMESTAMP WHERE id=?',
    title,description,editionId,publish,albumId);
  audit(req.auth.user.id,publish?'landing_gallery_published':'landing_gallery_updated',albumId);
  renderAdmin(req,api,publish?'Galería publicada en la portada.':'Galería actualizada.');
}

async function addGalleryPhoto(req,api,form,albumId) {
  const body=Object.fromEntries([...form.entries()].filter(([,value])=>typeof value==='string'));
  if(!api.requireCSRF(req,body))return;
  const album=get('SELECT id FROM landing_gallery_albums WHERE id=?',albumId);
  if(!album)throw Error('No se encuentra la galería.');
  const altText=clean(body.alt_text,240);
  const caption=clean(body.caption,240);
  if(!altText)throw Error('Escribe un texto alternativo que describa la imagen.');
  const file=form.get('image');
  if(!ensureImage(file))throw Error('Selecciona una imagen válida.');
  const publish=body.publish_now==='1'?1:0;
  if(publish&&body.consent_confirmed!=='yes')throw Error('Confirma que tienes autorización institucional antes de publicar esta imagen.');
  const count=get('SELECT COUNT(*) AS total FROM landing_gallery_items WHERE album_id=?',albumId).total;
  if(count>=60)throw Error('Cada galería admite un máximo de 60 imágenes.');
  const fileId=await storeUpload(file,{ownerId:req.auth.user.id});
  try {
    const result=run(
      'INSERT INTO landing_gallery_items(album_id,file_id,caption,alt_text,is_published,consent_confirmed_by,consent_confirmed_at) VALUES (?,?,?,?,?,?,?)',
      albumId,fileId,caption,altText,publish,publish?req.auth.user.id:null,publish?new Date().toISOString():null
    );
    audit(req.auth.user.id,publish?'landing_gallery_photo_published':'landing_gallery_photo_uploaded',Number(result.lastInsertRowid));
    renderAdmin(req,api,publish?'Imagen subida y publicada.':'Imagen subida como borrador.');
  } catch(error) {
    removeUnreferencedImage(fileId);
    throw error;
  }
}

function updateGalleryPhoto(req,api,body,itemId) {
  if(!api.requireCSRF(req,body))return;
  const item=get('SELECT * FROM landing_gallery_items WHERE id=?',itemId);
  if(!item)throw Error('No se encuentra la imagen.');
  if(body.action==='delete') {
    if(body.confirm_delete!=='yes')throw Error('Confirma que quieres eliminar la imagen.');
    run('DELETE FROM landing_gallery_items WHERE id=?',itemId);
    removeUnreferencedImage(item.file_id);
    audit(req.auth.user.id,'landing_gallery_photo_deleted',itemId);
    renderAdmin(req,api,'Imagen eliminada.');
    return;
  }
  const publish=body.publish==='1'?1:0;
  if(publish&&body.consent_confirmed!=='yes')throw Error('Confirma que existe autorización institucional antes de publicar esta imagen.');
  run(
    'UPDATE landing_gallery_items SET is_published=?,consent_confirmed_by=CASE WHEN ?=1 THEN ? ELSE consent_confirmed_by END,'+
    'consent_confirmed_at=CASE WHEN ?=1 THEN ? ELSE consent_confirmed_at END WHERE id=?',
    publish,publish,publish?req.auth.user.id:null,publish,publish?new Date().toISOString():null,itemId
  );
  audit(req.auth.user.id,publish?'landing_gallery_photo_published':'landing_gallery_photo_unpublished',itemId);
  renderAdmin(req,api,publish?'Imagen publicada.':'Imagen retirada de la portada.');
}

function serveLandingImage(req,api,fileId) {
  const preview=new URL(req.url,'http://localhost').searchParams.get('preview')==='1';
  if(preview&&!api.mustAdmin(req))return;
  const file=get('SELECT * FROM files WHERE id=? AND mime IN (?,?,?)',fileId,'image/jpeg','image/png','image/webp');
  if(!file) {api.error(req,404,'No se encuentra la imagen.');return;}
  if(!preview) {
    const referenced=Boolean(get(
      'SELECT 1 FROM landing_settings WHERE hero_file_id=? '+
      'UNION SELECT 1 FROM landing_gallery_items i JOIN landing_gallery_albums a ON a.id=i.album_id '+
      'WHERE i.file_id=? AND i.is_published=1 AND a.is_published=1 LIMIT 1',
      fileId,fileId
    ));
    if(!referenced) {api.error(req,404,'La imagen no está publicada.');return;}
  }
  api.raw(req,200,readAttachment(file),file.mime,{
    'Cache-Control':preview?'private, no-store':'public, max-age=86400, immutable',
    'Content-Disposition':'inline'
  });
}

export async function landingRoutes(req,url,method,api) {
  const media=/^\/landing-media\/(\d+)$/.exec(url);
  if(media) {
    if(method!=='GET') {api.error(req,405,'Método no permitido.');return true;}
    serveLandingImage(req,api,Number(media[1]));
    return true;
  }
  const albumPhoto=/^\/coordinacion\/configuracion\/landing\/album\/(\d+)\/foto$/.exec(url);
  const album=/^\/coordinacion\/configuracion\/landing\/album\/(\d+)$/.exec(url);
  const photo=/^\/coordinacion\/configuracion\/landing\/foto\/(\d+)$/.exec(url);
  const validPath=url===landingPath||url===landingPath+'/settings'||url===landingPath+'/album'||Boolean(albumPhoto||album||photo);
  if(!validPath)return false;
  if(!api.mustAdmin(req))return true;
  if(method==='GET'&&url===landingPath) {
    renderAdmin(req,api,new URL(req.url,'http://localhost').searchParams.get('guardado')||'');
    return true;
  }
  if(method!=='POST') {api.error(req,405,'Método no permitido.');return true;}
  try {
    if(url===landingPath+'/settings')await saveSettings(req,api);
    else if(url===landingPath+'/album')createAlbum(req,api,await api.readForm(req));
    else if(albumPhoto)await addGalleryPhoto(req,api,await multipart(req),Number(albumPhoto[1]));
    else if(album)updateAlbum(req,api,await api.readForm(req),Number(album[1]));
    else if(photo)updateGalleryPhoto(req,api,await api.readForm(req),Number(photo[1]));
    else {api.error(req,404,'Ruta no encontrada.');return true;}
  } catch(error) {
    renderAdmin(req,api,error instanceof Error?error.message:'No se pudo guardar la landing.');
  }
  return true;
}
