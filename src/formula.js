import { categories, questions } from "./questions.js";

const questionMap = new Map(questions.map((q) => [q.id, q]));
const categoryMap = new Map(categories.map((c) => [c.id, c]));

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function sigmoid(x) {
  return 1 / (1 + Math.exp(-x));
}

function hashString(text) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return Math.abs(hash >>> 0);
}

function signedNameNoise(name) {
  if (!name) return 0;
  const hash = hashString(name.toLowerCase().trim());
  return ((hash % 500) / 100) - 2.5;
}

function getAnswer(answers, id) {
  const q = questionMap.get(id);
  if (!q) return undefined;
  const value = answers[id];
  return value === undefined || value === null || value === "" ? q.default : value;
}

function scoreRange(q, value) {
  const centered = (clamp(Number(value), q.min, q.max) - 5.5) / 4.5;
  return (q.effect === "positive" ? centered : -centered) * q.weight;
}

function scoreNumber(q, value) {
  const v = clamp(Number(value), q.min, q.max);
  const w = q.weight;
  switch (q.scorer) {
    case "dotaMmr": return v === 0 ? w * 0.5 : v >= 9000 ? w * 0.4 : v >= 3000 ? -w : -w * 0.4;
    case "gameHours": return v < 300 ? w * 0.4 : v < 2000 ? 0 : v < 6000 ? -w * 0.6 : -w;
    case "tabs": return v <= 5 ? w * 0.5 : v <= 30 ? 0 : v <= 100 ? -w * 0.5 : -w;
    case "packages": return v <= 2 ? 0 : v <= 10 ? w * 0.6 : -w;
    default: return 0;
  }
}

const booleanFactors = {
  yes: 1,
  probably_yes: 0.75,
  maybe: 0.55,
  unknown: null,
  probably_no: 0.25,
  no: 0
};

const booleanLabels = {
  yes: "да",
  probably_yes: "скорее да",
  maybe: "возможно",
  unknown: "не знаю",
  probably_no: "скорее нет",
  no: "нет"
};

function scoreBoolean(q, rawValue) {
  if (rawValue === true) return q.yesScore;
  if (rawValue === false) return q.noScore;

  const factor = booleanFactors[rawValue];
  if (factor === null || factor === undefined) return 0;

  const base = q.noScore + (q.yesScore - q.noScore) * factor;

  // Небольшой штраф за слишком частое "возможно" появится через общий расчет,
  // но сам ответ остается почти нейтральным.
  return base;
}

function scoreQuestion(q, rawValue) {
  if (q.type === "range") return scoreRange(q, rawValue);
  if (q.type === "number") return scoreNumber(q, rawValue);
  if (q.type === "boolean") return scoreBoolean(q, rawValue);

  if (q.type === "select") {
    const index = Number(rawValue);
    return q.options[index]?.score ?? 0;
  }

  return 0;
}

function labelAnswer(q, value) {
  if (q.type === "boolean") return booleanLabels[value] ?? (value ? "да" : "нет");
  if (q.type === "select") return q.options[Number(value)]?.label ?? "не выбрано";
  if (q.type === "number") return `${value}${q.unit ? ` ${q.unit}` : ""}`;
  return `${value}/10`;
}

function boolPower(value) {
  if (value === true) return 1;
  if (value === false) return 0;
  if (booleanFactors[value] === null || booleanFactors[value] === undefined) return 0.5;
  return booleanFactors[value];
}

function yesish(value) {
  return boolPower(value) >= 0.75;
}

function getRank(chance) {
  if (chance < 5) return "на аву в школьный чат";
  if (chance < 15) return "бро, удали";
  if (chance < 25) return "прайм был до рождения";
  if (chance < 35) return "вышел из чата";
  if (chance < 45) return "фон на чужом эдите";
  if (chance < 55) return "ещё живой";
  if (chance < 65) return "прошёл отбор в лс";
  if (chance < 75) return "свой в реках";
  if (chance < 85) return "в прайме";
  if (chance < 95) return "могает на заднем плане";
  return "сам ходилки-бродилки";
}

const verdicts = [
  ["Бро, с этого аккаунта больше никому не пиши.", "На твоих поминках краш спросит, кто это.", "Ну хотя бы в группу тебя добавили."],
  ["У человека на тебя реакция 💀, и то случайно.", "Тебя даже в архив не кинули. Просто удалили чат.", "На всякий случай сохрани красивую фотку."],
  ["Скрин уже в группе, там решают.", "На тебе тестировали функцию «ограничить аккаунт».", "Половина ответов выглядит как алиби."],
  ["Норм, главное не кидай голосовое.", "До первого кружка всё должно быть хорошо.", "Возможно, это взаимно. Не спугни."],
  ["Бро зашёл в прайм.", "Надеемся, что это ты проходил тест, а не твой друг.", "Краш уже поставил реакцию, можешь выдыхать."],
  ["Пруфы будут? Или у тебя Vertu?", "Слишком много ауры. 27 ноября медведь идёт за тобой лично.", "Сохраняем скрин, второй раз так не получится."]
];

