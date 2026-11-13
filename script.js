// ==========================================
// ОСНОВНАЯ ЛОГИКА ПРИЛОЖЕНИЯ (script.js)
// ==========================================

// --- Глобальные переменные состояния ---
let db = {}; // Полная база данных (содержит оба направления)
let levelCards = []; // Все карточки выбранного уровня и режима
let currentCards = []; // Отфильтрованный массив карточек для показа
let currentIndex = 0; // Индекс активной карточки
let currentLevelKey = "a1a2"; // Текущий уровень ('a1a2', 'b1b2', 'c1c2')
let currentDirection = "ru-de"; // Направление перевода: 'ru-de' или 'de-ru'
let isPlaying = false; // Флаг воспроизведения (защита от наложения в Firefox)

// --- Ссылки на элементы интерфейса (DOM-элементы) ---
const ruWord = document.getElementById("ru-word");
const deWord = document.getElementById("de-word");
const sentence = document.getElementById("sentence");
const playBtn = document.getElementById("play-sound");
const cardTopic = document.getElementById("card-topic");
const menuButtons = document.querySelectorAll(".menuBtn");
const dirButtons = document.querySelectorAll(".dirBtn");

// Элементы выпадающего меню топиков
const dropdownContainer = document.getElementById("dropdown-container");
const dropdownToggle = document.getElementById("dropdown-toggle");
const dropdownBtnText = document.getElementById("dropdown-btn-text");
const topicsList = document.getElementById("topics-list");

/**
 * Инициализация приложения.
 * Собирает данные из 6 файлов (3 для ru-de и 3 для de-ru) и синхронизирует с localStorage.
 */
function initApp() {
  const assembledDatabase = {
    "ru-de": {
      a1a2: typeof databaseA1A2 !== "undefined" ? databaseA1A2 : [],
      b1b2: typeof databaseB1B2 !== "undefined" ? databaseB1B2 : [],
      c1c2: typeof databaseC1C2 !== "undefined" ? databaseC1C2 : [],
    },
    "de-ru": {
      a1a2: typeof databaseA1A2_ru !== "undefined" ? databaseA1A2_ru : [],
      b1b2: typeof databaseB1B2_ru !== "undefined" ? databaseB1B2_ru : [],
      c1c2: typeof databaseC1C2_ru !== "undefined" ? databaseC1C2_ru : [],
    },
  };

  const cachedData = localStorage.getItem("flashcards_db_v2");
  const fileDataString = JSON.stringify(assembledDatabase);

  // Проверяем, загрузились ли массивы из файлов
  const hasData =
    assembledDatabase["ru-de"].a1a2.length > 0 ||
    assembledDatabase["de-ru"].a1a2.length > 0;

  if (hasData) {
    if (cachedData !== fileDataString) {
      console.log(
        "Обновление: файлы баз данных изменены. Обновляем localStorage...",
      );
      localStorage.setItem("flashcards_db_v2", fileDataString);
      db = assembledDatabase;
    } else {
      console.log("Данные актуальны, загружаем из кэша localStorage.");
      db = JSON.parse(cachedData);
    }
  } else if (cachedData) {
    db = JSON.parse(cachedData);
  } else {
    db = {
      "ru-de": {
        a1a2: [
          {
            topic: "Ошибка",
            ru: "Ошибка",
            de: "der Fehler",
            plural: "-",
            sentence: "Файлы баз не найдены.",
            ruSentence: "",
          },
        ],
      },
      "de-ru": {
        a1a2: [
          {
            topic: "Fehler",
            front: "der Fehler",
            back: "Ошибка",
            plural: "-",
            sentence: "Файлы баз не найдены.",
            subSentence: "",
          },
        ],
      },
    };
  }

  // Настройка открытия/закрытия выпадающего меню топиков
  dropdownToggle.addEventListener("click", (e) => {
    e.stopPropagation();
    dropdownContainer.classList.toggle("open");
  });

  document.addEventListener("click", () => {
    dropdownContainer.classList.remove("open");
  });

  dropdownContainer.addEventListener("click", (e) => {
    e.stopPropagation();
  });

  // Загружаем стартовый уровень и направление
  loadLevel(currentLevelKey);
}

/**
 * Загружает карточки для текущего направления перевода и уровня сложности
 * @param {string} levelKey - Ключ уровня ('a1a2', 'b1b2', 'c1c2')
 */
