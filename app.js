// ===== УТИЛИТЫ =====
const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));

// ===== СКРОЛЛ-ЛОК ДЛЯ МОДАЛОК (чтобы фон не листался) =====
let __scrollLockY = 0;

function lockBodyScroll() {
  if (document.body.classList.contains('modal-open')) return;
  __scrollLockY = window.scrollY || 0;
  document.body.classList.add('modal-open');
  document.body.style.top = `-${__scrollLockY}px`;
}

function unlockBodyScroll() {
  if (!document.body.classList.contains('modal-open')) return;
  document.body.classList.remove('modal-open');
  document.body.style.top = '';
  window.scrollTo(0, __scrollLockY);
  __scrollLockY = 0;
}

function anyModalActive() {
  return !!document.querySelector('.modal.active');
}

function activateModal(modal) {
  if (!modal) return;
  modal.classList.add('active');
  lockBodyScroll();

  // На мобилке: если свайп по затемнению — не даём “пробить” фон
  const preventBackdropScroll = (e) => {
    if (e.target === modal) e.preventDefault();
  };
  modal.__preventBackdropScroll = preventBackdropScroll;
  modal.addEventListener('touchmove', preventBackdropScroll, { passive: false });
}

function closeModal(modal) {
  if (!modal) return;
  modal.classList.remove('active');

  if (modal.__preventBackdropScroll) {
    modal.removeEventListener('touchmove', modal.__preventBackdropScroll);
    modal.__preventBackdropScroll = null;
  }

  if (!anyModalActive()) unlockBodyScroll();
}

