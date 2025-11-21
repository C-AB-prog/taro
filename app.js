// app.js

// ===== helpers =====
const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));

// На всякий случай, чтобы не было ReferenceError, если cards-data.js не подгрузился
window.TAROT_CARDS = window.TAROT_CARDS || [];
window.TAROT_SPREADS = window.TAROT_SPREADS || [];

const toastEl = $("#toast");
function showToast(text) {
  if (!toastEl) return;
  toastEl.textContent = text;
  toastEl.classList.add("visible");
  setTimeout(() => toastEl.classList.remove("visible"), 1900);
}

// Простенький хеш строки → число
function hashString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

// Форматирование сегодняшней даты
function formatToday() {
  const now = new Date();
  return now.toLocaleDateString("ru-RU", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit"
  });
}

// Ключ даты
function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

// ===== Telegram / окружение =====
let tgWebApp = null;
let tgUser = null;
let appUserId = null;

function initTelegram() {
  if (window.Telegram && window.Telegram.WebApp) {
    tgWebApp = window.Telegram.WebApp;
    try {
      tgWebApp.ready();
      if (tgWebApp.expand) tgWebApp.expand();
    } catch (e) {
      console.warn("WebApp.ready error", e);
    }

    const unsafe = tgWebApp.initDataUnsafe || {};
    tgUser = unsafe.user || null;

    if (tgUser && tgUser.id) {
      appUserId = String(tgUser.id);
    }
  }

  // Локальный тест: ?debug_tg_id=123
  const params = new URLSearchParams(window.location.search);
  const debugId = params.get("debug_tg_id");
  if (debugId) {
    appUserId = "debug-" + debugId;
  }

  if (!appUserId) {
    appUserId = "anonymous";
  }

  const userLabel = $("#user-label");
  if (userLabel) {
    if (tgUser && (tgUser.first_name || tgUser.username)) {
      userLabel.textContent = `Вы: ${tgUser.first_name || "@" + tgUser.username}`;
    } else if (debugId) {
      userLabel.textContent = `Тестовый пользователь #${debugId}`;
    } else {
      userLabel.textContent = "Гость мини-приложения";
    }
  }

  const todayLabel = $("#today-label");
  if (todayLabel) {
    todayLabel.textContent = formatToday();
  }
}

// ===== Карта дня =====

function pickCardOfDay(userId) {
  if (!Array.isArray(TAROT_CARDS) || TAROT_CARDS.length === 0) return null;
  const base = String(userId || "anonymous") + "|" + todayKey();
  const h = hashString(base);
  const idx = h % TAROT_CARDS.length;
  return TAROT_CARDS[idx];
}

function renderCardOfDay(options = { withShake: false }) {
  const container = $("#card-day-content");
  if (!container) return;

  const card = pickCardOfDay(appUserId);
  if (!card) {
    container.innerHTML =
      "<p style='font-size:.8rem;opacity:.8'>Карты пока не настроены. Проверь массив TAROT_CARDS в cards-data.js.</p>";
    return;
  }

  const artHtml = card.image
    ? `<div class="card-art-wrap">
         <img src="${card.image}" alt="${card.name}" class="card-art" loading="lazy">
       </div>`
    : `<div class="card-art-wrap">
         <div class="card-art" style="display:flex;align-items:center;justify-content:center;font-size:.8rem;padding:8px;">
           Нет изображения
         </div>
       </div>`;

  container.innerHTML = `
    ${artHtml}
    <div class="card-info">
      <div class="card-name-row">
        <div class="card-name">${card.name}</div>
        ${card.roman ? `<div class="card-roman">${card.roman}</div>` : ""}
      </div>
      <div class="card-keyword">${card.keyword || ""}</div>
      <div class="card-desc">${card.description || ""}</div>
      <div class="card-date">Сегодня · ${formatToday()}</div>
    </div>
  `;

  if (options.withShake) {
    const wrap = container.closest(".card-of-day");
    if (wrap) {
      wrap.style.animation = "none";
      void wrap.offsetWidth; // перезапуск
      wrap.style.animation = "fadeInUp 0.45s ease-out";
    }
  }
}

// ===== Расклады =====

function openProdamus(url, title) {
  if (!url) {
    showToast("Ссылка на оплату ещё не настроена.");
    return;
  }

  if (tgWebApp && tgWebApp.HapticFeedback) {
    try {
      tgWebApp.HapticFeedback.impactOccurred("light");
    } catch (_) {}
  }

  if (tgWebApp && tgWebApp.openLink) {
    tgWebApp.openLink(url);
  } else {
    window.open(url, "_blank", "noopener");
  }

  if (title) {
    showToast(`Расклад «${title}» — откроется страница оплаты.`);
  }
}

function renderSpreads() {
  const container = $("#spreads-list");
  if (!container) return;

  if (!Array.isArray(TAROT_SPREADS) || TAROT_SPREADS.length === 0) {
    container.innerHTML =
      "<p style='font-size:.8rem;opacity:.8'>Расклады ещё не добавлены. Проверь TAROT_SPREADS в cards-data.js.</p>";
    return;
  }

  container.innerHTML = "";

  TAROT_SPREADS.forEach((spread) => {
    const item = document.createElement("article");
    item.className = "spread-item";

    item.innerHTML = `
      <div class="spread-main">
        <div class="spread-title">${spread.title}</div>
        <div class="spread-desc">${spread.description || ""}</div>
        <div class="spread-meta">
          <span class="spread-price">${spread.priceLabel || ""}</span>
          ${spread.tag ? `<span class="spread-chip">${spread.tag}</span>` : ""}
        </div>
      </div>
      <div class="spread-actions">
        <button class="btn-primary" type="button">
          Купить
        </button>
      </div>
    `;

    const btn = item.querySelector("button");
    btn.addEventListener("click", () =>
      openProdamus(spread.prodamusUrl, spread.title)
    );

    container.appendChild(item);
  });
}

// ===== init =====

function initApp() {
  initTelegram();
  renderCardOfDay();
  renderSpreads();

  const refreshBtn = $("#refresh-btn");
  if (refreshBtn) {
    refreshBtn.addEventListener("click", () => {
      renderCardOfDay({ withShake: true });
      showToast("Карта дня фиксирована на сегодня, это визуальное обновление 😊");
    });
  }
}

document.addEventListener("DOMContentLoaded", initApp);
