import {db,get,all,run,audit} from './db.mjs';
import {
  escape as E,clean,validId,schoolFamilies,mobilityModes,activeEdition,destinationsForEdition,
  heading,panel
} from './feature-service.mjs';

const modeLabels={short:'Movilidad corta',long:'Movilidad larga',shadowing:'Job Shadowing'};

function listValues(value,allowed) {
  const values=Array.isArray(value)?value:[value];
  return [...new Set(values.map(item=>String(item??'').trim()).filter(item=>allowed.includes(item)))];
}

function editionLabel(value) {
  const match=/^(\d{4})\s*[–-]\s*(\d{4})$/.exec(String(value??'').trim());
  if(!match||Number(match[2])!==Number(match[1])+1)throw Error('Indica una edición consecutiva, por ejemplo 2027–2028.');
  return match[1]+'–'+match[2];
}

function transferIds(value) {
  const values=Array.isArray(value)?value:[value];
  if(!value)return [];
  const ids=values.map(validId);
  if(ids.some(id=>!id))throw Error('La selección de cuentas no es válida; vuelve a cargarla.');
  return [...new Set(ids)];
}

function validateTransfer(sourceId,destinationId,accountIds) {
  if(!sourceId||!destinationId)throw Error('Selecciona las convocatorias de origen y destino.');
  if(sourceId===destinationId)throw Error('El origen y el destino deben ser distintos.');
  const source=get('SELECT id,label FROM erasmus_editions WHERE id=?',sourceId);
  const destination=get('SELECT id,label FROM erasmus_editions WHERE id=?',destinationId);
  if(!source||!destination)throw Error('No se encuentra alguna de las convocatorias seleccionadas.');
  if(!accountIds.length)throw Error('Selecciona al menos una cuenta para trasladar.');
  const accounts=accountIds.map(id=>get(
    "SELECT id FROM users WHERE id=? AND edition_id=? AND role IN ('student','teacher') AND status!='disabled'",
    id,sourceId
  ));
  if(accounts.some(account=>!account))throw Error('La selección ha cambiado o contiene cuentas que no pertenecen al origen; vuelve a cargarla.');
  return {source,destination};
}

function previewTransfer(body) {
  const sourceId=validId(body.source_edition_id),destinationId=validId(body.destination_edition_id);
  const accountIds=transferIds(body.account_ids);
  const editions=validateTransfer(sourceId,destinationId,accountIds);
  return {
    message:'Se cambiarán '+accountIds.length+' '+(accountIds.length===1?'cuenta':'cuentas')+
      ' de '+editions.source.label+' a '+editions.destination.label+'.',
    selectedId:sourceId,
    transfer:{sourceId,destinationId,accountIds,review:true}
  };
}

