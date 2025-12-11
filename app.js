// ===== УТИЛИТЫ =====
const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));

// ===== СОСТОЯНИЕ =====
const AppState = {
  user: null,
  userId: null,
  currentCard: null,
  archive: [],
  isLoading: false,
  userStars: 0,
  questionType: 'love',
  lastWheelSpin: null,
  lastWheelText: '',
  stateLoaded: false,
  wheelTimerId: null,
  aiEnabled: true
};

const ASK_UNIVERSE_PRICE = 35;
const YES_NO_PRICE = 25;
const NEW_USER_STARS = 150;
const WHEEL_COOLDOWN_HOURS = 24;

// ===== МЕТА ДЛЯ КАРТ (для общего вывода расклада) =====
const CARD_META = {
  0: { score: 1, tags: ['change', 'inner'], vibe: 'новый цикл, спонтанность и желание попробовать' },
  1: { score: 2, tags: ['career', 'inner'], vibe: 'сильная воля, умение влиять на события и создавать результат' },
  2: { score: 1, tags: ['inner', 'relationships'], vibe: 'интуиция, скрытые мотивы и внутреннее знание' },
  3: { score: 2, tags: ['relationships', 'material'], vibe: 'изобилие, притяжение, забота и созидание' },
  4: { score: 1, tags: ['career', 'material'], vibe: 'структура, ответственность и контроль над ситуацией' },
  5: { score: 1, tags: ['inner', 'relationships'], vibe: 'традиции, обучение и опора на проверенные подходы' },
  6: { score: 2, tags: ['relationships'], vibe: 'выбор сердцем, партнёрство и важные решения в отношениях' },
  7: { score: 2, tags: ['career', 'change'], vibe: 'движение вперёд, победа и контроль над направлением' },
  8: { score: 2, tags: ['inner', 'relationships'], vibe: 'внутренняя устойчивость, мягкая сила и терпение' },
  9: { score: 0, tags: ['inner'], vibe: 'самоанализ, пауза и поиск собственных ответов' },
  10: { score: 2, tags: ['change', 'fate'], vibe: 'смена этапа, судьбоносные события и обновление цикла' },
  11: { score: 0, tags: ['karma', 'material'], vibe: 'равновесие, честность и необходимость принимать последствия' }
};

// Дополняем META для всех карт
for (let i = 12; i <= 77; i++) {
  CARD_META[i] = { 
    score: Math.floor(Math.random() * 3) - 1,
    tags: getRandomTags(),
    vibe: getRandomVibe()
  };
}

function getRandomTags() {
  const allTags = ['inner', 'relationships', 'career', 'material', 'change', 'karma', 'fate'];
  const count = Math.floor(Math.random() * 3) + 1;
  const shuffled = [...allTags].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

function getRandomVibe() {
  const vibes = [
    'энергия перемен и новых возможностей',
    'внутренний поиск и осознание',
    'гармония в отношениях и взаимопонимание',
    'материальная стабильность и рост',
    'творческий подъём и вдохновение',
    'преодоление трудностей и развитие',
    'духовный рост и просветление',
    'практические достижения и успех',
    'эмоциональная глубина и чувствительность',
    'интеллектуальный прорыв и ясность'
  ];
  return vibes[Math.floor(Math.random() * vibes.length)];
}

// ===== ГЛОБАЛЬНАЯ ОБРАБОТКА ОШИБОК КАРТОЧНЫХ КАРТИНОК (png/jpg) =====
window.handleCardImageError = function handleCardImageError(img) {
  if (!img) return;
  const src = img.getAttribute('src') || '';
  if (!src) return;

  const lower = src.toLowerCase();

  // Один раз пробуем альтернативное расширение
  if (!img.dataset.altTried) {
    img.dataset.altTried = '1';

    if (lower.endsWith('.png')) {
      img.src = src.replace(/\.png$/i, '.jpg');
      return;
    }

    if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) {
      img.src = src.replace(/\.jpe?g$/i, '.png');
      return;
    }
  }

  // Если не сработало — ставим дефолт
  img.onerror = null;
  img.src = 'cards/default-card.jpg';
};

