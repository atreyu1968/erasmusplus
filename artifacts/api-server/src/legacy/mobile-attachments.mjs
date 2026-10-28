import { chmodSync, existsSync, unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { all, get, run } from './db.mjs';
import { clean, docsDir } from './feature-service.mjs';

const MAX_ATTACHMENT_BYTES = 6 * 1024 * 1024;
const formats = {
  'application/pdf': { ext: 'pdf', kind: 'file' },
  'image/png': { ext: 'png', kind: 'file' },
  'image/jpeg': { ext: 'jpg', kind: 'file' },
  'image/webp': { ext: 'webp', kind: 'file' },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { ext: 'docx', kind: 'file' },
  'audio/webm': { ext: 'webm', kind: 'audio' },
  'audio/mp4': { ext: 'm4a', kind: 'audio' },
  'audio/ogg': { ext: 'ogg', kind: 'audio' },
  'audio/wav': { ext: 'wav', kind: 'audio' },
  'audio/x-wav': { ext: 'wav', kind: 'audio' },
  'audio/mpeg': { ext: 'mp3', kind: 'audio' }
};
const invalidAttachment = message => Object.assign(new Error(message), { status: 400 });

function matchesFormat(bytes, ext) {
  if (ext === 'pdf') return bytes.subarray(0, 5).equals(Buffer.from('%PDF-'));
  if (ext === 'png') return bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (ext === 'jpg') return bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  if (ext === 'webp') return bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
  if (ext === 'docx') return bytes.toString('ascii', 0, 2) === 'PK';
  if (ext === 'webm') return bytes.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
  if (ext === 'ogg') return bytes.toString('ascii', 0, 4) === 'OggS';
  if (ext === 'm4a') return bytes.toString('ascii', 4, 8) === 'ftyp';
  if (ext === 'wav') return bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WAVE';
  if (ext === 'mp3') return bytes.toString('ascii', 0, 3) === 'ID3' || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0);
  return false;
}

export async function saveMobileAttachment(file, { ownerId = null, groupId = null } = {}) {
  if (!file || typeof file.arrayBuffer !== 'function' || !file.name) {
    throw invalidAttachment('Selecciona un archivo válido.');
  }
  if (file.size < 1 || file.size > MAX_ATTACHMENT_BYTES) {
    throw invalidAttachment('Cada archivo debe pesar como máximo 6 MB.');
  }
  const mime = String(file.type || '').toLowerCase();
  const format = formats[mime];
  if (!format) throw invalidAttachment('Formato no permitido. Usa PDF, imagen, DOCX o un audio compatible.');
  const bytes = Buffer.from(await file.arrayBuffer());
  if (bytes.length !== file.size || !matchesFormat(bytes, format.ext)) {
    throw invalidAttachment('El contenido del archivo no coincide con su formato.');
  }
  const storedName = crypto.randomBytes(24).toString('hex') + '.' + format.ext;
  const filePath = path.join(docsDir, storedName);
  writeFileSync(filePath, bytes, { flag: 'wx', mode: 0o600 });
  try {
    chmodSync(filePath, 0o600);
    const originalName = clean(file.name, 160).replace(/[/\\\u0000-\u001f]/g, '_');
    const result = run(
      'INSERT INTO files(owner_id,group_id,original_name,stored_name,mime,bytes,sha256) VALUES (?,?,?,?,?,?,?)',
      ownerId, groupId, originalName, storedName, mime, bytes.length,
      crypto.createHash('sha256').update(bytes).digest('hex')
    );
    return {
      id: Number(result.lastInsertRowid),
      originalName,
      mime,
      bytes: bytes.length,
      kind: format.kind
    };
  } catch (error) {
    unlinkSync(filePath);
    throw error;
  }
}

export function linkMobileAttachment(messageId, fileId) {
  run('INSERT INTO mobile_message_attachments(message_id,file_id) VALUES (?,?)', messageId, fileId);
}

export function mobileMessageAttachments(messageId) {
  return all(
    `SELECT f.id,f.original_name,f.mime,f.bytes
       FROM mobile_message_attachments ma JOIN files f ON f.id=ma.file_id
      WHERE ma.message_id=? ORDER BY ma.id`,
    messageId
  ).map(file => ({
    id: file.id,
    name: file.original_name,
    mime: file.mime,
    bytes: file.bytes,
    kind: file.mime.startsWith('audio/') ? 'audio' : 'file',
    downloadUrl: '/api/mobile/messages/attachments/' + file.id
  }));
}

export function mobileMessageAttachment(id) {
  return get(
    `SELECT f.*,m.id AS message_id,m.sender_id,m.receiver_id,m.group_id
       FROM files f
       JOIN mobile_message_attachments ma ON ma.file_id=f.id
       JOIN messages m ON m.id=ma.message_id
      WHERE f.id=?`,
    id
  ) || null;
}

export function discardMobileAttachment(fileId) {
  const file = get('SELECT stored_name FROM files WHERE id=?', fileId);
  if (file && /^[a-f0-9]{48}\.(pdf|jpg|png|webp|docx|webm|m4a|ogg|wav|mp3)$/.test(file.stored_name)) {
    const filePath = path.join(docsDir, file.stored_name);
    if (existsSync(filePath)) unlinkSync(filePath);
  }
  run('DELETE FROM files WHERE id=?', fileId);
}
