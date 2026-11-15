// ==========================================
// ОСНОВНАЯ ЛОГИКА ПРИЛОЖЕНИЯ (script.js)
// ==========================================

// --- Глобальные переменные состояния ---
let db = {}; // Полная база данных (содержит оба направления перевода)
let levelCards = []; // Все карточки выбранного уровня сложности и режима
let currentCards = []; // Отфильтрованный массив карточек, доступный для показа пользователю
let currentIndex = 0; // Индекс текущей активной карточки в массиве currentCards
let currentLevelKey = "a1a2"; // Текущий выбранный уровень ('a1a2', 'b1b2', 'c1c2', 'difficult')
let currentDirection = "ru-de"; // Текущее направление перевода: 'ru-de' или 'de-ru'
let isPlaying = false; // Флаг активного воспроизведения (защита от наложения аудиодорожек в Firefox)

// --- Ссылки на элементы интерфейса (DOM-элементы) ---
const ruWord = document.getElementById("ru-word"); // Текст на лицевой стороне карточки
const deWord = document.getElementById("de-word"); // Основной перевод на обратной стороне карточки
const sentence = document.getElementById("sentence"); // Блок с примером предложения и его переводом
const playBtn = document.getElementById("play-sound"); // Кнопка воспроизведения звука (🎵)
const cardTopic = document.getElementById("card-topic"); // Бейдж с названием темы на лицевой стороне
const cardElement = document.querySelector(".card"); // Контейнер самой карточки (для отслеживания переворота)
const menuButtons = document.querySelectorAll(".menuBtn"); // Кнопки выбора уровня сложности
const dirButtons = document.querySelectorAll(".dirBtn"); // Кнопки переключения направления перевода

// Элементы выпадающего меню топиков (тем)
const dropdownContainer = document.getElementById("dropdown-container"); // Главный контейнер выпадающего списка
const dropdownToggle = document.getElementById("dropdown-toggle"); // Кнопка открытия/закрытия списка тем
const dropdownBtnText = document.getElementById("dropdown-btn-text"); // Текст внутри кнопки списка тем
const topicsList = document.getElementById("topics-list"); // Контейнер для генерации чекбоксов с темами
const difficultCheckbox = document.getElementById("difficult-checkbox"); // Чекбокс сложных слов на обороте

/**
 * Инициализация приложения.
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
  const hasData =
    assembledDatabase["ru-de"].a1a2.length > 0 ||
    assembledDatabase["de-ru"].a1a2.length > 0;

  if (hasData) {
    if (cachedData !== fileDataString) {
      localStorage.setItem("flashcards_db_v2", fileDataString);
      db = assembledDatabase;
    } else {
      db = JSON.parse(cachedData);
    }
  } else if (cachedData) {
    db = JSON.parse(cachedData);
  } else {
    db = { "ru-de": { a1a2: [] }, "de-ru": { a1a2: [] } };
  }

  // Обработчик выпадающего меню тем
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

  // Остановка звука при перевороте карточки
  if (cardElement) {
    cardElement.addEventListener("mouseenter", () => stopSpeech());
    cardElement.addEventListener("mouseleave", () => stopSpeech());
  }

  // Обработчик изменения состояния чекбокса "сложные слова"
  if (difficultCheckbox) {
    difficultCheckbox.addEventListener("change", (e) => {
      if (!currentCards || currentCards.length === 0) return;
      const cardData = currentCards[currentIndex];

      // Защита от изменения заглушки пустой категории
      if (
        cardData.ru === "Нет сложных слов" ||
        cardData.front === "Keine schweren Wörter"
      )
        return;

      toggleDifficultCard(cardData, currentDirection, e.target.checked);

      // Если пользователь находится в режиме "Сложные слова" и снял галочку,
      // карточка должна сразу исчезнуть из текущего активного списка прокрутки.
      if (currentLevelKey === "difficult" && !e.target.checked) {
        const keyToRemove = getCardKey(cardData);
        levelCards = levelCards.filter((c) => getCardKey(c) !== keyToRemove);
        currentCards = [...levelCards];

        if (currentCards.length === 0) {
          loadLevel("difficult"); // Перезагрузит состояние софт-заглушки "нет слов"
          return;
        }
        if (currentIndex >= currentCards.length) {
          currentIndex = 0;
        }
        updateCard(currentIndex);
      }
    });
  }

  loadLevel(currentLevelKey);
}

// --- Управление списком сложных слов в localStorage ---

function getDifficultCards(dir) {
  const data = localStorage.getItem(`difficult_cards_${dir}`);
  return data ? JSON.parse(data) : [];
}

function saveDifficultCards(dir, cards) {
  localStorage.setItem(`difficult_cards_${dir}`, JSON.stringify(cards));
}

function getCardKey(card) {
  return (
    (card.ru || card.front || "") +
    "::" +
    (card.de || card.back || "") +
    "::" +
    (card.sentence || "")
  );
}

function isCardDifficult(card, dir) {
  const diffs = getDifficultCards(dir);
  const key = getCardKey(card);
  return diffs.some((c) => getCardKey(c) === key);
}

function toggleDifficultCard(card, dir, isAdd) {
  let diffs = getDifficultCards(dir);
  const key = getCardKey(card);
  if (isAdd) {
    if (!diffs.some((c) => getCardKey(c) === key)) {
      diffs.push(card);
    }
  } else {
    diffs = diffs.filter((c) => getCardKey(c) !== key);
  }
  saveDifficultCards(dir, diffs);
}

/**
 * Загружает карточки для текущего направления перевода и уровня сложности.
 */
