// ===== ОСНОВНОЙ ФУНКЦИОНАЛ + АНИМАЦИИ =====

// Утилиты
const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));

// Состояние приложения
const AppState = {
  user: null,
  currentCard: null,
  savedCards: [],
  isLoading: false
};

// ===== АНИМАЦИИ =====
class MysticAnimations {
  constructor() {
    this.initParticles();
    this.initCardAnimations();
    this.initButtonEffects();
    this.initHoverEffects();
  }

  // Частицы в фоне
  initParticles() {
    const container = $('.particles');
    if (!container) return;

    // Создаём частицы
    for (let i = 0; i < 15; i++) {
      const particle = document.createElement('div');
      particle.style.cssText = `
        position: absolute;
        width: ${2 + Math.random() * 3}px;
        height: ${2 + Math.random() * 3}px;
        background: ${Math.random() > 0.5 ? 'var(--primary)' : 'var(--secondary)'};
        border-radius: 50%;
        top: ${Math.random() * 100}%;
        left: ${Math.random() * 100}%;
        opacity: ${0.1 + Math.random() * 0.2};
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
      const card = e.target.closest('.card-image-container');
      if (card) {
        this.animateCardHover(card);
      }
    });

    // Анимация при уходе
    document.addEventListener('mouseout', (e) => {
      const card = e.target.closest('.card-image-container');
      if (card) {
        this.animateCardLeave(card);
      }
    });
  }

  animateCardHover(card) {
    card.style.transform = 'translateY(-10px) rotateY(5deg)';
    card.style.boxShadow = '0 20px 40px rgba(138, 43, 226, 0.3)';
    
    // Добавляем свечение
    const glow = document.createElement('div');
    glow.className = 'card-glow';
    glow.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: radial-gradient(circle at center, rgba(255,255,255,0.2), transparent 70%);
      border-radius: 16px;
      pointer-events: none;
    `;
    card.appendChild(glow);
  }

  animateCardLeave(card) {
    card.style.transform = 'translateY(0) rotateY(0)';
    card.style.boxShadow = '0 8px 30px rgba(0, 0, 0, 0.15)';
    
    // Убираем свечение
    const glow = card.querySelector('.card-glow');
    if (glow) glow.remove();
  }

  // Эффекты кнопок
  initButtonEffects() {
    const buttons = $$('.mystic-btn, .refresh-btn, .spin-btn, .save-btn');
    
    buttons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.createRippleEffect(e);
      });
      