function loadLevel(levelKey) {
  currentLevelKey = levelKey;
  const dirData = db[currentDirection] || {};
  levelCards = dirData[currentLevelKey] || [];
  currentCards = [...levelCards];
  currentIndex = 0;

  dropdownContainer.classList.remove("open");

  updateActiveMenuButton(currentLevelKey);
  updateActiveDirectionButton(currentDirection);
  renderTopicsForLevel(levelCards);
  updateDropdownButtonText();
  updateCard(currentIndex);
}

/**
 * Создает список чекбоксов с уникальными топиками текущего уровня
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
 * Фильтрует карточки по выбранным чекбоксам топиков
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
 * Обновляет текст на кнопке выпадающего списка в зависимости от режима языка
 */
function updateDropdownButtonText() {
  const label = currentDirection === "de-ru" ? "Themen" : "Темы уровня";
  dropdownBtnText.textContent = `${label} (${currentCards.length})`;
}

/**
 * Подсвечивает активную кнопку уровня (A1-A2, B1-B2, C1-C2)
 */
function updateActiveMenuButton(activeLevel) {
  menuButtons.forEach((btn) => {
    btn.classList.toggle(
      "active",
      btn.getAttribute("data-level") === activeLevel,
    );
  });
}

/**
 * Подсвечивает активную кнопку направления перевода слева от карточки
 */
function updateActiveDirectionButton(activeDir) {
  dirButtons.forEach((btn) => {
    btn.classList.toggle("active", btn.getAttribute("data-dir") === activeDir);
  });
}

/**
 * Отрисовывает содержимое карточки на экране в зависимости от выбранного режима
 * @param {number} index - Индекс карточки в массиве currentCards
 */
function updateCard(index) {
  stopSpeech();

  if (!currentCards || currentCards.length === 0) return;
  const cardData = currentCards[index];

  // Отображение топика
  if (cardData.topic && cardData.topic.trim() !== "") {
    cardTopic.textContent = cardData.topic;
    cardTopic.style.display = "inline-block";
  } else {
    cardTopic.textContent = "";
    cardTopic.style.display = "none";
  }

  if (currentDirection === "ru-de") {
    // РЕЖИМ 1: vom Russischen ins Deutsche
    ruWord.textContent = cardData.ru;

    if (cardData.plural && cardData.plural !== "-" && cardData.plural !== "—") {
      deWord.innerHTML = `${cardData.de} <br><span class="plural-text">pl: ${cardData.plural}</span>`;
    } else {
      deWord.innerHTML = cardData.de;
    }

    if (cardData.ruSentence) {
      sentence.innerHTML = `${cardData.sentence} <br><span style="font-size: 0.8em; opacity: 0.8;">${cardData.ruSentence}</span>`;
    } else {
      sentence.textContent = cardData.sentence;
    }
  } else {
    // РЕЖИМ 2: vom Deutschen ins Russische (всё наоборот)
    // Снаружи немецкое слово (и при наличии форма множественного числа)
    if (cardData.plural && cardData.plural !== "-" && cardData.plural !== "—") {
      ruWord.innerHTML = `${cardData.front} <br><span class="plural-text" style="color: #e6f4ff;">pl: ${cardData.plural}</span>`;
    } else {
      ruWord.textContent = cardData.front;
    }

    // Внутри русское слово
    deWord.textContent = cardData.back;

    // Внутри русское предложение сверху, а снизу перевод на немецкий
    if (cardData.subSentence) {
      sentence.innerHTML = `${cardData.sentence} <br><span style="font-size: 0.8em; opacity: 0.8;">${cardData.subSentence}</span>`;
    } else {
      sentence.textContent = cardData.sentence;
    }
  }
}

/**
 * Принудительная остановка озвучивания (с патчем стабильности для Firefox)
 */
function stopSpeech() {
  isPlaying = false;
  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
    try {
      window.speechSynthesis.pause();
      window.speechSynthesis.resume();
      window.speechSynthesis.cancel();
    } catch (e) {
      // Игнорируем возможные системные исключения
    }
  }
}