// ===== РАСКЛАДЫ ИЗ cards-data.js в едином формате =====
var SPREADS = (window.TAROT_SPREADS || []).map((s) => ({
  id: s.id,
  title: s.title,
  description: s.description,
  price:
    typeof s.price === 'number'
      ? s.price
      : parseInt(String(s.priceLabel || '').replace(/\D/g, ''), 10) || 0,
  cardsCount:
    typeof s.cardsCount === 'number'
      ? s.cardsCount
      : Number(s.cards) || s.requiredCards || 0
}));

// ===== УДАЛЯЕМ ФУНКЦИИ ИИ (по просьбе пользователя) =====
// Вместо ИИ используем улучшенный базовый анализ

function getSpreadAnalysis(spread, cards, question = '') {
  return {
    analysis: generateSpreadAnalysis(spread, cards, question),
    summary: generateBasicSummary(cards),
    isEnhanced: true,
    timestamp: new Date().toISOString()
  };
}

function generateSpreadAnalysis(spread, cards, question = '') {
  const cardNames = cards.map(c => c.name).join(', ');
  const majorCount = cards.filter(c => c.suit === 'major').length;
  const cupsCount = cards.filter(c => c.suit === 'cups').length;
  const swordsCount = cards.filter(c => c.suit === 'swords').length;
  const pentaclesCount = cards.filter(c => c.suit === 'pentacles').length;
  const wandsCount = cards.filter(c => c.suit === 'wands').length;
  
  let analysis = `📊 АНАЛИЗ РАСКЛАДА "${spread.title}"\n\n`;
  
  if (question) {
    analysis += `Вопрос: "${question}"\n\n`;
  }
  
  analysis += `Карты в раскладе: ${cardNames}\n\n`;
  
  analysis += `🔍 ОБЩАЯ ЭНЕРГЕТИКА:\n`;
  
  if (majorCount > cards.length / 2) {
    analysis += `Сильное влияние Старших Арканов (${majorCount} из ${cards.length}) — период значительных перемен и судьбоносных событий.\n\n`;
  } else if (cupsCount > 0 && swordsCount === 0) {
    analysis += `Эмоционально насыщенный расклад с акцентом на чувства и отношения.\n\n`;
  } else if (swordsCount > cupsCount) {
    analysis += `Расклад с ментальным акцентом — важно анализировать ситуации, а не действовать импульсивно.\n\n`;
  } else {
    analysis += `Сбалансированный расклад с разнообразными энергиями.\n\n`;
  }
  
  analysis += `💫 ОСНОВНЫЕ ТЕМЫ:\n`;
  const themes = [];
  if (cupsCount > 0) themes.push('эмоции и отношения');
  if (swordsCount > 0) themes.push('мысли и решения');
  if (pentaclesCount > 0) themes.push('материальные вопросы');
  if (wandsCount > 0) themes.push('творчество и действие');
  if (majorCount > 0) themes.push('важные жизненные уроки');
  
  analysis += themes.join(', ') + '.\n\n';
  
  analysis += `🌟 РЕКОМЕНДАЦИИ:\n`;
  analysis += `1. Рассмотрите каждую карту как часть единой картины\n`;
  analysis += `2. Обратите внимание на повторяющиеся символы или цвета\n`;
  analysis += `3. Доверьтесь своей интуиции при интерпретации\n`;
  analysis += `4. Возвращайтесь к этому раскладу в течение недели\n\n`;
  
  analysis += `📝 КЛЮЧЕВОЙ СОВЕТ:\n`;
  const advice = [
    "Используйте энергию этого расклада для осознанных действий.",
    "Этот период идеален для внутренней работы и размышлений.",
    "Обратите внимание на знаки, которые появляются в ближайшие дни.",
    "Доверяйте процессу и не торопите события.",
    "Используйте полученные инсайты для практических шагов."
  ];
  analysis += advice[Math.floor(Math.random() * advice.length)];
  
  return analysis;
}

function generateBasicSummary(cards) {
  const majorArcana = cards.filter(c => c.suit === 'major').length;
  const positiveCards = cards.filter(c => {
    const meta = CARD_META[c.cardId || c.id];
    return meta && meta.score > 0;
  }).length;
  
  if (majorArcana > cards.length / 2) {
    return 'Расклад с сильным влиянием старших арканов — период значительных перемен.';
  } else if (positiveCards > cards.length / 2) {
    return 'Преобладают поддерживающие энергии — благоприятный период для действий.';
  } else {
    return 'Сбалансированный расклад, требующий внимательного рассмотрения всех аспектов.';
  }
}

