import { categories, questions } from "./questions.js";
import { calculateAura } from "./formula.js";

const setupPanel = document.querySelector("#setupPanel");
const quizPanel = document.querySelector("#quizPanel");
const resultPanel = document.querySelector("#resultPanel");
const categoryGrid = document.querySelector("#categoryGrid");
const modeGrid = document.querySelector("#modeGrid");
const quizForm = document.querySelector("#quizForm");
const setupInfo = document.querySelector("#setupInfo");
const quizInfo = document.querySelector("#quizInfo");
const progressBar = document.querySelector("#progressBar");
const progressText = document.querySelector("#progressText");

const userNameInput = document.querySelector("#userName");
const questionLimitSelect = document.querySelector("#questionLimit");
const resultStyleSelect = document.querySelector("#resultStyle");
const prevQuestionButton = document.querySelector("#prevQuestionButton");
const nextQuestionButton = document.querySelector("#nextQuestionButton");
const calculateButton = document.querySelector("#calculateButton");
const earlyCalculateButton = document.querySelector("#earlyCalculateButton");
const continueQuizButton = document.querySelector("#continueQuizButton");

const booleanChoices = [
  { value: "yes", label: "Да" },
  { value: "probably_yes", label: "Скорее да" },
  { value: "maybe", label: "Возможно" },
  { value: "unknown", label: "Не знаю" },
  { value: "probably_no", label: "Скорее нет" },
  { value: "no", label: "Нет" }
];

let selectedMode = "mixed";
let selectedCategoryIds = new Set(categories.map((category) => category.id));
let selectedQuestions = [];
let answers = {};
let currentQuestionIndex = 0;

renderCategories();
bindEvents();
updateSetupInfo();

function bindEvents() {
  modeGrid.addEventListener("click", (event) => {
    const button = event.target.closest(".mode-card");
    if (!button) return;

    selectedMode = button.dataset.mode;
    document.querySelectorAll(".mode-card").forEach((item) => item.classList.remove("is-active"));
    button.classList.add("is-active");
    renderCategories();
    updateSetupInfo();
  });

  document.querySelector("#selectAllCategories").addEventListener("click", () => {
    selectedCategoryIds = new Set(categories.map((category) => category.id));
    renderCategories();
    updateSetupInfo();
  });

  document.querySelector("#clearCategories").addEventListener("click", () => {
    selectedCategoryIds.clear();
    renderCategories();
    updateSetupInfo();
  });

  document.querySelector("#buildQuizButton").addEventListener("click", buildQuiz);
  calculateButton.addEventListener("click", calculateAndRender);
  earlyCalculateButton.addEventListener("click", calculateEarlyResult);
  document.querySelector("#backToSetupButton").addEventListener("click", () => showPanel("setup"));
  document.querySelector("#recalculateButton").addEventListener("click", () => showPanel("setup"));
  continueQuizButton.addEventListener("click", () => showPanel("quiz"));

  prevQuestionButton.addEventListener("click", () => {
    saveCurrentAnswer(false);
    currentQuestionIndex = Math.max(0, currentQuestionIndex - 1);
    renderCurrentQuestion();
  });

  nextQuestionButton.addEventListener("click", () => {
    if (!saveCurrentAnswer(true)) return;
    currentQuestionIndex = Math.min(selectedQuestions.length - 1, currentQuestionIndex + 1);
    renderCurrentQuestion();
  });

  questionLimitSelect.addEventListener("change", updateSetupInfo);
}

function renderCategories() {
  categoryGrid.innerHTML = categories.map((category) => {
    const active = selectedCategoryIds.has(category.id) ? "is-active" : "";
    const count = countQuestionsForCategory(category.id);
    return `
      <button class="category-card ${active}" type="button" data-category="${category.id}">
        <strong>${category.title}</strong>
        <small>${category.description}</small>
        <small>${count} вопросов</small>
      </button>
    `;
  }).join("");

  categoryGrid.querySelectorAll(".category-card").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.category;
      if (selectedCategoryIds.has(id)) selectedCategoryIds.delete(id);
      else selectedCategoryIds.add(id);
      button.classList.toggle("is-active", selectedCategoryIds.has(id));
      updateSetupInfo();
    });
  });
}

