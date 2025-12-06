// api/state.js
const { neon } = require('@neondatabase/serverless');

const sql = neon(process.env.DATABASE_URL);

function buildArchiveData(item) {
  return {
    cards: item.cards || [],
    question: item.question || null,
    answer: item.answer || null,
    summary: item.summary || null,
    card: item.card || null
  };
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  let userId =
    req.method === 'GET' ? req.query.userId : req.body && req.body.userId;

  if (!userId) {
    return res.status(400).json({ error: 'userId required' });
  }

  try {
    if (req.method === 'GET') {
      const userResult = await sql`
        SELECT telegram_id, stars, last_wheel_spin, last_wheel_text
        FROM users
        WHERE telegram_id = ${userId}
      `;

      if (userResult.rows.length === 0) {
        return res.status(404).json({ error: 'not_found' });
      }

      const user = userResult.rows[0];

      const archiveResult = await sql`
        SELECT id, type, spread_id, title, data, created_at
        FROM archive_entries
        WHERE telegram_id = ${userId}
        ORDER BY created_at DESC
        LIMIT 200
      `;

      const archive = archiveResult.rows.map((row) => {
        const data = row.data || {};
        return {
          id: row.id,
          type: row.type,
          spreadId: row.spread_id,
          title: row.title,
          createdAt: row.created_at,
          cards: data.cards || [],
          question: data.question || null,
          answer: data.answer || null,
          summary: data.summary || null,
          card: data.card || null
        };
      });

      return res.status(200).json({
        stars: user.stars,
        wheelLastSpin: user.last_wheel_spin,
        lastWheelText: user.last_wheel_text,
        archive
      });
    }

    if (req.method === 'POST') {
      const body = req.body || {};
      const stars =
        typeof body.stars === 'number' && !Number.isNaN(body.stars)
          ? body.stars
          : 0;
      const archive = Array.isArray(body.archive) ? body.archive : [];
      const wheelLastSpin = body.wheelLastSpin || null;
      const lastWheelText = body.lastWheelText || null;

      await sql`
        INSERT INTO users (telegram_id, stars, last_wheel_spin, last_wheel_text)
        VALUES (${userId}, ${stars}, ${wheelLastSpin}, ${lastWheelText})
        ON CONFLICT (telegram_id)
        DO UPDATE SET
          stars = EXCLUDED.stars,
          last_wheel_spin = EXCLUDED.last_wheel_spin,
          last_wheel_text = EXCLUDED.last_wheel_text,
          updated_at = NOW()
      `;

      await sql`DELETE FROM archive_entries WHERE telegram_id = ${userId}`;

      for (const item of archive) {
        const createdAt = item.createdAt
          ? new Date(item.createdAt)
          : new Date();
        const data = buildArchiveData(item);

        await sql`
          INSERT INTO archive_entries
            (telegram_id, type, spread_id, title, data, created_at)
          VALUES (
            ${userId},
            ${item.type},
            ${item.spreadId || null},
            ${item.title || null},
            ${data},
            ${createdAt}
          )
        `;
      }

      return res.status(200).json({ ok: true });
    }

    res.setHeader('Allow', ['GET', POST, 'OPTIONS']);
    return res.status(405).end('Method Not Allowed');
  } catch (err) {
    console.error('STATE API ERROR', err);
    return res
      .status(500)
      .json({ error: 'server_error', details: String(err) });
  }
};