// ===== АНИМАЦИИ =====
class MysticAnimations {
  constructor() {
    this.initParticles();
    this.initCardAnimations();
    this.initButtonEffects();
  }

  initParticles() {
    const container = $('.particles');
    if (!container) return;

    for (let i = 0; i < 10; i++) {
      const particle = document.createElement('div');
      particle.style.cssText = `
        position: absolute;
        width: ${2 + Math.random() * 3}px;
        height: ${2 + Math.random() * 3}px;
        background: ${i % 3 === 0 ? 'var(--primary)' : i % 3 === 1 ? 'var(--secondary)' : 'var(--accent)'};
        border-radius: 50%;
        top: ${Math.random() * 100}%;
        left: ${Math.random() * 100}%;
        opacity: ${0.05 + Math.random() * 0.1};
        animation: floatParticle ${15 + Math.random() * 10}s linear infinite;
        animation-delay: ${Math.random() * 5}s;
      `;
      container.appendChild(particle);
    }
  }

  initCardAnimations() {
    document.addEventListener('mouseover', (e) => {
      const card = e.target.closest('.card-image-container, .deck-card, .card-image-container-full');
      if (card) {
        card.style.transform = 'translateY(-10px)';
        card.style.boxShadow = '0 20px 40px rgba(138, 43, 226, 0.3)';
      }
    });

    document.addEventListener('mouseout', (e) => {
      const card = e.target.closest('.card-image-container, .deck-card, .card-image-container-full');
      if (card) {
        card.style.transform = 'translateY(0)';
        card.style.boxShadow = '';
      }
    });
  }

  initButtonEffects() {
    const buttons = $$('.refresh-btn, .spin-btn, .ask-btn, .action-card');
    buttons.forEach((btn) => {
      btn.addEventListener('click', (e) => this.createRippleEffect(e));
    });
  }

  createRippleEffect(event) {
    const btn = event.currentTarget;
    const ripple = document.createElement('span');

    const diameter = Math.max(btn.clientWidth, btn.clientHeight);
    const radius = diameter / 2;

    ripple.style.cssText = `
      position: absolute;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.3);
      transform: scale(0);
      animation: ripple 0.6s linear;
      pointer-events: none;
      width: ${diameter}px;
      height: ${diameter}px;
      left: ${event.clientX - btn.getBoundingClientRect().left - radius}px;
      top: ${event.clientY - btn.getBoundingClientRect().top - radius}px;
    `;

    btn.style.position = 'relative';
    btn.style.overflow = 'hidden';
    btn.appendChild(ripple);

    setTimeout(() => ripple.remove(), 600);
  }
}

// ===== ОБЩИЙ ВЫВОД РАСКЛАДА =====
function buildSpreadSummary(spread, cards) {
  if (!cards || !cards.length) {
    return 'Расклад получился нейтральным, дополнительная трактовка пока недоступна.';
  }

  let totalScore = 0;
  const tagCounter = {};
  const vibes = [];

  cards.forEach((entry) => {
    const id =
      typeof entry.cardId === 'number'
        ? entry.cardId
        : typeof entry.id === 'number'
        ? entry.id
        : null;
    const meta = id != null ? CARD_META[id] : null;
    if (!meta) return;

    totalScore += meta.score;
    meta.tags.forEach((tag) => {
      tagCounter[tag] = (tagCounter[tag] || 0) + 1;
    });
    vibes.push(meta.vibe);
  });

  const avg = totalScore / cards.length;
  let tone;
  if (avg >= 1) {
    tone = 'в целом расклад выглядит поддерживающим и ресурсным';
  } else if (avg <= -0.5) {
    tone = 'в целом расклад указывает на более напряжённый этап и необходимость аккуратности';
  } else {
    tone = 'в целом расклад сбалансирован, без ярко выраженного плюса или минуса';
  }

  let topTag = null;
  let topCount = 0;
  Object.entries(tagCounter).forEach(([tag, count]) => {
    if (count > topCount) {
      topCount = count;
      topTag = tag;
    }
  });

  let themeText = '';
  switch (topTag) {
    case 'relationships':
      themeText = 'Главная тема — сфера отношений, взаимодействие с людьми и эмоциональные связи.';
      break;
    case 'career':
      themeText = 'Главная тема — реализация, работа, цели и внешние достижения.';
      break;
    case 'inner':
      themeText = 'Главная тема — внутренние процессы, интуиция и личное взросление.';
      break;
    case 'change':
      themeText = 'Расклад подчёркивает период перемен и смену этапа в вашей жизни.';
      break;
    case 'material':
      themeText = 'Сильный акцент идёт на материальную сферу, стабильность и вопросы ресурса.';
      break;
    case 'karma':
    case 'fate':
      themeText = 'В раскладе чувствуется кармический оттенок: важные уроки и судьбоносные события.';
      break;
    default:
      themeText = 'Карты затрагивают несколько сфер одновременно, без доминирования одной темы.';
  }

  const vibesSample = vibes.slice(0, 3).join('; ');

  return [
    `В целом ${tone}.`,
    themeText,
    `По ощущениям карт это про: ${vibesSample}.`,
    `Сейчас важно отнестись к происходящему осознанно и использовать сильные стороны расклада, а не зацикливаться на возможных сложностях.`
  ].join(' ');
}

