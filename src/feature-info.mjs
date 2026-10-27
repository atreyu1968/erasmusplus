import {escape as E,heading,panel} from './feature-service.mjs';

const culture={
 viseu:{
  title:'Viseu, Portugal',sub:'Patrimonio, gastronomía y formación profesional',
  intro:'Viseu es una ciudad del interior de Portugal, conocida por su centro histórico, su patrimonio y su relación con los vinos de la región del Dão.',
  facts:['Recorre el centro histórico y los alrededores de la catedral.','Acércate a la cultura gastronómica y al patrimonio de la región.','Centro colaborador previsto: Escola Secundária de Emídio Navarro.'],
  image:'https://images.unsplash.com/photo-1555881400-74d7acaacd8b?auto=format&fit=crop&w=1300&q=80',
  warning:'Fotografía ambiental ilustrativa de Portugal; la imagen no certifica una ubicación concreta de Viseu.',
  links:[['Institución colaboradora (Facebook)','https://www.facebook.com/esenviseu/']]
 },
 oporto:{
  title:'Oporto, Portugal',sub:'Ciudad histórica a orillas del Duero',
  intro:'Oporto es una ciudad atlántica portuguesa conocida por el río Duero, el centro histórico y su patrimonio urbano.',
  facts:['Observa la ribera del Duero y el puente Dom Luís I.','Conoce la oferta cultural y los oficios tradicionales de la ciudad.','Destino previsto para Administración y Gestión, según convocatoria.'],
  image:'https://images.unsplash.com/photo-1555881400-74d7acaacd8b?auto=format&fit=crop&w=1300&q=80',
  warning:'Fotografía ilustrativa de Oporto; centros de prácticas y plazas pendientes de confirmación.',
  links:[['Viajar a Portugal (Gobierno portugués)','https://www.gov.pt/guias/viajar-para-portugal']]
 },
 roterdam:{
  title:'Róterdam, Países Bajos',sub:'Innovación, movilidad urbana y formación profesional',
  intro:'Róterdam destaca por su arquitectura contemporánea, su actividad portuaria y su diversidad cultural.',
  facts:['Conoce el entorno portuario y la innovación aplicada a la formación profesional.','Explora la red de centros Albeda y los espacios relacionados con RDM Campus.','La movilidad corta prevé actividades en Róterdam y visitas a La Haya y Ámsterdam.'],
  image:'https://images.unsplash.com/photo-1512470876302-972faa2aa9a4?auto=format&fit=crop&w=1300&q=80',
  warning:'Fotografía ilustrativa de los Países Bajos. La imagen no identifica necesariamente RDM Campus o Albeda.',
  links:[['Red Albeda','https://www.albeda.nl/'],['Estancia de ciudadanos UE (IND)','https://ind.nl/en/residence-permits/eu-eea-or-swiss-citizens/staying-in-the-netherlands-as-an-eu-eea-or-swiss-citizen']]
 }
};
function infoPage(req,api,key){
 const info=culture[key];
 let html=heading('DESTINO ERASMUS+ 2026–2027',info.title,info.sub);
 html+='<div class="info-hero" style="background-image:linear-gradient(90deg,#123d6bed,#123d6b62),url('+info.image+')"><div><p class="eyebrow">ENRIQUECIENDO VIDAS · ABRIENDO MENTES</p><h2>'+E(info.title)+'</h2><p>'+E(info.intro)+'</p></div></div>';
 html+=panel('Cultura y aprendizaje','<ul>'+info.facts.map(f=>'<li>'+E(f)+'</li>').join('')+'</ul>'+
 '<p class="muted">'+E(info.warning)+'</p>');
 html+=panel('Enlaces de referencia',info.links.map(([label,link])=>'<p><a target="_blank" rel="noopener noreferrer" href="'+E(link)+'">'+E(label)+' ↗</a></p>').join(''));
 html+='<p><a class="btn" href="/destinos">← Volver a destinos</a></p>';
 api.layout(req,info.title,html);
}
const links=[
 ['Convocatoria SEPIE 2026 · FP','https://sepie.es/formacion-profesional/convocatoria.html'],
 ['Movilidad de estudiantes y personal de FP · Erasmus+','https://erasmus-plus.ec.europa.eu/programme-guide/part-b/key-action-1/vet-learners-and-staff'],
 ['Circular internacional FEOE · SIFPRE Canarias (15 septiembre 2025)','https://www3.gobiernodecanarias.org/medusa/ecoescuela/internacionalizacion/2025/09/15/publicacion-de-la-circular-de-la-viceconsejeria-de-fp-y-cualificaciones-profesionales-con-las-instrucciones-para-movilidades-de-feoe/'],
 ['Instrucciones de formación dual · Gobierno de Canarias','https://www.gobiernodecanarias.org/educacion/web/formacion_profesional/ensenanzas/implantacion_curriculos/formacion-dual-empresas/'],
 ['Guía AEPD de protección de datos en centros educativos','https://www.aepd.es/guias/guia-centros-educativos.pdf']
];
function normative(req,api){
 let html=heading('NORMATIVA Y SEGURIDAD','Normativa Erasmus+ FP','Referencias oficiales y obligaciones generales de quienes realizan una movilidad internacional.');
 html+=panel('Documentos y fuentes oficiales',links.map(([label,url])=>
 '<p><a target="_blank" rel="noopener noreferrer" href="'+E(url)+'">'+E(label)+' ↗</a></p>').join('')+
 '<p>La coordinación debe revisar la vigencia de estas normas y añadir los documentos específicos de la convocatoria del centro y, en su caso, del Cabildo de Tenerife.</p>');
 html+=panel('Responsabilidades de participantes','<ol>'+
 ['Asistir a las actividades y prácticas acordadas con el centro y la entidad de acogida.',
  'Respetar las normas de convivencia y seguridad, y atender las indicaciones del profesorado acompañante.',
  'Llevar documentación de identidad y viaje válida, además de la documentación requerida para menores.',
  'Informar de incidentes, accidentes o ausencias a los responsables de la movilidad.',
  'Respetar la normativa de los países de destino y las condiciones del acuerdo de aprendizaje.',
  'Entregar los documentos y justificantes exigidos por el programa y el centro.'].map(x=>'<li>'+E(x)+'</li>').join('')+'</ol>'+
 '<p><a class="btn" href="/compromisos">Consultar compromiso de participación</a></p>');
 html+='<div class="two">'+countryRules('Portugal',
  ['Documento válido: DNI o pasaporte para españoles; revisa su vigencia.','Si viajas siendo menor sin quien ejerce la patria potestad, consulta las autorizaciones escritas exigidas.','Conoce los contactos de coordinación y la documentación de seguro antes del viaje.'],
  'https://www.gov.pt/guias/viajar-para-portugal')+
  countryRules('Países Bajos',
  ['Para ciudadanos UE, documento de identidad o pasaporte válido.','En prácticas se puede exigir identificación documental en el lugar de trabajo.','Respeta los carriles bici, las normas de transporte y los protocolos del centro de acogida.'],
  'https://www.government.nl/themes/justice-security-and-defence/identification-documents/compulsory-identification')+'</div>';
 html+=panel('Cobertura sanitaria','<p>La Tarjeta Sanitaria Europea facilita asistencia sanitaria pública necesaria durante estancias temporales en países de la UE en las condiciones que correspondan, pero no sustituye un seguro de viaje ni cubre automáticamente todas las eventualidades.</p>'+
 '<a target="_blank" rel="noopener noreferrer" href="https://traineeships.ec.europa.eu/frequently-asked-questions/what-european-health-insurance-card_en">Información oficial de la Comisión Europea ↗</a>');
 html+='<div class="notice-box">Información general que no constituye asesoramiento jurídico. La publicación final de cláusulas, firmas, seguros y autorizaciones debe ser validada por el centro y la administración educativa.</div>';
 api.layout(req,'Normativa Erasmus+',html);
}
function countryRules(title,items,url) {
 return '<section class="card country-card"><span class="eyebrow">INFOGRAFÍA DE VIAJE</span><h2>'+E(title)+'</h2>'+
 '<div class="rule-list">'+items.map((x,i)=>'<div class="rule"><span>'+(i+1)+'</span><p>'+E(x)+'</p></div>').join('')+'</div>'+
 '<a target="_blank" rel="noopener noreferrer" href="'+E(url)+'">Consultar fuente oficial ↗</a></section>';
}
function mobilityDetail(req,api,type){
 const short=type==='corta';
 const title=short?'Movilidad corta · Países Bajos':'Movilidad larga · Dual-Erasmus+';
 const facts=short?[
 ['10 días','Duración prevista'],['Febrero-marzo 2027','Periodo orientativo'],['Tenerife Sur → Ámsterdam Schiphol','Trayecto previsto'],
 ['Apartamento compartido','Convivencia y autonomía'],['Tren, autobús y bicicleta','Desplazamientos'],
 ['RDM Campus, Albeda, Róterdam, La Haya y Ámsterdam','Visitas formativas y culturales']
 ]:[
 ['2,5 meses','Duración orientativa'],['2.º curso de ciclos de grado medio y superior','Participantes previstos'],
 ['FEOE','Formación en empresa u organismo equiparado'],['Portugal y Países Bajos','Destinos según familia profesional'],
 ['Autonomía personal y profesional','Objetivo central'],['Enriqueciendo vidas – Abriendo mentes','Lema compartido']
 ];
 const summary=short?'Convivencia, visitas a centros formativos y actividades de intercambio lingüístico con estudiantes de Formación Profesional.':
 'Experiencia ampliada de prácticas profesionales, inserción en el tejido productivo europeo y desarrollo de competencias personales y laborales.';
 const output=heading('MODALIDAD ERASMUS+',title,summary)+
 '<div class="mobility-facts">'+facts.map(([value,label])=>'<article class="card"><strong>'+E(value)+'</strong><span>'+E(label)+'</span></article>').join('')+'</div>'+
 panel('Experiencia de aprendizaje','<p>'+E(summary)+'</p><p>El programa definitivo de actividades y los acuerdos de aprendizaje se facilitarán una vez confirmadas las plazas y las instituciones.</p>')+
 '<a class="btn" href="/candidatura">Ir a candidatura</a>';
 api.layout(req,title,output);
}
export async function infoRoutes(req,url,method,api){
 const dest=/^\/destinos\/(viseu|oporto|roterdam)$/.exec(url);
 const mob=/^\/movilidad\/(corta|larga)$/.exec(url);
 if(!dest&&!mob&&url!=='/normativa/completa')return false;
 if(method!=='GET'){api.error(req,405,'Método no permitido.');return true;}
 if(!api.mustLogin(req))return true;
 if(dest)infoPage(req,api,dest[1]);else if(mob)mobilityDetail(req,api,mob[1]);else normative(req,api);
 return true;
}
