import type {
  Assignment,
  CriterionId,
  CriterionResult,
  EvaluationResult,
} from "../types";
import {
  CRITERION_STRONG_RATIO,
  EXCELLENT_PERCENT,
  PASS_PERCENT,
} from "../types";

export function isCriterionStrong(
  c: Pick<CriterionResult, "score" | "maxScore" | "found">,
): boolean {
  return c.found && c.score >= c.maxScore * CRITERION_STRONG_RATIO;
}

const CRITERION_META: Record<
  CriterionId,
  { label: string; weight: number; hint: string }
> = {
  role: {
    label: "Роль",
    weight: 12,
    hint: "Коротко достаточно: «Ты — помощник по деловой переписке» или «Действуй как редактор писем».",
  },
  context: {
    label: "Контекст",
    weight: 18,
    hint: "Кому пишем (руководитель, начальник) и факты: проект, причина задержки, что сделано, сроки.",
  },
  task: {
    label: "Задача",
    weight: 25,
    hint: "Что нужно от ИИ: черновик письма, тема, структура, ключевые тезисы — не одно «напиши письмо».",
  },
  tone: {
    label: "Тон и язык",
    weight: 15,
    hint: "Деловой и уважительный тон: «корректно», «на „вы“», «без паники и оправданий».",
  },
  constraints: {
    label: "Ограничения",
    weight: 12,
    hint: "Объём, «не выдумывай цифры и сроки», только факты из контекста, формат подписи.",
  },
  outputFormat: {
    label: "Формат вывода",
    weight: 10,
    hint: "По желанию: тема письма, приветствие, основная часть, подпись — или готовый текст для почты.",
  },
};

/** Латиница + кириллица — в JS \\w кириллицу не матчит */
const CY = "a-zа-яё0-9";
const WORD = `[${CY}]+`;

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/\s+/g, " ")
    .trim();
}

const TASK_DETAIL_RE =
  /(черновик|тема|структур|причин|задержк|план|запрос|факт|блок|уведом|объясн|статус|сделан|риск|срок|помощ)/;

/** Слишком общая просьба «напиши письмо» без деталей задачи */
function capVagueLetterTask(text: string, ratio: number): number {
  const n = normalize(text);
  const words = n.split(/\s+/).filter(Boolean).length;
  const genericOpen =
    /^(напиши|составь|помоги(\s+(мне|\s+)?(написать|составить))?)\s+(письмо|email|e-mail)\b/.test(
      n,
    ) ||
    (/^(напиши|составь)\s+/.test(n) &&
      /(письм|email|e-mail)/.test(n) &&
      words <= 8);
  if (genericOpen && !TASK_DETAIL_RE.test(n)) {
    return Math.min(ratio, 0.34);
  }
  return ratio;
}

/** Получатель назван, но нет фактов по ситуации из задания */
function capSparseLetterContext(text: string, ratio: number): number {
  const n = normalize(text);
  const words = n.split(/\s+/).filter(Boolean).length;
  const hasRecipient = /(руководител|начальник|директор|непосредственн)/.test(
    n,
  );
  const hasSituation =
    /(проект|срок|задержк|заказчик|требован|план|факт|сделан|статус|дедлайн|сдвиг|помощ)/.test(
      n,
    );
  if (words <= 12 && hasRecipient && !hasSituation) {
    return Math.min(ratio, 0.42);
  }
  return ratio;
}

type Matcher = {
  patterns: RegExp[];
  keywords: string[];
  /** Дополнительные баллы за сильные формулировки */
  strong?: RegExp[];
};

