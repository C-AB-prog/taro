// ===== ОСНОВНОЙ ФУНКЦИОНАЛ =====

// Утилиты
const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));

// Состояние приложения
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
  wheelTimerId: null
};

// ===== МЕТА-ИНФО ДЛЯ КАРТ (для общего вывода расклада) =====
const CARD_META = {
  0: { // Шут
    score: 1,
    tags: ['change', 'inner'],
    vibe: 'новый цикл, спонтанность и желание попробовать'
  },
  1: { // Маг
    score: 2,
    tags: ['career', 'inner'],
    vibe: 'сильная воля, умение влиять на события и создавать результат'
  },
  2: { // Верховная Жрица
    score: 1,
    tags: ['inner', 'relationships'],
    vibe: 'интуиция, скрытые мотивы и внутреннее знание'
  },
  3: { // Императрица
    score: 2,
    tags: ['relationships', 'material'],
    vibe: 'изобилие, притяжение, забота и созидание'
  },
  4: { // Император
    score: 1,
    tags: ['career', 'material'],
    vibe: 'структура, ответственность и контроль над ситуацией'
  },
  5: { // Иерофант
    score: 1,
    tags: ['inner', 'relationships'],
    vibe: 'традиции, обучение и опора на проверенные подходы'
  },
  6: { // Влюблённые
    score: 2,
    tags: ['relationships'],
    vibe: 'выбор сердцем, партнёрство и важные решения в отношениях'
  },
  7: { // Колесница
    score: 2,
    tags: ['career', 'change'],
    vibe: 'движение вперёд, победа и контроль над направлением'
  },
  8: { // Сила
    score: 2,
    tags: ['inner', 'relationships'],
    vibe: 'внутренняя устойчивость, мягкая сила и терпение'
  },
  9: { // Отшельник
    score: 0,
    tags: ['inner'],
    vibe: 'самоанализ, пауза и поиск собственных ответов'
  },
  10: { // Колесо Фортуны
    score: 2,
    tags: ['change', 'fate'],
    vibe: 'смена этапа, судьбоносные события и обновление цикла'
  },
  11: { // Справедливость
    score: 0,
    tags: ['karma', 'material'],
    vibe: 'равновесие, честность и необходимость принимать последствия'
  }
};

// Расклады
const TAROT_SPREADS = [
  {
    id: 'celtic-cross',
    title: 'Кельтский крест',
    description: 'Глубокий анализ ситуации: прошлое, настоящее, будущее и скрытые влияния.',
    cardsCount: 10,
    price: 120
  },
  {
    id: 'love-daisy',
    title: 'Ромашка любви',
    description: 'Подходит для понимания чувств партнёра и динамики отношений.',
    cardsCount: 6,
    price: 80
  },
  {
    id: 'love-triangle',
    title: 'Любовный треугольник',
    description: 'Сравнение двух вариантов развития отношений и возможных исходов.',
    cardsCount: 9,
    price: 100
  },
  {
    id: 'time-frames',
    title: 'Временные рамки',
    description: 'Показывает, как будут развиваться события во времени: месяц, 3 месяца, полгода, год.',
    cardsCount: 4,
    price: 70
  },
  {
    id: 'four-elements',
    title: 'Четыре элемента',
    description: 'Материя, эмоции, страсть и разум — четыре стороны ваших отношений.',
    cardsCount: 4,
    price: 70
  },
  {
    id: 'fate-pendulum',
    title: 'Маятник судьбы',
    description: 'Показывает направление развития ситуации и ключевые события на пути.',
    cardsCount: 5,
    price: 75
  },
  {
    id: 'karma-rel',
    title: 'Карма отношений',
    description: 'Кармические уроки, задачи и потенциал развития связи.',
    cardsCount: 7,
    price: 90
  }
];

const ASK_UNIVERSE_PRICE = 35;
const YES_NO_PRICE = 25;
const NEW_USER_STARS = 150;
const WHEEL_COOLDOWN_HOURS = 24;

// ===== АНИМАЦИИ =====
class MysticAnimations {
  constructor() {
    this.initParticles();
    this.initCardAnimations();
    this.initButtonEffects();
  }

  // Частицы в фоне
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

