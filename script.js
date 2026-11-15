// ==========================================
// ОСНОВНАЯ ЛОГИКА ПРИЛОЖЕНИЯ (script.js)
// ==========================================

// --- Глобальные переменные состояния ---
let db = {}; // Полная база данных (содержит оба направления перевода)
let levelCards = []; // Все карточки выбранного уровня сложности и режима
let currentCards = []; // Отфильтрованный массив карточек, доступный для показа пользователю
let currentIndex = 0; // Индекс текущей активной карточки в массиве currentCards
let currentLevelKey = "a1a2"; // Текущий выбранный уровень ('a1a2', 'b1b2', 'c1c2')
let currentDirection = "ru-de"; // Текущее направление перевода: 'ru-de' или 'de-ru'
let isPlaying = false; // Флаг активного воспроизведения (защита от наложения аудиодорожек в Firefox)

// --- Ссылки на элементы интерфейса (DOM-элементы) ---
const ruWord = document.getElementById("ru-word"); // Текст на лицевой стороне карточки
const deWord = document.getElementById("de-word"); // Основной перевод на обратной стороне карточки
const sentence = document.getElementById("sentence"); // Блок с примером предложения и его переводом
const playBtn = document.getElementById("play-sound"); // Кнопка воспроизведения звука (🎵)
const cardTopic = document.getElementById("card-topic"); // Бейдж с названием темы на лицевой стороне
const cardElement = document.querySelector(".card"); // Контейнер самой карточки (для отслеживания переворота)
const menuButtons = document.querySelectorAll(".menuBtn"); // Кнопки выбора уровня сложности (A1-A2, B1-B2, C1-C2)
const dirButtons = document.querySelectorAll(".dirBtn"); // Кнопки переключения направления перевода

// Элементы выпадающего меню топиков (тем)
const dropdownContainer = document.getElementById("dropdown-container"); // Главный контейнер выпадающего списка
const dropdownToggle = document.getElementById("dropdown-toggle"); // Кнопка открытия/закрытия списка тем
const dropdownBtnText = document.getElementById("dropdown-btn-text"); // Текст внутри кнопки списка тем
const topicsList = document.getElementById("topics-list"); // Контейнер для генерации чекбоксов с темами

/**
 * Инициализация приложения.
 * Собирает данные из 6 внешних JS-файлов (3 для ru-de и 3 для de-ru)
 * и синхронизирует их с локальным хранилищем браузера (localStorage).
 */
