// ===== АНИМАЦИИ И ЭФФЕКТЫ =====

class MysticAnimations {
  constructor() {
    this.initParticles();
    this.initCardAnimations();
    this.initButtonEffects();
    this.initOfferTimer();
  }

  // Инициализация партиклов
  initParticles() {
    const container = document.querySelector('.particles-container');
    if (!container) return;

    // Удаляем старые партиклы
    container.innerHTML = '';

    // Создаём новые партиклы
    for (let i = 0; i < 15; i++) {
      const particle = document.createElement('div');
      particle.className = 'particle';
      
      // Случайная позиция
      particle.style.left = `${Math.random() * 100}%`;
      particle.style.top = `${Math.random() * 100}%`;
      
      // Случайный размер
      const size = 2 + Math.random() * 3;
      particle.style.width = `${size}px`;
      particle.style.height = `${size}px`;
      
      // Случайный цвет
      const colors = ['#FF00FF', '#00FFFF', '#9370DB', '#FFD700'];
      particle.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
      
      // Случайная задержка анимации
      particle.style.animationDelay = `${Math.random() * 10}s`;
      
      container.appendChild(particle);
    }
  }

  // Анимации карт
  initCardAnimations() {
    // Анимация при наведении на карту
    document.addEventListener('mouseover', (e) => {
      const card = e.target.closest('.card-art-container');
      if (card) {
        this.animateCardHover(card);
      }
    });

    // Анимация появления карты дня
    this.animateCardReveal();
  }

  animateCardHover(card) {
    card.style.transition = 'all 0.3s ease';
    card.style.transform = 'translateY(-10px) rotateX(5deg)';
    card.style.boxShadow = '0 25px 50px rgba(255, 0, 255, 0.4)';
  }

  animateCardReveal() {
    const cardContent = document.getElementById('card-day-content');
    if (!cardContent) return;

    // Добавляем анимацию появления
    cardContent.style.opacity = '0';
    cardContent.style.transform = 'translateY(30px) scale(0.95)';
    
    setTimeout(() => {
      cardContent.style.transition = 'all 0.8s cubic-bezier(0.4, 0, 0.2, 1)';
      cardContent.style.opacity = '1';
      cardContent.style.transform = 'translateY(0) scale(1)';
      
      // Добавляем свечение
      this.addGlowEffect(cardContent);
    }, 300);
  }