function loadLevel(levelKey) {
  currentLevelKey = levelKey;

  if (levelKey === "difficult") {
    levelCards = getDifficultCards(currentDirection);
    // Если список пуст, создаем информационную карточку-заглушку
    if (levelCards.length === 0) {
      levelCards = [
        {
          topic: "Сложные слова",
          ru: "Нет сложных слов",
          de: "Keine schweren Wörter",
          front: "Keine schweren Wörter",
          back: "Нет сложных слов",
          plural: "—",
          sentence:
            "Отмечайте галочкой карточки на обороте, чтобы они появились здесь.",
          ruSentence:
            "Отмечайте галочкой карточки на обороте, чтобы они появились здесь.",
          subSentence:
            "Markieren Sie Karten auf der Rückseite, um sie hier zu sehen.",
        },
      ];
    }
  } else {
    const dirData = db[currentDirection] || {};
    levelCards = dirData[currentLevelKey] || [];
  }

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
 * Создает список чекбоксов с уникальными топиками для текущего уровня.
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

function updateDropdownButtonText() {
  const label = currentDirection === "de-ru" ? "Themen" : "Темы уровня";
  dropdownBtnText.textContent = `${label} (${currentCards.length})`;
}

function updateActiveMenuButton(activeLevel) {
  menuButtons.forEach((btn) => {
    btn.classList.toggle(
      "active",
      btn.getAttribute("data-level") === activeLevel,
    );
  });
}

function updateActiveDirectionButton(activeDir) {
  dirButtons.forEach((btn) => {
    btn.classList.toggle("active", btn.getAttribute("data-dir") === activeDir);
  });
}

/**
 * Автоматически озвучивает текст лицевой стороны карточки ровно один раз.
 */
function speakFrontCard(text) {
  if (!("speechSynthesis" in window)) return;
  stopSpeech();
  const utterance = new SpeechSynthesisUtterance(text);
  const isGerman = /[a-zA-ZäöüßÄÖÜ]/.test(text);
  utterance.lang = isGerman ? "de-DE" : "ru-RU";
  utterance.rate = 0.6;
  window.speechSynthesis.speak(utterance);
}

/**
 * Отрисовывает содержимое карточки на экране.
 */
function updateCard(index) {
  stopSpeech();

  if (!currentCards || currentCards.length === 0) return;
  const cardData = currentCards[index];

  // Отображение бейджа топика
  if (cardData.topic && cardData.topic.trim() !== "") {
    cardTopic.textContent = cardData.topic;
    cardTopic.style.display = "inline-block";
  } else {
    cardTopic.textContent = "";
    cardTopic.style.display = "none";
  }

  let textToSpeak = "";

  if (currentDirection === "ru-de") {
    ruWord.textContent = cardData.ru;
    textToSpeak = cardData.ru;

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
    if (cardData.plural && cardData.plural !== "-" && cardData.plural !== "—") {
      ruWord.innerHTML = `${cardData.front} <br><span class="plural-text" style="color: #e6f4ff;">pl: ${cardData.plural}</span>`;
    } else {
      ruWord.textContent = cardData.front;
    }
    textToSpeak = cardData.front;

    deWord.textContent = cardData.back;

    if (cardData.subSentence) {
      sentence.innerHTML = `${cardData.sentence} <br><span style="font-size: 0.8em; opacity: 0.8;">${cardData.subSentence}</span>`;
    } else {
      sentence.textContent = cardData.sentence;
    }
  }

  // Синхронизация состояния чекбокса сложных слов для текущей карточки
  if (difficultCheckbox) {
    if (
      cardData.ru === "Нет сложных слов" ||
      cardData.front === "Keine schweren Wörter"
    ) {
      difficultCheckbox.checked = false;
      difficultCheckbox.disabled = true;
    } else {
      difficultCheckbox.disabled = false;
      difficultCheckbox.checked = isCardDifficult(cardData, currentDirection);
    }
  }

  // Озвучиваем лицевую сторону карточки один раз
  setTimeout(() => {
    speakFrontCard(textToSpeak);
  }, 150);
}

function stopSpeech() {
  isPlaying = false;
  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
    try {
      window.speechSynthesis.pause();
      window.speechSynthesis.resume();
      window.speechSynthesis.cancel();
    } catch (e) {}
  }
}