  // Анимации карт
  initCardAnimations() {
    // Анимация при наведении на карту
    document.addEventListener('mouseover', (e) => {
      const card = e.target.closest('.card-image-container, .deck-card');
      if (card) {
        card.style.transform = 'translateY(-10px)';
        card.style.boxShadow = '0 20px 40px rgba(138, 43, 226, 0.3)';
      }
    });

    document.addEventListener('mouseout', (e) => {
      const card = e.target.closest('.card-image-container, .deck-card');
      if (card) {
        card.style.transform = 'translateY(0)';
        card.style.boxShadow = '';
      }
    });
  }

  // Эффекты кнопок
  initButtonEffects() {
    const buttons = $$('.refresh-btn, .spin-btn, .ask-btn, .action-card');
    
    buttons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.createRippleEffect(e);
      });
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
    const id = typeof entry.cardId === 'number'
      ? entry.cardId
      : typeof entry.id === 'number'
        ? entry.id
        : null;

    const meta = id != null ? CARD_META[id] : null;
    if (!meta) return;

    totalScore += meta.score;
    meta.tags.forEach(tag => {
      tagCounter[tag] = (tagCounter[tag] || 0) + 1;
    });
    vibes.push(meta.vibe);
  });

  const avg = totalScore / cards.length;

  let tone;
  if (avg >= 1) {
    tone = 'в целом расклад выглядит поддерживающим и ресурсным';
  } else if (avg <= -0.5) {
    tone = 'в целом расклад указывает на напряжённый этап и необходимость аккуратности';
  } else {
    tone = 'в целом расклад сбалансированный, без ярко выраженного плюса или минуса';
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
      themeText = 'В раскладе заметен кармический оттенок: важные уроки и судьбоносные события.';
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

// ===== РАБОТА С БЭКОМ (Neon через /api/state) =====
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
    const res = await fetch(`/api/state?userId=${encodeURIComponent(String(userId))}`);
    if (res.status === 404) {
      AppState.userStars = NEW_USER_STARS;
      AppState.archive = [];
      AppState.lastWheelSpin = null;
      AppState.lastWheelText = '';
      AppState.stateLoaded = true;
      return;
    }

    if (!res.ok) {
      throw new Error('Failed to load state');
    }

    const data = await res.json();

    AppState.userStars = typeof data.stars === 'number' ? data.stars : NEW_USER_STARS;
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

// ===== ОСНОВНЫЕ ФУНКЦИИ =====

// Инициализация
async function initApp() {
  showLoader();
  
  try {
    // Инициализация Telegram
    initTelegram();

    // Скрываем/перенастраиваем "Дмитрий онлайн"
    cleanupHeaderStatus();

    // Запуск анимаций
    window.mysticAnimations = new MysticAnimations();
    
    // Загрузка состояния пользователя из БД
    await loadUserStateFromServer();
    updateStarsDisplay();
    
    // Загрузка карты дня
    await loadCardOfDay();
    
    // Инициализация колеса фортуны
    initFortuneWheel();
    
    // Инициализация раскладов
    initSpreads();
    
    // Инициализация колоды
    initDeck();
    
    // Инициализация кнопок
    initButtons();
    
    // Инициализация навигации
    initNavigation();
    
    // Добавляем CSS для анимаций
    addAnimationStyles();
    
  } catch (error) {
    console.error('Ошибка инициализации:', error);
    showToast('Ошибка загрузки приложения', 'error');
  } finally {
    hideLoader();
  }
}

// Инициализация Telegram
function initTelegram() {
  if (window.Telegram?.WebApp) {
    const tg = window.Telegram.WebApp;
    tg.ready();
    tg.expand();
    
    const user = tg.initDataUnsafe?.user;
    if (user) {
      AppState.user = {
        name: user.first_name || 'Пользователь',
        username: user.username || '',
      };
      AppState.userId = user.id; // важно для синхронизации
    }
  }
  
  // Для дебага вне Telegram
  if (!AppState.userId) {
    AppState.user = { name: 'Гость', username: 'debug_user' };
    AppState.userId = 'debug-user-1';
  }
}

// Перенастройка хедера (убираем "Дмитрий онлайн" и показываем баланс)
function cleanupHeaderStatus() {
  const statusText = document.querySelector('.status-text');
  const statusDot = document.querySelector('.status-dot');
  if (statusDot) {
    statusDot.classList.remove('online');
  }
  if (statusText) {
    statusText.textContent = 'Баланс: ...';
  }
}

// Загрузка карты дня
async function loadCardOfDay() {
  const container = $('#card-day-content');
  if (!container || !window.TAROT_CARDS?.length) return;
  
  const today = new Date();
  const day = today.getDate();
  const cardIndex = day % Math.min(window.TAROT_CARDS.length, 12);
  const card = window.TAROT_CARDS[cardIndex];
  
  if (!card) return;
  
  AppState.currentCard = card;
  
  container.innerHTML = `
    <div class="card-display">
      <div class="card-image-container">
        <img src="${card.image}" 
             alt="${card.name}" 
             class="card-image"
             onload="this.classList.add('loaded')"
             onerror="this.src='cards/card-back.png'">
      </div>
      <div class="card-info">
        <div class="card-name-row">
          <div class="card-name">${card.name}</div>
          ${card.roman ? `<div class="card-roman">${card.roman}</div>` : ''}
        </div>
        <div class="card-keyword">${card.keyword || ''}</div>
        <div class="card-description">${card.description || 'Описание карты'}</div>
        <div class="card-date">
          <i class="fas fa-calendar-alt"></i>
          ${today.toLocaleDateString('ru-RU', { 
            weekday: 'long', 
            day: 'numeric', 
            month: 'long' 
          })}
        </div>
      </div>
    </div>
  `;
}

// Колесо фортуны (бесплатно раз в сутки, выдаёт карту + совет)
function initFortuneWheel() {
  const wheel = $('#fortune-wheel');
  const spinBtn = $('#spin-wheel-btn');
  const resultEl = $('#wheel-result');
  
  if (!wheel || !spinBtn || !resultEl) return;
  
  // Создаём визуальные секции (чисто для анимации)
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
    if (!AppState.lastWheelSpin) return '';
    const now = Date.now();
    const next = AppState.lastWheelSpin.getTime() + WHEEL_COOLDOWN_HOURS * 60 * 60 * 1000;
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
      spinBtn.innerHTML = '<i class="fas fa-play"></i><span>Крутить колесо</span><div class="spin-glow"></div>';
      resultEl.innerHTML = AppState.lastWheelText
        ? AppState.lastWheelText
        : 'Колесо готово к вращению. В день доступна одна попытка.';
    } else {
      spinBtn.disabled = true;
      const timerText = formatRemaining();
      const baseText = AppState.lastWheelText || 'Вы уже крутили колесо сегодня.';
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

  // Стартуем таймер обратного отсчёта
  if (AppState.wheelTimerId) {
    clearInterval(AppState.wheelTimerId);
  }
  AppState.wheelTimerId = setInterval(updateWheelUI, 1000);
  updateWheelUI();

  spinBtn.addEventListener('click', async () => {
    if (!canSpinNow()) {
      showToast('Колесо будет доступно чуть позже', 'info');
      return;
    }
    if (wheel.classList.contains('spinning')) return;

    // Запускаем анимацию
    wheel.classList.add('spinning');
    spinBtn.disabled = true;
    spinBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i><span>Крутится...</span>';

    const spins = 5 + Math.floor(Math.random() * 4);
    const extraDegrees = Math.floor(Math.random() * 360);
    const totalRotation = spins * 360 + extraDegrees;

    wheel.style.transition = 'transform 3s cubic-bezier(0.2, 0.8, 0.3, 1)';
    wheel.style.transform = `rotate(${totalRotation}deg)`;

    setTimeout(async () => {
      wheel.classList.remove('spinning');

      // Выбираем случайную карту из колоды
      const allCards = window.TAROT_CARDS || [];
      if (!allCards.length) {
        resultEl.textContent = 'Колода не найдена.';
        spinBtn.disabled = false;
        return;
      }
      const idx = Math.floor(Math.random() * Math.min(allCards.length, 12));
      const card = allCards[idx];

      const now = new Date();
      AppState.lastWheelSpin = now;

      const wheelTextHtml = `
        <div style="text-align:center;">
          <div style="font-size:16px; margin-bottom:6px;">Выпала карта:</div>
          <div style="font-size:20px; font-weight:700; color:var(--primary); margin-bottom:4px;">
            ${card.name}${card.roman ? ` (${card.roman})` : ''}
          </div>
          <div style="font-size:14px; color:var(--secondary); margin-bottom:8px;">
            ${card.keyword || ''}
          </div>
          <div style="font-size:13px; color:var(--text); margin-bottom:8px;">
            ${card.description || ''}
          </div>
          <div style="font-size:13px; color:var(--text-light); font-style:italic;">
            Совет: ${card.advice || 'Доверьтесь процессу и наблюдайте за знаками.'}
          </div>
        </div>
      `;

      AppState.lastWheelText = wheelTextHtml;

      // Сохраняем в архив
      const entry = {
        type: 'wheel',
        createdAt: now.toISOString(),
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

      updateWheelUI();
      showToast('Результат колеса сохранён в архив', 'success');
    }, 3000);
  });
}

// Инициализация раскладов
function initSpreads() {
  const container = $('#spreads-grid');
  if (!container) return;

  container.innerHTML = TAROT_SPREADS.map(spread => `
    <div class="spread-item" data-id="${spread.id}">
      <div class="spread-header">
        <div class="spread-title">
          <i class="fas fa-heart-circle-bolt" style="margin-right:6px;"></i>
          ${spread.title}
        </div>
        <div class="spread-price">★ ${spread.price}</div>
      </div>
      <div class="spread-description">${spread.description}</div>
      <div class="spread-meta">
        <span><i class="fas fa-cards"></i> ${spread.cardsCount} карт</span>
        <span><i class="fas fa-brain"></i> Общий анализ расклада включён</span>
      </div>
    </div>
  `).join('');

  $$('.spread-item').forEach(item => {
    item.addEventListener('click', async function() {
      const spreadId = this.dataset.id;
      const spread = TAROT_SPREADS.find(s => s.id === spreadId);
      if (!spread) return;

      const price = spread.price;
      const title = spread.title;

      if (AppState.userStars < price) {
        showToast(`Недостаточно звёзд. Нужно ${price} ★`, 'error');
        return;
      }

      if (!confirm(`Купить расклад "${title}" за ${price} ★?`)) {
        return;
      }

      AppState.userStars -= price;
      updateStarsDisplay();

      // Делаем расклад
      const result = performSpread(spread);

      // Сохраняем в архив (новые сверху)
      AppState.archive = [result, ...(AppState.archive || [])];

      await saveUserStateToServer();

      showSpreadResultModal(result);
      showToast(`Расклад "${title}" добавлен в архив`, 'success');
    });
  });
}

// Генерация расклада
function performSpread(spread) {
  const allCards = window.TAROT_CARDS || [];
  const cardsCopy = [...allCards];
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
      image: card.image
    });
  }

  const summary = buildSpreadSummary(spread, used);

  return {
    type: 'spread',
    spreadId: spread.id,
    title: spread.title,
    createdAt: new Date().toISOString(),
    cards: used,
    summary
  };
}

