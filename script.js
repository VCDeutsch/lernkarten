// ==========================================
// ОСНОВНАЯ ЛОГИКА ПРИЛОЖЕНИЯ (script.js)
// ==========================================

// --- Глобальные переменные состояния ---
let db = {}; // Полная база данных приложения
let levelCards = []; // Все карточки выбранного уровня (до фильтрации по топикам)
let currentCards = []; // Отфильтрованный массив карточек, с которым работает пользователь
let currentIndex = 0; // Индекс активной отображаемой карточки
let currentLevelKey = "a1a2"; // Текущий выбранный уровень сложности (по умолчанию A1-A2)

// --- Ссылки на элементы интерфейса (DOM-элементы) ---
const ruWord = document.getElementById("ru-word");
const deWord = document.getElementById("de-word");
const sentence = document.getElementById("sentence");
const playBtn = document.getElementById("play-sound");
const cardTopic = document.getElementById("card-topic");
const menuButtons = document.querySelectorAll(".menuBtn");

// Элементы выпадающего меню топиков
const dropdownContainer = document.getElementById("dropdown-container");
const dropdownToggle = document.getElementById("dropdown-toggle");
const dropdownBtnText = document.getElementById("dropdown-btn-text");
const topicsList = document.getElementById("topics-list");

/**
 * Функция инициализации приложения.
 * Собирает базу данных из раздельных файлов уровней и проверяет localStorage.
 */
function initApp() {
  // Формируем единый объект базы данных из трех отдельных переменных
  const assembledDatabase = {
    a1a2: typeof databaseA1A2 !== "undefined" ? databaseA1A2 : [],
    b1b2: typeof databaseB1B2 !== "undefined" ? databaseB1B2 : [],
    c1c2: typeof databaseC1C2 !== "undefined" ? databaseC1C2 : [],
  };

  const cachedData = localStorage.getItem("flashcards_db");
  const fileDataString = JSON.stringify(assembledDatabase);

  if (assembledDatabase.a1a2.length > 0 || assembledDatabase.b1b2.length > 0) {
    if (cachedData !== fileDataString) {
      console.log(
        "Обновление: файлы баз данных были изменены. Обновляем localStorage...",
      );
      localStorage.setItem("flashcards_db", fileDataString);
      db = assembledDatabase;
    } else {
      console.log("Данные актуальны, загружаем из кэша localStorage.");
      db = JSON.parse(cachedData);
    }
  } else if (cachedData) {
    db = JSON.parse(cachedData);
  } else {
    db = {
      a1a2: [
        {
          topic: "Ошибка",
          ru: "Ошибка",
          de: "der Fehler",
          plural: "-",
          sentence: "База данных не найдена.",
          ruSentence: "Файлы уровней не подключены.",
        },
      ],
    };
  }

  // Настройка открытия/закрытия выпадающего меню по клику на кнопку
  dropdownToggle.addEventListener("click", (e) => {
    e.stopPropagation();
    dropdownContainer.classList.toggle("open");
  });

  // Закрытие меню при клике в любое другое место на странице
  document.addEventListener("click", () => {
    dropdownContainer.classList.remove("open");
  });

  dropdownContainer.addEventListener("click", (e) => {
    e.stopPropagation();
  });

  loadLevel(currentLevelKey);
}

/**
 * Загружает данные для указанного уровня сложности, строит список топиков и выводит первую карточку
 * @param {string} levelKey - Ключ уровня ('a1a2', 'b1b2', 'c1c2')
 */
function loadLevel(levelKey) {
  currentLevelKey = levelKey;
  levelCards = db[currentLevelKey] || [];
  currentCards = [...levelCards];
  currentIndex = 0;

  dropdownContainer.classList.remove("open");

  updateActiveMenuButton(currentLevelKey);
  renderTopicsForLevel(levelCards);
  updateDropdownButtonText();
  updateCard(currentIndex);
}

/**
 * Извлекает уникальные топики из карточек уровня и создает для них чекбоксы в выпадающем меню
 * @param {Array} cards - Массив карточек текущего уровня
 */
function renderTopicsForLevel(cards) {
  topicsList.innerHTML = "";

  const uniqueTopics = new Set();
  cards.forEach((card) => {
    if (card.topic && card.topic.trim() !== "") {
      uniqueTopics.add(card.topic.trim());
    }
  });

  if (uniqueTopics.size === 0) {
    dropdownContainer.style.display = "none";
    return;
  }

  dropdownContainer.style.display = "block";

  uniqueTopics.forEach((topicName) => {
    const label = document.createElement("label");
    label.className = "topic-item";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.value = topicName;
    checkbox.addEventListener("change", applyTopicFilter);

    const span = document.createElement("span");
    span.textContent = topicName;

    label.appendChild(checkbox);
    label.appendChild(span);
    topicsList.appendChild(label);
  });
}

/**
 * Фильтрует карточки текущего уровня на основе отмеченных чекбоксов топиков
 */
function applyTopicFilter() {
  const checkedBoxes = topicsList.querySelectorAll(
    'input[type="checkbox"]:checked',
  );
  const selectedTopics = Array.from(checkedBoxes).map((cb) => cb.value);

  if (selectedTopics.length === 0) {
    currentCards = [...levelCards];
  } else {
    currentCards = levelCards.filter((card) => {
      return card.topic && selectedTopics.includes(card.topic.trim());
    });
  }

  updateDropdownButtonText();
  currentIndex = 0;
  updateCard(currentIndex);
}

