// api/state.js
const { query } = require('./_db');

/**
 * Структура, с которой уже работает фронт:
 *
 * GET /api/state?userId=123
 *   200 -> { stars, archive, wheelLastSpin, lastWheelText }
 *   404 -> "нет такого пользователя" (фронт создаёт нового с 150★)
 *
 * POST /api/state
 *   body: { userId, stars, archive, wheelLastSpin, lastWheelText }
 *   -> upsert в БД
 */

export default async function handler(req, res) {
  if (req.method === 'GET') {
    return handleGet(req, res);
  }

  if (req.method === 'POST') {
    return handlePost(req, res);
  }

  res.setHeader('Allow', ['GET', 'POST']);
  return res.status(405).json({ error: 'Method not allowed' });
}

async function handleGet(req, res) {
  try {
    const userId = req.query.userId;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const { rows } = await query(
      `SELECT stars,
              archive,
              wheel_last_spin,
              last_wheel_text
       FROM tarot_user_state
       WHERE telegram_id = $1`,
      [String(userId)]
    );

    if (!rows.length) {
      // Фронт ожидает 404, чтобы создать "нового" юзера локально
      return res.status(404).json({ error: 'User state not found' });
    }

    const row = rows[0];

    return res.status(200).json({
      stars: typeof row.stars === 'number' ? row.stars : 0,
      archive: Array.isArray(row.archive) ? row.archive : [],
      wheelLastSpin: row.wheel_last_spin || null,  // Date -> превратится в ISO-строку
      lastWheelText: row.last_wheel_text || ''
    });
  } catch (err) {
    console.error('GET /api/state error:', err);
    return res.status(500).json({ error: 'Failed to load state' });
  }
}

async function handlePost(req, res) {
  try {
    const { userId, stars, archive, wheelLastSpin, lastWheelText } = req.body || {};

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const safeStars = typeof stars === 'number' && Number.isFinite(stars) ? stars : 0;

    const safeArchive = Array.isArray(archive) ? archive : [];

    // Можем ограничить длину архива, чтобы не раздулся ряд на тысячи записей
    const MAX_ARCHIVE_LENGTH = 500;
    const trimmedArchive =
      safeArchive.length > MAX_ARCHIVE_LENGTH
        ? safeArchive.slice(0, MAX_ARCHIVE_LENGTH)
        : safeArchive;

    // Нормализуем дату
    let wheelDate = null;
    if (wheelLastSpin) {
      const d = new Date(wheelLastSpin);
      if (!isNaN(d.getTime())) {
        wheelDate = d.toISOString(); // postgres сам приведёт к timestamptz
      }
    }

    const text = `
      INSERT INTO tarot_user_state (
        telegram_id,
        stars,
        archive,
        wheel_last_spin,
        last_wheel_text,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3::jsonb, $4, $5, NOW(), NOW())
      ON CONFLICT (telegram_id)
      DO UPDATE SET
        stars = EXCLUDED.stars,
        archive = EXCLUDED.archive,
        wheel_last_spin = EXCLUDED.wheel_last_spin,
        last_wheel_text = EXCLUDED.last_wheel_text,
        updated_at = NOW()
      RETURNING stars, archive, wheel_last_spin, last_wheel_text;
    `;

    const params = [
      String(userId),
      safeStars,
      JSON.stringify(trimmedArchive),
      wheelDate,
      lastWheelText || null
    ];

    const { rows } = await query(text, params);
    const row = rows[0];

    // Фронт сейчас не использует ответ POST, но пусть будет красиво и симметрично
    return res.status(200).json({
      stars: typeof row.stars === 'number' ? row.stars : 0,
      archive: Array.isArray(row.archive) ? row.archive : [],
      wheelLastSpin: row.wheel_last_spin || null,
      lastWheelText: row.last_wheel_text || ''
    });
  } catch (err) {
    console.error('POST /api/state error:', err);
    return res.status(500).json({ error: 'Failed to save state' });
  }
}
