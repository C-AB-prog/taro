// Оптимизатор для сокращения запросов к ИИ

export function optimizeCardsForAI(cards) {
  return cards.map(card => ({
    name: card.name,
    category: card.category,
    suit: card.suit || '',
    keyword: card.keyword || '',
    // Сокращаем описания для экономии токенов
    description: card.description ? 
      card.description.substring(0, 150) + '...' : '',
    // Берем только первые 2-3 предложения
    upright: extractFirstSentences(card.upright, 2),
    reversed: extractFirstSentences(card.reversed, 2),
    advice: extractFirstSentences(card.advice, 1)
  }));
}

function extractFirstSentences(text, maxSentences = 2) {
  if (!text) return '';
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  return sentences.slice(0, maxSentences).join(' ');
}

// Кэширование результатов анализа
const analysisCache = new Map();

export function getCachedAnalysis(cards, spreadType) {
  const cacheKey = generateCacheKey(cards, spreadType);
  return analysisCache.get(cacheKey);
}

export function cacheAnalysis(cards, spreadType, analysis) {
  const cacheKey = generateCacheKey(cards, spreadType);
  // Храним в кэше 24 часа
  const expiry = Date.now() + 24 * 60 * 60 * 1000;
  analysisCache.set(cacheKey, { analysis, expiry });
  
  // Очистка просроченных записей
  cleanupCache();
}

function generateCacheKey(cards, spreadType) {
  const cardIds = cards.map(c => c.id).sort().join(',');
  return `${spreadType}:${cardIds}`;
}

function cleanupCache() {
  const now = Date.now();
  for (const [key, value] of analysisCache.entries()) {
    if (value.expiry < now) {
      analysisCache.delete(key);
    }
  }
}
