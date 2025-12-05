// ===== Утилиты =====
const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));

const STORAGE_KEY = 'tarot_app_state';

// Состояние приложения
const AppState = {
  user: null,
  currentCard: null,
  questionType: 'love',
  archive: [],
  wheelLastSpin: null,
  lastAnswers: {} // по категориям, чтобы не повторять подряд
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

// ===== ИНИЦИАЛИЗАЦИЯ =====

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
        username: user.username
      };
    }
  }

  if (!AppState.user) {
    AppState.user = { id: 123, name: 'Дмитрий', username: 'dmitry_tarot' };
  }

  const nameSpan = $('#status-username');
  if (nameSpan && AppState.user?.name) {
    nameSpan.textContent = `${AppState.user.name} онлайн`;
  }
}

function loadAppState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    AppState.archive = Array.isArray(data.archive) ? data.archive : [];
    AppState.wheelLastSpin = data.wheelLastSpin || null;
  } catch (e) {
    console.error('Ошибка чтения состояния:', e);
  }
}

function saveAppState() {
  try {
    const data = {
      archive: AppState.archive,
      wheelLastSpin: AppState.wheelLastSpin
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('Ошибка сохранения состояния:', e);
  }
}

async function initApp() {
  showLoader();
  try {
    initTelegram();
    loadAppState();

    window.mysticAnimations = new MysticAnimations();

    await loadCardOfDay();
    initFortuneWheel();
    initSpreads();
    initDeck();
    initButtons();
    initNavigation();
    addAnimationStyles();
    renderArchive(); // для экрана архива
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

function canSpinToday() {
  if (!AppState.wheelLastSpin) return true;
  const last = new Date(AppState.wheelLastSpin);
  if (Number.isNaN(last.getTime())) return true;
  const now = new Date();
  return now - last >= 24 * 60 * 60 * 1000 || last.toDateString() !== now.toDateString();
}

function initFortuneWheel() {
  const wheel = $('#fortune-wheel');
  const spinBtn = $('#spin-wheel-btn');
  const resultEl = $('#wheel-result');
  if (!wheel || !spinBtn || !resultEl) return;

  // визуальные секции
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
    spinBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i><span>Крутится...</span>';
    resultEl.textContent = 'Колесо вращается...';

    const spins = 5 + Math.floor(Math.random() * 4);
    const extraDegrees = Math.floor(Math.random() * 360);
    const totalRotation = spins * 360 + extraDegrees;

    wheel.style.transition = 'transform 3s cubic-bezier(0.2, 0.8, 0.3, 1)';
    wheel.style.transform = `rotate(${totalRotation}deg)`;

    setTimeout(() => {
      wheel.classList.remove('spinning');
      spinBtn.disabled = false;
      spinBtn.innerHTML = '<i class="fas fa-play"></i><span>Крутить колесо (1 раз в сутки)</span>';

      const cards = window.TAROT_CARDS;
      const card = cards[Math.floor(Math.random() * cards.length)];

      resultEl.innerHTML = `
        <div>
          <div style="margin-bottom: 6px;">Колесо выбрало карту:</div>
          <div style="font-weight: 700;">${card.name}${card.roman ? ` (${card.roman})` : ''}</div>
        </div>
      `;

      showCardModal(card, { source: 'wheel' });

      const entry = {
        type: 'wheel',
        createdAt: new Date().toISOString(),
        cardId: card.id,
        cardName: card.name,
        cardKeyword: card.keyword,
        cardAdvice: card.advice
      };
      AppState.archive.unshift(entry);
      AppState.wheelLastSpin = new Date().toISOString();
      saveAppState();
      renderArchiveIfOpen();

      showToast('Колесо сделало выбор ✨', 'success');
    }, 3000);
  });
}

// ===== РАСКЛАДЫ =====

function initSpreads() {
  const container = $('#spreads-grid');
  if (!container) return;

  // новые расклады по ТЗ
  const spreads = [
    {
      id: 'celtic-cross',
      title: 'Кельтский крест',
      description: 'Один из самых известных раскладов из 10 карт. Показывает причины ситуации, её развитие и вероятный исход.',
      price: 120,
      cards: 10,
      time: '30–40 мин'
    },
    {
      id: 'love-daisy',
      title: 'Ромашка любви',
      description: 'Расклад из 6 карт для понимания истинных чувств партнёра и потенциала отношений.',
      price: 80,
      cards: 6,
      time: '20–25 мин'
    },
    {
      id: 'love-triangle',
      title: 'Любовный треугольник',
      description: '9 карт для анализа двух потенциальных вариантов развития отношений и вашей роли в ситуации.',
      price: 110,
      cards: 9,
      time: '25–35 мин'
    },
    {
      id: 'time-frames',
      title: 'Временные рамки',
      description: '4 карты, каждая отражает период: месяц, 3 месяца, полгода и год развития отношений.',
      price: 70,
      cards: 4,
      time: '15–20 мин'
    },
    {
      id: 'four-elements',
      title: 'Четыре элемента',
      description: '4 карты, показывающие материальную сторону, эмоции, страсть и интеллектуальную связь.',
      price: 75,
      cards: 4,
      time: '15–20 мин'
    },
    {
      id: 'destiny-pendulum',
      title: 'Маятник судьбы',
      description: '5 карт: текущее положение, основной путь, альтернативный путь, ключевые события и итог.',
      price: 85,
      cards: 5,
      time: '20–25 мин'
    },
    {
      id: 'karma-relationships',
      title: 'Карма отношений',
      description: '7 карт, освещающих кармическую задачу союза, уроки прошлого, препятствия, ресурсы и итог.',
      price: 95,
      cards: 7,
      time: '25–30 мин'
    }
  ];

  container.innerHTML = spreads.map(spread => `
    <div class="spread-item" data-id="${spread.id}">
      <div class="spread-header">
        <div class="spread-header-main">
          <i class="fas fa-star spread-icon"></i>
          <div class="spread-title">${spread.title}</div>
        </div>
        <div class="spread-price">${spread.price}</div>
      </div>
      <div class="spread-description">${spread.description}</div>
      <div class="spread-meta">
        <span><i class="fas fa-cards"></i> ${spread.cards} карт</span>
        <span><i class="fas fa-clock"></i> ${spread.time}</span>
      </div>
    </div>
  `).join('');

  $$('.spread-item').forEach(item => {
    item.addEventListener('click', () => {
      const spreadId = item.dataset.id;
      const spread = spreads.find(s => s.id === spreadId);
      if (!spread) return;

      if (!window.TAROT_CARDS || !window.TAROT_CARDS.length) {
        showToast('Колода ещё не загружена', 'error');
        return;
      }

      const cardsToDraw = Math.min(spread.cards, window.TAROT_CARDS.length);
      const pool = [...window.TAROT_CARDS];
      const drawn = [];

      for (let i = 0; i < cardsToDraw; i++) {
        const index = Math.floor(Math.random() * pool.length);
        drawn.push(pool.splice(index, 1)[0]);
      }

      showSpreadResultModal(spread, drawn);

      const entry = {
        type: 'spread',
        createdAt: new Date().toISOString(),
        spreadId: spread.id,
        title: spread.title,
        cards: drawn.map(c => c.name),
        price: spread.price,
        description: spread.description
      };
      AppState.archive.unshift(entry);
      saveAppState();
      renderArchiveIfOpen();

      showToast(`Расклад "${spread.title}" выполнен`, 'success');
    });
  });
}

function showSpreadResultModal(spread, cards) {
  const modal = $('#card-modal');
  const body = $('#card-modal-body');
  if (!modal || !body) return;

  const cardsHtml = cards.map((card, idx) => {
    const hasRealImage = typeof card.id === 'number' && card.id <= 11 && card.image;
    const header = `<div style="font-weight:600;margin-bottom:4px;">${idx + 1}. ${card.name}${card.roman ? ` (${card.roman})` : ''}</div>`;
    const keyword = card.keyword ? `<div style="font-size:13px;color:var(--secondary);margin-bottom:4px;">${card.keyword}</div>` : '';
    const desc = card.description ? `<div style="font-size:13px;margin-bottom:4px;">${card.description}</div>` : '';
    const advice = card.advice ? `<div style="font-size:12px;color:var(--text-light);"><i class="fas fa-lightbulb"></i> ${card.advice}</div>` : '';

    if (hasRealImage) {
      return `
        <div style="display:flex;gap:12px;margin-bottom:16px;align-items:flex-start;">
          <img src="${card.image}" alt="${card.name}"
               style="width:70px;height:105px;object-fit:cover;border-radius:10px;flex-shrink:0;"
               onerror="this.style.display='none'">
          <div style="flex:1;">
            ${header}
            ${keyword}
            ${desc}
            ${advice}
          </div>
        </div>
      `;
    }

    return `
      <div style="margin-bottom:12px;padding:10px 12px;border-radius:12px;background:rgba(138,43,226,0.04);border:1px solid rgba(138,43,226,0.15);">
        ${header}
        ${keyword}
        ${desc}
        ${advice}
      </div>
    `;
  }).join('');

  body.innerHTML = `
    <div style="text-align: center;margin-bottom:16px;">
      <div class="modal-icon" style="margin-bottom:12px;">
        <i class="fas fa-cards"></i>
      </div>
      <h3 style="font-size:20px;margin-bottom:4px;color:var(--primary);">${spread.title}</h3>
      <div style="font-size:13px;color:var(--text-light);margin-bottom:8px;">
        ${spread.description}
      </div>
      <div style="font-size:12px;color:var(--text-light);">
        ${spread.cards} карт · ★ ${spread.price}
      </div>
    </div>
    <div style="border-top:1px solid var(--border);padding-top:12px;margin-top:8px;">
      ${cardsHtml}
    </div>
  `;

  openModal(modal);
}

// ===== КОЛОДА / ОДНА КАРТА =====

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

function showCardModal(card, options = {}) {
  const modal = $('#card-modal');
  const body = $('#card-modal-body');
  if (!modal || !body) return;

  body.innerHTML = `
    <div style="text-align: center;">
      ${card.image && card.id <= 11 ? `
        <img src="${card.image}" 
             alt="${card.name}" 
             style="width: 200px; height: 300px; object-fit: cover; border-radius: 12px; margin-bottom: 20px;"
             onerror="this.style.display='none'">
      ` : ''}
      <h3 style="font-size: 24px; color: var(--primary); margin-bottom: 8px;">${card.name}</h3>
      ${card.roman ? `<div style="color: var(--text-light); font-size: 16px; margin-bottom: 12px;">${card.roman}</div>` : ''}
      <div style="background: var(--primary); color: white; padding: 8px 16px; border-radius: 20px; display: inline-block; margin-bottom: 16px;">
        ${card.keyword || ''}
      </div>
      <p style="color: var(--text); line-height: 1.6; margin-bottom: 20px;">${card.description || ''}</p>
    </div>

    <div style="margin-top: 10px; text-align: left;">
      <h4 style="font-size: 14px; font-weight: 600; margin-bottom: 4px;">Прямое значение</h4>
      <p style="font-size: 13px; margin-bottom: 10px;">${card.upright || '—'}</p>

      <h4 style="font-size: 14px; font-weight: 600; margin-bottom: 4px;">Перевёрнутое</h4>
      <p style="font-size: 13px; margin-bottom: 10px;">${card.reversed || '—'}</p>

      <h4 style="font-size: 14px; font-weight: 600; margin-bottom: 4px;">Совет карты</h4>
      <p style="font-size: 13px; margin-bottom: 4px;">${card.advice || '—'}</p>
    </div>
  `;

  openModal(modal);
}

// ===== СПРОСИТЬ ВСЕЛЕННУЮ =====

const QUESTION_ANSWERS = {
  love: [
    'В любви для вас открывается новое пространство близости и доверия — важно позволить себе быть честным в чувствах.',
    'Сейчас отношения проходят проверку на искренность: всё, что построено на иллюзиях, будет мягко уходить.',
    'Партнёр отражает ваше отношение к себе: чем больше уважения к себе, тем здоровее становится связь.',
    'В ближайшее время возможно важное откровенный разговор, который расставит акценты и снимет сомнения.',
    'Чувства есть, но им нужно больше времени и пространства, без давления и контроля.',
    'Если вы одиноки, вы выходите из старого сценария любви и становитесь готовы к новому формату отношений.',
    'Не цепляйтесь за прошлое — оно забирает энергию, которая нужна для живых встреч здесь и сейчас.',
    'Важнее сейчас не “быть с кем-то”, а не предавать свои внутренние ценности ради отношений.'
  ],
  career: [
    'В профессиональной сфере у вас начинается период роста — важно заметить шанс, а не отмахнуться от него.',
    'Вы подходите к точке выбора: продолжать по старой траектории или рискнуть и выйти на новый уровень.',
    'Ваши навыки реально стоят дороже, чем вы о себе думаете — пора корректировать самооценку и запросы.',
    'В ближайшие месяцы возможны новые предложения или проект, который потребует ответственности, но даст рывок.',
    'Сейчас лучше вкладываться в образование и развитие компетенций — это быстро окупится.',
    'Не стоит соглашаться на условия, которые обнуляют ваш ресурс и время, даже если кажется, что “так надо”.',
    'Коллеги или партнёры могут стать поддержкой, если вы перестанете всё тянуть в одиночку.',
    'Всё, что не даёт роста и смысла, будет постепенно отпадать, освобождая место для более подходящей работы.'
  ],
  future: [
    'Будущее выстраивается через несколько мягких, но важных поворотов — не одним резким событием.',
    'Ситуация вокруг вас ещё формируется, поэтому часть неопределённости — нормальна и временная.',
    'В ближайшее время вы получите знак или встречу, которые помогут поменять взгляд на свои планы.',
    'Часть старых целей потеряет актуальность, и это нормально — вы меняетесь, вместе с этим меняется и маршрут.',
    'Вам важно сейчас держать фокус не на страхах, а на том, что реально вдохновляет и наполняет.',
    'События будут развиваться быстрее, если вы перестанете оттягивать важные решения.',
    'Будущее не жёстко прописано: ваши ежедневные маленькие действия уже сейчас переписывают сценарий.',
    'Вы будете ощущать всё больше внутренней опоры, даже если внешние обстоятельства не идеальны.'
  ],
  decision: [
    'Выбор стоит делать в пользу варианта, где больше свободы и живости, а не только формальной стабильности.',
    'Если в одном из вариантов вы постоянно “сжимаетесь” — тело уже даёт подсказку, что это не ваш путь.',
    'Оба пути могут привести к результату, но один из них гораздо ближе к вашим истинным ценностям.',
    'Сначала разрешите себе честно признаться, чего вы боитесь — после этого решение станет яснее.',
    'Если ответ не приходит — возможно, сейчас рано делать окончательный шаг, нужно ещё немного информации.',
    'Представьте, что вам уже 5 лет спустя: какой выбор вызывает ощущение спокойствия, а не сожаления?',
    'Интуиция уже подсказывает вам направление, просто ум пока занят поиском гарантий и перестраховкой.',
    'Ни один выбор не будет “идеальным”, но один из них даёт ощущение роста, а другой — застоя.'
  ]
};

const EXTRA_PHRASES = [
  'Обратите внимание на повторяющиеся знаки и совпадения вокруг — они усиливают ответ.',
  'Главное сейчас — не торопить события и дать себе время прожить свои чувства.',
  'Вселенная мягко подталкивает вас к более честному выбору по отношению к себе.',
  'Сохраняйте уважение к собственным границам — это ключ к правильному решению.',
  'Запишите свои мысли на бумаге: так вы быстрее увидите ясный ответ.'
];

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

  $('#question-modal').classList.remove('active');
  showToast('🌀 Вселенная слышит ваш вопрос...', 'info');

  setTimeout(() => {
    const type = AppState.questionType || 'love';
    const list = QUESTION_ANSWERS[type] || QUESTION_ANSWERS.love;
    if (!list || !list.length) return;

    let index = Math.floor(Math.random() * list.length);
    const lastIndex = AppState.lastAnswers[type];
    if (list.length > 1 && index === lastIndex) {
      index = (index + 1) % list.length;
    }
    AppState.lastAnswers[type] = index;

    const baseAnswer = list[index];
    const extra = EXTRA_PHRASES[Math.floor(Math.random() * EXTRA_PHRASES.length)];
    const fullAnswer = `${baseAnswer} ${extra}`;

    showAnswerModal(question, fullAnswer);

    input.value = '';
    const charCount = $('#char-count');
    if (charCount) charCount.textContent = '0';
  }, 1500);
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
      <h3 style="font-size: 20px; color: var(--primary); margin-bottom: 16px;">Ответ Вселенной</h3>
      
      <div style="background: rgba(138, 43, 226, 0.1); padding: 16px; border-radius: 12px; margin-bottom: 20px;">
        <div style="font-size: 12px; color: var(--text-light); margin-bottom: 8px;">Ваш вопрос:</div>
        <div style="font-style: italic; color: var(--text);">"${question}"</div>
      </div>
      
      <div style="font-size: 16px; color: var(--primary); font-weight: 600; margin-bottom: 16px; text-align:left;">
        ${answer}
      </div>
    </div>
  `;

  openModal(modal);
}

// ===== ДА / НЕТ =====

const YESNO_VARIANTS = [
  { short: 'Да', text: 'Энергия ситуации складывается в вашу пользу — ответ ближе к «да».' },
  { short: 'Скорее да', text: 'Пока всё движется в направлении положительного исхода, но важно поддерживать это своими действиями.' },
  { short: 'Нет', text: 'Сейчас обстоятельства не поддерживают этот вариант — ответ ближе к «нет».' },
  { short: 'Скорее нет', text: 'Слишком много сопротивления и преград, чтобы говорить о полном «да».' },
  { short: 'Ответ пока скрыт', text: 'Ситуация ещё не сформировалась до конца — важно пересмотреть запрос или задать более точный вопрос.' }
];

function askYesNoQuestion() {
  const input = $('#yesno-input');
  if (!input) return;

  const question = input.value.trim();
  if (!question) {
    showToast('Введите ваш вопрос', 'error');
    return;
  }
  if (question.length < 3) {
    showToast('Вопрос должен быть чуть более развёрнутым', 'error');
    return;
  }

  $('#yesno-modal').classList.remove('active');
  showToast('🔍 Формируется ответ Да / Нет...', 'info');

  setTimeout(() => {
    const variant = YESNO_VARIANTS[Math.floor(Math.random() * YESNO_VARIANTS.length)];
    const modal = $('#card-modal');
    const body = $('#card-modal-body');
    if (!modal || !body) return;

    body.innerHTML = `
      <div style="text-align:center;padding:20px;">
        <div class="modal-icon" style="margin:0 auto 20px;">
          <i class="fas fa-scale-balanced"></i>
        </div>
        <h3 style="font-size:20px;color:var(--primary);margin-bottom:16px;">Ответ Да / Нет</h3>
        <div style="background: rgba(138, 43, 226, 0.1); padding: 16px; border-radius: 12px; margin-bottom: 20px;">
          <div style="font-size: 12px; color: var(--text-light); margin-bottom: 8px;">Ваш вопрос:</div>
          <div style="font-style: italic; color: var(--text);">"${question}"</div>
        </div>
        <div style="font-size:28px;font-weight:700;margin-bottom:8px;">${variant.short}</div>
        <div style="font-size:14px;color:var(--text);">${variant.text}</div>
      </div>
    `;

    openModal(modal);

    input.value = '';
    const cc = $('#yesno-char-count');
    if (cc) cc.textContent = '0';
  }, 1000);
}

// ===== АРХИВ =====

function renderArchive() {
  const targets = ['archive-list', 'archive-screen-list'];

  targets.forEach(id => {
    const list = document.getElementById(id);
    if (!list) return;

    if (!AppState.archive || !AppState.archive.length) {
      list.innerHTML = `
        <p style="text-align: center; color: var(--text-light);">
          Пока нет сохранённых раскладов и результатов колеса.
        </p>
      `;
      return;
    }

    const items = [...AppState.archive].sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );

    list.innerHTML = items.map(item => {
      const date = new Date(item.createdAt).toLocaleString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });

      if (item.type === 'spread') {
        return `
          <div class="archive-item">
            <div class="archive-item-top">
              <span class="archive-tag archive-tag-spread">Расклад</span>
              <span class="archive-date">${date}</span>
            </div>
            <div class="archive-title">${item.title || 'Расклад'}</div>
            <div class="archive-meta">
              <span>${item.cards?.length || '?'} карт</span>
              <span>${item.price ? `★ ${item.price}` : ''}</span>
            </div>
            ${item.description ? `<p class="archive-desc">${item.description}</p>` : ''}
          </div>
        `;
      }

      if (item.type === 'wheel') {
        return `
          <div class="archive-item">
            <div class="archive-item-top">
              <span class="archive-tag archive-tag-wheel">Колесо фортуны</span>
              <span class="archive-date">${date}</span>
            </div>
            <div class="archive-title">Карта: ${item.cardName || 'неизвестно'}</div>
            <div class="archive-meta">
              <span>Результат вращения</span>
              <span>${item.cardKeyword || ''}</span>
            </div>
            ${item.cardAdvice ? `<p class="archive-desc"><i class="fas fa-lightbulb"></i> ${item.cardAdvice}</p>` : ''}
          </div>
        `;
      }

      return '';
    }).join('');
  });
}

function openArchiveModal() {
  const modal = $('#archive-modal');
  if (!modal) return;
  renderArchive();
  openModal(modal);
}

function renderArchiveIfOpen() {
  const modal = $('#archive-modal');
  const screen = $('#archive-screen');
  if ((modal && modal.classList.contains('active')) ||
      (screen && screen.classList.contains('active'))) {
    renderArchive();
  }
}

// ===== КНОПКИ / НАВИГАЦИЯ =====

function initButtons() {
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

  $('#card-day-content')?.addEventListener('click', () => {
    if (AppState.currentCard) showCardModal(AppState.currentCard, { source: 'day' });
  });

  $('#question-btn')?.addEventListener('click', () => {
    openQuestionModal();
  });

  $('#yes-no-btn')?.addEventListener('click', () => {
    openYesNoModal();
  });

  $('#archive-btn')?.addEventListener('click', () => {
    openArchiveModal();
  });

  $$('.question-type').forEach(type => {
    type.addEventListener('click', function () {
      $$('.question-type').forEach(t => t.classList.remove('active'));
      this.classList.add('active');
      AppState.questionType = this.dataset.type;
    });
  });

  $('#ask-question-btn')?.addEventListener('click', askQuestion);
  $('#ask-yesno-btn')?.addEventListener('click', askYesNoQuestion);

  const questionInput = $('#question-input');
  const charCount = $('#char-count');
  if (questionInput && charCount) {
    questionInput.addEventListener('input', function () {
      charCount.textContent = this.value.length;
    });
  }

  const yesnoInput = $('#yesno-input');
  const yesnoCharCount = $('#yesno-char-count');
  if (yesnoInput && yesnoCharCount) {
    yesnoInput.addEventListener('input', function () {
      yesnoCharCount.textContent = this.value.length;
    });
  }
}

function openQuestionModal() {
  const modal = $('#question-modal');
  if (!modal) return;
  openModal(modal);
}

function openYesNoModal() {
  const modal = $('#yesno-modal');
  if (!modal) return;
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

function initNavigation() {
  $$('.nav-btn').forEach(btn => {
    btn.addEventListener('click', function () {
      const screen = this.dataset.screen;
      $$('.nav-btn').forEach(b => b.classList.remove('active'));
      $$('.screen').forEach(s => s.classList.remove('active'));
      this.classList.add('active');
      $(`#${screen}-screen`).classList.add('active');
      if (screen === 'archive') {
        renderArchive();
      }
    });
  });
}

// ===== АНИМАЦИОННЫЙ CSS =====

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

// ===== ВСПОМОГАТЕЛЬНОЕ =====

function showLoader() {
  const loader = $('#app-loader');
  if (loader) loader.style.display = 'flex';
}

function hideLoader() {
  const loader = $('#app-loader');
  if (!loader) return;
  loader.style.opacity = '0';
  setTimeout(() => {
    loader.style.display = 'none';
    loader.style.opacity = '1';
  }, 300);
}

function showToast(message, type = 'info') {
  const toast = $('#toast');
  if (!toast) return;

  toast.style.background =
    type === 'error' ? 'var(--danger)' :
    type === 'success' ? 'var(--success)' :
    'var(--primary)';

  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}

// Запуск
document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 TARO запускается...');
  initApp();
});