/**
 * Обновляет текст на кнопке выпадающего меню
 */
function updateDropdownButtonText() {
  dropdownBtnText.textContent = `Темы уровня (${currentCards.length})`;
}

/**
 * Функция обновления подсветки кнопок в меню уровней
 * @param {string} activeLevel - Ключ активного уровня ('a1a2', 'b1b2', 'c1c2')
 */
function updateActiveMenuButton(activeLevel) {
  menuButtons.forEach((btn) => {
    const levelAttr = btn.getAttribute("data-level");
    if (levelAttr === activeLevel) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
  });
}

/**
 * Функция обновления содержимого карточки на экране по заданному индексу
 * @param {number} index - Индекс карточки в массиве currentCards
 */
function updateCard(index) {
  if (!currentCards || currentCards.length === 0) return;

  const cardData = currentCards[index];

  if (cardData.topic && cardData.topic.trim() !== "") {
    cardTopic.textContent = cardData.topic;
    cardTopic.style.display = "inline-block";
  } else {
    cardTopic.textContent = "";
    cardTopic.style.display = "none";
  }

  ruWord.textContent = cardData.ru;

  if (cardData.plural && cardData.plural !== "-") {
    deWord.innerHTML = `${cardData.de} <br><span class="plural-text">pl: ${cardData.plural}</span>`;
  } else {
    deWord.innerHTML = cardData.de;
  }

  if (cardData.ruSentence) {
    sentence.innerHTML = `${cardData.sentence} <br><span style="font-size: 0.8em; opacity: 0.8;">${cardData.ruSentence}</span>`;
  } else {
    sentence.textContent = cardData.sentence;
  }

  stopSpeech();
}

/**
 * Функция принудительной остановки синтеза речи браузера
 */
function stopSpeech() {
  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
}

// ==========================================
// ОБРАБОТЧИК КЛИКА ПО КНОПКЕ ОЗВУЧИВАНИЯ (🎵)
// ==========================================
playBtn.addEventListener("click", () => {
  if (!("speechSynthesis" in window)) {
    alert("К сожалению, ваш браузер не поддерживает синтез речи.");
    return;
  }

  stopSpeech();

  if (currentCards.length === 0) return;
  const cardData = currentCards[currentIndex];

  const wordUtterance1 = new SpeechSynthesisUtterance(cardData.de);
  wordUtterance1.lang = "de-DE";
  wordUtterance1.rate = 0.5;

  const wordUtterance2 = new SpeechSynthesisUtterance(cardData.de);
  wordUtterance2.lang = "de-DE";
  wordUtterance2.rate = 0.5;

  const sentenceUtterance1 = new SpeechSynthesisUtterance(cardData.sentence);
  sentenceUtterance1.lang = "de-DE";
  sentenceUtterance1.rate = 0.5;

  const sentenceUtterance2 = new SpeechSynthesisUtterance(cardData.sentence);
  sentenceUtterance2.lang = "de-DE";
  sentenceUtterance2.rate = 0.5;

  let ruUtterance = null;
  if (cardData.ruSentence) {
    ruUtterance = new SpeechSynthesisUtterance(cardData.ruSentence);
    ruUtterance.lang = "ru-RU";
    ruUtterance.rate = 0.9;
  }

  wordUtterance1.onend = () => {
    setTimeout(() => {
      window.speechSynthesis.speak(wordUtterance2);
    }, 500);
  };

  wordUtterance2.onend = () => {
    setTimeout(() => {
      window.speechSynthesis.speak(sentenceUtterance1);
    }, 500);
  };

  sentenceUtterance1.onend = () => {
    setTimeout(() => {
      window.speechSynthesis.speak(sentenceUtterance2);
    }, 200);
  };

  if (ruUtterance) {
    sentenceUtterance2.onend = () => {
      setTimeout(() => {
        window.speechSynthesis.speak(ruUtterance);
      }, 1000);
    };
  }

  window.speechSynthesis.speak(wordUtterance1);
});

// Навигация
document.getElementById("nextBtn").addEventListener("click", () => {
  if (currentCards.length === 0) return;
  currentIndex = (currentIndex + 1) % currentCards.length;
  updateCard(currentIndex);
});

document.getElementById("prevBtn").addEventListener("click", () => {
  if (currentCards.length === 0) return;
  currentIndex = (currentIndex - 1 + currentCards.length) % currentCards.length;
  updateCard(currentIndex);
});

document.getElementById("randomBtn").addEventListener("click", () => {
  if (currentCards.length <= 1) return;
  let randomIndex;
  do {
    randomIndex = Math.floor(Math.random() * currentCards.length);
  } while (randomIndex === currentIndex);

  currentIndex = randomIndex;
  updateCard(currentIndex);
});

// Переключение уровней
menuButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    const selectedLevel = btn.getAttribute("data-level");
    if (db[selectedLevel]) {
      loadLevel(selectedLevel);
    }
  });
});

document.querySelector(".card").addEventListener("mouseleave", () => {
  stopSpeech();
});

initApp();
