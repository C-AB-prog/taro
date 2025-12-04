// ===== ОСНОВНОЙ ФУНКЦИОНАЛ =====

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

// Инициализация
async function initApp() {
  showLoader();
  
  try {
    // Инициализация Telegram
    initTelegram();
    
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
  
  // Выбираем случайную карту (или по алгоритму дня)
  const today = new Date().getDate();
  const cardIndex = today % window.TAROT_CARDS.length;
  const card = window.TAROT_CARDS[cardIndex];
  
  if (!card) return;
  
  AppState.currentCard = card;
  
  // Создаём HTML
  container.innerHTML = `
    <div class="card-display">
      <div class="card-image-container">
        <img src="${card.image}" 
             alt="${card.name}" 
             class="card-image loading"
             onload="this.classList.remove('loading'); this.classList.add('loaded')"
             onerror="this.src='cards/card-placeholder.png'">
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
    { text: 'Удача сегодня с тобой!', color: '#FF6B6B' },
    { text: 'Новые возможности ждут', color: '#4ECDC4' },
    { text: 'Время действовать', color: '#45B7D1' },
    { text: 'Гармония в отношениях', color: '#96CEB4' },
    { text: 'Творческий подъём', color: '#FECA57' },
    { text: 'Любовь и страсть', color: '#FF9FF3' },
    { text: 'Финансовый рост', color: '#54A0FF' },
    { text: 'Духовное пробуждение', color: '#5F27CD' },
    { text: 'Путешествие к мечте', color: '#00D2D3' },
    { text: 'Сила и уверенность', color: '#FF9F43' },
    { text: 'Перемены к лучшему', color: '#EE5A24' },
    { text: 'Исполнение желаний', color: '#A3CB38' }
  ];
  
  // Создаём секции колеса
  wheel.innerHTML = '';
  
  spinBtn.addEventListener('click', () => {
    if (wheel.classList.contains('spinning')) return;
    
    wheel.classList.add('spinning');
    spinBtn.disabled = true;
    
    // Случайное вращение
    const spins = 5 + Math.random() * 3; // 5-8 полных оборотов
    const extraDegrees = Math.floor(Math.random() * 360);
    const totalRotation = spins * 360 + extraDegrees;
    
    wheel.style.transform = `rotate(${totalRotation}deg)`;
    
    // После вращения
    setTimeout(() => {
      wheel.classList.remove('spinning');
      spinBtn.disabled = false;
      
      // Определяем выигрышную секцию
      const normalizedRotation = extraDegrees % 360;
      const sectionIndex = Math.floor(normalizedRotation / 30);
      const fortune = fortunes[sectionIndex];
      
      showToast(fortune.text, 'success');
      
      // Анимация выигрышной секции
      highlightWheelSection(sectionIndex, fortune.color);
      
    }, 4000); // Время вращения
  });
}

// Подсветка секции колеса
function highlightWheelSection(index, color) {
  const wheel = $('#fortune-wheel');
  const sections = 12;
  const degreePerSection = 360 / sections;
  const startAngle = index * degreePerSection;
  
  wheel.style.background = `
    conic-gradient(
      from 0deg,
      ${index === 0 ? color : '#FF6B6B'} 0deg ${degreePerSection}deg,
      #4ECDC4 ${degreePerSection}deg ${degreePerSection * 2}deg,
      #45B7D1 ${degreePerSection * 2}deg ${degreePerSection * 3}deg,
      #96CEB4 ${degreePerSection * 3}deg ${degreePerSection * 4}deg,
      #FECA57 ${degreePerSection * 4}deg ${degreePerSection * 5}deg,
      #FF9FF3 ${degreePerSection * 5}deg ${degreePerSection * 6}deg,
      #54A0FF ${degreePerSection * 6}deg ${degreePerSection * 7}deg,
      #5F27CD ${degreePerSection * 7}deg ${degreePerSection * 8}deg,
      #00D2D3 ${degreePerSection * 8}deg ${degreePerSection * 9}deg,
      #FF9F43 ${degreePerSection * 9}deg ${degreePerSection * 10}deg,
      #EE5A24 ${degreePerSection * 10}deg ${degreePerSection * 11}deg,
      #A3CB38 ${degreePerSection * 11}deg 360deg
    )
  `;
  
  // Возвращаем обычные цвета через 2 секунды
  setTimeout(() => {
    wheel.style.background = '';
  }, 2000);
}

// Инициализация кнопок
function initButtons() {
  // Кнопка обновления карты
  $('#refresh-btn')?.addEventListener('click', async () => {
    if (AppState.isLoading) return;
    
    AppState.isLoading = true;
    $('#refresh-btn').classList.add('refreshing');
    
    await loadCardOfDay();
    showToast('Карта дня обновлена', 'success');
    
    setTimeout(() => {
      $('#refresh-btn').classList.remove('refreshing');
      AppState.isLoading = false;
    }, 1000);
  });
  
  // Сохранение карты
  $('#save-card-btn')?.addEventListener('click', () => {
    if (!AppState.currentCard) return;
    
    AppState.savedCards.push({
      ...AppState.currentCard,
      savedAt: new Date()
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
    const question = prompt('Задайте свой вопрос Вселенной:');
    if (question) {
      const answers = [
        'Да', 'Нет', 'Возможно', 'Спроси позже',
        'Знаки указывают на "да"', 'Не сейчас',
        'Доверься интуиции', 'Время ещё не пришло'
      ];
      const answer = answers[Math.floor(Math.random() * answers.length)];
      showToast(`Ответ Вселенной: ${answer}`, 'info');
    }
  });
  
  $('#meditation-btn')?.addEventListener('click', () => {
    showToast('Начинаем медитацию...', 'info');
    // Здесь можно добавить таймер медитации
  });
  
  $('#ritual-btn')?.addEventListener('click', () => {
    showToast('Ритуал начат. Энергии очищаются.', 'info');
  });
  
  // Контакты
  $$('.contact-item').forEach(item => {
    item.addEventListener('click', function() {
      const text = this.querySelector('p').textContent;
      showToast(`Ссылка: ${text}`, 'info');
    });
  });
}

// Инициализация навигации
function initNavigation() {
  $$('.nav-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const screen = this.dataset.screen;
      
      // Убираем активный класс у всех
      $$('.nav-btn').forEach(b => b.classList.remove('active'));
      $$('.screen').forEach(s => s.classList.remove('active'));
      
      // Добавляем активный класс текущему
      this.classList.add('active');
      
      // Показываем соответствующий экран
      if (screen === 'home') {
        $('#home-screen').classList.add('active');
      } else {
        showToast(`Экран "${screen}" в разработке`, 'info');
        // Для других экранов можно добавить логику позже
      }
    });
  });
}

// Утилиты
function showLoader() {
  const loader = $('#app-loader');
  if (loader) loader.style.display = 'flex';
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
  
  // Стиль в зависимости от типа
  toast.className = 'toast';
  if (type === 'error') toast.style.background = 'var(--danger)';
  else if (type === 'success') toast.style.background = 'var(--success)';
  else toast.style.background = 'var(--primary)';
  
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
document.addEventListener('DOMContentLoaded', initApp);

// Добавляем CSS для состояний
document.head.insertAdjacentHTML('beforeend', `
  <style>
    .refreshing {
      animation: refreshSpin 1s linear infinite;
    }
    
    @keyframes refreshSpin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
    
    .saved i {
      animation: saveBounce 0.5s ease;
    }
    
    @keyframes saveBounce {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.3); }
    }
    
    .nav-btn.active i {
      animation: navIconPulse 2s ease-in-out infinite;
    }
    
    @keyframes navIconPulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.1); }
    }
    
    .fortune-wheel.spinning {
      transition: transform 4s cubic-bezier(0.2, 0.8, 0.3, 1);
    }
  </style>
`);
