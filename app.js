// ===== УТИЛИТЫ =====
const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));

const STORAGE_KEY = 'tarot_app_state';
const API_BASE = '/api'; // сюда потом повесишь Neon / Vercel

// ===== СОСТОЯНИЕ ПРИЛОЖЕНИЯ =====
const AppState = {
  user: null,
  currentCard: null,
  questionType: 'love',
  archive: [],
  wheelLastSpin: null,
  lastWheelText: '',
  lastAnswers: {} // по типам вопросов, чтобы не повторяться
};

let wheelTimerId = null;

// ===== ОТВЕТЫ ДЛЯ "СПРОСИТЬ ВСЕЛЕННУЮ" =====
const ANSWERS_BY_TYPE = {
  love: [
    'Ваши чувства взаимны, но важно говорить честно и открыто.',
    'Связь между вами сильна, но ей не хватает внимания и заботы.',
    'Эта история ещё не раскрыта до конца — не торопитесь с выводами.',
    'Сейчас время полюбить прежде всего себя, а потом уже партнёра.',
    'Отношения имеют потенциал, если вы оба готовы меняться.'
  ],
  career: [
    'Перед вами открываются новые возможности, не бойтесь проявить инициативу.',
    'Стабильность важнее резких движений — действуйте постепенно.',
    'Настало время заявить о себе и своих достижениях.',
    'Инвестиция в обучение сейчас принесёт серьёзные результаты позже.',
    'Стоит пересмотреть окружение на работе — не все искренни.'
  ],
  future: [
    'В ближайшее время ожидаются мягкие, но важные перемены.',
    'Сценарий будущего ещё не зафиксирован — многое зависит от вашего выбора.',
    'Вас ждёт период роста и расширения горизонтов.',
    'После череды испытаний наступит спокойный и тёплый этап.',
    'Одна неожиданная возможность сможет сильно изменить ваш путь.'
  ],
  decision: [
    'Лучший выбор — тот, который оставляет чувство внутреннего спокойствия.',
    'Интуиция уже знает ответ, попробуйте немного замолчать и услышать её.',
    'Соберите ещё немного фактов, и решение проявится само.',
    'Если приходится выбирать из двух зол — возможно, есть третий вариант.',
    'Смелое решение сейчас избавит от долгого сожаления потом.'
  ]
};

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

  initButtonEffects() {
    const buttons = $$('.refresh-btn, .spin-btn, .ask-btn, .action-card');
    buttons.forEach(btn => {
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

// ===== TELEGRAM =====
function initTelegram() {
  if (window.Telegram?.WebApp) {
    const tg = window.Telegram.WebApp;
    tg.ready();
    tg.expand();

    const user = tg.initDataUnsafe?.user;
    if (user) {
      AppState.user = {
        id: user.id,
        name: user.first_name || 'Пользователь',
        username: user.username || null
      };
    }
  }

  // Для браузера без Telegram
  if (!AppState.user) {
    AppState.user = { id: 123, name: 'Дмитрий', username: 'dmitry_tarot' };
  }
}

// ===== ЛОКАЛЬНОЕ СОСТОЯНИЕ =====
function loadAppState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    AppState.archive = Array.isArray(data.archive) ? data.archive : [];
    AppState.wheelLastSpin = data.wheelLastSpin || null;
    AppState.lastWheelText = data.lastWheelText || '';
  } catch (e) {
    console.error('Ошибка чтения состояния:', e);
  }
}

function saveAppState() {
  try {
    const data = {
      archive: AppState.archive,
      wheelLastSpin: AppState.wheelLastSpin,
      lastWheelText: AppState.lastWheelText
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('Ошибка сохранения состояния:', e);
  }

  // Синхронизация с БД (Neon) — когда будет готов backend
  saveArchiveToServer().catch(() => {});
}

// ===== API ДЛЯ БД =====
async function loadArchiveFromServer() {
  if (!AppState.user?.id) return;
  try {
    const res = await fetch(`${API_BASE}/archive?userId=${encodeURIComponent(AppState.user.id)}`);
    if (!res.ok) return;
    const data = await res.json();
    if (Array.isArray(data.archive)) AppState.archive = data.archive;
    if (data.wheelLastSpin) AppState.wheelLastSpin = data.wheelLastSpin;
    if (data.lastWheelText) AppState.lastWheelText = data.lastWheelText;
  } catch (e) {
    console.warn('Не удалось загрузить архив из БД, работаем с локальными данными');
  }
}

async function saveArchiveToServer() {
  if (!AppState.user?.id) return;
  try {
    await fetch(`${API_BASE}/archive`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: AppState.user.id,
        archive: AppState.archive,
        wheelLastSpin: AppState.wheelLastSpin,
        lastWheelText: AppState.lastWheelText
      })
    });
  } catch (e) {
    console.warn('Не удалось синхронизировать архив с БД');
  }
}

