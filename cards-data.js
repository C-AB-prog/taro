// cards-data.js

// 4 карты для демки
const TAROT_CARDS = [
  {
    id: 0,
    roman: "0",
    name: "Шут",
    keyword: "Новый путь, свобода, риск",
    description:
      "День, когда можно позволить себе шаг в неизвестность. Попробуй то, что давно откладывал(а), даже если всё кажется не до конца понятным.",
    image: "cards/0-the-fool-unified.png"
  },
  {
    id: 1,
    roman: "I",
    name: "Маг",
    keyword: "Воля, фокус, инициатива",
    description:
      "У тебя есть все ресурсы, чтобы сдвинуть ситуацию с места. Подходит день для активных действий, переговоров и чётких намерений.",
    image: "cards/1-the-magician-unified.png"
  },
  {
    id: 2,
    roman: "II",
    name: "Верховная Жрица",
    keyword: "Интуиция, глубина, тайна",
    description:
      "Важно сначала прислушаться к себе. Обрати внимание на ощущения, сны, знаки — ответы уже рядом, нужно лишь дать себе тишину.",
    image: "cards/2-the-high-priestess-unified.png"
  },
  {
    id: 10,
    roman: "X",
    name: "Колесо Фортуны",
    keyword: "Поворот, шанс, перемены",
    description:
      "События могут ускориться. Следи за неожиданными предложениями и совпадениями — среди них может быть твой шанс на новый виток.",
    image: "cards/10-wheel-of-fortune-unified.png"
  }
];

// 10 платных раскладов
const TAROT_SPREADS = [
  {
    id: "love-3",
    title: "Отношения: 3 карты",
    description: "Ты, партнёр и энергия связи — краткий срез текущей ситуации.",
    priceLabel: "390 ₽",
    tag: "быстрый разбор",
    prodamusUrl: "https://prodamus.ru/your-product-link-1"
  },
  {
    id: "love-7",
    title: "Любовный расклад 7 карт",
    description: "Глубокий анализ динамики отношений и перспектив на ближайшее время.",
    priceLabel: "690 ₽",
    tag: "глубокий",
    prodamusUrl: "https://prodamus.ru/your-product-link-2"
  },
  {
    id: "work-5",
    title: "Работа и карьера",
    description: "Куда движется твой профессиональный путь и какие возможности уже рядом.",
    priceLabel: "550 ₽",
    tag: "карьера",
    prodamusUrl: "https://prodamus.ru/your-product-link-3"
  },
  {
    id: "money-4",
    title: "Финансы: 3 месяца",
    description: "Как изменится финансовый поток, где риски и точки роста.",
    priceLabel: "520 ₽",
    tag: "деньги",
    prodamusUrl: "https://prodamus.ru/your-product-link-4"
  },
  {
    id: "choice-3",
    title: "Выбор из двух вариантов",
    description: "Сравнение двух путей: плюсы, минусы и скрытые последствия.",
    priceLabel: "450 ₽",
    tag: "выбор",
    prodamusUrl: "https://prodamus.ru/your-product-link-5"
  },
  {
    id: "year-12",
    title: "Расклад на год",
    description: "Ключевые темы, уроки и повороты на ближайшие 12 месяцев.",
    priceLabel: "1 200 ₽",
    tag: "годовой",
    prodamusUrl: "https://prodamus.ru/your-product-link-6"
  },
  {
    id: "self-5",
    title: "Путь к себе",
    description: "Что важно принять в себе, куда расти и где твоя опора.",
    priceLabel: "590 ₽",
    tag: "самопознание",
    prodamusUrl: "https://prodamus.ru/your-product-link-7"
  },
  {
    id: "energy-4",
    title: "Энергетика и ресурсы",
    description: "Где ты теряешь силы и как мягко восстановить ресурс.",
    priceLabel: "530 ₽",
    tag: "ресурс",
    prodamusUrl: "https://prodamus.ru/your-product-link-8"
  },
  {
    id: "yes-no",
    title: "Да / нет + совет",
    description: "Ответ на конкретный вопрос и рекомендация, как действовать.",
    priceLabel: "350 ₽",
    tag: "конкретный вопрос",
    prodamusUrl: "https://prodamus.ru/your-product-link-9"
  },
  {
    id: "karmic",
    title: "Кармический узел",
    description: "Что зациклилось в твоей жизни и как начать это мягко расплетать.",
    priceLabel: "800 ₽",
    tag: "карма",
    prodamusUrl: "https://prodamus.ru/your-product-link-10"
  }
];