// ==========================================
// ОБРАБОТЧИК ОЗВУЧИВАНИЯ (🎵) С ИНВЕРСИЕЙ ЯЗЫКОВ
// ==========================================
playBtn.addEventListener("click", () => {
  if (!("speechSynthesis" in window)) {
    alert("К сожалению, ваш браузер не поддерживает синтез речи.");
    return;
  }

  if (isPlaying) {
    stopSpeech();
    return;
  }

  stopSpeech();

  if (currentCards.length === 0) return;
  const cardData = currentCards[currentIndex];
  isPlaying = true;

  // Определяем тексты и языки озвучки в зависимости от режима
  let mainWordText, mainLang, mainRate;
  let mainSentenceText;
  let subSentenceText, subLang, subRate;

  if (currentDirection === "ru-de") {
    // В режиме RU -> DE: основное слово и предложение на немецком, перевод на русском
    mainWordText = cardData.de;
    mainSentenceText = cardData.sentence;
    mainLang = "de-DE";
    mainRate = 0.5;

    subSentenceText = cardData.ruSentence;
    subLang = "ru-RU";
    subRate = 0.9;
  } else {
    // В режиме DE -> RU: всё наоборот! Основное слово и предложение на русском, перевод на немецком
    mainWordText = cardData.back;
    mainSentenceText = cardData.sentence;
    mainLang = "ru-RU";
    mainRate = 0.9;

    subSentenceText = cardData.subSentence;
    subLang = "de-DE";
    subRate = 0.6;
  }

  // 1. Первое прочтение основного слова
  const wordUtterance1 = new SpeechSynthesisUtterance(mainWordText);
  wordUtterance1.lang = mainLang;
  wordUtterance1.rate = mainRate;

  // 2. Второе прочтение основного слова
  const wordUtterance2 = new SpeechSynthesisUtterance(mainWordText);
  wordUtterance2.lang = mainLang;
  wordUtterance2.rate = mainRate;

  // 3. Первое прочтение основного предложения
  const sentenceUtterance1 = new SpeechSynthesisUtterance(mainSentenceText);
  sentenceUtterance1.lang = mainLang;
  sentenceUtterance1.rate = mainRate;

  // 4. Второе прочтение основного предложения
  const sentenceUtterance2 = new SpeechSynthesisUtterance(mainSentenceText);
  sentenceUtterance2.lang = mainLang;
  sentenceUtterance2.rate = mainRate;

  // 5. Перевод предложения на второй язык
  let subUtterance = null;
  if (subSentenceText) {
    subUtterance = new SpeechSynthesisUtterance(subSentenceText);
    subUtterance.lang = subLang;
    subUtterance.rate = subRate;
  }

  // Цепочка последовательного воспроизведения
  wordUtterance1.onend = () => {
    if (!isPlaying) return;
    setTimeout(() => {
      if (isPlaying) window.speechSynthesis.speak(wordUtterance2);
    }, 500);
  };

  wordUtterance2.onend = () => {
    if (!isPlaying) return;
    setTimeout(() => {
      if (isPlaying) window.speechSynthesis.speak(sentenceUtterance1);
    }, 500);
  };

  sentenceUtterance1.onend = () => {
    if (!isPlaying) return;
    setTimeout(() => {
      if (isPlaying) window.speechSynthesis.speak(sentenceUtterance2);
    }, 200);
  };

  if (subUtterance) {
    sentenceUtterance2.onend = () => {
      if (!isPlaying) return;
      setTimeout(() => {
        if (isPlaying) window.speechSynthesis.speak(subUtterance);
      }, 1000);
    };

    subUtterance.onend = () => {
      isPlaying = false;
    };
  } else {
    sentenceUtterance2.onend = () => {
      isPlaying = false;
    };
  }

  // Защита от сбоев
  wordUtterance1.onerror = () => {
    isPlaying = false;
  };
  wordUtterance2.onerror = () => {
    isPlaying = false;
  };
  sentenceUtterance1.onerror = () => {
    isPlaying = false;
  };
  sentenceUtterance2.onerror = () => {
    isPlaying = false;
  };

  window.speechSynthesis.speak(wordUtterance1);
});

// --- Навигационные кнопки ---
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

// --- Переключение уровней сложности ---
menuButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    const selectedLevel = btn.getAttribute("data-level");
    if (db[currentDirection] && db[currentDirection][selectedLevel]) {
      loadLevel(selectedLevel);
    }
  });
});

// --- Переключение направления перевода (vom Russischen ins Deutsche / vom Deutschen ins Russische) ---
dirButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    const selectedDir = btn.getAttribute("data-dir");
    if (selectedDir !== currentDirection) {
      currentDirection = selectedDir;
      loadLevel(currentLevelKey);
    }
  });
});

// --- Запуск приложения ---
initApp();
