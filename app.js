// ===== УТИЛИТЫ =====
const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));

// ===== СКРОЛЛ-ЛОК ДЛЯ МОДАЛОК =====
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

// ===== ФИКС ДЛЯ JPG/PNG =====
function handleCardImgError(imgEl) {
  if (!imgEl) return;
  const src = imgEl.getAttribute('src') || '';
  const step = Number(imgEl.dataset.fallbackStep || 0);

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
  wheelTimerId: null
};

const ASK_UNIVERSE_PRICE = 35;
const YES_NO_PRICE = 25;
const NEW_USER_STARS = 150;
const WHEEL_COOLDOWN_HOURS = 24;

// ===== ТАРОЛОГИ ДЛЯ ЛОКАЛЬНОЙ ГЕНЕРАЦИИ =====
const TAROT_READERS = [
  { name: "Арина", specialty: "кармические связи", emoji: "🌙" },
  { name: "Михаил", specialty: "практические вопросы", emoji: "⚡" },
  { name: "Лиана", specialty: "отношения", emoji: "💖" },
  { name: "Дмитрий", specialty: "духовный рост", emoji: "🕊️" },
  { name: "Светлана", specialty: "финансы и карьера", emoji: "💼" }
];

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

// ===== ИИ-ТРАКТОВКА РАСКЛАДОВ =====
async function getAITarotReading(spread, cards, question = '') {
  try {
    showThinkingAnimation('Анализирую расклад...');
    
    const response = await fetch('/api/tarot-reading', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        cards: cards.map(card => ({
          id: card.id,
          name: card.name,
          roman: card.roman,
          keyword: card.keyword,
          description: card.description,
          upright: card.upright,
          reversed: card.reversed,
          advice: card.advice,
          category: card.category,
          suit: card.suit
        })),
        spreadType: spread.title,
        question: question,
        userId: AppState.userId || 'guest_' + Date.now()
      })
    });

    if (!response.ok) {
      throw new Error('Network response was not ok');
    }

    const data = await response.json();
    
    if (!data.success) {
      throw new Error('AI analysis failed');
    }

    return {
      analysis: data.analysis,
      summary: data.summary,
      tarotReader: data.tarotReader,
      readingId: data.readingId,
      isAI: true,
      timestamp: data.timestamp
    };

  } catch (error) {
    console.error('AI Reading Error:', error);
    
    // Фолбэк на локальную генерацию
    return generateLocalReading(spread, cards, question);
  }
}

// ===== ЛОКАЛЬНАЯ ГЕНЕРАЦИЯ (ЗАПАСНОЙ ВАРИАНТ) =====
function generateLocalReading(spread, cards, question) {
  const reader = TAROT_READERS[Math.floor(Math.random() * TAROT_READERS.length)];
  
  let analysis = `${reader.emoji} Привет! Я ${reader.name}. `;
  
  if (question) {
    analysis += `Ваш вопрос "${question}" очень важен. Давайте разберём его через карты.\n\n`;
  } else {
    analysis += `Давайте посмотрим, что карты расскажут о вашей ситуации.\n\n`;
  }
  
  // Анализ каждой карты
  cards.forEach((card, index) => {
    analysis += `Карта ${index + 1}: ${card.name}\n`;
    analysis += `${getCardInsight(card, index)}\n\n`;
  });
  
  // Общий анализ
  analysis += `🌿 Общая энергетика:\n`;
  analysis += `${getOverallReading(cards)}\n\n`;
  
  // Совет
  analysis += `💫 Мой совет:\n`;
  analysis += `${getPersonalAdvice(cards, reader)}\n\n`;
  
  // Подпись
  analysis += `С уважением,\n${reader.name}\nТаролог, специализация: ${reader.specialty}`;
  
  return {
    analysis,
    summary: getQuickSummary(cards),
    tarotReader: reader,
    readingId: 'local_' + Date.now(),
    isAI: false,
    timestamp: new Date().toISOString()
  };
}