// ==========================================
// ОБРАБОТЧИК ОЗВУЧИВАНИЯ (🎵)
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

  let mainWordText, mainLang, mainRate;
  let mainSentenceText;
  let subSentenceText, subLang, subRate;

  if (currentDirection === "ru-de") {
    mainWordText = cardData.de;
    mainSentenceText = cardData.sentence;
    mainLang = "de-DE";
    mainRate = 0.5;

    subSentenceText = cardData.ruSentence;
    subLang = "ru-RU";
    subRate = 0.5;
  } else {
    mainWordText = cardData.back;
    mainSentenceText = cardData.sentence;
    mainLang = "ru-RU";
    mainRate = 0.5;

    subSentenceText = cardData.subSentence;
    subLang = "de-DE";
    subRate = 0.5;
  }

  const wordUtterance1 = new SpeechSynthesisUtterance(mainWordText);
  wordUtterance1.lang = mainLang;
  wordUtterance1.rate = mainRate;

  const wordUtterance2 = new SpeechSynthesisUtterance(mainWordText);
  wordUtterance2.lang = mainLang;
  wordUtterance2.rate = mainRate;

  const sentenceUtterance1 = new SpeechSynthesisUtterance(mainSentenceText);
  sentenceUtterance1.lang = mainLang;
  sentenceUtterance1.rate = mainRate;

  const sentenceUtterance2 = new SpeechSynthesisUtterance(mainSentenceText);
  sentenceUtterance2.lang = mainLang;
  sentenceUtterance2.rate = mainRate;

  let subUtterance = null;
  if (subSentenceText) {
    subUtterance = new SpeechSynthesisUtterance(subSentenceText);
    subUtterance.lang = subLang;
    subUtterance.rate = subRate;
  }

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
  if (subUtterance) {
    subUtterance.onerror = () => {
      isPlaying = false;
    };
  }

  window.speechSynthesis.speak(wordUtterance1);
});

// --- Обработчики навигационных кнопок ---

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

// --- Переключение уровней сложности и режима "Сложные слова" ---
menuButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    const selectedLevel = btn.getAttribute("data-level");
    loadLevel(selectedLevel);
  });
});

// --- Переключение направления перевода ---
dirButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    const selectedDir = btn.getAttribute("data-dir");
    if (selectedDir !== currentDirection) {
      currentDirection = selectedDir;
      loadLevel(currentLevelKey);
    }
  });
});

// --- Точка входа ---
initApp();