function initApp() {
  // Формируем единый объект базы данных из глобальных переменных подключенных скриптов
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

  // Получаем ранее сохраненную версию базы из localStorage
  const cachedData = localStorage.getItem("flashcards_db_v2");
  // Преобразуем текущие данные из файлов в JSON-строку для сравнения
  const fileDataString = JSON.stringify(assembledDatabase);

  // Проверяем, удалось ли загрузить хотя бы один массив из подключенных файлов
  const hasData =
    assembledDatabase["ru-de"].a1a2.length > 0 ||
    assembledDatabase["de-ru"].a1a2.length > 0;

  if (hasData) {
    // Если данные в файлах изменились по сравнению с кэшем, обновляем localStorage
    if (cachedData !== fileDataString) {
      console.log(
        "Обновление: файлы баз данных изменены. Обновляем localStorage...",
      );
      localStorage.setItem("flashcards_db_v2", fileDataString);
      db = assembledDatabase;
    } else {
      // Если изменений нет, берем данные из кэша
      console.log("Данные актуальны, загружаем из кэша localStorage.");
      db = JSON.parse(cachedData);
    }
  } else if (cachedData) {
    // Резервный вариант: если файлы не загрузились, используем кэш
    db = JSON.parse(cachedData);
  } else {
    // Аварийная заглушка на случай полного отсутствия данных
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

  // Обработчик клика по кнопке открытия/закрытия выпадающего меню топиков
  dropdownToggle.addEventListener("click", (e) => {
    e.stopPropagation(); // Предотвращаем всплытие клика до document
    dropdownContainer.classList.toggle("open");
  });

  // Закрытие выпадающего меню при клике в любую свободную область экрана
  document.addEventListener("click", () => {
    dropdownContainer.classList.remove("open");
  });

  // Предотвращаем закрытие меню при клике внутри самого списка (например, по чекбоксам)
  dropdownContainer.addEventListener("click", (e) => {
    e.stopPropagation();
  });

  // ==========================================
  // ОСТАНОВКА ЗВУКА ПРИ ПЕРЕВОРОТЕ КАРТОЧКИ
  // ==========================================
  if (cardElement) {
    // Останавливаем синтезатор речи при наведении курсора на карточку (переворот на обратную сторону)
    cardElement.addEventListener("mouseenter", () => {
      stopSpeech();
    });

    // Останавливаем синтезатор речи при уводе курсора с карточки (возврат на лицевую сторону)
    cardElement.addEventListener("mouseleave", () => {
      stopSpeech();
    });
  }

  // Загружаем стартовый уровень и направление по умолчанию
  loadLevel(currentLevelKey);
}

/**
 * Загружает карточки для текущего направления перевода и уровня сложности.
 * @param {string} levelKey - Ключ уровня ('a1a2', 'b1b2', 'c1c2')
 */
function loadLevel(levelKey) {
  currentLevelKey = levelKey;
  const dirData = db[currentDirection] || {};
  levelCards = dirData[currentLevelKey] || [];
  currentCards = [...levelCards]; // Копируем все карточки уровня в текущий рабочий массив
  currentIndex = 0; // Сбрасываем индекс на первую карточку

  dropdownContainer.classList.remove("open"); // Закрываем список тем при смене уровня

  updateActiveMenuButton(currentLevelKey); // Подсвечиваем активную кнопку уровня
  updateActiveDirectionButton(currentDirection); // Подсвечиваем активную кнопку направления
  renderTopicsForLevel(levelCards); // Генерируем чекбоксы тем для выбранного уровня
  updateDropdownButtonText(); // Обновляем счетчик карточек на кнопке тем
  updateCard(currentIndex); // Отрисовываем первую карточку
}

/**
 * Создает список чекбоксов с уникальными топиками (темами) для текущего уровня.
 * @param {Array} cards - Массив карточек текущего уровня
 */
function renderTopicsForLevel(cards) {
  topicsList.innerHTML = ""; // Очищаем старый список тем

  // Собираем только уникальные непустые названия тем с помощью Set
  const uniqueTopics = new Set();
  cards.forEach((card) => {
    if (card.topic && card.topic.trim() !== "") {
      uniqueTopics.add(card.topic.trim());
    }
  });

  // Если у карточек этого уровня нет тем, скрываем выпадающее меню
  if (uniqueTopics.size === 0) {
    dropdownContainer.style.display = "none";
    return;
  }

  dropdownContainer.style.display = "block";

  // Создаем DOM-элементы (label + input[type="checkbox"] + span) для каждой темы
  uniqueTopics.forEach((topicName) => {
    const label = document.createElement("label");
    label.className = "topic-item";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.value = topicName;
    // При изменении состояния любого чекбокса запускаем фильтрацию
    checkbox.addEventListener("change", applyTopicFilter);

    const span = document.createElement("span");
    span.textContent = topicName;

    label.appendChild(checkbox);
    label.appendChild(span);
    topicsList.appendChild(label);
  });
}

/**
 * Фильтрует массив отображаемых карточек в соответствии с выбранными чекбоксами топиков.
 */
function applyTopicFilter() {
  // Находим все отмеченные чекбоксы внутри списка тем
  const checkedBoxes = topicsList.querySelectorAll(
    'input[type="checkbox"]:checked',
  );
  // Извлекаем их строковые значения в массив
  const selectedTopics = Array.from(checkedBoxes).map((cb) => cb.value);

  // Если ни одна тема не выбрана, показываем все карточки уровня
  if (selectedTopics.length === 0) {
    currentCards = [...levelCards];
  } else {
    // Иначе оставляем только те карточки, тема которых входит в список выбранных
    currentCards = levelCards.filter((card) => {
      return card.topic && selectedTopics.includes(card.topic.trim());
    });
  }

  updateDropdownButtonText(); // Обновляем количество доступных карточек в тексте кнопки
  currentIndex = 0; // Начинаем показ с первой отфильтрованной карточки
  updateCard(currentIndex);
}

/**
 * Обновляет текст на кнопке выпадающего списка тем в зависимости от языка интерфейса и числа карточек.
 */
function updateDropdownButtonText() {
  const label = currentDirection === "de-ru" ? "Themen" : "Темы уровня";
  dropdownBtnText.textContent = `${label} (${currentCards.length})`;
}

/**
 * Подсвечивает активную кнопку уровня (A1-A2, B1-B2, C1-C2).
 * @param {string} activeLevel - Ключ активного уровня
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
 * Подсвечивает активную кнопку направления перевода.
 * @param {string} activeDir - Ключ активного направления ('ru-de' или 'de-ru')
 */
function updateActiveDirectionButton(activeDir) {
  dirButtons.forEach((btn) => {
    btn.classList.toggle("active", btn.getAttribute("data-dir") === activeDir);
  });
}

/**
 * Автоматически озвучивает текст лицевой стороны карточки ровно один раз.
 * @param {string} text - Текст для озвучивания
 */
function speakFrontCard(text) {
  if (!("speechSynthesis" in window)) return;

  stopSpeech(); // Сбрасываем предыдущую озвучку

  const utterance = new SpeechSynthesisUtterance(text);

  // Определяем язык: если в тексте есть латинские буквы, читаем по-немецки, иначе по-русски
  const isGerman = /[a-zA-ZäöüßÄÖÜ]/.test(text);
  utterance.lang = isGerman ? "de-DE" : "ru-RU";
  utterance.rate = 0.6; // Комфортная скорость воспроизведения

  window.speechSynthesis.speak(utterance);
}

/**
 * Отрисовывает содержимое карточки на экране в зависимости от выбранного режима перевода.
 * @param {number} index - Индекс карточки в массиве currentCards
 */
function updateCard(index) {
  stopSpeech(); // При переключении на новую карточку принудительно глушим старую озвучку

  if (!currentCards || currentCards.length === 0) return;
  const cardData = currentCards[index];

  // Отображение бейджа топика на лицевой стороне
  if (cardData.topic && cardData.topic.trim() !== "") {
    cardTopic.textContent = cardData.topic;
    cardTopic.style.display = "inline-block";
  } else {
    cardTopic.textContent = "";
    cardTopic.style.display = "none";
  }

  let textToSpeak = ""; // Текст для автоозвучки лицевой стороны

  if (currentDirection === "ru-de") {
    // РЕЖИМ 1: С русского на немецкий (vom Russischen ins Deutsche)
    ruWord.textContent = cardData.ru;
    textToSpeak = cardData.ru; // Лицевая сторона — на русском

    // Если указано множественное число, выводим его под основным немецким словом
    if (cardData.plural && cardData.plural !== "-" && cardData.plural !== "—") {
      deWord.innerHTML = `${cardData.de} <br><span class="plural-text">pl: ${cardData.plural}</span>`;
    } else {
      deWord.innerHTML = cardData.de;
    }

    // Выводим немецкое предложение и его русский перевод (если он есть)
    if (cardData.ruSentence) {
      sentence.innerHTML = `${cardData.sentence} <br><span style="font-size: 0.8em; opacity: 0.8;">${cardData.ruSentence}</span>`;
    } else {
      sentence.textContent = cardData.sentence;
    }
  } else {
    // РЕЖИМ 2: С немецкого на русский (vom Deutschen ins Russische — всё наоборот)
    // На лицевой стороне немецкое слово (и множественное число при наличии)
    if (cardData.plural && cardData.plural !== "-" && cardData.plural !== "—") {
      ruWord.innerHTML = `${cardData.front} <br><span class="plural-text" style="color: #e6f4ff;">pl: ${cardData.plural}</span>`;
    } else {
      ruWord.textContent = cardData.front;
    }
    textToSpeak = cardData.front; // Лицевая сторона — на немецком

    // На обратной стороне русский перевод слова
    deWord.textContent = cardData.back;

    // На обратной стороне русское предложение сверху, а снизу его немецкий оригинал
    if (cardData.subSentence) {
      sentence.innerHTML = `${cardData.sentence} <br><span style="font-size: 0.8em; opacity: 0.8;">${cardData.subSentence}</span>`;
    } else {
      sentence.textContent = cardData.sentence;
    }
  }

  // Озвучиваем лицевую сторону карточки ровно один раз с небольшой задержкой для стабильности
  setTimeout(() => {
    speakFrontCard(textToSpeak);
  }, 150);
}

/**
 * Принудительная остановка синтезатора речи (включает патч стабильности для Firefox).
 */
function stopSpeech() {
  isPlaying = false;
  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel(); // Очищаем очередь воспроизведения
    try {
      // Дополнительный сброс состояния для обхода бага зависания очереди в Firefox
      window.speechSynthesis.pause();
      window.speechSynthesis.resume();
      window.speechSynthesis.cancel();
    } catch (e) {
      // Игнорируем возможные системные исключения браузера
    }
  }
}