// ===== ИНИЦИАЛИЗАЦИЯ =====
async function initApp() {
  showLoader();

  try {
    initTelegram();
    loadAppState();
    await loadArchiveFromServer();

    window.mysticAnimations = new MysticAnimations();

    await loadCardOfDay();
    initFortuneWheel();
    initSpreads();
    initDeck();
    initButtons();
    initNavigation();
    addAnimationStyles();
    renderArchive();
  } catch (error) {
    console.error('Ошибка инициализации:', error);
    showToast('Ошибка загрузки приложения', 'error');
  } finally {
    hideLoader();
  }
}

// ===== КАРТА ДНЯ =====
async function loadCardOfDay() {
  const container = $('#card-day-content');
  if (!container || !window.TAROT_CARDS?.length) return;

  const today = new Date().getDate();
  const cardIndex = today % Math.min(window.TAROT_CARDS.length, 12);
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
             onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjYwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjN0E0N0ZGIi8+PC9zdmc+'">
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
          ${new Date().toLocaleDateString('ru-RU', { 
            weekday: 'long', 
            day: 'numeric', 
            month: 'long' 
          })}
        </div>
      </div>
    </div>
  `;
}

// ===== КОЛЕСО ФОРТУНЫ =====
function getWheelRemainingMs() {
  if (!AppState.wheelLastSpin) return 0;
  const last = new Date(AppState.wheelLastSpin);
  if (Number.isNaN(last.getTime())) return 0;
  const now = new Date();
  const diff = 24 * 60 * 60 * 1000 - (now - last);
  return diff > 0 ? diff : 0;
}

function canSpinToday() {
  return getWheelRemainingMs() <= 0;
}

function updateWheelUI() {
  const spinBtn = $('#spin-wheel-btn');
  const resultEl = $('#wheel-result');
  if (!spinBtn || !resultEl) return;

  if (wheelTimerId) {
    clearInterval(wheelTimerId);
    wheelTimerId = null;
  }

  const remaining = getWheelRemainingMs();

  if (remaining <= 0) {
    spinBtn.disabled = false;
    spinBtn.innerHTML = `
      <i class="fas fa-play"></i>
      <span>Крутить колесо (1 раз в сутки)</span>
      <div class="spin-glow"></div>
    `;
    if (AppState.lastWheelText) {
      resultEl.innerHTML = AppState.lastWheelText;
    } else {
      resultEl.textContent = 'Колесо ещё не крутили сегодня';
    }
  } else {
    spinBtn.disabled = true;
    spinBtn.innerHTML = `
      <i class="fas fa-ban"></i>
      <span>До следующего кручения...</span>
      <div class="spin-glow"></div>
    `;

    const setText = () => {
      const ms = getWheelRemainingMs();
      if (ms <= 0) {
        updateWheelUI();
        return;
      }
      const totalSeconds = Math.floor(ms / 1000);
      const h = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
      const m = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
      const s = String(totalSeconds % 60).padStart(2, '0');
      resultEl.textContent = `Следующее вращение через ${h}:${m}:${s}`;
    };

    setText();
    wheelTimerId = setInterval(setText, 1000);
  }
}

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

  spinBtn.addEventListener('click', () => {
    if (wheel.classList.contains('spinning')) return;

    if (!canSpinToday()) {
      showToast('Колесо уже крутили сегодня. Возвращайтесь завтра ✨', 'error');
      return;
    }

    if (!window.TAROT_CARDS || !window.TAROT_CARDS.length) {
      showToast('Колода ещё не загружена', 'error');
      return;
    }

    wheel.classList.add('spinning');
    spinBtn.disabled = true;
    spinBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i><span>Крутится...</span><div class="spin-glow"></div>';
    resultEl.textContent = 'Колесо вращается...';

    const spins = 5 + Math.floor(Math.random() * 4);
    const extraDegrees = Math.floor(Math.random() * 360);
    const totalRotation = spins * 360 + extraDegrees;

    wheel.style.transition = 'transform 3s cubic-bezier(0.2, 0.8, 0.3, 1)';
    wheel.style.transform = `rotate(${totalRotation}deg)`;

    setTimeout(() => {
      wheel.classList.remove('spinning');

      const cards = window.TAROT_CARDS;
      const card = cards[Math.floor(Math.random() * cards.length)];

      const textHtml = `
        <div>
          <div style="margin-bottom: 6px;">Колесо выбрало карту:</div>
          <div style="font-weight: 700;">${card.name}${card.roman ? ` (${card.roman})` : ''}</div>
        </div>
      `;
      resultEl.innerHTML = textHtml;
      AppState.lastWheelText = textHtml;

      showCardModal(card, { source: 'wheel' });

      const entry = {
        type: 'wheel',
        createdAt: new Date().toISOString(),
        card: {
          id: card.id,
          name: card.name,
          roman: card.roman,
          keyword: card.keyword,
          advice: card.advice,
          image: card.image
        }
      };
      AppState.archive.unshift(entry);
      AppState.wheelLastSpin = new Date().toISOString();
      saveAppState();
      renderArchiveIfOpen();

      showToast('Колесо сделало выбор ✨', 'success');
      updateWheelUI();
    }, 3000);
  });

  updateWheelUI();
}

// ===== РАСКЛАДЫ =====
function initSpreads() {
  const container = $('#spreads-grid');
  if (!container) return;

  const spreads = [
    {
      id: 'celtic-cross',
      title: 'Кельтский крест',
      description: 'Классический расклад на 10 карт: причины ситуации, скрытые влияния, развитие и вероятный исход.',
      price: 120,
      cardsCount: 10,
      time: '30–40 мин'
    },
    {
      id: 'love-daisy',
      title: 'Ромашка любви',
      description: '6 карт, чтобы увидеть истинные чувства, мотивы и перспективы отношений.',
      price: 80,
      cardsCount: 6,
      time: '15–20 мин'
    },
    {
      id: 'love-triangle',
      title: 'Любовный треугольник',
      description: '9 карт для анализа двух вариантов отношений и выбора лучшего пути.',
      price: 110,
      cardsCount: 9,
      time: '25–30 мин'
    },
    {
      id: 'time-frames',
      title: 'Временные рамки',
      description: '4 карты: ближайший месяц, 3 месяца, полгода и год развития ситуации.',
      price: 70,
      cardsCount: 4,
      time: '10–15 мин'
    },
    {
      id: 'four-elements',
      title: 'Четыре элемента',
      description: 'Материальная сторона, эмоции, страсть и интеллектуальная связь в отношениях.',
      price: 75,
      cardsCount: 4,
      time: '15–20 мин'
    },
    {
      id: 'fate-pendulum',
      title: 'Маятник судьбы',
      description: '5 карт: текущее положение, основной путь, альтернативный путь, ключевые события и итог.',
      price: 90,
      cardsCount: 5,
      time: '20–25 мин'
    },
    {
      id: 'relationship-karma',
      title: 'Карма отношений',
      description: '7 карт о кармических задачах, уроках прошлого, препятствиях и возможностях союза.',
      price: 100,
      cardsCount: 7,
      time: '20–30 мин'
    }
  ];

  container.innerHTML = spreads.map(spread => `
    <div class="spread-item" data-id="${spread.id}">
      <div class="spread-header">
        <div class="spread-title">${spread.title}</div>
        <div class="spread-price">${spread.price}</div>
      </div>
      <div class="spread-description">${spread.description}</div>
      <div class="spread-meta">
        <span><i class="fas fa-cards-blank"></i> ${spread.cardsCount} карт</span>
        <span><i class="fas fa-clock"></i> ${spread.time}</span>
      </div>
    </div>
  `).join('');

  $$('.spread-item').forEach(item => {
    item.addEventListener('click', () => {
      const id = item.dataset.id;
      const spread = spreads.find(s => s.id === id);
      if (!spread) return;

      if (!window.TAROT_CARDS || !window.TAROT_CARDS.length) {
        showToast('Колода ещё не загружена', 'error');
        return;
      }

      const ok = confirm(`Купить расклад «${spread.title}» за ${spread.price} ★?\nОплата звёздами будет подключена позже, сейчас просто посмотрим результат.`);
      if (!ok) return;

      const result = performSpread(spread);
      AppState.archive.unshift(result);
      saveAppState();
      renderArchiveIfOpen();
      showSpreadResultModal(result);
      showToast(`Расклад «${spread.title}» добавлен в архив`, 'success');
    });
  });
}

function performSpread(spread) {
  const allCards = window.TAROT_CARDS || [];
  const cardsCopy = [...allCards];
  const used = [];

  const count = Math.min(spread.cardsCount, cardsCopy.length);

  for (let i = 0; i < count; i++) {
    const idx = Math.floor(Math.random() * cardsCopy.length);
    const card = cardsCopy.splice(idx, 1)[0];
    used.push({
      id: card.id,
      name: card.name,
      roman: card.roman,
      keyword: card.keyword,
      description: card.description,
      advice: card.advice,
      image: card.image
    });
  }

  return {
    type: 'spread',
    spreadId: spread.id,
    title: spread.title,
    createdAt: new Date().toISOString(),
    cards: used
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

  const cardsHtml = result.cards.map((card, index) => {
    const hasImage = typeof card.id === 'number' && card.id < 12;
    return `
      <div style="margin-bottom: 18px; text-align:left;">
        <div style="font-size:13px; color:var(--text-light); margin-bottom:4px;">
          Карта ${index + 1}
        </div>
        <div style="display:flex; gap:12px; align-items:flex-start;">
          ${hasImage ? `
            <img src="${card.image}" 
                 alt="${card.name}" 
                 style="width:70px; height:110px; object-fit:cover; border-radius:10px;"
                 onerror="this.style.display='none'">
          ` : ''}
          <div>
            <div style="font-weight:600; color:var(--primary); margin-bottom:4px;">
              ${card.name}${card.roman ? ` (${card.roman})` : ''}
            </div>
            <div style="font-size:13px; color:var(--secondary); margin-bottom:6px;">
              ${card.keyword || ''}
            </div>
            <div style="font-size:13px; color:var(--text); margin-bottom:6px;">
              ${card.description || ''}
            </div>
            <div style="font-size:12px; color:var(--text-light);">
              Совет: ${card.advice || 'Совет будет добавлен позже.'}
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');

  body.innerHTML = `
    <div style="text-align:left;">
      <h3 style="font-size:20px; color:var(--primary); margin-bottom:8px;">${result.title}</h3>
      <div style="font-size:12px; color:var(--text-light); margin-bottom:16px;">
        ${dateStr}
      </div>
      ${cardsHtml}
    </div>
  `;

  openModal(modal);
}

