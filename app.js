// ===== КОНФИГУРАЦИЯ =====
const CONFIG = {
  appName: 'Таро-гид',
  version: '1.0.0',
  defaultCardImage: 'cards/default-card.png'
};

// ===== HELPERS =====
const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));

// State management
const AppState = {
  currentScreen: 'home',
  user: null,
  savedCards: [],
  viewedCards: new Set(),
  purchasedSpreads: [],
  notifications: true,
  darkMode: true
};

// Toast system
class Toast {
  static show(message, type = 'info', duration = 3000) {
    const toast = $('#toast');
    if (!toast) return;

    toast.textContent = message;
    toast.className = 'toast';

    switch (type) {
      case 'success':
        toast.style.borderLeft = '4px solid var(--success)';
        break;
      case 'error':
        toast.style.borderLeft = '4px solid var(--danger)';
        break;
      case 'warning':
        toast.style.borderLeft = '4px solid var(--warning)';
        break;
      default:
        toast.style.borderLeft = '4px solid var(--primary)';
    }

    toast.classList.add('show');
    
    setTimeout(() => {
      toast.classList.remove('show');
    }, duration);
  }
}

// Storage helpers
class Storage {
  static get(key, defaultValue = null) {
    try {
      const item = localStorage.getItem(`tarot_${key}`);
      return item ? JSON.parse(item) : defaultValue;
    } catch {
      return defaultValue;
    }
  }

  static set(key, value) {
    try {
      localStorage.setItem(`tarot_${key}`, JSON.stringify(value));
    } catch (e) {
      console.error('Storage error:', e);
    }
  }

  static remove(key) {
    localStorage.removeItem(`tarot_${key}`);
  }
}

// Hash function
function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

// Date helpers
function formatDate(date = new Date()) {
  return date.toLocaleDateString('ru-RU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  });
}

function getTodayKey() {
  return new Date().toISOString().slice(0, 10);
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
        firstName: user.first_name,
        lastName: user.last_name,
        username: user.username,
        photoUrl: user.photo_url
      };
    }
  }

  // Debug mode
  const params = new URLSearchParams(window.location.search);
  if (params.has('debug')) {
    AppState.user = {
      id: 'debug-' + Date.now(),
      firstName: 'Тестовый',
      lastName: 'Пользователь',
      username: 'test_user'
    };
  }

  updateUserDisplay();
}

function updateUserDisplay() {
  const userLabel = $('#user-label');
  const profileName = $('#profile-name');
  
  if (AppState.user) {
    const name = AppState.user.firstName || AppState.user.username || 'Пользователь';
    if (userLabel) userLabel.textContent = `👤 ${name}`;
    if (profileName) profileName.textContent = name;
  }
}

// ===== УПРАВЛЕНИЕ ЭКРАНАМИ =====
function switchScreen(screenId) {
  // Hide all screens
  $$('.screen').forEach(screen => {
    screen.classList.remove('active');
  });

  // Update navigation
  $$('.nav-item').forEach(item => {
    item.classList.remove('active');
  });

  // Show target screen
  const targetScreen = $(`#${screenId}-screen`);
  const targetNav = $(`.nav-item[data-screen="${screenId}"]`);
  
  if (targetScreen) {
    targetScreen.classList.add('active');
    AppState.currentScreen = screenId;
  }
  
  if (targetNav) {
    targetNav.classList.add('active');
  }

  // Load screen-specific content
  switch (screenId) {
    case 'home':
      renderCardOfDay();
      break;
    case 'spreads':
      renderSpreads();
      break;
    case 'library':
      renderCardsLibrary();
      break;
    case 'profile':
      loadProfileData();
      break;
  }
}

// ===== КАРТА ДНЯ =====
function getCardOfTheDay() {
  if (!TAROT_CARDS?.length) return null;
  
  const seed = `${AppState.user?.id || 'anonymous'}|${getTodayKey()}`;
  const hash = hashString(seed);
  return TAROT_CARDS[hash % TAROT_CARDS.length];
}

