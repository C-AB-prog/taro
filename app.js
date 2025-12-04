// ===== ОСНОВНОЙ ФУНКЦИОНАЛ =====

// Утилиты
const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));

// Состояние приложения
const AppState = {
  user: null,
  currentCard: null,
  savedCards: [],
  isLoading: false,
  userStars: 100, // Начальные звёзды
  questionType: 'love'
};

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

// ===== ОСНОВНЫЕ ФУНКЦИИ =====

// Инициализация
async function initApp() {
  showLoader();
  
  try {
    // Инициализация Telegram
    initTelegram();
    
    // Запуск анимаций
    window.mysticAnimations = new MysticAnimations();
    
    // Загрузка данных
    loadUserData();
    
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
        username: user.username
      };
    }
  }
  
  // Для дебага
  if (!AppState.user) {
    AppState.user = { name: 'Дмитрий', username: 'dmitry_tarot' };
  }
}

// Загрузка карты дня
async function loadCardOfDay() {
  const container = $('#card-day-content');
  if (!container || !window.TAROT_CARDS?.length) return;
  
  // Выбираем карту на основе дня
  const today = new Date().getDate();
  const cardIndex = today % Math.min(window.TAROT_CARDS.length, 12);
  const card = window.TAROT_CARDS[cardIndex];
  
  if (!card) return;
  
  AppState.currentCard = card;
  
  // Создаём HTML
  container.innerHTML = `
    <div class="card-display">
      <div class="card-image-container">
        <img src="${card.image}" 
             alt="${card.name}" 
             class="card-image"
             onload="this.classList.add('loaded')"
             onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjYwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjN0E0N0ZGIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIyNCIgZmlsbD0id2hpdGUiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIwLjNlbSI+JHtjYXJkLm5hbWV9PC90ZXh0Pjwvc3ZnPg=='">
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

// Колесо фортуны
function initFortuneWheel() {
  const wheel = $('#fortune-wheel');
  const spinBtn = $('#spin-wheel-btn');
  const resultEl = $('#wheel-result');
  
  if (!wheel || !spinBtn || !resultEl) return;
  
  const fortunes = [
    { text: '🎯 Удача сегодня с тобой! Получите +10 звёзд', stars: 10 },
    { text: '✨ Новые возможности ждут. Получите +5 звёзд', stars: 5 },
    { text: '⚡ Время действовать! Получите +7 звёзд', stars: 7 },
    { text: '💖 Гармония в отношениях. Получите +8 звёзд', stars: 8 },
    { text: '🎨 Творческий подъём. Получите +6 звёзд', stars: 6 },
    { text: '💘 Любовь и страсть. Получите +9 звёзд', stars: 9 },
    { text: '💰 Финансовый рост. Получите +12 звёзд', stars: 12 },
    { text: '🌙 Духовное пробуждение. Получите +4 звёзд', stars: 4 },
    { text: '🚀 Путешествие к мечте. Получите +11 звёзд', stars: 11 },
    { text: '💪 Сила и уверенность. Получите +8 звёзд', stars: 8 },
    { text: '🌀 Перемены к лучшему. Получите +6 звёзд', stars: 6 },
    { text: '🌟 Исполнение желаний. Получите +15 звёзд', stars: 15 }
  ];
  
  // Создаём секции колеса
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
  
  spinBtn.addEventListener('click', async () => {
    if (wheel.classList.contains('spinning')) return;
    
    // Проверка баланса
    if (AppState.userStars < 5) {
      showToast('Недостаточно звёзд. Минимум 5 ★', 'error');
      return;
    }
    
    // Списание звёзд
    AppState.userStars -= 5;
    updateStarsDisplay();
    
    // Блокируем кнопку
    wheel.classList.add('spinning');
    spinBtn.disabled = true;
    spinBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i><span>Крутится...</span>';
    resultEl.textContent = 'Колесо вращается...';
    
    // Анимация вращения
    const spins = 5 + Math.floor(Math.random() * 4);
    const extraDegrees = Math.floor(Math.random() * 360);
    const totalRotation = spins * 360 + extraDegrees;
    
    wheel.style.transition = 'transform 3s cubic-bezier(0.2, 0.8, 0.3, 1)';
    wheel.style.transform = `rotate(${totalRotation}deg)`;
    
    // После вращения
    setTimeout(() => {
      wheel.classList.remove('spinning');
      spinBtn.disabled = false;
      spinBtn.innerHTML = '<i class="fas fa-play"></i><span>Крутить колесо (★ 5)</span>';
      
      // Определяем результат
      const normalizedRotation = extraDegrees % 360;
      const sectionIndex = Math.floor(normalizedRotation / 30);
      const fortune = fortunes[sectionIndex];
      
      // Показываем результат
      resultEl.innerHTML = `
        <div style="text-align: center;">
          <div style="font-size: 24px; margin-bottom: 8px;">${fortune.text.split('.')[0]}</div>
          <div style="color: var(--gold); font-weight: 700; font-size: 20px;">
            +${fortune.stars} ★
          </div>
        </div>
      `;
      
      // Начисляем звёзды
      AppState.userStars += fortune.stars;
      updateStarsDisplay();
      
      // Сохраняем
      saveUserData();
      
      // Показываем тост
      showToast(`🎉 Вы выиграли +${fortune.stars} звёзд!`, 'success');
      
    }, 3000);
  });
}

// Инициализация раскладов
function initSpreads() {
  const container = $('#spreads-grid');
  if (!container) return;
  
  const spreads = [
    {
      id: 'daily-3',
      title: 'Расклад на день',
      description: 'Утро, день, вечер — что ждёт вас сегодня',
      price: 29,
      cards: 3,
      time: '5-10 мин'
    },
    {
      id: 'love-4',
      title: 'Расклад на отношения',
      description: 'Полный анализ любовной ситуации',
      price: 57,
      cards: 4,
      time: '15-20 мин'
    },
    {
      id: 'career-path',
      title: 'Путь карьеры',
      description: 'Анализ профессионального развития',
      price: 43,
      cards: 5,
      time: '12-15 мин'
    },
    {
      id: 'yes-no',
      title: 'Да/Нет + объяснение',
      description: 'Прямой ответ с детальным объяснением',
      price: 15,
      cards: 1,
      time: '3-5 мин'
    },
    {
      id: 'celtic-cross',
      title: 'Кельтский крест',
      description: 'Классический расклад на 10 карт',
      price: 100,
      cards: 10,
      time: '30-40 мин'
    },
    {
      id: 'money-flow',
      title: 'Денежный поток',
      description: 'Анализ финансовой ситуации',
      price: 72,
      cards: 6,
      time: '20-25 мин'
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
        <span><i class="fas fa-cards"></i> ${spread.cards} карт</span>
        <span><i class="fas fa-clock"></i> ${spread.time}</span>
      </div>
    </div>
  `).join('');
  
  // Обработка кликов на расклады
  $$('.spread-item').forEach(item => {
    item.addEventListener('click', function() {
      const price = parseInt(this.querySelector('.spread-price').textContent);
      const title = this.querySelector('.spread-title').textContent;
      
      if (AppState.userStars >= price) {
        if (confirm(`Купить расклад "${title}" за ${price} ★?`)) {
          AppState.userStars -= price;
          updateStarsDisplay();
          saveUserData();
          showToast(`Расклад "${title}" куплен!`, 'success');
        }
      } else {
        showToast(`Недостаточно звёзд. Нужно ${price} ★`, 'error');
      }
    });
  });
}

