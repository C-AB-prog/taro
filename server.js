import express from 'express';
import cors from 'cors';
import { createClient } from '@neondatabase/serverless';

const app = express();
app.use(cors());
app.use(express.json());

// Статические файлы
app.use(express.static('.'));

// Подключение к Neon
const db = createClient(process.env.DATABASE_URL);

// API эндпоинты
app.get('/api/user/:userId', async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT * FROM users WHERE user_id = $1',
      [req.params.userId]
    );
    res.json(rows[0] || null);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/user/:userId/spin-wheel', async (req, res) => {
  try {
    const userId = req.params.userId;
    const today = new Date().toISOString().split('T')[0];
    
    // Проверяем, крутил ли уже сегодня
    const { rows } = await db.query(
      'SELECT last_spin FROM users WHERE user_id = $1',
      [userId]
    );
    
    if (rows[0]?.last_spin === today) {
      return res.json({ success: false, message: 'Уже крутили сегодня' });
    }
    
    // Обновляем дату последнего кручения
    await db.query(
      `INSERT INTO users (user_id, last_spin, spins_count) 
       VALUES ($1, $2, 1)
       ON CONFLICT (user_id) 
       DO UPDATE SET last_spin = $2, spins_count = users.spins_count + 1`,
      [userId, today]
    );
    
    res.json({ success: true, canSpin: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/user/:userId/save-spread', async (req, res) => {
  try {
    const { spreadId, cards, price } = req.body;
    
    await db.query(
      `INSERT INTO spreads (user_id, spread_id, cards, price, created_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [req.params.userId, spreadId, JSON.stringify(cards), price]
    );
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/user/:userId/spreads', async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT * FROM spreads WHERE user_id = $1 ORDER BY created_at DESC',
      [req.params.userId]
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