// Вспомогательные функции для локальной генерации
function getCardInsight(card, position) {
  const insights = [
    `В этой позиции ${card.name} говорит о ${card.keyword.toLowerCase()}. ${getRandomObservation()}`,
    `Мне часто встречалась эта карта, когда клиенты переживали ${getRandomSituation()}.`,
    `Интересно, что именно ${card.name} выпала здесь... Это может указывать на ${getRandomMeaning()}.`,
    `По моему опыту, ${card.name} в такой позиции часто предвещает ${getRandomOutcome()}.`
  ];
  
  return insights[Math.floor(Math.random() * insights.length)];
}

function getRandomObservation() {
  const observations = [
    'Обратите внимание на детали.',
    'Важно не упустить момент.',
    'Это время для внутренней работы.',
    'Ситуация требует терпения.',
    'Доверьтесь процессу.'
  ];
  return observations[Math.floor(Math.random() * observations.length)];
}

function getRandomSituation() {
  const situations = [
    'периоды перемен',
    'важные решения',
    'эмоциональные подъёмы',
    'моменты выбора',
    'духовные поиски'
  ];
  return situations[Math.floor(Math.random() * situations.length)];
}

function getRandomMeaning() {
  const meanings = [
    'скрытые возможности',
    'невысказанные чувства',
    'внутренние ресурсы',
    'важные уроки',
    'кармические связи'
  ];
  return meanings[Math.floor(Math.random() * meanings.length)];
}

function getRandomOutcome() {
  const outcomes = [
    'новые знакомства',
    'финансовые изменения',
    'творческий подъём',
    'душевное равновесие',
    'ясность в отношениях'
  ];
  return outcomes[Math.floor(Math.random() * outcomes.length)];
}

function getOverallReading(cards) {
  const majorCount = cards.filter(c => c.suit === 'major').length;
  const cupsCount = cards.filter(c => c.suit === 'cups').length;
  const swordsCount = cards.filter(c => c.suit === 'swords').length;
  
  if (majorCount > cards.length / 2) {
    return 'Сильное влияние Старших Арканов — это период судьбоносных перемен и важных жизненных уроков.';
  } else if (cupsCount > swordsCount) {
    return 'Расклад с акцентом на эмоции и отношения. Чувства играют ключевую роль.';
  } else if (swordsCount > cupsCount) {
    return 'Ментальная энергия преобладает. Важно анализировать, а не действовать импульсивно.';
  } else {
    return 'Сбалансированная энергия. Есть и вызовы, и ресурсы для их преодоления.';
  }
}

function getPersonalAdvice(cards, reader) {
  const advices = [
    `Как специалист по ${reader.specialty}, советую: ${getRandomPracticalAdvice()}`,
    `Из моего опыта: ${getRandomExperience()}`,
    `Клиенты часто спрашивают, что делать в таких ситуациях. Мой ответ: ${getRandomGuidance()}`,
    `Запомните: ${getRandomWisdom()}`
  ];
  
  return advices[Math.floor(Math.random() * advices.length)];
}

function getRandomPracticalAdvice() {
  const advices = [
    'выделите время для самоанализа в течение недели',
    'ведите дневник наблюдений за знаками',
    'обсудите ситуацию с тем, кому доверяете',
    'не торопитесь с выводами',
    'практикуйте медитацию для ясности'
  ];
  return advices[Math.floor(Math.random() * advices.length)];
}

function getRandomExperience() {
  const experiences = [
    'самые важные прозрения приходят в тишине',
    'карты показывают тенденции, но выбор всегда за вами',
    'доверие к себе — лучший советчик',
    'все события взаимосвязаны',
    'каждый расклад уникален, как и человек'
  ];
  return experiences[Math.floor(Math.random() * experiences.length)];
}

function getRandomGuidance() {
  const guidance = [
    'слушайте своё сердце, но проверяйте факты',
    'делайте маленькие шаги каждый день',
    'обращайте внимание на повторяющиеся знаки',
    'не бойтесь просить о помощи',
    'цените то, что уже есть'
  ];
  return guidance[Math.floor(Math.random() * guidance.length)];
}