// Инициализация колоды
function initDeck() {
  const container = $('#deck-grid');
  if (!container || !window.TAROT_CARDS?.length) return;
  
  // Берём только первые 12 карт
  const cards = window.TAROT_CARDS.slice(0, 12);
  
  container.innerHTML = cards.map((card, index) => `
    <div class="deck-card" data-id="${card.id}" style="--card-index: ${index};">
      <img src="${card.image}" 
           alt="${card.name}" 
           class="deck-card-image"
           onload="this.classList.add('loaded')"
           onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjQ1MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjN0E0N0ZGIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIyMCIgZmlsbD0id2hpdGUiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIwLjNlbSI+JHtjYXJkLm5hbWV9PC90ZXh0Pjwvc3ZnPg=='">
      <div class="deck-card-info">
        <div class="deck-card-name">${card.name}</div>
        <div class="deck-card-roman">${card.roman || ''}</div>
      </div>
    </div>
  `).join('');
  
  // Обработка кликов на карты колоды
  $$('.deck-card').forEach(card => {
    card.addEventListener('click', function() {
      const cardId = parseInt(this.dataset.id);
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
           onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjN0E0N0ZGIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIyNCIgZmlsbD0id2hpdGUiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIwLjNlbSI+JHtjYXJkLm5hbWV9PC90ZXh0Pjwvc3ZnPg=='">
      <h3 style="font-size: 24px; color: var(--primary); margin-bottom: 8px;">${card.name}</h3>
      ${card.roman ? `<div style="color: var(--text-light); font-size: 16px; margin-bottom: 12px;">${card.roman}</div>` : ''}
      <div style="background: var(--primary); color: white; padding: 8px 16px; border-radius: 20px; display: inline-block; margin-bottom: 16px;">
        ${card.keyword || ''}
      </div>
      <p style="color: var(--text); line-height: 1.6; margin-bottom: 20px;">${card.description || ''}</p>
    </div>
  `;
  
  modal.classList.add('active');
  
  // Закрытие модалки
  const closeBtn = modal.querySelector('.modal-close');
  if (closeBtn) {
    closeBtn.onclick = () => modal.classList.remove('active');
  }
  
  // Закрытие по клику на фон
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
  
  // Открытие модалки вопроса
  $('#question-btn')?.addEventListener('click', () => {
    openQuestionModal();
  });
  
  // Обработка типов вопросов
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
  
  // Другие действия
  $('#daily-spread-btn')?.addEventListener('click', () => {
    showToast('Функция в разработке', 'info');
  });
  
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
  
  // Закрытие
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

// Задать вопрос
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
  
  // Проверка баланса
  const price = 15;
  if (AppState.userStars < price) {
    showToast(`Недостаточно звёзд. Нужно ${price} ★`, 'error');
    return;
  }
  
  // Списание звёзд
  AppState.userStars -= price;
  updateStarsDisplay();
  saveUserData();
  
  // Закрываем модалку
  $('#question-modal').classList.remove('active');
  
  // Показываем анимацию загрузки
  showToast('🌀 Вселенная слышит ваш вопрос...', 'info');
  
  // Имитация обработки
  setTimeout(() => {
    const answers = {
      love: [
        '❤️ Сердце говорит "да", но будьте осторожны',
        '💔 Сейчас не время для любви',
        '💕 Ваша вторая половинка рядом',
        '🔥 Страсть ждёт вас впереди'
      ],
      career: [
        '💼 Новые возможности на подходе',
        '📈 Карьерный рост неизбежен',
        '🤝 Коллеги поддержат ваши идеи',
        '💡 Инвестируйте в обучение'
      ],
      future: [
        '🔮 Яркие перемены на горизонте',
        '🌈 После дождя всегда выходит солнце',
        '⭐ Ваши мечты скоро сбудутся',
        '🌀 Судьба готовит сюрприз'
      ],
      decision: [
        '⚖️ Выберите путь сердца',
        '🧭 Доверьтесь интуиции',
        '🔄 Дайте ситуации время',
        '🎯 Действуйте смело'
      ]
    };
    
    const typeAnswers = answers[AppState.questionType] || answers.love;
    const randomAnswer = typeAnswers[Math.floor(Math.random() * typeAnswers.length)];
    
    // Показываем ответ в отдельном модальном окне
    showAnswerModal(question, randomAnswer);
    
    // Очищаем поле
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
        <i class="fas fa-lightbulb"></i> Совет: доверяйте своей интуиции
      </div>
    </div>
  `;
  
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

// Навигация
function initNavigation() {
  $$('.nav-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const screen = this.dataset.screen;
      
      // Убираем активный класс
      $$('.nav-btn').forEach(b => b.classList.remove('active'));
      $$('.screen').forEach(s => s.classList.remove('active'));
      
      // Добавляем текущему
      this.classList.add('active');
      
      // Показываем экран
      $(`#${screen}-screen`).classList.add('active');
    });
  });
}

// Обновление отображения звёзд
function updateStarsDisplay() {
  // Можно добавить отображение звёзд в хедере
  console.log('Баланс звёзд:', AppState.userStars);
}

// Загрузка данных пользователя
function loadUserData() {
  const saved = localStorage.getItem('tarot_user_data');
  if (saved) {
    try {
      const data = JSON.parse(saved);
      AppState.userStars = data.stars || 100;
      AppState.savedCards = data.savedCards || [];
    } catch (e) {
      console.error('Ошибка загрузки данных:', e);
    }
  }
}

// Сохранение данных пользователя
function saveUserData() {
  const data = {
    stars: AppState.userStars,
    savedCards: AppState.savedCards
  };
  
  try {
    localStorage.setItem('tarot_user_data', JSON.stringify(data));
  } catch (e) {
    console.error('Ошибка сохранения данных:', e);
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
  console.log('🚀 TARO ГИПНОЗ запускается...');
  initApp();
});
