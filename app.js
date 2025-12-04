// ===== ОСНОВНОЙ ФУНКЦИОНАЛ =====

const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));

// Состояние приложения
const AppState = {
  user: null,
  userId: null,
  currentCard: null,
  canSpinWheel: true,
  lastSpinDate: null
};

// ===== ИНИЦИАЛИЗАЦИЯ =====
async function initApp() {
  showLoader();
  
  try {
    // Инициализация Telegram
    await initTelegram();
    
    // Проверяем колесо фортуны
    checkWheelStatus();
    
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
    
  } catch (error) {
    console.error('Ошибка инициализации:', error);
    showToast('Ошибка загрузки приложения', 'error');
  } finally {
    hideLoader();
  }
}

// Инициализация Telegram
async function initTelegram() {
  let userId = 'anonymous';
  
  if (window.Telegram?.WebApp) {
    const tg = window.Telegram.WebApp;
    tg.ready();
    tg.expand();
    
    const user = tg.initDataUnsafe?.user;
    if (user) {
      userId = `tg${user.id}`;
      AppState.user = {
        id: user.id,
        name: user.first_name || 'Пользователь',
        username: user.username
      };
    }
  }
  
  // Для дебага
  if (!AppState.user) {
    AppState.user = { 
      id: 'debug123', 
      name: 'Дмитрий', 
      username: 'dmitry_tarot' 
    };
    userId = 'debug123';
  }
  
  AppState.userId = userId;
}

// Проверка статуса колеса
function checkWheelStatus() {
  const lastSpin = localStorage.getItem(`tarot_last_spin_${AppState.userId}`);
  const today = new Date().toISOString().split('T')[0];
  
  AppState.lastSpinDate = lastSpin;
  AppState.canSpinWheel = lastSpin !== today;
}

// Загрузка карты дня (ПОЛНАЯ ВЕРСИЯ)
async function loadCardOfDay() {
  const container = $('#card-day-content');
  if (!container || !window.TAROT_CARDS?.length) return;
  
  // Выбираем карту на основе дня и пользователя
  const today = new Date().getDate();
  const seed = `${AppState.userId}-${today}`;
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i);
    hash |= 0;
  }
  
  const cardIndex = Math.abs(hash) % Math.min(window.TAROT_CARDS.length, 12);
  const card = window.TAROT_CARDS[cardIndex];
  
  if (!card) return;
  
  AppState.currentCard = card;
  
  // Создаём полную версию HTML
  container.innerHTML = `
    <div class="card-display">
      <div class="card-image-container">
        <img src="${card.image}" 
             alt="${card.name}" 
             class="card-image"
             onload="this.classList.add('loaded')"
             onerror="this.onerror=null; this.src='data:image/svg+xml;base64,${btoa(`
               <svg width="400" height="600" xmlns="http://www.w3.org/2000/svg">
                 <rect width="100%" height="100%" fill="#8A2BE2"/>
                 <text x="50%" y="50%" font-family="Arial" font-size="24" fill="white" 
                       text-anchor="middle" dy="0.3em">${card.name}</text>
               </svg>
             `)}'">
      </div>
      
      <div class="card-details">
        <div class="card-header">
          <div class="card-name-row">
            <h1 class="card-name">${card.name}</h1>
            ${card.roman ? `<div class="card-roman">${card.roman}</div>` : ''}
          </div>
          <div class="card-keyword">${card.keyword || ''}</div>
        </div>
        
        <div class="card-description-full">
          <h3><i class="fas fa-info-circle"></i> Значение карты</h3>
          <p>${card.description || 'Описание карты'}</p>
        </div>
        
        <div class="card-meta">
          <div class="meta-item">
            <i class="fas fa-calendar-star"></i>
            <span>${formatDate(new Date())}</span>
          </div>
          <div class="meta-item">
            <i class="fas fa-user-circle"></i>
            <span>Персонально для ${AppState.user.name}</span>
          </div>
        </div>
      </div>
    </div>
  `;
}