// Показ результата расклада в модалке
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

  const cardsHtml = (result.cards || []).map((card, index) => `
    <div style="
      border-radius: 14px;
      border: 1px solid var(--border);
      padding: 10px 12px;
      margin-bottom: 10px;
      display: flex;
      gap: 10px;
      align-items: flex-start;
      background: rgba(248,245,255,0.9);
    ">
      <div style="font-size:13px; color:var(--text-light); min-width:20px;">${index + 1}.</div>
      <div style="flex:1;">
        <div style="font-weight:600; color:var(--primary); margin-bottom:2px;">
          ${card.name}${card.roman ? ` (${card.roman})` : ''}
        </div>
        <div style="font-size:12px; color:var(--secondary); margin-bottom:4px;">${card.keyword || ''}</div>
        <div style="font-size:12px; color:var(--text); margin-bottom:4px;">${card.description || ''}</div>
        <div style="font-size:11px; color:var(--text-light); font-style:italic;">Совет: ${card.advice || ''}</div>
      </div>
    </div>
  `).join('');

  body.innerHTML = `
    <div style="text-align:left;">
      <h3 style="font-size:20px; color:var(--primary); margin-bottom:8px;">${result.title}</h3>
      <div style="font-size:12px; color:var(--text-light); margin-bottom:8px;">
        ${dateStr}
      </div>

      ${result.summary ? `
        <div style="
          background:rgba(138,43,226,0.06);
          border-radius:12px;
          padding:12px 14px;
          font-size:13px;
          color:var(--text);
          margin-bottom:16px;
        ">
          <b>Общий вывод:</b> ${result.summary}
        </div>
      ` : ''}

      ${cardsHtml}
    </div>
  `;

  openModal(modal);
}

