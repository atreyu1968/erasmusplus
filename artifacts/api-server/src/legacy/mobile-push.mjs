import webPush from 'web-push';
import { all, db, run } from './db.mjs';
import { readSecureConfig, saveSecureConfig } from './mailer.mjs';
import { logger } from '../lib/runtime-logger.mjs';

db.exec(`
  CREATE TABLE IF NOT EXISTS mobile_push_subscriptions (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL UNIQUE,
    p256dh TEXT NOT NULL,
    auth_secret TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS mobile_push_by_user ON mobile_push_subscriptions(user_id);
`);

let keyPromise;

async function vapidKeys() {
  if (!keyPromise) {
    keyPromise = Promise.resolve().then(() => {
      let stored = readSecureConfig('mobile_vapid_keys');
      if (!stored) {
        const generated = webPush.generateVAPIDKeys();
        saveSecureConfig('mobile_vapid_keys', JSON.stringify(generated));
        stored = JSON.stringify(generated);
      }
      const keys = JSON.parse(stored);
      if (!keys || typeof keys.publicKey !== 'string' || typeof keys.privateKey !== 'string') {
        throw new Error('La configuración de notificaciones del servidor no es válida.');
      }
      webPush.setVapidDetails(
        process.env.MMG_VAPID_SUBJECT || 'mailto:coordinacion@iesmmg.org',
        keys.publicKey,
        keys.privateKey
      );
      return keys;
    }).catch(error => {
      keyPromise = undefined;
      throw error;
    });
  }
  return keyPromise;
}

export async function mobilePushConfig() {
  try {
    const keys = await vapidKeys();
    return { enabled: true, publicKey: keys.publicKey };
  } catch (error) {
    logger.warn({ reason: error?.message || 'unavailable' }, 'Browser push is not configured');
    return { enabled: false, publicKey: null };
  }
}

export async function saveMobilePushSubscription(userId, subscription) {
  await vapidKeys();
  run(
    `INSERT INTO mobile_push_subscriptions(user_id,endpoint,p256dh,auth_secret)
     VALUES (?,?,?,?)
     ON CONFLICT(endpoint) DO UPDATE SET
       user_id=excluded.user_id,
       p256dh=excluded.p256dh,
       auth_secret=excluded.auth_secret,
       updated_at=CURRENT_TIMESTAMP`,
    userId, subscription.endpoint, subscription.keys.p256dh, subscription.keys.auth
  );
}

export function removeMobilePushSubscription(userId, endpoint) {
  return run('DELETE FROM mobile_push_subscriptions WHERE user_id=? AND endpoint=?', userId, endpoint);
}

export async function sendMobilePush(userIds, conversation) {
  const ids = [...new Set(userIds.map(Number).filter(id => Number.isSafeInteger(id) && id > 0))];
  if (!ids.length) return;
  let keys;
  try {
    keys = await vapidKeys();
  } catch {
    logger.warn({}, 'Browser push was skipped because server keys are unavailable');
    return;
  }
  const placeholders = ids.map(() => '?').join(',');
  const subscriptions = all(
    `SELECT id,user_id,endpoint,p256dh,auth_secret
       FROM mobile_push_subscriptions WHERE user_id IN (${placeholders})`,
    ...ids
  );
  if (!subscriptions.length) return;

  const payload = JSON.stringify({
    title: 'Nuevo mensaje',
    body: 'Tienes un mensaje nuevo en Erasmus+ MMG.',
    url: '/movil/mensajes/' + conversation.kind + '/' + conversation.id
  });
  webPush.setVapidDetails(
    process.env.MMG_VAPID_SUBJECT || 'mailto:coordinacion@iesmmg.org',
    keys.publicKey,
    keys.privateKey
  );
  await Promise.allSettled(subscriptions.map(async item => {
    try {
      await webPush.sendNotification({
        endpoint: item.endpoint,
        keys: { p256dh: item.p256dh, auth: item.auth_secret }
      }, payload, { TTL: 3600 });
    } catch (error) {
      if (error?.statusCode === 404 || error?.statusCode === 410) {
        run('DELETE FROM mobile_push_subscriptions WHERE id=?', item.id);
        return;
      }
      logger.warn({ statusCode: error?.statusCode || 0 }, 'Browser push delivery failed');
    }
  }));
}
