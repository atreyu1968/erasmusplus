import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

// Original model, with genuine AcroForm fields. Built at request time on the
// server, so each download may be prefilling the current (authenticated) pupil.
const C={
  navy:rgb(0.07,0.23,0.42),
  blue:rgb(0.12,0.42,0.69),
  cyan:rgb(0.38,0.75,0.84),
  text:rgb(0.13,0.22,0.34),
  muted:rgb(0.40,0.50,0.62),
  light:rgb(0.91,0.96,0.99),
  white:rgb(1,1,1),
  border:rgb(0.72,0.82,0.91)
};
const W=595.28,H=841.89;

function wrapped(text,font,size,maxWidth){
  const result=[];
  for(const paragraph of String(text).split('\n')){
    let row='';
    for(const word of paragraph.split(/\s+/).filter(Boolean)){
      const attempt=(row?row+' ':'')+word;
      if(row && font.widthOfTextAtSize(attempt,size)>maxWidth){
        result.push(row);row=word;
      }else row=attempt;
    }
    result.push(row||'');
  }
  return result;
}
function lines(page,text,{x=44,y,width=507,size=10,lineHeight=15,font,color=C.text}={}){
  let pos=y;
  for(const line of wrapped(text,font,size,width)){
    if(line)page.drawText(line,{x,y:pos,size,font,color});
    pos-=lineHeight;
  }
  return pos;
}
function standardHeader(page,font,bold,pageNum){
  page.drawRectangle({x:0,y:H-120,width:W,height:120,color:C.navy});
  page.drawRectangle({x:42,y:H-92,width:63,height:60,color:C.cyan,borderRadius:12});
  page.drawText('MMG+', {x:49,y:H-71,size:17,font:bold,color:C.white});
  page.drawText('MOVILIDADES ERASMUS+ MMG',{x:123,y:H-57,size:18.7,font:bold,color:C.white});
  page.drawText('IES Manuel Martín González  ·  Guía de Isora, Tenerife',
    {x:123,y:H-82,size:10,font,color:C.white});
  page.drawRectangle({x:42,y:H-144,width:511,height:17,color:C.light});
  page.drawText('MODELO DE AUTORIZACIÓN  ·  CURSO 2026-2027  ·  SUJETO A VALIDACIÓN',
    {x:49,y:H-139,size:9.0,font:bold,color:C.navy});
  page.drawText('Modelo de trabajo. No sustituye autorizaciones oficiales de viaje ni requisitos Erasmus+.',
    {x:44,y:50,size:8,font,color:C.muted});
  page.drawText('Página '+pageNum+' de 2',{x:493,y:50,size:8.6,font:bold,color:C.muted});
}
function section(page,font,title,y){
  page.drawLine({start:{x:44,y:y+13},end:{x:551,y:y+13},thickness:1,color:C.border});
  page.drawText(title,{x:44,y:y-1,font,size:12,color:C.navy});
}
function formField(form,page,{name,label,x,y,width,value='',required=false}){
  const normal=page._mmgFont;
  page.drawText(label+(required?' *':''),{x,y:y+33,font:page._mmgBold,size:9.5,color:C.text});
  const field=form.createTextField(name);
  field.setFontSize(11);
  if(value)field.setText(value);
  field.addToPage(page,{x,y,width,height:25,borderWidth:1,borderColor:C.border,
    backgroundColor:C.white,textColor:C.navy});
  return field;
}
export async function makeFillableGuardianPdf(user={}){
  const pdf=await PDFDocument.create();
  pdf.setTitle('Autorización del representante legal - Erasmus+ MMG - Formulario rellenable');
  pdf.setSubject('Formulario AcroForm para cumplimentar en móvil, tableta u ordenador');
  pdf.setAuthor('Movilidades Erasmus+ MMG - modelo de revisión');
  pdf.setLanguage('es-ES');
  const normal=await pdf.embedFont(StandardFonts.Helvetica);
  const bold=await pdf.embedFont(StandardFonts.HelveticaBold);
  const form=pdf.getForm();
  const p1=pdf.addPage([W,H]);p1._mmgFont=normal;p1._mmgBold=bold;
  const p2=pdf.addPage([W,H]);
  standardHeader(p1,normal,bold,1);
  standardHeader(p2,normal,bold,2);
  p1.drawText('AUTORIZACIÓN DEL PADRE, MADRE O TUTOR/A LEGAL',
    {x:44,y:658,font:bold,size:16,color:C.navy});

  formField(form,p1,{name:'menor_nombre',label:'Nombre y apellidos del alumno/a',x:44,y:585,width:507,
    value:[user.first_name,user.last_name].filter(Boolean).join(' '),required:true});
  formField(form,p1,{name:'menor_nacimiento',label:'Fecha de nacimiento (dd/mm/aaaa)',x:44,y:527,width:239,
    value:user.birth_date?String(user.birth_date).split('-').reverse().join('/'):'' ,required:true});
  formField(form,p1,{name:'menor_estudios',label:'Curso / ciclo formativo',x:307,y:527,width:244,
    value:user.studies||''});

  section(p1,normal,'DATOS DE LA PERSONA QUE FIRMA',495);
  formField(form,p1,{name:'representante_nombre',label:'Nombre y apellidos del representante',x:44,y:433,width:507,required:true});
  formField(form,p1,{name:'representante_documento',label:'DNI / NIE / Pasaporte del representante',x:44,y:374,width:239,required:true});
  formField(form,p1,{name:'representante_telefono',label:'Teléfono de contacto',x:307,y:374,width:244,required:true});

  p1.drawText('Relación con el menor (marcar una opción):',
    {x:44,y:347,size:10,font:bold,color:C.text});
  const radio=form.createRadioGroup('representante_relacion');
  const choices=[['Padre',44],['Madre',168],['Tutor/a legal',297],['Otro',455]];
  for(const [name,x] of choices){
    radio.addOptionToPage(name,p1,{
      x,y:317,width:16,height:16,borderColor:C.blue,borderWidth:1,
      backgroundColor:C.white,color:C.blue
    });
    p1.drawText(name,{x:x+22,y:321,font:normal,size:10,color:C.text});
  }
  p1.drawRectangle({x:44,y:198,width:507,height:102,color:C.light});
  p1.drawText('DECLARACIÓN',{x:57,y:281,size:11.5,font:bold,color:C.navy});
  const declaration=[
    'Declaro que ostento la patria potestad, tutela o representación legal suficiente para esta',
    'autorización, y que puedo acreditarla si el centro lo solicita.',
    'He recibido o tengo a disposición el aviso de privacidad del proyecto Erasmus+ MMG.',
    'Autorizo los trámites de candidatura y preparación de la movilidad, sin perjuicio de',
    'autorizaciones de viaje, prácticas y otras que sean necesarias.'
  ];
  let dy=264;
  for(const line of declaration){
    p1.drawText(line,{x:57,y:dy,size:8.6,font:normal,color:C.text});dy-=15;
  }
  formField(form,p1,{name:'lugar_fecha',label:'Lugar y fecha de firma',x:44,y:155,width:507,required:true});
  p1.drawText('Firma del representante legal:',{x:44,y:139,size:10,font:bold,color:C.navy});
  p1.drawRectangle({x:44,y:66,width:507,height:64,color:C.white,
    borderColor:C.border,borderWidth:1});
  p1.drawText('Use la herramienta "Rellenar y firmar" del dispositivo, o imprima y firme.',
    {x:55,y:78,size:8.2,font:normal,color:C.muted});

  // Page two: explanatory information. Reflow text to avoid clipping.
  p2.drawText('INFORMACIÓN Y PRESENTACIÓN DEL DOCUMENTO',
    {x:44,y:657,font:bold,size:16,color:C.navy});
  let y=622;
  const sections=[
    ['1. CÓMO COMPLETARLO',
      'Abra el PDF descargado en un lector compatible con formularios (por ejemplo, Adobe Acrobat Reader). Toque los campos para escribir y seleccione la relación familiar. Los datos del menor pueden aparecer prerrellenados: revíselos.'],
    ['2. FIRMA DESDE EL DISPOSITIVO',
      'Para firmar, use la herramienta de firma del lector PDF, que permite dibujar la firma en la zona reservada. También puede imprimir, firmar, escanear y subir un PDF legible. Una firma dibujada por sí sola no acredita la identidad del representante.'],
    ['3. PROTECCIÓN DE DATOS',
      'Se aplica el RGPD y la Ley Orgánica 3/2018. El aviso de privacidad definitivo identificará al responsable, delegado de protección de datos, fines, legitimación, destinatarios y plazos de conservación. El modelo requiere validación institucional antes de uso con datos reales.'],
    ['4. ENTREGA DEL DOCUMENTO',
      'Guarde el PDF después de completar los campos y de firmarlo. Súbalo únicamente al área segura de autorizaciones de menores de Movilidades Erasmus+ MMG. Tamaño máximo previsto: 6 MB. Evite enviar documentos personales mediante chats o correo ordinario.'],
    ['5. REVISIÓN DEL CENTRO',
      'La entrega quedará pendiente. Coordinación revisará la firma y la representación legal siguiendo el protocolo del centro. Podrá solicitar información complementaria por un canal específico. La cuenta solo se aprobará después de la verificación del correo y de la autorización.'],
    ['6. CONSENTIMIENTOS Y AUTORIZACIONES ADICIONALES',
      'Este documento no sustituye la autorización oficial de viaje de menores ni otras autorizaciones del programa. Fotografías, datos especialmente protegidos y finalidades opcionales deben gestionarse de forma separada cuando corresponda.']
  ];
  for(const [title,description] of sections){
    p2.drawText(title,{x:44,y,size:10.7,font:bold,color:C.navy});y-=19;
    y=lines(p2,description,{x:44,y,width:507,font:normal,size:9.7,lineHeight:15});
    y-=24;
  }
  p2.drawText('Referencias: Reglamento (UE) 2016/679, Ley Orgánica 3/2018 y AEPD.',
    {x:44,y:95,size:9,font:normal,color:C.muted});
  form.updateFieldAppearances(normal);
  return Buffer.from(await pdf.save({useObjectStreams:false}));
}