const MATCHERS: Record<CriterionId, Matcher> = {
  role: {
    patterns: [
      new RegExp(`ты\\s*[-—–:]\\s*${WORD}`, "i"),
      new RegExp(`я\\s*[-—–:]\\s*${WORD}`, "i"),
      /^(роль|role)\s*[:—–]/im,
      /действуй\s+как/,
      /выступай\s+в\s+роли/,
      /представь\s*,?\s*что\s+ты/,
      /в\s+роли\s+/,
      /как\s+(эксперт|методист|аналитик|юрист|редактор|консультант|копирайтер|секретар)/,
      /аналитик\s+(данных|данные)?/,
      /(методист|юрист|редактор|консультант|эксперт|секретар)\s+(данных|данные)?/,
      /(помощник|ассистент)\s+(по\s+)?(делов|переписк|письм|email|почт)/,
      /редактор\s+(делов|корпоративн)/,
    ],
    keywords: [
      "роль",
      "методист",
      "аналитик",
      "юрист",
      "редактор",
      "эксперт",
      "консультант",
      "переводчик",
      "наставник",
      "специалист по",
      "секретар",
      "копирайтер",
      "переписк",
      "деловой переписк",
    ],
    strong: [
      /ты\s*[-—–]\s*(методист|аналитик|юрист|редактор|секретар)/,
      /помощник\s+по\s+делов/,
    ],
  },
  context: {
    patterns: [
      /(руководител|начальник|директор|непосредственн)/,
      /(начальник|руководител)\s+(отдел|подразделен|проект)/,
      /(письмо|email|e-mail|почт[ауе])\s+(руководит|начальник|директор)/,
      /(проект|задач|срок|дедлайн|задержк|смещен|сдвиг)/,
      /(требован|заказчик|клиент).*(измен|смен)/,
      /(ситуац|контекст|факт|обстоятельств)/,
      /(что\s+уже\s+сделан|выполнен|прогресс|статус\s+проект)/,
      /(нужна\s+помощ|ресурс|согласован|эскалац)/,
      /(корпоративн|служебн|делов)/,
      /(приложен|ниже|вставлен|исходн|договор|регламент|документ|текст|файл)/,
      /^(контекст|context)\s*[:—–]/im,
    ],
    keywords: [
      "руководит",
      "начальник",
      "директор",
      "непосредствен",
      "проект",
      "задержк",
      "срок",
      "заказчик",
      "требован",
      "ситуац",
      "факт",
      "план",
      "помощ",
      "отдел",
      "коллег",
      "сотрудник",
    ],
    strong: [
      /(руководител|начальник).*(проект|срок|задержк)/,
      /письмо\s+(руководит|начальник)/,
    ],
  },
  task: {
    patterns: [
      /(письм|email|e-mail|сообщени)\s+(руководит|начальник|директор|в\s+почт)/,
      /(напиш|состав|подготов|сформулир).*(письм|email|e-mail|черновик|текст\s+письм)/,
      /черновик\s+(письм|email|делов)/,
      /(делов(ое|ой)|служебн(ое|ой))\s+письм/,
      /(тема\s+письм|строка\s+темы|subject)/,
      /(объясн|поясн|излож|расскаж|опиш).*(ситуац|причин|задержк|план)/,
      /(запрос|обоснован|предложен).*(помощ|ресурс|срок)/,
      /(информир|уведом|сообщ).*(руководит|начальник|о\s+ситуац)/,
      /(структурир|разбей).*(письм|текст)/,
      /^(задача|task)\s*[:—–]/im,
    ],
    keywords: [
      "письмо",
      "письм",
      "email",
      "черновик",
      "напиши",
      "составь",
      "тема",
      "обращени",
      "подпись",
      "руководит",
      "начальник",
      "делов",
      "служебн",
      "уведом",
      "объясни",
      "план",
    ],
    strong: [
      /черновик\s+(письм|email)/,
      /(напиш|состав).*(письм|email).*(руководит|начальник)/,
    ],
  },
  tone: {
    patterns: [
      new RegExp(`(прост[${CY}]*\\s+язык|понятн[${CY}]*\\s+язык|доступн)`, "i"),
      /(доброжелательн|вежлив|дружелюбн|уважительн|корректн|сдержанн)/,
      new RegExp(`без\\s+(жаргон|канцеляр|сложн[${CY}]*\\s+термин|паник|эмоци|оправдан)`, "i"),
      /(профессиональн|нейтральн|делов|официально-делов)/,
      /(на\s+«?вы»?|обращени\s+на\s+вы)/,
      /(plain\s+language|простыми\s+словами)/,
      new RegExp(`понятн[${CY}]*\\s+язык`, "i"),
      /доброжелательн/,
    ],
    keywords: [
      "понятн",
      "простым",
      "простой",
      "доброжелатель",
      "без жаргона",
      "канцеляр",
      "доступн",
      "человеческ",
      "нейтральн",
      "вежлив",
      "уважитель",
      "корректн",
      "деловой",
      "сдержан",
    ],
    strong: [
      new RegExp(`прост[${CY}]*\\s+язык`, "i"),
      /доброжелательн/,
      /(делов|уважительн).*(тон|стиль)/,
    ],
  },
  constraints: {
    patterns: [
      /(до\s+\d+\s*(знак|слов|абзац|стр|строк|предложен))/,
      new RegExp(
        `(в\\s+)?(одном|двух|трех|трёх|четырех|пяти|\\d+)\\s+предложен`,
        "i",
      ),
      /(\d+\s*[-–]\s*\d+\s*(знак|слов|пункт))/,
      /(не\s+более|не\s+больше|максимум|огранич)/,
      /(только\s+(на\s+основе|из\s+текста|по\s+документ|из\s+контекста|из\s+факт))/,
      /(не\s+(меняй|искаж).*(факт|цифр|дат))/,
      /(не\s+(выдумыв|придумыв|додумыв|фантаз))/,
      /(опирайся|используй\s+только|строго\s+по\s+текст)/,
      /(если\s+.*\s+не\s+указан)/,
      /\b\d+\s*(знак|слов|абзац|стр|строк|предложен)\b/,
    ],
    keywords: [
      "знак",
      "слов",
      "объем",
      "объём",
      "лимит",
      "огранич",
      "не выдумыв",
      "только текст",
      "основе документа",
      "из контекста",
      "цифр",
      "дат",
      "подпис",
      "факт",
      "точность",
      "предложен",
      "1000",
      "500",
    ],
    strong: [/до\s+\d+\s*знак/, /не\s+выдумыв/],
  },
  outputFormat: {
    patterns: [
      /(маркированн|нумерованн)\s+список/,
      new RegExp(`(формат|структур[${CY}]*\\s+ответ)`, "i"),
      /(блок|раздел|заголовок)\s*[«:"]/,
      /(таблиц|markdown|md)/,
      /(суть\s*[:—]|важно\s+знать|ключевые\s+пункты\s*[:—])/,
      /(тема\s+письма|обращени[ея]\s*[:—]|подпис[ьи]\s*[:—])/,
      /(приветстви[ея]|основная\s+часть|заключени[ея])/,
      /(\d+\s*[-–]\s*\d+\s+пункт)/,
    ],
    keywords: [
      "список",
      "формат",
      "структура",
      "раздел",
      "блок",
      "таблица",
      "заголовок",
      "маркирован",
      "нумерац",
      "приветств",
      "подпис",
      "тема письма",
    ],
    strong: [
      new RegExp(`маркированн[${CY}]*\\s+список`, "i"),
      new RegExp(`структур[${CY}]*\\s+ответ`, "i"),
    ],
  },
};

function scoreCriterion(id: CriterionId, raw: string): Omit<CriterionResult, "id" | "label" | "hint"> {
  const text = normalize(raw);
  const meta = CRITERION_META[id];
  const m = MATCHERS[id];
  const maxScore = meta.weight;

  if (raw.trim().length < 10) {
    return {
      score: 0,
      maxScore,
      found: false,
      feedback: "Промпт слишком короткий — добавьте роль, задачу и контекст.",
    };
  }

  let patternHits = 0;
  for (const p of m.patterns) {
    if (p.test(text)) patternHits++;
  }

  let keywordHits = 0;
  for (const kw of m.keywords) {
    if (text.includes(normalize(kw))) keywordHits++;
  }

  let hasStrong = false;
  if (m.strong) {
    for (const s of m.strong) {
      if (s.test(text)) {
        hasStrong = true;
        break;
      }
    }
  }

  let ratio = 0;
  if (patternHits > 0) ratio += 0.38;
  if (patternHits > 1) ratio += 0.12;
  if (keywordHits > 0) ratio += 0.28;
  if (keywordHits > 1) ratio += 0.1;
  if (hasStrong) ratio = Math.max(ratio, 0.92);

  // Короткая формулировка достаточна — не требуем «простыни»
  if (patternHits >= 1) ratio = Math.max(ratio, 0.55);
  if (patternHits >= 1 && keywordHits >= 1) ratio = Math.max(ratio, 0.78);
  if (patternHits >= 2 && keywordHits >= 1) ratio = Math.max(ratio, 0.88);

  if (id === "task") {
    ratio = capVagueLetterTask(text, ratio);
    if (/^сократи\b/.test(text)) {
      ratio = Math.min(ratio, 0.32);
    }
  }
  if (id === "context") {
    ratio = capSparseLetterContext(text, ratio);
  }

  ratio = Math.min(1, ratio);
  const score = Math.round(ratio * maxScore);
  const found = score >= maxScore * 0.42;

  let feedback: string;
  if (
    id === "task" &&
    score > 0 &&
    score < maxScore * CRITERION_STRONG_RATIO &&
    capVagueLetterTask(text, 1) <= 0.34
  ) {
    feedback =
      "Задача сформулирована слишком общо — уточните, что должно быть в письме.";
  } else if (
    id === "context" &&
    score > 0 &&
    score < maxScore * CRITERION_STRONG_RATIO &&
    capSparseLetterContext(text, 1) <= 0.42
  ) {
    feedback =
      "Указан получатель, но не хватает фактов по ситуации (проект, сроки, причина).";
  } else if (score >= maxScore * 0.85) {
    feedback = "Есть, этого достаточно.";
  } else if (found) {
    feedback = "Учтено — можно оставить как есть или чуть уточнить.";
  } else {
    feedback = "Не хватает явной формулировки — см. подсказку.";
  }

  return { score, maxScore, found, feedback };
}

function buildSummary(percent: number, strengths: string[]): string {
  if (percent >= 92) {
    return "Отличный промпт: можно отправлять в ИИ — роль, контекст, задача по письму и рамки на месте.";
  }
  if (percent >= 75) {
    return strengths.length
      ? `Короткий рабочий промпт — основные элементы есть (${strengths.slice(0, 3).join("; ")}).`
      : "Короткий рабочий промпт — основные элементы на месте, можно отправлять в ИИ.";
  }
  if (percent >= 55) {
    return "Промпт частично готов. Добавьте только то, чего не хватает — без длинных простыней.";
  }
  if (percent >= 35) {
    return "Есть зачатки структуры, но несколько блоков не видны явно. Смотрите подсказки ниже.";
  }
  return "Промпт слишком общий (как «напиши письмо начальнику»). Добавьте роль, контекст и задачу отдельными короткими фразами.";
}

export function evaluatePrompt(
  promptText: string,
  assignment: Assignment,
): EvaluationResult {
  const activeIds: CriterionId[] = [
    ...assignment.requiredCriteria,
    ...(assignment.optionalCriteria ?? []),
  ];

  // Для расчёта процента обязательные критерии = 100%, опциональные дают бонус но cap at 100
  const requiredMax = assignment.requiredCriteria.reduce(
    (s, id) => s + CRITERION_META[id].weight,
    0,
  );
  const optionalMax = (assignment.optionalCriteria ?? []).reduce(
    (s, id) => s + CRITERION_META[id].weight,
    0,
  );

  const criteria: CriterionResult[] = activeIds.map((id) => {
    const meta = CRITERION_META[id];
    const partial = scoreCriterion(id, promptText);
    return {
      id,
      label: meta.label,
      hint: meta.hint,
      ...partial,
    };
  });

  const requiredScore = criteria
    .filter((c) => assignment.requiredCriteria.includes(c.id))
    .reduce((s, c) => s + c.score, 0);

  const optionalScore = criteria
    .filter((c) => assignment.optionalCriteria?.includes(c.id))
    .reduce((s, c) => s + c.score, 0);

  // Процент: обязательные на 100%, опциональный формат — до +10% но итог cap 100
  let percent = Math.round((requiredScore / requiredMax) * 100);
  if (optionalMax > 0 && optionalScore > 0) {
    const bonus = Math.round((optionalScore / optionalMax) * 8);
    percent = Math.min(100, percent + bonus);
  }

  const strengths: string[] = [];
  const improvements: string[] = [];

  for (const c of criteria) {
    const isRequired = assignment.requiredCriteria.includes(c.id);
    if (isCriterionStrong(c)) {
      strengths.push(`${c.label.toLowerCase()} (${c.score}/${c.maxScore})`);
    } else if (isRequired && !c.found) {
      improvements.push(`${c.label}: ${c.hint}`);
    } else if (!isRequired && !c.found && c.id === "outputFormat") {
      improvements.push(`По желанию: ${c.hint.charAt(0).toLowerCase()}${c.hint.slice(1)}`);
    }
  }

  const totalScore = requiredScore + optionalScore;
  const maxScore = requiredMax + optionalMax;

  return {
    totalScore,
    maxScore,
    percent,
    criteria,
    strengths,
    improvements,
    summary: buildSummary(percent, strengths),
    isPassed: percent >= PASS_PERCENT,
    isExcellent: percent >= EXCELLENT_PERCENT,
  };
}

export function formatEvaluationMessage(
  evaluation: EvaluationResult,
  userName?: string,
): string {
  const greeting = userName ? `${userName}, ` : "";
  const lines: string[] = [
    `${greeting}**Оценка: ${evaluation.percent} из 100**`,
    "",
    evaluation.summary,
  ];

  if (evaluation.strengths.length) {
    lines.push("", "**Что уже хорошо:**");
    for (const s of evaluation.strengths) {
      lines.push(`• ${s}`);
    }
  }

  const requiredGaps = evaluation.improvements.filter((i) =>
    i.startsWith("По желанию") ? false : true,
  );
  if (requiredGaps.length) {
    lines.push("", "**Как усилить:**");
    for (const imp of evaluation.improvements) {
      lines.push(`• ${imp}`);
    }
  }

  if (evaluation.isExcellent) {
    lines.push(
      "",
      "Промпт близок к **идеалу**. Можете закрепить результат ещё одной попыткой или перейти к другим материалам курса.",
    );
  } else if (evaluation.isPassed) {
    lines.push(
      "",
      "**Зачёт** (порог 75%). Задание можно считать выполненным.",
      "",
      "Хотите **довести промпт до идеала** (92+)? Напишите улучшенный вариант ниже — разбор подскажет, что ещё усилить.",
    );
  } else {
    lines.push(
      "",
      `До **зачёта** не хватает баллов (нужно ${PASS_PERCENT}). Доработайте промпт по подсказкам выше и отправьте новую попытку.`,
    );
  }

  return lines.join("\n");
}
