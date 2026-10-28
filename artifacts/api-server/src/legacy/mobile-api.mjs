import { all, audit, get, run } from './db.mjs';
import {
  canTry, countTry, cookie, csrfToken, deleteSession, newSessionData,
  validCsrf, verifyPassword
} from './auth.mjs';
import {
  activeEdition, clean, editionForUser, queueMail
} from './feature-service.mjs';
import {
  mobilePushConfig, removeMobilePushSubscription,
  saveMobilePushSubscription, sendMobilePush
} from './mobile-push.mjs';
import { logger } from '../lib/runtime-logger.mjs';

const jsonType = 'application/json; charset=utf-8';

function json(req, api, status, data, headers = {}) {
  api.raw(req, status, Buffer.from(JSON.stringify(data)), jsonType, headers);
}
function noContent(req, api, headers = {}) {
  api.raw(req, 204, Buffer.from(''), jsonType, headers);
}
function error(req, api, status, message) {
  json(req, api, status, { error: message });
}
function validBodyCsrf(req, body) {
  return validCsrf(req, { csrf: String(body?.csrfToken || '') });
}
function validPasskeyCsrf(req, body) {
  return validCsrf(req, { csrf: String(body?.csrf || '') });
}
function safeUser(user) {
  if (!user) return null;
  const edition = user.role === 'coordinator'
    ? activeEdition()
    : user.edition_id
      ? get('SELECT id,label FROM erasmus_editions WHERE id=?', user.edition_id)
      : null;
  return {
    id: user.id,
    firstName: user.first_name,
    lastName: user.last_name,
    role: user.role,
    editionLabel: edition?.label || null
  };
}
function safeSession(req, api, headers = {}) {
  const csrf = csrfToken(req);
  if (!req.auth && csrf.setCookie) headers['Set-Cookie'] = csrf.setCookie;
  json(req, api, 200, {
    authenticated: Boolean(req.auth),
    csrfToken: csrf.token,
    user: safeUser(req.auth?.user)
  }, headers);
}
function requireUser(req, api) {
  if (req.auth?.user) return req.auth.user;
  error(req, api, 401, 'Inicia sesión para continuar.');
  return null;
}
async function readJson(req) {
  const type = String(req.headers['content-type'] || '').toLowerCase();
  if (!type.startsWith('application/json')) {
    const err = new Error('Se esperaba una solicitud JSON.');
    err.status = 415;
    throw err;
  }
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 32768) {
      const err = new Error('La solicitud supera el tamaño permitido.');
      err.status = 413;
      throw err;
    }
    chunks.push(chunk);
  }
  if (!size) return {};
  try {
    const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error();
    return parsed;
  } catch {
    const err = new Error('El cuerpo JSON no es válido.');
    err.status = 400;
    throw err;
  }
}
function handleFailure(req, api, err) {
  const status = Number.isInteger(err?.status) ? err.status : 500;
  if (status === 500) {
    logger.error({ error: err?.message || 'unknown' }, 'Mobile API request failed');
  }
  error(req, api, status, status === 500 ? 'No se pudo completar la solicitud.' : err.message);
}
function assignedEditionId(user) {
  return user.role === 'coordinator' ? activeEdition()?.id || null : user.edition_id || null;
}
function dashboardFor(user) {
  const editionId = assignedEditionId(user);
  const member = user.role !== 'coordinator';
  const applications = member
    ? all(
      `SELECT a.id,a.mobility,a.destination,a.status,e.label AS edition_label,r.decision
         FROM applications a
         LEFT JOIN erasmus_editions e ON e.id=a.edition_id
         LEFT JOIN application_reviews r ON r.application_id=a.id
        WHERE a.user_id=? ORDER BY a.id DESC LIMIT 30`,
      user.id
    ).map(row => ({
      id: row.id,
      mobility: row.mobility,
      editionLabel: row.edition_label || null,
      destination: row.destination,
      status: row.status,
      decision: row.decision || null
    }))
    : [];

  let groups = [];
  if (editionId && user.role === 'coordinator') {
    groups = all(
      `SELECT g.id,g.name,g.destination,g.type,e.label AS edition_label
         FROM mobility_groups g JOIN erasmus_editions e ON e.id=g.edition_id
        WHERE g.edition_id=? ORDER BY g.id DESC LIMIT 30`,
      editionId
    );
  } else if (editionId) {
    groups = all(
      `SELECT g.id,g.name,g.destination,g.type,e.label AS edition_label
         FROM mobility_groups g JOIN erasmus_editions e ON e.id=g.edition_id
         JOIN group_members gm ON gm.group_id=g.id
        WHERE gm.user_id=? AND g.edition_id=? ORDER BY g.id DESC LIMIT 30`,
      user.id, editionId
    );
  }
  groups = groups.map(group => ({
    id: group.id,
    name: group.name,
    destination: group.destination,
    type: group.type,
    editionLabel: group.edition_label
  }));

  const groupScope = user.role === 'coordinator'
    ? 'g.edition_id=?'
    : 'g.edition_id=? AND gm.user_id=?';
  const groupParams = user.role === 'coordinator' ? [editionId] : [editionId, user.id];
  const events = editionId ? all(
    `SELECT e.id,e.title,e.kind,e.start_time,e.end_time,e.location,g.name AS group_name
       FROM mobility_events e JOIN mobility_groups g ON g.id=e.group_id
       ${user.role === 'coordinator' ? '' : 'JOIN group_members gm ON gm.group_id=g.id'}
      WHERE ${groupScope} AND e.start_time>=?
      ORDER BY e.start_time LIMIT 10`,
    ...groupParams, new Date().toISOString().slice(0, 16)
  ).map(row => ({
    id: row.id,
    title: row.title,
    kind: row.kind,
    startTime: row.start_time,
    endTime: row.end_time || null,
    location: row.location || '',
    groupName: row.group_name
  })) : [];

  const tasks = editionId ? all(
    `SELECT t.id,t.title,t.description,t.due_date,g.name AS group_name,
            CASE WHEN c.task_id IS NULL THEN 0 ELSE 1 END AS completed
       FROM mobility_tasks t JOIN mobility_groups g ON g.id=t.group_id
       ${user.role === 'coordinator' ? '' : 'JOIN group_members gm ON gm.group_id=g.id'}
       LEFT JOIN mobility_task_completions c ON c.task_id=t.id AND c.user_id=?
      WHERE ${groupScope}
      ORDER BY t.due_date IS NULL,t.due_date,t.id DESC LIMIT 50`,
    user.role === 'coordinator' ? -1 : user.id,
    ...groupParams
  ).map(row => ({
    id: row.id,
    title: row.title,
    description: row.description,
    dueDate: row.due_date || null,
    completed: Boolean(row.completed),
    groupName: row.group_name
  })) : [];

  const notices = all(
    `SELECT id,title,body,created_at FROM notices
      WHERE audience='all' OR audience=? ORDER BY id DESC LIMIT 5`,
    user.role
  ).map(row => ({
    id: row.id,
    title: row.title,
    body: row.body,
    createdAt: row.created_at
  }));

  const pendingTasks = editionId ? get(
    `SELECT COUNT(*) AS n FROM mobility_tasks t
       JOIN mobility_groups g ON g.id=t.group_id
       ${user.role === 'coordinator' ? '' : 'JOIN group_members gm ON gm.group_id=g.id'}
       ${user.role === 'coordinator' ? '' : 'LEFT JOIN mobility_task_completions c ON c.task_id=t.id AND c.user_id=?'}
      WHERE ${groupScope} ${user.role === 'coordinator' ? '' : 'AND c.task_id IS NULL'}`,
    ...(user.role === 'coordinator' ? groupParams : [user.id, ...groupParams])
  ).n : 0;
  const pendingApplicants = user.role === 'coordinator' ? get(
    `SELECT COUNT(*) AS n FROM applications a
       LEFT JOIN application_reviews r ON r.application_id=a.id
      WHERE a.status='submitted' AND r.application_id IS NULL
        AND (? IS NULL OR a.edition_id=?)`,
    editionId, editionId
  ).n : 0;
  const noticeCount = get(
    "SELECT COUNT(*) AS n FROM notices WHERE audience='all' OR audience=?",
    user.role
  ).n;
  return {
    user: safeUser(user),
    summary: {
      applications: user.role === 'coordinator'
        ? get(
          "SELECT COUNT(*) AS n FROM applications WHERE status='submitted' AND (? IS NULL OR edition_id=?)",
          editionId, editionId
        ).n
        : applications.length,
      groups: groups.length,
      pendingTasks,
      upcomingEvents: events.length,
      notices: noticeCount,
      pendingApplicants
    },
    applications,
    groups,
    events,
    tasks,
    notices
  };
}
function mobileDocuments(user) {
  const editionId = assignedEditionId(user);
  const files = user.role === 'coordinator'
    ? all(
      `SELECT DISTINCT f.id,f.original_name,f.mime,f.bytes,f.created_at,
              CASE WHEN f.group_id IS NOT NULL THEN COALESCE(g.name,'Documento de grupo')
                   WHEN f.notice_id IS NOT NULL THEN COALESCE(n.title,'Aviso del centro')
                   ELSE 'Documento personal' END AS source
         FROM files f
         LEFT JOIN mobility_groups g ON g.id=f.group_id
         LEFT JOIN notices n ON n.id=f.notice_id
        ORDER BY f.created_at DESC LIMIT 100`
    )
    : all(
      `SELECT DISTINCT f.id,f.original_name,f.mime,f.bytes,f.created_at,
              CASE WHEN f.owner_id=? THEN 'Documento personal'
                   WHEN f.group_id IS NOT NULL THEN COALESCE(g.name,'Documento de grupo')
                   ELSE COALESCE(n.title,'Aviso del centro') END AS source
         FROM files f
         LEFT JOIN mobility_groups g ON g.id=f.group_id
         LEFT JOIN notices n ON n.id=f.notice_id
        WHERE f.owner_id=?
           OR (f.group_id IS NOT NULL AND EXISTS (
                SELECT 1 FROM group_members gm JOIN mobility_groups mg ON mg.id=gm.group_id
                 WHERE gm.group_id=f.group_id AND gm.user_id=? AND mg.edition_id=?))
           OR (f.notice_id IS NOT NULL AND EXISTS (
                SELECT 1 FROM notices vn WHERE vn.id=f.notice_id
                  AND (vn.audience='all' OR vn.audience=?)))
        ORDER BY f.created_at DESC LIMIT 100`,
      user.id, user.id, user.id, editionId || -1, user.role
    );
  return {
    documents: files.map(file => ({
      id: file.id,
      name: file.original_name,
      mime: file.mime,
      bytes: file.bytes,
      createdAt: file.created_at,
      source: file.source,
      downloadUrl: '/api/legacy/archivo/' + file.id
    }))
  };
}
function directContacts(user) {
  if (user.role === 'coordinator') {
    return all(
      `SELECT id,first_name,last_name,role,edition_id FROM users
        WHERE status='approved' AND id<>? ORDER BY first_name,last_name LIMIT 200`,
      user.id
    );
  }
  if (!user.edition_id) {
    return all(
      `SELECT id,first_name,last_name,role,edition_id FROM users
        WHERE status='approved' AND role='coordinator' ORDER BY first_name,last_name LIMIT 20`
    );
  }
  return all(
    `SELECT DISTINCT u.id,u.first_name,u.last_name,u.role,u.edition_id FROM users u
      WHERE u.status='approved' AND u.id<>? AND
        (u.role='coordinator' OR (u.edition_id=? AND EXISTS (
          SELECT 1 FROM group_members a JOIN group_members b ON b.group_id=a.group_id
          JOIN mobility_groups g ON g.id=a.group_id
          WHERE a.user_id=? AND b.user_id=u.id AND g.edition_id=?)))
      ORDER BY u.first_name,u.last_name LIMIT 200`,
    user.id, user.edition_id, user.id, user.edition_id
  );
}
function conversationGroups(user) {
  if (user.role === 'coordinator') {
    return all(
      `SELECT g.id,g.name,g.destination,e.label AS edition_label
         FROM mobility_groups g JOIN erasmus_editions e ON e.id=g.edition_id
        ORDER BY e.label DESC,g.name COLLATE NOCASE LIMIT 200`
    );
  }
  if (!user.edition_id) return [];
  return all(
    `SELECT g.id,g.name,g.destination,e.label AS edition_label
       FROM mobility_groups g JOIN erasmus_editions e ON e.id=g.edition_id
       JOIN group_members gm ON gm.group_id=g.id
      WHERE gm.user_id=? AND g.edition_id=?
      ORDER BY g.name COLLATE NOCASE LIMIT 200`,
    user.id, user.edition_id
  );
}
function conversationDirectory(user) {
  const contacts = directContacts(user).map(contact => {
    const recent = get(
      `SELECT content,created_at FROM messages
        WHERE (sender_id=? AND receiver_id=?) OR (sender_id=? AND receiver_id=?)
        ORDER BY id DESC LIMIT 1`,
      user.id, contact.id, contact.id, user.id
    );
    const edition = contact.edition_id
      ? get('SELECT label FROM erasmus_editions WHERE id=?', contact.edition_id)
      : null;
    return {
      id: contact.id,
      firstName: contact.first_name,
      lastName: contact.last_name,
      role: contact.role,
      editionLabel: edition?.label || null
    };
  });
  const groups = conversationGroups(user).map(group => {
    const recent = get(
      'SELECT content,created_at FROM messages WHERE group_id=? ORDER BY id DESC LIMIT 1',
      group.id
    );
    return {
      id: group.id,
      kind: 'group',
      title: group.name,
      subtitle: [group.destination, group.edition_label].filter(Boolean).join(' · '),
      lastMessage: recent?.content || null,
      lastMessageAt: recent?.created_at || null
    };
  });
  return { contacts, groups };
}
function authorizedGroup(user, groupId) {
  const group = get('SELECT id,name,destination,edition_id FROM mobility_groups WHERE id=?', groupId);
  if (!group) return null;
  if (user.role !== 'coordinator') {
    if (!user.edition_id || group.edition_id !== user.edition_id ||
      !get('SELECT 1 FROM group_members WHERE group_id=? AND user_id=?', groupId, user.id)) {
      return null;
    }
  }
  return group;
}
function conversationHistory(user, kind, targetId) {
  if (kind === 'direct') {
    const contact = directContacts(user).find(row => row.id === targetId);
    if (!contact) return null;
    const messages = all(
      `SELECT m.id,m.sender_id,m.content,m.created_at,u.first_name,u.last_name
         FROM messages m JOIN users u ON u.id=m.sender_id
        WHERE (m.sender_id=? AND m.receiver_id=?) OR (m.sender_id=? AND m.receiver_id=?)
        ORDER BY m.id DESC LIMIT 100`,
      user.id, targetId, targetId, user.id
    ).reverse();
    return {
      id: targetId,
      kind: 'direct',
      title: contact.first_name + ' ' + contact.last_name,
      messages: messages.map(message => ({
        id: message.id,
        senderId: message.sender_id,
        senderName: message.first_name + ' ' + message.last_name,
        content: message.content,
        createdAt: message.created_at
      }))
    };
  }
  const group = authorizedGroup(user, targetId);
  if (!group) return null;
  const messages = all(
    `SELECT m.id,m.sender_id,m.content,m.created_at,u.first_name,u.last_name
       FROM messages m JOIN users u ON u.id=m.sender_id
      WHERE m.group_id=? ORDER BY m.id DESC LIMIT 100`,
    targetId
  ).reverse();
  return {
    id: targetId,
    kind: 'group',
    title: group.name,
    messages: messages.map(message => ({
      id: message.id,
      senderId: message.sender_id,
      senderName: message.first_name + ' ' + message.last_name,
      content: message.content,
      createdAt: message.created_at
    }))
  };
}
async function createMobileSession(req, api) {
  let body;
  try {
    body = await readJson(req);
  } catch (err) {
    handleFailure(req, api, err);
    return;
  }
  if (!validBodyCsrf(req, body)) {
    error(req, api, 403, 'La solicitud ha caducado. Actualiza la página e inténtalo de nuevo.');
    return;
  }
  const username = String(body.username || '').trim().toUpperCase();
  const password = String(body.password || '');
  if (!username || !password || username.length > 100 || password.length > 200) {
    error(req, api, 400, 'Introduce el usuario y la contraseña.');
    return;
  }
  const key = (req.socket.remoteAddress || 'local') + ':' + username.slice(0, 45);
  if (!canTry(key)) {
    error(req, api, 429, 'Demasiados intentos. Inténtalo más tarde.');
    return;
  }
  const user = get('SELECT * FROM users WHERE username=?', username);
  const passwordValid = Boolean(user && await verifyPassword(password, user.pass_hash));
  countTry(key, passwordValid);
  if (!passwordValid) {
    error(req, api, 401, 'Usuario o contraseña incorrectos.');
    return;
  }
  if (user.status !== 'approved' || (!user.email_verified_at && user.role !== 'coordinator')) {
    error(req, api, 403, 'La cuenta necesita verificación del correo y aprobación de coordinación.');
    return;
  }
  const session = newSessionData(user.id);
  audit(user.id, 'login', user.id);
  json(req, api, 200, {
    authenticated: true,
    csrfToken: session.csrf,
    user: safeUser(user)
  }, { 'Set-Cookie': session.cookie });
}
async function sendMessage(req, api) {
  const user = requireUser(req, api);
  if (!user) return;
  let body;
  try {
    body = await readJson(req);
  } catch (err) {
    handleFailure(req, api, err);
    return;
  }
  if (!validBodyCsrf(req, body)) {
    error(req, api, 403, 'La solicitud ha caducado. Actualiza la página e inténtalo de nuevo.');
    return;
  }
  const kind = body.kind;
  const targetId = Number(body.targetId);
  const content = clean(body.content, 2500);
  if (!['direct', 'group'].includes(kind) || !Number.isSafeInteger(targetId) ||
      targetId < 1 || !content) {
    error(req, api, 400, 'Revisa el destinatario y el texto del mensaje.');
    return;
  }

  let recipients = [];
  let messageId;
  if (kind === 'direct') {
    const target = get("SELECT id,institutional_email,status FROM users WHERE id=? AND status='approved'", targetId);
    if (!target || target.id === user.id ||
        !directContacts(user).some(contact => contact.id === target.id)) {
      error(req, api, 403, 'No tienes acceso a esa conversación.');
      return;
    }
    const result = run(
      'INSERT INTO messages(sender_id,receiver_id,content) VALUES (?,?,?)',
      user.id, targetId, content
    );
    messageId = Number(result.lastInsertRowid);
    queueMail(
      target.institutional_email,
      'Mensaje recibido · Erasmus+ MMG',
      'Tienes un mensaje nuevo de ' + user.first_name + ' ' + user.last_name +
        ' en Movilidades Erasmus+ MMG. Accede a la aplicación para leerlo.'
    );
    audit(user.id, 'chat_direct_message_sent', Number(result.lastInsertRowid));
    recipients = [target.id];
  } else {
    const group = authorizedGroup(user, targetId);
    if (!group) {
      error(req, api, 403, 'No tienes acceso a esa conversación.');
      return;
    }
    const result = run(
      'INSERT INTO messages(sender_id,group_id,content) VALUES (?,?,?)',
      user.id, targetId, content
    );
    messageId = Number(result.lastInsertRowid);
    audit(user.id, 'chat_group_message_sent', Number(result.lastInsertRowid));
    recipients = all(
      `SELECT u.id FROM users u JOIN group_members gm ON gm.user_id=u.id
        JOIN mobility_groups g ON g.id=gm.group_id
       WHERE gm.group_id=? AND u.status='approved' AND u.id<>?
         AND u.edition_id=g.edition_id`,
      targetId, user.id
    ).map(row => row.id);
  }
  const saved = get(
    `SELECT m.id,m.sender_id,m.content,m.created_at,u.first_name,u.last_name
       FROM messages m JOIN users u ON u.id=m.sender_id WHERE m.id=?`,
    messageId
  );
  void sendMobilePush(recipients, { kind, id: targetId }).catch(err => {
    logger.warn({ error: err?.message || 'unknown' }, 'Unable to queue browser message notification');
  });
  if (!saved) {
    error(req, api, 500, 'No se pudo confirmar el mensaje enviado.');
    return;
  }
  json(req, api, 201, {
    id: saved.id,
    senderId: saved.sender_id,
    senderName: saved.first_name + ' ' + saved.last_name,
    content: saved.content,
    createdAt: saved.created_at
  });
}
function endpointIsTrusted(endpoint) {
  try {
    const url = new URL(endpoint);
    const hostname = url.hostname.toLowerCase();
    const allowed = [
      'fcm.googleapis.com',
      'push.services.mozilla.com',
      'web.push.apple.com',
      'notify.windows.com',
      'push.samsung.com'
    ];
    return url.protocol === 'https:' && !url.username && !url.password &&
      (!url.port || url.port === '443') &&
      allowed.some(domain => hostname === domain || hostname.endsWith('.' + domain));
  } catch {
    return false;
  }
}