function getVerdict(chance, style) {
  const index = chance < 15 ? 0 : chance < 35 ? 1 : chance < 55 ? 2 : chance < 75 ? 3 : chance < 90 ? 4 : 5;
  return verdicts[index][style === "roast" ? 1 : style === "soft" ? 2 : 0];
}

export function calculateAura({ selectedQuestions, answers, userName = "", resultStyle = "balanced" }) {
  const reasons = [];
  const hiddenReasons = [];
  const categoryData = new Map();

  for (const category of categories) {
    categoryData.set(category.id, { raw: 0, max: 0, title: category.title, count: 0 });
  }

  let raw = 0;
  let maxPossible = 0;

  for (const q of selectedQuestions) {
    const value = getAnswer(answers, q.id);
    const score = scoreQuestion(q, value);
    const max = Math.max(1, q.weight ?? Math.abs(score));
    raw += score;
    maxPossible += max;

    const category = categoryData.get(q.category);
    if (category) {
      category.raw += score;
      category.max += max;
      category.count += 1;
    }

    const abs = Math.abs(score);
    if (abs >= Math.max(5, max * 0.75)) {
      const prefix = score > 0 ? "+" : "-";
      reasons.push({
        score,
        text: `${prefix} ${q.title}: ${labelAnswer(q, value)}`
      });
    }
  }

  // Every combo uses only explicitly answered questions; there are no real-life eligibility caps.
  const answered = new Set(selectedQuestions.filter(q => answers[q.id] !== undefined && answers[q.id] !== null && answers[q.id] !== "").map(q => q.id));
  const yes = (id) => answered.has(id) && yesish(answers[id]);
  const atLeast = (id, threshold) => answered.has(id) && Number(answers[id]) >= threshold;
  const combos = [
    { when: yes("home_04") && yes("home_02"), delta: -12, text: "Стул заняли, кровать заняли. Ты следующий." },
    { when: yes("hygiene_03") && yes("hygiene_02"), delta: -12, text: "Носки уже вышли из дома. Футболка догоняет." },
    { when: yes("communication_02") && yes("date_08"), delta: -9, text: "Два сообщения, три скрина, семь экспертов. Итог: ничего не понятно." },
    { when: yes("confidence_07") && yes("appearance_08"), delta: -10, text: "Моггинг отменён, бутылка закрыта." },
    { when: yes("gaming_03") && yes("money_07"), delta: -10, text: "Скин есть. Обеда нет." },
    { when: atLeast("gaming_hours", 6000) && atLeast("gaming_mmr", 9000), delta: 10, text: "Мама не зря потеряла сына на восемь тысяч часов." },
    { when: yes("absurd_06") && yes("internet_01"), delta: 12, text: "27 ноября ты освобождён от всех уроков. Справка от медведя." },
    { when: yes("date_07") && yes("communication_01"), delta: -9, text: "Встречи не было, сообщения не было. Пруфов тоже нет." },
    { when: yes("internet_02") && yes("appearance_03"), delta: 9, text: "Фоток нет. В прайме был. Верьте." },
    { when: yes("home_05") && atLeast("home_packages", 20), delta: -10, text: "Холодильник без обновлений, зато пакеты спавнятся." }
  ];
  for (const combo of combos) {
    if (!combo.when) continue;
    raw += combo.delta;
    hiddenReasons.push({ score: combo.delta, text: combo.text, combo: true });
  }

  const vague = selectedQuestions.filter(q => answered.has(q.id) && q.type === "boolean" && ["maybe", "unknown"].includes(answers[q.id])).length;
  if (selectedQuestions.length >= 20 && vague / selectedQuestions.length > 0.35) {
    raw -= 6;
    hiddenReasons.push({ score: -6, text: "Столько ответов «не знаю», что калькулятор тоже решил взять академ." });
  }

  const cap = 99.9;
  const noise = signedNameNoise(userName);
  const normalized = maxPossible > 0 ? raw / Math.max(45, maxPossible * 0.28) : 0;
  let chance = sigmoid(normalized) * 100 + noise;
  chance = clamp(Math.min(chance, cap), 0.1, 99.9);

  const categoryScores = Array.from(categoryData.entries())
    .filter(([, data]) => data.count > 0)
    .map(([id, data]) => {
      const value = data.max > 0 ? clamp(50 + (data.raw / data.max) * 50, 0, 100) : 50;
      return {
        id,
        title: categoryMap.get(id)?.title ?? id,
        score: Number(value.toFixed(1)),
        count: data.count
      };
    })
    .sort((aCat, bCat) => bCat.score - aCat.score);

  const finalReasons = [...hiddenReasons, ...reasons]
    .sort((aReason, bReason) => Math.abs(bReason.score) - Math.abs(aReason.score))
    .slice(0, 9)
    .map((reason) => reason.text);

  return {
    chance: Number(chance.toFixed(1)),
    raw: Number(raw.toFixed(2)),
    cap,
    rank: getRank(chance),
    verdict: getVerdict(chance, resultStyle),
    reasons: finalReasons,
    categoryScores
  };
}