// ==========================================
// ОБРАБОТЧИК ОЗВУЧИВАНИЯ (🎵) С ИНВЕРСИЕЙ ЯЗЫКОВ
// ==========================================
playBtn.addEventListener("click", () => {
  // Проверяем поддержку Web Speech API в браузере пользователя
  if (!("speechSynthesis" in window)) {
    alert("К сожалению, ваш браузер не поддерживает синтез речи.");
    return;
  }

  // Если озвучка уже идет, повторный клик по кнопке останавливает её
  if (isPlaying) {
    stopSpeech();
    return;
  }

  stopSpeech(); // На всякий случай сбрасываем предыдущие зависшие задачи

  if (currentCards.length === 0) return;
  const cardData = currentCards[currentIndex];
  isPlaying = true;

  // Переменные для настройки текстов, языков и скорости речи
  let mainWordText, mainLang, mainRate;
  let mainSentenceText;
  let subSentenceText, subLang, subRate;

  if (currentDirection === "ru-de") {
    // В режиме RU -> DE: основное слово и предложение на немецком (медленно), перевод на русском
    mainWordText = cardData.de;
    mainSentenceText = cardData.sentence;
    mainLang = "de-DE";
    mainRate = 0.5;

    subSentenceText = cardData.ruSentence;
    subLang = "ru-RU";
    subRate = 0.5;
  } else {
    // В режиме DE -> RU: основное слово и предложение на русском, перевод на немецком (медленно)
    mainWordText = cardData.back;
    mainSentenceText = cardData.sentence;
    mainLang = "ru-RU";
    mainRate = 0.5;

    subSentenceText = cardData.subSentence;
    subLang = "de-DE";
    subRate = 0.5;
  }

  // 1. Создаем объект для первого прочтения основного слова
  const wordUtterance1 = new SpeechSynthesisUtterance(mainWordText);
  wordUtterance1.lang = mainLang;
  wordUtterance1.rate = mainRate;

  // 2. Создаем объект для второго прочтения основного слова
  const wordUtterance2 = new SpeechSynthesisUtterance(mainWordText);
  wordUtterance2.lang = mainLang;
  wordUtterance2.rate = mainRate;

  // 3. Создаем объект для первого прочтения основного предложения
  const sentenceUtterance1 = new SpeechSynthesisUtterance(mainSentenceText);
  sentenceUtterance1.lang = mainLang;
  sentenceUtterance1.rate = mainRate;

  // 4. Создаем объект для второго прочтения основного предложения
  const sentenceUtterance2 = new SpeechSynthesisUtterance(mainSentenceText);
  sentenceUtterance2.lang = mainLang;
  sentenceUtterance2.rate = mainRate;

  // 5. Создаем объект для прочтения перевода предложения на втором языке (если перевод задан)
  let subUtterance = null;
  if (subSentenceText) {
    subUtterance = new SpeechSynthesisUtterance(subSentenceText);
    subUtterance.lang = subLang;
    subUtterance.rate = subRate;
  }

  // Выстраиваем цепочку последовательного воспроизведения с паузами (setTimeout)
  wordUtterance1.onend = () => {
    if (!isPlaying) return; // Прерываем цепочку, если пользователь остановил звук
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

    // Сбрасываем флаг воспроизведения после завершения всей цепочки
    subUtterance.onend = () => {
      isPlaying = false;
    };
  } else {
    // Если перевода предложения нет, завершаем цепочку после второго прочтения основного предложения
    sentenceUtterance2.onend = () => {
      isPlaying = false;
    };
  }

  // Защита от сбоев: сбрасываем флаг воспроизведения при возникновении любой ошибки синтезатора
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

  // Запускаем воспроизведение первого звена цепочки
  window.speechSynthesis.speak(wordUtterance1);
});

