import type { Assignment } from "../types";

export const assignments: Assignment[] = [
  {
    id: "letter-to-manager",
    title: "Задание 1. Письмо руководителю",
    intro:
      "Вы тренируетесь писать промпты, которые можно сразу отправить в любой текстовый ИИ (ЯндексGPT, GigaChat, DeepSeek и т.п.). Тренажёр проверит структуру вашего промпта — без подключения к нейросети.",
    situation:
      "Вы отвечаете за проект: сроки сдвинулись из‑за смены требований заказчика. Нужно написать письмо (или письмо в корпоративную почту) непосредственному руководителю: объяснить причину, что уже сделано, какой план и какая помощь нужна — если она нужна.",
    goal:
      "Составьте свой промпт: опишите роль ИИ, контекст (кому пишете и факты по ситуации), задачу (черновик письма), тон, ограничения и при необходимости формат письма.",
    requiredCriteria: ["role", "context", "task", "tone", "constraints"],
    optionalCriteria: ["outputFormat"],
  },
];

export function getAssignment(id: string): Assignment | undefined {
  return assignments.find((a) => a.id === id);
}
