// Должно совпадать с migrations/002_seed_subjects.sql
export const SUBJECTS = [
  { id: 1,  name: "Математический анализ",                       short: "Матан",     icon: "∫",  color: "#4263eb" },
  { id: 2,  name: "Алгебра и геометрия",                         short: "Алгебра",   icon: "△",  color: "#7048e8" },
  { id: 3,  name: "Информационные технологии и программирование", short: "ИТиП",      icon: "</>", color: "#0c8599" },
  { id: 4,  name: "Физика",                                      short: "Физика",    icon: "⚛",  color: "#e8590c" },
  { id: 5,  name: "Введение в специальность",                    short: "Введение",  icon: "✦",  color: "#2f9e44" },
  { id: 6,  name: "Иностранный язык",                            short: "Англ.",     icon: "En", color: "#d6336c" },
  { id: 7,  name: "История России",                              short: "История",   icon: "Ⅸ",  color: "#a6611a" },
  { id: 8,  name: "Основы Российской государственности",         short: "ОРГ",       icon: "§",  color: "#c92a2a" },
  { id: 9,  name: "Введение в языкознание",                      short: "Языкозн.",  icon: "Aa", color: "#5c7cfa" },
  { id: 10, name: "Физическая культура и спорт",                 short: "Физра",     icon: "◎",  color: "#37b24d" },
];

const byId = new Map(SUBJECTS.map((s) => [s.id, s]));

export function subjectById(id) {
  return byId.get(id) || { id, name: `Предмет ${id}`, short: `#${id}`, icon: "?", color: "#868e96" };
}