// ===== БЭК: ЗАГРУЗКА / СОХРАНЕНИЕ =====
async function loadUserStateFromServer() {
  const userId = AppState.userId;
  if (!userId) {
    AppState.userStars = NEW_USER_STARS;
    AppState.archive = [];
    AppState.lastWheelSpin = null;
    AppState.lastWheelText = '';
    AppState.stateLoaded = true;
    return;
  }

  try {
    const res = await fetch('/api/state?userId=' + encodeURIComponent(String(userId)));

    if (res.status === 404) {
      AppState.userStars = NEW_USER_STARS;
      AppState.archive = [];
      AppState.lastWheelSpin = null;
      AppState.lastWheelText = '';
      AppState.stateLoaded = true;
      return;
    }

    if (!res.ok) throw new Error('Failed to load state');

    const data = await res.json();

    AppState.userStars =
      typeof data.stars === 'number' && data.stars > 0 ? data.stars : NEW_USER_STARS;
    AppState.archive = Array.isArray(data.archive) ? data.archive : [];
    AppState.lastWheelSpin = data.wheelLastSpin ? new Date(data.wheelLastSpin) : null;
    AppState.lastWheelText = data.lastWheelText || '';
    AppState.stateLoaded = true;
  } catch (err) {
    console.error('Ошибка загрузки состояния:', err);
    AppState.userStars = NEW_USER_STARS;
    AppState.archive = [];
    AppState.lastWheelSpin = null;
    AppState.lastWheelText = '';
    AppState.stateLoaded = true;
  }
}

