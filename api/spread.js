
// api/spread.js
const { withTransaction } = require('./_db');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { telegramId, spreadId, title, price, cards, description } = req.body || {};

    if (!telegramId || !spreadId || !title || !price) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    const result = await withTransaction(async client => {
      // списываем звёзды
      const updateRes = await client.query(
        `
        UPDATE users
        SET stars = stars - $2
        WHERE telegram_id = $1
          AND stars >= $2
        RETURNING stars
        `,
        [telegramId, price]
      );

      if (updateRes.rowCount === 0) {
        throw new Error('NOT_ENOUGH_STARS');
      }

      const stars = updateRes.rows[0].stars;

      // добавляем запись в архив
      const archiveRes = await client.query(
        `
        INSERT INTO archive_entries (
          telegram_id, type, spread_id, title, description, price, cards
        )
        VALUES ($1, 'spread', $2, $3, $4, $5, $6)
        RETURNING id, type, title, description, price, cards, created_at
        `,
        [telegramId, spreadId, title, description || null, price, cards || null]
      );

      const entryRow = archiveRes.rows[0];

      const entry = {
        id: entryRow.id,
        type: entryRow.type,
        title: entryRow.title,
        description: entryRow.description,
        price: entryRow.price,
        cards: entryRow.cards,
        createdAt: entryRow.created_at
      };

      return { stars, entry };
    });

    res.status(200).json(result);
  } catch (e) {
    if (e.message === 'NOT_ENOUGH_STARS') {
      res.status(400).json({ error: 'Недостаточно звёзд' });
      return;
    }
    console.error('spread api error', e);
    res.status(500).json({ error: 'Server error' });
  }
};
