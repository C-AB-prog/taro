// api/tarot-reading.js
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Системный промпт для создания "человеческой" трактовки
const SYSTEM_PROMPT = `Ты профессиональный таролог с 15-летним опытом. Твоё имя выбери случайно из списка: Арина, Михаил, Лиана, Дмитрий, Светлана, Елена, Артём, София, Марк.

Твоя задача — дать глубокую, персонализированную трактовку расклада Таро так, как будто ты живой человек, сидящий напротив клиента.

СТИЛЬ ОБЩЕНИЯ:
- Используй живую разговорную речь
- Делай паузы, используй многоточия...
- Добавляй личные наблюдения ("в моей практике...", "помню случай...")
- Будь эмпатичным, но честным
- Используй метафоры и образы
- Иногда задавай риторические вопросы
- Подписывайся в конце как настоящий таролог

СТРУКТУРА ОТВЕТА:
1. Первое впечатление от расклада (1-2 предложения)
2. Анализ каждой карты в контексте позиции (2-3 предложения на карту)
3. Динамика между картами (как они взаимодействуют)
4. Практические рекомендации (конкретные шаги)
5. Временные ориентиры (когда ждать результатов)
6. Заключительная мысль (философское наблюдение)

НИКОГДА не упоминай, что ты ИИ или программа. Ты — живой таролог.
Твой анализ должен быть уникальным для каждого клиента.`;

// In-memory кэш
const analysisCache = new Map();

// Оптимизируем карты для ИИ (сокращаем токены)
function optimizeCardsForAI(cards) {
  return cards.map(card => ({
    id: card.id,
    name: card.name,
    roman: card.roman || '',
    category: card.category,
    suit: card.suit || '',
    keyword: card.keyword || '',
    description: card.description ? 
      card.description.substring(0, 120) + (card.description.length > 120 ? '...' : '') : '',
    upright: extractFirstSentences(card.upright, 1),
    reversed: extractFirstSentences(card.reversed, 1),
    advice: extractFirstSentences(card.advice, 1)
  }));
}

function extractFirstSentences(text, maxSentences = 1) {
  if (!text) return '';
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  return sentences.slice(0, maxSentences).join(' ');
}

function getCachedAnalysis(cacheKey) {
  const cached = analysisCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < 24 * 60 * 60 * 1000) {
    return cached.data;
  }
  return null;
}

function cacheAnalysis(cacheKey, data) {
  analysisCache.set(cacheKey, {
    data,
    timestamp: Date.now()
  });
  
  // Очистка старых записей (больше 1000)
  if (analysisCache.size > 1000) {
    const oldestKey = analysisCache.keys().next().value;
    analysisCache.delete(oldestKey);
  }
}

function extractTarotReader(text) {
  const readers = [
    { name: "Арина", emoji: "🌙", specialty: "кармические связи" },
    { name: "Михаил", emoji: "⚡", specialty: "практические вопросы" },
    { name: "Лиана", emoji: "💖", specialty: "отношения" },
    { name: "Дмитрий", emoji: "🕊️", specialty: "духовный рост" },
    { name: "Светлана", emoji: "💼", specialty: "финансы и карьера" },
    { name: "Елена", emoji: "🌌", specialty: "лунная мудрость" },
    { name: "Артём", emoji: "🌠", specialty: "звёздные пути" },
    { name: "София", emoji: "✨", specialty: "интуитивное видение" },
    { name: "Марк", emoji: "🌀", specialty: "энергетические потоки" }
  ];

  // Пытаемся найти имя таролога в тексте
  for (const reader of readers) {
    if (text.includes(reader.name)) {
      return reader;
    }
  }

  // Если не нашли, выбираем случайного
  return readers[Math.floor(Math.random() * readers.length)];
}

// Фолбэк функции
function getRandomOutcome() {
  const outcomes = [
    'неожиданную встречу',
    'важное решение',
    'финансовые изменения',
    'душевное прозрение',
    'новые возможности'
  ];
  return outcomes[Math.floor(Math.random() * outcomes.length)];
}

function getRandomAdvice() {
  const advices = [
    'прислушивайтесь к тихому голосу интуиции',
    'не бойтесь делать первые шаги',
    'дайте ситуации время созреть',
    'обсудите свои мысли с близким человеком'
  ];
  return advices[Math.floor(Math.random() * advices.length)];
}

function getRandomSign() {
  const signs = [
    'повторяющиеся числа',
    'сны',
    'случайные встречи',
    'внутренние озарения'
  ];
  return signs[Math.floor(Math.random() * signs.length)];
}