async function saveUserStateToServer() {
  const userId = AppState.userId;
  if (!userId) return;

  const payload = {
    userId: String(userId),
    stars: AppState.userStars,
    archive: AppState.archive,
    wheelLastSpin: AppState.lastWheelSpin ? AppState.lastWheelSpin.toISOString() : null,
    lastWheelText: AppState.lastWheelText || ''
  };

  try {
    await fetch('/api/state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } catch (err) {
    console.error('Ошибка сохранения состояния:', err);
  }
}

// ===== ИНИЦИАЛИЗАЦИЯ =====
async function initApp() {
  try {
    initTelegram();
    cleanupHeaderStatus();

    window.mysticAnimations = new MysticAnimations();

    await loadUserStateFromServer();
    updateStarsDisplay();
    renderArchive();

    await loadCardOfDay();
    initFortuneWheel();
    initSpreads();
    initDeck();
    initButtons();
    initNavigation();
    addAnimationStyles();
  } catch (error) {
    console.error('Ошибка инициализации:', error);
    showToast('Ошибка загрузки приложения', 'error');
  }
}

// ===== TELEGRAM =====
function initTelegram() {
  if (window.Telegram && window.Telegram.WebApp) {
    const tg = window.Telegram.WebApp;
    tg.ready();
    tg.expand();

    const user = tg.initDataUnsafe && tg.initDataUnsafe.user;
    if (user) {
      AppState.user = {
        name: user.first_name || 'Пользователь',
        username: user.username || ''
      };
      AppState.userId = user.id;
    }
  }

  if (!AppState.userId) {
    AppState.user = { name: 'Гость', username: 'debug_user' };
    AppState.userId = 999999;
  }
}

function cleanupHeaderStatus() {
  const amountEl = $('#stars-amount');
  if (amountEl) amountEl.textContent = '0';
}

// ===== КАРТА ДНЯ =====
async function loadCardOfDay() {
  const container = $('#card-day-content');
  if (!container || !window.TAROT_CARDS || !window.TAROT_CARDS.length) return;

  const today = new Date();
  const day = today.getDate();
  const month = today.getMonth() + 1;
  const year = today.getFullYear();
  
  const uniqueSeed = day + month * 100 + year;
  const cardIndex = uniqueSeed % window.TAROT_CARDS.length;
  const card = window.TAROT_CARDS[cardIndex];
  
  if (!card) return;

  AppState.currentCard = card;

  container.innerHTML = `
    <div class="card-display-full">
      <div class="card-image-container-full" onclick="showCardModalById(${card.id})">
        <img src="${card.image}"
             alt="${card.name}"
             class="card-image-full"
             onload="this.classList.add('loaded')"
             onerror="handleCardImageError(this)">
      </div>
      <div class="card-info-full">
        <div class="card-name-row">
          <div class="card-name">${card.name}</div>
          ${card.roman ? `<div class="card-roman">${card.roman}</div>` : ''}
        </div>
        <div class="card-category">${card.category} ${card.suit ? `• ${getSuitName(card.suit)}` : ''}</div>
        <div class="card-keyword">${card.keyword || ''}</div>

        <button class="btn-card-details" id="card-day-toggle">
          <i class="fas fa-search btn-card-details-icon"></i>
          <span class="btn-card-details-text">Подробное описание</span>
          <span class="btn-card-details-chevron">
            <i class="fas fa-chevron-down"></i>
          </span>
        </button>

        <div class="card-details-collapsible" id="card-day-details">
          <div class="card-description">${card.description || 'Описание карты'}</div>
          
          <div class="card-meanings">
            <div class="meaning-group">
              <div class="meaning-title">Прямое положение:</div>
              <div class="meaning-text">${card.upright || 'Позитивные аспекты карты'}</div>
            </div>
            <div class="meaning-group">
              <div class="meaning-title">Перевёрнутое положение:</div>
              <div class="meaning-text">${card.reversed || 'Теневая сторона карты'}</div>
            </div>
          </div>
          
          <div class="card-advice-section">
            <div class="advice-icon">
              <i class="fas fa-lightbulb"></i>
            </div>
            <div class="advice-text">${card.advice || 'Доверьтесь своей интуиции и наблюдайте за знаками.'}</div>
          </div>
          
          <div class="card-date">
            <i class="fas fa-calendar-alt"></i>
            ${today.toLocaleDateString('ru-RU', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric'
            })}
          </div>
        </div>
      </div>
    </div>
  `;

  initCardDayDetailsToggle();
}

function initCardDayDetailsToggle() {
  const toggleBtn = $('#card-day-toggle');
  const details = $('#card-day-details');
  if (!toggleBtn || !details) return;

  const chevronIcon = toggleBtn.querySelector('.btn-card-details-chevron i');
  const textSpan = toggleBtn.querySelector('.btn-card-details-text');
  let isOpen = false;

  toggleBtn.addEventListener('click', () => {
    isOpen = !isOpen;
    details.classList.toggle('open', isOpen);
    toggleBtn.classList.toggle('open', isOpen);

    if (chevronIcon) {
      chevronIcon.classList.toggle('fa-chevron-down', !isOpen);
      chevronIcon.classList.toggle('fa-chevron-up', isOpen);
    }
    if (textSpan) {
      textSpan.textContent = isOpen ? 'Скрыть подробности' : 'Подробное описание';
    }
  });
}

// ===== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ДЛЯ КАРТ =====
function getSuitName(suit) {
  switch(suit) {
    case 'swords': return 'Мечи';
    case 'cups': return 'Чаши';
    case 'pentacles': return 'Пентакли';
    case 'wands': return 'Жезлы';
    default: return '';
  }
}

// Глобальная функция для показа модалки по ID карты
window.showCardModalById = function(cardId) {
  const card = window.TAROT_CARDS.find(c => c.id === cardId);
  if (card) showCardModal(card);
};

// ===== МОДАЛКА КАРТЫ =====
function showCardModal(card) {
  const modal = $('#card-modal');
  const body = $('#card-modal-body');
  if (!modal || !body) return;

  body.innerHTML = `
   