function getRandomWisdom() {
  const wisdom = [
    'всё происходит вовремя',
    'каждая карта — это урок',
    'жизнь — это путь, а не пункт назначения',
    'настоящая сила в принятии',
    'любовь — лучший проводник'
  ];
  return wisdom[Math.floor(Math.random() * wisdom.length)];
}

function getQuickSummary(cards) {
  const summaries = [
    'Период роста и трансформации',
    'Время для важных решений',
    'Эмоциональное обновление',
    'Практические шаги к цели',
    'Духовные прозрения',
    'Гармония в отношениях',
    'Творческая реализация'
  ];
  return summaries[Math.floor(Math.random() * summaries.length)];
}

// ===== ФУНКЦИЯ ДЛЯ АНИМАЦИИ "ДУМАЕТ" =====
function showThinkingAnimation(message = 'Таролог обдумывает ваш вопрос...') {
  const modal = $('#card-modal');
  const body = $('#card-modal-body');
  if (!modal || !body) return;

  body.innerHTML = `
    <div style="text-align: center; padding: 50px 20px;">
      <div style="width: 100px; height: 100px; margin: 0 auto 30px; position: relative;">
        <div class="crystal-ball">
          <div class="inner-glow"></div>
          <i class="fas fa-crystal-ball"></i>
        </div>
        <div class="spark spark-1"></div>
        <div class="spark spark-2"></div>
        <div class="spark spark-3"></div>
      </div>
      
      <h3 style="font-size: 22px; color: var(--primary); margin-bottom: 15px; font-family: 'Playfair Display', serif;">
        ${message}
      </h3>
      
      <p style="color: var(--text-light); margin-bottom: 30px; font-size: 14px; max-width: 300px; margin-left: auto; margin-right: auto;">
        Карты раскладываются, звёзды выстраиваются в узор...
        Это займёт всего несколько секунд.
      </p>
      
      <div class="thinking-indicator">
        <div class="dot"></div>
        <div class="dot"></div>
        <div class="dot"></div>
      </div>
      
      <div style="margin-top: 40px; font-size: 12px; color: var(--text-light); font-style: italic;">
        <i class="fas fa-user-circle"></i> Выбран таролог: загружается...
      </div>
    </div>
  `;

  // Добавляем стили для анимации
  const style = document.createElement('style');
  style.textContent = `
    .crystal-ball {
      width: 100px;
      height: 100px;
      background: linear-gradient(135deg, var(--primary), var(--secondary));
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 40px;
      position: relative;
      animation: float 3s ease-in-out infinite;
      box-shadow: 0 10px 30px rgba(138, 43, 226, 0.3);
    }
    
    .inner-glow {
      position: absolute;
      width: 70px;
      height: 70px;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(255,255,255,0.3), transparent 70%);
      animation: pulse 2s ease-in-out infinite;
    }
    
    .spark {
      position: absolute;
      width: 8px;
      height: 8px;
      background: var(--accent);
      border-radius: 50%;
      animation: sparkle 1.5s ease-in-out infinite;
    }
    
    .spark-1 { top: 20px; left: 20px; animation-delay: 0s; }
    .spark-2 { top: 40px; right: 20px; animation-delay: 0.5s; }
    .spark-3 { bottom: 20px; left: 50px; animation-delay: 1s; }
    
    .thinking-indicator {
      display: flex;
      justify-content: center;
      gap: 10px;
      margin-top: 20px;
    }
    
    .dot {
      width: 10px;
      height: 10px;
      background: var(--primary);
      border-radius: 50%;
      animation: bounce 1.4s ease-in-out infinite;
    }
    
    .dot:nth-child(1) { animation-delay: -0.32s; }
    .dot:nth-child(2) { animation-delay: -0.16s; }
    
    @keyframes float {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-10px); }
    }
    
    @keyframes pulse {
      0%, 100% { transform: scale(1); opacity: 0.5; }
      50% { transform: scale(1.1); opacity: 0.8; }
    }
    
    @keyframes sparkle {
      0%, 100% { transform: scale(1); opacity: 0; }
      50% { transform: scale(1.3); opacity: 1; }
    }
    
    @keyframes bounce {
      0%, 80%, 100% { transform: scale(0); }
      40% { transform: scale(1); }
    }
  `;
  document.head.appendChild(style);

  openModal(modal);
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

// Глобальные функции для модалок
window.showCardModalById = function (cardId) {
  const card = window.TAROT_CARDS.find(c => c.id === cardId);
  if (card) showCardModal(card, { mode: 'deck' });
};

window.showCardDayModalById = function (cardId) {
  const card = window.TAROT_CARDS.find(c => c.id === cardId);
  if (card) showCardModal(card, { mode: 'day' });
};

// Модалка карты
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

// ===== РАСКЛАДЫ =====
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

// Модалка вопроса для расклада
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

// Основная функция выполнения расклада
async function performSpread(spread, question = '') {
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
      image: card.image,
      category: card.category,
      suit: card.suit
    });
  }

  // Получаем ИИ-трактовку
  const reading = await getAITarotReading(spread, used, question);

  return {
    type: 'spread',
    spreadId: spread.id,
    title: spread.title,
    createdAt: new Date().toISOString(),
    cards: used,
    analysis: reading.analysis,
    summary: reading.summary,
    tarotReader: reading.tarotReader,
    readingId: reading.readingId,
    question: question || '',
    isAI: reading.isAI
  };
}

