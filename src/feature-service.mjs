import { mkdirSync, writeFileSync, readFileSync, unlinkSync, chmodSync, existsSync } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { Readable } from 'node:stream';
import { db,get,all,run,audit } from './db.mjs';
import { makePdf,digest } from './pdf.mjs';
import { sendMail } from './mailer.mjs';
import './feature-db.mjs';

export const root=path.resolve(process.env.MMG_DATA_DIR||'./data');
export const docsDir=path.join(root,'documents');
mkdirSync(docsDir,{recursive:true,mode:0o700});
try {chmodSync(docsDir,0o700);}catch{}
export const isAdmin=u=>u?.role==='coordinator';
export const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
export const clean=(v,max=200)=>String(v??'').trim().slice(0,max);
export const validId=v=>Number.isSafeInteger(Number(v))&&Number(v)>0?Number(v):null;
export const schoolFamilies=['Imagen personal','Transporte y mantenimiento de vehículos','Administración y gestión','Agraria','Edificación y obra civil'];
export const destinations=['Viseu','Oporto','Róterdam'];
export function select(name,items,value='') {
  return '<select name="'+name+'">'+items.map(i=>'<option value="'+escape(i)+'"'+(i===value?' selected':'')+'>'+escape(i)+'</option>').join('')+'</select>';
}
export function input(name,value='',type='text',max=500) {
 return '<input type="'+type+'" name="'+name+'" maxlength="'+max+'" value="'+escape(value)+'">';
}
export function formEnd(csrf,label) {return '<input type="hidden" name="csrf" value="'+escape(csrf)+'"><button class="btn" type="submit">'+escape(label)+'</button></form>';}
export function panel(title,body) {return '<div class="card"><h2>'+escape(title)+'</h2>'+body+'</div>';}
export function heading(label,title,description) {return '<div class="heading"><p class="eyebrow">'+escape(label)+'</p><h1>'+escape(title)+'</h1><p>'+escape(description)+'</p></div>';}
export function datatable(headers,rows) {
 return '<div class="responsive"><table><thead><tr>'+headers.map(h=>'<th>'+escape(h)+'</th>').join('')+'</tr></thead><tbody>'+rows.join('')+'</tbody></table></div>';
}
export function paper(title,rows,note='') {
 const bytes=makePdf({title,rows,note});
 const name=crypto.randomBytes(24).toString('hex')+'.pdf';
 const full=path.join(docsDir,name);
 writeFileSync(full,bytes,{flag:'wx',mode:0o600});
 return {name,hash:digest(bytes),bytes};
}
export function safeDocument(name) {
 if(!/^[a-f0-9]{48}\.pdf$/.test(name))throw Error('Archivo no autorizado.');
 return readFileSync(path.join(docsDir,name));
}
export function deleteDocument(name) {
 if(!/^[a-f0-9]{48}\.pdf$/.test(name))throw Error('Archivo no autorizado.');
 const full=path.join(docsDir,name);
 if(existsSync(full))unlinkSync(full);
}
export async function multipart(req) {
 const limit=8*1024*1024;
 let count=0;
 const content=[];
 for await(const b of req){count+=b.length;if(count>limit)throw Error('Archivo demasiado grande. Máximo 8 MB.');content.push(b);}
 const request=new Request('http://localhost/upload',{method:'POST',headers:{'Content-Type':req.headers['content-type']||''},body:Buffer.concat(content)});
 return request.formData();
}
export async function storeUpload(file,{ownerId=null,noticeId=null,groupId=null}={}){
 if(!file||typeof file.arrayBuffer!=='function'||!file.name)return null;
 if(file.size>6*1024*1024||file.size<=0)throw Error('El documento debe pesar entre 1 B y 6 MB.');
 const types={'application/pdf':'.pdf','image/png':'.png','image/jpeg':'.jpg','image/webp':'.webp',
 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':'.docx'};
 const ext=types[file.type];
 if(!ext)throw Error('Formato no permitido. Sube PDF, PNG, JPG, WEBP o DOCX.');
 const bytes=Buffer.from(await file.arrayBuffer());
 if(ext==='.pdf'&&!bytes.subarray(0,5).equals(Buffer.from('%PDF-')))throw Error('El archivo no parece ser un PDF.');
 if(ext==='.png'&&!bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))throw Error('PNG no válido.');
 if(ext==='.jpg'&&!(bytes[0]===255&&bytes[1]===216&&bytes[2]===255))throw Error('JPEG no válido.');
 if(ext==='.webp'&&!(bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP'))throw Error('WEBP no válido.');
 if(ext==='.docx'&&bytes.toString('ascii',0,2)!=='PK')throw Error('DOCX no válido.');
 const name=crypto.randomBytes(24).toString('hex')+ext;
 writeFileSync(path.join(docsDir,name),bytes,{flag:'wx',mode:0o600});
 const hash=digest(bytes);
 const original=clean(file.name,160).replace(/[/\\\u0000-\u001f]/g,'_');
 const result=run("INSERT INTO files(owner_id,notice_id,group_id,original_name,stored_name,mime,bytes,sha256) VALUES (?,?,?,?,?,?,?,?)",
 ownerId,noticeId,groupId,original,name,file.type,bytes.length,hash);
 return Number(result.lastInsertRowid);
}
export function attachment(id,user){
 const f=get('SELECT * FROM files WHERE id=?',id);
 if(!f)return null;
 if(isAdmin(user)||f.owner_id===user.id)return f;
 if(f.notice_id){
  const n=get('SELECT audience FROM notices WHERE id=?',f.notice_id);
  if(n && (n.audience==='all'||n.audience===user.role))return f;
 }
 if(f.group_id && get('SELECT 1 FROM group_members WHERE group_id=? AND user_id=?',f.group_id,user.id))return f;
 return null;
}
export function readAttachment(f) {
 // DB is authoritative; never trust request path or user-supplied name.
 if(!/^[a-f0-9]{48}\.(pdf|jpg|png|webp|docx)$/.test(f.stored_name))throw Error('Ruta inválida.');
 return readFileSync(path.join(docsDir,f.stored_name));
}
export function queueMail(to,subject,body) {
 if(!to)return;
 run('INSERT INTO outbox(to_email,subject,body) VALUES (?,?,?)',clean(to,200),clean(subject,160),clean(body,5000));
}
let busy=false;
export async function deliverOutbox() {
 if(busy)return;
 busy=true;
 try {
   const batch=all("SELECT * FROM outbox WHERE status='pending' AND attempts<3 ORDER BY id LIMIT 4");
   for(const job of batch){
     try {await sendMail(job.to_email,job.subject,job.body);
       run("UPDATE outbox SET status='sent',sent_at=CURRENT_TIMESTAMP,attempts=attempts+1,body='[enviado]' WHERE id=?",job.id);
     }catch(e){
       run("UPDATE outbox SET attempts=attempts+1,status=CASE WHEN attempts+1>=3 THEN 'failed' ELSE 'pending' END,last_error=? WHERE id=?",clean(e.message,200),job.id);
     }
   }
 }finally {busy=false;}
}
export function startMailWorker() {
 const interval=setInterval(()=>deliverOutbox().catch(e=>console.error('Cola de correo:',e.message)),25000);
 interval.unref();
}