// ===== КОЛОДА =====
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
           onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjQ1MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjN0E0N0ZGIi8+PC9zdmc+'">
      <div class="deck-card-info">
        <div class="deck-card-name">${card.name}</div>
        <div class="deck-card-roman">${card.roman || ''}</div>
      </div>
    </div>
  `).join('');

  $$('.deck-card').forEach(cardEl => {
    cardEl.addEventListener('click', () => {
      const cardId = parseInt(cardEl.dataset.id, 10);
      const cardData = window.TAROT_CARDS.find(c => c.id === cardId);
      if (cardData) showCardModal(cardData, { source: 'deck' });
    });
  });
}

// ===== МОДАЛКА КАРТЫ / ОТВЕТА =====
function showCardModal(card, options = {}) {
  const modal = $('#card-modal');
  const body = $('#card-modal-body');
  if (!modal || !body) return;

  body.innerHTML = `
    <div style="text-align:center;">
      <img src="${card.image}" 
           alt="${card.name}" 
           style="width:200px; height:300px; object-fit:cover; border-radius:12px; margin-bottom:20px;"
           onerror="this.style.display='none'">
      <h3 style="font-size:24px; color:var(--primary); margin-bottom:8px;">${card.name}</h3>
      ${card.roman ? `<div style="color: var(--text-light); font-size:16px; margin-bottom:12px;">${card.roman}</div>` : ''}
      <div style="background: var(--primary); color:white; padding:8px 16px; border-radius:20px; display:inline-block; margin-bottom:16px;">
        ${card.keyword || ''}
      </div>
      <p style="color:var(--text); line-height:1.6; margin-bottom:16px;">${card.description || ''}</p>
      <div style="font-size:14px; color:var(--text-light);">
        <i class="fas fa-lightbulb"></i> Совет: ${card.advice || 'Совет будет добавлен позже.'}
      </div>
    </div>
  `;

  openModal(modal);
}

function showAnswerModal(question, answer, typeLabel) {
  const modal = $('#card-modal');
  const body = $('#card-modal-body');
  if (!modal || !body) return;

  const typeText = {
    love: 'Любовь и отношения',
    career: 'Карьера и дело',
    future: 'Будущее',
    decision: 'Выбор и решения'
  }[typeLabel] || 'Ответ Вселенной';

  body.innerHTML = `
    <div style="text-align:center; padding:20px;">
      <div class="modal-icon" style="margin:0 auto 20px;">
        <i class="fas fa-stars"></i>
      </div>
      <h3 style="font-size:20px; color:var(--primary); margin-bottom:8px;">${typeText}</h3>
      <div style="font-size:12px; color:var(--text-light); margin-bottom:16px;">
        Ваш вопрос:
      </div>
      <div style="background:rgba(138,43,226,0.06); padding:12px; border-radius:12px; margin-bottom:20px; font-style:italic;">
        "${question}"
      </div>
      <div style="font-size:18px; color:var(--primary); font-weight:600; margin-bottom:16px;">
        ${answer}
      </div>
      <div style="font-size:14px; color:var(--text-light);">
        <i class="fas fa-lightbulb"></i> Дальнейшая трактовка зависит от контекста ситуации.
      </div>
    </div>
  `;

  openModal(modal);
}

function showYesNoModal(question, result) {
  const modal = $('#card-modal');
  const body = $('#card-modal-body');
  if (!modal || !body) return;

  body.innerHTML = `
    <div style="text-align:center; padding:20px;">
      <div class="modal-icon" style="margin:0 auto 20px;">
        <i class="fas fa-scale-balanced"></i>
      </div>
      <h3 style="font-size:20px; color:var(--primary); margin-bottom:8px;">Ответ «Да / Нет»</h3>
      <div style="font-size:12px; color:var(--text-light); margin-bottom:16px;">
        Ваш вопрос:
      </div>
      <div style="background:rgba(138,43,226,0.06); padding:12px; border-radius:12px; margin-bottom:20px; font-style:italic;">
        "${question}"
      </div>
      <div style="font-size:22px; font-weight:700; margin-bottom:8px;">
        ${result.answer}
      </div>
      <div style="font-size:14px; color:var(--text-light);">
        ${result.comment}
      </div>
    </div>
  `;

  openModal(modal);
}

function openModal(modal) {
  modal.classList.add('active');
  const closeBtn = modal.querySelector('.modal-close');

  if (closeBtn) {
    closeBtn.onclick = () => modal.classList.remove('active');
  }

  modal.onclick = (e) => {
    if (e.target === modal) modal.classList.remove('active');
  };
}

// ===== КНОПКИ =====
function initButtons() {
  $('#refresh-btn')?.addEventListener('click', async () => {
    if (!AppState.isLoading) {
      AppState.isLoading = true;
      const btn = $('#refresh-btn');
      btn.classList.add('refreshing');

      await loadCardOfDay();
      showToast('Карта дня обновлена', 'success');

      setTimeout(() => {
        btn.classList.remove('refreshing');
        AppState.isLoading = false;
      }, 800);
    }
  });

  $('#question-btn')?.addEventListener('click', () => {
    openQuestionModal();
  });

  $('#yes-no-btn')?.addEventListener('click', () => {
    handleYesNo();
  });

  $$('.question-type').forEach(type => {
    type.addEventListener('click', function () {
      $$('.question-type').forEach(t => t.classList.remove('active'));
      this.classList.add('active');
      AppState.questionType = this.dataset.type;
    });
  });

  $('#ask-question-btn')?.addEventListener('click', askQuestion);

  const questionInput = $('#question-input');
  const charCount = $('#char-count');

  if (questionInput && charCount) {
    questionInput.addEventListener('input', function () {
      charCount.textContent = this.value.length;
    });
  }
}

function openQuestionModal() {
  const modal = $('#question-modal');
  if (!modal) return;
  modal.classList.add('active');

  const closeBtn = modal.querySelector('.modal-close');
  if (closeBtn) closeBtn.onclick = () => modal.classList.remove('active');

  modal.onclick = (e) => {
    if (e.target === modal) modal.classList.remove('active');
  };
}

function askQuestion() {
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

  const type = AppState.questionType || 'love';
  const pool = ANSWERS_BY_TYPE[type] || ANSWERS_BY_TYPE.love;
  if (!pool || !pool.length) {
    showToast('Ответы для этой категории пока не настроены', 'error');
    return;
  }

  let idx = Math.floor(Math.random() * pool.length);
  const lastIdx = AppState.lastAnswers[type];
  if (pool.length > 1 && idx === lastIdx) {
    idx = (idx + 1) % pool.length;
  }
  AppState.lastAnswers[type] = idx;

  const answer = pool[idx];

  $('#question-modal')?.classList.remove('active');
  showToast('Вселенная формулирует ответ...', 'info');

  setTimeout(() => {
    showAnswerModal(question, answer, type);
  }, 800);

  input.value = '';
  $('#char-count').textContent = '0';
}

function handleYesNo() {
  const question = prompt('Задайте вопрос, на который можно ответить «да» или «нет»:');
  if (!question || !question.trim()) {
    return;
  }

  if (question.trim().length < 3) {
    showToast('Вопрос слишком короткий', 'error');
    return;
  }

  const variants = [
    { answer: 'ДА', comment: 'Энергии благоприятны, но действуйте осознанно.' },
    { answer: 'НЕТ', comment: 'Сейчас лучше повременить и пересмотреть план.' },
    { answer: 'СКОРЕЕ ДА', comment: 'Шансы высоки, но есть нюансы, на которые стоит обратить внимание.' },
    { answer: 'СКОРЕЕ НЕТ', comment: 'Условия пока не созрели, попробуйте изменить подход.' }
  ];

  const choice = variants[Math.floor(Math.random() * variants.length)];
  showYesNoModal(question.trim(), choice);
}

// ===== НАВИГАЦИЯ =====
function initNavigation() {
  $$('.nav-btn').forEach(btn => {
    btn.addEventListener('click', function () {
      const screen = this.dataset.screen;

      $$('.nav-btn').forEach(b => b.classList.remove('active'));
      $$('.screen').forEach(s => s.classList.remove('active'));

      this.classList.add('active');
      const el = $(`#${screen}-screen`);
      if (el) el.classList.add('active');

      if (screen === 'archive') {
        renderArchive();
      }
    });
  });
}

