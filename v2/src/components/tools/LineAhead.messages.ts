import type { Messages } from "@/lib/i18n/lang";

/** The line ahead of a case, month by month: the section's words and each bar's hover detail. */
export interface LineAheadText {
  title: string;
  /** The unit after the big count: "75,048 cases". */
  cases: string;
  lede: string;
  /** Starts with its own space where the language puts one between sentences. */
  pace: (perDay: string, days: string, n: number) => string;
  chartLabel: string;
  /** "Before September 2025": the bar that sums every older month. */
  before: (month: string) => string;
  ownSuffix: string;
  tipCount: (n: string) => string;
  ownNote: string;
  outOfLine: string;
}

export const LINE_AHEAD = {
  en: {
    title: "The line ahead of you",
    cases: "cases",
    lede: "Filed before yours and still in DOL's ordinary line.",
    pace: (perDay, days, n) =>
      ` DOL decides about ${perDay} a day lately, so that's about ${days} ${n === 1 ? "day" : "days"} of work.`,
    chartLabel: "Cases ahead of yours in DOL's line, by filing month",
    before: (month) => `Before ${month}`,
    ownSuffix: ", your own month, filed before you",
    tipCount: (n) => `${n} cases still in line`,
    ownNote: "The last bar is your own filing month, counting only the days before yours. ",
    outOfLine: "Cases on hold, at an RFI or on appeal aren't in the line and aren't counted.",
  },
  es: {
    title: "La fila delante de usted",
    cases: "casos",
    lede: "Presentados antes que el suyo y aún en la fila ordinaria del DOL.",
    pace: (perDay, days, n) =>
      ` Últimamente el DOL decide unos ${perDay} al día, así que son unos ${days} ${n === 1 ? "día" : "días"} de trabajo.`,
    chartLabel: "Casos delante del suyo en la fila del DOL, por mes de presentación",
    before: (month) => `Antes de ${month}`,
    ownSuffix: ", su propio mes, presentados antes que usted",
    tipCount: (n) => `${n} casos aún en la fila`,
    ownNote: "La última barra es su propio mes de presentación, y solo cuenta los días antes del suyo. ",
    outOfLine: "Los casos en espera, con una RFI o en apelación no están en la fila y no se cuentan.",
  },
  zh: {
    title: "排在您前面的案件",
    cases: "件",
    lede: "比您早递交、仍在劳工部普通队列中的案件。",
    pace: (perDay, days) => `劳工部最近每天大约判定 ${perDay} 件，相当于大约 ${days} 天的工作量。`,
    chartLabel: "劳工部队列中排在您前面的案件（按递交月份）",
    before: (month) => `${month}之前`,
    ownSuffix: "，您自己的月份，比您早递交",
    tipCount: (n) => `仍在排队 ${n} 件`,
    ownNote: "最后一条是您自己的递交月份，只计算您之前的那些天。",
    outOfLine: "暂缓、处于 RFI 或上诉中的案件不在队列中，也不计入。",
  },
  "pt-br": {
    title: "A fila à sua frente",
    cases: "casos",
    lede: "Protocolados antes do seu e ainda na fila comum do DOL.",
    pace: (perDay, days, n) =>
      ` Ultimamente o DOL decide cerca de ${perDay} por dia, então isso dá cerca de ${days} ${n === 1 ? "dia" : "dias"} de trabalho.`,
    chartLabel: "Casos à frente do seu na fila do DOL, por mês de protocolo",
    before: (month) => `Antes de ${month}`,
    ownSuffix: ", seu próprio mês, protocolados antes de você",
    tipCount: (n) => `${n} casos ainda na fila`,
    ownNote: "A última barra é o seu próprio mês de protocolo, contando só os dias antes do seu. ",
    outOfLine: "Casos em espera, com RFI ou em recurso não estão na fila e não são contados.",
  },
  ko: {
    title: "내 앞의 대기열",
    cases: "건",
    lede: "내 케이스보다 먼저 접수되어 아직 노동부의 일반 대기열에 있는 케이스입니다.",
    pace: (perDay, days) => ` 노동부는 최근 하루에 약 ${perDay}건을 결정하므로, 약 ${days}일 분량의 작업입니다.`,
    chartLabel: "노동부 대기열에서 내 앞에 있는 케이스, 접수 월별",
    before: (month) => `${month} 이전`,
    ownSuffix: ", 내 접수 월, 나보다 먼저 접수",
    tipCount: (n) => `아직 대기열에 ${n}건`,
    ownNote: "마지막 막대는 내 접수 월이며, 내 접수일 이전의 날만 셉니다. ",
    outOfLine: "보류 중이거나 RFI 또는 항소 단계인 케이스는 대기열에 없으며 세지 않습니다.",
  },
  vi: {
    title: "Hàng chờ phía trước bạn",
    cases: "hồ sơ",
    lede: "Nộp trước hồ sơ của bạn và vẫn đang trong hàng chờ thông thường của DOL.",
    pace: (perDay, days) => ` Gần đây DOL quyết định khoảng ${perDay} hồ sơ mỗi ngày, nên đó là khoảng ${days} ngày làm việc.`,
    chartLabel: "Hồ sơ đứng trước hồ sơ của bạn trong hàng chờ của DOL, theo tháng nộp",
    before: (month) => `Trước ${month}`,
    ownSuffix: ", tháng của chính bạn, nộp trước bạn",
    tipCount: (n) => `${n} hồ sơ vẫn trong hàng chờ`,
    ownNote: "Thanh cuối là tháng nộp của chính bạn, chỉ tính những ngày trước ngày của bạn. ",
    outOfLine: "Hồ sơ đang tạm giữ, có RFI hoặc đang kháng cáo không nằm trong hàng chờ và không được tính.",
  },
} satisfies Messages<LineAheadText>;
