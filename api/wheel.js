
// api/wheel.js
const { withTransaction } = require('./_db');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { telegramId, text, starsWon, cost } = req.body || {};

    if (!telegramId || !text || typeof starsWon !== 'number' || typeof cost !== 'number') {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    const result = await withTransaction(async client => {
      // списываем стоимость и начисляем выигрыш
      const updateRes = await client.query(
        `
        UPDATE users
        SET stars = stars - $2 + $3
        WHERE telegram_id = $1
          AND stars >= $2
        RETURNING stars
        `,
        [telegramId, cost, starsWon]
      );

      if (updateRes.rowCount === 0) {
        throw new Error('NOT_ENOUGH_STARS');
      }

      const stars = updateRes.rows[0].stars;

      const archiveRes = await client.query(
        `
        INSERT INTO archive_entries (
          telegram_id, type, text, stars_won
        )
        VALUES ($1, 'wheel', $2, $3)
        RETURNING id, type, text, stars_won, created_at
        `,
        [telegramId, text, starsWon]
      );

      const row = archiveRes.rows[0];

      const entry = {
        id: row.id,
        type: row.type,
        text: row.text,
        starsWon: row.stars_won,
        createdAt: row.created_at
      };

      return { stars, entry };
    });

    res.status(200).json(result);
  } catch (e) {
    if (e.message === 'NOT_ENOUGH_STARS') {
      res.status(400).json({ error: 'Недостаточно звёзд' });
      return;
    }
    console.error('wheel api error', e);
    res.status(500).json({ error: 'Server error' });
  }
};
