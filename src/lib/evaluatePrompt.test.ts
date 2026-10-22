import { assignments } from "../data/assignments";
import { evaluatePrompt } from "./evaluatePrompt";

const assignment = assignments[0];

const samples: { name: string; text: string; expectMin: number; expectMax: number }[] = [
  {
    name: "bad baseline",
    text: "Напиши письмо начальнику про задержку проекта",
    expectMin: 40,
    expectMax: 52,
  },
  {
    name: "bad one-liner",
    text: "Напиши письмо начальнику",
    expectMin: 8,
    expectMax: 28,
  },
  {
    name: "Olga-like",
    text:
      "Помоги составить письмо руководителю о сдвиге сроков проекта из-за заказчика понятным деловым языком уважительно",
    expectMin: 60,
    expectMax: 72,
  },
  {
    name: "short structured",
    text: `Ты — помощник по деловой переписке
Пишу непосредственному руководителю: проект X, срок сдвинулся на 2 недели из-за новых требований заказчика
Составь черновик служебного письма: причина, что сделано, план
Деловой уважительный тон, на «вы»
До 1500 знаков, не выдумывай цифры`,
    expectMin: 75,
    expectMax: 95,
  },
  {
    name: "strong",
    text: `Ты — редактор деловой переписки в IT-компании.
Контекст: пишу непосредственному руководителю отдела. Проект «Альфа»: дедлайн сдвинулся с 15 на 29 число — заказчик дважды менял требования к интеграции. Уже согласованы новые ТЗ, команда перераспределила задачи; нужна помощь с приоритетом смежного отдела на тестовый стенд.
Задача: черновик письма в корпоративную почту — тема, обращение, суть задержки, факты, план, конкретный запрос к руководителю.
Тон: корректный, деловой, без оправданий и эмоций, на «вы».
Ограничения: до 1200 знаков; используй только факты из контекста, не придумывай даты и цифры.
Формат: тема письма, приветствие, основная часть, подпись «С уважением, …».`,
    expectMin: 90,
    expectMax: 100,
  },
  {
    name: "false constraints from korotko",
    text: "Помоги составить email директору о статусе проекта — коротко и по делу",
    expectMin: 45,
    expectMax: 58,
  },
  {
    name: "legacy document prompt",
    text: "Ты — аналитик. Проанализируй документ и дай резюме для клиента. Простым языком. До 1000 знаков.",
    expectMin: 40,
    expectMax: 58,
  },
];

let failed = 0;
for (const s of samples) {
  const r = evaluatePrompt(s.text, assignment);
  const ok = r.percent >= s.expectMin && r.percent <= s.expectMax;
  console.log(
    `${ok ? "OK" : "FAIL"} ${s.name}: ${r.percent}% (expected ${s.expectMin}-${s.expectMax})`,
  );
  if (!ok) failed++;
}

if (failed > 0) process.exit(1);
