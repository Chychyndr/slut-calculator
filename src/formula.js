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

const idealTargets = {
  style_score: 7,
  skin_care: 6,
  perfume_amount: 5,
  voice_messages: 4,
  confidence: 7,
  date_budget_balance: 5,
  initiative: 6,
  awkwardness: 4,
  meme_language: 5
};

function scoreRange(q, value) {
  const v = Number(value);
  const w = q.weight;
  const centered = (v - 5.5) / 4.5;

  if (q.effect === "positive") return centered * w;
  if (q.effect === "negative") return -centered * w;

  if (q.effect === "screenTime") {
    if (v <= 3) return 4;
    if (v <= 5) return 2;
    if (v <= 7) return -3;
    return -w;
  }

  if (q.effect === "ideal") {
    const target = idealTargets[q.id] ?? q.default ?? 5;
    const distance = Math.abs(v - target);
    return clamp(1 - distance / 4.2, -1, 1) * w;
  }

  return 0;
}

function scoreNumber(q, value) {
  const v = Number(value);
  const w = q.weight;

  if (q.scorer === "age") {
    if (v < 14) return -w;
    if (v < 18) return -3;
    if (v <= 27) return w * 0.85;
    if (v <= 35) return w * 0.55;
    if (v <= 45) return w * 0.25;
    return -w * 0.2;
  }

  if (q.scorer === "height") {
    const target = 182;
    const distance = Math.abs(v - target);
    return clamp(1 - distance / 42, -0.65, 1) * w;
  }

  if (q.scorer === "replyMinutes") {
    if (v <= 1) return -w * 0.7;
    if (v <= 10) return w * 0.1;
    if (v <= 90) return w;
    if (v <= 240) return w * 0.25;
    if (v <= 720) return -w * 0.35;
    return -w;
  }

  if (q.scorer === "sleepHours") {
    const distance = Math.abs(v - 7.5);
    return clamp(1 - distance / 4, -1, 1) * w;
  }

  if (q.scorer === "dotaMmr") {
    if (v === 0) return w * 0.55;
    if (v < 1500) return -w * 0.15;
    if (v < 3500) return -w * 0.45;
    if (v < 6000) return -w * 0.75;
    if (v < 8500) return -w * 0.55;
    return -w * 0.35;
  }

  if (q.scorer === "gameHours") {
    if (v === 0) return w * 0.2;
    if (v < 500) return w * 0.1;
    if (v < 2000) return -w * 0.25;
    if (v < 6000) return -w * 0.65;
    return -w;
  }

  if (q.scorer === "gameHoursSoft") {
    if (v === 0) return 0;
    if (v < 800) return 2;
    if (v < 3000) return -w * 0.25;
    return -w * 0.7;
  }

  return 0;
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

function noish(value) {
  return boolPower(value) <= 0.25;
}

function getRank(chance) {
  if (chance < 5) return "социальный Чернобыль";
  if (chance < 15) return "ходячий красный флаг";
  if (chance < 25) return "пока только теоретик";
  if (chance < 35) return "шанс есть, но где-то далеко";
  if (chance < 45) return "NPC с потенциалом";
  if (chance < 55) return "нормис на минималках";
  if (chance < 65) return "уже можно выпускать в люди";
  if (chance < 75) return "опасный тип";
  if (chance < 85) return "харизматичный подозреваемый";
  if (chance < 95) return "легенда района";
  return "финальный босс свиданий";
}

function getVerdict(chance, style) {
  const soft = style === "soft";
  const roast = style === "roast";

  if (chance < 15) {
    return roast
      ? "Алгоритм увидел анкету и тихо закрыл вкладку. Тут нужен не патч, а полная переустановка личности."
      : "Результат низкий. Больше всего мешают красные флаги, гигиена или социальная адекватность.";
  }

  if (chance < 35) {
    return roast
      ? "Шанс есть примерно как шанс выиграть катку с Techies в команде. Теоретически бывает, но лучше не надеяться."
      : "Пока слабовато, но часть проблем чинится простыми вещами: уход, спокойное общение, нормальные планы.";
  }

  if (chance < 55) {
    return soft
      ? "Средний результат. Уже есть база, но несколько привычек сильно тянут вниз."
      : "Ты не провалился, но система видит спорные моменты. Где-то рядом стоит стул-шкаф и смотрит на тебя.";
  }

  if (chance < 75) {
    return roast
      ? "В целом живой, местами даже интересный. Не начинай рассказывать про MMR, и все может быть нормально."
      : "Хороший результат. Есть понятная база: общение, уход, самостоятельность или нормальная социальная прошивка.";
  }

  if (chance < 90) {
    return roast
      ? "Опасный уровень. Главное не поверить в себя настолько, чтобы начать говорить 'я сигма' вслух."
      : "Сильный результат. Анкета показывает уверенность, нормальную бытовую базу и приемлемый уровень кринжа.";
  }

  return roast
    ? "Почти финальный босс. Либо ты правда хорош, либо слишком красиво соврал анкете. Алгоритм подозревает второе."
    : "Очень высокий результат. Система нашла мало слабых мест, но слишком идеальные ответы тоже выглядят подозрительно.";
}

function addCombo(reasons, rawDelta, text, hiddenReasons) {
  hiddenReasons.push({ score: rawDelta, text, combo: true });
  return rawDelta;
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

  let cap = 99.9;
  const selectedIds = new Set(selectedQuestions.map((question) => question.id));
  const a = (id) => selectedIds.has(id) ? getAnswer(answers, id) : undefined;

  const hygieneAvg = avg([a("shower_frequency"), a("teeth"), a("deodorant"), a("laundry"), a("hair_wash")]);
  const communicationAvg = avg([a("listening"), a("questions_skill"), a("humor"), a("light_talk"), 11 - a("interrupts")]);
  const socialAvg = avg([a("empathy"), 11 - a("jealousy"), 11 - a("control_level"), 11 - a("aggression")]);
  const homeAvg = avg([a("cooking"), a("clean_room"), a("room_smell")]);

  if (noish(a("respects_boundaries"))) {
    cap = Math.min(cap, 5);
    hiddenReasons.push({ score: -50, text: "Красный флаг: личные границы не уважаются. Итог почти обнулен." });
  }

  if (noish(a("accepts_no"))) {
    cap = Math.min(cap, 4);
    hiddenReasons.push({ score: -55, text: "Красный флаг: отказ нужно принимать спокойно. Без этого высокий результат невозможен." });
  }

  if (Number(a("age")) < 18) {
    cap = Math.min(cap, 80);
    hiddenReasons.push({ score: -5, text: "Возраст меньше 18: результат считается как шуточный шанс нормального общения со сверстниками." });
  }

  if (hygieneAvg <= 3.2) {
    cap = Math.min(cap, 42);
    hiddenReasons.push({ score: -22, text: "Гигиена слишком низкая. Харизма не должна пахнуть как старый рюкзак." });
  }

  if (Number(a("aggression")) >= 8) {
    cap = Math.min(cap, 25);
    hiddenReasons.push({ score: -25, text: "Высокая агрессия режет максимум результата." });
  }

  if (Number(a("control_level")) >= 8 || Number(a("jealousy")) >= 9) {
    cap = Math.min(cap, 35);
    hiddenReasons.push({ score: -20, text: "Контроль и ревность быстро ломают любой вайб." });
  }

  if (hygieneAvg >= 7.5 && communicationAvg >= 7 && socialAvg >= 7) {
    raw += addCombo(hiddenReasons, 18, "Сильное комбо: уход + общение + адекватность. Это база, которая тащит результат.", hiddenReasons);
  }

  if (Number(a("confidence")) >= 9 && Number(a("empathy")) <= 4) {
    raw += addCombo(hiddenReasons, -16, "Уверенность без эмпатии выглядит как режим главного героя в плохом смысле.", hiddenReasons);
  }

  if (Number(a("confidence")) <= 3 && communicationAvg >= 7) {
    raw += addCombo(hiddenReasons, 7, "Скромность не убивает шанс, если ты нормально общаешься.", hiddenReasons);
  }

  if (Number(a("money_flex")) >= 8 && Number(a("money_stability")) >= 7) {
    raw += addCombo(hiddenReasons, -12, "Деньги есть, но понты съедают часть бонуса.", hiddenReasons);
  }

  if (Number(a("dota_mmr")) >= 5500 && hygieneAvg >= 7 && communicationAvg >= 6.5) {
    raw += addCombo(hiddenReasons, 8, "Неожиданно: высокий MMR не убил анкету, потому что остальная жизнь не развалилась.", hiddenReasons);
  }

  if (Number(a("dota_mmr")) >= 3000 && Number(a("shower_frequency")) <= 4) {
    raw += addCombo(hiddenReasons, -18, "Комбо-проблема: Dota + редкий душ. Система попросила открыть окно.", hiddenReasons);
  }

  if (yesish(a("hospital_without_mom")) && yesish(a("book_barber")) && yesish(a("call_delivery")) && yesish(a("washing_machine"))) {
    raw += addCombo(hiddenReasons, 12, "Взрослая аура: больница, парикмахер, доставка и стиралка проходят без рейд-босса мамы.", hiddenReasons);
  }

  if (yesish(a("chair_wardrobe")) && Number(a("clean_room")) <= 4) {
    raw += addCombo(hiddenReasons, -10, "Стул-шкаф подтвержден. Бытовая зона просит помощи.", hiddenReasons);
  }

  if (Number(a("meme_language")) >= 8 && communicationAvg < 5.5) {
    raw += addCombo(hiddenReasons, -9, "Мемы вместо речи работают плохо. Человеку нужен собеседник, а не паблик с картинками.", hiddenReasons);
  }

  if (Number(a("meme_language")) >= 6 && communicationAvg >= 7) {
    raw += addCombo(hiddenReasons, 5, "Мемы не мешают, потому что ты все еще умеешь говорить нормально.", hiddenReasons);
  }

  if (Number(a("reply_minutes")) <= 1 && Number(a("message_spam")) >= 7) {
    raw += addCombo(hiddenReasons, -12, "Переписка выглядит слишком голодной: мгновенный ответ + очередь сообщений.", hiddenReasons);
  }

  if (Number(a("reply_minutes")) >= 10 && Number(a("reply_minutes")) <= 120 && Number(a("message_spam")) <= 4 && communicationAvg >= 6) {
    raw += addCombo(hiddenReasons, 6, "Темп переписки нормальный: без пропажи и без пулемета сообщений.", hiddenReasons);
  }

  if (homeAvg >= 7 && hygieneAvg >= 7) {
    raw += addCombo(hiddenReasons, 7, "Быт и гигиена дружат. Это скучно, зато очень эффективно.", hiddenReasons);
  }

  if (yesish(a("joker_quotes")) && yesish(a("lonely_wolf_status")) && yesish(a("dark_lord_nick"))) {
    raw += addCombo(hiddenReasons, -14, "Комбо темного волка: Джокер, статус и ник сошлись в одну тучу.", hiddenReasons);
  }

  if (yesish(a("can_choose_place")) && Number(a("initiative")) >= 5 && Number(a("initiative")) <= 7 && yesish(a("normal_pace"))) {
    raw += addCombo(hiddenReasons, 9, "Свидательная база: место выбрано, инициатива есть, давление не включено.", hiddenReasons);
  }

  if (yesish(a("home_movie_too_early")) && noish(a("normal_pace"))) {
    raw += addCombo(hiddenReasons, -16, "Темп общения слишком резкий. Алгоритм нажал тормоз.", hiddenReasons);
  }

  if (selectedQuestions.length >= 50) {
    const tooPerfect = selectedQuestions.filter((q) => {
      const value = getAnswer(answers, q.id);
      if (q.type === "range") return Number(value) >= 9 && q.effect === "positive";
      if (q.type === "boolean") return boolPower(value) >= 0.75 && q.yesScore > 0;
      return false;
    }).length;

    if (tooPerfect / selectedQuestions.length > 0.72) {
      raw += addCombo(hiddenReasons, -9, "Слишком идеальная анкета. Система подозревает режим 'я мамой клянусь'.", hiddenReasons);
    }
  }


  const vagueAnswers = selectedQuestions.filter((q) => {
    const value = getAnswer(answers, q.id);
    return q.type === "boolean" && (value === "maybe" || value === "unknown");
  }).length;

  if (selectedQuestions.length >= 20 && vagueAnswers / selectedQuestions.length > 0.35) {
    raw += addCombo(hiddenReasons, -6, "Слишком много ответов в стиле 'возможно'. Алгоритм почувствовал уклонение от ответственности.", hiddenReasons);
  }

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

function avg(values) {
  const nums = values.map(Number).filter((v) => Number.isFinite(v));
  if (!nums.length) return 5;
  return nums.reduce((sum, value) => sum + value, 0) / nums.length;
}
