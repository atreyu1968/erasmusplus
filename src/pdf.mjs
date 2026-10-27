import { createHash } from 'node:crypto';

// Multi-page PDF in WinAnsi built with core Node.js, without a signing certificate.
const sanitize = value => String(value ?? '')
  .normalize('NFKC').replace(/[^\x20-\x7e\u00a1-\u00ff\n]/g,'?').replace(/\r/g,'');
const pdfEscape = s => sanitize(s).replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)');
function wrap(text, length=88) {
  const out=[];
  for(const block of sanitize(text).split('\n')) {
    let line='';
    for(const word of block.split(/\s+/)) {
      if ((line+' '+word).trim().length > length) { if (line) out.push(line); line=''; }
      if (word.length>length) {
        if (line) out.push(line);
        for(let i=0;i<word.length;i+=length) out.push(word.slice(i,i+length));
        line='';
      } else line+=(line?' ':'')+word;
    }
    out.push(line||' ');
  }
  return out;
}
function streamFor(lines,pageNum,total) {
  const list=[
   'BT','/F1 16 Tf','50 798 Td','('+pdfEscape('MOVILIDADES ERASMUS+ MMG')+') Tj','ET',
   'BT','/F1 9 Tf','50 776 Td','('+pdfEscape('IES Manuel Martín González - Guía de Isora')+') Tj','ET'
  ];
  let y=749;
  for(const line of lines) {
    list.push('BT','/F1 10 Tf','50 '+y+' Td','('+pdfEscape(line)+') Tj','ET');
    y-=15;
  }
  list.push('BT','/F1 9 Tf','50 40 Td','('+pdfEscape('Página '+pageNum+' de '+total+' | Documento registrado electrónicamente')+') Tj','ET');
  return Buffer.from(list.join('\n')+'\n','latin1');
}
export function makePdf({title,rows=[],note=''}) {
  const lines=wrap(title.toUpperCase(),70);
  lines.push(' ');
  for(const [key,value] of rows) {
    lines.push(...wrap(key+': '+String(value??''),90));
    lines.push(' ');
  }
  if(note) lines.push(...wrap(note));
  const chunks=[];
  while(lines.length)chunks.push(lines.splice(0,43));
  if(!chunks.length)chunks.push(['Sin información']);
  const pages=chunks.length;
  const objects=[null,
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Count '+pages+' /Kids ['+chunks.map((_,i)=>(3+i*2)+' 0 R').join(' ')+'] >>'
  ];
  let i=0;
  for(const chunk of chunks) {
    const pageId=3+i*2,contentId=pageId+1;
    objects[pageId]='<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 '+(3+pages*2)+' 0 R >> >> /Contents '+contentId+' 0 R >>';
    const stream=streamFor(chunk,i+1,pages);
    objects[contentId]=Buffer.concat([Buffer.from('<< /Length '+stream.length+' >>\nstream\n'),stream,Buffer.from('endstream')]);
    i++;
  }
  objects[3+pages*2]='<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
  const buffers=[Buffer.from('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n','latin1')];
  const offsets=[0];
  let offset=buffers[0].length;
  for(let id=1;id<objects.length;id++) {
    offsets[id]=offset;
    const head=Buffer.from(id+' 0 obj\n'),tail=Buffer.from('\nendobj\n');
    const body=Buffer.isBuffer(objects[id])?objects[id]:Buffer.from(objects[id],'latin1');
    const buf=Buffer.concat([head,body,tail]);
    buffers.push(buf);offset+=buf.length;
  }
  const xrefOffset=offset;
  const xref=['xref','0 '+objects.length,'0000000000 65535 f '];
  for(let id=1;id<objects.length;id++)xref.push(String(offsets[id]).padStart(10,'0')+' 00000 n ');
  xref.push('trailer','<< /Size '+objects.length+' /Root 1 0 R >>','startxref',String(xrefOffset),'%%EOF');
  buffers.push(Buffer.from(xref.join('\n')+'\n'));
  return Buffer.concat(buffers);
}
export const digest = bytes => createHash('sha256').update(bytes).digest('hex');