// --- Обработчики навигационных кнопок ---

// Кнопка «Следующая» (циклический переход вперед)
document.getElementById("nextBtn").addEventListener("click", () => {
  if (currentCards.length === 0) return;
  currentIndex = (currentIndex + 1) % currentCards.length;
  updateCard(currentIndex);
});

// Кнопка «Предыдущая» (циклический переход назад)
document.getElementById("prevBtn").addEventListener("click", () => {
  if (currentCards.length === 0) return;
  currentIndex = (currentIndex - 1 + currentCards.length) % currentCards.length;
  updateCard(currentIndex);
});

// Кнопка «Рандом» (выбор случайной карточки, отличной от текущей)
document.getElementById("randomBtn").addEventListener("click", () => {
  if (currentCards.length <= 1) return;
  let randomIndex;
  do {
    randomIndex = Math.floor(Math.random() * currentCards.length);
  } while (randomIndex === currentIndex);

  currentIndex = randomIndex;
  updateCard(currentIndex);
});

// --- Переключение уровней сложности (A1-A2, B1-B2, C1-C2) ---
menuButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    const selectedLevel = btn.getAttribute("data-level");
    if (db[currentDirection] && db[currentDirection][selectedLevel]) {
      loadLevel(selectedLevel);
    }
  });
});

// --- Переключение направления перевода (ru-de / de-ru) ---
dirButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    const selectedDir = btn.getAttribute("data-dir");
    if (selectedDir !== currentDirection) {
      currentDirection = selectedDir;
      loadLevel(currentLevelKey);
    }
  });
});

// --- Точка входа: запуск приложения ---
initApp();
