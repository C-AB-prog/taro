// api/state.js
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false } // для Neon
});

export default async function handler(req, res) {
  const { method } = req;

  try {
    if (method === 'GET') {
      const userId = req.query.userId;
      if (!userId) {
        return res.status(400).json({ error: 'userId is required' });
      }

      const { rows } = await pool.query(
        `SELECT user_id, stars, archive, wheel_last_spin, last_wheel_text
         FROM user_state
         WHERE user_id = $1`,
        [String(userId)]
      );

      if (!rows.length) {
        // фронт как раз ждёт 404 для нового юзера
        return res.status(404).json({ error: 'not_found' });
      }

      const row = rows[0];
      return res.status(200).json({
        userId: row.user_id,
        stars: row.stars,
        archive: row.archive || [],
        wheelLastSpin: row.wheel_last_spin,
        lastWheelText: row.last_wheel_text || ''
      });
    }

    if (method === 'POST') {
      const { userId, stars, archive, wheelLastSpin, lastWheelText } = req.body || {};
      if (!userId) {
        return res.status(400).json({ error: 'userId is required' });
      }

      await pool.query(
        `INSERT INTO user_state (user_id, stars, archive, wheel_last_spin, last_wheel_text, created_at, updated_at)
         VALUES ($1, $2, $3::jsonb, $4, $5, now(), now())
         ON CONFLICT (user_id)
         DO UPDATE SET
           stars = EXCLUDED.stars,
           archive = EXCLUDED.archive,
           wheel_last_spin = EXCLUDED.wheel_last_spin,
           last_wheel_text = EXCLUDED.last_wheel_text,
           updated_at = now()`,
        [
          String(userId),
          typeof stars === 'number' ? stars : 150,
          JSON.stringify(archive || []),
          wheelLastSpin || null,
          lastWheelText || ''
        ]
      );

      return res.status(200).json({ ok: true });
    }

    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).end(`Method ${method} Not Allowed`);
  } catch (err) {
    console.error('API /state error:', err);
    return res.status(500).json({ error: 'internal_error' });
  }
}
