
// api/user.js
const { query } = require('./_db');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { telegramId, username, firstName } = req.body || {};

    if (!telegramId) {
      res.status(400).json({ error: 'telegramId is required' });
      return;
    }

    // upsert пользователя
    await query(
      `
      INSERT INTO users (telegram_id, username, first_name)
      VALUES ($1, $2, $3)
      ON CONFLICT (telegram_id) DO UPDATE
      SET username = EXCLUDED.username,
          first_name = EXCLUDED.first_name
      `,
      [telegramId, username || null, firstName || null]
    );

    // получаем данные пользователя
    const userRes = await query(
      'SELECT telegram_id, stars FROM users WHERE telegram_id = $1',
      [telegramId]
    );

    if (userRes.rowCount === 0) {
      res.status(500).json({ error: 'User not found after upsert' });
      return;
    }

    const user = userRes.rows[0];

    // архив
    const archiveRes = await query(
      `
      SELECT
        id,
        type,
        spread_id,
        title,
        description,
        price,
        cards,
        stars_won,
        text,
        created_at
      FROM archive_entries
      WHERE telegram_id = $1
      ORDER BY created_at DESC
      LIMIT 100
      `,
      [telegramId]
    );

    const archive = archiveRes.rows.map(row => ({
      id: row.id,
      type: row.type,
      title: row.type === 'wheel' ? row.text : row.title,
      description: row.description,
      price: row.price,
      cards: row.cards,
      starsWon: row.stars_won,
      text: row.text,
      createdAt: row.created_at
    }));

    res.status(200).json({
      telegramId: user.telegram_id,
      stars: user.stars,
      archive
    });
  } catch (e) {
    console.error('user api error', e);
    res.status(500).json({ error: 'Server error' });
  }
};