// Колесо фортуны (1 раз в сутки, бесплатно, даёт случайную карту)
function initFortuneWheel() {
  const wheel = $('#fortune-wheel');
  const spinBtn = $('#spin-wheel-btn');
  const resultEl = $('#wheel-result');
  
  if (!wheel || !spinBtn || !resultEl) return;
  
  updateWheelButton();
  
  spinBtn.addEventListener('click', async () => {
    if (!AppState.canSpinWheel) {
      showToast('Вы уже крутили колесо сегодня. Приходите завтра!', 'info');
      return;
    }
    
    // Блокируем кнопку
    spinBtn.disabled = true;
    spinBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i><span>Крутится...</span>';
    resultEl.innerHTML = '<div class="spinning-text">🌀 Вселенная выбирает карту...</div>';
    
    // Анимация вращения
    const spins = 5 + Math.floor(Math.random() * 4);
    const extraDegrees = Math.floor(Math.random() * 360);
    const totalRotation = spins * 360 + extraDegrees;
    
    wheel.style.transition = 'transform 3s cubic-bezier(0.2, 0.8, 0.3, 1)';
    wheel.style.transform = `rotate(${totalRotation}deg)`;
    
    // После вращения выбираем случайную карту
    setTimeout(() => {
      // Выбираем случайную карту из колоды
      const randomCard = window.TAROT_CARDS[Math.floor(Math.random() * Math.min(window.TAROT_CARDS.length, 12))];
      
      if (randomCard) {
        // Сохраняем дату последнего кручения
        const today = new Date().toISOString().split('T')[0];
        localStorage.setItem(`tarot_last_spin_${AppState.userId}`, today);
        
        // Обновляем статус колеса
        AppState.canSpinWheel = false;
        AppState.lastSpinDate = today;
        updateWheelButton();
        
        // Показываем результат
        resultEl.innerHTML = `
          <div class="wheel-card-result">
            <div class="result-title">🎁 Ваша карта дня от колеса фортуны:</div>
            <div class="result-card">
              <div class="card-preview">
                <img src="${randomCard.image}" alt="${randomCard.name}" 
                     onerror="this.src='data:image/svg+xml;base64,${btoa(`
                       <svg width="100" height="150" xmlns="http://www.w3.org/2000/svg">
                         <rect width="100%" height="100%" fill="#8A2BE2"/>
                         <text x="50%" y="50%" font-family="Arial" font-size="14" fill="white" 
                               text-anchor="middle" dy="0.3em">${randomCard.name}</text>
                       </svg>
                     `)}'">
              </div>
              <div class="card-info">
                <div class="card-name">${randomCard.name}</div>
                <div class="card-keyword">${randomCard.keyword || ''}</div>
                <button class="view-details-btn" data-id="${randomCard.id}">
                  <i class="fas fa-eye"></i> Посмотреть значение
                </button>
              </div>
            </div>
          </div>
        `;
        
        // Обработка кнопки просмотра деталей
        resultEl.querySelector('.view-details-btn').addEventListener('click', () => {
          showCardModal(randomCard);
        });
        
        showToast(`🎉 Вы получили карту "${randomCard.name}"!`, 'success');
      }
      
      // Сбрасываем колесо
      resetWheel();
      
    }, 3000);
  });
  
  function resetWheel() {
    setTimeout(() => {
      wheel.style.transition = 'none';
      wheel.style.transform = 'rotate(0deg)';
      setTimeout(() => {
        wheel.style.transition = 'transform 3s cubic-bezier(0.2, 0.8, 0.3, 1)';
      }, 50);
      
      spinBtn.disabled = false;
    }, 1000);
  }
  
  function updateWheelButton() {
    const today = new Date().toISOString().split('T')[0];
    const canSpin = AppState.lastSpinDate !== today;
    
    spinBtn.disabled = !canSpin;
    spinBtn.innerHTML = canSpin 
      ? '<i class="fas fa-play"></i><span>Крутить колесо</span>'
      : '<i class="fas fa-check"></i><span>Уже крутили сегодня</span>';
    
    if (!canSpin) {
      spinBtn.style.opacity = '0.7';
    }
  }
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
        <div class="spread-price">★ ${spread.price}</div>
        <div class="spread-title">${spread.title}</div>
      </div>
      <div class="spread-description">${spread.description}</div>
      <div class="spread-meta">
        <span><i class="fas fa-cards"></i> ${spread.cards} карт</span>
        <span><i class="fas fa-clock"></i> ${spread.time}</span>
      </div>
      <button class="buy-spread-btn" data-id="${spread.id}" data-price="${spread.price}">
        Купить
      </button>
    </div>
  `).join('');
  
  // Обработка покупки раскладов
  $$('.buy-spread-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const spreadId = this.dataset.id;
      const price = parseInt(this.dataset.price);
      const spread = spreads.find(s => s.id === spreadId);
      
      if (!spread) return;
      
      // Показываем модалку для оплаты через Telegram Stars
      showStarsPaymentModal(spread, price);
    });
  });
}

// Модалка оплаты Telegram Stars
function showStarsPaymentModal(spread, price) {
  const modal = $('#card-modal');
  const body = $('#card-modal-body');
  
  if (!modal || !body) return;
  
  body.innerHTML = `
    <div style="text-align: center; padding: 20px;">
      <div class="modal-icon">
        <i class="fas fa-stars"></i>
      </div>
      <h3>Оплата через Telegram Stars</h3>
      
      <div style="margin: 24px 0;">
        <div style="font-size: 18px; color: var(--primary); margin-bottom: 8px;">
          ${spread.title}
        </div>
        <div style="font-size: 14px; color: var(--text-light); margin-bottom: 16px;">
          ${spread.description}
        </div>
        <div style="font-size: 32px; color: var(--gold); font-weight: 700;">
          ★ ${price}
        </div>
      </div>
      
      <div style="background: rgba(138, 43, 226, 0.1); padding: 16px; border-radius: 12px; margin-bottom: 24px;">
        <div style="font-size: 14px; color: var(--text);">
          После оплаты вы получите полный расклад с детальным объяснением каждой карты
        </div>
      </div>
      
      <button class="btn-primary" id="confirm-payment" style="width: 100%;">
        <i class="fas fa-bolt"></i>
        <span>Оплатить ★ ${price}</span>
      </button>
      
      <button class="btn-secondary" id="cancel-payment" style="width: 100%; margin-top: 12px;">
        Отмена
      </button>
    </div>
  `;
  
  modal.classList.add('active');
  
  // Подтверждение оплаты
  $('#confirm-payment').addEventListener('click', () => {
    // Здесь будет интеграция с Telegram Stars
    showToast('Интеграция с Telegram Stars в разработке', 'info');
    
    // Временная имитация успешной оплаты
    simulateStarsPayment(spread);
    
    modal.classList.remove('active');
  });
  
  // Отмена
  $('#cancel-payment').addEventListener('click', () => {
    modal.classList.remove('active');
  });
  
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

// Имитация оплаты через Stars
function simulateStarsPayment(spread) {
  // Генерируем карты для расклада
  const selectedCards = [];
  for (let i = 0; i < spread.cards; i++) {
    const randomIndex = Math.floor(Math.random() * Math.min(window.TAROT_CARDS.length, 12));
    selectedCards.push(window.TAROT_CARDS[randomIndex]);
  }
  
  // Сохраняем в localStorage
  const userSpreads = JSON.parse(localStorage.getItem(`tarot_spreads_${AppState.userId}`) || '[]');
  userSpreads.push({
    id: spread.id,
    title: spread.title,
    price: spread.price,
    cards: selectedCards,
    date: new Date().toISOString()
  });
  localStorage.setItem(`tarot_spreads_${AppState.userId}`, JSON.stringify(userSpreads));
  
  // Показываем результат расклада
  showSpreadResult(spread, selectedCards);
  
  showToast(`Расклад "${spread.title}" успешно куплен!`, 'success');
}

// Показать результат расклада
function showSpreadResult(spread, cards) {
  const modal = $('#card-modal');
  const body = $('#card-modal-body');
  
  if (!modal || !body) return;
  
  body.innerHTML = `
    <div class="spread-result">
      <div class="result-header">
        <h3>${spread.title}</h3>
        <div class="spread-price-paid">★ ${spread.price}</div>
      </div>
      
      <div class="spread-description">${spread.description}</div>
      
      <div class="spread-cards">
        ${cards.map((card, index) => `
          <div class="spread-card-item">
            <div class="card-position">Позиция ${index + 1}</div>
            <div class="card-preview-small">
              <img src="${card.image}" alt="${card.name}"
                   onerror="this.src='data:image/svg+xml;base64,${btoa(`
                     <svg width="80" height="120" xmlns="http://www.w3.org/2000/svg">
                       <rect width="100%" height="100%" fill="#8A2BE2"/>
                       <text x="50%" y="50%" font-family="Arial" font-size="12" fill="white" 
                             text-anchor="middle" dy="0.3em">${card.name}</text>
                     </svg>
                   `)}'">
            </div>
            <div class="card-info">
              <div class="card-name">${card.name}</div>
              <div class="card-keyword">${card.keyword || ''}</div>
              <button class="view-card-btn" data-id="${card.id}">
                <i class="fas fa-search"></i>
              </button>
            </div>
          </div>
        `).join('')}
      </div>
      
      <div class="spread-actions">
        <button class="btn-primary" id="save-spread-pdf">
          <i class="fas fa-download"></i> Сохранить
        </button>
        <button class="btn-secondary" id="close-spread-modal">
          Закрыть
        </button>
      </div>
    </div>
  `;
  
  modal.classList.add('active');
  
  // Обработка кнопок просмотра карт
  $$('.view-card-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const cardId = parseInt(this.dataset.id);
      const cardData = window.TAROT_CARDS.find(c => c.id === cardId);
      if (cardData) {
        showCardModal(cardData);
      }
    });
  });
  
  // Сохранение
  $('#save-spread-pdf').addEventListener('click', () => {
    showToast('Функция сохранения в разработке', 'info');
  });
  
  // Закрытие
  $('#close-spread-modal').addEventListener('click', () => {
    modal.classList.remove('active');
  });
  
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
           onerror="this.src='data:image/svg+xml;base64,${btoa(`
             <svg width="300" height="450" xmlns="http://www.w3.org/2000/svg">
               <rect width="100%" height="100%" fill="#8A2BE2"/>
               <text x="50%" y="50%" font-family="Arial" font-size="20" fill="white" 
                     text-anchor="middle" dy="0.3em">${card.name}</text>
             </svg>
           `)}'">
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
           onerror="this.src='data:image/svg+xml;base64,${btoa(`
             <svg width="200" height="300" xmlns="http://www.w3.org/2000/svg">
               <rect width="100%" height="100%" fill="#8A2BE2"/>
               <text x="50%" y="50%" font-family="Arial" font-size="24" fill="white" 
                     text-anchor="middle" dy="0.3em">${card.name}</text>
             </svg>
           `)}'">
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
    const btn = $('#refresh-btn');
    btn.classList.add('refreshing');
    
    await loadCardOfDay();
    showToast('Карта дня обновлена', 'success');
    
    setTimeout(() => {
      btn.classList.remove('refreshing');
    }, 1000);
  });
  
  // Магические действия
  $('#daily-spread-btn')?.addEventListener('click', () => {
    showToast('Откройте раздел "Расклады" для покупки', 'info');
  });
  
  $('#question-btn')?.addEventListener('click', () => {
    openQuestionModal();
  });
  
  $('#tarot-reading')?.addEventListener('click', () => {
    showToast('Откройте раздел "Расклады" для покупки', 'info');
  });
  
  $('#fortune-telling')?.addEventListener('click', () => {
    showToast('Откройте раздел "Расклады" для покупки', 'info');
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
  
  // Обработка типов вопросов
  $$('.question-type').forEach(type => {
    type.addEventListener('click', function() {
      $$('.question-type').forEach(t => t.classList.remove('active'));
      this.classList.add('active');
    });
  });
  
  // Отправка вопроса
  $('#ask-question-btn').addEventListener('click', askQuestion);
  
  // Счётчик символов
  const questionInput = $('#question-input');
  const charCount = $('#char-count');
  
  if (questionInput && charCount) {
    questionInput.addEventListener('input', function() {
      charCount.textContent = this.value.length;
    });
  }
}

// Задать вопрос
function askQuestion() {
  const input = $('#question-input');
  const price = 15;
  
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
  
  // Показываем модалку оплаты
  showStarsPaymentModal({
    id: 'question',
    title: 'Ответ на вопрос',
    description: question.substring(0, 50) + (question.length > 50 ? '...' : ''),
    price: price,
    cards: 1
  }, price);
  
  // Закрываем модалку вопроса
  $('#question-modal').classList.remove('active');
  
  // Очищаем поле
  input.value = '';
  $('#char-count').textContent = '0';
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

// ===== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ =====
function formatDate(date) {
  return date.toLocaleDateString('ru-RU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

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