function countQuestionsForCategory(categoryId) {
  return questions.filter((q) => q.category === categoryId && matchesMode(q)).length;
}

function matchesMode(question) {
  if (selectedMode === "mixed") return true;
  if (selectedMode === "serious") return question.tone !== "funny";
  if (selectedMode === "funny") return question.tone !== "serious";
  return true;
}

function getFilteredQuestions() {
  return questions.filter((question) => selectedCategoryIds.has(question.category) && matchesMode(question));
}

function updateSetupInfo() {
  const filtered = getFilteredQuestions();
  const limit = questionLimitSelect.value;
  const finalCount = limit === "all" ? filtered.length : Math.min(Number(limit), filtered.length);
  setupInfo.textContent = selectedCategoryIds.size
    ? `${finalCount} из ${filtered.length} вопросов`
    : "Выбери хотя бы одну категорию";
}

function buildQuiz() {
  const filtered = getFilteredQuestions();
  if (!filtered.length) {
    setupInfo.textContent = "Нет вопросов для выбранных настроек";
    return;
  }

  const limit = questionLimitSelect.value;
  selectedQuestions = limit === "all"
    ? shuffle(filtered, `${userNameInput.value}-${selectedMode}-all`)
    : pickQuestions(filtered, Number(limit), `${userNameInput.value}-${selectedMode}-${selectedCategoryIds.size}`);

  answers = Object.fromEntries(selectedQuestions.map((question) => [question.id, undefined]));
  currentQuestionIndex = 0;
  quizInfo.textContent = "";
  renderCurrentQuestion();
  showPanel("quiz");
}

function pickQuestions(list, limit, seedText) {
  const byCategory = new Map();
  for (const question of list) {
    if (!byCategory.has(question.category)) byCategory.set(question.category, []);
    byCategory.get(question.category).push(question);
  }

  const selected = [];
  const categoryOrder = categories.map((category) => category.id).filter((id) => byCategory.has(id));

  for (const categoryId of categoryOrder) {
    const pool = shuffle(byCategory.get(categoryId), `${seedText}-${categoryId}`);
    const count = Math.max(1, Math.floor(limit / categoryOrder.length));
    selected.push(...pool.slice(0, count));
  }

  if (selected.length < limit) {
    const selectedIds = new Set(selected.map((q) => q.id));
    const rest = shuffle(list.filter((q) => !selectedIds.has(q.id)), `${seedText}-rest`);
    selected.push(...rest.slice(0, limit - selected.length));
  }

  return shuffle(selected.slice(0, limit), `${seedText}-final`);
}

function shuffle(list, seedText) {
  const result = [...list];
  let seed = hash(seedText) || 1;

  for (let i = result.length - 1; i > 0; i -= 1) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const j = seed % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }

  return result;
}