// Показать результат расклада
function showSpreadResultModal(result) {
  const modal = $('#card-modal');
  const body = $('#card-modal-body');
  if (!modal || !body) return;

  const dateStr = new Date(result.createdAt).toLocaleString('ru-RU', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const reader = result.tarotReader || { name: 'Таролог', emoji: '🔮', specialty: 'работа с картами' };
  
  const cardsHtml = (result.cards || [])
    .map(
      (card, index) => `
    <div class="spread-card-item" style="animation-delay: ${index * 0.1}s;">
      <div class="spread-card-number">${index + 1}</div>
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
    ).join('');

  body.innerHTML = `
    <div style="text-align:left;">
      <!-- Шапка с информацией о тарологе -->
      <div style="background: linear-gradient(135deg, var(--primary), var(--primary-dark)); color: white; padding: 25px; border-radius: 16px 16px 0 0; margin-bottom: 20px;">
        <div style="display: flex; align-items: center; gap: 20px; margin-bottom: 15px;">
          <div style="width: 60px; height: 60px; background: rgba(255,255,255,0.2); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 28px;">
            ${reader.emoji}
          </div>
          <div>
            <h3 style="margin: 0 0 5px 0; font-size: 22px; font-family: 'Playfair Display', serif;">Консультация с тарологом</h3>
            <div style="font-size: 16px; opacity: 0.9;">${reader.name}</div>
            <div style="font-size: 14px; opacity: 0.7;">${reader.specialty}</div>
          </div>
        </div>
        <div style="font-size: 14px; opacity: 0.8;">
          <i class="fas fa-calendar-alt"></i> ${dateStr}
          ${result.question ? `<br><i class="fas fa-question-circle"></i> <strong>Ваш вопрос:</strong> "${result.question}"` : ''}
          ${result.readingId ? `<br><i class="fas fa-fingerprint"></i> ID: ${result.readingId}` : ''}
        </div>
      </div>

      <!-- Карты -->
      <div style="padding: 0 20px;">
        <div style="font-size: 16px; font-weight: 600; color: var(--primary); margin-bottom: 15px; display: flex; align-items: center; gap: 10px;">
          <i class="fas fa-layer-group"></i> Карты в раскладе (${result.cards.length})
        </div>
        
        <div style="max-height: 250px; overflow-y: auto; margin-bottom: 25px; padding-right: 10px;">
          ${cardsHtml}
        </div>
      </div>

      <!-- Анализ -->
      <div style="background: rgba(248, 245, 255, 0.9); border-radius: 16px; padding: 25px; margin: 20px; border: 1px solid rgba(138, 43, 226, 0.1); box-shadow: 0 5px 20px rgba(0,0,0,0.05);">
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 2px solid rgba(138, 43, 226, 0.1);">
          <div style="width: 40px; height: 40px; background: var(--primary); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-size: 18px;">
            <i class="fas fa-comment-dots"></i>
          </div>
          <h4 style="margin: 0; font-size: 18px; color: var(--primary);">Трактовка расклада</h4>
        </div>
        
        <div style="font-size: 15px; line-height: 1.7; color: var(--text); white-space: pre-line; font-family: 'Georgia', serif; min-height: 200px;">
          ${result.analysis || result.summary || ''}
        </div>
        
        <!-- Подпись таролога -->
        <div style="margin-top: 25px; padding-top: 20px; border-top: 1px dashed rgba(138, 43, 226, 0.2); text-align: right;">
          <div style="font-size: 14px; color: var(--text-light); font-style: italic;">
            С уважением,<br>
            <strong style="color: var(--primary); font-size: 16px;">${reader.name}</strong><br>
            <span style="font-size: 13px;">Таролог • ${reader.specialty}</span>
          </div>
        </div>
      </div>

      <!-- Краткое резюме -->
      ${result.summary ? `
      <div style="background: rgba(0, 206, 209, 0.1); border-radius: 12px; padding: 15px; margin: 20px; border-left: 4px solid var(--secondary);">
        <div style="display: flex; align-items: flex-start; gap: 12px;">
          <div style="width: 32px; height: 32px; background: var(--secondary); border-radius: 8px; display: flex; align-items: center; justify-content: center; color: white; font-size: 14px; flex-shrink: 0;">
            <i class="fas fa-sparkles"></i>
          </div>
          <div>
            <div style="font-size: 12px; color: var(--secondary); font-weight: 600; margin-bottom: 5px;">Ключевой инсайт</div>
            <div style="font-size: 14px; color: var(--text); font-weight: 500;">${result.summary}</div>
          </div>
        </div>
      </div>
      ` : ''}

      <!-- Сохранено в архив -->
      <div style="text-align: center; padding: 15px 20px; background: rgba(138, 43, 226, 0.05); border-radius: 0 0 16px 16px; margin-top: 20px;">
        <div style="font-size: 12px; color: var(--text-light); display: flex; align-items: center; justify-content: center; gap: 8px;">
          <i class="fas fa-archive"></i>
          Сохранено в архив • Консультация завершена
          ${result.isAI === false ? ' • <span style="color: var(--warning);">Локальная трактовка</span>' : ''}
        </div>
      </div>
    </div>
  `;

  // Добавляем стили для анимации карт
  const style = document.createElement('style');
  style.textContent = `
    .spread-card-item {
      animation: fadeInUp 0.5s ease-out forwards;
      opacity: 0;
    }
    
    @keyframes fadeInUp {
      from {
        opacity: 0;
        transform: translateY(10px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
    
    .spread-card-number {
      position: absolute;
      top: -8px;
      left: -8px;
      width: 24px;
      height: 24px;
      background: var(--primary);
      color: white;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      font-weight: bold;
      z-index: 2;
      box-shadow: 0 2px 8px rgba(138, 43, 226, 0.3);
    }
  `;
  document.head.appendChild(style);

  openModal(modal);
}

// ===== КОЛОДА С ПАГИНАЦИЕЙ =====
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

// ===== СПРОСИТЬ ВСЕЛЕННУЮ =====
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

// ===== ДА-НЕТ =====
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

// ===== ЗАДАТЬ ВОПРОС ВСЕЛЕННОЙ =====
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

  // Показываем анимацию "таролог думает"
  showThinkingAnimation('Вселенная слушает ваш вопрос...');

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

// ===== АРХИВ =====
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

// ===== ЗАГРУЗКА/СОХРАНЕНИЕ СОСТОЯНИЯ =====
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

// ===== ЗАПУСК =====
document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 TARO запускается...');
  initApp();
});