function generateFallbackAnalysis(cards, spreadType, question) {
  const reader = extractTarotReader("");
  
  return `
Привет! Я ${reader.name}, ${reader.specialty} ${reader.emoji}. 

${question ? `Ваш вопрос "${question}" очень важен. Давайте разберём его через призму карт.` : 'Давайте посмотрим, что говорят карты о вашей текущей ситуации.'}

Первое, что бросается в глаза — сочетание карт. В моей практике такое сочетание часто указывает на период переходов. 

${cards.map((card, i) => `
${card.name} в позиции ${i + 1} говорит о ${card.keyword.toLowerCase()}. Помню, как у одного клиента эта карта предсказала ${getRandomOutcome()}.`).join('')}

Карты взаимодействуют интересным образом... Чувствуется напряжение, но и потенциал для роста. 

Мой совет: ${getRandomAdvice()}

В ближайшие недели обратите внимание на ${getRandomSign()}. 

С уважением, ${reader.name}`;
}

function generateFallbackSummary(cards) {
  const majorCount = cards.filter(c => c.suit === 'major').length;
  if (majorCount > cards.length / 2) {
    return 'Период судьбоносных перемен. Карты говорят о важных жизненных уроков.';
  }
  return 'Сбалансированный расклад с акцентом на практические действия.';
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { cards, spreadType, question, userId } = req.body;

    if (!cards || !Array.isArray(cards) || cards.length === 0) {
      return res.status(400).json({ error: 'Cards array is required' });
    }

    // Проверяем кэш
    const cacheKey = `${userId}_${spreadType}_${cards.map(c => c.id).join('_')}`;
    const cached = getCachedAnalysis(cacheKey);
    
    if (cached) {
      return res.status(200).json(cached);
    }

    // Оптимизируем карты для ИИ
    const optimizedCards = optimizeCardsForAI(cards);

    // Создаем промпт для пользователя
    const userPrompt = `
Тип расклада: ${spreadType || 'Общий расклад'}
${question ? `Вопрос клиента: "${question}"` : 'Клиент не задал конкретного вопроса, нужен общий анализ'}

Карты в раскладе (${optimizedCards.length} карт):
${optimizedCards.map((card, index) => `
Позиция ${index + 1}: ${card.name}
Ключевое слово: ${card.keyword}
Описание: ${card.description}
Прямое значение: ${card.upright}
Перевёрнутое: ${card.reversed}
Совет: ${card.advice}
---`).join('\n')}

Дайте трактовку так, как будто вы живой таролог, говорящий с клиентом. Начните с приветствия и представьтесь.`;

    // Запрашиваем анализ у OpenAI
    const completion = await openai.chat.completions.create({
      model: "gpt-4", // Используем GPT-4 для лучшего качества
      messages: [
        { 
          role: "system", 
          content: SYSTEM_PROMPT 
        },
        { 
          role: "user", 
          content: userPrompt 
        }
      ],
      temperature: 0.8,
      max_tokens: 2000,
      presence_penalty: 0.3,
      frequency_penalty: 0.3
    });

    const analysis = completion.choices[0]?.message?.content;

    if (!analysis) {
      throw new Error('No analysis generated');
    }

    // Генерируем краткое резюме
    const summaryCompletion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { 
          role: "system", 
          content: "Создай краткое резюме анализа Таро (2-3 предложения). Будь ёмким и мудрым." 
        },
        { 
          role: "user", 
          content: `Создай резюме для этого анализа: ${analysis.substring(0, 300)}` 
        }
      ],
      temperature: 0.7,
      max_tokens: 150,
    });

    const summary = summaryCompletion.choices[0]?.message?.content || '';

    // Извлекаем имя таролога из текста
    const tarotReader = extractTarotReader(analysis);
    
    const result = {
      success: true,
      analysis,
      summary,
      tarotReader,
      timestamp: new Date().toISOString(),
      cardsCount: cards.length,
      spreadType: spreadType || 'general',
      readingId: 'reading_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
    };

    // Кэшируем результат
    cacheAnalysis(cacheKey, result);

    return res.status(200).json(result);

  } catch (error) {
    console.error('Tarot Reading Error:', error);
    
    // Фолбэк на локальную генерацию, если ИИ недоступен
    return res.status(200).json({
      success: true,
      analysis: generateFallbackAnalysis(req.body.cards, req.body.spreadType, req.body.question),
      summary: generateFallbackSummary(req.body.cards),
      tarotReader: { name: "Арина", emoji: "🌙", specialty: "кармические связи" },
      fallback: true,
      timestamp: new Date().toISOString()
    });
  }
}