function renderCardOfDay() {
  const container = $('#card-day-content');
  if (!container) return;

  const card = getCardOfTheDay();
  if (!card) {
    container.innerHTML = '<p class="error">Карты не загружены</p>';
    return;
  }

  // Track viewed card
  AppState.viewedCards.add(card.id);
  Storage.set('viewedCards', Array.from(AppState.viewedCards));

  container.innerHTML = `
    <div class="card-art-wrap">
      <img src="${card.image || CONFIG.defaultCardImage}" 
           alt="${card.name}" 
           class="card-art"
           loading="lazy">
    </div>
    <div class="card-info">
      <div class="card-header">
        <div class="card-name">${card.name}</div>
        ${card.roman ? `<div class="card-roman">${card.roman}</div>` : ''}
      </div>
      <div class="card-keyword">${card.keyword || ''}</div>
      <div class="card-desc">${card.description || ''}</div>
      <div class="card-date">
        <i class="fas fa-calendar-alt"></i>
        ${formatDate()}
      </div>
    </div>
  `;

  // Update stats
  updateStats();
}

// ===== РАСКЛАДЫ =====
function renderSpreads() {
  const container = $('#spreads-list');
  if (!container || !TAROT_SPREADS?.length) return;

  const categories = [...new Set(TAROT_SPREADS.map(s => s.category).filter(Boolean))];
  
  let html = '';
  
  categories.forEach(category => {
    const categorySpreads = TAROT_SPREADS.filter(s => s.category === category);
    
    html += `
      <div class="spreads-category">
        <h3 class="category-title">${category}</h3>
        <div class="category-grid">
          ${categorySpreads.map(spread => `
            <div class="spread-item" data-id="${spread.id}">
              <div class="spread-tag">${spread.tag || 'популярный'}</div>
              <h4 class="spread-title">${spread.title}</h4>
              <p class="spread-desc">${spread.description}</p>
              <div class="spread-footer">
                <div class="spread-price">${spread.priceLabel}</div>
                <button class="btn-secondary spread-detail-btn">
                  Подробнее
                </button>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  });

  container.innerHTML = html;

  // Add event listeners
  $$('.spread-detail-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const spreadItem = e.target.closest('.spread-item');
      const spreadId = spreadItem?.dataset.id;
      if (spreadId) {
        showSpreadModal(spreadId);
      }
    });
  });
}

function showSpreadModal(spreadId) {
  const spread = TAROT_SPREADS.find(s => s.id === spreadId);
  if (!spread) return;

  const modal = $('#spread-modal');
  const title = $('#modal-title');
  const desc = $('#modal-description');
  const price = $('#modal-price');
  const time = $('#modal-time');
  const cards = $('#modal-cards');
  const report = $('#modal-report');

  if (modal && title && desc && price) {
    title.textContent = spread.title;
    desc.textContent = spread.description;
    price.textContent = spread.priceLabel;
    time.textContent = spread.time || '10-15 мин';
    cards.textContent = spread.cards || '3-5';
    report.textContent = spread.report || 'PDF + аудио';

    modal.classList.add('active');

    // Handle buy button
    $('#buy-now-btn').onclick = () => {
      purchaseSpread(spread);
    };
  }
}

function purchaseSpread(spread) {
  if (!spread.prodamusUrl) {
    Toast.show('Ссылка на оплату не настроена', 'error');
    return;
  }

  // Track purchase
  AppState.purchasedSpreads.push({
    id: spread.id,
    title: spread.title,
    date: new Date().toISOString(),
    price: spread.priceLabel
  });
  Storage.set('purchasedSpreads', AppState.purchasedSpreads);

  // Open payment
  if (window.Telegram?.WebApp?.openLink) {
    window.Telegram.WebApp.openLink(spread.prodamusUrl);
  } else {
    window.open(spread.prodamusUrl, '_blank', 'noopener');
  }

  Toast.show(`Расклад "${spread.title}" — открывается оплата`, 'success');
  $('#spread-modal').classList.remove('active');
}

// ===== БИБЛИОТЕКА КАРТ =====
function renderCardsLibrary(searchTerm = '') {
  const container = $('#cards-library');
  if (!container || !TAROT_CARDS?.length) return;

  const filteredCards = TAROT_CARDS.filter(card => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return card.name.toLowerCase().includes(search) ||
           card.keyword?.toLowerCase().includes(search) ||
           card.description?.toLowerCase().includes(search);
  });

  container.innerHTML = filteredCards.map(card => `
    <div class="card-preview" data-id="${card.id}">
      <img src="${card.image || CONFIG.defaultCardImage}" 
           alt="${card.name}"
           loading="lazy">
      <div class="card-preview-name">
        <div>${card.name}</div>
        <small>${card.roman || ''}</small>
      </div>
    </div>
  `).join('');

  // Add click listeners
  $$('.card-preview').forEach(preview => {
    preview.addEventListener('click', () => {
      const cardId = parseInt(preview.dataset.id);
      showCardDetail(cardId);
    });
  });
}