// Инициализация колоды
function initDeck() {
  const container = $('#deck-grid');
  if (!container || !window.TAROT_CARDS?.length) return;
  
  const cards = window.TAROT_CARDS.slice(0, 12);
  
  container.innerHTML = cards.map((card, index) => `
    <div class="deck-card" data-id="${card.id}" style="--card-index: ${index};">
      <img src="${card.image}" 
           alt="${card.name}" 
           class="deck-card-image"
           onload="this.classList.add('loaded')"
           onerror="this.src='cards/card-back.png'">
      <div class="deck-card-info">
        <div class="deck-card-name">${card.name}</div>
        <div class="deck-card-roman">${card.roman || ''}</div>
      </div>
    </div>
  `).join('');
  
  $$('.deck-card').forEach(card => {
    card.addEventListener('click', function() {
      const cardId = parseInt(this.dataset.id, 10);
      const cardData = window.TAROT_CARDS.find(c => c.id === cardId);
      if (cardData) {
        showCardModal(cardData);
      }
    });
  });
}

// Показать модальное окно карты
function showCardModal(card) {
  const modal = $('#card-modal');
  const body = $('#card-modal-body');
  
  if (!modal || !body) return;
  
  body.innerHTML = `
    <div style="text-align: center;">
      <img src="${card.image}" 
           alt="${card.name}" 
           style="width: 200px; height: 300px; object-fit: cover; border-radius: 12px; margin-bottom: 20px;"
           onerror="this.src='cards/card-back.png'">
      <h3 style="font-size: 24px; color: var(--primary); margin-bottom: 8px;">${card.name}</h3>
      ${card.roman ? `<div style="color: var(--text-light); font-size: 16px; margin-bottom: 12px;">${card.roman}</div>` : ''}
      <div style="background: var(--primary); color: white; padding: 8px 16px; border-radius: 20px; display: inline-block; margin-bottom: 16px;">
        ${card.keyword || ''}
      </div>
      <p style="color: var(--text); line-height: 1.6; margin-bottom: 20px;">${card.description || ''}</p>
      <div style="font-size: 14px; color: var(--text-light); font-style: italic;">
        Совет: ${card.advice || 'Доверьтесь своей интуиции и наблюдайте за знаками.'}
      </div>
    </div>
  `;
  
  openModal(modal);
}

