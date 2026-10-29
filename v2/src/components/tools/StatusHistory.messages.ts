import type { Messages } from "@/lib/i18n/lang";

/** The case page's status history: its heading, its note and each row's words. Dates arrive formatted. */
export interface StatusHistoryText {
  title: string;
  lede: (from: string) => string;
  /** The first row when the case was already at its status when our dated record began. */
  by: (day: string) => string;
  filed: (day: string) => string;
  now: string;
  heldFor: (n: number, count: string) => string;
}

export const STATUS_HISTORY = {
  en: {
    title: "Every status DOL has shown",
    lede: (from) => `Each change dated to the day DOL made it, as our checks saw it. Our dated record runs from ${from}.`,
    by: (day) => `By ${day}`,
    filed: (day) => `Filed ${day}`,
    now: "(now)",
    heldFor: (n, count) => `Held for ${count} ${n === 1 ? "day" : "days"}`,
  },
  es: {
    title: "Cada estado que ha mostrado el DOL",
    lede: (from) => `Cada cambio fechado el día en que el DOL lo hizo, según nuestras revisiones. Nuestro registro fechado empieza el ${from}.`,
    by: (day) => `Al ${day}`,
    filed: (day) => `Presentado el ${day}`,
    now: "(ahora)",
    heldFor: (n, count) => `Duró ${count} ${n === 1 ? "día" : "días"}`,
  },
  zh: {
    title: "劳工部显示过的每个状态",
    lede: (from) => `每次变化都按劳工部作出变化的日期标注（以我们的查询为准）。我们有日期的记录从 ${from}开始。`,
    by: (day) => `截至 ${day}`,
    filed: (day) => `${day}递交`,
    now: "（当前）",
    heldFor: (_n, count) => `持续 ${count} 天`,
  },
  "pt-br": {
    title: "Cada status que o DOL já mostrou",
    lede: (from) => `Cada mudança datada no dia em que o DOL a fez, como nossas conferências viram. Nosso registro datado começa em ${from}.`,
    by: (day) => `Até ${day}`,
    filed: (day) => `Protocolado em ${day}`,
    now: "(agora)",
    heldFor: (n, count) => `Durou ${count} ${n === 1 ? "dia" : "dias"}`,
  },
  ko: {
    title: "노동부가 보여 준 모든 상태",
    lede: (from) => `각 변경은 노동부가 변경한 날짜로 표시합니다(저희 확인 기준). 날짜가 있는 기록은 ${from}부터입니다.`,
    by: (day) => `${day}까지`,
    filed: (day) => `${day} 접수`,
    now: "(현재)",
    heldFor: (_n, count) => `${count}일 유지`,
  },
  vi: {
    title: "Mọi tình trạng DOL đã hiển thị",
    lede: (from) => `Mỗi thay đổi được ghi theo ngày DOL thực hiện, theo các lần kiểm tra của chúng tôi. Hồ sơ có ngày của chúng tôi bắt đầu từ ${from}.`,
    by: (day) => `Đến ${day}`,
    filed: (day) => `Nộp ngày ${day}`,
    now: "(hiện tại)",
    heldFor: (_n, count) => `Kéo dài ${count} ngày`,
  },
} satisfies Messages<StatusHistoryText>;