function saveTransfer(body,actorId) {
  const sourceId=validId(body.source_edition_id),destinationId=validId(body.destination_edition_id);
  const accountIds=transferIds(body.account_ids);
  db.exec('BEGIN IMMEDIATE');
  try {
    const {source,destination}=validateTransfer(sourceId,destinationId,accountIds);
    for(const accountId of accountIds) {
      run("UPDATE users SET edition_id=? WHERE id=? AND edition_id=? AND role IN ('student','teacher') AND status!='disabled'",
        destinationId,accountId,sourceId);
      audit(actorId,'admin_user_edition_bulk_reassigned_'+sourceId+'_to_'+destinationId,accountId);
    }
    db.exec('COMMIT');
    return {
      message:accountIds.length+' '+(accountIds.length===1?'cuenta trasladada':'cuentas trasladadas')+
        ' de '+source.label+' a '+destination.label+'. Las candidaturas históricas se mantienen en su edición original.',
      selectedId:sourceId
    };
  } catch(error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

function secureUrl(value,label,{allowLocal=false}={}) {
  const raw=clean(value,600);
  if(!raw)return '';
  if(allowLocal&&raw.startsWith('/')&&!raw.startsWith('//')&&!raw.includes('..')&&!/[\u0000-\u001f]/.test(raw))return raw;
  try {
    const url=new URL(raw);
    if(url.protocol!=='https:'||url.username||url.password)throw Error();
    return url.href;
  }catch {
    throw Error(label+' debe ser una dirección HTTPS válida.');
  }
}

function checkbox(name,value,label,checked) {
  return '<label class="checkbox"><input type="checkbox" name="'+E(name)+'" value="'+E(value)+'"'+(checked?' checked':'')+'> '+E(label)+'</label>';
}

function formField(label,name,value='',type='text',max=200) {
  return '<label>'+E(label)+'<input type="'+type+'" name="'+E(name)+'" value="'+E(value)+'" maxlength="'+max+'"></label>';
}

function destinationForm(edition,destination,csrf) {
  const editing=Boolean(destination);
  const item=destination||{name:'',country:'',description:'',image_url:'',image_alt:'',image_credit:'',
    image_source_url:'',image_license_name:'',image_license_url:'',image_note:'',modes:[],families:[]};
  const modes=mobilityModes.map(mode=>checkbox('modes',mode,modeLabels[mode],item.modes.includes(mode))).join('');
  const families=schoolFamilies.map(family=>checkbox('families',family,family,item.families.includes(family))).join('');
  const content=
    (editing?'<input type="hidden" name="destination_id" value="'+item.id+'">':'')+
    '<input type="hidden" name="edition_id" value="'+edition.id+'">'+
    '<input type="hidden" name="action" value="'+(editing?'save-destination':'create-destination')+'">'+
    '<h3>'+(editing?'Editar '+E(item.name):'Añadir destino')+'</h3>'+
    '<div class="fields">'+formField('Nombre del destino','name',item.name,'text',120)+
    formField('País','country',item.country,'text',100)+'</div>'+
    '<label>Descripción<textarea name="description" rows="3" maxlength="700">'+E(item.description)+'</textarea></label>'+
    '<div class="two"><div><h4>Modalidades disponibles</h4>'+modes+'</div>'+
    '<div><h4>Familias para movilidad larga</h4>'+families+
    '<p class="muted">Selecciona al menos una si habilitas movilidad larga. Movilidad corta y Job Shadowing no limitan la familia.</p></div></div>'+
    formField('Ruta de imagen o URL HTTPS','image_url',item.image_url,'text',600)+
    formField('Texto alternativo de la imagen','image_alt',item.image_alt,'text',250)+
    '<div class="fields">'+formField('Autor/a de la imagen','image_credit',item.image_credit,'text',200)+
    formField('Nota de cambios','image_note',item.image_note,'text',200)+'</div>'+
    '<div class="fields">'+formField('Fuente de la imagen','image_source_url',item.image_source_url,'url',600)+
    formField('Licencia','image_license_name',item.image_license_name,'text',80)+
    formField('URL de la licencia','image_license_url',item.image_license_url,'url',600)+'</div>'+
    '<p class="muted">Si indicas una fuente o licencia, completa también la autoría. No se permite usar URLs de imagen con protocolo inseguro.</p>'+
    '<input type="hidden" name="csrf" value="'+E(csrf)+'"><button class="btn" type="submit">'+(editing?'Guardar cambios':'Crear destino')+'</button>';
  const statusForm=editing
    ?'<form class="inline-form" method="post" action="/coordinacion/ediciones">'+
      '<input type="hidden" name="action" value="destination-status"><input type="hidden" name="destination_id" value="'+item.id+'">'+
      '<input type="hidden" name="edition_id" value="'+edition.id+'"><input type="hidden" name="csrf" value="'+E(csrf)+'">'+
      '<input type="hidden" name="status" value="'+(item.is_active?'archived':'active')+'">'+
      '<button class="btn small secondary" type="submit">'+(item.is_active?'Archivar destino':'Restaurar destino')+'</button></form>'
    :'';
  return editing
    ?'<details class="card"><summary>'+E(item.name)+' · '+(item.is_active?'Publicado':'Archivado')+'</summary><form class="form" method="post" action="/coordinacion/ediciones">'+content+'</form>'+statusForm+'</details>'
    :'<form class="card form" method="post" action="/coordinacion/ediciones">'+content+'</form>';
}

function render(req,api,message='',selectedId=null,transferState=null) {
  const editions=all(
    'SELECT e.*,(SELECT COUNT(*) FROM erasmus_destinations d WHERE d.edition_id=e.id AND d.is_active=1) AS destination_count,'+
    '(SELECT COUNT(*) FROM applications a WHERE a.edition_id=e.id) AS application_count,'+
    "(SELECT COUNT(*) FROM users u WHERE u.edition_id=e.id AND u.role IN ('student','teacher')) AS user_count "+
    'FROM erasmus_editions e ORDER BY e.label DESC'
  );
  const current=activeEdition();
  const requested=validId(selectedId||new URL(req.url,'http://localhost').searchParams.get('edicion'));
  const selected=editions.find(edition=>edition.id===requested)||editions.find(edition=>edition.is_active)||editions[0]||null;
  const params=new URL(req.url,'http://localhost').searchParams;
  const sourceId=transferState?.sourceId||validId(params.get('origen'));
  const destinationId=transferState?.destinationId||validId(params.get('destino'));
  const selectedIds=transferState?.accountIds||[];
  const csrf=E(api.csrf(req));
  let html=heading('COORDINACIÓN · ERASMUS+','Ediciones y destinos',
    'Crea ediciones académicas, elige cuál está vigente y administra sus destinos sin borrar el historial de candidaturas.');
  if(message)html+=panel('Resultado','<p>'+E(message)+'</p>');
  html+='<div class="two"><form class="card form" method="post" action="/coordinacion/ediciones">'+
    '<h2>Nueva edición</h2><p class="muted">Las ediciones nuevas se crean sin activar para que puedas preparar sus destinos antes del cambio.</p>'+
    '<input type="hidden" name="action" value="create-edition">'+
    '<label>Curso académico<input name="label" placeholder="2027–2028" required maxlength="11"></label>'+
    '<input type="hidden" name="csrf" value="'+csrf+'"><button class="btn">Crear edición</button></form>'+
    '<section class="card"><h2>Edición vigente</h2><p>'+(current?'<b>'+E(current.label)+'</b>':'Sin edición activa')+
    '</p><p class="muted">Solo sus destinos activos aparecen en la portada y en las candidaturas. Las cuentas conservan su convocatoria asignada al cambiar la vigente; coordinación debe reasignarlas expresamente.</p></section></div>';

  html+='<section class="card"><h2>Ediciones guardadas</h2><div class="responsive"><table><thead><tr>'+
    '<th>Edición</th><th>Destinos</th><th>Cuentas</th><th>Candidaturas</th><th>Estado y acciones</th></tr></thead><tbody>'+
    (editions.length?editions.map(edition=>{
      const canActivate=edition.is_active||edition.destination_count>0;
      return '<tr><td><form class="inline-form" method="post" action="/coordinacion/ediciones">'+
        '<input type="hidden" name="action" value="rename-edition"><input type="hidden" name="edition_id" value="'+edition.id+'">'+
        '<input type="hidden" name="csrf" value="'+csrf+'"><label class="sr-only" for="edition-label-'+edition.id+'">Nombre de edición</label>'+
        '<input id="edition-label-'+edition.id+'" name="label" value="'+E(edition.label)+'" maxlength="11" required>'+
        '<button class="btn small secondary" type="submit">Guardar</button></form></td>'+
        '<td>'+edition.destination_count+'</td><td>'+edition.user_count+'</td><td>'+edition.application_count+'</td><td>'+
        (edition.is_active?'<span class="pill">Vigente</span>':
          '<form class="inline-form" method="post" action="/coordinacion/ediciones">'+
          '<input type="hidden" name="action" value="activate-edition"><input type="hidden" name="edition_id" value="'+edition.id+'">'+
          '<input type="hidden" name="csrf" value="'+csrf+'"><button class="btn small" type="submit"'+(canActivate?'':' disabled')+'>Activar</button></form>')+
        ' <a href="/coordinacion/ediciones?edicion='+edition.id+'#destinos">Gestionar destinos</a>'+
        (!edition.destination_count&&!edition.is_active?'<small>Añade al menos un destino para activar.</small>':'')+
        '</td></tr>';
    }).join(''):'<tr><td colspan="5">No hay ediciones guardadas.</td></tr>')+
    '</tbody></table></div></section>';

  html+='<section id="reasignar"><div class="heading"><p class="eyebrow">GESTIÓN DE CUENTAS</p>'+
    '<h2>Reasignar cuentas entre convocatorias</h2>'+
    '<p>El traslado cambia la convocatoria asignada a las cuentas seleccionadas; las candidaturas existentes permanecen en la edición en que se presentaron.</p></div>'+
    '<form class="card form" method="get" action="/coordinacion/ediciones#reasignar">'+
    '<div class="fields"><label>Convocatoria de origen<select name="origen" required><option value="">Selecciona el origen</option>'+
    editions.map(edition=>'<option value="'+edition.id+'"'+(sourceId===edition.id?' selected':'')+'>'+E(edition.label)+'</option>').join('')+
    '</select></label><label>Convocatoria de destino<select name="destino" required><option value="">Selecciona el destino</option>'+
    editions.map(edition=>'<option value="'+edition.id+'"'+(destinationId===edition.id?' selected':'')+'>'+E(edition.label)+'</option>').join('')+
    '</select></label></div><button class="btn secondary" type="submit">Ver cuentas de origen</button></form>';
  const source=editions.find(edition=>edition.id===sourceId);
  const destination=editions.find(edition=>edition.id===destinationId);
  if(source&&destination&&sourceId!==destinationId) {
    const accounts=all(
      "SELECT id,role,username,first_name,last_name,status FROM users WHERE edition_id=? AND role IN ('student','teacher') AND status!='disabled' ORDER BY role, last_name COLLATE NOCASE, first_name COLLATE NOCASE",
      sourceId
    );
    const selectedSet=new Set(selectedIds);
    html+='<form class="card form" method="post" action="/coordinacion/ediciones#reasignar">'+
      '<h3>Cuentas de '+E(source.label)+'</h3>'+
      (accounts.length?accounts.map(account=>
        '<label class="checkbox"><input type="checkbox" name="account_ids" value="'+account.id+'"'+
        (selectedSet.has(account.id)?' checked':'')+'> '+E(account.first_name+' '+account.last_name)+
        ' · '+(account.role==='teacher'?'Docente':'Alumno')+' · '+E(account.username)+
        ' · '+E(account.status)+'</label>'
      ).join(''):'<p>No hay cuentas activas para trasladar desde esta convocatoria.</p>')+
      '<input type="hidden" name="action" value="preview-edition-transfer">'+
      '<input type="hidden" name="source_edition_id" value="'+source.id+'">'+
      '<input type="hidden" name="destination_edition_id" value="'+destination.id+'">'+
      '<input type="hidden" name="csrf" value="'+csrf+'">'+
      '<button class="btn" type="submit"'+(accounts.length?'':' disabled')+'>Revisar traslado</button></form>';
    if(transferState?.review&&transferState.sourceId===source.id&&transferState.destinationId===destination.id) {
      html+='<section class="card"><h3>Confirma el traslado</h3><p><b>Se cambiarán '+transferState.accountIds.length+
        ' '+(transferState.accountIds.length===1?'cuenta':'cuentas')+'</b> de '+E(source.label)+' a '+E(destination.label)+
        '. Las candidaturas históricas no cambiarán de edición.</p>'+
        '<form method="post" action="/coordinacion/ediciones#reasignar">'+
        '<input type="hidden" name="action" value="confirm-edition-transfer">'+
        '<input type="hidden" name="source_edition_id" value="'+source.id+'">'+
        '<input type="hidden" name="destination_edition_id" value="'+destination.id+'">'+
        transferState.accountIds.map(id=>'<input type="hidden" name="account_ids" value="'+id+'">').join('')+
        '<input type="hidden" name="csrf" value="'+csrf+'"><button class="btn" type="submit">Confirmar traslado</button></form></section>';
    }
  } else if(sourceId&&destinationId) {
    html+=panel('Convocatorias iguales','<p>Selecciona convocatorias de origen y destino distintas.</p>');
  }
  html+='</section>';

  if(selected) {
    const destinations=destinationsForEdition(selected.id,{includeInactive:true});
    html+='<section id="destinos"><div class="heading"><p class="eyebrow">EDICIÓN '+E(selected.label)+'</p>'+
      '<h2>Destinos de '+E(selected.label)+'</h2><p>Los destinos archivados se conservan para proteger el historial.</p></div>'+
      destinationForm(selected,null,csrf)+
      (destinations.length?destinations.map(destination=>destinationForm(selected,destination,csrf)).join(''):
        panel('Sin destinos','<p>Añade el primer destino para preparar esta edición.</p>'))+'</section>';
  } else {
    html+=panel('Crea una edición','<p>Después podrás añadir sus destinos y elegir cuándo pasa a estar vigente.</p>');
  }
  api.layout(req,'Ediciones y destinos Erasmus+',html);
}

function saveEdition(body,actorId,action) {
  const id=validId(body.edition_id);
  if(action==='create-edition') {
    const label=editionLabel(body.label);
    const result=run('INSERT INTO erasmus_editions(label) VALUES (?)',label);
    const newId=Number(result.lastInsertRowid);
    audit(actorId,'erasmus_edition_created',newId);
    return {message:'Edición '+label+' creada. Añade sus destinos antes de activarla.',selectedId:newId};
  }
  if(!id)throw Error('Selecciona una edición válida.');
  const exists=get('SELECT id FROM erasmus_editions WHERE id=?',id);
  if(!exists)throw Error('No se encuentra esa edición.');
  if(action==='rename-edition') {
    const label=editionLabel(body.label);
    run('UPDATE erasmus_editions SET label=?,updated_at=CURRENT_TIMESTAMP WHERE id=?',label,id);
    audit(actorId,'erasmus_edition_renamed',id);
    return {message:'Edición actualizada.',selectedId:id};
  }
  if(action==='activate-edition') {
    const count=get('SELECT COUNT(*) AS n FROM erasmus_destinations WHERE edition_id=? AND is_active=1',id).n;
    if(!count)throw Error('Añade al menos un destino activo antes de cambiar a esta edición.');
    db.exec('BEGIN IMMEDIATE');
    try {
      run('UPDATE erasmus_editions SET is_active=0,updated_at=CURRENT_TIMESTAMP WHERE is_active=1');
      run('UPDATE erasmus_editions SET is_active=1,updated_at=CURRENT_TIMESTAMP WHERE id=?',id);
      db.exec('COMMIT');
    } catch(error) {
      db.exec('ROLLBACK');
      throw error;
    }
    audit(actorId,'erasmus_edition_activated',id);
    return {message:'La edición seleccionada ya está vigente.',selectedId:id};
  }
  throw Error('Acción de edición no válida.');
}

function saveDestination(body,actorId,action) {
  const editionId=validId(body.edition_id),name=clean(body.name,120),country=clean(body.country,100);
  const description=clean(body.description,700);
  const modes=listValues(body.modes,mobilityModes);
  const families=listValues(body.families,schoolFamilies);
  const imageUrl=secureUrl(body.image_url,'La imagen',{allowLocal:true});
  const imageAlt=clean(body.image_alt,250),imageCredit=clean(body.image_credit,200);
  const imageSource=secureUrl(body.image_source_url,'La fuente');
  const imageLicenseName=clean(body.image_license_name,80);
  const imageLicense=secureUrl(body.image_license_url,'La licencia');
  const imageNote=clean(body.image_note,200);
  if(!editionId||!get('SELECT id FROM erasmus_editions WHERE id=?',editionId))throw Error('Selecciona una edición válida.');
  if(name.length<2||!country)throw Error('Indica un nombre de destino y un país.');
  if(!modes.length)throw Error('Selecciona al menos una modalidad disponible.');
  if(modes.includes('long')&&!families.length)throw Error('Selecciona las familias admitidas para movilidad larga.');
  if((imageSource||imageLicense||imageCredit||imageLicenseName)&&(!imageSource||!imageLicense||!imageCredit||!imageLicenseName)) {
    throw Error('Completa autoría, fuente, nombre y URL de licencia, o deja los campos de crédito vacíos.');
  }
  const destinationId=action==='save-destination'?validId(body.destination_id):null;
  if(action==='save-destination'&&!destinationId)throw Error('No se encuentra el destino que quieres actualizar.');
  const existing=destinationId&&get('SELECT id FROM erasmus_destinations WHERE id=? AND edition_id=?',destinationId,editionId);
  if(destinationId&&!existing)throw Error('El destino no pertenece a esa edición.');

  db.exec('BEGIN IMMEDIATE');
  try {
    let id=destinationId;
    if(id) {
      run('UPDATE erasmus_destinations SET name=?,country=?,description=?,image_url=?,image_alt=?,image_credit=?,image_source_url=?,image_license_name=?,image_license_url=?,image_note=?,updated_at=CURRENT_TIMESTAMP WHERE id=?',
        name,country,description,imageUrl,imageAlt,imageCredit,imageSource,imageLicenseName,imageLicense,imageNote,id);
      run('DELETE FROM erasmus_destination_modes WHERE destination_id=?',id);
      run('DELETE FROM erasmus_destination_families WHERE destination_id=?',id);
    } else {
      id=Number(run('INSERT INTO erasmus_destinations(edition_id,name,country,description,image_url,image_alt,image_credit,image_source_url,image_license_name,image_license_url,image_note) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
        editionId,name,country,description,imageUrl,imageAlt,imageCredit,imageSource,imageLicenseName,imageLicense,imageNote).lastInsertRowid);
    }
    for(const mode of modes)run('INSERT INTO erasmus_destination_modes(destination_id,mobility) VALUES (?,?)',id,mode);
    if(modes.includes('long'))for(const family of families)
      run('INSERT INTO erasmus_destination_families(destination_id,family) VALUES (?,?)',id,family);
    db.exec('COMMIT');
  } catch(error) {
    db.exec('ROLLBACK');
    throw error;
  }
  audit(actorId,action==='save-destination'?'erasmus_destination_updated':'erasmus_destination_created',id);
  return {message:action==='save-destination'?'Destino actualizado.':'Destino creado.',selectedId:editionId};
}

function setDestinationStatus(body,actorId) {
  const id=validId(body.destination_id),status=String(body.status||'');
  if(!id||!['active','archived'].includes(status))throw Error('Acción de destino no válida.');
  const destination=get('SELECT d.id,d.edition_id,d.is_active,e.is_active AS edition_is_active FROM erasmus_destinations d JOIN erasmus_editions e ON e.id=d.edition_id WHERE d.id=?',id);
  if(!destination)throw Error('No se encuentra ese destino.');
  if(status==='archived'&&destination.is_active&&destination.edition_is_active) {
    const count=get('SELECT COUNT(*) AS n FROM erasmus_destinations WHERE edition_id=? AND is_active=1',destination.edition_id).n;
    if(count<=1)throw Error('No puedes archivar el último destino de la edición vigente.');
  }
  run('UPDATE erasmus_destinations SET is_active=?,updated_at=CURRENT_TIMESTAMP WHERE id=?',status==='active'?1:0,id);
  audit(actorId,status==='active'?'erasmus_destination_restored':'erasmus_destination_archived',id);
  return {message:status==='active'?'Destino publicado.':'Destino archivado; el historial se conserva.',selectedId:destination.edition_id};
}

export async function editionRoutes(req,url,method,api) {
  if(url!=='/coordinacion/ediciones')return false;
  if(!api.mustAdmin(req))return true;
  if(method==='GET') {
    render(req,api);
    return true;
  }
  if(method!=='POST') {
    api.error(req,405,'Método no permitido.');
    return true;
  }
  const body=await api.readForm(req);
  if(!api.requireCSRF(req,body))return true;
  let result;
  let transferState=null;
  try {
    const action=String(body.action||'');
    if(['create-edition','rename-edition','activate-edition'].includes(action))
      result=saveEdition(body,req.auth.user.id,action);
    else if(action==='preview-edition-transfer') {
      result=previewTransfer(body);
      transferState=result.transfer;
    } else if(action==='confirm-edition-transfer')
      result=saveTransfer(body,req.auth.user.id);
    else if(['create-destination','save-destination'].includes(action))
      result=saveDestination(body,req.auth.user.id,action);
    else if(action==='destination-status')
      result=setDestinationStatus(body,req.auth.user.id);
    else throw Error('Acción no válida.');
  } catch(error) {
    const selectedId=validId(body.edition_id);
    let accountIds=[];
    try { accountIds=transferIds(body.account_ids); } catch {}
    transferState={sourceId:validId(body.source_edition_id),
      destinationId:validId(body.destination_edition_id),accountIds};
    render(req,api,error.message,selectedId||transferState.sourceId,transferState);
    return true;
  }
  render(req,api,result.message,result.selectedId,transferState);
  return true;
}