// Универсальное открытие модалки
function openModal(modal) {
  modal.classList.add('active');
  
  const closeBtn = modal.querySelector('.modal-close');
  if (closeBtn) {
    closeBtn.onclick = () => modal.classList.remove('active');
  }
  
  modal.onclick = (e) => {
    if (e.target === modal) {
      modal.classList.remove('active');
    }
  };
}

// Инициализация кнопок
function initButtons() {
  // Обновление карты дня
  $('#refresh-btn')?.addEventListener('click', async () => {
    if (AppState.isLoading) return;
    
    AppState.isLoading = true;
    const btn = $('#refresh-btn');
    btn.classList.add('refreshing');
    
    await loadCardOfDay();
    showToast('Карта дня обновлена', 'success');
    
    setTimeout(() => {
      btn.classList.remove('refreshing');
      AppState.isLoading = false;
    }, 1000);
  });
  
  // Открытие модалки вопроса "Спросить Вселенную"
  $('#question-btn')?.addEventListener('click', () => {
    openQuestionModal();
  });
  
  // Типы вопросов
  $$('.question-type').forEach(type => {
    type.addEventListener('click', function() {
      $$('.question-type').forEach(t => t.classList.remove('active'));
      this.classList.add('active');
      AppState.questionType = this.dataset.type;
    });
  });
  
  // Отправка вопроса
  $('#ask-question-btn')?.addEventListener('click', askQuestion);
  
  // Счётчик символов
  const questionInput = $('#question-input');
  const charCount = $('#char-count');
  
  if (questionInput && charCount) {
    questionInput.addEventListener('input', function() {
      charCount.textContent = this.value.length;
    });
  }
  
  // Да/Нет — быстрый ответ (используем первую карточку "Расклад дня" как кнопку Да/Нет)
  $('#daily-spread-btn')?.addEventListener('click', handleYesNoQuick);
  
  // Остальные действия пока в разработке — просто тосты
  $('#tarot-reading')?.addEventListener('click', () => {
    showToast('Функция в разработке', 'info');
  });
  
  $('#fortune-telling')?.addEventListener('click', () => {
    showToast('Функция в разработке', 'info');
  });
}

// Открыть модалку вопроса
function openQuestionModal() {
  const modal = $('#question-modal');
  if (!modal) return;
  
  modal.classList.add('active');
  
  const closeBtn = modal.querySelector('.modal-close');
  if (closeBtn) {
    closeBtn.onclick = () => modal.classList.remove('active');
  }
  
  modal.onclick = (e) => {
    if (e.target === modal) {
      modal.classList.remove('active');
    }
  };
}

