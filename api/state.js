// api/state.js
const crypto = require('crypto');
const { query, withTransaction } = require('./_db');

const NEW_USER_STARS = 150;
const ARCHIVE_MAX = 200;
const LAST_WHEEL_TEXT_MAX = 20000; // чтобы не хранить мегабайты HTML

function json(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(data));
}

function parseBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (!req.body) return {};
  try {
    return JSON.parse(req.body);
  } catch {
    return {};
  }
}

// ---- Telegram WebApp initData verification ----
function verifyTelegramInitData(initData, botToken) {
  if (!initData || !botToken) return null;

  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  const authDate = Number(params.get('auth_date') || 0);
  const userRaw = params.get('user');

  if (!hash || !authDate || !userRaw) return null;

  // защита от очень старых initData (например, старше суток)
  const nowSec = Math.floor(Date.now() / 1000);
  if (nowSec - authDate > 86400) return null;

  const pairs = [];
  for (const [k, v] of params.entries()) {
    if (k === 'hash') continue;
    pairs.push([k, v]);
  }
  pairs.sort(([a], [b]) => a.localeCompare(b));

  const dataCheckString = pairs.map(([k, v]) => `${k}=${v}`).join('\n');

  const secretKey = crypto
    .createHmac('sha256', 'WebAppData')
    .update(botToken)
    .digest();

  const calcHash = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');

  if (calcHash !== hash) return null;

  let user;
  try {
    user = JSON.parse(userRaw);
  } catch {
    return null;
  }

  if (!user || !user.id) return null;

  return {
    telegram_id: Number(user.id),
    username: user.username || null,
    first_name: user.first_name || null,
    last_name: user.last_name || null
  };
}

async function getOrCreateState(tgUser) {
  await withTransaction(async (client) => {
    await client.query(
      `
      INSERT INTO tg_users (telegram_id, username, first_name, last_name, updated_at)
      VALUES ($1, $2, $3, $4, now())
      ON CONFLICT (telegram_id) DO UPDATE SET
        username = EXCLUDED.username,
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        updated_at = now()
      `,
      [tgUser.telegram_id, tgUser.username, tgUser.first_name, tgUser.last_name]
    );

    await client.query(
      `
      INSERT INTO tg_user_state (telegram_id, stars, archive, wheel_last_spin, last_wheel_text, version, updated_at)
      VALUES ($1, $2, '[]'::jsonb, NULL, '', 1, now())
      ON CONFLICT (telegram_id) DO NOTHING
      `,
      [tgUser.telegram_id, NEW_USER_STARS]
    );
  });

  const res = await query(
    `
    SELECT stars, archive, wheel_last_spin, last_wheel_text, version, updated_at
    FROM tg_user_state
    WHERE telegram_id = $1
    `,
    [tgUser.telegram_id]
  );

  const row = res.rows[0] || {};
  return {
    stars: Number(row.stars || NEW_USER_STARS),
    archive: Array.isArray(row.archive) ? row.archive : (row.archive || []),
    wheelLastSpin: row.wheel_last_spin ? new Date(row.wheel_last_spin).toISOString() : null,
    lastWheelText: String(row.last_wheel_text || ''),
    version: Number(row.version || 1),
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null
  };
}

function normalizeIncomingState(body) {
  let stars = Number(body.stars);
  if (!Number.isFinite(stars) || stars < 0) stars = 0;
  if (stars > 1000000000) stars = 1000000000;

  let archive = body.archive;
  if (!Array.isArray(archive)) archive = [];
  archive = archive.slice(0, ARCHIVE_MAX);

  let wheelLastSpin = body.wheelLastSpin ? new Date(body.wheelLastSpin) : null;
  if (wheelLastSpin && isNaN(wheelLastSpin.getTime())) wheelLastSpin = null;

  let lastWheelText = String(body.lastWheelText || '');
  if (lastWheelText.length > LAST_WHEEL_TEXT_MAX) {
    lastWheelText = lastWheelText.slice(0, LAST_WHEEL_TEXT_MAX);
  }

  let version = Number(body.version);
  if (!Number.isFinite(version) || version < 1) version = 1;

  return { stars, archive, wheelLastSpin, lastWheelText, version };
}

module.exports = async function handler(req, res) {
  try {
    const initData =
      req.headers['x-telegram-init-data'] ||
      req.headers['x-telegram-initdata'] ||
      (req.query && req.query.initData);

    const tgUser = verifyTelegramInitData(initData, process.env.TELEGRAM_BOT_TOKEN);
    if (!tgUser) {
      return json(res, 401, { error: 'Unauthorized: invalid Telegram initData' });
    }

    if (req.method === 'GET') {
      const state = await getOrCreateState(tgUser);
      return json(res, 200, state);
    }

    if (req.method === 'POST') {
      const body = parseBody(req);
      const incoming = normalizeIncomingState(body);

      // optimistic concurrency: обновляем только если version совпал
      const updated = await withTransaction(async (client) => {
        const r = await client.query(
          `
          UPDATE tg_user_state
          SET
            stars = $2,
            archive = $3::jsonb,
            wheel_last_spin = $4,
            last_wheel_text = $5,
            version = version + 1,
            updated_at = now()
          WHERE telegram_id = $1
            AND version = $6
          RETURNING stars, archive, wheel_last_spin, last_wheel_text, version, updated_at
          `,
          [
            tgUser.telegram_id,
            incoming.stars,
            JSON.stringify(incoming.archive),
            incoming.wheelLastSpin,
            incoming.lastWheelText,
            incoming.version
          ]
        );

        if (r.rowCount === 1) return r.rows[0];
        return null;
      });

      if (!updated) {
        // версия не совпала — кто-то уже сохранил состояние с другого устройства
        const current = await getOrCreateState(tgUser);
        return json(res, 409, { error: 'Version conflict', current });
      }

      return json(res, 200, {
        stars: Number(updated.stars || 0),
        archive: Array.isArray(updated.archive) ? updated.archive : (updated.archive || []),
        wheelLastSpin: updated.wheel_last_spin ? new Date(updated.wheel_last_spin).toISOString() : null,
        lastWheelText: String(updated.last_wheel_text || ''),
        version: Number(updated.version || 1),
        updatedAt: updated.updated_at ? new Date(updated.updated_at).toISOString() : null
      });
    }

    return json(res, 405, { error: 'Method not allowed' });
  } catch (e) {
    console.error(e);
    return json(res, 500, { error: 'Internal server error' });
  }
};