function showCardDetail(cardId) {
  const card = TAROT_CARDS.find(c => c.id === cardId);
  if (!card) return;

  const modal = $('#card-modal');
  const image = $('#modal-card-image');
  const name = $('#modal-card-name');
  const roman = $('#modal-card-roman');
  const keyword = $('#modal-card-keyword');
  const desc = $('#modal-card-description');
  const upright = $('#modal-upright');
  const reversed = $('#modal-reversed');
  const advice = $('#modal-advice');

  if (modal && image && name) {
    image.src = card.image || CONFIG.defaultCardImage;
    image.alt = card.name;
    name.textContent = card.name;
    roman.textContent = card.roman || '';
    keyword.textContent = card.keyword || '';
    desc.textContent = card.description || '';
    upright.textContent = card.upright || 'Информация не указана';
    reversed.textContent = card.reversed || 'Информация не указана';
    advice.textContent = card.advice || 'Слушайте свою интуицию';

    modal.classList.add('active');
  }
}

// ===== ПРОФИЛЬ =====
function loadProfileData() {
  // Load saved data
  AppState.viewedCards = new Set(Storage.get('viewedCards', []));
  AppState.savedCards = Storage.get('savedCards', []);
  AppState.purchasedSpreads = Storage.get('purchasedSpreads', []);

  // Update stats
  updateStats();

  // Update toggles
  $('#notifications-toggle').checked = AppState.notifications;
  $('#theme-toggle').checked = AppState.darkMode;
}

function updateStats() {
  $('#stats-cards').textContent = AppState.viewedCards.size;
  $('#stats-spreads').textContent = AppState.purchasedSpreads.length;
  $('#stats-days').textContent = Math.max(1, AppState.purchasedSpreads.length * 3);
}

// ===== ИНИЦИАЛИЗАЦИЯ ПРИЛОЖЕНИЯ =====
function initApp() {
  // Show loader
  const loader = $('#app-loader');
  if (loader) {
    setTimeout(() => {
      loader.style.display = 'none';
    }, 1000);
  }

  // Initialize
  initTelegram();
  loadProfileData();
  renderCardOfDay();
  renderSpreads();
  renderCardsLibrary();

  // Event listeners
  $('#refresh-btn')?.addEventListener('click', () => {
    renderCardOfDay();
    Toast.show('Карта дня обновлена', 'info');
  });

  $('#save-card-btn')?.addEventListener('click', () => {
    const card = getCardOfTheDay();
    if (card) {
      AppState.savedCards.push({
        ...card,
        savedDate: new Date().toISOString()
      });
      Storage.set('savedCards', AppState.savedCards);
      Toast.show('Карта сохранена в избранное', 'success');
    }
  });

  // Navigation
  $$('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      const screen = item.dataset.screen;
      if (screen) {
        switchScreen(screen);
      }
    });
  });

  // Search
  $('#card-search')?.addEventListener('input', (e) => {
    renderCardsLibrary(e.target.value);
  });

  // Modal close buttons
  $$('.modal-close').forEach(btn => {
    btn.addEventListener('click', () => {
      btn.closest('.modal').classList.remove('active');
    });
  });

  // Close modals on background click
  $$('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.remove('active');
      }
    });
  });

  // Quick actions
  $('#daily-spread-btn')?.addEventListener('click', () => {
    switchScreen('spreads');
    Toast.show('Выберите расклад для анализа дня', 'info');
  });

  $('#ask-question-btn')?.addEventListener('click', () => {
    const question = prompt('Задайте свой вопрос Вселенной:');
    if (question) {
      Toast.show('Вопрос отправлен. Ищите ответ в картах.', 'success');
    }
  });

  // Toggles
  $('#notifications-toggle')?.addEventListener('change', (e) => {
    AppState.notifications = e.target.checked;
    Storage.set('notifications', AppState.notifications);
  });

  $('#theme-toggle')?.addEventListener('change', (e) => {
    AppState.darkMode = e.target.checked;
    document.body.classList.toggle('light-theme', !AppState.darkMode);
    Storage.set('darkMode', AppState.darkMode);
  });

  // Initialize theme
  if (AppState.darkMode) {
    document.body.classList.remove('light-theme');
  } else {
    document.body.classList.add('light-theme');
  }
}

// Запуск приложения
document.addEventListener('DOMContentLoaded', initApp);

// Экспорт для отладки
window.AppState = AppState;
window.Storage = Storage;
window.Toast = Toast;