// ===== АРХИВ =====
function renderArchive() {
  const container = $('#archive-list');
  if (!container) return;

  if (!AppState.archive.length) {
    container.innerHTML = `<p class="section-subtitle">Пока здесь пусто. Сделайте расклад или прокрутите колесо фортуны.</p>`;
    return;
  }

  container.innerHTML = AppState.archive.map((entry, index) => {
    const date = new Date(entry.createdAt);
    const dateStr = date.toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    if (entry.type === 'spread') {
      return `
        <div class="archive-item" data-index="${index}">
          <div class="archive-item-header">
            <div class="archive-item-title">${entry.title}</div>
            <div class="archive-item-type">Расклад</div>
          </div>
          <div class="archive-item-meta">
            ${dateStr} • ${entry.cards?.length || 0} карт
          </div>
        </div>
      `;
    }

    if (entry.type === 'wheel') {
      return `
        <div class="archive-item" data-index="${index}">
          <div class="archive-item-header">
            <div class="archive-item-title">Колесо фортуны — ${entry.card?.name || 'карта'}</div>
            <div class="archive-item-type">Колесо</div>
          </div>
          <div class="archive-item-meta">
            ${dateStr}
          </div>
        </div>
      `;
    }

    return '';
  }).join('');

  $$('.archive-item').forEach(item => {
    item.addEventListener('click', () => {
      const idx = parseInt(item.dataset.index, 10);
      const entry = AppState.archive[idx];
      if (!entry) return;

      if (entry.type === 'spread') {
        showSpreadResultModal(entry);
      } else if (entry.type === 'wheel' && entry.card) {
        showCardModal(entry.card, { source: 'wheel-archive' });
      }
    });
  });
}

function renderArchiveIfOpen() {
  const archiveScreen = $('#archive-screen');
  if (archiveScreen && archiveScreen.classList.contains('active')) {
    renderArchive();
  }
}

// ===== ДОП. СТИЛИ АНИМАЦИЙ =====
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

// ===== ЛОАДЕР / ТОСТЫ =====
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

  toast.style.background = type === 'error' ? 'var(--danger)'
    : type === 'success' ? 'var(--success)'
    : 'var(--primary)';

  toast.textContent = message;
  toast.classList.add('show');

  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

// ===== ЗАПУСК =====
document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 TARO запускается...');
  initApp();
});