  addGlowEffect(element) {
    const glow = document.createElement('div');
    glow.className = 'card-glow';
    glow.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: radial-gradient(circle at center, rgba(255,0,255,0.1), transparent 70%);
      border-radius: inherit;
      pointer-events: none;
      animation: pulseGlow 3s ease-in-out infinite;
    `;
    
    element.style.position = 'relative';
    element.appendChild(glow);
    
    // Добавляем стиль для анимации
    if (!document.querySelector('#glow-animation')) {
      const style = document.createElement('style');
      style.id = 'glow-animation';
      style.textContent = `
        @keyframes pulseGlow {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 0.7; }
        }
      `;
      document.head.appendChild(style);
    }
  }

  // Эффекты кнопок
  initButtonEffects() {
    const buttons = document.querySelectorAll('.mystic-btn, .crystal-action-btn');
    
    buttons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.createRippleEffect(e);
        this.createSparkEffect(e);
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
    
    ripple.style.width = ripple.style.height = `${diameter}px`;
    ripple.style.left = `${event.clientX - btn.getBoundingClientRect().left - radius}px`;
    ripple.style.top = `${event.clientY - btn.getBoundingClientRect().top - radius}px`;
    ripple.className = 'ripple';
    
    // Стиль для ripple
    ripple.style.cssText += `
      position: absolute;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.4);
      transform: scale(0);
      animation: ripple 0.6s linear;
      pointer-events: none;
    `;
    
    btn.style.position = 'relative';
    btn.style.overflow = 'hidden';
    btn.appendChild(ripple);
    
    // Добавляем анимацию
    if (!document.querySelector('#ripple-animation')) {
      const style = document.createElement('style');
      style.id = 'ripple-animation';
      style.textContent = `
        @keyframes ripple {
          to {
            transform: scale(4);
            opacity: 0;
          }
        }
      `;
      document.head.appendChild(style);
    }
    
    setTimeout(() => ripple.remove(), 600);
  }

  createSparkEffect(event) {
    const btn = event.currentTarget;
    const rect = btn.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    // Создаём несколько искр
    for (let i = 0; i < 8; i++) {
      const spark = document.createElement('div');
      spark.className = 'spark';
      
      const angle = (Math.PI * 2 * i) / 8;
      const distance = 30 + Math.random() * 20;
      
      spark.style.cssText = `
        position: absolute;
        width: 3px;
        height: 3px;
        background: ${i % 2 === 0 ? '#FF00FF' : '#00FFFF'};
        border-radius: 50%;
        left: ${x}px;
        top: ${y}px;
        pointer-events: none;
        animation: sparkFly 0.5s ease-out forwards;
      `;
      
      btn.appendChild(spark);
      
      // Анимация полёта
      setTimeout(() => {
        spark.style.transform = `translate(${Math.cos(angle) * distance}px, ${Math.sin(angle) * distance}px)`;
        spark.style.opacity = '0';
      }, 10);
      
      setTimeout(() => spark.remove(), 500);
    }
  }

  createHoverParticles(button) {
    const rect = button.getBoundingClientRect();
    
    // Создаём частицы по краям кнопки
    for (let i = 0; i < 6; i++) {
      const particle = document.createElement('div');
      particle.className = 'hover-particle';
      
      const side = i % 4;
      let x, y;
      
      switch(side) {
        case 0: // верх
          x = Math.random() * rect.width;
          y = 0;
          break;
        case 1: // право
          x = rect.width;
          y = Math.random() * rect.height;
          break;
        case 2: // низ
          x = Math.random() * rect.width;
          y = rect.height;
          break;
        case 3: // лево
          x = 0;
          y = Math.random() * rect.height;
          break;
      }
      
      particle.style.cssText = `
        position: absolute;
        width: 2px;
        height: 2px;
        background: #00FFFF;
        border-radius: 50%;
        left: ${x}px;
        top: ${y}px;
        pointer-events: none;
        animation: hoverParticle 1s ease-out forwards;
      `;
      
      button.style.position = 'relative';
      button.appendChild(particle);
      
      setTimeout(() => particle.remove(), 1000);
    }
  }

  // Таймер предложения
  initOfferTimer() {
    const timerElement = document.getElementById('offer-timer');
    if (!timerElement) return;

    // Устанавливаем время до конца дня
    const now = new Date();
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);
    
    const updateTimer = () => {
      const now = new Date();
      const diff = endOfDay - now;
      
      if (diff <= 0) {
        timerElement.textContent = '00:00:00';
        return;
      }
      
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      
      timerElement.textContent = 
        `${hours.toString().padStart(2, '0')}:` +
        `${minutes.toString().padStart(2, '0')}:` +
        `${seconds.toString().padStart(2, '0')}`;
      
      // Меняем цвет при низком времени
      if (hours < 1) {
        timerElement.style.color = '#FF00FF';
        timerElement.style.animation = 'pulse 1s infinite';
      }
    };
    
    updateTimer();
    setInterval(updateTimer, 1000);
  }

  // Анимация загрузки
  static showLoader() {
    const loader = document.getElementById('app-loader');
    if (loader) {
      loader.style.display = 'flex';
      document.body.style.overflow = 'hidden';
    }
  }

  static hideLoader() {
    const loader = document.getElementById('app-loader');
    if (loader) {
      loader.style.display = 'none';
      document.body.style.overflow = 'auto';
    }
  }

  // Плавная смена экранов
  static switchScreen(fromScreen, toScreen) {
    if (fromScreen) {
      fromScreen.style.animation = 'fadeOut 0.5s ease';
      setTimeout(() => {
        fromScreen.classList.remove('active');
        fromScreen.style.animation = '';
      }, 500);
    }
    
    if (toScreen) {
      toScreen.style.animation = 'fadeIn 0.5s ease';
      setTimeout(() => {
        toScreen.classList.add('active');
        toScreen.style.animation = '';
      }, 50);
    }
  }
}

// Инициализация анимаций при загрузке
document.addEventListener('DOMContentLoaded', () => {
  window.mysticAnimations = new MysticAnimations();
  
  // Добавляем CSS для новых анимаций
  const style = document.createElement('style');
  style.textContent = `
    .screen {
      display: none;
      opacity: 0;
      transform: translateY(20px);
    }
    
    .screen.active {
      display: block;
      opacity: 1;
      transform: translateY(0);
      animation: screenAppear 0.6s cubic-bezier(0.4, 0, 0.2, 1);
    }
    
    @keyframes screenAppear {
      0% {
        opacity: 0;
        transform: translateY(30px) scale(0.98);
      }
      100% {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }
    
    @keyframes fadeOut {
      from { opacity: 1; transform: translateY(0); }
      to { opacity: 0; transform: translateY(-20px); }
    }
    
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }
    
    .mystic-loader {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(5, 0, 17, 0.95);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      z-index: 9999;
      backdrop-filter: blur(10px);
    }
    
    .loader-orbits {
      position: relative;
      width: 200px;
      height: 200px;
    }
    
    .orbit {
      position: absolute;
      border: 1px solid rgba(138, 43, 226, 0.3);
      border-radius: 50%;
      animation: orbitRotate linear infinite;
    }
    
    .orbit-1 {
      top: 25%;
      left: 25%;
      width: 50%;
      height: 50%;
      animation-duration: 8s;
    }
    
    .orbit-2 {
      top: 15%;
      left: 15%;
      width: 70%;
      height: 70%;
      animation-duration: 12s;
      animation-direction: reverse;
    }
    
    .orbit-3 {
      top: 5%;
      left: 5%;
      width: 90%;
      height: 90%;
      animation-duration: 16s;
    }
    
    @keyframes orbitRotate {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
    
    .loader-core {
      position: absolute;
      width: 80px;
      height: 80px;
      background: var(--gradient-magic);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 32px;
      color: white;
      animation: pulseCore 2s ease-in-out infinite;
    }
    
    @keyframes pulseCore {
      0%, 100% { transform: scale(1); box-shadow: 0 0 30px rgba(138, 43, 226, 0.5); }
      50% { transform: scale(1.1); box-shadow: 0 0 50px rgba(138, 43, 226, 0.8); }
    }
    
    .loader-text {
      margin-top: 220px;
      font-family: 'Orbitron', sans-serif;
      font-size: 14px;
      text-align: center;
      color: var(--cyan);
    }
    
    .text-word {
      display: inline-block;
      margin: 0 5px;
      animation: wordGlow 2s ease-in-out infinite;
      animation-delay: calc(var(--word-index) * 0.3s);
    }
    
    @keyframes wordGlow {
      0%, 100% { opacity: 0.5; filter: blur(0px); }
      50% { opacity: 1; filter: blur(1px); }
    }
  `;
  document.head.appendChild(style);
  
  // Инициализация текста загрузки
  const textWords = document.querySelectorAll('.text-word');
  textWords.forEach((word, index) => {
    word.style.setProperty('--word-index', index);
  });
});