// Вопрос Да/Нет (быстрый)
async function handleYesNoQuick() {
  const question = prompt('Задайте свой вопрос (Да/Нет):');
  if (!question || question.trim().length < 3) {
    showToast('Вопрос должен быть осмысленным', 'error');
    return;
  }

  if (AppState.userStars < YES_NO_PRICE) {
    showToast(`Недостаточно звёзд. Нужно ${YES_NO_PRICE} ★`, 'error');
    return;
  }

  AppState.userStars -= YES_NO_PRICE;
  updateStarsDisplay();

  const answers = [
    'Однозначно да',
    'Скорее да, чем нет',
    'Скорее нет, чем да',
    'Однозначно нет',
    'Ответ не ясен, ситуация ещё формируется'
  ];
  const randomAnswer = answers[Math.floor(Math.random() * answers.length)];

  // Сохраняем в архив как простой текстовый ответ
  const entry = {
    type: 'yesno',
    createdAt: new Date().toISOString(),
    question: question.trim(),
    answer: randomAnswer
  };
  AppState.archive = [entry, ...(AppState.archive || [])];

  await saveUserStateToServer();

  showAnswerModal(question, randomAnswer);
}

// Задать вопрос "Спросить Вселенную"
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
    showToast(`Недостаточно звёзд. Нужно ${price} ★`, 'error');
    return;
  }
  
  AppState.userStars -= price;
  updateStarsDisplay();
  await saveUserStateToServer();
  
  $('#question-modal').classList.remove('active');
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
    const randomAnswer = typeAnswers[Math.floor(Math.random() * typeAnswers.length)];
    
    // Сохраняем в архив
    const entry = {
      type: 'universe',
      createdAt: new Date().toISOString(),
      question,
      category: AppState.questionType,
      answer: randomAnswer
    };
    AppState.archive = [entry, ...(AppState.archive || [])];
    await saveUserStateToServer();
    
    showAnswerModal(question, randomAnswer);
    
    input.value = '';
    $('#char-count').textContent = '0';
    
  }, 2000);
}

// Показать ответ
function showAnswerModal(question, answer) {
  const modal = $('#card-modal');
  const body = $('#card-modal-body');
  
  if (!modal || !body) return;
  
  body.innerHTML = `
    <div style="text-align: center; padding: 20px;">
      <div class="modal-icon" style="margin: 0 auto 20px;">
        <i class="fas fa-stars"></i>
      </div>
      <h3 style="font-size: 20px; color: var(--primary); margin-bottom: 16px;">Ответ Вселенной</h3>
      
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

// Навигация
function initNavigation() {
  $$('.nav-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const screen = this.dataset.screen;
      
      $$('.nav-btn').forEach(b => b.classList.remove('active'));
      $$('.screen').forEach(s => s.classList.remove('active'));
      
      this.classList.add('active');
      
      const target = document.querySelector(`#${screen}-screen`);
      if (target) {
        target.classList.add('active');
      }
    });
  });
}

// Обновление отображения звёзд
function updateStarsDisplay() {
  const statusText = document.querySelector('.status-text');
  if (statusText) {
    statusText.textContent = `Баланс: ${AppState.userStars} ★`;
  }
}

// Добавление CSS для анимаций
function addAnimationStyles() {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes floatParticle {
      0% {
        transform: translateY(0) translateX(0);
        opacity: 0;
      }
      10% {
        opacity: 0.1;
      }
      90% {
        opacity: 0.1;
      }
      100% {
        transform: translateY(-100vh) translateX(20px);
        opacity: 0;
      }
    }
    
    @keyframes ripple {
      to {
        transform: scale(4);
        opacity: 0;
      }
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

// ===== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ =====

function showLoader() {
  const loader = $('#app-loader');
  if (loader) {
    loader.style.display = 'flex';
  }
}

function hideLoader() {
  const loader = $('#app-loader');
  if (loader) {
    loader.style.opacity = '0';
    setTimeout(() => {
      loader.style.display = 'none';
      loader.style.opacity = '1';
    }, 300);
  }
}

function showToast(message, type = 'info') {
  const toast = $('#toast');
  if (!toast) return;
  
  toast.style.background = type === 'error' ? 'var(--danger)' : 
                          type === 'success' ? 'var(--success)' : 
                          'var(--primary)';
  
  toast.textContent = message;
  toast.classList.add('show');
  
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

// Запуск приложения
document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 TARO запускается...');
  initApp();
});