export async function mobileApiRoutes(req, url, method, api) {
  if (!url.startsWith('/mobile')) return false;
  try {
    if (url === '/mobile/session' && method === 'GET') {
      safeSession(req, api);
      return true;
    }
    if (url === '/mobile/session' && method === 'POST') {
      await createMobileSession(req, api);
      return true;
    }
    if (url === '/mobile/session' && method === 'DELETE') {
      const user = requireUser(req, api);
      if (!user) return true;
      const body = await readJson(req);
      if (!validBodyCsrf(req, body)) {
        error(req, api, 403, 'La solicitud ha caducado. Actualiza la página e inténtalo de nuevo.');
        return true;
      }
      deleteSession(req.auth);
      noContent(req, api, { 'Set-Cookie': cookie('mmg_session', '', 0) });
      return true;
    }
    if (url === '/mobile/dashboard' && method === 'GET') {
      const user = requireUser(req, api);
      if (!user) return true;
      json(req, api, 200, dashboardFor(user));
      return true;
    }
    if (url === '/mobile/passkeys' && method === 'GET') {
      const user = requireUser(req, api);
      if (!user) return true;
      const credentials = all(
        'SELECT id,created_at FROM passkey_credentials WHERE user_id=? ORDER BY created_at DESC',
        user.id
      ).map(row => ({ id: row.id, createdAt: row.created_at }));
      json(req, api, 200, { credentials });
      return true;
    }
    const passkeyDeleteMatch = /^\/mobile\/passkeys\/([^/]+)$/.exec(url);
    if (passkeyDeleteMatch && method === 'DELETE') {
      const user = requireUser(req, api);
      if (!user) return true;
      const body = await readJson(req);
      if (!validPasskeyCsrf(req, body)) {
        error(req, api, 403, 'La solicitud ha caducado. Actualiza la página e inténtalo de nuevo.');
        return true;
      }
      const credentialId = decodeURIComponent(passkeyDeleteMatch[1]);
      const credential = get(
        'SELECT id FROM passkey_credentials WHERE id=? AND user_id=?',
        credentialId, user.id
      );
      if (!credential) {
        error(req, api, 404, 'No se encontró esa credencial en tu cuenta.');
        return true;
      }
      run('DELETE FROM passkey_credentials WHERE id=? AND user_id=?', credentialId, user.id);
      audit(user.id, 'passkey_removed');
      noContent(req, api);
      return true;
    }
    if (url === '/mobile/documents' && method === 'GET') {
      const user = requireUser(req, api);
      if (!user) return true;
      json(req, api, 200, mobileDocuments(user));
      return true;
    }
    if (url === '/mobile/conversations' && method === 'GET') {
      const user = requireUser(req, api);
      if (!user) return true;
      json(req, api, 200, conversationDirectory(user));
      return true;
    }
    const historyMatch = /^\/mobile\/conversations\/(direct|group)\/(\d+)$/.exec(url);
    if (historyMatch && method === 'GET') {
      const user = requireUser(req, api);
      if (!user) return true;
      const history = conversationHistory(user, historyMatch[1], Number(historyMatch[2]));
      if (!history) error(req, api, 404, 'Conversación no disponible.');
      else json(req, api, 200, history);
      return true;
    }
    if (url === '/mobile/messages' && method === 'POST') {
      await sendMessage(req, api);
      return true;
    }
    const taskMatch = /^\/mobile\/tasks\/(\d+)\/complete$/.exec(url);
    if (taskMatch && method === 'POST') {
      const user = requireUser(req, api);
      if (!user) return true;
      const body = await readJson(req);
      if (!validBodyCsrf(req, body)) {
        error(req, api, 403, 'La solicitud ha caducado. Actualiza la página e inténtalo de nuevo.');
        return true;
      }
      const taskId = Number(taskMatch[1]);
      const task = get('SELECT id,group_id FROM mobility_tasks WHERE id=?', taskId);
      const group = task && authorizedGroup(user, task.group_id);
      if (!task || !group) {
        error(req, api, 404, 'Tarea no disponible.');
        return true;
      }
      if (user.role === 'coordinator') {
        error(req, api, 403, 'Coordinación no completa tareas en nombre de participantes.');
        return true;
      }
      const completion = run(
        'INSERT OR IGNORE INTO mobility_task_completions(task_id,user_id) VALUES (?,?)',
        taskId, user.id
      );
      if (completion.changes) audit(user.id, 'mobility_task_completed', taskId);
      noContent(req, api);
      return true;
    }
    if (url === '/mobile/push/config' && method === 'GET') {
      json(req, api, 200, await mobilePushConfig());
      return true;
    }
    if (url === '/mobile/push/subscription' && method === 'PUT') {
      const user = requireUser(req, api);
      if (!user) return true;
      const body = await readJson(req);
      if (!validBodyCsrf(req, body)) {
        error(req, api, 403, 'La solicitud ha caducado. Actualiza la página e inténtalo de nuevo.');
        return true;
      }
      const endpoint = String(body.endpoint || '');
      const p256dh = String(body.keys?.p256dh || '');
      const auth = String(body.keys?.auth || '');
      if (!endpointIsTrusted(endpoint) ||
          !/^[A-Za-z0-9_-]{16,256}$/.test(p256dh) ||
          !/^[A-Za-z0-9_-]{8,128}$/.test(auth)) {
        error(req, api, 400, 'La suscripción del navegador no es válida.');
        return true;
      }
      try {
        await saveMobilePushSubscription(user.id, {
          endpoint,
          keys: { p256dh, auth }
        });
      } catch (err) {
        logger.warn({ error: err?.message || 'unavailable' }, 'Unable to save browser notification subscription');
        error(req, api, 503, 'Las notificaciones del navegador no están disponibles en este servidor.');
        return true;
      }
      audit(user.id, 'mobile_push_subscription_saved', user.id);
      noContent(req, api);
      return true;
    }
    if (url === '/mobile/push/subscription' && method === 'DELETE') {
      const user = requireUser(req, api);
      if (!user) return true;
      const body = await readJson(req);
      if (!validBodyCsrf(req, body)) {
        error(req, api, 403, 'La solicitud ha caducado. Actualiza la página e inténtalo de nuevo.');
        return true;
      }
      const endpoint = String(body.endpoint || '');
      if (!endpoint || endpoint.length > 2048) {
        error(req, api, 400, 'La suscripción del navegador no es válida.');
        return true;
      }
      removeMobilePushSubscription(user.id, endpoint);
      audit(user.id, 'mobile_push_subscription_removed', user.id);
      noContent(req, api);
      return true;
    }
    if (url.startsWith('/mobile/')) {
      error(req, api, 405, 'Método o ruta no disponible.');
      return true;
    }
    return false;
  } catch (err) {
    handleFailure(req, api, err);
    return true;
  }
}
