import express from 'express';
import cors from 'cors';
import { createClient } from '@neondatabase/serverless';

const app = express();
app.use(cors());
app.use(express.json());

// Статические файлы
app.use(express.static('public'));  // Папка с картинками и другими статичными ресурсами

// Подключение к базе данных
const db = createClient(process.env.DATABASE_URL);

// Пример эндпоинта API
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