      btn.addEventListener('mouseenter', () => {
        this.createHoverParticles(btn);
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
      background: rgba(255, 255, 255, 0.4);
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

  createHoverParticles(button) {
    const rect = button.getBoundingClientRect();
    
    for (let i = 0; i < 3; i++) {
      const particle = document.createElement('div');
      
      particle.style.cssText = `
        position: absolute;
        width: 2px;
        height: 2px;
        background: var(--secondary);
        border-radius: 50%;
        left: ${Math.random() * rect.width}px;
        top: ${Math.random() * rect.height}px;
        pointer-events: none;
        animation: particleFloat 1s ease-out forwards;
      `;
      
      button.appendChild(particle);
      setTimeout(() => particle.remove(), 1000);
    }
  }

  // Эффекты наведения
  initHoverEffects() {
    // Наведение на action cards
    $$('.action-card').forEach(card => {
      card.addEventListener('mouseenter', () => {
        card.style.transform = 'translateY(-5px) scale(1.02)';
      });
      
      card.addEventListener('mouseleave', () => {
        card.style.transform = 'translateY(0) scale(1)';
      });
    });
    
    // Наведение на контакты
    $$('.contact-item').forEach(item => {
      item.addEventListener('mouseenter', () => {
        item.style.transform = 'translateX(5px)';
      });
      
      item.addEventListener('mouseleave', () => {
        item.style.transform = 'translateX(0)';
      });
    });
  }
}

// ===== ОСНОВНЫЕ ФУНКЦИИ ПРИЛОЖЕНИЯ =====

// Инициализация
async function initApp() {
  showLoader();
  
  try {
    // Инициализация Telegram
    initTelegram();
    
    // Запуск анимаций
    window.mysticAnimations = new MysticAnimations();
    
    // Загрузка данных пользователя
    loadUserData();
    
    // Загрузка и отображение карты дня
    await loadCardOfDay();
    
    // Инициализация колеса фортуны
    initFortuneWheel();
    
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
  
  if (!wheel || !spinBtn) return;
  
  const fortunes = [
    'Удача сегодня с тобой!',
    'Новые возможности ждут',
    'Время действовать',
    'Гармония в отношениях',
    'Творческий подъём',
    'Любовь и страсть',
    'Финансовый рост',
    'Духовное пробуждение',
    'Путешествие к мечте',
    'Сила и уверенность',
    'Перемены к лучшему',
    'Исполнение желаний'
  ];
  
  spinBtn.addEventListener('click', () => {
    if (wheel.classList.contains('spinning') || spinBtn.disabled) return;
    
    // Блокируем кнопку
    wheel.classList.add('spinning');
    spinBtn.disabled = true;
    spinBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i><span>Крутится...</span>';
    
    // Анимация вращения
    const spins = 5 + Math.random() * 3;
    const extraDegrees = Math.floor(Math.random() * 360);
    const totalRotation = spins * 360 + extraDegrees;
    
    wheel.style.transition = 'transform 4s cubic-bezier(0.2, 0.8, 0.3, 1)';
    wheel.style.transform = `rotate(${totalRotation}deg)`;
    
    // После вращения
    setTimeout(() => {
      wheel.classList.remove('spinning');
      spinBtn.disabled = false;
      spinBtn.innerHTML = '<i class="fas fa-play"></i><span>Крутить колесо</span>';
      
      // Показываем результат
      const normalizedRotation = extraDegrees % 360;
      const sectionIndex = Math.floor(normalizedRotation / 30);
      const fortune = fortunes[sectionIndex];
      
      // Эффект выделения секции
      highlightWheelSection(sectionIndex);
      
      // Показываем тост
      showToast(`🎯 ${fortune}`, 'success');
      
    }, 4000);
  });
}

// Подсветка секции колеса
function highlightWheelSection(index) {
  const wheel = $('#fortune-wheel');
  const colors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
    '#FECA57', '#FF9FF3', '#54A0FF', '#5F27CD',
    '#00D2D3', '#FF9F43', '#EE5A24', '#A3CB38'
  ];
  
  // Временно меняем цвет секции
  const originalBackground = wheel.style.background;
  wheel.style.background = `
    conic-gradient(
      from 0deg,
      ${colors[index]} 0deg 30deg,
      #4ECDC4 30deg 60deg,
      #45B7D1 60deg 90deg,
      #96CEB4 90deg 120deg,
      #FECA57 120deg 150deg,
      #FF9FF3 150deg 180deg,
      #54A0FF 180deg 210deg,
      #5F27CD 210deg 240deg,
      #00D2D3 240deg 270deg,
      #FF9F43 270deg 300deg,
      #EE5A24 300deg 330deg,
      #A3CB38 330deg 360deg
    )
  `;
  
  // Возвращаем через 2 секунды
  setTimeout(() => {
    wheel.style.background = originalBackground;
  }, 2000);
}

// Инициализация кнопок
function initButtons() {
  // Обновление карты
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
  
  // Сохранение карты
  $('#save-card-btn')?.addEventListener('click', () => {
    if (!AppState.currentCard) return;
    
    AppState.savedCards.push({
      ...AppState.currentCard,
      savedAt: new Date().toISOString()
    });
    
    localStorage.setItem('tarot_saved_cards', JSON.stringify(AppState.savedCards));
    showToast('Карта сохранена в Кодексе', 'success');
    
    // Анимация кнопки
    const btn = $('#save-card-btn');
    btn.classList.add('saved');
    setTimeout(() => btn.classList.remove('saved'), 1000);
  });
  
  // Магические действия
  $('#daily-spread-btn')?.addEventListener('click', () => {
    showToast('Расклад дня скоро появится!', 'info');
  });
  
  $('#question-btn')?.addEventListener('click', () => {
    const answers = [
      'Да', 'Нет', 'Возможно', 'Спроси позже',
      'Знаки указывают на "да"', 'Не сейчас',
      'Доверься интуиции', 'Время ещё не пришло'
    ];
    const answer = answers[Math.floor(Math.random() * answers.length)];
    showToast(`🎱 Ответ Вселенной: ${answer}`, 'info');
  });
  
  $('#meditation-btn')?.addEventListener('click', () => {
    showToast('🧘 Начинаем медитацию...', 'info');
  });
  
  $('#ritual-btn')?.addEventListener('click', () => {
    showToast('✨ Ритуал начат. Энергии очищаются.', 'info');
  });
  
  // Контакты
  $$('.contact-item').forEach(item => {
    item.addEventListener('click', function() {
      const text = this.querySelector('p').textContent;
      showToast(`📎 ${text}`, 'info');
    });
  });
}

// Навигация
function initNavigation() {
  $$('.nav-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      // Убираем активный класс у всех
      $$('.nav-btn').forEach(b => b.classList.remove('active'));
      // Добавляем текущему
      this.classList.add('active');
      
      const screen = this.dataset.screen;
      if (screen !== 'home') {
        showToast(`🚧 Экран "${screen}" в разработке`, 'info');
      }
    });
  });
}