// ===== ФИКС ДЛЯ JPG/PNG: УМНЫЙ onerror =====
function handleCardImgError(imgEl) {
  if (!imgEl) return;
  const src = imgEl.getAttribute('src') || '';
  const step = Number(imgEl.dataset.fallbackStep || 0);

  // 0: пробуем сменить расширение
  if (step === 0) {
    if (/\.png(\?|#|$)/i.test(src)) {
      imgEl.dataset.fallbackStep = '1';
      imgEl.src = src.replace(/\.png(\?|#|$)/i, '.jpg$1');
      return;
    }
    if (/\.jpe?g(\?|#|$)/i.test(src)) {
      imgEl.dataset.fallbackStep = '1';
      imgEl.src = src.replace(/\.jpe?g(\?|#|$)/i, '.png$1');
      return;
    }
  }

  // 1+: дефолт
  imgEl.dataset.fallbackStep = '2';
  imgEl.onerror = null;
  imgEl.src = 'cards/default-card.jpg';
}
window.handleCardImgError = handleCardImgError;

// ===== МЕЛКИЕ УТИЛИТЫ =====
function truncateText(text, max = 140) {
  const t = String(text || '').trim();
  if (t.length <= max) return t;
  return t.slice(0, max - 1) + '…';
}

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

// ===== ВМЕСТО ИИ — УЛУЧШЕННЫЙ БАЗОВЫЙ АНАЛИЗ =====
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
    return 'Сильное влияние старших арканов — период значимых перемен.';
  } else if (positiveCards > cards.length / 2) {
    return 'Преобладают поддерживающие энергии — хороший период для действий.';
  } else {
    return 'Сбалансированный расклад, важно учитывать все нюансы.';
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
    const buttons = $$('.refresh-btn, .spin-btn, .ask-btn, .action-card, .btn-card-details');
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
      themeText = 'Главная тема — отношения и эмоциональные связи.';
      break;
    case 'career':
      themeText = 'Главная тема — реализация, работа и цели.';
      break;
    case 'inner':
      themeText = 'Главная тема — внутренние процессы и интуиция.';
      break;
    case 'change':
      themeText = 'Период перемен и смены этапа.';
      break;
    case 'material':
      themeText = 'Акцент на материальную сферу и ресурсы.';
      break;
    case 'karma':
    case 'fate':
      themeText = 'Чувствуется кармический оттенок: важные уроки.';
      break;
    default:
      themeText = 'Затронуто несколько сфер одновременно.';
  }

  const vibesSample = vibes.slice(0, 3).join('; ');

  return [
    `В целом ${tone}.`,
    themeText,
    `По ощущениям карт это про: ${vibesSample}.`,
    `Важно действовать осознанно и не зацикливаться на сложностях.`
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
    initDeckFilters();
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

// ===== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ДЛЯ КАРТ =====
function getSuitName(suit) {
  switch (suit) {
    case 'swords': return 'Мечи';
    case 'cups': return 'Чаши';
    case 'pentacles': return 'Пентакли';
    case 'wands': return 'Жезлы';
    default: return '';
  }
}

// ===== КАРТА ДНЯ (на главной только имя + значение, детали под кнопкой) =====
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

  const meaning = card.keyword || card.upright || card.description || '';
  const shortMeaning = truncateText(meaning, 140);

  container.innerHTML = `
    <div class="card-display-full">
      <div class="card-image-container-full" onclick="showCardDayModalById(${card.id})">
        <img src="${card.image}"
             alt="${card.name}"
             class="card-image-full"
             onload="this.classList.add('loaded')"
             onerror="handleCardImgError(this)">
      </div>

      <div class="card-info-full">
        <div class="card-name-row">
          <div class="card-name">${card.name}</div>
          ${card.roman ? `<div class="card-roman">${card.roman}</div>` : ''}
        </div>

        <div class="card-day-meaning">
          ${shortMeaning}
        </div>

        <button class="btn-card-details btn-card-details--toggle" id="card-day-toggle-btn" aria-expanded="false">
          <span>Подробности</span>
          <i class="fas fa-chevron-down"></i>
        </button>

        <div class="card-day-details" id="card-day-details">
          <div class="card-category">${card.category} ${card.suit ? `• ${getSuitName(card.suit)}` : ''}</div>
          ${card.description ? `<div class="card-description">${card.description}</div>` : ''}

          <div class="card-meanings">
            <div class="meaning-group">
              <div class="meaning-title">Прямое положение:</div>
              <div class="meaning-text">${card.upright || '—'}</div>
            </div>
            <div class="meaning-group">
              <div class="meaning-title">Перевёрнутое положение:</div>
              <div class="meaning-text">${card.reversed || '—'}</div>
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

  // Тоггл подробностей
  const btn = $('#card-day-toggle-btn');
  const details = $('#card-day-details');
  if (btn && details) {
    details.classList.remove('open');
    btn.setAttribute('aria-expanded', 'false');

    btn.onclick = () => {
      const isOpen = details.classList.toggle('open');
      btn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      btn.classList.toggle('is-open', isOpen);
    };
  }
}

// Глобальная функция для показа модалки по ID карты (компактная — для "Колоды")
window.showCardModalById = function (cardId) {
  const card = window.TAROT_CARDS.find(c => c.id === cardId);
  if (card) showCardModal(card, { mode: 'deck' });
};

// Модалка "Карта дня" (полная)
window.showCardDayModalById = function (cardId) {
  const card = window.TAROT_CARDS.find(c => c.id === cardId);
  if (card) showCardModal(card, { mode: 'day' });
};

// ===== МОДАЛКА КАРТЫ =====
// mode: 'day' => полная (с советом), 'deck' => краткая (без советов)
function showCardModal(card, opts = { mode: 'deck' }) {
  const modal = $('#card-modal');
  const body = $('#card-modal-body');
  if (!modal || !body) return;

  const isDay = opts.mode === 'day';

  if (isDay) {
    body.innerHTML = `
      <div class="card-modal-full">
        <div class="card-modal-image card-modal-image--day">
          <img src="${card.image}"
               alt="${card.name}"
               onerror="handleCardImgError(this)">
        </div>

        <div class="card-modal-content">
          <h3 class="card-modal-title">
            ${card.name}
            ${card.roman ? `<span class="card-modal-roman">${card.roman}</span>` : ''}
          </h3>

          <div class="card-modal-meta">
            <span class="meta-category">${card.category}</span>
            ${card.suit ? `<span class="meta-suit">${getSuitName(card.suit)}</span>` : ''}
          </div>

          ${card.keyword ? `
            <div class="card-modal-keyword">
              <i class="fas fa-key"></i>
              ${card.keyword}
            </div>
          ` : ''}

          ${card.description ? `
            <div class="card-modal-description">
              ${card.description}
            </div>
          ` : ''}

          <div class="card-modal-sections">
            <div class="section">
              <h4><i class="fas fa-sun"></i> Прямое положение</h4>
              <p>${card.upright || '—'}</p>
            </div>

            <div class="section">
              <h4><i class="fas fa-moon"></i> Перевёрнутое положение</h4>
              <p>${card.reversed || '—'}</p>
            </div>

            <div class="section section-advice">
              <h4><i class="fas fa-lightbulb"></i> Совет карты</h4>
              <p>${card.advice || 'Доверьтесь процессу и наблюдайте за знаками.'}</p>
            </div>
          </div>
        </div>
      </div>
    `;
  } else {
    // КОЛОДА: только “что за карта” + краткое описание, без советов и без доп.блоков
    body.innerHTML = `
      <div class="card-modal-full">
        <div class="card-modal-image">
          <img src="${card.image}"
               alt="${card.name}"
               onerror="handleCardImgError(this)">
        </div>

        <div class="card-modal-content">
          <h3 class="card-modal-title">
            ${card.name}
            ${card.roman ? `<span class="card-modal-roman">${card.roman}</span>` : ''}
          </h3>

          <div class="card-modal-meta">
            <span class="meta-category">${card.category}</span>
            ${card.suit ? `<span class="meta-suit">${getSuitName(card.suit)}</span>` : ''}
          </div>

          ${card.keyword ? `
            <div class="card-modal-keyword">
              <i class="fas fa-key"></i>
              ${card.keyword}
            </div>
          ` : ''}

          ${card.description ? `
            <div class="card-modal-description">
              ${truncateText(card.description, 320)}
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }

  openModal(modal);
}

// ===== КОЛЕСО ФОРТУНЫ =====
function initFortuneWheel() {
  const wheel = $('#fortune-wheel');
  const spinBtn = $('#spin-wheel-btn');
  const resultEl = $('#wheel-result');
  if (!wheel || !spinBtn || !resultEl) return;

  wheel.innerHTML = '';
  for (let i = 0; i < 12; i++) {
    const section = document.createElement('div');
    section.style.cssText = `
      position: absolute;
      width: 50%;
      height: 50%;
      transform-origin: 100% 100%;
      transform: rotate(${i * 30}deg) skewY(-60deg);
    `;
    wheel.appendChild(section);
  }

  const canSpinNow = () => {
    if (!AppState.lastWheelSpin) return true;
    const now = Date.now();
    const diffMs = now - AppState.lastWheelSpin.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    return diffHours >= WHEEL_COOLDOWN_HOURS;
  };

  const formatRemaining = () => {
    if (!AppState.lastWheelSpin) return 'доступно прямо сейчас';
    const now = Date.now();
    const next =
      AppState.lastWheelSpin.getTime() +
      WHEEL_COOLDOWN_HOURS * 60 * 60 * 1000;
    const diffMs = next - now;
    if (diffMs <= 0) return 'доступно прямо сейчас';

    const totalSec = Math.floor(diffMs / 1000);
    const hours = Math.floor(totalSec / 3600);
    const minutes = Math.floor((totalSec % 3600) / 60);
    const seconds = totalSec % 60;
    const pad = (n) => String(n).padStart(2, '0');

    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  };

  const updateWheelUI = () => {
    if (canSpinNow()) {
      spinBtn.disabled = false;
      spinBtn.innerHTML =
        '<i class="fas fa-play"></i><span>Крутить колесо</span><div class="spin-glow"></div>';
      resultEl.innerHTML = AppState.lastWheelText
        ? AppState.lastWheelText
        : 'Колесо готово к вращению. В день доступна одна попытка.';
    } else {
      spinBtn.disabled = true;
      const timerText = formatRemaining();
      const baseText =
        AppState.lastWheelText || 'Вы уже крутили колесо сегодня.';
      resultEl.innerHTML = `
        <div style="text-align:center;">
          <div style="margin-bottom:8px;">${baseText}</div>
          <div style="font-size:13px; color:var(--text-light);">
            Следующее вращение через ${timerText}
          </div>
        </div>
      `;
    }
  };

  if (AppState.wheelTimerId) clearInterval(AppState.wheelTimerId);
  AppState.wheelTimerId = setInterval(updateWheelUI, 1000);
  updateWheelUI();

  spinBtn.addEventListener('click', async () => {
    if (!canSpinNow()) {
      showToast('Колесо будет доступно чуть позже', 'info');
      return;
    }
    if (wheel.classList.contains('spinning')) return;

    wheel.classList.add('spinning');
    spinBtn.disabled = true;
    spinBtn.innerHTML =
      '<i class="fas fa-spinner fa-spin"></i><span>Крутится...</span>';

    const spins = 5 + Math.floor(Math.random() * 4);
    const extraDegrees = Math.floor(Math.random() * 360);
    const totalRotation = spins * 360 + extraDegrees;

    wheel.style.transition =
      'transform 3s cubic-bezier(0.2, 0.8, 0.3, 1)';
    wheel.style.transform = `rotate(${totalRotation}deg)`;

    setTimeout(async () => {
      wheel.classList.remove('spinning');

      const allCards = window.TAROT_CARDS || [];
      if (!allCards.length) {
        resultEl.textContent = 'Колода не найдена.';
        spinBtn.disabled = false;
        return;
      }

      const idx = Math.floor(Math.random() * allCards.length);
      const card = allCards[idx];

      const now = new Date();
      AppState.lastWheelSpin = now;

      const wheelTextHtml = `
        <div style="text-align:center;">
          <img src="${card.image}"
               alt="${card.name}"
               style="width:120px;height:180px;object-fit:cover;border-radius:12px;box-shadow:0 10px 25px rgba(0,0,0,0.2);margin-bottom:12px;"
               onerror="handleCardImgError(this)">
          <div style="font-size:16px; margin-bottom:6px;">Выпала карта:</div>
          <div style="font-size:20px; font-weight:700; color:var(--primary); margin-bottom:4px;">
            ${card.name}${card.roman ? ` (${card.roman})` : ''}
          </div>
          <div style="font-size:14px; color:var(--secondary); margin-bottom:8px;">
            ${card.keyword || ''}
          </div>
          <div style="font-size:13px; color:var(--text); margin-bottom:8px;">
            ${truncateText(card.description || '', 160)}
          </div>
        </div>
      `;

      AppState.lastWheelText = wheelTextHtml;

      const entry = {
        type: 'wheel',
        createdAt: now.toISOString(),
        title: 'Колесо фортуны',
        card: {
          id: card.id,
          name: card.name,
          roman: card.roman,
          keyword: card.keyword,
          description: card.description,
          advice: card.advice,
          image: card.image
        }
      };
      AppState.archive = [entry, ...(AppState.archive || [])];

      await saveUserStateToServer();
      renderArchive();
      updateWheelUI();
      showToast('Результат колеса сохранён в архив', 'success');
    }, 3000);
  });
}

// ===== РАСКЛАДЫ (убраны надписи “улучшенный анализ/персонализация”, цена красивее) =====
function initSpreads() {
  const container = $('#spreads-grid');
  if (!container) return;

  container.innerHTML = SPREADS.map(
    (spread) => `
    <div class="spread-item" data-id="${spread.id}">
      <div class="spread-title-row">
        <div class="spread-title">${spread.title}</div>
        <div class="spread-price">
          <span class="spread-price-num">${spread.price}</span>
          <span class="spread-price-star">★</span>
        </div>
      </div>
      <div class="spread-description">${spread.description}</div>
      <div class="spread-meta">
        <span><i class="fas fa-layer-group"></i> ${spread.cardsCount} карт</span>
      </div>
    </div>
  `
  ).join('');

  $$('.spread-item').forEach((item) => {
    item.addEventListener('click', async function () {
      const spreadId = this.getAttribute('data-id');
      const spread = SPREADS.find((s) => s.id === spreadId);
      if (!spread) return;

      const price = spread.price;
      const title = spread.title;

      if (AppState.userStars < price) {
        showToast('Недостаточно звёзд. Нужно ' + price + ' ★', 'error');
        return;
      }

      const question = await openQuestionModalForSpread(spread);
      if (question === undefined) return;

      const ok = await openConfirmModal({
        title: 'Покупка расклада',
        message: `Купить расклад "${title}" за ${price} ★?${question ? '\n\nС вопросом: ' + question : ''}`,
        okText: 'Купить',
        cancelText: 'Отмена'
      });

      if (!ok) return;

      AppState.userStars -= price;
      updateStarsDisplay();

      showToast('🎴 Создаём расклад...', 'info');

      const result = await performSpread(spread, question);

      AppState.archive = [result, ...(AppState.archive || [])];
      await saveUserStateToServer();
      renderArchive();

      showSpreadResultModal(result);

      showToast(`Расклад "${title}" готов!`, 'success');
    });
  });
}

// ===== ФИКС: модалка вопроса расклада (без inline resolve в HTML) =====
async function openQuestionModalForSpread(spread) {
  return new Promise((resolve) => {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-content">
        <button class="modal-close" type="button">&times;</button>
        <div class="modal-header">
          <div class="modal-icon">
            <i class="fas fa-question"></i>
          </div>
          <h3>Вопрос для расклада</h3>
        </div>
        <div class="modal-body">
          <p style="margin-bottom: 16px; color: var(--text-light); font-size: 14px;">
            Задайте вопрос для более точного анализа (необязательно)
          </p>
          <textarea 
            id="spread-question-input" 
            placeholder="Например: Что ждёт меня в отношениях в ближайшие 3 месяца?"
            rows="3"
            style="width: 100%; padding: 12px; border-radius: 12px; border: 1px solid var(--border); margin-bottom: 16px;"
          ></textarea>
          <div class="modal-actions">
            <button class="btn-secondary" id="spread-no-question-btn" type="button">Без вопроса</button>
            <button class="btn-primary" id="spread-continue-btn" type="button">Продолжить</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    activateModal(modal);

    setTimeout(() => {
      const textarea = modal.querySelector('#spread-question-input');
      if (textarea) textarea.focus();
    }, 10);

    const closeBtn = modal.querySelector('.modal-close');
    const noBtn = modal.querySelector('#spread-no-question-btn');
    const contBtn = modal.querySelector('#spread-continue-btn');
    const input = modal.querySelector('#spread-question-input');

    const done = (val) => {
      closeModal(modal);
      modal.remove();
      resolve(val);
    };

    if (closeBtn) closeBtn.onclick = () => done('');
    if (noBtn) noBtn.onclick = () => done('');
    if (contBtn) contBtn.onclick = () => done((input && input.value.trim()) || '');

    modal.addEventListener('click', (e) => {
      if (e.target === modal) done('');
    });
  });
}

async function performSpread(spread, question = '') {
  const allCards = window.TAROT_CARDS || [];
  const cardsCopy = allCards.slice();
  const used = [];

  const count = Math.min(spread.cardsCount, cardsCopy.length);

  for (let i = 0; i < count; i++) {
    const idx = Math.floor(Math.random() * cardsCopy.length);
    const card = cardsCopy.splice(idx, 1)[0];

    used.push({
      cardId: card.id,
      id: card.id,
      name: card.name,
      roman: card.roman,
      keyword: card.keyword,
      description: card.description,
      advice: card.advice,
      image: card.image,
      category: card.category,
      suit: card.suit
    });
  }

  const analysisResult = getSpreadAnalysis(spread, used, question);

  return {
    type: 'spread',
    spreadId: spread.id,
    title: spread.title,
    createdAt: new Date().toISOString(),
    cards: used,
    summary: analysisResult.summary,
    analysis: analysisResult.analysis,
    isEnhanced: analysisResult.isEnhanced,
    question: question || ''
  };
}

function showSpreadResultModal(result) {
  const modal = $('#card-modal');
  const body = $('#card-modal-body');
  if (!modal || !body) return;

  const dateStr = new Date(result.createdAt).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const cardsHtml = (result.cards || [])
    .map(
      (card) => `
    <div class="spread-card-item">
      <img src="${card.image}"
           alt="${card.name}"
           class="spread-card-image"
           onload="this.classList.add('loaded')"
           onerror="handleCardImgError(this)">
      <div class="spread-card-content">
        <div class="spread-card-name">${card.name}${card.roman ? ` (${card.roman})` : ''}</div>
        <div class="spread-card-category">${card.category} ${card.suit ? `• ${getSuitName(card.suit)}` : ''}</div>
        <div class="spread-card-keyword">${card.keyword || ''}</div>
      </div>
    </div>
  `
    )
    .join('');

  body.innerHTML = `
    <div style="text-align:left;">
      <h3 style="font-size:20px; color:var(--primary); margin-bottom:8px;">${result.title}</h3>
      <div style="font-size:12px; color:var(--text-light); margin-bottom:8px;">
        <i class="fas fa-calendar-alt"></i> ${dateStr}
        ${result.question ? `<br><i class="fas fa-question-circle"></i> Вопрос: "${result.question}"` : ''}
      </div>

      ${result.summary ? `
        <div class="result-summary-box">
          <div class="result-summary-title">Короткий вывод</div>
          <div class="result-summary-text">${result.summary}</div>
        </div>
      ` : ''}

      <div style="font-size:14px; color:var(--primary); font-weight:600; margin-bottom:12px;">
        Карты в раскладе (${result.cards.length}):
      </div>

      <div style="max-height: 220px; overflow-y: auto; margin-bottom: 16px;">
        ${cardsHtml}
      </div>

      <div class="analysis-section">
        <h4 style="font-size: 16px; color: var(--primary); margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
          <i class="fas fa-chart-line"></i> Анализ
        </h4>
        <div style="font-size: 13px; line-height: 1.6; color: var(--text); white-space: pre-line;">
          ${result.analysis || result.summary || ''}
        </div>
      </div>
    </div>
  `;

  openModal(modal);
}

// ===== КОЛОДА С ПАГИНАЦИЕЙ И ФИЛЬТРАМИ =====
let currentDeckPage = 0;
let currentDeckFilter = 'all';
const CARDS_PER_PAGE = 12;

function initDeck() {
  const container = $('#deck-grid');
  if (!container || !window.TAROT_CARDS || !window.TAROT_CARDS.length) return;

  const filterHtml = `
    <div class="deck-filters modern-chips">
      <button class="filter-btn active" data-filter="all">Все</button>
      <button class="filter-btn" data-filter="major">Старшие</button>
      <button class="filter-btn" data-filter="cups">Чаши</button>
      <button class="filter-btn" data-filter="swords">Мечи</button>
      <button class="filter-btn" data-filter="pentacles">Пентакли</button>
      <button class="filter-btn" data-filter="wands">Жезлы</button>
    </div>
  `;

  container.insertAdjacentHTML('beforebegin', filterHtml);
  renderDeckPage();
  initCardClickHandlers();
  initDeckFilters();
}

function renderDeckPage() {
  const container = $('#deck-grid');
  if (!container) return;

  let filteredCards = window.TAROT_CARDS;

  if (currentDeckFilter !== 'all') {
    filteredCards = window.TAROT_CARDS.filter(card => {
      if (currentDeckFilter === 'major') return card.suit === 'major';
      return card.suit === currentDeckFilter;
    });
  }

  const totalPages = Math.ceil(filteredCards.length / CARDS_PER_PAGE);
  if (currentDeckPage >= totalPages && totalPages > 0) {
    currentDeckPage = totalPages - 1;
  }

  const start = currentDeckPage * CARDS_PER_PAGE;
  const end = start + CARDS_PER_PAGE;
  const pageCards = filteredCards.slice(start, end);

  container.innerHTML = pageCards
    .map(
      (card, index) => `
      <div class="deck-card" data-id="${card.id}" style="--card-index: ${index};">
        <div class="deck-card-inner">
          <img src="${card.image}"
               alt="${card.name}"
               class="deck-card-image"
               onload="this.classList.add('loaded')"
               onerror="handleCardImgError(this)">
          <div class="deck-card-overlay">
            <div class="overlay-content">
              <div class="card-category-small">${card.category}</div>
              <div class="card-keyword-small">${card.keyword || ''}</div>
            </div>
          </div>
        </div>
        <div class="deck-card-info">
          <div class="deck-card-name">${card.name}</div>
          <div class="deck-card-roman">${card.roman || ''}</div>
        </div>
      </div>
    `
    )
    .join('');

  renderDeckPagination(filteredCards.length);
  initCardClickHandlers();
}

function initDeckFilters() {
  const filterBtns = $$('.filter-btn');
  if (!filterBtns.length) return;

  filterBtns.forEach(btn => {
    btn.addEventListener('click', function () {
      filterBtns.forEach(b => b.classList.remove('active'));
      this.classList.add('active');

      currentDeckFilter = this.dataset.filter;
      currentDeckPage = 0;
      renderDeckPage();
    });
  });
}

function renderDeckPagination(totalCards) {
  const totalPages = Math.ceil(totalCards / CARDS_PER_PAGE);
  let pagination = $('.deck-pagination');

  if (!pagination) {
    pagination = document.createElement('div');
    pagination.className = 'deck-pagination';
    const container = $('#deck-grid');
    container.parentNode.insertBefore(pagination, container.nextSibling);
  }

  if (totalPages <= 1) {
    pagination.innerHTML = `
      <div class="pagination-info">Всего карт: ${totalCards}</div>
    `;
    return;
  }

  pagination.innerHTML = `
    <button class="pagination-btn ${currentDeckPage === 0 ? 'disabled' : ''}" 
            onclick="changeDeckPage(${currentDeckPage - 1})">
      <i class="fas fa-chevron-left"></i>
    </button>
    <div class="pagination-info">
      Страница ${currentDeckPage + 1} из ${totalPages}<br>
      <small>Всего карт: ${totalCards}</small>
    </div>
    <button class="pagination-btn ${currentDeckPage === totalPages - 1 ? 'disabled' : ''}" 
            onclick="changeDeckPage(${currentDeckPage + 1})">
      <i class="fas fa-chevron-right"></i>
    </button>
  `;
}

window.changeDeckPage = function (page) {
  let filteredCards = window.TAROT_CARDS;
  if (currentDeckFilter !== 'all') {
    filteredCards = window.TAROT_CARDS.filter(card => {
      if (currentDeckFilter === 'major') return card.suit === 'major';
      return card.suit === currentDeckFilter;
    });
  }

  const totalPages = Math.ceil(filteredCards.length / CARDS_PER_PAGE);
  if (page >= 0 && page < totalPages) {
    currentDeckPage = page;
    renderDeckPage();
  }
};

function initCardClickHandlers() {
  $$('.deck-card').forEach((cardEl) => {
    cardEl.addEventListener('click', function () {
      const cardId = parseInt(this.getAttribute('data-id'), 10);
      const cardData = window.TAROT_CARDS.find((c) => c.id === cardId);
      if (cardData) showCardModal(cardData, { mode: 'deck' });
    });
  });
}

// ===== УНИВЕРСАЛЬНОЕ ОТКРЫТИЕ МОДАЛКИ =====
function openModal(modal) {
  activateModal(modal);

  const closeBtn = modal.querySelector('.modal-close');
  if (closeBtn) {
    closeBtn.onclick = () => closeModal(modal);
  }

  modal.onclick = (e) => {
    if (e.target === modal) closeModal(modal);
  };
}

// ===== КНОПКИ =====
function initButtons() {
  const openShopBtn = $('#open-shop-btn');
  if (openShopBtn) {
    openShopBtn.addEventListener('click', () => {
      openShopModal();
    });
  }

  const refreshBtn = $('#refresh-btn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', async () => {
      if (AppState.isLoading) return;
      AppState.isLoading = true;
      refreshBtn.classList.add('refreshing');

      await loadCardOfDay();
      showToast('Карта дня обновлена', 'success');

      setTimeout(() => {
        refreshBtn.classList.remove('refreshing');
        AppState.isLoading = false;
      }, 1000);
    });
  }

  const questionBtn = $('#question-btn');
  if (questionBtn) {
    questionBtn.addEventListener('click', () => openQuestionModal());
  }

  $$('.question-type').forEach((typeEl) => {
    typeEl.addEventListener('click', function () {
      $$('.question-type').forEach((t) => t.classList.remove('active'));
      this.classList.add('active');
      AppState.questionType = this.getAttribute('data-type');
    });
  });

  const askBtn = $('#ask-question-btn');
  if (askBtn) {
    askBtn.addEventListener('click', askQuestion);
  }

  const questionInput = $('#question-input');
  const charCount = $('#char-count');
  if (questionInput && charCount) {
    questionInput.addEventListener('input', function () {
      charCount.textContent = this.value.length;
    });
  }

  const yesNoBtn = $('#yes-no-btn');
  if (yesNoBtn) {
    yesNoBtn.addEventListener('click', () => openYesNoModal());
  }

  const yesnoInput = $('#yesno-input');
  const yesnoChar = $('#yesno-char-count');
  if (yesnoInput && yesnoChar) {
    yesnoInput.addEventListener('input', function () {
      yesnoChar.textContent = this.value.length;
    });
  }
}

// ===== МОДАЛКА МАГАЗИНА =====
function openShopModal() {
  const modal = $('#shop-modal');
  if (!modal) return;

  activateModal(modal);

  const closeBtn = modal.querySelector('.modal-close');
  if (closeBtn) {
    closeBtn.onclick = () => closeModal(modal);
  }

  modal.onclick = (e) => {
    if (e.target === modal) closeModal(modal);
  };

  $$('.shop-pack').forEach((card) => {
    card.addEventListener('click', async function () {
      const amount = Number(this.dataset.stars) || 0;
      if (!amount) return;

      const ok = await openConfirmModal({
        title: 'Покупка звёзд',
        message: `Начислить ${amount} внутриигровых звёзд?`,
        okText: 'Начислить',
        cancelText: 'Отмена'
      });
      if (!ok) return;

      AppState.userStars += amount;
      updateStarsDisplay();
      await saveUserStateToServer();
      showToast(`Начислено ${amount} звёзд`, 'success');

      closeModal(modal);
    });
  });
}

// ===== СПРОСИТЬ ВСЕЛЕННУЮ / ДА-НЕТ =====
function openQuestionModal() {
  const modal = $('#question-modal');
  if (!modal) return;

  activateModal(modal);

  const closeBtn = modal.querySelector('.modal-close');
  if (closeBtn) {
    closeBtn.onclick = () => closeModal(modal);
  }

  modal.onclick = (e) => {
    if (e.target === modal) closeModal(modal);
  };
}

async function openYesNoModal() {
  const modal = $('#yesno-modal');
  if (!modal) return;

  const input = $('#yesno-input');
  const counter = $('#yesno-char-count');
  if (input) input.value = '';
  if (counter) counter.textContent = '0';

  activateModal(modal);

  const closeBtn = modal.querySelector('.modal-close');
  if (closeBtn) {
    closeBtn.onclick = () => closeModal(modal);
  }

  modal.onclick = (e) => {
    if (e.target === modal) closeModal(modal);
  };

  const submitBtn = $('#yesno-submit-btn');
  if (!submitBtn) return;

  submitBtn.onclick = async () => {
    const question = (input && input.value.trim()) || '';
    if (question.length < 3) {
      showToast('Вопрос должен быть осмысленным', 'error');
      return;
    }

    if (AppState.userStars < YES_NO_PRICE) {
      showToast('Недостаточно звёзд. Нужно ' + YES_NO_PRICE + ' ★', 'error');
      return;
    }

    AppState.userStars -= YES_NO_PRICE;
    updateStarsDisplay();

    const answers = [
      'Однозначно да.',
      'Скорее да, чем нет.',
      'Скорее нет, чем да.',
      'Однозначно нет.',
      'Ответ не ясен, ситуация ещё формируется.'
    ];
    const randomAnswer = answers[Math.floor(Math.random() * answers.length)];

    const entry = {
      type: 'yesno',
      createdAt: new Date().toISOString(),
      title: 'Да / Нет',
      question,
      answer: randomAnswer
    };
    AppState.archive = [entry, ...(AppState.archive || [])];

    await saveUserStateToServer();
    renderArchive();

    closeModal(modal);
    showAnswerModal(question, randomAnswer);
  };
}

async function askQuestion() {
  const input = $('#question-input');
  if (!input) return;

  const question = input.value.trim();
  if (!question) {
    showToast('Введите ваш вопрос', 'error');
    return;
  }
  if (question.length < 5) {
    showToast('Вопрос должен быть не менее 5 символов', 'error');
    return;
  }

  const price = ASK_UNIVERSE_PRICE;
  if (AppState.userStars < price) {
    showToast('Недостаточно звёзд. Нужно ' + price + ' ★', 'error');
    return;
  }

  AppState.userStars -= price;
  updateStarsDisplay();
  await saveUserStateToServer();

  const qm = $('#question-modal');
  if (qm) closeModal(qm);

  showToast('🌀 Вселенная слышит ваш вопрос...', 'info');

  setTimeout(async () => {
    const answers = {
      love: [
        'Ваши отношения проходят важный этап честности и откровенности.',
        'Сейчас главное — не торопить события и дать чувствам раскрыться.',
        'Истинные чувства проявятся через поступки, а не слова.',
        'Связь между вами не случайна, но её исход зависит от взаимных шагов.'
      ],
      career: [
        'Новый шанс в работе появится, если вы позволите себе выйти за рамки привычного.',
        'Ваши навыки недооценены — но это ненадолго.',
        'Сейчас период подготовки, а не рывка. Используйте его для обучения.',
        'Решающий поворот в карьере связан с человеком, с которым вы уже знакомы.'
      ],
      future: [
        'Будущее пластично, и сейчас вы закладываете важный фундамент.',
        'Некоторые события ускорятся, если вы решитесь на перемены внутри себя.',
        'Ожидается мягкий, постепенный поворот в нужную сторону.',
        'То, чего вы боитесь, может оказаться опорой, а не угрозой.'
      ],
      decision: [
        'Ваше тело уже знает ответ — прислушайтесь к ощущениям.',
        'Если выбор даётся слишком тяжело, возможно, оба варианта требуют доработки.',
        'Правильное решение — то, после которого вы чувствуете не страх, а облегчение.',
        'Ситуация сама покажет приоритет, если вы позволите ей развиваться без давления.'
      ]
    };

    const typeAnswers = answers[AppState.questionType] || answers.love;
    const randomAnswer =
      typeAnswers[Math.floor(Math.random() * typeAnswers.length)];

    const entry = {
      type: 'universe',
      createdAt: new Date().toISOString(),
      title: 'Спросить Вселенную',
      question,
      category: AppState.questionType,
      answer: randomAnswer
    };
    AppState.archive = [entry, ...(AppState.archive || [])];
    await saveUserStateToServer();
    renderArchive();

    showAnswerModal(question, randomAnswer);

    input.value = '';
    const cc = $('#char-count');
    if (cc) cc.textContent = '0';
  }, 2000);
}

function showAnswerModal(question, answer) {
  const modal = $('#card-modal');
  const body = $('#card-modal-body');
  if (!modal || !body) return;

  body.innerHTML = `
    <div style="text-align: center; padding: 20px;">
      <div class="modal-icon" style="margin: 0 auto 20px;">
        <i class="fas fa-stars"></i>
      </div>
      <h3 style="font-size: 20px; color: var(--primary); margin-bottom: 16px;">Ответ</h3>

      <div style="background: rgba(138, 43, 226, 0.1); padding: 16px; border-radius: 12px; margin-bottom: 20px;">
        <div style="font-size: 12px; color: var(--text-light); margin-bottom: 8px;">Ваш вопрос:</div>
        <div style="font-style: italic; color: var(--text);">"${question}"</div>
      </div>

      <div style="font-size: 18px; color: var(--primary); font-weight: 600; margin-bottom: 16px;">
        ${answer}
      </div>

      <div style="font-size: 14px; color: var(--text-light);">
        <i class="fas fa-lightbulb"></i> Совет: зафиксируйте это сообщение и возвращайтесь к нему в течение недели.
      </div>
    </div>
  `;

  openModal(modal);
}

// ===== АРХИВ (иконки убраны у всех) =====
function renderArchive() {
  const list = $('#archive-list');
  if (!list) return;

  if (!AppState.archive || !AppState.archive.length) {
    list.innerHTML =
      '<p style="font-size:14px; color:var(--text-light);">Архив пока пуст. Здесь будут появляться ваши расклады, результаты колеса и ответы.</p>';
    return;
  }

  list.innerHTML = AppState.archive
    .map((entry, index) => {
      const date = new Date(entry.createdAt || Date.now());
      const dateStr = date.toLocaleDateString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
      const timeStr = date.toLocaleTimeString('ru-RU', {
        hour: '2-digit',
        minute: '2-digit'
      });

      let subtitle = '';
      if (entry.type === 'spread') {
        subtitle = `${(entry.cards || []).length} карт • Расклад`;
      } else if (entry.type === 'wheel') {
        subtitle = `Колесо фортуны • ${entry.card ? entry.card.name : ''}`;
      } else if (entry.type === 'yesno') {
        subtitle = 'Да / Нет';
      } else if (entry.type === 'universe') {
        subtitle = 'Спросить Вселенную';
      }

      const title = entry.title || 'Запись архива';

      return `
        <div class="spread-item archive-item" data-index="${index}">
          <div class="spread-header">
            <div class="spread-title">${title}</div>
            <div class="spread-price" style="font-size:14px; background: transparent; box-shadow:none; padding:0;">
              ${dateStr}
            </div>
          </div>
          <div class="spread-description" style="font-size:13px;">
            ${subtitle}
          </div>
          <div class="archive-date">
            <i class="far fa-clock"></i>
            ${timeStr}
          </div>
        </div>
      `;
    })
    .join('');

  $$('#archive-list .archive-item').forEach((item) => {
    item.addEventListener('click', () => {
      const index = Number(item.dataset.index);
      const entry = AppState.archive[index];
      if (!entry) return;

      if (entry.type === 'spread') {
        showSpreadResultModal(entry);
      } else {
        showArchiveEntryModal(entry);
      }
    });
  });
}

function showArchiveEntryModal(entry) {
  const modal = $('#card-modal');
  const body = $('#card-modal-body');
  if (!modal || !body) return;

  const date = new Date(entry.createdAt || Date.now());
  const dateStr = date.toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });
  const timeStr = date.toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit'
  });

  if (entry.type === 'wheel' && entry.card) {
    const card = entry.card;
    body.innerHTML = `
      <div style="text-align:center;">
        <h3 style="font-size:20px; color:var(--primary); margin-bottom:6px;">Колесо фортуны</h3>
        <div style="font-size:12px; color:var(--text-light); margin-bottom:12px;">
          <i class="fas fa-calendar-alt"></i> ${dateStr} <i class="far fa-clock" style="margin-left:10px;"></i> ${timeStr}
        </div>
        <img src="${card.image}"
             alt="${card.name}"
             style="width:200px;height:300px;object-fit:cover;border-radius:12px;margin-bottom:16px;"
             onerror="handleCardImgError(this)">
        <div style="font-size:18px; font-weight:600; color:var(--primary); margin-bottom:6px;">
          ${card.name}${card.roman ? ` (${card.roman})` : ''}
        </div>
        <div style="font-size:14px; color:var(--secondary); margin-bottom:8px;">
          ${card.keyword || ''}
        </div>
        <div style="font-size:13px; color:var(--text); margin-bottom:8px;">
          ${truncateText(card.description || '', 240)}
        </div>
      </div>
    `;
    openModal(modal);
    return;
  }

  if (entry.type === 'yesno' || entry.type === 'universe') {
    body.innerHTML = `
      <div style="text-align:center; padding:20px;">
        <h3 style="font-size:20px; color:var(--primary); margin-bottom:6px;">${
          entry.type === 'yesno' ? 'Да / Нет' : 'Спросить Вселенную'
        }</h3>
        <div style="font-size:12px; color:var(--text-light); margin-bottom:12px;">
          <i class="fas fa-calendar-alt"></i> ${dateStr} <i class="far fa-clock" style="margin-left:10px;"></i> ${timeStr}
        </div>

        <div style="background: rgba(138, 43, 226, 0.1); padding: 16px; border-radius: 12px; margin-bottom: 20px;">
          <div style="font-size: 12px; color: var(--text-light); margin-bottom: 8px;">Ваш вопрос:</div>
          <div style="font-style: italic; color: var(--text);">"${entry.question || ''}"</div>
        </div>

        <div style="font-size: 18px; color: var(--primary); font-weight: 600; margin-bottom: 16px;">
          ${entry.answer || ''}
        </div>
      </div>
    `;
    openModal(modal);
    return;
  }

  body.innerHTML = `
    <div style="padding:20px;">
      <h3 style="font-size:20px; color:var(--primary); margin-bottom:6px;">${entry.title || 'Запись архива'}</h3>
      <div style="font-size:12px; color:var(--text-light); margin-bottom:12px;">
        <i class="fas fa-calendar-alt"></i> ${dateStr} <i class="far fa-clock" style="margin-left:10px;"></i> ${timeStr}
      </div>
      <pre style="font-size:12px; white-space:pre-wrap; color:var(--text);">${
        JSON.stringify(entry, null, 2)
      }</pre>
    </div>
  `;
  openModal(modal);
}

// ===== МОДАЛКА-ПОДТВЕРЖДЕНИЕ =====
function openConfirmModal({ title, message, okText = 'ОК', cancelText = 'Отмена' }) {
  const modal = $('#confirm-modal');
  const titleEl = $('#confirm-title');
  const msgEl = $('#confirm-message');
  const okBtn = $('#confirm-ok-btn');
  const cancelBtn = $('#confirm-cancel-btn');
  const closeBtn = modal ? modal.querySelector('.modal-close') : null;

  if (!modal || !titleEl || !msgEl || !okBtn || !cancelBtn) {
    const ok = window.confirm(message);
    return Promise.resolve(ok);
  }

  titleEl.textContent = title || 'Подтверждение';
  msgEl.textContent = message || '';

  activateModal(modal);

  return new Promise((resolve) => {
    const cleanup = () => {
      closeModal(modal);
      okBtn.onclick = null;
      cancelBtn.onclick = null;
      if (closeBtn) closeBtn.onclick = null;
      modal.onclick = null;
    };

    okBtn.textContent = okText;
    cancelBtn.textContent = cancelText;

    okBtn.onclick = () => {
      cleanup();
      resolve(true);
    };

    cancelBtn.onclick = () => {
      cleanup();
      resolve(false);
    };

    if (closeBtn) {
      closeBtn.onclick = () => {
        cleanup();
        resolve(false);
      };
    }

    modal.onclick = (e) => {
      if (e.target === modal) {
        cleanup();
        resolve(false);
      }
    };
  });
}

// ===== НАВИГАЦИЯ =====
function initNavigation() {
  $$('.nav-btn').forEach((btn) => {
    btn.addEventListener('click', function () {
      const screen = this.getAttribute('data-screen');

      $$('.nav-btn').forEach((b) => b.classList.remove('active'));
      $$('.screen').forEach((s) => s.classList.remove('active'));

      this.classList.add('active');
      const target = document.querySelector('#' + screen + '-screen');
      if (target) target.classList.add('active');
    });
  });
}

// ===== БАЛАНС =====
function updateStarsDisplay() {
  const amountEl = $('#stars-amount');
  if (amountEl) {
    amountEl.textContent = AppState.userStars;
  }
}

// ===== ДОП. СТИЛИ АНИМАЦИЙ =====
function addAnimationStyles() {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes floatParticle {
      0% { transform: translateY(0) translateX(0); opacity: 0; }
      10% { opacity: 0.1; }
      90% { opacity: 0.1; }
      100% { transform: translateY(-100vh) translateX(20px); opacity: 0; }
    }
    @keyframes ripple {
      to { transform: scale(4); opacity: 0; }
    }
    @keyframes refreshSpin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
    .refreshing {
      animation: refreshSpin 1s linear infinite;
    }
  `;
  document.head.appendChild(style);
}

// ===== ТОСТ =====
function showToast(message, type) {
  if (!type) type = 'info';
  const toast = $('#toast');
  if (!toast) return;

  toast.style.background =
    type === 'error'
      ? 'var(--danger)'
      : type === 'success'
      ? 'var(--success)'
      : 'var(--primary)';

  toast.textContent = message;
  toast.classList.add('show');

  setTimeout(() => toast.classList.remove('show'), 3000);
}

// ===== ЗАПУСК =====
document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 TARO запускается...');
  initApp();
});
