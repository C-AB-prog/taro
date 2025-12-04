// ===== ОСНОВНОЙ ФУНКЦИОНАЛ =====

const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));

// Состояние приложения
const AppState = {
  user: null,
  userId: null,
  currentCard: null,
  stars: 100,
  canSpinWheel: true,
  lastSpinDate: null
};

// ===== API ФУНКЦИИ =====
class TarotAPI {
  static baseURL = window.location.hostname === 'localhost' 
    ? 'http://localhost:3000/api'
    : '/api';

  // Получить данные пользователя
  static async getUser(userId) {
    try {
      const response = await fetch(`${this.baseURL}/user/${userId}`);
      return await response.json();
    } catch (error) {
      console.error('API Error:', error);
      return null;
    }
  }

  // Крутить колесо
  static async spinWheel(userId) {
    try {
      const response = await fetch(`${this.baseURL}/user/${userId}/spin-wheel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      return await response.json();
    } catch (error) {
      console.error('Spin wheel error:', error);
      return { success: false, message: 'Ошибка сети' };
    }
  }

  // Сохранить расклад
  static async saveSpread(userId, spreadId, cards, price) {
    try {
      const response = await fetch(`${this.baseURL}/user/${userId}/save-spread`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spreadId, cards, price })
      });
      return await response.json();
    } catch (error) {
      console.error('Save spread error:', error);
      return { success: false };
    }
  }

  // Получить расклады пользователя
  static async getUserSpreads(userId) {
    try {
      const response = await fetch(`${this.baseURL}/user/${userId}/spreads`);
      return await response.json();
    } catch (error) {
      console.error('Get spreads error:', error);
      return [];
    }
  }
}

// ===== ИНИЦИАЛИЗАЦИЯ =====
async function initApp() {
  showLoader();
  
  try {
    // Инициализация Telegram
    await initTelegram();
    
    // Загрузка данных пользователя
    await loadUserData();
    
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
  
  // Загружаем данные из БД
  const userData = await TarotAPI.getUser(userId);
  if (userData) {
    AppState.stars = userData.stars || 100;
    AppState.lastSpinDate = userData.last_spin;
    AppState.canSpinWheel = userData.last_spin !== new Date().toISOString().split('T')[0];
  }
  
  updateStarsDisplay();
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
        <div class="card-image-overlay"></div>
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
          
          ${card.upright ? `
            <div class="meaning-section">
              <h4><i class="fas fa-sun"></i> Прямое положение</h4>
              <p>${card.upright}</p>
            </div>
          ` : ''}
          
          ${card.reversed ? `
            <div class="meaning-section">
              <h4><i class="fas fa-moon"></i> Перевёрнутое положение</h4>
              <p>${card.reversed}</p>
            </div>
          ` : ''}
          
          ${card.advice ? `
            <div class="advice-section">
              <h4><i class="fas fa-lightbulb"></i> Совет карты</h4>
              <p>${card.advice}</p>
            </div>
          ` : ''}
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
  
  // Проверяем, можно ли крутить сегодня
  updateWheelStatus();
  
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
    
    // Сохраняем в БД факт кручения
    const spinResult = await TarotAPI.spinWheel(AppState.userId);
    
    if (!spinResult.success) {
      showToast(spinResult.message || 'Ошибка сохранения', 'error');
      resetWheel();
      return;
    }
    
    // После вращения выбираем случайную карту
    setTimeout(async () => {
      const normalizedRotation = extraDegrees % 360;
      const sectionIndex = Math.floor(normalizedRotation / 30);
      
      // Выбираем случайную карту из колоды
      const randomCard = window.TAROT_CARDS[Math.floor(Math.random() * Math.min(window.TAROT_CARDS.length, 12))];
      
      if (randomCard) {
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
        
        // Обновляем статус колеса
        AppState.canSpinWheel = false;
        AppState.lastSpinDate = new Date().toISOString().split('T')[0];
        updateWheelStatus();
        
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
      spinBtn.innerHTML = '<i class="fas fa-play"></i><span>Крутить колесо</span>';
    }, 1000);
  }
  
  function updateWheelStatus() {
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

// Инициализация раскладов с БД
async function initSpreads() {
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
  
  // Загружаем купленные расклады из БД
  const userSpreads = await TarotAPI.getUserSpreads(AppState.userId);
  
  // Обработка покупки раскладов
  $$('.buy-spread-btn').forEach(btn => {
    btn.addEventListener('click', async function() {
      const spreadId = this.dataset.id;
      const price = parseInt(this.dataset.price);
      const spread = spreads.find(s => s.id === spreadId);
      
      if (!spread) return;
      
      // Проверка баланса
      if (AppState.stars < price) {
        showToast(`Недостаточно звёзд. Нужно ${price} ★`, 'error');
        return;
      }
      
      // Подтверждение покупки
      if (!confirm(`Купить расклад "${spread.title}" за ${price} ★?`)) {
        return;
      }
      
      // Генерируем карты для расклада
      const selectedCards = [];
      for (let i = 0; i < spread.cards; i++) {
        const randomIndex = Math.floor(Math.random() * Math.min(window.TAROT_CARDS.length, 12));
        selectedCards.push(window.TAROT_CARDS[randomIndex]);
      }
      
      // Сохраняем в БД
      const saveResult = await TarotAPI.saveSpread(
        AppState.userId, 
        spreadId, 
        selectedCards, 
        price
      );
      
      if (saveResult.success) {
        // Списание звёзд
        AppState.stars -= price;
        updateStarsDisplay();
        
        // Показываем результат расклада
        showSpreadResult(spread, selectedCards);
        
        showToast(`Расклад "${spread.title}" куплен и сохранён!`, 'success');
      } else {
        showToast('Ошибка сохранения расклада', 'error');
      }
    });
  });
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
          <i class="fas fa-download"></i> Сохранить как PDF
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
  
  // Закрытие модалки
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

// ===== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ =====
function formatDate(date) {
  return date.toLocaleDateString('ru-RU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

function updateStarsDisplay() {
  // Обновляем отображение звёзд в интерфейсе
  const starElements = $$('.stars-count');
  starElements.forEach(el => {
    el.textContent = AppState.stars;
  });
  
  // Сохраняем в localStorage для быстрого доступа
  localStorage.setItem('tarot_stars', AppState.stars);
}

async function loadUserData() {
  // Загружаем звёзды из localStorage
  const savedStars = localStorage.getItem('tarot_stars');
  if (savedStars) {
    AppState.stars = parseInt(savedStars);
  }
}

// ... остальные функции (showCardModal, initDeck, initButtons, initNavigation и т.д.)
// они остаются похожими, но с учётом новых требований

// Запуск приложения
document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 TARO ГИПНОЗ запускается...');
  initApp();
});