// Добавление CSS для анимаций
function addAnimationStyles() {
  const style = document.createElement('style');
  style.textContent = `
    /* Партиклы */
    @keyframes floatParticle {
      0% {
        transform: translateY(0) translateX(0);
        opacity: 0;
      }
      10% {
        opacity: 0.3;
      }
      90% {
        opacity: 0.3;
      }
      100% {
        transform: translateY(-100vh) translateX(20px);
        opacity: 0;
      }
    }
    
    /* Ripple эффект */
    @keyframes ripple {
      to {
        transform: scale(4);
        opacity: 0;
      }
    }
    
    /* Частицы кнопок */
    @keyframes particleFloat {
      0% {
        transform: translateY(0) scale(1);
        opacity: 1;
      }
      100% {
        transform: translateY(-20px) scale(0);
        opacity: 0;
      }
    }
    
    /* Вращение кнопки обновления */
    @keyframes refreshSpin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
    
    .refreshing {
      animation: refreshSpin 1s linear infinite;
    }
    
    /* Анимация сохранения */
    .saved i {
      animation: saveBounce 0.5s ease;
    }
    
    @keyframes saveBounce {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.3); }
    }
    
    /* Вращение иконок навигации */
    @keyframes navIconPulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.1); }
    }
    
    .nav-btn.active i {
      animation: navIconPulse 2s ease-in-out infinite;
    }
    
    /* Плавная загрузка картинок */
    .card-image {
      opacity: 0;
      transition: opacity 0.5s ease;
    }
    
    .card-image.loaded {
      opacity: 1;
    }
  `;
  document.head.appendChild(style);
}

// ===== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ =====

function showLoader() {
  const loader = $('#app-loader');
  if (loader) {
    loader.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }
}

function hideLoader() {
  const loader = $('#app-loader');
  if (loader) {
    loader.style.opacity = '0';
    setTimeout(() => {
      loader.style.display = 'none';
      loader.style.opacity = '1';
      document.body.style.overflow = 'auto';
    }, 300);
  }
}

function showToast(message, type = 'info') {
  const toast = $('#toast');
  if (!toast) return;
  
  // Стиль в зависимости от типа
  toast.style.background = type === 'error' ? 'var(--danger)' : 
                          type === 'success' ? 'var(--success)' : 
                          'var(--primary)';
  
  toast.textContent = message;
  toast.classList.add('show');
  
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

function loadUserData() {
  const saved = localStorage.getItem('tarot_saved_cards');
  if (saved) {
    try {
      AppState.savedCards = JSON.parse(saved);
    } catch (e) {
      console.error('Ошибка загрузки сохранённых карт:', e);
    }
  }
}

// Запуск приложения
document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 TARO ГИПНОЗ запускается...');
  initApp();
});

// Экспорт для отладки
window.AppState = AppState;
window.showToast = showToast;
