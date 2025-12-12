// api/state.js
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  },
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

export default async function handler(req, res) {
  if (!['GET', 'POST'].includes(req.method)) {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    if (req.method === 'GET') {
      return await handleGet(req, res);
    } else if (req.method === 'POST') {
      return await handlePost(req, res);
    }
  } catch (error) {
    console.error('State API error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

async function handleGet(req, res) {
  const { userId } = req.query;

  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  try {
    const result = await pool.query(
      `SELECT stars, archive, wheel_last_spin, last_wheel_text 
       FROM tarot_user_state 
       WHERE telegram_id = $1`,
      [String(userId)]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const row = result.rows[0];
    
    return res.status(200).json({
      stars: Number(row.stars) || 150,
      archive: Array.isArray(row.archive) ? row.archive : [],
      wheelLastSpin: row.wheel_last_spin ? new Date(row.wheel_last_spin).toISOString() : null,
      lastWheelText: row.last_wheel_text || ''
    });
  } catch (error) {
    console.error('GET error:', error);
    return res.status(500).json({ error: 'Database error' });
  }
}

async function handlePost(req, res) {
  const { userId, stars, archive, wheelLastSpin, lastWheelText } = req.body;

  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  try {
    const safeStars = typeof stars === 'number' && Number.isFinite(stars) ? stars : 150;
    const safeArchive = Array.isArray(archive) ? JSON.stringify(archive) : '[]';
    const safeWheelSpin = wheelLastSpin ? new Date(wheelLastSpin).toISOString() : null;
    const safeWheelText = lastWheelText || '';

    const result = await pool.query(
      `INSERT INTO tarot_user_state (
        telegram_id, stars, archive, wheel_last_spin, last_wheel_text, updated_at
      ) VALUES ($1, $2, $3::jsonb, $4, $5, NOW())
      ON CONFLICT (telegram_id) 
      DO UPDATE SET 
        stars = EXCLUDED.stars,
        archive = EXCLUDED.archive,
        wheel_last_spin = EXCLUDED.wheel_last_spin,
        last_wheel_text = EXCLUDED.last_wheel_text,
        updated_at = NOW()
      RETURNING stars, archive, wheel_last_spin, last_wheel_text`,
      [String(userId), safeStars, safeArchive, safeWheelSpin, safeWheelText]
    );

    const row = result.rows[0];
    
    return res.status(200).json({
      stars: Number(row.stars),
      archive: Array.isArray(row.archive) ? row.archive : [],
      wheelLastSpin: row.wheel_last_spin ? new Date(row.wheel_last_spin).toISOString() : null,
      lastWheelText: row.last_wheel_text || ''
    });
  } catch (error) {
    console.error('POST error:', error);
    return res.status(500).json({ error: 'Database error' });
  }
}
