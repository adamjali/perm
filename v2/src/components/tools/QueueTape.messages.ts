import type { Messages } from "@/lib/i18n/lang";

/** The queue tape's own words: its focus label, each month's hover detail, the two flags and the key. */
export interface QueueTapeText {
  chartLabel: string;
  worked: string;
  deciding: string;
  /** "3 months behind where DOL is" */
  behind: (n: number) => string;
  yourMonth: string;
  dolHere: string;
  you: string;
  processed: string;
  pending: string;
}

export const QUEUE_TAPE = {
  en: {
    chartLabel: "DOL's PERM queue by filing month",
    worked: "DOL has worked through these filings",
    deciding: "DOL is deciding these filings now",
    behind: (n) => `${n} ${n === 1 ? "month" : "months"} behind where DOL is`,
    yourMonth: "Your filing month",
    dolHere: "DOL is here",
    you: "You",
    processed: "Processed",
    pending: "Still pending",
  },
  es: {
    chartLabel: "La fila PERM del DOL por mes de presentación",
    worked: "El DOL ya trabajó estas solicitudes",
    deciding: "El DOL está decidiendo estas solicitudes ahora",
    behind: (n) => `${n} ${n === 1 ? "mes" : "meses"} detrás de donde está el DOL`,
    yourMonth: "Su mes de presentación",
    dolHere: "El DOL va aquí",
    you: "Su caso",
    processed: "Procesados",
    pending: "Aún pendientes",
  },
  zh: {
    chartLabel: "劳工部 PERM 队列（按递交月份）",
    worked: "劳工部已审完这些申请",
    deciding: "劳工部正在判定这些申请",
    behind: (n) => `比劳工部的进度晚 ${n} 个月`,
    yourMonth: "您的递交月份",
    dolHere: "劳工部在此",
    you: "您的案件",
    processed: "已处理",
    pending: "仍在等待",
  },
  "pt-br": {
    chartLabel: "A fila PERM do DOL por mês de protocolo",
    worked: "O DOL já trabalhou estes pedidos",
    deciding: "O DOL está decidindo estes pedidos agora",
    behind: (n) => `${n} ${n === 1 ? "mês" : "meses"} atrás de onde o DOL está`,
    yourMonth: "Seu mês de protocolo",
    dolHere: "O DOL está aqui",
    you: "Seu caso",
    processed: "Processados",
    pending: "Ainda pendentes",
  },
  ko: {
    chartLabel: "접수 월별 노동부 PERM 대기열",
    worked: "노동부가 이미 처리한 신청",
    deciding: "노동부가 지금 결정하고 있는 신청",
    behind: (n) => `노동부의 위치보다 ${n}개월 뒤`,
    yourMonth: "내 접수 월",
    dolHere: "노동부 위치",
    you: "내 케이스",
    processed: "처리됨",
    pending: "대기 중",
  },
  vi: {
    chartLabel: "Hàng chờ PERM của DOL theo tháng nộp",
    worked: "DOL đã xét xong các hồ sơ này",
    deciding: "DOL đang quyết định các hồ sơ này",
    behind: (n) => `Sau vị trí của DOL ${n} tháng`,
    yourMonth: "Tháng nộp của bạn",
    dolHere: "DOL ở đây",
    you: "Hồ sơ của bạn",
    processed: "Đã xử lý",
    pending: "Vẫn đang chờ",
  },
} satisfies Messages<QueueTapeText>;