function hash(text) {
  let h = 0;
  for (let i = 0; i < text.length; i += 1) {
    h = ((h << 5) - h + text.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function renderCurrentQuestion() {
  const question = selectedQuestions[currentQuestionIndex];
  if (!question) return;

  quizForm.innerHTML = renderQuestion(question, currentQuestionIndex);
  bindCurrentQuestion(question);
  updateProgress();
  updateNavigation();
  quizInfo.textContent = "";
}

function renderQuestion(question, index) {
  const hint = question.hint ? `<p class="question-hint">${question.hint}</p>` : "";

  return `
    <article class="question-card" data-id="${question.id}">
      <p class="question-counter">Вопрос ${index + 1} из ${selectedQuestions.length}</p>
      <h2 class="question-title">${question.title}</h2>
      ${hint}
      <div class="answer-block">
        ${renderInput(question)}
      </div>
    </article>
  `;
}

function renderInput(question) {
  const stored = answers[question.id];
  const value = stored ?? question.default;

  if (question.type === "range") {
    const labels = getRangeLabels(question);
    return `
      <div class="range-row">
        <input type="range" min="${question.min}" max="${question.max}" value="${value}" data-input="${question.id}" />
        <span class="range-value" data-range-value="${question.id}">${value}/10</span>
      </div>
      <div class="scale-help">
        <span>${labels.low}</span>
        <span>${labels.high}</span>
      </div>
    `;
  }

  if (question.type === "number") {
    const unit = question.unit ? ` ${question.unit}` : "";
    return `
      <input type="number" min="${question.min}" max="${question.max}" value="${value}" data-input="${question.id}" />
      <p class="input-note">Диапазон: ${question.min}${unit} — ${question.max}${unit}</p>
    `;
  }

  if (question.type === "select") {
    return `
      <select data-input="${question.id}">
        <option value="" ${stored === undefined ? "selected" : ""} disabled>Выбери вариант</option>
        ${question.options.map((option, index) => `
          <option value="${index}" ${Number(stored) === index ? "selected" : ""}>${option.label}</option>
        `).join("")}
      </select>
    `;
  }

  if (question.type === "boolean") {
    return `
      <div class="boolean-row" data-boolean="${question.id}">
        ${booleanChoices.map((choice) => `
          <button class="choice-button ${stored === choice.value ? "is-active" : ""}" type="button" data-value="${choice.value}">${choice.label}</button>
        `).join("")}
      </div>
    `;
  }

  return "";
}

function bindCurrentQuestion(question) {
  quizForm.querySelectorAll("[data-input]").forEach((input) => {
    input.addEventListener("input", () => {
      const rangeValue = quizForm.querySelector(`[data-range-value="${question.id}"]`);
      if (rangeValue) rangeValue.textContent = `${input.value}/10`;
    });
  });

  quizForm.querySelectorAll("[data-boolean]").forEach((row) => {
    row.addEventListener("click", (event) => {
      const button = event.target.closest(".choice-button");
      if (!button) return;

      answers[question.id] = button.dataset.value;
      row.querySelectorAll(".choice-button").forEach((item) => item.classList.remove("is-active"));
      button.classList.add("is-active");
      updateProgress();

      window.setTimeout(() => {
        if (currentQuestionIndex < selectedQuestions.length - 1) {
          currentQuestionIndex += 1;
          renderCurrentQuestion();
        } else {
          updateNavigation();
        }
      }, 180);
    });
  });
}

function saveCurrentAnswer(showMessage) {
  const question = selectedQuestions[currentQuestionIndex];
  if (!question) return false;

  if (question.type === "boolean") {
    if (answers[question.id] === undefined) {
      if (showMessage) quizInfo.textContent = "Выбери один из вариантов ответа";
      return false;
    }
    return true;
  }

  const input = quizForm.querySelector(`[data-input="${question.id}"]`);
  if (!input) return false;

  if (question.type === "select" && input.value === "") {
    if (showMessage) quizInfo.textContent = "Выбери вариант из списка";
    return false;
  }

  if (question.type === "number") {
    const value = Number(input.value);
    if (!Number.isFinite(value)) {
      if (showMessage) quizInfo.textContent = "Введи число";
      return false;
    }
    answers[question.id] = clamp(value, question.min, question.max);
  } else if (question.type === "range") {
    answers[question.id] = Number(input.value);
  } else {
    answers[question.id] = input.value;
  }

  updateProgress();
  return true;
}

function updateProgress() {
  const total = selectedQuestions.length || 1;
  const answered = selectedQuestions.filter((question) => answers[question.id] !== undefined).length;
  const percent = Math.round((answered / total) * 100);
  progressBar.style.width = `${percent}%`;
  progressText.textContent = `${answered}/${total}`;
}

function updateNavigation() {
  prevQuestionButton.disabled = currentQuestionIndex === 0;
  const isLast = currentQuestionIndex === selectedQuestions.length - 1;
  nextQuestionButton.classList.toggle("is-hidden", isLast);
  calculateButton.classList.toggle("is-hidden", !isLast);
  const answered = selectedQuestions.filter((question) => answers[question.id] !== undefined).length;
  earlyCalculateButton.disabled = answered < 5;
}

function getRangeLabels(question) {
  if (question.lowLabel && question.highLabel) {
    return { low: question.lowLabel, high: question.highLabel };
  }

  if (question.effect === "negative") {
    return { low: "1 — почти нет", high: "10 — постоянно" };
  }

  if (question.effect === "ideal") {
    return { low: "1 — слишком мало", high: "10 — перебор" };
  }

  if (question.effect === "screenTime") {
    return { low: "1 — почти не сидишь", high: "10 — телефон врос в руку" };
  }

  return { low: "1 — слабо", high: "10 — максимум" };
}

function getAnsweredQuestions() {
  return selectedQuestions.filter((question) => answers[question.id] !== undefined);
}

function calculateEarlyResult() {
  saveCurrentAnswer(false);
  const answeredQuestions = getAnsweredQuestions();

  if (answeredQuestions.length < 5) {
    quizInfo.textContent = "Ответь хотя бы на 5 вопросов, чтобы досрочный результат не был гаданием на носках";
    updateNavigation();
    return;
  }

  const result = calculateAura({
    selectedQuestions: answeredQuestions,
    answers,
    userName: userNameInput.value,
    resultStyle: resultStyleSelect.value
  });

  renderResult(result, {
    partial: true,
    answered: answeredQuestions.length,
    total: selectedQuestions.length
  });
  showPanel("result");
}

function calculateAndRender() {
  if (!saveCurrentAnswer(true)) return;

  const unansweredIndex = selectedQuestions.findIndex((question) => answers[question.id] === undefined);
  if (unansweredIndex !== -1) {
    currentQuestionIndex = unansweredIndex;
    renderCurrentQuestion();
    quizInfo.textContent = "Этот вопрос еще без ответа";
    return;
  }

  const result = calculateAura({
    selectedQuestions,
    answers,
    userName: userNameInput.value,
    resultStyle: resultStyleSelect.value
  });

  renderResult(result, { partial: false, answered: selectedQuestions.length, total: selectedQuestions.length });
  showPanel("result");
}

function renderResult(result, meta = { partial: false, answered: 0, total: 0 }) {
  const name = userNameInput.value.trim() || "Безымянный герой";
  document.querySelector(".eyebrow").textContent = meta.partial ? `Промежуточно: ${meta.answered}/${meta.total}` : "Итоговый результат";
  document.querySelector("#resultName").textContent = `${name}: ${result.rank} — ${result.chance}%`;
  continueQuizButton.classList.toggle("is-hidden", !meta.partial);
  document.querySelector("#chanceValue").textContent = `${result.chance}%`;
  document.querySelector("#mainVerdict").textContent = result.verdict;

  const degrees = Math.round((result.chance / 100) * 360);
  const ring = document.querySelector("#scoreRing");
  ring.style.background = `conic-gradient(var(--accent) 0deg, var(--accent) ${degrees}deg, rgba(255,255,255,.08) ${degrees}deg)`;

  const reasonList = document.querySelector("#reasonList");
  reasonList.innerHTML = result.reasons.length
    ? result.reasons.map((reason) => `<li>${reason}</li>`).join("")
    : "<li>Система не нашла ярких причин. Подозрительно ровная анкета.</li>";

  const categoryScores = document.querySelector("#categoryScores");
  categoryScores.innerHTML = result.categoryScores.map((item) => `
    <div class="category-score">
      <div class="category-score__top">
        <strong>${item.title}</strong>
        <span>${item.score}%</span>
      </div>
      <div class="category-score__bar"><span style="width:${item.score}%"></span></div>
      <small class="muted">Вопросов: ${item.count}</small>
    </div>
  `).join("");
}

function showPanel(name) {
  document.body.dataset.screen = name;
  setupPanel.classList.toggle("is-hidden", name !== "setup");
  quizPanel.classList.toggle("is-hidden", name !== "quiz");
  resultPanel.classList.toggle("is-hidden", name !== "result");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
